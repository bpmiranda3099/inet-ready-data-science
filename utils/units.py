"""Unit conversion helpers shared across data pipelines."""
from __future__ import annotations

from typing import TYPE_CHECKING, Union, cast

if TYPE_CHECKING:  # pragma: no cover - typing only
    import numpy as np
    import pandas as pd

NumberLike = Union[float, int, "np.ndarray", "pd.Series"]


def fahrenheit_to_celsius(values: NumberLike) -> NumberLike:
    """Convert Fahrenheit inputs to Celsius, preserving the original type."""
    return cast(NumberLike, (values - 32.0) * (5.0 / 9.0))


def celsius_to_fahrenheit(values: NumberLike) -> NumberLike:
    """Convert Celsius inputs to Fahrenheit, preserving the original type."""
    return cast(NumberLike, (values * (9.0 / 5.0)) + 32.0)


__all__ = ["fahrenheit_to_celsius", "celsius_to_fahrenheit"]
