"use client"

import { cityOptions } from "@/lib/cities"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type HistoricalChartPoint = {
  name: string
  current: number | null
  average: number | null
}

type HeatIndexPoint = {
  timestamp: string
  heat_index_c: number
  relative_humidity: number
  temperature_c: number
}

type WeatherHistoryPoint = {
  date: string
  current: number | null
  average: number | null
}

type DemographicRecord = {
  city: string
  classification: string
  district: string | null
  population2020: number | null
  population2015: number | null
  annualGrowthRatePct: number | null
  areaKm2: number | null
  densityPerKm2: number | null
  barangays: number | null
  provincePopulationSharePct: number | null
  sourceUrl: string
  collectedAt: string
}

type DemographicResponse = {
  updated_at: string | null
  records: DemographicRecord[]
}

type SafetyRecommendation = {
  title: string
  summary: string
  urgency: "low" | "medium" | "high"
  focus: string
}

type SafetyResponse = {
  city: string
  updated_at: string
  recommendations: SafetyRecommendation[]
}

type InsightMetrics = {
  city: string
  generatedAt: string | null
  timezone: string | null
  current: HeatIndexPoint | null
  currentRiskLabel: string
  riskLevel: "unknown" | "comfort" | "caution" | "moderate" | "high" | "extreme"
  updatedLabel: string | null
  weeklyAverageHeatIndex: number | null
  peakNext24h: { value: number | null; timestamp: string | null }
  highRiskHours24h: number
  demographic: DemographicRecord | null
  vulnerablePopulation: number | null
  coolingCenterLoadPct: number | null
  hourlyPoints: HeatIndexPoint[]
  weatherHistory: WeatherHistoryPoint[]
}

const fallbackHistoricalData: HistoricalChartPoint[] = [
  { name: "Thu", current: 98, average: 97 },
  { name: "Fri", current: 102, average: 99 },
  { name: "Sat", current: 105, average: 100 },
  { name: "Sun", current: 103, average: 99 },
  { name: "Mon", current: 100, average: 98 },
  { name: "Tue", current: 95, average: 96 },
  { name: "Wed", current: 108, average: 97 },
]

const URGENCY_STYLES: Record<SafetyRecommendation["urgency"], string> = {
  low: "border-green-200 bg-green-50 text-green-800",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  high: "border-red-200 bg-red-50 text-red-800",
}

const RISK_PALETTE: Record<string, { badge: string; accent: string }> = {
  unknown: { badge: "bg-slate-100 text-slate-700 border-slate-200", accent: "text-slate-600" },
  comfort: { badge: "bg-emerald-100 text-emerald-800 border-emerald-200", accent: "text-emerald-700" },
  caution: { badge: "bg-yellow-100 text-yellow-800 border-yellow-200", accent: "text-yellow-600" },
  moderate: { badge: "bg-orange-100 text-orange-800 border-orange-200", accent: "text-orange-600" },
  high: { badge: "bg-red-100 text-red-800 border-red-200", accent: "text-red-600" },
  extreme: { badge: "bg-rose-100 text-rose-900 border-rose-200", accent: "text-rose-600" },
}

const formatHistoryLabel = (dateString: string) => {
  const parsed = Date.parse(dateString)
  if (Number.isNaN(parsed)) {
    return dateString
  }
  return new Date(parsed).toLocaleDateString("en-PH", { weekday: "short" })
}

const formatClockLabel = (timestamp?: string | null) => {
  if (!timestamp) {
    return null
  }
  const parsed = Date.parse(timestamp)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return new Date(parsed).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true })
}

const formatNumber = (value: number | null | undefined, options?: Intl.NumberFormatOptions) => {
  if (value == null) {
    return "--"
  }
  return value.toLocaleString("en-PH", options)
}

const formatHeatIndex = (value: number | null | undefined, digits = 1) => {
  if (value == null) {
    return "--"
  }
  return `${value.toFixed(digits)}°C`
}

