// 天象预告: what is worth going outside for in a year, as seen from a place. Only what can be seen from
// there is kept: each event is checked against the place's horizon and night, and carries the moment
// to look. Plain data, as it comes from a worker (skyEventsClient.ts); the page words it.
import {
  AngleFromSun,
  AngleBetween,
  Body,
  Equator,
  GeoMoon,
  GeoVector,
  Horizon,
  Illumination,
  MakeTime,
  NextLocalSolarEclipse,
  NextLunarEclipse,
  NextMoonQuarter,
  Observer,
  SearchLocalSolarEclipse,
  SearchLunarEclipse,
  SearchMaxElongation,
  SearchMoonQuarter,
  SearchRelativeLongitude,
  SearchSunLongitude,
} from 'astronomy-engine'
import { zoneOffset } from './timeZone'

export type SkyEventKind = 'solarEclipse' | 'lunarEclipse' | 'opposition' | 'elongation' | 'conjunction' | 'meteors' | 'supermoon'
export type PlanetName = 'Mercury' | 'Venus' | 'Mars' | 'Jupiter' | 'Saturn'
export type ShowerCode = 'QUA' | 'LYR' | 'ETA' | 'PER' | 'ORI' | 'LEO' | 'GEM'

interface SkyEventBase {
  /** Stable across runs (the calendar file's events are updated by it) */
  id: string
  /** The date of `time` where the viewer is, YYYY-MM-DD: the day it shows on */
  date: string
  /** The moment to look, UTC ms */
  time: number
  /** How long it is worth watching from `time`, in minutes (for the calendar file) */
  minutes: number
  /** Where to look at that moment, in degrees */
  altitude: number
  azimuth: number
}
export type SkyEvent = SkyEventBase &
  (
    | { kind: 'solarEclipse'; type: 'partial' | 'annular' | 'total'; obscuration: number; peak: number; start: number; end: number }
    | { kind: 'lunarEclipse'; type: 'penumbral' | 'partial' | 'total'; obscuration: number; peak: number; start: number; end: number; whole: boolean }
    | { kind: 'opposition'; body: PlanetName }
    | { kind: 'elongation'; body: PlanetName; side: 'morning' | 'evening'; degrees: number }
    | { kind: 'conjunction'; body: PlanetName; other: PlanetName; degrees: number }
    | { kind: 'meteors'; shower: ShowerCode; zhr: number; moonLit: number; ra: number; dec: number }
    | { kind: 'supermoon'; km: number }
  )

/** An event as worked out, before its date is read in the place's zone */
type Found<E = SkyEvent> = E extends SkyEvent ? Omit<E, 'id' | 'date'> : never

export interface SkyPlaceLike {
  latitude: number
  longitude: number
  timeZone: string
}

const HOUR = 3600_000
const DAY = 24 * HOUR
const MINUTE = 60_000
const PLANETS: PlanetName[] = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']
const BODY: Record<PlanetName, Body> = { Mercury: Body.Mercury, Venus: Body.Venus, Mars: Body.Mars, Jupiter: Body.Jupiter, Saturn: Body.Saturn }

/**
 * The main showers, from the International Meteor Organization's working list: the solar longitude
 * of the peak (J2000), the radiant (RA in degrees, dec) and the rate under ideal skies (ZHR).
 */
export const SHOWERS: { code: ShowerCode; longitude: number; ra: number; dec: number; zhr: number }[] = [
  { code: 'QUA', longitude: 283.16, ra: 230, dec: 49, zhr: 110 },
  { code: 'LYR', longitude: 32.32, ra: 271, dec: 34, zhr: 18 },
  { code: 'ETA', longitude: 45.5, ra: 338, dec: -1, zhr: 50 },
  { code: 'PER', longitude: 140.0, ra: 48, dec: 58, zhr: 100 },
  { code: 'ORI', longitude: 208, ra: 95, dec: 16, zhr: 20 },
  { code: 'LEO', longitude: 235.27, ra: 152, dec: 22, zhr: 15 },
  { code: 'GEM', longitude: 262.2, ra: 112, dec: 33, zhr: 150 },
]

