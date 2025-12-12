"""Fetch Cavite city and municipal demographic data from Wikipedia.

The script scrapes the population table from the Cavite Wikipedia page, tidies the
values, aligns the municipality names to the canonical names used in the project,
and writes the cleaned dataset to dataset/clean/cavite_demographics.csv.
"""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path
from typing import Iterable

import pandas as pd
import requests

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = PROJECT_ROOT / "dataset" / "clean" / "cavite_demographics.csv"
SOURCE_URL = "https://en.wikipedia.org/wiki/Cavite"
USER_AGENT = "INET-READY-Data-Scraper/1.0 (+https://github.com/)"

NAME_OVERRIDES = {
    "City of Bacoor": "Bacoor",
    "City of Cavite": "Cavite City",
    "City of Dasmariñas": "Dasmarinas",
    "City of General Trias": "General Trias",
    "City of Imus": "Imus",
    "City of Tagaytay": "Tagaytay",
    "City of Trece Martires": "Trece Martires",
    "Gen. Emilio Aguinaldo": "General Emilio Aguinaldo",
    "Gen. Mariano Alvarez": "General Mariano Alvarez",
    "General Mariano Álvarez": "General Mariano Alvarez",
    "Mendez-Nuñez": "Mendez",
    "Maragondon": "Maragondon",
    "Naic": "Naic",
    "Carmona": "Carmona",
    "Tanza": "Tanza",
    "Ternate": "Ternate",
    "Magallanes": "Magallanes",
    "Silang": "Silang",
    "Indang": "Indang",
    "Amadeo": "Amadeo",
    "Alfonso": "Alfonso",
    "Bacoor": "Bacoor",
    "General Trias": "General Trias",
    "Dasmariñas": "Dasmarinas",
    "Imus": "Imus",
    "Trece Martires": "Trece Martires",
    "Cavite City": "Cavite City",
    "Tagaytay": "Tagaytay",
}

CANONICAL_CITIES = {
    "Amadeo",
    "Imus",
    "General Trias",
    "Dasmarinas",
    "Bacoor",
    "Carmona",
    "Kawit",
    "Noveleta",
    "Silang",
    "Naic",
    "Tanza",
    "Alfonso",
    "Indang",
    "Rosario",
    "Trece Martires",
    "General Mariano Alvarez",
    "Cavite City",
    "Tagaytay",
    "Mendez",
    "Ternate",
    "Maragondon",
    "Magallanes",
    "General Emilio Aguinaldo",
}

COMPONENT_CITIES = {
    "Bacoor",
    "Carmona",
    "Cavite City",
    "Dasmarinas",
    "General Trias",
    "Imus",
    "Silang",  # approved cityhood 2024 (pending plebiscite)
    "Tagaytay",
    "Trece Martires",
}


@dataclass
class DemographicRecord:
    city: str
    classification: str
    district: str | None
    population_2020: int | None
    population_2015: int | None
    annual_growth_rate_pct: float | None
    area_km2: float | None
    density_per_km2: float | None
    barangays: int | None
    province_population_share_pct: float | None

    def to_row(self, collected_at: str) -> list[str]:
        def fmt(value: object | None) -> str:
            return "" if value is None else f"{value}"

        return [
            self.city,
            self.classification,
            self.district or "",
            fmt(self.population_2020),
            fmt(self.population_2015),
            fmt(self.annual_growth_rate_pct),
            fmt(self.area_km2),
            fmt(self.density_per_km2),
            fmt(self.barangays),
            fmt(self.province_population_share_pct),
            SOURCE_URL,
            collected_at,
        ]


def strip_notes(value: str) -> str:
    return re.sub(r"\[[^\]]*\]", "", value).strip()


def parse_number(value: object) -> float | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    text = strip_notes(text)
    text = text.replace(",", "")
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return None
    number = float(match.group(0))
    return number


def parse_percentage(value: object) -> float | None:
    if value is None:
        return None
    text = strip_notes(str(value))
    text = text.replace("%", "")
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return None
    return float(match.group(0))