export default function InsightsReport() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialCity = searchParams.get("city") ?? cityOptions[0].name
  const [selectedCity, setSelectedCity] = useState(initialCity)
  const [metrics, setMetrics] = useState<InsightMetrics | null>(null)
  const [metricsStatus, setMetricsStatus] = useState<"idle" | "loading" | "error">("idle")
  const [demographics, setDemographics] = useState<DemographicRecord[]>([])
  const [demoStatus, setDemoStatus] = useState<"idle" | "loading" | "error">("idle")
  const [safetyCache, setSafetyCache] = useState<Record<string, SafetyRecommendation[]>>({})
  const [safetyStatus, setSafetyStatus] = useState<"idle" | "loading" | "error">("idle")

  useEffect(() => {
    setSelectedCity(initialCity)
  }, [initialCity])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadMetrics = async () => {
      try {
        setMetricsStatus("loading")
        const response = await fetch(
          `/api/insights/metrics?city=${encodeURIComponent(selectedCity)}&days=7`,
          { cache: "no-store", signal: controller.signal },
        )
        if (!response.ok) {
          throw new Error(`Unable to load metrics for ${selectedCity}`)
        }
        const payload = (await response.json()) as InsightMetrics
        if (!cancelled) {
          setMetrics(payload)
          setMetricsStatus("idle")
        }
      } catch (error) {
        if ((error as DOMException).name === "AbortError") {
          return
        }
        console.error(error)
        if (!cancelled) {
          setMetricsStatus("error")
        }
      }
    }

    loadMetrics()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [selectedCity])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const loadDemographics = async () => {
      try {
        setDemoStatus("loading")
        const response = await fetch("/api/demographics", { signal: controller.signal })
        if (!response.ok) {
          throw new Error("Failed to load demographic data")
        }
        const payload = (await response.json()) as DemographicResponse
        if (!cancelled) {
          setDemographics(payload.records ?? [])
          setDemoStatus("idle")
        }
      } catch (error) {
        if ((error as DOMException).name === "AbortError") {
          return
        }
        console.error(error)
        if (!cancelled) {
          setDemoStatus("error")
        }
      }
    }

    loadDemographics()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (safetyCache[selectedCity]) {
      setSafetyStatus("idle")
      return
    }

    let cancelled = false
    const controller = new AbortController()
    const loadSafety = async () => {
      try {
        setSafetyStatus("loading")
        const response = await fetch(`/api/safety-recommendations?city=${encodeURIComponent(selectedCity)}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error("Failed to load safety recommendations")
        }
        const payload = (await response.json()) as SafetyResponse
        if (!cancelled) {
          setSafetyCache((prev) => ({ ...prev, [selectedCity]: payload.recommendations }))
          setSafetyStatus("idle")
        }
      } catch (error) {
        if ((error as DOMException).name === "AbortError") {
          return
        }
        console.error(error)
        if (!cancelled) {
          setSafetyStatus("error")
        }
      }
    }

    loadSafety()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [selectedCity, safetyCache])

  const historicalSeries = useMemo<HistoricalChartPoint[]>(() => {
    const series = metrics?.weatherHistory ?? []
    if (!series.length) {
      return fallbackHistoricalData
    }
    return series.map((entry) => ({
      name: formatHistoryLabel(entry.date),
      current: entry.current,
      average: entry.average,
    }))
  }, [metrics])

  const hourlySeries = useMemo(() => {
    return (metrics?.hourlyPoints ?? []).slice(-24).map((point) => ({
      name: formatClockLabel(point.timestamp) ?? point.timestamp,
      heatIndex: point.heat_index_c,
    }))
  }, [metrics])

  const demographicChartData = useMemo(() => {
    if (!demographics.length) {
      return []
    }
    return demographics.map((record) => ({
      name: record.city,
      cityPopulation: record.classification === "city" ? record.population2020 ?? 0 : 0,
      municipalPopulation: record.classification === "municipality" ? record.population2020 ?? 0 : 0,
    }))
  }, [demographics])

  const selectedDemographic = useMemo(() => {
    return demographics.find((record) => record.city === selectedCity) ?? null
  }, [demographics, selectedCity])

  const dataStatus = useMemo(() => {
    if (metricsStatus === "loading") {
      return `Refreshing data for ${selectedCity}...`
    }
    if (metricsStatus === "error") {
      return "Showing cached insights"
    }
    return metrics?.updatedLabel ? `Updated ${metrics.updatedLabel}` : "Live data"
  }, [metrics, metricsStatus, selectedCity])

  const peakTimeLabel = useMemo(() => formatClockLabel(metrics?.peakNext24h.timestamp), [metrics])

  const demographicUpdatedLabel = useMemo(() => {
    return selectedDemographic?.collectedAt
      ? new Date(selectedDemographic.collectedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric" })
      : null
  }, [selectedDemographic])

  const safetyRecommendations = safetyCache[selectedCity] ?? []
  const riskStyle = RISK_PALETTE[metrics?.riskLevel ?? "moderate"] ?? RISK_PALETTE.moderate

  const handleCityChange = useCallback(
    (cityName: string) => {
      setSelectedCity(cityName)
      const params = new URLSearchParams(searchParams.toString())
      params.set("city", cityName)
      router.replace(`/insights?${params.toString()}`)
    },
    [router, searchParams],
  )

  const handleDownload = useCallback(
    async (kind: "pdf" | "csv" | "full") => {
      if (typeof window === "undefined") {
        return
      }
      try {
        const days = kind === "full" ? 14 : 7
        const endpoint =
          kind === "csv"
            ? `/api/insights/export/csv?city=${encodeURIComponent(selectedCity)}&days=${days}`
            : `/api/insights/export/pdf?city=${encodeURIComponent(selectedCity)}&days=${days}`
        const response = await fetch(endpoint)
        if (!response.ok) {
          throw new Error("Download failed")
        }
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const anchor = document.createElement("a")
        const suffix = kind === "csv" ? "_heat_insights.csv" : kind === "full" ? "_full_report.pdf" : "_heat_insights.pdf"
        anchor.href = url
        anchor.download = `${selectedCity.replace(/\s+/g, "_").toLowerCase()}${suffix}`
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        window.URL.revokeObjectURL(url)
      } catch (error) {
        console.error(error)
        window.alert("Unable to download the report right now. Please try again.")
      }
    },
    [selectedCity],
  )

  return (
    <div className="min-h-screen flex flex-col bg-white">
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

      <main className="flex-1 px-8 py-8 bg-gray-50">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold text-base hover:underline"
          >
            <span aria-hidden="true">←</span>
            Back to Dashboard
          </Link>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
          <div>
            <p className="text-sm text-gray-500">Realtime heat intelligence</p>
            <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900">Insights & Demographic Impact</h1>
            <p className="text-gray-600 mt-2 max-w-2xl">
              Align public safety actions with actual readings, frontline saturation, and vulnerability data for every Cavite
              city in one briefing view.
            </p>
          </div>
          <div className="flex flex-col gap-2 min-w-[240px]">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500" htmlFor="city-select">
              Focus City
            </label>
            <select
              id="city-select"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
              value={selectedCity}
              onChange={(event) => handleCityChange(event.target.value)}
            >
              {cityOptions.map((city) => (
                <option key={city.name} value={city.name}>
                  {city.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500">{dataStatus}</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">Current Heat Index</p>
                <p className="text-4xl font-semibold text-gray-900 mt-2">{formatHeatIndex(metrics?.current?.heat_index_c)}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {metrics?.current?.timestamp ? `as of ${formatClockLabel(metrics.current.timestamp)}` : "Awaiting sensor feed"}
                </p>
              </div>
              <span className={`border px-3 py-1 rounded-full text-xs font-semibold ${riskStyle.badge}`}>
                {metrics?.currentRiskLabel ?? "Assessing"}
              </span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wider text-gray-500">Peak in Next 24h</p>
            <p className="text-4xl font-semibold text-gray-900 mt-2">{formatHeatIndex(metrics?.peakNext24h.value)}</p>
            <p className="text-sm text-gray-500 mt-1">{peakTimeLabel ? `Projected around ${peakTimeLabel}` : "No forecast window"}</p>
            <p className="text-sm text-gray-600 mt-4">
              {metrics?.highRiskHours24h ?? 0} hours spent above dangerous thresholds in the past 24 hours.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wider text-gray-500">Vulnerable Population</p>
            <p className="text-4xl font-semibold text-gray-900 mt-2">{formatNumber(metrics?.vulnerablePopulation)}</p>
            <p className="text-sm text-gray-500 mt-1">
              {selectedDemographic?.population2020
                ? `${Math.round(((metrics?.vulnerablePopulation ?? 0) / selectedDemographic.population2020) * 100)}% of residents`
                : "Need census data"}
            </p>
            <p className="text-sm text-gray-600 mt-4">
              Based on actual PSA 2020 totals plus risk-layer multipliers per heat classification.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wider text-gray-500">Cooling Center Load</p>
            <p className="text-4xl font-semibold text-gray-900 mt-2">
              {metrics?.coolingCenterLoadPct != null ? `${metrics.coolingCenterLoadPct}%` : "--"}
            </p>
            <p className="text-sm text-gray-500 mt-1">Modeled against barangay-level capacity targets.</p>
            <p className="text-sm text-gray-600 mt-4">
              Prioritize areas exceeding 80% utilization to avoid clinic spillover and heat stroke surge.
            </p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3 mb-8">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm xl:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">Hourly Heat Stress</p>
                <h2 className="text-xl font-semibold text-gray-900">Recent Heat Index Curve</h2>
              </div>
              <span className={`text-sm font-semibold ${riskStyle.accent}`}>
                {metrics?.weeklyAverageHeatIndex ? `Weekly avg ${formatHeatIndex(metrics.weeklyAverageHeatIndex)}` : "Insufficient data"}
              </span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlySeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="heatGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} unit="°C" domain={[20, "auto"]} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, borderColor: "#e5e7eb" }}
                    labelStyle={{ fontWeight: 600 }}
                    formatter={(value: number) => [`${value.toFixed(1)}°C`, "Heat Index"]}
                  />
                  <Area type="monotone" dataKey="heatIndex" stroke="#ea580c" fill="url(#heatGradient)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">Historical Alignment</p>
                <h2 className="text-xl font-semibold text-gray-900">Current vs Seasonal Baseline</h2>
              </div>
              <span className="text-xs font-semibold text-gray-500">Past week</span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={historicalSeries} margin={{ top: 0, right: 0, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} unit="°C" />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, borderColor: "#e5e7eb" }}
                    formatter={(value: number, name) => [`${value.toFixed(1)}°C`, name === "current" ? "Observed" : "Seasonal"]}
                  />
                  <Bar dataKey="current" fill="#2563eb" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="average" fill="#94a3b8" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3 mb-8">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">Demographic Impact</p>
                <h2 className="text-xl font-semibold text-gray-900">Population & Land Footprint</h2>
              </div>
              <span className="text-xs text-gray-500">
                {demographicUpdatedLabel ? `Census ref ${demographicUpdatedLabel}` : demoStatus === "loading" ? "Loading" : "Last scrape"}
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <dl>
                <dt className="text-xs uppercase tracking-wide text-gray-500">2020 Population</dt>
                <dd className="text-3xl font-semibold text-gray-900 mt-1">{formatNumber(selectedDemographic?.population2020)}</dd>
              </dl>
              <dl>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Density</dt>
                <dd className="text-3xl font-semibold text-gray-900 mt-1">
                  {selectedDemographic?.densityPerKm2 ? `${formatNumber(selectedDemographic.densityPerKm2)} / km²` : "--"}
                </dd>
              </dl>
            </div>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div>
                <p className="font-semibold text-gray-900">Classification</p>
                <p className="capitalize">{selectedDemographic?.classification ?? "Not tagged"}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Barangays</p>
                <p>{selectedDemographic?.barangays ?? "--"}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Area</p>
                <p>{selectedDemographic?.areaKm2 ? `${selectedDemographic.areaKm2.toFixed(1)} km²` : "--"}</p>
              </div>
            </div>
            <div className="h-60 mt-8">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={demographicChartData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={10} interval={0} angle={-40} textAnchor="end" height={80} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#e5e7eb" }} formatter={(value: number) => [formatNumber(value), "Population"]} />
                  <Bar dataKey="cityPopulation" stackId="pop" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="municipalPopulation" stackId="pop" fill="#6366f1" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col">
            <p className="text-xs uppercase tracking-wider text-gray-500">Data Export & Briefings</p>
            <h2 className="text-xl font-semibold text-gray-900 mt-1">Shareable Situation Reports</h2>
            <p className="text-sm text-gray-600 mt-2">
              Generate clean CSV extracts for analysts or branded PDF briefings for the command center. Full downloads bundle
              the two-week window plus safety notes.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:border-gray-400"
                onClick={() => void handleDownload("csv")}
              >
                Export 7-day CSV
              </button>
              <button
                className="w-full rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-semibold shadow hover:bg-blue-500"
                onClick={() => void handleDownload("pdf")}
              >
                Download PDF Brief
              </button>
              <button
                className="w-full rounded-lg border border-dashed border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:border-blue-400"
                onClick={() => void handleDownload("full")}
              >
                Download Full Report
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-4">All exports respect the active city selection ({selectedCity}).</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">Safety Playbook</p>
              <h2 className="text-xl font-semibold text-gray-900">Gemini-powered risk messaging</h2>
              <p className="text-sm text-gray-600 mt-1">
                Cached hourly per city. Focus areas and urgency tags adapt to live conditions, so LGUs can broadcast timely
                advice without manual drafting.
              </p>
            </div>
            <span className="text-xs text-gray-500">
              {safetyStatus === "loading" ? "Generating..." : safetyStatus === "error" ? "Using cached copy" : "Auto-refreshed hourly"}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {safetyRecommendations.map((recommendation) => (
              <article
                key={recommendation.title}
                className={`border rounded-2xl p-4 shadow-sm ${URGENCY_STYLES[recommendation.urgency] ?? URGENCY_STYLES.medium}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold">{recommendation.title}</h3>
                  <span className="text-xs font-semibold uppercase">{recommendation.urgency}</span>
                </div>
                <p className="text-sm leading-relaxed mb-3">{recommendation.summary}</p>
                <p className="text-xs font-semibold">Focus: {recommendation.focus}</p>
              </article>
            ))}
            {!safetyRecommendations.length && (
              <div className="col-span-full text-center text-sm text-gray-500 border border-dashed border-gray-300 rounded-2xl p-6">
                {safetyStatus === "loading" ? "Pulling the latest advisories..." : "No recommendations cached for this city yet."}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