/** The date at a UTC instant in a time zone, YYYY-MM-DD */
export function localDate(ms: number, timeZone: string): string {
  return new Date(ms + zoneOffset(ms, timeZone) * MINUTE).toISOString().slice(0, 10)
}

/** The height and direction of a body from the observer */
function horizontal(body: Body, ms: number, observer: Observer) {
  const time = MakeTime(new Date(ms))
  const eq = Equator(body, time, observer, true, true)
  return Horizon(time, observer, eq.ra, eq.dec, 'normal')
}

/**
 * The best moment of the 24 hours around an instant: the sky dark enough and the target highest.
 * target gives the height to judge by (of the lower one, for two planets) and where to point.
 */
function bestDark(
  around: number,
  observer: Observer,
  sunBelow: number,
  minAltitude: number,
  target: (ms: number) => { altitude: number; azimuth: number },
) {
  let best: { time: number; altitude: number; azimuth: number } | null = null
  for (let ms = around - 12 * HOUR; ms <= around + 12 * HOUR; ms += 20 * MINUTE) {
    if (horizontal(Body.Sun, ms, observer).altitude > sunBelow) continue
    const { altitude, azimuth } = target(ms)
    if (altitude >= minAltitude && (!best || altitude > best.altitude)) best = { time: ms, altitude, azimuth }
  }
  return best
}

const pointAt = (body: Body, observer: Observer) => (ms: number) => {
  const h = horizontal(body, ms, observer)
  return { altitude: h.altitude, azimuth: h.azimuth }
}

/** A Moon or Sun event's moment nearest its peak with the body up, among those from start to end */
function nearestUp(body: Body, peak: number, start: number, end: number, observer: Observer) {
  let best: { time: number; altitude: number; azimuth: number } | null = null
  let whole = true
  for (let ms = start; ms <= end; ms += 5 * MINUTE) {
    const h = horizontal(body, ms, observer)
    if (h.altitude <= 0) {
      whole = false
      continue
    }
    if (!best || Math.abs(ms - peak) < Math.abs(best.time - peak)) best = { time: ms, altitude: h.altitude, azimuth: h.azimuth }
  }
  return best && { ...best, whole }
}

/** The eclipses of the Moon with the Moon up here for some of it (the partial phase, when it has one) */
function lunarEclipses(from: number, to: number, observer: Observer) {
  const out: Omit<Extract<SkyEvent, { kind: 'lunarEclipse' }>, 'id' | 'date'>[] = []
  for (let e = SearchLunarEclipse(new Date(from)); e.peak.date.getTime() < to; e = NextLunarEclipse(e.peak)) {
    const peak = e.peak.date.getTime()
    const half = (e.sd_partial > 0 ? e.sd_partial : e.sd_penum) * MINUTE
    const up = nearestUp(Body.Moon, peak, peak - half, peak + half, observer)
    if (!up) continue
    out.push({
      kind: 'lunarEclipse',
      type: e.kind as 'penumbral' | 'partial' | 'total',
      obscuration: e.obscuration,
      peak,
      time: up.time,
      altitude: up.altitude,
      azimuth: up.azimuth,
      minutes: Math.round((2 * half) / MINUTE),
      start: peak - half,
      end: peak + half,
      whole: up.whole,
    })
  }
  return out
}

/** The eclipses of the Sun that reach here, with the Sun up for some of it */
function solarEclipses(from: number, to: number, observer: Observer) {
  const out: Omit<Extract<SkyEvent, { kind: 'solarEclipse' }>, 'id' | 'date'>[] = []
  for (let e = SearchLocalSolarEclipse(new Date(from), observer); e.peak.time.date.getTime() < to; e = NextLocalSolarEclipse(e.peak.time, observer)) {
    const peak = e.peak.time.date.getTime()
    const start = e.partial_begin.time.date.getTime()
    const end = e.partial_end.time.date.getTime()
    const up = nearestUp(Body.Sun, peak, start, end, observer)
    if (!up) continue
    out.push({
      kind: 'solarEclipse',
      type: e.kind as 'partial' | 'annular' | 'total',
      obscuration: e.obscuration,
      peak,
      time: up.time,
      altitude: up.altitude,
      azimuth: up.azimuth,
      minutes: Math.round((end - start) / MINUTE),
      start,
      end,
    })
  }
  return out
}

