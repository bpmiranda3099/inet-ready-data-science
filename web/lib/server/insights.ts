import { existsSync, promises as fs } from "fs"
import path from "path"
import { findDemographicRecord, type DemographicRecord } from "@/lib/server/demographics"

const resolveDataPath = (...candidates: string[]): string => {
  const match = candidates.find((candidate) => existsSync(candidate))
  return match ?? candidates[0]
}

const HOURLY_PATH = resolveDataPath(
  path.join(process.cwd(), "public", "data", "hourly_heat_index.json"),
  path.join(process.cwd(), "..", "dataset", "clean", "hourly_heat_index.json"),
)

const WEATHER_HISTORY_PATH = resolveDataPath(
  path.join(process.cwd(), "public", "data", "weather_history.csv"),
  path.join(process.cwd(), "..", "dataset", "clean", "weather_history.csv"),
)

const PREDICTIONS_PATH = resolveDataPath(
  path.join(process.cwd(), "public", "data", "heat_index_predictions.csv"),
  path.join(process.cwd(), "..", "dataset", "prediction", "heat_index_predictions.csv"),
)

export type HeatIndexPoint = {
  city: string
  timestamp: string
  temperature_c: number
  relative_humidity: number
  heat_index_c: number
  heat_index_f?: number
  apparent_temperature_c?: number
}

export type HourlyHeatIndexCity = {
  city: string
  latitude: number
  longitude: number
  current: HeatIndexPoint | null
  hourly: HeatIndexPoint[]
}

export type HourlyHeatIndexPayload = {
  generated_at: string
  timezone: string
  unit: string
  cities: HourlyHeatIndexCity[]
}

type WeatherHistoryPoint = {
  city: string
  date: string
  current: number | null
  average: number | null
}

export type ForecastPoint = {
  date: string
  predicted: number | null
  actual: number | null
  residual: number | null
}

export type InsightSnapshot = {
  city: string
  generatedAt: string | null
  timezone: string | null
  current: HeatIndexPoint | null
  currentRiskLabel: string
  riskLevel: RiskLevel
  updatedLabel: string | null
  weeklyAverageHeatIndex: number | null
  peakNext24h: { value: number | null; timestamp: string | null }
  highRiskHours24h: number
  demographic: DemographicRecord | null
  vulnerablePopulation: number | null
  coolingCenterLoadPct: number | null
  hourlyPoints: HeatIndexPoint[]
  weatherHistory: WeatherHistoryPoint[]
  forecastPoints: ForecastPoint[]
}

type RiskLevel = "unknown" | "comfort" | "caution" | "moderate" | "high" | "extreme"

const RISK_LABELS: Record<RiskLevel, { label: string; cutoff: number }> = {
  unknown: { label: "Status Unknown", cutoff: -Infinity },
  comfort: { label: "Comfort", cutoff: 27 },
  caution: { label: "Caution", cutoff: 32 },
  moderate: { label: "Heat Alert", cutoff: 41 },
  high: { label: "Danger", cutoff: 54 },
  extreme: { label: "Extreme", cutoff: Infinity },
}

const VULNERABLE_MULTIPLIER: Record<RiskLevel, number> = {
  unknown: 0.12,
  comfort: 0.08,
  caution: 0.18,
  moderate: 0.34,
  high: 0.55,
  extreme: 0.72,
}

const classifyRiskLevel = (value: number | null): { level: RiskLevel; label: string } => {
  if (value == null) {
    return { level: "unknown", label: RISK_LABELS.unknown.label }
  }
  if (value >= 54) {
    return { level: "extreme", label: RISK_LABELS.extreme.label }
  }
  if (value >= 41) {
    return { level: "high", label: RISK_LABELS.high.label }
  }
  if (value >= 32) {
    return { level: "moderate", label: RISK_LABELS.moderate.label }
  }
  if (value >= 27) {
    return { level: "caution", label: RISK_LABELS.caution.label }
  }
  return { level: "comfort", label: RISK_LABELS.comfort.label }
}

const parseJsonFile = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, "utf-8")
  return JSON.parse(raw) as T
}

const parseCsv = (contents: string): { headers: string[]; rows: string[][] } => {
  const lines = contents.trim().split(/\r?\n/)
  const headerLine = lines.shift()
  if (!headerLine) {
    return { headers: [], rows: [] }
  }
  const headers = headerLine.split(",").map((header) => header.trim())
  const rows = lines.map((line) => line.split(","))
  return { headers, rows }
}

