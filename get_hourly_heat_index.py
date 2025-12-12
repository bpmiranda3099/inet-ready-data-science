from __future__ import annotations

import csv
import json
from datetime import datetime, timezone, timedelta, tzinfo
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from constants.error import OpenMeteoRequestError
from constants.files import GET_HOURLY_HEAT_INDEX_LOG_FILENAME
from constants.params import DEFAULT_HOURLY
from constants.path import (
    CITY_COORDS_FILE,
    HOURLY_HEAT_INDEX_FILE,
    HOURLY_HEAT_INDEX_PUBLIC_FILE,
    LOGS_DIR,
    ensure_dirs,
)
from constants.weather import (
    CITY_COLUMN_ALIASES,
    DEFAULT_TEMPERATURE_UNIT,
    DEFAULT_TIMEZONE,
    LAT_COLUMN_ALIASES,
    LON_COLUMN_ALIASES,
    OPEN_METEO_MAX_RETRIES,
    OPEN_METEO_REQUEST_COOLDOWN,
    OPEN_METEO_TIMEOUT_SECONDS,
)
from routes.openmeteo import fetch_weather_forecast
from utils.heat_index import compute_heat_index_f
from utils.logger import get_logger
from utils.units import fahrenheit_to_celsius

HOURLY_METRICS: Sequence[str] = tuple(sorted(set(DEFAULT_HOURLY + ["temperature_2m", "apparent_temperature"])))
MAX_EXPORTED_HOURS = 48
PAST_DAYS = 1
FORECAST_DAYS = 1


