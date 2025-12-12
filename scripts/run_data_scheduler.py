LOG_FORMAT = "%(asctime)s | %(levelname)s | %(message)s"
#!/usr/bin/env python3
"""Run heat-index maintenance scripts on a local schedule.

Usage:
  python scripts/run_data_scheduler.py

This script immediately executes every dataset refresh script once, then keeps
running the hourly and daily jobs according to the Manila (Asia/Manila)
timezone. Stop it with Ctrl+C.
"""

import logging
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone, tzinfo
from pathlib import Path

LOG_FORMAT = "%(asctime)s | %(levelname)s | %(message)s"
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
logger = logging.getLogger("inet-ready-scheduler")

try:
    from zoneinfo import ZoneInfo
except ImportError as error:  # pragma: no cover - Python <3.9
    raise RuntimeError("zoneinfo module is required (Python 3.9+)") from error

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PYTHON = sys.executable
def resolve_manila_timezone() -> tzinfo:
    try:
        return ZoneInfo("Asia/Manila")
    except Exception:  # Windows without tzdata
        logger.warning("ZoneInfo Asia/Manila missing. Falling back to UTC+08:00 (fixed offset).")
        return timezone(timedelta(hours=8))


MANILA_TZ = resolve_manila_timezone()
UTC = timezone.utc
LOG_FORMAT = "%(asctime)s | %(levelname)s | %(message)s"

logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
logger = logging.getLogger("inet-ready-scheduler")


@dataclass
class ScheduledJob:
    """Represents a recurring job and its run cadence."""

    name: str
    commands: list[list[str]]
    cadence: str  # "hourly" or "daily"
    hour: int = 0
    minute: int = 0
    next_run: datetime = field(init=False)

    def schedule_next(self, reference: datetime | None = None) -> None:
        reference = reference or datetime.now(UTC)
        if self.cadence == "hourly":
            self.next_run = self._next_hourly(reference)
        elif self.cadence == "daily":
            self.next_run = self._next_daily(reference)
        else:  # pragma: no cover - defensive guard
            raise ValueError(f"Unsupported cadence: {self.cadence}")
        logger.debug("%s next run at %s", self.name, self.next_run.isoformat())

    def _next_hourly(self, ref: datetime) -> datetime:
        manila_now = ref.astimezone(MANILA_TZ)
        candidate = manila_now.replace(minute=0, second=0, microsecond=0)
        if candidate <= manila_now:
            candidate += timedelta(hours=1)
        return candidate.astimezone(UTC)

    def _next_daily(self, ref: datetime) -> datetime:
        manila_now = ref.astimezone(MANILA_TZ)
        candidate = manila_now.replace(hour=self.hour, minute=self.minute, second=0, microsecond=0)
        if candidate <= manila_now:
            candidate += timedelta(days=1)
        return candidate.astimezone(UTC)

    def run(self) -> None:
        logger.info("Running job: %s", self.name)
        for command in self.commands:
            run_command(command)


def run_command(args: list[str]) -> None:
    display = " ".join(args)
    logger.info("→ %s", display)
    try:
        subprocess.run(args, cwd=PROJECT_ROOT, check=True)
    except subprocess.CalledProcessError as error:
        logger.error("Command failed (%s): %s", error.returncode, display)
        raise


def build_jobs() -> list[ScheduledJob]:
    return [
        ScheduledJob(
            name="Hourly Heat Index",
            commands=[[PYTHON, "get_hourly_heat_index.py"]],
            cadence="hourly",
        ),
        ScheduledJob(
            name="Daily Weather History & Forecast",
            commands=[[PYTHON, "get_historical_weather_data.py"], [PYTHON, "predict_heat_index.py"]],
            cadence="daily",
            hour=5,
            minute=0,
        ),
        ScheduledJob(
            name="Daily Demographics Refresh",
            commands=[[PYTHON, "dataset/misc/fetch_cavite_demographics.py"]],
            cadence="daily",
            hour=5,
            minute=30,
        ),
    ]


def run_initial_sync(jobs: list[ScheduledJob]) -> None:
    logger.info("Starting initial full refresh...")
    for job in jobs:
        try:
            job.run()
        except subprocess.CalledProcessError:
            logger.warning("Continuing despite failure in job: %s", job.name)
    logger.info("Initial refresh complete.")


def scheduler_loop(jobs: list[ScheduledJob]) -> None:
    now = datetime.now(UTC)
    for job in jobs:
        job.schedule_next(now)

    logger.info("Entering scheduler loop. Press Ctrl+C to stop.")
    while True:
        now = datetime.now(UTC)
        due_jobs = [job for job in jobs if job.next_run <= now]
        if due_jobs:
            for job in due_jobs:
                try:
                    job.run()
                except subprocess.CalledProcessError:
                    logger.warning("Job failed but scheduler will continue: %s", job.name)
                job.schedule_next(datetime.now(UTC))
        else:
            next_run = min(job.next_run for job in jobs)
            sleep_seconds = max(5.0, (next_run - now).total_seconds())
            time.sleep(min(sleep_seconds, 300.0))


def main() -> None:
    jobs = build_jobs()
    run_initial_sync(jobs)
    try:
        scheduler_loop(jobs)
    except KeyboardInterrupt:
        logger.info("Scheduler stopped by user.")


if __name__ == "__main__":
    main()
