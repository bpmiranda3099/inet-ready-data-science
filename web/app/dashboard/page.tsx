"use client"

import dynamic from "next/dynamic"
import type { CityHeatLayer } from "@/components/city-map"
import { cityOptions, type CityOption } from "@/lib/cities"
import { darkenColor, heatIndexColor, lightenColor, pickTextColor } from "@/lib/heat-index-colors"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts"

const CityMap = dynamic(() => import("@/components/city-map").then((mod) => mod.CityMap), { ssr: false })

const fallbackChartData = [
  { name: "Thu", value: 98 },
  { name: "Fri", value: 102 },
  { name: "Sat", value: 105 },
  { name: "Sun", value: 103 },
  { name: "Mon", value: 100 },
  { name: "Tue", value: 95 },
  { name: "Wed", value: 108 },
]

const HOURLY_CACHE_KEY = "inetHourlyHeatIndex"

type TrendWindow = "7h" | "24h" | "7d"

const TREND_WINDOWS: { key: TrendWindow; label: string; count: number }[] = [
  { key: "7h", label: "Latest 7 hrs", count: 7 },
  { key: "24h", label: "Last 24 hrs", count: 24 },
  { key: "7d", label: "Last 7 days", count: 7 },
]

type HeatIndexPoint = {
  timestamp: string
  temperature_c: number
  apparent_temperature_c?: number
  relative_humidity: number
  heat_index_f: number
  heat_index_c: number
}

type HourlyHeatIndexCity = {
  city: string
  latitude: number
  longitude: number
  current: HeatIndexPoint | null
  hourly: HeatIndexPoint[]
}

type ChartDatum = {
  name: string
  value: number
}

type HourlyHeatIndexPayload = {
  generated_at: string
  timezone: string
  unit: string
  cities: HourlyHeatIndexCity[]
}

type RiskLevel = "unknown" | "comfort" | "caution" | "moderate" | "high" | "extreme"

type RiskDescriptor = {
  level: RiskLevel
  label: string
  badge: string
  message: string
  icon: string
  vulnerableLabel: string
  vulnerableSummary: string
  safetyTitle: string
  safetySummary: string
  safetyIcon: string
}

const RISK_LABELS: Record<RiskLevel, { label: string; badge: string; message: string }> = {
  unknown: {
    label: "STATUS UNKNOWN",
    badge: "Awaiting data",
    message: "Live feed still syncing",
  },
  comfort: {
    label: "COMFORT",
    badge: "Enjoy outdoors",
    message: "Cool, low-risk conditions for most activities",
  },
  caution: {
    label: "CAUTION",
    badge: "Stay hydrated",
    message: "Outdoor activity is manageable with breaks",
  },
  moderate: {
    label: "HEAT ALERT",
    badge: "Limit exertion",
    message: "Shade and hydration recommended",
  },
  high: {
    label: "DANGER",
    badge: "High risk",
    message: "Heat cramps and exhaustion likely",
  },
  extreme: {
    label: "EXTREME DANGER",
    badge: "Severe risk",
    message: "Heat stroke imminent without protection",
  },
}

const RISK_ICONS: Record<RiskLevel, string> = {
  unknown: "update_disabled",
  comfort: "park",
  caution: "sunny",
  moderate: "device_thermostat",
  high: "local_fire_department",
  extreme: "warning",
}

const VULNERABLE_COPY: Record<
  RiskLevel,
  { label: string; summary: string; safetyTitle: string; safetySummary: string; safetyIcon: string }
