"""Compute daily heat index values from cleaned weather history data."""
from __future__ import annotations

import csv
from pathlib import Path
from typing import Dict, Iterable, List, Optional

from constants.files import HEAT_INDEX_LOG_FILENAME
from constants.path import (
    LOGS_DIR,
    WEATHER_HEAT_INDEX_FILE,
    WEATHER_HISTORY_FILE,
    ensure_dirs,
)
from constants.weather import HEAT_INDEX_TEMPERATURE_COLUMNS, HUMIDITY_AVG_COLUMN
from utils.heat_index import compute_heat_index_f
from utils.logger import get_logger


def _parse_float(value: Optional[str]) -> Optional[float]:
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    try:
        return float(stripped)
    except ValueError:
        return None


def _average_temperature(row: Dict[str, str]) -> Optional[float]:
    values = [_parse_float(row.get(col)) for col in HEAT_INDEX_TEMPERATURE_COLUMNS]
    filtered = [v for v in values if v is not None]
    if not filtered:
        return None
    return sum(filtered) / len(filtered)



def _rows_with_heat_index(rows: Iterable[Dict[str, str]], logger) -> List[Dict[str, str]]:
    output: List[Dict[str, str]] = []
    skipped = 0
    for row in rows:
        city = (row.get("city") or row.get("City") or "").strip()
        day = (row.get("date") or row.get("Date") or "").strip()
        if not city or not day:
            skipped += 1
            continue

        temp_c = _average_temperature(row)
        humidity = _parse_float(row.get(HUMIDITY_AVG_COLUMN))
        if temp_c is None or humidity is None:
            skipped += 1
            continue

        hi_f = compute_heat_index_f(temp_c, humidity)
        output.append({"city": city, "date": day, "heat_index": f"{hi_f:.2f}"})

    if skipped:
        logger.warning(f"Skipped {skipped} rows due to missing data")
    return output


def main() -> None:
    ensure_dirs()
    logger = get_logger(
        name="compute_heat_index",
        log_dir=str(LOGS_DIR),
        log_filename=HEAT_INDEX_LOG_FILENAME,
        use_case="data",
    )

    source = Path(WEATHER_HISTORY_FILE)
    if not source.exists():
        logger.error(f"Missing source data: {source}. Run get_historical_weather_data.py first.")
        return

    with open(source, newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)

    logger.info(f"Loaded {len(rows)} weather rows")
    heat_index_rows = _rows_with_heat_index(rows, logger)
    if not heat_index_rows:
        logger.warning("No heat index values computed")
        return

    destination = Path(WEATHER_HEAT_INDEX_FILE)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with open(destination, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["city", "date", "heat_index"])
        writer.writeheader()
        writer.writerows(heat_index_rows)

    logger.info(f"Wrote {len(heat_index_rows)} heat index rows to {destination}")


if __name__ == "__main__":
    main()
