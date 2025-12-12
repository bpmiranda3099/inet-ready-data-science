import csv
import os
import re
import unicodedata
from datetime import datetime
from typing import Dict, List, Optional

from constants.weather import WEATHER_CITY_COLUMN, WEATHER_DATE_COLUMN


def _open_with_fallback(path: str):
    encodings = ["utf-8", "utf-8-sig", "cp1252", "latin-1"]
    for enc in encodings:
        f = None
        try:
            f = open(path, newline="", encoding=enc)
            f.read(1)
            f.seek(0)
            return f
        except UnicodeDecodeError:
            if f is not None:
                try:
                    f.close()
                except Exception:
                    pass
            continue
        except Exception:
            raise

    return open(path, newline="", encoding="utf-8", errors="replace")


def _normalize_name(name: str) -> str:
    if name is None:
        return ""
    nfkd = unicodedata.normalize("NFKD", name)
    without_diacritics = "".join(c for c in nfkd if not unicodedata.combining(c))
    cleaned = re.sub(r"[^A-Za-z ]+", "", without_diacritics)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _format_coord(value: Optional[str]) -> str:
    if value is None or value == "":
        return ""
    try:
        f = float(value)
    except (TypeError, ValueError):
        return ""
    return f"{f:.6f}"


def clean_city_coords(raw_path: str, clean_path: str) -> int:
    os.makedirs(os.path.dirname(clean_path), exist_ok=True)

    written = 0
    rf = _open_with_fallback(raw_path)
    with rf, open(clean_path, "w", newline="", encoding="utf-8") as wf:
        reader = csv.reader(rf)
        writer = csv.writer(wf)
        header = next(reader, None)
        if header:
            writer.writerow(header)
        for row in reader:
            if not row:
                continue
            name = row[0] if len(row) > 0 else ""
            lat = row[1] if len(row) > 1 else ""
            lon = row[2] if len(row) > 2 else ""

            name_clean = _normalize_name(name)
            lat_clean = _format_coord(lat)
            lon_clean = _format_coord(lon)

            writer.writerow([name_clean, lat_clean, lon_clean])
            written += 1

    return written


def _parse_date(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return datetime.min


def _parse_float(value: Optional[str]) -> Optional[float]:
    if value is None:
        return None
    stripped = value.strip()
    if not stripped or stripped.lower() == "nan":
        return None
    try:
        parsed = float(stripped)
    except ValueError:
        return None
    if parsed == 0.0:
        return None
    return parsed


def _fill_series(values: List[Optional[float]]) -> List[float]:
    filled: List[Optional[float]] = values[:]
    last: Optional[float] = None
    for idx, val in enumerate(filled):
        if val is None:
            filled[idx] = last
        else:
            last = val

    last = None
    for idx in range(len(filled) - 1, -1, -1):
        val = filled[idx]
        if val is None:
            filled[idx] = last
        else:
            last = val

    for idx, val in enumerate(filled):
        if val is None:
            filled[idx] = 0.0

    smoothed: List[float] = []
    window = 3
    for idx, _ in enumerate(filled):
        start = max(0, idx - window + 1)
        subset = [v for v in filled[start : idx + 1] if v is not None]
        if subset:
            smoothed.append(sum(subset) / len(subset))
        else:
            smoothed.append(0.0)
    return smoothed


def clean_weather_history(raw_path: str, clean_path: str) -> int:
    os.makedirs(os.path.dirname(clean_path), exist_ok=True)
    rf = _open_with_fallback(raw_path)
    with rf:
        rows = list(csv.DictReader(rf))
    if not rows:
        return 0

    fieldnames = list(rows[0].keys())
    meta_cols = {WEATHER_CITY_COLUMN, WEATHER_DATE_COLUMN}
    value_cols = [col for col in fieldnames if col not in meta_cols]

    grouped: Dict[str, List[Dict[str, str]]] = {}
    for row in rows:
        key = row.get(WEATHER_CITY_COLUMN, "unknown")
        grouped.setdefault(key, []).append(row)

    cleaned_rows: List[Dict[str, str]] = []
    for city, city_rows in grouped.items():
        city_rows.sort(key=lambda r: _parse_date(r.get("date", "")))
        for col in value_cols:
            series = [_parse_float(r.get(col)) for r in city_rows]
            filled = _fill_series(series)
            for idx, value in enumerate(filled):
                city_rows[idx][col] = f"{value:.2f}"
        cleaned_rows.extend(city_rows)

    cleaned_rows.sort(
        key=lambda r: (r.get(WEATHER_CITY_COLUMN, ""), r.get(WEATHER_DATE_COLUMN, ""))
    )

    with open(clean_path, "w", newline="", encoding="utf-8") as wf:
        writer = csv.DictWriter(wf, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(cleaned_rows)

    return len(cleaned_rows)
