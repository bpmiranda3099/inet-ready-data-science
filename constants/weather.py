"""Shared weather-related schema values and API defaults."""
from __future__ import annotations

from typing import Final, List, Sequence

# Canonical column names
WEATHER_CITY_COLUMN: Final[str] = "city"
WEATHER_CITY_RAW_COLUMN: Final[str] = "City"
WEATHER_DATE_COLUMN: Final[str] = "date"
WEATHER_DATE_RAW_COLUMN: Final[str] = "Date"
WEATHER_LAT_COLUMN: Final[str] = "Latitude"
WEATHER_LON_COLUMN: Final[str] = "Longitude"
WEATHER_LAT_CLEAN_COLUMN: Final[str] = "latitude"
WEATHER_LON_CLEAN_COLUMN: Final[str] = "longitude"

CITY_COORDS_HEADER: Final[List[str]] = [
    WEATHER_CITY_RAW_COLUMN,
    WEATHER_LAT_COLUMN,
    WEATHER_LON_COLUMN,
]

CITY_COLUMN_ALIASES: Final[Sequence[str]] = (
    WEATHER_CITY_COLUMN,
    WEATHER_CITY_RAW_COLUMN,
)
LAT_COLUMN_ALIASES: Final[Sequence[str]] = (
    WEATHER_LAT_COLUMN,
    WEATHER_LAT_CLEAN_COLUMN,
)
LON_COLUMN_ALIASES: Final[Sequence[str]] = (
    WEATHER_LON_COLUMN,
    WEATHER_LON_CLEAN_COLUMN,
)

# Metric definitions
WEATHER_DAILY_METRICS: Final[List[str]] = [
    "temperature_2m_max",
    "temperature_2m_min",
    "apparent_temperature_max",
    "apparent_temperature_min",
    "wind_speed_10m_max",
    "shortwave_radiation_sum",
]

WEATHER_HOURLY_METRICS: Final[List[str]] = ["relative_humidity_2m"]
HOURLY_AVG_SUFFIX: Final[str] = "_avg"

def hourly_average_name(metric: str) -> str:
    return f"{metric}{HOURLY_AVG_SUFFIX}"

WEATHER_HOURLY_AVERAGE_COLUMNS: Final[List[str]] = [
    hourly_average_name(metric) for metric in WEATHER_HOURLY_METRICS
]

HUMIDITY_AVG_COLUMN: Final[str] = hourly_average_name("relative_humidity_2m")

HEAT_INDEX_TEMPERATURE_COLUMNS: Final[List[str]] = [
    "temperature_2m_max",
    "temperature_2m_min",
    "apparent_temperature_max",
    "apparent_temperature_min",
]

WEATHER_HISTORY_HEADER: Final[List[str]] = [
    WEATHER_CITY_COLUMN,
    WEATHER_DATE_COLUMN,
    *WEATHER_DAILY_METRICS,
    *WEATHER_HOURLY_AVERAGE_COLUMNS,
]

# API defaults
WEATHER_LOOKBACK_YEARS: Final[int] = 5
OPEN_METEO_TIMEOUT_SECONDS: Final[int] = 60
OPEN_METEO_MAX_RETRIES: Final[int] = 5
OPEN_METEO_REQUEST_COOLDOWN: Final[float] = 1.5
DEFAULT_TEMPERATURE_UNIT: Final[str] = "celsius"
DEFAULT_TIMEZONE: Final[str] = "Asia/Singapore"
OPEN_METEO_API_URL: Final[str] = "https://archive-api.open-meteo.com/v1/archive"

__all__ = [
    "WEATHER_CITY_COLUMN",
    "WEATHER_CITY_RAW_COLUMN",
    "WEATHER_DATE_COLUMN",
    "WEATHER_DATE_RAW_COLUMN",
    "WEATHER_LAT_COLUMN",
    "WEATHER_LON_COLUMN",
    "WEATHER_LAT_CLEAN_COLUMN",
    "WEATHER_LON_CLEAN_COLUMN",
    "CITY_COORDS_HEADER",
    "CITY_COLUMN_ALIASES",
    "LAT_COLUMN_ALIASES",
    "LON_COLUMN_ALIASES",
    "WEATHER_DAILY_METRICS",
    "WEATHER_HOURLY_METRICS",
    "HOURLY_AVG_SUFFIX",
    "hourly_average_name",
    "WEATHER_HOURLY_AVERAGE_COLUMNS",
    "HUMIDITY_AVG_COLUMN",
    "HEAT_INDEX_TEMPERATURE_COLUMNS",
    "WEATHER_HISTORY_HEADER",
    "WEATHER_LOOKBACK_YEARS",
    "OPEN_METEO_TIMEOUT_SECONDS",
    "OPEN_METEO_MAX_RETRIES",
    "OPEN_METEO_REQUEST_COOLDOWN",
    "DEFAULT_TEMPERATURE_UNIT",
    "DEFAULT_TIMEZONE",
    "OPEN_METEO_API_URL",
]
