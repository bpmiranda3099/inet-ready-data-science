from __future__ import annotations

import math
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

try:
    import seaborn as sns
except ImportError:  # pragma: no cover - fallback styling
    sns = None  # type: ignore[assignment]

DATA_WEATHER = Path("dataset/clean/weather_history.csv")
DATA_HEAT = Path("dataset/clean/weather_heat_index.csv")
TABLE_DIR = Path("analysis/tables")
FIG_DIR = Path("analysis/figures")
FIG_DPI = 200

SELECTED_FEATURES = [
    "heat_index",
    "temperature_2m_max",
    "temperature_2m_min",
    "apparent_temperature_max",
    "apparent_temperature_min",
    "relative_humidity_2m_avg",
    "wind_speed_10m_max",
    "shortwave_radiation_sum",
]


def _load_dataset() -> pd.DataFrame:
    if not DATA_WEATHER.exists() or not DATA_HEAT.exists():
        raise FileNotFoundError(
            "Cleaned datasets missing. Run ETL scripts before executing run_eda.py."
        )
    weather = pd.read_csv(DATA_WEATHER, parse_dates=["date"])
    heat = pd.read_csv(DATA_HEAT, parse_dates=["date"])
    merged = weather.merge(heat, on=["city", "date"], how="inner", validate="one_to_one")
    merged.sort_values(["city", "date"], inplace=True)
    merged.reset_index(drop=True, inplace=True)
    merged["month"] = merged["date"].dt.month
    merged["month_name"] = merged["date"].dt.strftime("%b")
    merged["month_name"] = pd.Categorical(
        merged["month_name"],
        categories=["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        ordered=True,
    )
    return merged


def _ensure_dirs() -> None:
    TABLE_DIR.mkdir(parents=True, exist_ok=True)
    FIG_DIR.mkdir(parents=True, exist_ok=True)


def _configure_style() -> None:
    if sns is not None:
        sns.set_theme(style="whitegrid")
    else:
        plt.style.use("seaborn-v0_8")


def table_city_coverage(df: pd.DataFrame) -> Path:
    coverage = (
        df.groupby("city")["date"]
        .agg(first_date="min", last_date="max", num_days="count")
        .reset_index()
    )
    coverage.sort_values("num_days", ascending=False, inplace=True)
    path = TABLE_DIR / "city_coverage.csv"
    coverage.to_csv(path, index=False)
    return path


def table_feature_summary(df: pd.DataFrame) -> Path:
    summary = df[SELECTED_FEATURES].describe().transpose()
    summary.rename(columns={"50%": "median"}, inplace=True)
    path = TABLE_DIR / "feature_summary.csv"
    summary.to_csv(path)
    return path


def figure_heat_index_distribution(df: pd.DataFrame) -> Path:
    fig, ax = plt.subplots(figsize=(7, 4))
    data = df["heat_index"].dropna()
    bins = min(50, int(math.sqrt(len(data))) or 10)
    if sns is not None:
        sns.histplot(data, bins=bins, kde=True, ax=ax, color="#1f77b4")
    else:
        ax.hist(data, bins=bins, color="#1f77b4", alpha=0.75)
    ax.set_title("Heat Index Distribution (°F)")
    ax.set_xlabel("Heat Index (°F)")
    ax.set_ylabel("Frequency")
    fig.tight_layout()
    path = FIG_DIR / "fig_heat_index_distribution.png"
    fig.savefig(path, dpi=FIG_DPI)
    plt.close(fig)
    return path


def figure_monthly_boxplot(df: pd.DataFrame) -> Path:
    fig, ax = plt.subplots(figsize=(8, 4))
    if sns is not None:
        sns.boxplot(data=df, x="month_name", y="heat_index", ax=ax, color="#ff7f0e")
    else:
        df.boxplot(column="heat_index", by="month_name", ax=ax, grid=False)
        ax.set_title("Heat Index by Month")
    ax.set_xlabel("Month")
    ax.set_ylabel("Heat Index (°F)")
    ax.set_title("Seasonal Variation in Heat Index")
    fig.tight_layout()
    path = FIG_DIR / "fig_heat_index_monthly_boxplot.png"
    fig.savefig(path, dpi=FIG_DPI)
    plt.close(fig)
    return path


def figure_correlation_heatmap(df: pd.DataFrame) -> Path:
    corr = df[SELECTED_FEATURES].corr()
    fig, ax = plt.subplots(figsize=(6, 5))
    if sns is not None:
        sns.heatmap(corr, annot=True, fmt=".2f", cmap="RdBu_r", center=0, ax=ax)
    else:
        cax = ax.imshow(corr, cmap="RdBu_r", vmin=-1, vmax=1)
        fig.colorbar(cax, ax=ax)
        ax.set_xticks(range(len(corr.columns)))
        ax.set_yticks(range(len(corr.columns)))
        ax.set_xticklabels(corr.columns, rotation=45, ha="right")
        ax.set_yticklabels(corr.columns)
        for i in range(len(corr.columns)):
            for j in range(len(corr.columns)):
                ax.text(j, i, f"{corr.iloc[i, j]:.2f}", ha="center", va="center", color="black")
    ax.set_title("Feature Correlations with Heat Index")
    fig.tight_layout()
    path = FIG_DIR / "fig_feature_correlation_heatmap.png"
    fig.savefig(path, dpi=FIG_DPI)
    plt.close(fig)
    return path


def figure_city_rolling_profile(df: pd.DataFrame) -> Path:
    coverage = df.groupby("city")["date"].count()
    city = coverage.idxmax()
    city_df = df[df["city"] == city].copy()
    city_df.sort_values("date", inplace=True)
    city_df["rolling_mean"] = city_df["heat_index"].rolling(window=7, min_periods=1).mean()

    fig, ax = plt.subplots(figsize=(9, 4))
    ax.plot(city_df["date"], city_df["heat_index"], label="Daily Heat Index", color="#1f77b4", alpha=0.6)
    ax.plot(city_df["date"], city_df["rolling_mean"], label="7-day Rolling Mean", color="#d62728", linewidth=2)
    ax.set_title(f"Heat Index Trend: {city}")
    ax.set_xlabel("Date")
    ax.set_ylabel("Heat Index (°F)")
    ax.legend(loc="upper left")
    fig.autofmt_xdate()
    fig.tight_layout()
    path = FIG_DIR / "fig_city_rolling_profile.png"
    fig.savefig(path, dpi=FIG_DPI)
    plt.close(fig)
    return path


def main() -> None:
    _ensure_dirs()
    _configure_style()
    df = _load_dataset()

    outputs = {
        "city_coverage_table": table_city_coverage(df),
        "feature_summary_table": table_feature_summary(df),
        "heat_index_hist": figure_heat_index_distribution(df),
        "monthly_boxplot": figure_monthly_boxplot(df),
        "correlation_heatmap": figure_correlation_heatmap(df),
        "rolling_profile": figure_city_rolling_profile(df),
    }

    print("Generated the following EDA artifacts:")
    for label, path in outputs.items():
        print(f"- {label}: {path}")

if __name__ == "__main__":
    main()
