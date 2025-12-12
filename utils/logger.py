import os
from typing import Optional, Any
from loguru import logger as _logger
from constants.logging import LOGGING_PRESETS, DEFAULT_PRESET
from constants.path import LOGS_DIR
from constants.files import LOG_FILENAME_TEMPLATE, DEFAULT_APP_NAME


def get_logger(
    name: Optional[str] = None,
    log_dir: Optional[str] = None,
    log_filename: Optional[str] = None,
    use_case: Optional[str] = None,
    level: Optional[str] = None,
    rotation: Optional[str] = None,
    retention: Optional[str] = None,
    console: Optional[bool] = None,
    fmt: Optional[str] = None,
) -> Any:
    if fmt is None:
        fmt = "{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}"

    if log_dir is None:
        log_dir = str(LOGS_DIR)

    preset_name = use_case or DEFAULT_PRESET
    preset = LOGGING_PRESETS.get(preset_name, LOGGING_PRESETS.get(DEFAULT_PRESET, {}))

    final_level = level if level is not None else preset.get("level", "INFO")
    final_rotation = rotation if rotation is not None else preset.get("rotation", "10 MB")
    final_retention = retention if retention is not None else preset.get("retention")
    final_console = console if console is not None else preset.get("console", True)
    final_fmt = fmt if fmt is not None else preset.get("fmt", "{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}")

    os.makedirs(log_dir, exist_ok=True)

    if log_filename is None:
        app_name = name or DEFAULT_APP_NAME
        log_filename = LOG_FILENAME_TEMPLATE.format(name=app_name)

    log_path = os.path.join(log_dir, log_filename)
    try:
        _logger.remove()
    except Exception:
        pass
    
    _logger.add(log_path, rotation=final_rotation, retention=final_retention, level=str(final_level), format=final_fmt)

    if final_console:
        _logger.add(lambda msg: print(msg, end=''), level=str(final_level), format=final_fmt)

    return _logger
