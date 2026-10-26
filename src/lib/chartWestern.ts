import { LruCache } from './lruCache'
// Saved charts on the calendar, 星盘 side: the solar return (the Sun back at
// its birth longitude) and the days a slow planet (Jupiter to Pluto) makes an
// exact conjunction, square, trine or opposition to the natal Sun, Moon or
// Ascendant. Uses astronomy-engine, so the calendar loads it only when asked.
import * as A from 'astronomy-engine'
import { toUtc } from './timeZone'
import { bodyLon, buildStarChart } from './astrology'
import type { ChartDay } from './chartDays'
import { DEFAULT_PLACE } from './place'
import type { SavedChart } from './savedCharts'
import { DEFAULT_STAR_SETTINGS } from './starPrefs'

const SLOW: [string, A.Body][] = [
  ['jupiter', A.Body.Jupiter],
  ['saturn', A.Body.Saturn],
  ['uranus', A.Body.Uranus],
  ['neptune', A.Body.Neptune],
  ['pluto', A.Body.Pluto],
]
const ASPECTS: [string, number][] = [
  ['conjunction', 0],
  ['square', 90],
  ['trine', 120],
  ['opposition', 180],
]
const DAY = 86400_000
/** Signed difference a − b in degrees, in −180…180 */
const diff = (a: number, b: number) => ((((a - b) % 360) + 540) % 360) - 180

/** Calendar date of an instant in a time zone, as `${month}-${day}` and its year */
function localDate(d: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  )
  return { year: Number(parts.year), key: `${Number(parts.month)}-${Number(parts.day)}` }
}

const cache = new LruCache<string, Map<string, ChartDay[]>>(24)

/** A chart's 星盘 dates in a (Gregorian) year, keyed by `${month}-${day}` */
export function westernYear(chart: SavedChart, year: number): Map<string, ChartDay[]> {
  const key = JSON.stringify([chart.id, chart.name, chart.input, year])
  const cached = cache.get(key)
  if (cached) return cached
  const days = computeWesternYear(chart, year)
  cache.set(key, days)
  return days
}

/** Uncached computation, also used by the worker; results are cached by its caller. */
export function computeWesternYear(chart: SavedChart, year: number): Map<string, ChartDay[]> {
  const days = new Map<string, ChartDay[]>()
  const add = (k: string, day: ChartDay) => days.set(k, [...(days.get(k) ?? []), day])
  const who = { chartId: chart.id, name: chart.name }
  const place = chart.input.place ?? DEFAULT_PLACE
  const natal = buildStarChart(chart.input, place, DEFAULT_STAR_SETTINGS)
  const lon = (k: string) => natal.points.find((p) => p.key === k)!.lon
  const targets: [string, number][] = [
    ['sun', lon('sun')],
    ['moon', lon('moon')],
    ['asc', natal.asc],
  ]

  const yearStart = toUtc({ year, month: 1, day: 1, hour: 0, minute: 0 }, place.timeZone).date.getTime()
  const yearEnd = toUtc({ year: year + 1, month: 1, day: 1, hour: 0, minute: 0 }, place.timeZone).date.getTime()

  // Solar return, dated in the birthplace's time zone
  if (year > chart.input.year) {
    const found = A.SearchSunLongitude(lon('sun'), A.MakeTime(new Date(yearStart)), (yearEnd - yearStart) / DAY)
    if (found) {
      const at = localDate(found.date, place.timeZone)
      if (at.year === year) add(at.key, { ...who, kind: 'solarReturn' })
    }
  }

  // Daily samples bracket crossings; refine their instants before assigning
  // a date in the birthplace. Include both edges of the local calendar year.
  const start = yearStart - DAY
  const count = Math.ceil((yearEnd - start) / DAY) + 2
  for (const [planet, body] of SLOW) {
    const lons = Array.from({ length: count }, (_, i) => bodyLon(body, A.MakeTime(new Date(start + i * DAY))))
    for (const [point, target] of targets) {
      for (const [aspect, angle] of ASPECTS) {
        for (const signed of angle === 0 || angle === 180 ? [angle] : [angle, -angle]) {
          for (let i = 0; i + 1 < count; i++) {
            const a = diff(lons[i] - target, signed)
            const b = diff(lons[i + 1] - target, signed)
            if (Math.abs(a) > 5 || Math.abs(b) > 5 || (a > 0 && b > 0) || (a < 0 && b < 0)) continue
            if (a === 0 && i > 0) continue // counted as the previous day's b
            let lo = start + i * DAY
            let hi = lo + DAY
            let left = a
            while (hi - lo > 100) {
              const mid = (lo + hi) / 2
              const value = diff(bodyLon(body, A.MakeTime(new Date(mid))) - target, signed)
              if (left * value <= 0) hi = mid
              else { lo = mid; left = value }
            }
            const at = localDate(new Date((lo + hi) / 2), place.timeZone)
            if (at.year === year) {
              const day: ChartDay = { ...who, kind: 'transit', planet, aspect, point }
              const existing = days.get(at.key) ?? []
              if (!existing.some((d) => d.kind === 'transit' && d.planet === planet && d.aspect === aspect && d.point === point)) add(at.key, day)
            }
          }
        }
      }
    }
  }

  return days
}