> = {
  unknown: {
    label: "CHECKING CONDITIONS",
    summary: "Please wait while data syncs",
    safetyTitle: "STAY ALERT",
    safetySummary: "Monitor updates",
    safetyIcon: "hourglass_top",
  },
  comfort: {
    label: "COMFORTABLE",
    summary: "Open-air activity OK",
    safetyTitle: "KEEP HYDRATED",
    safetySummary: "Normal precautions",
    safetyIcon: "local_florist",
  },
  caution: {
    label: "SENSITIVE GROUPS",
    summary: "Elderly, kids, pregnant",
    safetyTitle: "LIGHT PROTECTION",
    safetySummary: "Shade & water breaks",
    safetyIcon: "umbrella",
  },
  moderate: {
    label: "HIGH-RISK ALERT",
    summary: "Outdoor workers, elderly",
    safetyTitle: "LIMIT EXPOSURE",
    safetySummary: "Frequent cooling breaks",
    safetyIcon: "water_drop",
  },
  high: {
    label: "SEVERE RISK",
    summary: "Everyone outdoors",
    safetyTitle: "STAY INDOORS",
    safetySummary: "Cooling centers advised",
    safetyIcon: "home",
  },
  extreme: {
    label: "EXTREME DANGER",
    summary: "All groups impacted",
    safetyTitle: "SUSPEND ACTIVITY",
    safetySummary: "Immediate shelter",
    safetyIcon: "emergency",
  },
}

function classifyHeatIndex(value: number | null): RiskDescriptor {
  let level: RiskLevel = "unknown"
  if (value !== null) {
    if (value >= 54) {
      level = "extreme"
    } else if (value >= 41) {
      level = "high"
    } else if (value >= 32) {
      level = "moderate"
    } else if (value >= 27) {
      level = "caution"
    } else {
      level = "comfort"
    }
  }
  const labels = RISK_LABELS[level]
  const vulnerable = VULNERABLE_COPY[level]
  return {
    level,
    ...labels,
    icon: RISK_ICONS[level],
    vulnerableLabel: vulnerable.label,
    vulnerableSummary: vulnerable.summary,
    safetyTitle: vulnerable.safetyTitle,
    safetySummary: vulnerable.safetySummary,
    safetyIcon: vulnerable.safetyIcon,
  }
}

