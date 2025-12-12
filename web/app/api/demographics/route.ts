import { NextRequest, NextResponse } from "next/server"
import { loadDemographics } from "@/lib/server/demographics"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const cityFilter = searchParams.get("city")?.trim().toLowerCase()

  try {
    const { records, updatedAt } = await loadDemographics()
    const filtered = cityFilter
      ? records.filter((record) => record.city.toLowerCase() === cityFilter)
      : records

    return NextResponse.json({
      updated_at: updatedAt,
      records: filtered,
    })
  } catch (error) {
    console.error("demographics: failed to load", error)
    return NextResponse.json({ error: "Unable to read demographics file" }, { status: 500 })
  }
}
