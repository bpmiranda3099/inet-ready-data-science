import { existsSync, promises as fs } from "fs"
import path from "path"

const resolveDataPath = (...candidates: string[]): string => {
  const match = candidates.find((candidate) => existsSync(candidate))
  return match ?? candidates[0]
}

const DEMOGRAPHICS_PATH = resolveDataPath(
  path.join(process.cwd(), "public", "data", "cavite_demographics.csv"),
  path.join(process.cwd(), "..", "dataset", "clean", "cavite_demographics.csv"),
)

const HEADERS = [
  "city",
  "classification",
  "district",
  "population_2020",
  "population_2015",
  "annual_growth_rate_pct",
  "area_km2",
  "density_per_km2",
  "barangays",
  "province_population_share_pct",
  "source_url",
  "collected_at",
] as const

type HeaderKey = (typeof HEADERS)[number]

type DemographicRecordRaw = Record<HeaderKey, string>

export type DemographicRecord = {
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

const numberPattern = /-?\d+(?:\.\d+)?/

const parseNumber = (value: string | undefined): number | null => {
  if (!value) {
    return null
  }
  const trimmed = value.trim().replace(/,/g, "")
  if (!trimmed) {
    return null
  }
  const match = trimmed.match(numberPattern)
  if (!match) {
    return null
  }
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
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

const toRecord = (row: string[], headers: string[]): DemographicRecordRaw | null => {
  if (row.length !== headers.length) {
    return null
  }
  const draft: Partial<DemographicRecordRaw> = {}
  headers.forEach((header, index) => {
    if (HEADERS.includes(header as HeaderKey)) {
      draft[header as HeaderKey] = row[index]?.trim() ?? ""
    }
  })
  if (HEADERS.every((header) => typeof draft[header] === "string")) {
    return draft as DemographicRecordRaw
  }
  return null
}

const hydrateRecord = (record: DemographicRecordRaw): DemographicRecord => ({
  city: record.city,
  classification: record.classification,
  district: record.district || null,
  population2020: parseNumber(record.population_2020),
  population2015: parseNumber(record.population_2015),
  annualGrowthRatePct: parseNumber(record.annual_growth_rate_pct),
  areaKm2: parseNumber(record.area_km2),
  densityPerKm2: parseNumber(record.density_per_km2),
  barangays: parseNumber(record.barangays),
  provincePopulationSharePct: parseNumber(record.province_population_share_pct),
  sourceUrl: record.source_url,
  collectedAt: record.collected_at,
})

export const loadDemographics = async (): Promise<{ records: DemographicRecord[]; updatedAt: string | null }> => {
  const raw = await fs.readFile(DEMOGRAPHICS_PATH, "utf-8")
  const { headers, rows } = parseCsv(raw)
  if (!headers.length) {
    return { records: [], updatedAt: null }
  }
  const records = rows
    .map((row) => toRecord(row, headers))
    .filter((record): record is DemographicRecordRaw => Boolean(record))
    .map((record) => hydrateRecord(record))

  return { records, updatedAt: records[0]?.collectedAt ?? null }
}

export const findDemographicRecord = async (city: string): Promise<DemographicRecord | null> => {
  const { records } = await loadDemographics()
  const lower = city.toLowerCase()
  return records.find((record) => record.city.toLowerCase() === lower) ?? null
}