def normalize_name(raw_name: str) -> str:
    normalized = strip_notes(raw_name)
    normalized = normalized.replace("City of ", "City of ")
    normalized = normalized.replace("–", "-")
    normalized = normalized.replace("ñ", "n")
    normalized = normalized.replace("Ñ", "N")
    normalized = normalized.strip()
    return NAME_OVERRIDES.get(normalized, normalized)


def detect_classification(raw: str, city_name: str) -> str:
    token = strip_notes(raw).lower()
    special_markers = {"*", "∗", "†"}
    if city_name in COMPONENT_CITIES:
        return "city"
    if any(marker in raw for marker in special_markers):
        return "city"
    if any(keyword in token for keyword in ("city", "component")):
        return "city"
    return "municipality"


def locate_population_table(tables: Iterable[pd.DataFrame]) -> pd.DataFrame:
    for table in tables:
        if isinstance(table.columns, pd.MultiIndex):
            top_labels = {str(label[0]).lower() for label in table.columns}
            if any("city or municipality" in label for label in top_labels):
                return table
        else:
            labels = {str(label).lower() for label in table.columns}
            if "city or municipality" in labels:
                return table
    raise RuntimeError("Unable to locate Cavite population table on the page")


def fetch_dataframe() -> pd.DataFrame:
    response = requests.get(SOURCE_URL, headers={"User-Agent": USER_AGENT}, timeout=30)
    response.raise_for_status()
    html = response.text
    tables = pd.read_html(StringIO(html))
    return locate_population_table(tables)


def build_records(df: pd.DataFrame) -> list[DemographicRecord]:
    records: list[DemographicRecord] = []
    for _, row in df.iterrows():
        name_value = row.get(("City or municipality", "Unnamed: 0_level_1"))
        if not isinstance(name_value, str):
            continue
        city = normalize_name(name_value)
        if city not in CANONICAL_CITIES:
            continue
        classification_hint = row.get(("City or municipality", "Unnamed: 1_level_1"), "")
        district_value = row.get(("District[50]", "Unnamed: 2_level_1"))
        population_share = parse_percentage(row.get(("Population", "(2020)[7]")))
        population_2020 = parse_number(row.get(("Population", "(2020)[7].1")))
        population_2015 = parse_number(row.get(("Population", "(2015)[51]")))
        growth_rate = parse_percentage(row.get(("±% p.a.", "Unnamed: 6_level_1")))
        area_km2 = parse_number(row.get(("Area[50]", "km2")))
        density_km2 = parse_number(row.get(("Density", "/km2")))
        barangays = parse_number(row.get(("Barangay", "Unnamed: 11_level_1")))

        records.append(
            DemographicRecord(
                city=city,
            classification=detect_classification(str(classification_hint or ""), city),
                district=str(district_value).strip() if isinstance(district_value, str) else None,
                population_2020=int(population_2020) if population_2020 is not None else None,
                population_2015=int(population_2015) if population_2015 is not None else None,
                annual_growth_rate_pct=round(growth_rate, 2) if growth_rate is not None else None,
                area_km2=round(area_km2, 2) if area_km2 is not None else None,
                density_per_km2=round(density_km2, 2) if density_km2 is not None else None,
                barangays=int(barangays) if barangays is not None else None,
                province_population_share_pct=round(population_share, 2) if population_share is not None else None,
            )
        )

    known_cities = {record.city for record in records}
    missing = sorted(CANONICAL_CITIES - known_cities)
    if missing:
        raise RuntimeError(f"Missing demographic entries for: {', '.join(missing)}")

    return sorted(records, key=lambda record: record.city)


def main() -> None:
    df = fetch_dataframe()
    records = build_records(df)
    collected_at = datetime.now(timezone.utc).isoformat()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "city",
                "classification",
                "district",
                "population_2020",
                "population_2015",
                "annual_growth_rate_pct",
                "area_km2",
                "density_per_km2",
                "barangays",
                "province_population_share_pct",
                "source_url",
                "collected_at",
            ]
        )
        for record in records:
            writer.writerow(record.to_row(collected_at))
    print(f"Saved {len(records)} Cavite demographic rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
