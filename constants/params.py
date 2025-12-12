from typing import Any, Dict, List, Optional

from constants.weather import (
    DEFAULT_TEMPERATURE_UNIT,
    DEFAULT_TIMEZONE,
    WEATHER_DAILY_METRICS,
    WEATHER_HOURLY_METRICS,
)


DEFAULT_DAILY: List[str] = list(WEATHER_DAILY_METRICS)
DEFAULT_HOURLY: List[str] = list(WEATHER_HOURLY_METRICS)


def build_weather_params(
    latitude: float,
    longitude: float,
    start_date: str,
    end_date: str,
    daily: Optional[List[str]] = None,
    hourly: Optional[List[str]] = None,
    temperature_unit: str = DEFAULT_TEMPERATURE_UNIT,
    timezone: str = DEFAULT_TIMEZONE,
) -> Dict[str, Any]:
    return {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date,
        "end_date": end_date,
        "daily": list(daily) if daily is not None else list(DEFAULT_DAILY),
        "hourly": list(hourly) if hourly is not None else list(DEFAULT_HOURLY),
        "temperature_unit": temperature_unit,
        "timezone": timezone,
    }


__all__ = ["DEFAULT_DAILY", "DEFAULT_HOURLY", "build_weather_params"]
