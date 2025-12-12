import { existsSync, promises as fs } from "fs"
import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

const resolveDataPath = (...candidates: string[]): string => {
  const match = candidates.find((candidate) => existsSync(candidate))
  return match ?? candidates[0]
}

const CACHE_PATH = resolveDataPath(
  path.join(process.cwd(), "public", "data", "safety_recommendations_cache.json"),
  path.join(process.cwd(), "..", "dataset", "clean", "safety_recommendations_cache.json"),
)
const REFRESH_WINDOW_MS = 60 * 60 * 1000 // one hour

export type SafetyRecommendation = {
  title: string
  summary: string
  urgency: "low" | "medium" | "high"
  focus: string
}

type CacheEntry = {
  city: string
  updated_at: string
  recommendations: SafetyRecommendation[]
}

type CachePayload = {
  generated_at: string
  entries: CacheEntry[]
}

const defaultPayload: CachePayload = { generated_at: new Date(0).toISOString(), entries: [] }

const readCache = async (): Promise<CachePayload> => {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf-8")
    return JSON.parse(raw) as CachePayload
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await writeCache(defaultPayload)
      return defaultPayload
    }
    console.warn("safety-recommendations: unable to read cache", error)
    return defaultPayload
  }
}

const writeCache = async (payload: CachePayload) => {
  try {
    await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true })
    await fs.writeFile(CACHE_PATH, JSON.stringify(payload, null, 2))
  } catch (error) {
    console.warn("safety-recommendations: unable to persist cache", error)
  }
}

const createFallbackRecommendations = (city: string): SafetyRecommendation[] => [
  {
    title: "Expand shaded rest points",
    summary: `Set up extra misting tents or shaded lay-bys near markets and transport hubs in ${city} to avoid crowding during heat spikes.`,
    urgency: "medium",
    focus: "cooling"
  },
  {
    title: "Intensify hydration alerts",
    summary: `Push barangay-level SMS or megaphone reminders every two hours urging residents of ${city} to check vulnerable neighbors and hydrate.`,
    urgency: "high",
    focus: "risk-comms"
  },
  {
    title: "Deploy barangay patrol thermometers",
    summary: `Equip community volunteers with handheld meters to log apparent temperatures around schools and construction corridors in ${city}.`,
    urgency: "low",
    focus: "monitoring"
  }
]

const sanitizeResponse = (text: string): SafetyRecommendation[] | null => {
  if (!text) {
    return null
  }
  const clean = text
    .replace(/^```json\s*/i, "")
    .replace(/```$/i, "")
    .trim()
  try {
    const parsed = JSON.parse(clean)
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => ({
          title: String(item.title ?? "").trim(),
          summary: String(item.summary ?? "").trim(),
          urgency: (item.urgency ?? "medium").toLowerCase(),
          focus: String(item.focus ?? "general").trim(),
        }))
        .filter((item) => item.title && item.summary) as SafetyRecommendation[]
    }
  } catch (error) {
    console.warn("safety-recommendations: unable to parse model response", error)
  }
  return null
}

const requestRecommendations = async (city: string): Promise<SafetyRecommendation[]> => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn("safety-recommendations: GEMINI_API_KEY is not configured; falling back to static copy")
    return createFallbackRecommendations(city)
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? "gemini-1.5-flash" })

  const prompt = `You are a climate risk advisor for Cavite, Philippines.
Produce exactly three short safety recommendations tailored for the city of ${city} based on a dangerous heat index situation.
Respond with a JSON array. Each object must contain: title, summary, urgency (low|medium|high), and focus (e.g., cooling, hydration, policy, logistics).
Keep summaries under 200 characters and reference barangays or local context when possible.`

  try {
    const response = await model.generateContent(prompt)
    const text = response.response.text()
    const parsed = sanitizeResponse(text)
    return parsed && parsed.length ? parsed : createFallbackRecommendations(city)
  } catch (error) {
    console.error("safety-recommendations: model request failed", error)
    return createFallbackRecommendations(city)
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const city = searchParams.get("city")?.trim()
  if (!city) {
    return NextResponse.json({ error: "city query parameter is required" }, { status: 400 })
  }

  const cache = await readCache()
  const now = Date.now()
  const cachedEntry = cache.entries.find((entry) => entry.city.toLowerCase() === city.toLowerCase())
  if (cachedEntry) {
    const age = now - Date.parse(cachedEntry.updated_at)
    if (Number.isFinite(age) && age < REFRESH_WINDOW_MS) {
      return NextResponse.json({ city, updated_at: cachedEntry.updated_at, recommendations: cachedEntry.recommendations })
    }
  }

  const recommendations = await requestRecommendations(city)
  const updated_at = new Date().toISOString()
  const nextEntries = cache.entries.filter((entry) => entry.city.toLowerCase() !== city.toLowerCase())
  nextEntries.push({ city, updated_at, recommendations })

  const nextPayload: CachePayload = {
    generated_at: updated_at,
    entries: nextEntries,
  }
  await writeCache(nextPayload)

  return NextResponse.json({ city, updated_at, recommendations })
}