/** Mars, Jupiter and Saturn opposite the Sun: at their brightest, and up all night */
function oppositions(from: number, to: number, observer: Observer) {
  const out: Omit<Extract<SkyEvent, { kind: 'opposition' }>, 'id' | 'date'>[] = []
  for (const name of ['Mars', 'Jupiter', 'Saturn'] as const) {
    let ms = SearchRelativeLongitude(BODY[name], 0, new Date(from)).date.getTime()
    while (ms < to) {
      const best = bestDark(ms, observer, -6, 10, pointAt(BODY[name], observer))
      if (best) out.push({ kind: 'opposition', body: name, minutes: 240, ...best })
      ms = SearchRelativeLongitude(BODY[name], 0, new Date(ms + 30 * DAY)).date.getTime()
    }
  }
  return out
}

/** Mercury and Venus at their farthest from the Sun, if they stand clear of the horizon here in the twilight */
function elongations(from: number, to: number, observer: Observer) {
  const out: Omit<Extract<SkyEvent, { kind: 'elongation' }>, 'id' | 'date'>[] = []
  for (const name of ['Mercury', 'Venus'] as const) {
    let e = SearchMaxElongation(BODY[name], new Date(from))
    while (e.time.date.getTime() < to) {
      const ms = e.time.date.getTime()
      const best = bestDark(ms, observer, -6, 5, pointAt(BODY[name], observer))
      if (best) out.push({ kind: 'elongation', body: name, side: e.visibility as 'morning' | 'evening', degrees: e.elongation, minutes: 60, ...best })
      e = SearchMaxElongation(BODY[name], new Date(ms + DAY))
    }
  }
  return out
}

/** Two planets within two degrees of each other, clear of the Sun, with both up here in a dark sky */
function conjunctions(from: number, to: number, observer: Observer) {
  const out: Omit<Extract<SkyEvent, { kind: 'conjunction' }>, 'id' | 'date'>[] = []
  const days = Math.ceil((to - from) / DAY) + 1
  const vectors = PLANETS.map((name) => Array.from({ length: days }, (_, i) => GeoVector(BODY[name], new Date(from + i * DAY), true)))
  PLANETS.forEach((a, i) => {
    PLANETS.slice(i + 1).forEach((b, offset) => {
      const j = i + 1 + offset
      const apart = (d: number) => AngleBetween(vectors[i][d], vectors[j][d])
      for (let d = 1; d < days - 1; d++) {
        const degrees = apart(d)
        if (degrees > 2 || degrees > apart(d - 1) || degrees >= apart(d + 1)) continue
        const ms = from + d * DAY
        const date = new Date(ms)
        if (Math.min(AngleFromSun(BODY[a], date), AngleFromSun(BODY[b], date)) < 15) continue
        const best = bestDark(ms, observer, -6, 5, (t) => {
          const pa = horizontal(BODY[a], t, observer)
          const pb = horizontal(BODY[b], t, observer)
          return { altitude: Math.min(pa.altitude, pb.altitude), azimuth: pa.azimuth }
        })
        if (best) out.push({ kind: 'conjunction', body: a, other: b, degrees, minutes: 60, ...best })
      }
    })
  })
  return out
}

/** The showers at their peak, with the radiant high enough here in a properly dark sky */
function meteors(from: number, to: number, observer: Observer) {
  const out: Omit<Extract<SkyEvent, { kind: 'meteors' }>, 'id' | 'date'>[] = []
  const year = new Date(from + 30 * DAY).getUTCFullYear()
  // The peaks are given for J2000; SearchSunLongitude takes the equinox of the date
  const precession = (1.397 * (year - 2000)) / 100
  for (const s of SHOWERS) {
    const peak = SearchSunLongitude((s.longitude + precession + 360) % 360, new Date(from), Math.ceil((to - from) / DAY))
    if (!peak) continue
    const ms = peak.date.getTime()
    const best = bestDark(ms, observer, -12, 20, (t) => {
      const h = Horizon(MakeTime(new Date(t)), observer, s.ra / 15, s.dec, 'normal')
      return { altitude: h.altitude, azimuth: h.azimuth }
    })
    if (!best) continue
    // Moonlight counts only with the Moon up
    const date = new Date(best.time)
    const moonUp = horizontal(Body.Moon, best.time, observer).altitude > 0
    out.push({ kind: 'meteors', shower: s.code, zhr: s.zhr, ra: s.ra, dec: s.dec, moonLit: moonUp ? Illumination(Body.Moon, date).phase_fraction : 0, minutes: 180, ...best })
  }
  return out
}

