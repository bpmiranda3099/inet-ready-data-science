from typing import Dict, Any

LOG_ROTATION = "10 MB"
LOG_FORMAT = "{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}"


LOGGING_PRESETS: Dict[str, Dict[str, Any]] = {
    "default": {
        "level": "INFO",
        "rotation": LOG_ROTATION,
        "retention": None,
        "console": True,
        "fmt": LOG_FORMAT,
    },
    "debug": {
        "level": "DEBUG",
        "rotation": LOG_ROTATION,
        "retention": None,
        "console": True,
        "fmt": LOG_FORMAT,
    },
    "quiet": {
        "level": "WARNING",
        "rotation": LOG_ROTATION,
        "retention": None,
        "console": False,
        "fmt": LOG_FORMAT,
    },
    "data": {
        "level": "INFO",
        "rotation": LOG_ROTATION,
        "retention": None,
        "console": False,
        "fmt": LOG_FORMAT,
    },
}

DEFAULT_PRESET = "default"

__all__ = ["LOGGING_PRESETS", "DEFAULT_PRESET", "LOG_ROTATION", "LOG_FORMAT"]
