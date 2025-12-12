from typing import Any, Dict

from constants.weather import (
    HEAT_INDEX_TEMPERATURE_COLUMNS,
    HUMIDITY_AVG_COLUMN,
)

HEAT_INDEX_FEATURE_CONFIG: Dict[str, Any] = {
    "max_lag_days": 7,
    "rolling_window_days": 7,
    "validation_days": 90,
    "fallback_split_fraction": 0.8,
    "seasonality_period": 365.25,
    "time_cols": ["dayofyear", "sin_day", "cos_day"],
    "forecast_horizon_days": 14,
}

HEAT_INDEX_TRAINING_LIMITS: Dict[str, Any] = {
    "large_dataset_rows": 30000,
    "min_estimators": 800,
    "max_estimators": 2500,
    "small_depth": 6,
    "large_depth": 7,
    "small_learning_rate": 0.08,
    "large_learning_rate": 0.05,
    "small_subsample": 1.0,
    "large_subsample": 0.9,
}

HEAT_INDEX_BASE_PARAMS: Dict[str, Any] = {
    "tree_method": "hist",
    "device": "cuda",
    "colsample_bytree": 0.9,
    "reg_lambda": 1.0,
    "reg_alpha": 0.0,
    "objective": "reg:squarederror",
}

_HEAT_INDEX_AUX_COLUMNS = [
    "wind_speed_10m_max",
    "shortwave_radiation_sum",
    HUMIDITY_AVG_COLUMN,
]

HEAT_INDEX_NUMERIC_COLUMNS = [
    *HEAT_INDEX_TEMPERATURE_COLUMNS,
    *_HEAT_INDEX_AUX_COLUMNS,
]


__all__ = [
    "HEAT_INDEX_FEATURE_CONFIG",
    "HEAT_INDEX_TRAINING_LIMITS",
    "HEAT_INDEX_BASE_PARAMS",
    "HEAT_INDEX_NUMERIC_COLUMNS",
]