/** Full Moons near the Moon's perigee (within 360,000 km, the usual reckoning of a 超级月亮) */
function supermoons(from: number, to: number, observer: Observer) {
  const out: Omit<Extract<SkyEvent, { kind: 'supermoon' }>, 'id' | 'date'>[] = []
  for (let q = SearchMoonQuarter(new Date(from)); q.time.date.getTime() < to; q = NextMoonQuarter(q)) {
    if (q.quarter !== 2) continue
    const km = GeoMoon(q.time).Length() * 149_597_870.7
    if (km > 360_000) continue
    const best = bestDark(q.time.date.getTime(), observer, -6, 10, pointAt(Body.Moon, observer))
    if (best) out.push({ kind: 'supermoon', km: Math.round(km), minutes: 120, ...best })
  }
  return out
}

/**
 * How an eclipse looks at a moment, to draw over the body (its size being a drawing's, not the sky's):
 * the covering disc's radius and how far its centre is from the body's, both in the body's radii.
 * Null outside the eclipse; a penumbral eclipse has no edge, so it only dims.
 */
export function eclipseShade(e: SkyEvent, ms: number) {
  if (e.kind !== 'solarEclipse' && e.kind !== 'lunarEclipse') return null
  if (ms < e.start || ms > e.end) return null
  const before = ms < e.peak ? (e.peak - ms) / (e.peak - e.start) : (ms - e.peak) / (e.end - e.peak)
  const shade = (radius: number, closest: number) => {
    const touching = radius + 1
    return { body: e.kind === 'solarEclipse' ? ('sun' as const) : ('moon' as const), radius, offset: closest + before * (touching - closest), dim: false }
  }
  if (e.kind === 'solarEclipse') return e.type === 'partial' ? shade(1, 2 * (1 - e.obscuration)) : shade(e.type === 'total' ? 1.03 : 0.9, 0)
  if (e.type === 'penumbral') return { ...shade(1, 0), offset: 0, dim: true }
  // The Earth's shadow is some 2.7 Moons across
  return e.type === 'total' ? shade(2.7, 0) : shade(2.7, 3.7 - 2 * e.obscuration)
}

/** What makes an event's id: its kind and what it is of */
const subject = (e: Found) =>
  e.kind === 'meteors' ? e.shower : e.kind === 'opposition' || e.kind === 'elongation' ? e.body : e.kind === 'conjunction' ? e.body + e.other : ''

/** The year's events seen from a place, by time, on the days of that year there */
export function computeSkyEvents(year: number, place: SkyPlaceLike): SkyEvent[] {
  const observer = new Observer(place.latitude, place.longitude, 0)
  // A little either side, as the zone's date and the moment to look can cross the year's end
  const from = Date.UTC(year, 0, 1) - 2 * DAY
  const to = Date.UTC(year + 1, 0, 1) + 2 * DAY
  const prefix = `${year}-`
  return [
    ...solarEclipses(from, to, observer),
    ...lunarEclipses(from, to, observer),
    ...oppositions(from, to, observer),
    ...elongations(from, to, observer),
    ...conjunctions(from, to, observer),
    ...meteors(from, to, observer),
    ...supermoons(from, to, observer),
  ]
    .map((e) => {
      const date = localDate(e.time, place.timeZone)
      return { ...e, date, id: `${e.kind}-${subject(e)}-${date}` } as SkyEvent
    })
    .filter((e) => e.date.startsWith(prefix))
    .sort((a, b) => a.time - b.time)
}