function formatClockLabel(timestamp?: string): string | null {
  if (!timestamp) {
    return null
  }
  const value = Date.parse(timestamp)
  if (Number.isNaN(value)) {
    return null
  }
  return new Date(value).toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

function formatHourTick(timestamp: string): string {
  const parsed = Date.parse(timestamp)
  if (Number.isNaN(parsed)) {
    return timestamp
  }
  return new Date(parsed).toLocaleTimeString("en-PH", { hour: "numeric" })
}

function formatMinuteTick(timestamp: number | string): string {
  const parsed = typeof timestamp === "number" ? timestamp : Date.parse(timestamp)
  if (Number.isNaN(parsed)) {
    return typeof timestamp === "string" ? timestamp : ""
  }
  return new Date(parsed).toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function buildLastHourSeries(hourly: HeatIndexPoint[]): ChartDatum[] {
  if (!hourly.length) {
    return fallbackChartData
  }
  const latest = hourly[hourly.length - 1]
  const previous = hourly.length > 1 ? hourly[hourly.length - 2] : latest
  const latestTs = Date.parse(latest.timestamp)
  const previousTs = Date.parse(previous.timestamp)
  if (Number.isNaN(latestTs)) {
    return fallbackChartData
  }
  const startTs = Number.isNaN(previousTs) ? latestTs - 60 * 60 * 1000 : previousTs
  const startValue = previous.heat_index_c
  const endValue = latest.heat_index_c
  const stepMs = 10 * 60 * 1000
  const steps = 6
  const result: ChartDatum[] = []
  for (let index = 0; index <= steps; index += 1) {
    const pointTs = startTs + index * stepMs
    const ratio = index / steps
    const value = startValue + (endValue - startValue) * ratio
    result.push({ name: formatMinuteTick(pointTs), value: Number(value.toFixed(1)) })
  }
  return result
}

function determineTrendIcon(current: number | null, peak: number | null): string {
  if (peak == null || current == null) {
    return "trending_flat"
  }
  if (peak > current + 0.5) {
    return "trending_up"
  }
  if (peak < current - 0.5) {
    return "trending_down"
  }
  return "trending_flat"
}


export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState<string>("")
  const [currentDate, setCurrentDate] = useState<string>("")
  const [selectedCity, setSelectedCity] = useState<CityOption>(cityOptions[0])
  const [heatIndexData, setHeatIndexData] = useState<HourlyHeatIndexPayload | null>(null)
  const [isLoadingHeatIndex, setIsLoadingHeatIndex] = useState<boolean>(true)
  const [heatIndexError, setHeatIndexError] = useState<string | null>(null)
  const [trendWindow, setTrendWindow] = useState<TrendWindow>("7h")

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const timeString = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
      const dateString = now.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "long",
        day: "2-digit",
      })
      setCurrentTime(timeString)
      setCurrentDate(dateString)
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let disposed = false

    const hydrateFromCache = () => {
      if (typeof window === "undefined") {
        return false
      }
      const raw = sessionStorage.getItem(HOURLY_CACHE_KEY)
      if (!raw) {
        return false
      }
      try {
        const cached = JSON.parse(raw) as HourlyHeatIndexPayload
        setHeatIndexData(cached)
        setHeatIndexError(null)
        setIsLoadingHeatIndex(false)
        return true
      } catch {
        sessionStorage.removeItem(HOURLY_CACHE_KEY)
        return false
      }
    }

    const cacheHit = hydrateFromCache()
    if (!cacheHit) {
      setIsLoadingHeatIndex(true)
    }

    const loadHourlyHeatIndex = async () => {
      try {
        const response = await fetch("/data/hourly_heat_index.json", {
          signal: controller.signal,
          cache: "no-store",
        })
        if (!response.ok) {
          throw new Error("Failed to load hourly heat index feed")
        }
        const payload = (await response.json()) as HourlyHeatIndexPayload
        if (typeof window !== "undefined") {
          sessionStorage.setItem(HOURLY_CACHE_KEY, JSON.stringify(payload))
        }
        if (!disposed) {
          setHeatIndexData(payload)
          setHeatIndexError(null)
          setIsLoadingHeatIndex(false)
        }
      } catch (error) {
        if ((error as DOMException).name === "AbortError") {
          return
        }
        if (!disposed) {
          setHeatIndexError((error as Error).message)
          setIsLoadingHeatIndex(false)
        }
      }
    }

    loadHourlyHeatIndex()
    return () => {
      disposed = true
      controller.abort()
    }
  }, [])

  const selectedCityStats = useMemo(() => {
    if (!heatIndexData) {
      return null
    }
    return heatIndexData.cities.find((entry) => entry.city === selectedCity.name) ?? null
  }, [heatIndexData, selectedCity.name])

  const cityHeatLayers = useMemo<CityHeatLayer[]>(() => {
    return cityOptions.map((option) => {
      const stats = heatIndexData?.cities.find((entry) => entry.city === option.name)
      return {
        ...option,
        heatIndex: stats?.current?.heat_index_c ?? null,
      }
    })
  }, [heatIndexData])

  const handleCitySelect = useCallback((layer: CityHeatLayer) => {
    const match = cityOptions.find((option) => option.name === layer.name)
    if (match) {
      setSelectedCity(match)
    }
  }, [])

  const currentHeatIndex = selectedCityStats?.current?.heat_index_c ?? null
  const currentHumidity = selectedCityStats?.current?.relative_humidity ?? null
  const currentUpdatedLabel = formatClockLabel(selectedCityStats?.current?.timestamp)
  const riskDescriptor = classifyHeatIndex(currentHeatIndex)

  const peak24HourPoint = useMemo(() => {
    const hourly = selectedCityStats?.hourly ?? []
    if (!hourly.length) {
      return null
    }
    const now = Date.now()
    const horizon = now + 24 * 60 * 60 * 1000
    const withinWindow = hourly.filter((point) => {
      const value = Date.parse(point.timestamp)
      return !Number.isNaN(value) && value >= now && value <= horizon
    })
    const candidates = withinWindow.length ? withinWindow : hourly.slice(-24)
    return candidates.reduce((peak, point) => (point.heat_index_c > peak.heat_index_c ? point : peak), candidates[0])
  }, [selectedCityStats])

  const peakDescriptor = classifyHeatIndex(peak24HourPoint?.heat_index_c ?? null)
  const peakTimeLabel = formatClockLabel(peak24HourPoint?.timestamp)
  const peakTrendIcon = determineTrendIcon(currentHeatIndex, peak24HourPoint?.heat_index_c ?? null)

  const currentColor = useMemo(() => heatIndexColor(currentHeatIndex), [currentHeatIndex])
  const currentTextColor = useMemo(() => pickTextColor(currentColor), [currentColor])
  const currentChipColor = useMemo(() => lightenColor(currentColor, 0.2), [currentColor])
  const currentChipTextColor = useMemo(() => pickTextColor(currentChipColor), [currentChipColor])
  const riskCardColor = useMemo(() => darkenColor(currentColor, 0.15), [currentColor])
  const riskCardTextColor = useMemo(() => pickTextColor(riskCardColor), [riskCardColor])

  const peakHeatIndex = peak24HourPoint?.heat_index_c ?? null
  const peakColor = useMemo(() => heatIndexColor(peakHeatIndex), [peakHeatIndex])
  const peakTextColor = useMemo(() => pickTextColor(peakColor), [peakColor])
  const peakChipColor = useMemo(() => lightenColor(peakColor, 0.2), [peakColor])
  const peakChipTextColor = useMemo(() => pickTextColor(peakChipColor), [peakChipColor])

  const trendWindowConfig = useMemo(() => {
    return TREND_WINDOWS.find((window) => window.key === trendWindow) ?? TREND_WINDOWS[1]
  }, [trendWindow])

  const chartData = useMemo(() => {
    const hourly = selectedCityStats?.hourly ?? []
    if (!hourly.length) {
      return fallbackChartData
    }
    if (trendWindow === "7d") {
      const count = Math.max(1, trendWindowConfig.count)
      const dayGrouped = hourly.reduce<Record<string, HeatIndexPoint>>((acc, point) => {
        const day = point.timestamp.split("T")[0]
        acc[day] = point
        return acc
      }, {})
      const days = Object.keys(dayGrouped).sort().slice(-count)
      return days.map((day) => {
        const point = dayGrouped[day]
        return {
          name: day,
          value: Number(point.heat_index_c.toFixed(1)),
        }
      })
    }
    const count = Math.max(1, trendWindowConfig.count)
    const recent = hourly.slice(-count)
    return recent.map((point) => ({
      name: formatHourTick(point.timestamp),
      value: Number(point.heat_index_c.toFixed(1)),
    }))
  }, [selectedCityStats, trendWindow, trendWindowConfig])

  const chartGradient = useMemo(() => {
    const values = chartData.map((point) => point.value)
    if (!values.length) {
      return { start: "#38bdf8", end: "#ef4444" }
    }
    const min = Math.min(...values)
    const max = Math.max(...values)
    return {
      start: heatIndexColor(min),
      end: heatIndexColor(max),
    }
  }, [chartData])

  const dataStatus = heatIndexError
    ? "Data refresh failed"
    : isLoadingHeatIndex
      ? "Loading latest readings"
      : currentUpdatedLabel
        ? `Updated ${currentUpdatedLabel}`
        : "Live data"

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/app-icon.png" alt="INET-READY icon" width={40} height={40} priority className="h-10 w-10" />
          <span className="text-2xl font-semibold">INET-READY</span>
        </div>
        <nav className="flex gap-8">
          <button className="hover:opacity-80">Features</button>
          <button className="hover:opacity-80">About</button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-8 py-6 flex overflow-hidden">
        <div className="grid grid-cols-3 gap-6 flex-1 h-full overflow-hidden">
          {/* Left Column - Expanded Map */}
          <div className="col-span-2 flex h-full min-h-0">
            <div className="bg-white rounded-3xl p-8 shadow-md border border-gray-300 flex flex-col w-full min-h-0">
              <div className="flex items-center gap-2 mb-4">
                <label className="text-3xl font-bold text-gray-800">Heat Map</label>
                <select
                  className="ml-auto px-4 py-2 border-2 border-gray-300 rounded-lg bg-white cursor-pointer font-medium"
                  value={selectedCity.name}
                  onChange={(event) => {
                    const city = cityOptions.find((option) => option.name === event.target.value)
                    if (city) {
                      setSelectedCity(city)
                    }
                  }}
                >
                  {cityOptions.map((city) => (
                    <option key={city.name} value={city.name}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>
              {/* Cavite Map */}
              <div className="w-full flex-1 rounded-2xl overflow-hidden border-2 border-gray-300 min-h-0">
                <CityMap city={selectedCity} cityReadings={cityHeatLayers} onSelectCity={handleCitySelect} />
              </div>
            </div>
          </div>

          {/* Right Column - Alert Cards */}
          <div className="flex flex-col gap-4 h-full min-h-0">
            {/* Time & Date with Insights link */}
            <div className="bg-white rounded-lg p-4 shadow-md border border-gray-300">
              <div className="flex items-center justify-between gap-4 mb-2">
                <Link
                  href={{ pathname: "/insights", query: { city: selectedCity.name } }}
                  className="text-blue-600 hover:text-blue-800 hover:underline font-bold text-sm whitespace-nowrap"
                >
                  View Insights Reports
                </Link>
                <div className="text-4xl font-bold text-gray-900 text-right flex-1">
                  {currentTime || "Loading..."}
                </div>
              </div>
              <div className="text-gray-600 text-sm text-right">{currentDate || ""}</div>
            </div>

            <div className="grid grid-cols-2 gap-4 flex-shrink-0">
              {/* Risk Level - spans full width */}
              <div
                className="col-span-2 rounded-2xl py-5 px-6 shadow-md flex items-center gap-3"
                style={{ backgroundColor: riskCardColor, color: riskCardTextColor }}
              >
                <span className="material-symbols-rounded text-2xl" aria-hidden="true">
                  {riskDescriptor.icon}
                </span>
                <div>
                  <p className="text-xs font-semibold opacity-90">Risk Level</p>
                  <p className="text-xl font-bold">{riskDescriptor.label}</p>
                  <p className="text-xs opacity-90">{riskDescriptor.message}</p>
                </div>
              </div>

              {/* Current Heat Index - left */}
              <div
                className="rounded-2xl p-5 shadow-md"
                style={{ backgroundColor: currentColor, color: currentTextColor }}
              >
                <p className="text-xs font-semibold opacity-90 mb-2">Current Heat Index</p>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-4xl font-bold mb-2">
                    {currentHeatIndex !== null ? `${currentHeatIndex.toFixed(1)}°C` : isLoadingHeatIndex ? "Loading..." : "--"}
                  </div>
                  {currentHumidity !== null && <span className="text-sm font-semibold opacity-80">{currentHumidity.toFixed(0)}% RH</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-xl" aria-hidden="true">
                    {riskDescriptor.icon}
                  </span>
                  <span
                    className="text-xs font-bold px-2 py-1 rounded-full"
                    style={{ backgroundColor: currentChipColor, color: currentChipTextColor }}
                  >
                    {riskDescriptor.badge}
                  </span>
                </div>
                <p className="text-[0.7rem] mt-2 opacity-80">{dataStatus}</p>
                {heatIndexError && (
                  <p className="text-[0.7rem] mt-1" style={{ color: currentTextColor }}>
                    {heatIndexError}
                  </p>
                )}
              </div>

              {/* Peak 24 Hours - right */}
              <div
                className="rounded-2xl p-5 shadow-md"
                style={{ backgroundColor: peakColor, color: peakTextColor }}
              >
                <p className="text-xs font-semibold opacity-90 mb-2">For the next 24 hours</p>
                <div className="text-3xl font-bold mb-2">
                  {peak24HourPoint ? `PEAK ${peak24HourPoint.heat_index_c.toFixed(1)}°C` : isLoadingHeatIndex ? "Tracking..." : "PEAK --"}
                </div>
                <div
                  className="flex items-center gap-2 rounded-full px-3 py-1 w-fit"
                  style={{ backgroundColor: peakChipColor, color: peakChipTextColor }}
                >
                  <span className="material-symbols-rounded text-lg" aria-hidden="true" style={{ color: peakChipTextColor }}>
                    {peakTrendIcon}
                  </span>
                  <span className="font-bold text-xs">{peakDescriptor.label}</span>
                </div>
                <p className="text-[0.7rem] mt-3 font-semibold opacity-90">
                  {peakTimeLabel ? `Expected around ${peakTimeLabel}` : "Forecast syncing"}
                </p>
              </div>

              {/* Vulnerable Groups */}
              <div
                className="rounded-2xl p-5 shadow-md space-y-3"
                style={{ backgroundColor: currentChipColor, color: currentChipTextColor }}
              >
                <p className="text-xs font-semibold opacity-90">Vulnerable Groups</p>
                <div className="text-2xl font-bold">{riskDescriptor.vulnerableLabel}</div>
                <p className="text-sm font-medium opacity-90">{riskDescriptor.vulnerableSummary}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <div
                    className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold"
                    style={{ backgroundColor: currentColor, color: currentTextColor }}
                  >
                    <span className="material-symbols-rounded text-base" aria-hidden="true">
                      group
                    </span>
                    <span>{riskDescriptor.badge}</span>
                  </div>
                  <div
                    className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold"
                    style={{ backgroundColor: riskCardColor, color: riskCardTextColor }}
                  >
                    <span className="material-symbols-rounded text-base" aria-hidden="true">
                      {riskDescriptor.icon}
                    </span>
                    <span>{riskDescriptor.label}</span>
                  </div>
                </div>
              </div>

              {/* Safety Advisory */}
              <div
                className="rounded-2xl p-5 shadow-md space-y-3"
                style={{ backgroundColor: peakChipColor, color: peakChipTextColor }}
              >
                <p className="text-xs font-semibold opacity-90">Safety Advisory</p>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xl font-bold">{riskDescriptor.safetyTitle}</div>
                    <p className="text-sm opacity-90">{riskDescriptor.safetySummary}</p>
                  </div>
                  <span className="material-symbols-rounded text-3xl flex-shrink-0" aria-hidden="true">
                    {riskDescriptor.safetyIcon}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div
                    className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold"
                    style={{ backgroundColor: peakColor, color: peakTextColor }}
                  >
                    <span className="material-symbols-rounded text-base" aria-hidden="true">
                      health_and_safety
                    </span>
                    <span>Follow protocols</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Temperature Trend - now below alert cards */}
            <div className="bg-white rounded-3xl shadow-md border border-gray-300 flex-1 min-h-[14rem] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-8 pt-8 pb-4">
                <div className="text-sm text-gray-600">Temperature Trend</div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {TREND_WINDOWS.map((window) => {
                    const isActive = window.key === trendWindow
                    return (
                      <button
                        key={window.key}
                        type="button"
                        onClick={() => setTrendWindow(window.key)}
                        className={`text-xs font-semibold rounded-lg px-3 py-1 border transition-colors ${isActive ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-400"}`}
                        aria-pressed={isActive}
                      >
                        {window.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex-1 min-h-[200px] px-4 pb-6 sm:px-6">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="heatGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartGradient.end} stopOpacity={0.5} />
                        <stop offset="95%" stopColor={chartGradient.start} stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      padding={{ left: 10, right: 10 }}
                    />
                    <YAxis
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                      domain={["dataMin - 2", "dataMax + 2"]}
                    />
                    <Tooltip
                      contentStyle={{ background: "#ffffff", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}
                      labelStyle={{ color: "#475569", fontWeight: 600 }}
                      formatter={(value: number) => [`${value.toFixed(1)}°C`, "Heat Index"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={chartGradient.end}
                      fill="url(#heatGradient)"
                      strokeWidth={3}
                      activeDot={{ r: 5 }}
                      isAnimationActive
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