const toWeatherRecord = (row: string[], headers: string[]): WeatherHistoryPoint | null => {
  if (row.length !== headers.length) {
    return null
  }
  const record: Record<string, string> = {}
  headers.forEach((header, index) => {
    record[header] = row[index]?.trim() ?? ""
  })
  if (!record.city || !record.date) {
    return null
  }
  const toNumber = (value: string) => {
    if (!value) {
      return null
    }
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return {
    city: record.city,
    date: record.date,
    current: toNumber(record.apparent_temperature_max),
    average: toNumber(record.temperature_2m_max),
  }
}

const toForecastRecord = (row: string[], headers: string[]): (ForecastPoint & { city: string }) | null => {
  if (row.length !== headers.length) {
    return null
  }
  const record: Record<string, string> = {}
  headers.forEach((header, index) => {
    record[header] = row[index]?.trim() ?? ""
  })
  if (!record.city || !record.date) {
    return null
  }
  const toNumber = (value: string) => {
    if (!value) {
      return null
    }
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return {
    city: record.city,
    date: record.date,
    predicted: toNumber(record.heat_index_pred),
    actual: toNumber(record.heat_index_actual),
    residual: toNumber(record.residual),
  }
}

const loadWeatherHistory = async (city: string, days: number): Promise<WeatherHistoryPoint[]> => {
  const raw = await fs.readFile(WEATHER_HISTORY_PATH, "utf-8")
  const { headers, rows } = parseCsv(raw)
  if (!headers.length) {
    return []
  }
  return rows
    .map((row) => toWeatherRecord(row, headers))
    .filter((record): record is WeatherHistoryPoint => Boolean(record))
    .filter((record) => record.city.toLowerCase() === city.toLowerCase())
    .slice(-days)
}

const loadForecastSeries = async (city: string, days: number): Promise<ForecastPoint[]> => {
  const raw = await fs.readFile(PREDICTIONS_PATH, "utf-8")
  const { headers, rows } = parseCsv(raw)
  if (!headers.length) {
    return []
  }
  const cityLower = city.toLowerCase()
  const records = rows
    .map((row) => toForecastRecord(row, headers))
    .filter((record): record is ForecastPoint & { city: string } => Boolean(record))
    .filter((record) => record.city.toLowerCase() === cityLower)

  if (!records.length) {
    return []
  }

  const sorted = records.slice().sort((a, b) => {
    const aTime = Date.parse(a.date)
    const bTime = Date.parse(b.date)
    if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) {
      return 0
    }
    return aTime - bTime
  })

  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const upcoming = sorted.filter((record) => {
    const parsed = Date.parse(record.date)
    return Number.isFinite(parsed) && parsed >= todayStart
  })

  const window = upcoming.length ? upcoming : sorted.slice(-days)
  return window.slice(0, days).map(({ date, predicted, actual, residual }) => ({ date, predicted, actual, residual }))
}

const findHourlyEntry = (payload: HourlyHeatIndexPayload, city: string): HourlyHeatIndexCity | null => {
  const lower = city.toLowerCase()
  return payload.cities.find((entry) => entry.city.toLowerCase() === lower) ?? null
}

const computePeakNext24h = (hourly: HeatIndexPoint[]): HeatIndexPoint | null => {
  if (!hourly.length) {
    return null
  }
  const now = Date.now()
  const horizon = now + 24 * 60 * 60 * 1000
  const futurePoints = hourly.filter((point) => {
    const ts = Date.parse(point.timestamp)
    return Number.isFinite(ts) && ts >= now && ts <= horizon
  })
  const windowPoints = futurePoints.length ? futurePoints : hourly.slice(-24)
  if (!windowPoints.length) {
    return null
  }
  return windowPoints.reduce((peak, point) => (point.heat_index_c > peak.heat_index_c ? point : peak), windowPoints[0])
}

const countHighRiskHours = (hourly: HeatIndexPoint[]): number => {
  const now = Date.now()
  const lookback = now - 24 * 60 * 60 * 1000
  return hourly.filter((point) => {
    const ts = Date.parse(point.timestamp)
    if (!Number.isFinite(ts) || ts < lookback || ts > now) {
      return false
    }
    return point.heat_index_c >= 41
  }).length
}

export const buildInsightSnapshot = async (city: string, days = 7): Promise<InsightSnapshot> => {
  const hourlyPayload = await parseJsonFile<HourlyHeatIndexPayload>(HOURLY_PATH)
  const cityEntry = findHourlyEntry(hourlyPayload, city)
  const weatherHistory = await loadWeatherHistory(city, days)
  const forecastPoints = await loadForecastSeries(city, days)
  const demographic = await findDemographicRecord(city)

  const hourlyPoints = cityEntry?.hourly ?? []
  const currentPoint = cityEntry?.current ?? hourlyPoints.at(-1) ?? null
  const { level, label } = classifyRiskLevel(currentPoint?.heat_index_c ?? null)
  const peakPoint = computePeakNext24h(hourlyPoints)
  const weeklyAverage = (() => {
    const values = weatherHistory.map((point) => point.current).filter((value): value is number => value != null)
    if (!values.length) {
      return null
    }
    const avg = values.reduce((acc, value) => acc + value, 0) / values.length
    return Number(avg.toFixed(1))
  })()
  const highRiskHours24h = countHighRiskHours(hourlyPoints)

  const vulnerablePopulation = (() => {
    if (!demographic?.population2020) {
      return null
    }
    const multiplier = VULNERABLE_MULTIPLIER[level] ?? 0.2
    return Math.round(demographic.population2020 * multiplier)
  })()

  const coolingCenterLoadPct = vulnerablePopulation ? Math.min(99, Math.round(40 + (VULNERABLE_MULTIPLIER[level] ?? 0.2) * 60)) : null

  const updatedLabel = (() => {
    if (!currentPoint?.timestamp) {
      return null
    }
    const parsed = Date.parse(currentPoint.timestamp)
    if (!Number.isFinite(parsed)) {
      return null
    }
    return new Date(parsed).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true })
  })()

  return {
    city,
    generatedAt: hourlyPayload.generated_at ?? null,
    timezone: hourlyPayload.timezone ?? null,
    current: currentPoint,
    currentRiskLabel: label,
    riskLevel: level,
    updatedLabel,
    weeklyAverageHeatIndex: weeklyAverage,
    peakNext24h: {
      value: peakPoint?.heat_index_c ?? null,
      timestamp: peakPoint?.timestamp ?? null,
    },
    highRiskHours24h,
    demographic,
    vulnerablePopulation,
    coolingCenterLoadPct,
    hourlyPoints,
    weatherHistory,
    forecastPoints,
  }
}
