import { NextRequest, NextResponse } from "next/server"
import { buildInsightSnapshot } from "@/lib/server/insights"

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
    return NextResponse.json(snapshot)
  } catch (error) {
    console.error("insights-metrics: failed to build snapshot", error)
    return NextResponse.json({ error: "Unable to build insights snapshot" }, { status: 500 })
  }
}
