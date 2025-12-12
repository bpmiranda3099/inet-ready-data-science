from __future__ import annotations

import math
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple, cast

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from xgboost import XGBRegressor
from xgboost.core import XGBoostError

try:
	import psutil  # type: ignore
except Exception:  # pragma: no cover - optional dependency
	psutil = None

from constants.files import (
    PREDICT_HEAT_INDEX_LOG_FILENAME, 
    METRICS_LOG_FILENAME
)
from constants.model import (
    HEAT_INDEX_BASE_PARAMS,
    HEAT_INDEX_FEATURE_CONFIG,
    HEAT_INDEX_TRAINING_LIMITS,
    HEAT_INDEX_NUMERIC_COLUMNS,
)
from constants.path import (
	HEAT_INDEX_MODEL_FILE,
	HEAT_INDEX_PREDICTIONS_FILE,
	LOGS_DIR,
	WEATHER_HEAT_INDEX_FILE,
	WEATHER_HISTORY_FILE,
	ensure_dirs,
)
from utils.logger import get_logger
from utils.units import fahrenheit_to_celsius

FEATURE_CONF = HEAT_INDEX_FEATURE_CONFIG
TRAIN_LIMITS = HEAT_INDEX_TRAINING_LIMITS
BASE_PARAMS = HEAT_INDEX_BASE_PARAMS
BASE_NUMERIC = list(HEAT_INDEX_NUMERIC_COLUMNS)


def _run_command(args: List[str]) -> str | None:
	try:
		result = subprocess.run(args, capture_output=True, text=True, check=True)
		return result.stdout.strip()
	except Exception:
		return None


def _gpu_stats() -> Dict[str, float | str] | None:
	output = _run_command(
		[
			"nvidia-smi",
			"--query-gpu=name,memory.total,memory.free",
			"--format=csv,noheader,nounits",
		]
	)
	if not output:
		return None
	try:
		line = output.splitlines()[0]
		name, total, free = [segment.strip() for segment in line.split(",")]
		return {
			"name": name,
			"total_mem_gb": float(total) / 1024.0,
			"free_mem_gb": float(free) / 1024.0,
		}
	except Exception:
		return None


def _system_stats() -> Dict[str, Any]:
	stats: Dict[str, Any] = {
		"logical_cpus": os.cpu_count() or 1,
		"total_ram_gb": None,
	}
	if psutil:
		try:
			stats["total_ram_gb"] = psutil.virtual_memory().total / (1024**3)
		except Exception:
			stats["total_ram_gb"] = None
	stats["gpu"] = _gpu_stats()
	return stats


def _write_metrics_log(rmse: float, mae: float, r2: float) -> None:
	metrics_path = Path(LOGS_DIR) / METRICS_LOG_FILENAME
	metrics_path.parent.mkdir(parents=True, exist_ok=True)
	timestamp = datetime.now(timezone.utc).isoformat()
	line = f"{timestamp},rmse={rmse:.4f},mae={mae:.4f},r2={r2:.4f}"
	with open(metrics_path, "a", encoding="utf-8") as handle:
		handle.write(line + "\n")


def _load_dataset() -> pd.DataFrame:
	weather = pd.read_csv(WEATHER_HISTORY_FILE, parse_dates=["date"])
	heat = pd.read_csv(WEATHER_HEAT_INDEX_FILE, parse_dates=["date"])
	merged = weather.merge(heat, on=["city", "date"], how="inner", validate="one_to_one")
	merged.sort_values(["city", "date"], inplace=True)
	return merged.reset_index(drop=True)


def _add_time_features(frame: pd.DataFrame) -> None:
	frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
	date_series = cast(pd.Series, frame["date"])
	day_of_year = date_series.dt.dayofyear.astype("int16")  # type: ignore[attr-defined]
	frame["dayofyear"] = day_of_year
	seasonality = float(FEATURE_CONF.get("seasonality_period", 365.25))
	radians = 2.0 * math.pi * day_of_year / seasonality
	frame["sin_day"] = np.sin(radians)
	frame["cos_day"] = np.cos(radians)


def _add_city_features(frame: pd.DataFrame) -> None:
	frame["city"] = frame["city"].astype("category")
	frame["city_id"] = frame["city"].cat.codes.astype("int16")


def _add_weather_features(frame: pd.DataFrame) -> None:
	frame["temp_range"] = frame["temperature_2m_max"] - frame["temperature_2m_min"]
	frame["apparent_range"] = frame["apparent_temperature_max"] - frame["apparent_temperature_min"]
	frame["humidity_sq"] = frame["relative_humidity_2m_avg"] ** 2
	frame["wind_sq"] = frame["wind_speed_10m_max"] ** 2
	frame["radiation_log"] = np.log1p(frame["shortwave_radiation_sum"].clip(lower=0.0))



