"""Compute daily heat index values from cleaned weather history data."""
from __future__ import annotations

import csv
import math
from pathlib import Path
from typing import Dict, Iterable, List, Optional, cast

from constants.files import HEAT_INDEX_LOG_FILENAME
from constants.path import (
    LOGS_DIR,
    WEATHER_HEAT_INDEX_FILE,
    WEATHER_HISTORY_FILE,
    ensure_dirs,
)
from constants.weather import HEAT_INDEX_TEMPERATURE_COLUMNS, HUMIDITY_AVG_COLUMN
from utils.logger import get_logger
from utils.units import celsius_to_fahrenheit


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


def _compute_heat_index_f(temp_c: float, rh: float) -> float:
    temp_f = cast(float, celsius_to_fahrenheit(temp_c))
    rh = max(0.0, min(rh, 100.0))

    simple = 0.5 * (temp_f + 61.0 + ((temp_f - 68.0) * 1.2) + (rh * 0.094))
    hi = (simple + temp_f) / 2.0

    if hi < 80.0:
        return hi

    hi = (
        -42.379
        + 2.04901523 * temp_f
        + 10.14333127 * rh
        - 0.22475541 * temp_f * rh
        - 0.00683783 * temp_f * temp_f
        - 0.05481717 * rh * rh
        + 0.00122874 * temp_f * temp_f * rh
        + 0.00085282 * temp_f * rh * rh
        - 0.00000199 * temp_f * temp_f * rh * rh
    )

    if rh < 13.0 and 80.0 <= temp_f <= 112.0:
        adjustment = ((13.0 - rh) / 4.0) * math.sqrt(max(0.0, (17.0 - abs(temp_f - 95.0)) / 17.0))
        hi -= adjustment
    elif rh > 85.0 and 80.0 <= temp_f <= 87.0:
        adjustment = ((rh - 85.0) / 10.0) * ((87.0 - temp_f) / 5.0)
        hi += adjustment

    return hi


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

        hi_f = _compute_heat_index_f(temp_c, humidity)
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
