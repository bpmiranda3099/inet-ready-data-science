"""Heat index calculation helpers."""
from __future__ import annotations

import math

from utils.units import celsius_to_fahrenheit


def compute_heat_index_f(temp_c: float, relative_humidity: float) -> float:
    """Compute the heat index (in Fahrenheit) from Celsius temperature and relative humidity."""
    temp_f = float(celsius_to_fahrenheit(temp_c))
    rh = max(0.0, min(relative_humidity, 100.0))

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


__all__ = ["compute_heat_index_f"]
