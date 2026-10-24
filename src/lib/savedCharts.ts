// Last bazi input and named saved charts, kept only in this browser.
import type { BaziInput } from './bazi'
import { DEFAULT_PLACE, placeFromLongitude, samePlace, toPlace, type Place } from './place'
import { loadLegacyStarPlace } from './starPrefs'

export interface SavedChart {
  id: string
  name: string
  input: BaziInput
}

const LAST_KEY = 'chroniq-bazi-last'
const CHARTS_KEY = 'chroniq-bazi-charts'

const inRange = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

/**
 * Accepts only a well-formed BaziInput, so stale or edited storage can't break
 * the chart. Older inputs had no birthplace, only a 真太阳时 longitude: that
 * becomes 真太阳时 at its city; with neither, `fallback` (if given) is the place.
 */
export function toBaziInput(v: unknown, fallback?: Place | null): BaziInput | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (
    !inRange(o.year, 1900, 2100) ||
    !inRange(o.month, 1, 12) ||
    !inRange(o.day, 1, 31) ||
    !inRange(o.hour, 0, 23) ||
    !inRange(o.minute, 0, 59) ||
    (o.gender !== 0 && o.gender !== 1)
  )
    return null
  const input: BaziInput = {
    year: o.year as number,
    month: o.month as number,
    day: o.day as number,
    hour: o.hour as number,
    minute: o.minute as number,
    gender: o.gender,
  }
  const place = toPlace(o.place)
  if (place) input.place = place
  if (o.trueSolar === true) input.trueSolar = true
  if (!place && typeof o.longitude === 'number' && o.longitude >= -180 && o.longitude <= 180) {
    input.place = placeFromLongitude(o.longitude)
    input.trueSolar = true
  }
  if (!input.place && fallback) input.place = fallback
  return input
}

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable (private mode): keep working for this visit only.
  }
}

export const loadLastInput = (): BaziInput | null => toBaziInput(read(LAST_KEY), loadLegacyStarPlace())
export const saveLastInput = (input: BaziInput): void => write(LAST_KEY, input)

export function loadCharts(): SavedChart[] {
  const raw = read(CHARTS_KEY)
  if (!Array.isArray(raw)) return []
  const legacy = loadLegacyStarPlace()
  return raw.flatMap((c) => {
    const input = toBaziInput(c?.input, legacy)
    return input && typeof c.id === 'string' && typeof c.name === 'string' ? [{ id: c.id, name: c.name, input }] : []
  })
}

export const saveCharts = (charts: SavedChart[]): void => write(CHARTS_KEY, charts)

export const sameInput = (a: BaziInput, b: BaziInput): boolean =>
  a.year === b.year &&
  a.month === b.month &&
  a.day === b.day &&
  a.hour === b.hour &&
  a.minute === b.minute &&
  a.gender === b.gender &&
  !!a.trueSolar === !!b.trueSolar &&
  samePlace(a.place ?? DEFAULT_PLACE, b.place ?? DEFAULT_PLACE)

/** Adds a chart, or replaces the input of the one with the same name. */
export function upsertChart(charts: SavedChart[], name: string, input: BaziInput): SavedChart[] {
  const existing = charts.find((c) => c.name === name)
  if (existing) return charts.map((c) => (c === existing ? { ...c, input } : c))
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  return [...charts, { id, name, input }]
}
