"""Open-Meteo API client helpers."""
from __future__ import annotations

import time
from typing import Any, Dict

import requests

from constants.error import OpenMeteoRequestError
from constants.weather import OPEN_METEO_API_URL, OPEN_METEO_FORECAST_API_URL


def _perform_request(
    url: str,
    params: Dict[str, Any],
    *,
    timeout: int,
    retries: int,
    cooldown: float,
) -> Dict[str, Any]:
    attempt = 0
    last_exc: Exception | None = None
    while attempt <= retries:
        attempt += 1
        try:
            response = requests.get(url, params=params, timeout=timeout)
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                raise OpenMeteoRequestError("Unexpected response payload type", original=None)
            if cooldown > 0:
                time.sleep(cooldown)
            return data
        except (requests.Timeout, requests.ConnectionError) as exc:
            last_exc = exc
            if attempt > retries:
                raise OpenMeteoRequestError("Open-Meteo request timed out", original=exc) from exc
            time.sleep(attempt)
        except requests.HTTPError as exc:
            status_code = exc.response.status_code if exc.response is not None else None
            if status_code == 429 and attempt <= retries:
                wait_time = min(5.0 * attempt, 60.0)
                time.sleep(wait_time)
                continue
            raise OpenMeteoRequestError(str(exc), status_code=status_code, original=exc) from exc
        except Exception as exc:
            last_exc = exc
            if attempt > retries:
                raise OpenMeteoRequestError("Failed to fetch Open-Meteo data", original=exc) from exc
            time.sleep(0.5 * attempt)

    raise OpenMeteoRequestError("Failed to fetch Open-Meteo data", original=last_exc)


def fetch_weather_archive(
    params: Dict[str, Any],
    timeout: int = 30,
    retries: int = 2,
    cooldown: float = 1.0,
) -> Dict[str, Any]:
    """Fetch weather archive data with basic retry logic."""
    data = _perform_request(
        OPEN_METEO_API_URL,
        params,
        timeout=timeout,
        retries=retries,
        cooldown=cooldown,
    )
    if not data.get("daily") and not data.get("hourly"):
        raise OpenMeteoRequestError("Response missing 'daily' or 'hourly' data")
    return data


def fetch_weather_forecast(
    params: Dict[str, Any],
    timeout: int = 30,
    retries: int = 2,
    cooldown: float = 1.0,
) -> Dict[str, Any]:
    """Fetch near-real-time hourly forecast data."""
    data = _perform_request(
        OPEN_METEO_FORECAST_API_URL,
        params,
        timeout=timeout,
        retries=retries,
        cooldown=cooldown,
    )
    if not data.get("hourly") and not data.get("current_weather"):
        raise OpenMeteoRequestError("Response missing 'hourly' or 'current_weather' data")
    return data


__all__ = ["fetch_weather_archive", "fetch_weather_forecast"]
