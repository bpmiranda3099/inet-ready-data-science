from typing import Final

LOG_FILENAME_TEMPLATE: Final[str] = "{name}.log"

DEFAULT_APP_NAME: Final[str] = "application"

CITY_COORDS_FILENAME: Final[str] = "city_coords.csv"
GET_CITY_LOG_FILENAME: Final[str] = "get_city_coords.log"
WEATHER_HISTORY_FILENAME: Final[str] = "weather_history.csv"
GET_WEATHER_LOG_FILENAME: Final[str] = "get_historical_weather_data.log"
WEATHER_HEAT_INDEX_FILENAME: Final[str] = "weather_heat_index.csv"
HEAT_INDEX_LOG_FILENAME: Final[str] = "compute_heat_index.log"
HEAT_INDEX_PREDICTIONS_FILENAME: Final[str] = "heat_index_predictions.csv"
PREDICT_HEAT_INDEX_LOG_FILENAME: Final[str] = "predict_heat_index.log"
HEAT_INDEX_MODEL_FILENAME: Final[str] = "heat_index_xgb.json"
METRICS_LOG_FILENAME: Final[str] = "metrics.log"
HOURLY_HEAT_INDEX_FILENAME: Final[str] = "hourly_heat_index.csv"
GET_HOURLY_HEAT_INDEX_LOG_FILENAME: Final[str] = "get_hourly_heat_index.log"
HOURLY_HEAT_INDEX_JSON_FILENAME: Final[str] = "hourly_heat_index.json"

__all__ = [
    "LOG_FILENAME_TEMPLATE",
    "DEFAULT_APP_NAME",
    "CITY_COORDS_FILENAME",
    "GET_CITY_LOG_FILENAME",
    "WEATHER_HISTORY_FILENAME",
    "GET_WEATHER_LOG_FILENAME",
    "WEATHER_HEAT_INDEX_FILENAME",
    "HEAT_INDEX_LOG_FILENAME",
    "HEAT_INDEX_PREDICTIONS_FILENAME",
    "PREDICT_HEAT_INDEX_LOG_FILENAME",
    "HEAT_INDEX_MODEL_FILENAME",
    "METRICS_LOG_FILENAME",
    "HOURLY_HEAT_INDEX_FILENAME",
    "GET_HOURLY_HEAT_INDEX_LOG_FILENAME",
    "HOURLY_HEAT_INDEX_JSON_FILENAME",
]
