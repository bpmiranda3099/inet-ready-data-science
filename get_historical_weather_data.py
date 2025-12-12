from __future__ import annotations

import csv
from datetime import date, timedelta
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

from constants.error import OpenMeteoRequestError
from constants.files import GET_WEATHER_LOG_FILENAME
from constants.params import (
	DEFAULT_DAILY,
	DEFAULT_HOURLY,
	build_weather_params,
)
from constants.path import (
	CITY_COORDS_FILE,
	LOGS_DIR,
	WEATHER_HISTORY_FILE,
	WEATHER_HISTORY_RAW_FILE,
	ensure_dirs,
)
from constants.weather import (
	CITY_COLUMN_ALIASES,
	LAT_COLUMN_ALIASES,
	LON_COLUMN_ALIASES,
	OPEN_METEO_MAX_RETRIES,
	OPEN_METEO_REQUEST_COOLDOWN,
	OPEN_METEO_TIMEOUT_SECONDS,
	WEATHER_CITY_COLUMN,
	WEATHER_DATE_COLUMN,
	WEATHER_LOOKBACK_YEARS,
	hourly_average_name,
)
from routes.openmeteo import fetch_weather_archive
from utils.clean import clean_weather_history
from utils.logger import get_logger


def _get_date_window(years: int = WEATHER_LOOKBACK_YEARS) -> Tuple[str, str]:
	today = date.today()
	end = today - timedelta(days=1)
	start = end - timedelta(days=years * 365)
	return start.isoformat(), end.isoformat()


def _read_cities(path: Path) -> List[Tuple[str, float, float]]:
	if not path.exists():
		return []
	cities: List[Tuple[str, float, float]] = []
	with open(path, newline="", encoding="utf-8") as handle:
		reader = csv.DictReader(handle)
		for row in reader:
			name = next((row.get(alias) for alias in CITY_COLUMN_ALIASES if row.get(alias)), None)
			lat = next((row.get(alias) for alias in LAT_COLUMN_ALIASES if row.get(alias)), None)
			lon = next((row.get(alias) for alias in LON_COLUMN_ALIASES if row.get(alias)), None)
			if not name or not lat or not lon:
				continue
			try:
				cities.append((name.strip(), float(lat), float(lon)))
			except ValueError:
				continue
	return cities


def _summarize_hourly(hourly: Dict[str, List], metrics: Sequence[str]) -> Dict[str, Dict[str, float]]:
	if not hourly:
		return {}
	timestamps = [str(ts) for ts in (hourly.get("time") or [])]
	summaries: Dict[str, Dict[str, float]] = {}
	for metric in metrics:
		values = hourly.get(metric) or []
		daily_totals: Dict[str, List[float]] = {}
		for ts, value in zip(timestamps, values):
			if value is None:
				continue
			day = ts.split("T", 1)[0]
			daily_totals.setdefault(day, []).append(float(value))
		metric_key = hourly_average_name(metric)
		for day, samples in daily_totals.items():
			if not samples:
				continue
			summaries.setdefault(day, {})[metric_key] = sum(samples) / len(samples)
	return summaries


def _build_daily_rows(
	city: str,
	daily: Dict[str, List[float]],
	daily_metrics: Sequence[str],
	hourly_metric_cols: Sequence[str],
	hourly_summary: Dict[str, Dict[str, float]],
) -> List[Dict[str, str]]:
	times = [str(ts) for ts in (daily.get("time") or [])]
	rows: List[Dict[str, str]] = []
	for idx, day in enumerate(times):
		row: Dict[str, str] = {WEATHER_CITY_COLUMN: city, WEATHER_DATE_COLUMN: day}
		for metric in daily_metrics:
			values = daily.get(metric)
			value = values[idx] if values and idx < len(values) else ""
			row[metric] = "" if value is None else str(value)
		hourly_values = hourly_summary.get(day) or {}
		for col in hourly_metric_cols:
			value = hourly_values.get(col)
			row[col] = "" if value is None else f"{value:.2f}"
		rows.append(row)
	return rows


def main() -> None:
	ensure_dirs()
	logger = get_logger(
		name="get_historical_weather_data",
		log_dir=str(LOGS_DIR),
		log_filename=GET_WEATHER_LOG_FILENAME,
		use_case="data",
	)

	cities = _read_cities(Path(CITY_COORDS_FILE))
	if not cities:
		logger.warning("No cities available for weather download. Run get_city_coords.py first.")
		return

	start_date, end_date = _get_date_window()
	logger.info(f"Requesting weather data from {start_date} to {end_date}")

	daily_metrics = list(DEFAULT_DAILY)
	hourly_metrics = list(DEFAULT_HOURLY)
	hourly_metric_cols = [hourly_average_name(metric) for metric in hourly_metrics]
	header = [WEATHER_CITY_COLUMN, WEATHER_DATE_COLUMN, *daily_metrics, *hourly_metric_cols]

	raw_rows: List[Dict[str, str]] = []
	for name, lat, lon in cities:
		params = build_weather_params(lat, lon, start_date, end_date, daily=daily_metrics, hourly=hourly_metrics)
		try:
			payload = fetch_weather_archive(
				params,
				timeout=OPEN_METEO_TIMEOUT_SECONDS,
				retries=OPEN_METEO_MAX_RETRIES,
				cooldown=OPEN_METEO_REQUEST_COOLDOWN,
			)
		except OpenMeteoRequestError as exc:
			logger.error(f"Failed to fetch data for {name}: {exc}")
			continue

		daily_section = payload.get("daily") or {}
		hourly_section = payload.get("hourly") or {}
		hourly_summary = _summarize_hourly(hourly_section, hourly_metrics)
		city_rows = _build_daily_rows(name, daily_section, daily_metrics, hourly_metric_cols, hourly_summary)
		raw_rows.extend(city_rows)
		logger.info(f"Fetched {len(city_rows)} daily rows for {name}")

	if not raw_rows:
		logger.warning("No weather rows collected; aborting.")
		return

	raw_path = Path(WEATHER_HISTORY_RAW_FILE)
	clean_path = Path(WEATHER_HISTORY_FILE)
	logger.info(f"Writing raw data to {raw_path}")
	with open(raw_path, "w", newline="", encoding="utf-8") as handle:
		writer = csv.DictWriter(handle, fieldnames=header)
		writer.writeheader()
		writer.writerows(raw_rows)

	logger.info("Cleaning raw weather data")
	cleaned_count = clean_weather_history(str(raw_path), str(clean_path))
	logger.info(f"Wrote cleaned weather dataset with {cleaned_count} rows to {clean_path}")


if __name__ == "__main__":
	main()