def _add_lag_features(frame: pd.DataFrame) -> None:
	max_lag = int(FEATURE_CONF.get("max_lag_days", 7))
	window = int(FEATURE_CONF.get("rolling_window_days", 7))
	grouped = frame.groupby("city", sort=False, observed=True)
	for lag in range(1, max_lag + 1):
		frame[f"heat_index_lag_{lag}"] = grouped["heat_index"].shift(lag)

	def _rolling_mean(series: pd.Series) -> pd.Series:
		return series.shift(1).rolling(window=window, min_periods=1).mean()

	frame["heat_index_roll_mean_7"] = grouped["heat_index"].transform(_rolling_mean)


def _build_feature_matrix(frame: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
	_add_time_features(frame)
	_add_city_features(frame)
	_add_weather_features(frame)
	_add_lag_features(frame)

	excluded = {"city", "date", "heat_index"}
	numeric_cols = [col for col in frame.columns if col not in excluded]
	if BASE_NUMERIC:
		for col in BASE_NUMERIC:
			if col not in numeric_cols:
				numeric_cols.append(col)

	cleaned = frame.dropna(subset=numeric_cols + ["heat_index"]).copy()
	cleaned[numeric_cols] = cleaned[numeric_cols].astype("float32")
	cleaned["heat_index"] = cleaned["heat_index"].astype("float32")
	return cleaned, numeric_cols


def _split_forecast_horizon(frame: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
	horizon = int(FEATURE_CONF.get("forecast_horizon_days", 14))
	if horizon <= 0:
		return frame.copy(), pd.DataFrame(columns=frame.columns)
	grouped = frame.groupby("city", group_keys=False, observed=True)
	forecast = grouped.tail(horizon).copy()
	forecast.sort_values(["city", "date"], inplace=True)
	trainable = frame.drop(forecast.index).copy()
	return trainable, forecast


def _train_valid_split(frame: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
	validation_days = int(FEATURE_CONF.get("validation_days", 90))
	split_date = frame["date"].max() - pd.Timedelta(days=validation_days)
	train = cast(pd.DataFrame, frame.loc[frame["date"] < split_date].copy())
	valid = cast(pd.DataFrame, frame.loc[frame["date"] >= split_date].copy())
	if train.empty or valid.empty:
		fraction = float(FEATURE_CONF.get("fallback_split_fraction", 0.8))
		cutoff = int(len(frame) * fraction)
		train = cast(pd.DataFrame, frame.iloc[:cutoff].copy())
		valid = cast(pd.DataFrame, frame.iloc[cutoff:].copy())
	return train, valid


def _training_params(stats: Dict[str, float | int | None], n_rows: int) -> Dict[str, float | int | str]:
	logical_cpus = int(stats.get("logical_cpus", 4) or 4)
	limits = TRAIN_LIMITS
	large_threshold = int(limits.get("large_dataset_rows", 30000))
	min_estimators = int(limits.get("min_estimators", 800))
	max_estimators = int(limits.get("max_estimators", 2500))
	small_depth = int(limits.get("small_depth", 6))
	large_depth = int(limits.get("large_depth", 7))
	small_lr = float(limits.get("small_learning_rate", 0.08))
	large_lr = float(limits.get("large_learning_rate", 0.05))
	small_subsample = float(limits.get("small_subsample", 1.0))
	large_subsample = float(limits.get("large_subsample", 0.9))
	live_large = n_rows >= large_threshold
	n_estimators = min(max_estimators, max(min_estimators, n_rows // 15))
	depth = large_depth if live_large else small_depth
	learning_rate = large_lr if live_large else small_lr
	subsample = large_subsample if live_large else small_subsample
	params = {
		**BASE_PARAMS,
		"n_estimators": n_estimators,
		"max_depth": depth,
		"learning_rate": learning_rate,
		"subsample": subsample,
		"n_jobs": logical_cpus,
	}
	return params


def _fit_model(
	params: Dict[str, float | int | str],
	X_train: np.ndarray,
	y_train: np.ndarray,
	X_valid: np.ndarray,
	y_valid: np.ndarray,
	logger,
) -> Tuple[XGBRegressor, Dict[str, float | int | str]]:
	model = XGBRegressor(**params)
	try:
		model.fit(
			X_train,
			y_train,
			eval_set=[(X_valid, y_valid)],
			verbose=100,
		)
		return model, params
	except XGBoostError as exc:
		message = str(exc).lower()
		if any(token in message for token in ("gpu", "cuda", "device")):
			logger.warning("GPU training unavailable ({}). Falling back to CPU.", exc)
			cpu_params = {
				**params,
				"tree_method": "hist",
				"predictor": "auto",
				"device": "cpu",
			}
			model = XGBRegressor(**cpu_params)
			model.fit(
				X_train,
				y_train,
				eval_set=[(X_valid, y_valid)],
				verbose=100,
			)
			return model, cpu_params
		raise


def main() -> None:
	ensure_dirs()
	logger = get_logger(
		name="predict_heat_index",
		log_dir=str(LOGS_DIR),
		log_filename=PREDICT_HEAT_INDEX_LOG_FILENAME,
		use_case="data",
	)

	stats = _system_stats()
	logger.info(
		"Hardware stats | CPUs={} | RAM={:.2f} GB | GPU={}",
		stats.get("logical_cpus"),
		float(stats.get("total_ram_gb") or 0.0),
		stats.get("gpu"),
	)

	data = _load_dataset()
	logger.info("Loaded {} merged rows", len(data))

	feature_frame, feature_cols = _build_feature_matrix(data)
	logger.info("Prepared {} rows with {} features", len(feature_frame), len(feature_cols))

	train_ready, forecast_frame = _split_forecast_horizon(feature_frame)
	if train_ready.empty:
		logger.warning("Not enough rows after reserving forecast horizon; training on full dataset instead.")
		train_ready = feature_frame.copy()
	logger.info(
		"Reserved {} horizon days per city; training rows now {}; forecast rows {}",
		FEATURE_CONF.get("forecast_horizon_days", 14),
		len(train_ready),
		len(forecast_frame),
	)

	train_df, valid_df = _train_valid_split(train_ready)
	logger.info(
		"Training rows={} | Validation rows={} | Split date={}",
		len(train_df),
		len(valid_df),
		valid_df["date"].min(),
	)

	params = _training_params(stats, len(train_df))
	logger.info("Training config: {}", params)

	X_train = train_df[feature_cols].to_numpy()
	y_train = train_df["heat_index"].to_numpy()
	X_valid = valid_df[feature_cols].to_numpy()
	y_valid = valid_df["heat_index"].to_numpy()

	model, used_params = _fit_model(params, X_train, y_train, X_valid, y_valid, logger)
	if used_params is not params:
		logger.info("Training config adjusted to: {}", used_params)

	valid_pred = model.predict(X_valid)
	rmse = math.sqrt(float(mean_squared_error(y_valid, valid_pred)))
	mae = mean_absolute_error(y_valid, valid_pred)
	r2 = r2_score(y_valid, valid_pred)
	logger.info("Validation RMSE={:.3f} | MAE={:.3f} | R2={:.3f}", rmse, mae, r2)
	_write_metrics_log(rmse, mae, r2)

	if forecast_frame.empty:
		logger.error("No forecast rows available; skipping prediction export.")
		return

	forecast_features = forecast_frame[feature_cols].to_numpy()
	forecast_pred = model.predict(forecast_features)
	predictions = forecast_frame[["city", "date"]].copy()
	predictions["heat_index_actual_f"] = forecast_frame["heat_index"].round(2)
	predictions["heat_index_pred_f"] = forecast_pred.round(2)
	actual_c = cast(pd.Series, fahrenheit_to_celsius(predictions["heat_index_actual_f"]))
	pred_c = cast(pd.Series, fahrenheit_to_celsius(predictions["heat_index_pred_f"]))
	predictions["heat_index_actual"] = actual_c.round(2)
	predictions["heat_index_pred"] = pred_c.round(2)
	predictions["residual"] = (predictions["heat_index_pred"] - predictions["heat_index_actual"]).round(2)
	predictions.drop(columns=["heat_index_actual_f", "heat_index_pred_f"], inplace=True)
	logger.info("Generated {} forecast rows ({} per city)", len(predictions), FEATURE_CONF.get("forecast_horizon_days", 14))

	dest = Path(HEAT_INDEX_PREDICTIONS_FILE)
	dest.parent.mkdir(parents=True, exist_ok=True)
	predictions.to_csv(dest, index=False)
	logger.info("Wrote predictions to {}", dest)

	model_path = Path(HEAT_INDEX_MODEL_FILE)
	model_path.parent.mkdir(parents=True, exist_ok=True)
	model.save_model(model_path)
	logger.info("Saved model to {}", model_path)


if __name__ == "__main__":
	main()

