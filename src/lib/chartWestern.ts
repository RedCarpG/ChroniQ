// Saved charts on the calendar, 星盘 side: the solar return (the Sun back at
// its birth longitude) and the days a slow planet (Jupiter to Pluto) makes an
// exact conjunction, square, trine or opposition to the natal Sun, Moon or
// Ascendant. Uses astronomy-engine, so the calendar loads it only when asked.
import * as A from 'astronomy-engine'
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

const cache = new Map<string, Map<string, ChartDay[]>>()

/** A chart's 星盘 dates in a (Gregorian) year, keyed by `${month}-${day}` */
export function westernYear(chart: SavedChart, year: number): Map<string, ChartDay[]> {
  const key = JSON.stringify([chart.id, chart.name, chart.input, year])
  const cached = cache.get(key)
  if (cached) return cached
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

  // Solar return, dated in the birthplace's time zone
  if (year > chart.input.year) {
    const found = A.SearchSunLongitude(lon('sun'), A.MakeTime(new Date(Date.UTC(year, 0, 1) - 2 * DAY)), 370)
    if (found) {
      const at = localDate(found.date, place.timeZone)
      if (at.year === year) add(at.key, { ...who, kind: 'solarReturn' })
    }
  }

  // Slow-planet transits: daily positions at noon UT; an aspect is exact on the
  // day its angle is closest when it crosses (a retrograde planet may cross more than once)
  const start = Date.UTC(year, 0, 1, 12)
  const count = Math.round((Date.UTC(year + 1, 0, 1, 12) - start) / DAY) + 1
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
            const at = new Date(start + (Math.abs(a) <= Math.abs(b) ? i : i + 1) * DAY)
            if (at.getUTCFullYear() === year) {
              add(`${at.getUTCMonth() + 1}-${at.getUTCDate()}`, { ...who, kind: 'transit', planet, aspect, point })
            }
          }
        }
      }
    }
  }

  cache.set(key, days)
  return days
}
