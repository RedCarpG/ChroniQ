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

const offsetFormats = new Map<string, Intl.DateTimeFormat>()

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

/** Wall-clock time in a zone → UTC instant and the offset that applied. */
export function toUtc(wall: WallClock, timeZone: string): { date: Date; offsetMinutes: number } {
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute)
  let offset = zoneOffset(asUtc, timeZone)
  // Re-check at the corrected instant, which matters right at a DST change.
  offset = zoneOffset(asUtc - offset * 60000, timeZone)
  return { date: new Date(asUtc - offset * 60000), offsetMinutes: offset }
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