def _read_cities(path: Path) -> List[Tuple[str, float, float]]:
    if not path.exists():
        return []
    cities: List[Tuple[str, float, float]] = []
    with open(path, newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            name = next((row.get(alias) for alias in CITY_COLUMN_ALIASES if row.get(alias)), None)
            lat = next((row.get(alias) for alias in LAT_COLUMN_ALIASES if row.get(alias)), None)
            lon = next((row.get(alias) for alias in LON_COLUMN_ALIASES if row.get(alias)), None)
            if not name or not lat or not lon:
                continue
            try:
                cities.append((name.strip(), float(lat), float(lon)))
            except ValueError:
                continue
    return cities


def _safe_float(values: Sequence[Any], index: int) -> Optional[float]:
    if index >= len(values):
        return None
    value = values[index]
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _build_forecast_params(lat: float, lon: float) -> Dict[str, Any]:
    return {
        "latitude": lat,
        "longitude": lon,
        "hourly": list(HOURLY_METRICS),
        "temperature_unit": DEFAULT_TEMPERATURE_UNIT,
        "timezone": DEFAULT_TIMEZONE,
        "past_days": PAST_DAYS,
        "forecast_days": FORECAST_DAYS,
    }


def _point_from_hour(
    city: str,
    timestamp: str,
    temp_c: float,
    humidity: float,
    apparent_c: Optional[float],
    tz: tzinfo,
) -> Dict[str, Any]:
    dt_local = datetime.fromisoformat(timestamp).replace(tzinfo=tz)
    hi_f = compute_heat_index_f(temp_c, humidity)
    hi_c = float(fahrenheit_to_celsius(hi_f))
    point: Dict[str, Any] = {
        "city": city,
        "timestamp": dt_local.isoformat(),
        "temperature_c": round(temp_c, 2),
        "relative_humidity": round(humidity, 2),
        "heat_index_f": round(hi_f, 2),
        "heat_index_c": round(hi_c, 2),
        "_dt": dt_local,
    }
    if apparent_c is not None:
        point["apparent_temperature_c"] = round(apparent_c, 2)
    return point


def _build_points(city: str, hourly: Dict[str, List[Any]], tz: tzinfo) -> List[Dict[str, Any]]:
    times = [str(ts) for ts in (hourly.get("time") or [])]
    temps = hourly.get("temperature_2m") or []
    humidity = hourly.get("relative_humidity_2m") or []
    apparent = hourly.get("apparent_temperature") or []
    points: List[Dict[str, Any]] = []
    for idx, stamp in enumerate(times):
        temp_c = _safe_float(temps, idx)
        rh = _safe_float(humidity, idx)
        if temp_c is None or rh is None:
            continue
        apparent_c = _safe_float(apparent, idx)
        try:
            point = _point_from_hour(city, stamp, temp_c, rh, apparent_c, tz)
        except ValueError:
            continue
        points.append(point)
    points.sort(key=lambda item: item["_dt"])
    return points


def _select_current_point(points: Sequence[Dict[str, Any]], now_local: datetime) -> Optional[Dict[str, Any]]:
    if not points:
        return None
    past = [point for point in points if point["_dt"] <= now_local]
    if past:
        return past[-1]
    return points[0]


def _strip_dt(point: Dict[str, Any]) -> Dict[str, Any]:
    point = dict(point)
    point.pop("_dt", None)
    return point


def _resolve_timezone(name: str, logger) -> tzinfo:
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError:
        logger.warning("ZoneInfo %s missing. Falling back to UTC+08:00 (fixed offset).", name)
        return timezone(timedelta(hours=8), name="UTC+08:00")


def main() -> None:
    ensure_dirs()
    logger = get_logger(
        name="get_hourly_heat_index",
        log_dir=str(LOGS_DIR),
        log_filename=GET_HOURLY_HEAT_INDEX_LOG_FILENAME,
        use_case="data",
    )

    cities = _read_cities(Path(CITY_COORDS_FILE))
    if not cities:
        logger.warning("No city coordinates available. Run get_city_coords.py first.")
        return

    tz = _resolve_timezone(DEFAULT_TIMEZONE, logger)
    now_local = datetime.now(tz)
    all_points: List[Dict[str, Any]] = []
    summaries: List[Dict[str, Any]] = []

    for name, lat, lon in cities:
        params = _build_forecast_params(lat, lon)
        try:
            payload = fetch_weather_forecast(
                params,
                timeout=OPEN_METEO_TIMEOUT_SECONDS,
                retries=OPEN_METEO_MAX_RETRIES,
                cooldown=OPEN_METEO_REQUEST_COOLDOWN,
            )
        except OpenMeteoRequestError as exc:
            logger.error("Failed to fetch hourly data for %s: %s", name, exc)
            continue

        hourly_section = payload.get("hourly") or {}
        points = _build_points(name, hourly_section, tz)
        if not points:
            logger.warning("No hourly samples available for %s", name)
            continue

        current_point = _select_current_point(points, now_local)
        summary = {
            "city": name,
            "latitude": lat,
            "longitude": lon,
            "current": _strip_dt(current_point) if current_point else None,
            "hourly": [_strip_dt(point) for point in points[-MAX_EXPORTED_HOURS:]],
        }
        summaries.append(summary)
        all_points.extend(points)
        logger.info("Collected %d hourly points for %s", len(points), name)

    if not all_points:
        logger.warning("No hourly heat index data collected.")
        return

    header = [
        "city",
        "timestamp",
        "temperature_c",
        "apparent_temperature_c",
        "relative_humidity",
        "heat_index_f",
        "heat_index_c",
    ]
    with open(HOURLY_HEAT_INDEX_FILE, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header)
        writer.writeheader()
        for point in all_points:
            writer.writerow({key: point.get(key) for key in header})
    logger.info("Wrote %d hourly rows to %s", len(all_points), HOURLY_HEAT_INDEX_FILE)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "timezone": DEFAULT_TIMEZONE,
        "unit": "celsius",
        "cities": summaries,
    }
    HOURLY_HEAT_INDEX_PUBLIC_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(HOURLY_HEAT_INDEX_PUBLIC_FILE, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
    logger.info("Wrote public hourly summary to %s", HOURLY_HEAT_INDEX_PUBLIC_FILE)


if __name__ == "__main__":
    main()
