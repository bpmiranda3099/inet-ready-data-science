import PDFDocument from "pdfkit"
import { NextRequest, NextResponse } from "next/server"
import { buildInsightSnapshot } from "@/lib/server/insights"

const buildPdfBuffer = async (city: string, days: number) => {
  const snapshot = await buildInsightSnapshot(city, days)
  const peakTimeLabel = (() => {
    if (!snapshot.peakNext24h.timestamp) {
      return null
    }
    const parsed = Date.parse(snapshot.peakNext24h.timestamp)
    if (!Number.isFinite(parsed)) {
      return snapshot.peakNext24h.timestamp
    }
    return new Date(parsed).toLocaleString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      month: "short",
      day: "numeric",
    })
  })()
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const chunks: Buffer[] = []

    doc.on("data", (chunk) => chunks.push(chunk))
    doc.on("error", (error) => reject(error))
    doc.on("end", () => resolve(Buffer.concat(chunks)))

    doc.fontSize(18).fillColor("#1f2937").text(`INET-READY Heat Insights`, { align: "left" })
    doc.moveDown(0.25)
    doc.fontSize(14).fillColor("#0f172a").text(snapshot.city)
    doc.moveDown(0.5)
    doc.fontSize(10).fillColor("#475569").text(`Generated: ${snapshot.generatedAt ?? "--"}`)
    doc.fontSize(10).fillColor("#475569").text(`Timezone: ${snapshot.timezone ?? "Asia/Manila"}`)
    doc.moveDown(1)

    doc.fontSize(12).fillColor("#1f2937").text("Current Conditions", { underline: true })
    doc.moveDown(0.3)
    doc.fontSize(10)
      .text(`Risk Level: ${snapshot.currentRiskLabel}`)
      .text(
        `Current Heat Index: ${snapshot.current?.heat_index_c != null ? `${snapshot.current.heat_index_c.toFixed(1)} °C` : "--"}`,
      )
      .text(
        `Relative Humidity: ${snapshot.current?.relative_humidity != null ? `${snapshot.current.relative_humidity.toFixed(0)} %` : "--"}`,
      )
      .text(`Peak Next 24h: ${snapshot.peakNext24h.value != null ? `${snapshot.peakNext24h.value.toFixed(1)} °C` : "--"}${peakTimeLabel ? ` near ${peakTimeLabel}` : ""}`)
      .text(`High-Risk Hours (24h): ${snapshot.highRiskHours24h}`)
      .text(
        `Weekly Avg Heat Index: ${snapshot.weeklyAverageHeatIndex != null ? `${snapshot.weeklyAverageHeatIndex.toFixed(1)} °C` : "--"}`,
      )
    doc.moveDown(0.75)

    doc.fontSize(12).fillColor("#1f2937").text("Population Impact", { underline: true })
    doc.moveDown(0.3)
    doc.fontSize(10)
      .text(
        `Population (2020): ${snapshot.demographic?.population2020 != null ? snapshot.demographic.population2020.toLocaleString("en-US") : "--"}`,
      )
      .text(
        `Barangays: ${snapshot.demographic?.barangays != null ? snapshot.demographic.barangays : "--"}`,
      )
      .text(
        `Vulnerable Population Estimate: ${snapshot.vulnerablePopulation != null ? snapshot.vulnerablePopulation.toLocaleString("en-US") : "--"}`,
      )
      .text(
        `Cooling Center Load: ${snapshot.coolingCenterLoadPct != null ? `${snapshot.coolingCenterLoadPct}%` : "--"}`,
      )
    doc.moveDown(0.75)

    if (snapshot.weatherHistory.length) {
      doc.fontSize(12).fillColor("#1f2937").text("Recent Apparent Temperatures", { underline: true })
      doc.moveDown(0.3)
      snapshot.weatherHistory.forEach((point) => {
        doc
          .fontSize(10)
          .fillColor("#475569")
          .text(`${point.date}: ${point.current != null ? point.current.toFixed(1) : "--"} °C (avg ${point.average != null ? point.average.toFixed(1) : "--"} °C)`)
      })
      doc.moveDown(0.75)
    }

    doc.fontSize(9)
      .fillColor("#94a3b8")
      .text("Data sources: Open-Meteo hourly feed, PSA 2020 Census via Wikipedia, INET-READY analytics.", {
        align: "left",
      })

    doc.end()
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const city = searchParams.get("city")?.trim()
  const daysParam = Number(searchParams.get("days"))
  const days = Number.isFinite(daysParam) ? Math.min(Math.max(Math.floor(daysParam), 3), 30) : 7
  if (!city) {
    return NextResponse.json({ error: "city query parameter is required" }, { status: 400 })
  }

  try {
    const buffer = await buildPdfBuffer(city, days)
    const filename = `${city.replace(/\s+/g, "_").toLowerCase()}_heat_insights.pdf`
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("insights-export-pdf: failed", error)
    return NextResponse.json({ error: "Unable to create PDF" }, { status: 500 })
  }
}
