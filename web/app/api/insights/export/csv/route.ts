import { NextRequest, NextResponse } from "next/server"
import { buildInsightSnapshot } from "@/lib/server/insights"

const formatValue = (value: number | null, digits = 1) => {
  if (value == null) {
    return "--"
  }
  return Number(value).toFixed(digits)
}

const toCsv = (rows: string[][]) => rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n")

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const city = searchParams.get("city")?.trim()
  const daysParam = Number(searchParams.get("days"))
  const days = Number.isFinite(daysParam) ? Math.min(Math.max(Math.floor(daysParam), 3), 30) : 7
  if (!city) {
    return NextResponse.json({ error: "city query parameter is required" }, { status: 400 })
  }

  try {
    const snapshot = await buildInsightSnapshot(city, days)
    const rows: string[][] = [
      ["Metric", "Value", "Units", "Notes"],
      ["Risk Level", snapshot.currentRiskLabel, "", "Derived from current heat index"],
      [
        "Current Heat Index",
        snapshot.current?.heat_index_c != null ? formatValue(snapshot.current.heat_index_c) : "--",
        "°C",
        snapshot.updatedLabel ? `Updated ${snapshot.updatedLabel}` : "",
      ],
      [
        "Relative Humidity",
        snapshot.current?.relative_humidity != null ? formatValue(snapshot.current.relative_humidity, 0) : "--",
        "% RH",
        "Latest hourly reading",
      ],
      [
        "Peak Next 24h",
        snapshot.peakNext24h.value != null ? formatValue(snapshot.peakNext24h.value) : "--",
        "°C",
        snapshot.peakNext24h.timestamp ?? "",
      ],
      ["High-Risk Hours (24h)", String(snapshot.highRiskHours24h), "hours", "Heat index >= 41°C"],
      [
        "Weekly Average Heat Index",
        snapshot.weeklyAverageHeatIndex != null ? formatValue(snapshot.weeklyAverageHeatIndex) : "--",
        "°C",
        "Rolling 7-day apparent temperature",
      ],
      [
        "Population (2020)",
        snapshot.demographic?.population2020 != null ? snapshot.demographic.population2020.toLocaleString("en-US") : "--",
        "people",
        snapshot.demographic?.classification ?? "",
      ],
      [
        "Barangays",
        snapshot.demographic?.barangays != null ? String(snapshot.demographic.barangays) : "--",
        "count",
        "Administrative villages",
      ],
      [
        "Vulnerable Population",
        snapshot.vulnerablePopulation != null ? snapshot.vulnerablePopulation.toLocaleString("en-US") : "--",
        "people",
        "Estimated share needing immediate cooling",
      ],
      [
        "Cooling Center Load",
        snapshot.coolingCenterLoadPct != null ? `${snapshot.coolingCenterLoadPct}%` : "--",
        "% capacity",
        "Heuristic indicator",
      ],
    ]

    const csv = toCsv(rows)
    const filename = `${city.replace(/\s+/g, "_").toLowerCase()}_heat_insights.csv`
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("insights-export-csv: failed", error)
    return NextResponse.json({ error: "Unable to build CSV export" }, { status: 500 })
  }
}
