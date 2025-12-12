import { promises as fs } from "fs"
import path from "path"
import { NextRequest, NextResponse } from "next/server"

const WEATHER_HISTORY_PATH = path.join(process.cwd(), "..", "dataset", "clean", "weather_history.csv")

const REQUIRED_COLUMNS = ["city", "date", "temperature_2m_max", "apparent_temperature_max"] as const

type RequiredColumn = (typeof REQUIRED_COLUMNS)[number]

type CsvRecord = Record<RequiredColumn, string>

type WeatherHistorySeriesPoint = {
  date: string
  current: number | null
  average: number | null
}

const toNumber = (value?: string | null) => {
  if (value == null || value.trim() === "") {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const parseCsv = (contents: string): { headers: string[]; rows: string[][] } => {
  const lines = contents.trim().split(/\r?\n/)
  const headers = lines.shift()?.split(",") ?? []
  return { headers: headers.map((header) => header.trim()), rows: lines.map((line) => line.split(",")) }
}

const toRecord = (row: string[], headers: string[]): CsvRecord | null => {
  if (row.length !== headers.length) {
    return null
  }
  const record: Partial<CsvRecord> = {}
  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index] as RequiredColumn | undefined
    if (header && REQUIRED_COLUMNS.includes(header)) {
      record[header] = row[index]?.trim() ?? ""
    }
  }
  if (REQUIRED_COLUMNS.every((column) => typeof record[column] === "string")) {
    return record as CsvRecord
  }
  return null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const cityParam = searchParams.get("city")?.trim()
  const daysParam = Number(searchParams.get("days"))
  const days = Number.isFinite(daysParam) ? Math.min(Math.max(Math.floor(daysParam), 1), 30) : 7

  if (!cityParam) {
    return NextResponse.json({ error: "city query parameter is required" }, { status: 400 })
  }

  let raw: string
  try {
    raw = await fs.readFile(WEATHER_HISTORY_PATH, "utf-8")
  } catch (error) {
    console.error("weather-history: unable to read csv", error)
    return NextResponse.json({ error: "Unable to read weather history file" }, { status: 500 })
  }

  const { headers, rows } = parseCsv(raw)
  if (!headers.length) {
    return NextResponse.json({ error: "Weather history file has no header" }, { status: 500 })
  }

  const filteredRecords = rows
    .map((row) => toRecord(row.map((value) => value.trim()), headers))
    .filter((record): record is CsvRecord => Boolean(record && record.city))
    .filter((record) => record.city.toLowerCase() === cityParam.toLowerCase())

  if (!filteredRecords.length) {
    return NextResponse.json({ city: cityParam, series: [] })
  }

  const latestSlice = filteredRecords.slice(-days)
  const series: WeatherHistorySeriesPoint[] = latestSlice.map((record) => ({
    date: record.date,
    current: toNumber(record.apparent_temperature_max),
    average: toNumber(record.temperature_2m_max),
  }))

  return NextResponse.json({ city: cityParam, series })
}
