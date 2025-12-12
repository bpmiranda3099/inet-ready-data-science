"""Open-Meteo archive API client."""
from __future__ import annotations

import time
from typing import Any, Dict

import requests

from constants.error import OpenMeteoRequestError
from constants.weather import OPEN_METEO_API_URL


def fetch_weather_archive(
    params: Dict[str, Any],
    timeout: int = 30,
    retries: int = 2,
    cooldown: float = 1.0,
) -> Dict[str, Any]:
    """Fetch weather archive data with basic retry logic."""
    attempt = 0
    last_exc: Exception | None = None
    while attempt <= retries:
        attempt += 1
        try:
            response = requests.get(OPEN_METEO_API_URL, params=params, timeout=timeout)
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                raise OpenMeteoRequestError("Unexpected response payload type", original=None)
            if not data.get("daily") and not data.get("hourly"):
                raise OpenMeteoRequestError("Response missing 'daily' or 'hourly' data")
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


__all__ = ["fetch_weather_archive"]
