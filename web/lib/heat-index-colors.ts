export type RGB = { r: number; g: number; b: number }

const HEAT_INDEX_COLOR_STOPS: { value: number; color: string }[] = [
  { value: 20, color: "#0ea5e9" },
  { value: 26, color: "#22d3ee" },
  { value: 30, color: "#facc15" },
  { value: 34, color: "#f97316" },
  { value: 40, color: "#fb923c" },
  { value: 46, color: "#ef4444" },
  { value: 55, color: "#7f1d1d" },
]

const DEFAULT_HEAT_COLOR = "#475569"

function hexToRgb(hex: string): RGB {
  const sanitized = hex.replace("#", "")
  if (sanitized.length !== 6) {
    return { r: 71, g: 85, b: 105 }
  }
  const value = Number.parseInt(sanitized, 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function rgbToHex({ r, g, b }: RGB): string {
  const clamp = (component: number) => Math.max(0, Math.min(255, Math.round(component)))
  return `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`
}

function interpolateColors(colorA: string, colorB: string, ratio: number): string {
  const start = hexToRgb(colorA)
  const end = hexToRgb(colorB)
  const mixChannel = (a: number, b: number) => a + (b - a) * ratio
  return rgbToHex({ r: mixChannel(start.r, end.r), g: mixChannel(start.g, end.g), b: mixChannel(start.b, end.b) })
}

export function heatIndexColor(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return DEFAULT_HEAT_COLOR
  }
  const stops = HEAT_INDEX_COLOR_STOPS
  if (value <= stops[0].value) {
    return stops[0].color
  }
  const last = stops[stops.length - 1]
  if (value >= last.value) {
    return last.color
  }
  for (let index = 0; index < stops.length - 1; index += 1) {
    const current = stops[index]
    const next = stops[index + 1]
    if (value >= current.value && value <= next.value) {
      const span = next.value - current.value
      const ratio = span === 0 ? 0 : (value - current.value) / span
      return interpolateColors(current.color, next.color, ratio)
    }
  }
  return DEFAULT_HEAT_COLOR
}

export function mixColors(colorA: string, colorB: string, amount: number): string {
  const clamped = Math.max(0, Math.min(1, amount))
  return interpolateColors(colorA, colorB, clamped)
}

export function lightenColor(color: string, amount: number): string {
  return mixColors(color, "#ffffff", amount)
}

export function darkenColor(color: string, amount: number): string {
  return mixColors(color, "#000000", amount)
}

export function pickTextColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? "#0f172a" : "#ffffff"
}
