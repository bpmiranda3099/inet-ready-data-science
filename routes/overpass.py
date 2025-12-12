import concurrent.futures
import overpy
import time
from typing import Any

_api = overpy.Overpass()


def get_coords(query: str, timeout: int = 30, retries: int = 2) -> Any:
    attempt = 0
    last_exc: Exception | None = None
    while attempt <= retries:
        attempt += 1
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
                future = ex.submit(_api.query, query)
                try:
                    return future.result(timeout=timeout)
                except KeyboardInterrupt:
                    # If the user interrupts, cancel the pending request and re-raise
                    try:
                        future.cancel()
                    finally:
                        raise
        except concurrent.futures.TimeoutError as e:
            last_exc = e
            if attempt > retries:
                raise TimeoutError(f"Overpass query timed out after {timeout}s (attempt {attempt})") from e
            time.sleep(1 * attempt)
        except Exception as e:
            last_exc = e
            if attempt > retries:
                raise
            time.sleep(0.5 * attempt)

    if last_exc:
        raise last_exc
    raise RuntimeError("Failed to execute Overpass query")
