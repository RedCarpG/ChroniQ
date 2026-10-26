import { LruCache } from './lruCache'
// Time zones through Intl, which carries each zone's history (daylight saving,
// e.g. China 1986–91, and changes of standard offset). No dependencies, so
// the app shell can use it.

export interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

const offsetFormats = new LruCache<string, Intl.DateTimeFormat>(64)

/** Offset of timeZone from UTC at a UTC instant, in minutes. */
export function zoneOffset(utcMs: number, timeZone: string): number {
  // Making a formatter is far slower than using one: keep one a zone
  let format = offsetFormats.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
    offsetFormats.set(timeZone, format)
  }
  const parts = format.formatToParts(new Date(utcMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - utcMs) / 60000)
}

export interface ZonedTime {
  date: Date
  offsetMinutes: number
  resolution: 'exact' | 'overlap' | 'gap'
}

/**
 * Resolve offsets on both sides of a clock change. Repeated times use the
 * earlier instant. Nonexistent times move forward by the gap (Temporal's
 * compatible policy); forms/storage reject gaps before committing birth data.
 */
export function toUtc(wall: WallClock, timeZone: string): ZonedTime {
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute)
  const offsets = new Set([-2, 0, 2].map((days) => zoneOffset(asUtc + days * 86400_000, timeZone)))
  const candidates = [...offsets].map((offset) => {
    const utc = asUtc - offset * 60000
    const actualOffset = zoneOffset(utc, timeZone)
    return { utc, offset: actualOffset, local: utc + actualOffset * 60000 }
  })
  const exact = candidates.filter((c) => c.local === asUtc).sort((a, b) => a.utc - b.utc)
  const chosen = exact[0] ?? candidates.filter((c) => c.local > asUtc).sort((a, b) => a.local - b.local)[0]
  if (!chosen) throw new RangeError('Cannot resolve local time')
  return {
    date: new Date(chosen.utc),
    offsetMinutes: chosen.offset,
    resolution: exact.length > 1 ? 'overlap' : exact.length === 1 ? 'exact' : 'gap',
  }
}

/** Whether a zone name is one this browser knows */
export function validZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone })
    return true
  } catch {
    return false
  }
}
