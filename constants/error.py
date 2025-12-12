from typing import Optional


class OverpassTimeoutError(TimeoutError):
    def __init__(self, timeout: int, attempt: int, original: Optional[Exception] = None):
        super().__init__(f"Overpass query timed out after {timeout}s (attempt {attempt})")
        self.timeout = timeout
        self.attempt = attempt
        self.original = original


class OverpassQueryError(RuntimeError):
    def __init__(self, message: str = "Failed to execute Overpass query", original: Optional[Exception] = None):
        super().__init__(message)
        self.original = original


class OpenMeteoRequestError(RuntimeError):
    def __init__(self, message: str, status_code: Optional[int] = None, original: Optional[Exception] = None):
        prefix = f"Open-Meteo request failed: {message}"
        if status_code is not None:
            prefix = f"{prefix} (status {status_code})"
        super().__init__(prefix)
        self.status_code = status_code
        self.original = original
