// 太阳系: where the planets are on their orbits, seen from above the ecliptic
// (heliocentric ecliptic coordinates of date, from astronomy-engine), and how
// far each is from the Sun and from Earth. Only the 天象 tab imports this.
import * as A from 'astronomy-engine'

export type PlanetKey = 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto'

export interface PlanetInfo {
  key: PlanetKey
  name: string
  body: A.Body
  /** Sidereal orbital period, days */
  period: number
}

export const PLANETS: PlanetInfo[] = [
  { key: 'mercury', name: '水星', body: A.Body.Mercury, period: 87.969 },
  { key: 'venus', name: '金星', body: A.Body.Venus, period: 224.701 },
  { key: 'earth', name: '地球', body: A.Body.Earth, period: 365.256 },
  { key: 'mars', name: '火星', body: A.Body.Mars, period: 686.98 },
  { key: 'jupiter', name: '木星', body: A.Body.Jupiter, period: 4332.59 },
  { key: 'saturn', name: '土星', body: A.Body.Saturn, period: 10759.22 },
  { key: 'uranus', name: '天王星', body: A.Body.Uranus, period: 30688.5 },
  { key: 'neptune', name: '海王星', body: A.Body.Neptune, period: 60182 },
  { key: 'pluto', name: '冥王星', body: A.Body.Pluto, period: 90560 },
]

export interface PlanetPosition {
  key: PlanetKey
  name: string
  /** Heliocentric ecliptic x, y (AU): x towards the vernal equinox (♈ 0°) */
  x: number
  y: number
  /** Above (+) or below the ecliptic, AU */
  z: number
  /** Heliocentric ecliptic longitude, 0–360 */
  lon: number
  /** Distance from the Sun, AU */
  sun: number
  /** Distance from Earth, AU (0 for Earth) */
  earth: number
  /** Seen from Earth, moving backwards along the ecliptic */
  retrograde: boolean
  /** Seen from Earth, its ecliptic longitude among the stars, 0–360 (as in the 星盘); for Earth, the Sun's */
  geo: number
}

const DAY = 86400000
const norm = (d: number) => ((d % 360) + 360) % 360

/** Heliocentric ecliptic position, AU */
function helio(body: A.Body, t: A.AstroTime): [number, number, number] {
  const v = A.Ecliptic(A.HelioVector(body, t)).vec
  return [v.x, v.y, v.z]
}

/** Geocentric ecliptic longitude, for the direction of apparent motion */
const geoLon = (body: A.Body, t: A.AstroTime) => A.Ecliptic(A.GeoVector(body, t, true)).elon

export function planetsAt(utc: Date): PlanetPosition[] {
  const t = A.MakeTime(utc)
  const before = A.MakeTime(new Date(utc.getTime() - DAY / 2))
  const after = A.MakeTime(new Date(utc.getTime() + DAY / 2))
  const [ex, ey, ez] = helio(A.Body.Earth, t)
  return PLANETS.map(({ key, name, body }) => {
    const [x, y, z] = helio(body, t)
    return {
      key,
      name,
      x,
      y,
      z,
      lon: norm((Math.atan2(y, x) * 180) / Math.PI),
      sun: Math.hypot(x, y, z),
      earth: key === 'earth' ? 0 : Math.hypot(x - ex, y - ey, z - ez),
      retrograde: key !== 'earth' && norm(geoLon(body, after) - geoLon(body, before) + 180) - 180 < 0,
      geo: key === 'earth' ? geoLon(A.Body.Sun, t) : geoLon(body, t),
    }
  })
}

/**
 * Where one planet has stood among the stars seen from Earth (its ecliptic longitude, as geo) at
 * each of the given moments: the way it has gone, forwards, and back while retrograde.
 */
export function seenTrail(key: PlanetKey, times: Date[]): number[] {
  const body = key === 'earth' ? A.Body.Sun : PLANETS.find((p) => p.key === key)!.body
  return times.map((utc) => geoLon(body, A.MakeTime(utc)))
}

/**
 * When a planet goes backwards among the stars (seen from Earth) between two instants, found a day at
 * a time: each span from the first day it is going back to the last (cut at the ends of the time given)
 */
export function retroSpans(key: PlanetKey, from: Date, to: Date): { start: Date; end: Date }[] {
  if (key === 'earth') return []
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / DAY))
  const times = Array.from({ length: days + 1 }, (_, i) => new Date(from.getTime() + i * DAY))
  const lons = seenTrail(key, times)
  const spans: { start: Date; end: Date }[] = []
  let start: Date | null = null
  for (let i = 1; i < lons.length; i++) {
    const back = ((lons[i] - lons[i - 1] + 540) % 360) - 180 < 0
    if (back && !start) start = times[i - 1]
    if (!back && start) {
      spans.push({ start, end: times[i - 1] })
      start = null
    }
  }
  if (start) spans.push({ start, end: times[times.length - 1] })
  return spans
}

/** One orbit of each planet, sampled from the given moment: [x, y, z] points in AU. */
export function orbits(utc: Date, samples = 180): Record<PlanetKey, [number, number, number][]> {
  const out = {} as Record<PlanetKey, [number, number, number][]>
  for (const { key, body, period } of PLANETS) {
    out[key] = Array.from({ length: samples }, (_, i) => helio(body, A.MakeTime(new Date(utc.getTime() + (i / samples) * period * DAY))))
  }
  return out
}

/**
 * A planet's moments with the Sun, seen from Earth: an outer planet's opposition (冲日, opposite the
 * Sun, up all night and nearest) and conjunction (合日, behind the Sun); an inner planet's inferior
 * conjunction (下合, between us and the Sun), superior conjunction (上合, beyond it) and greatest
 * elongations, east in the evening sky and west in the morning (东大距, 西大距).
 */
export type PlanetEventKind = 'opposition' | 'conjunction' | 'inferior' | 'superior' | 'east' | 'west'
export interface PlanetEvent {
  key: PlanetKey
  kind: PlanetEventKind
  time: Date
  /** For an elongation: how far from the Sun, degrees */
  elongation?: number
}

/** Every planet's events between two instants, in time order */
export function planetEvents(from: Date, to: Date): PlanetEvent[] {
  const out: PlanetEvent[] = []
  const end = to.getTime()
  const each = (find: (t: A.AstroTime) => { time: A.AstroTime; extra?: Partial<PlanetEvent> } | null, make: (time: Date, extra?: Partial<PlanetEvent>) => PlanetEvent) => {
    let t = A.MakeTime(from)
    for (let i = 0; i < 40; i++) {
      const found = find(t)
      if (!found || found.time.date.getTime() > end) break
      out.push(make(found.time.date, found.extra))
      t = found.time.AddDays(1)
    }
  }
  for (const { key, body } of PLANETS) {
    if (key === 'earth') continue
    const inner = key === 'mercury' || key === 'venus'
    const relative = (angle: number) => (t: A.AstroTime) => ({ time: A.SearchRelativeLongitude(body, angle, t) })
    // Relative longitude (the planet's heliocentric longitude less Earth's): 0 lines it up with Earth on
    // the same side of the Sun (an inner planet's inferior conjunction, an outer one's opposition), 180
    // puts it beyond the Sun
    each(relative(0), (time) => ({ key, kind: inner ? 'inferior' : 'opposition', time }))
    each(relative(180), (time) => ({ key, kind: inner ? 'superior' : 'conjunction', time }))
    if (inner)
      each(
        (t) => {
          const e = A.SearchMaxElongation(body, t)
          return { time: e.time, extra: { kind: e.visibility === 'evening' ? 'east' : 'west', elongation: e.elongation } }
        },
        (time, extra) => ({ key, kind: extra!.kind!, time, elongation: extra!.elongation }),
      )
  }
  return out.sort((a, b) => a.time.getTime() - b.time.getTime())
}

/** Light travel time for a distance in AU, e.g. 8.3 分钟, 4.1 小时 (8.3 min, 4.1 h in English) */
export function lightTime(au: number, lang: string = 'zh'): string {
  const minutes = (au * 149597870.7) / 299792.458 / 60
  if (lang === 'en') return minutes < 60 ? `${minutes.toFixed(1)} min` : `${(minutes / 60).toFixed(1)} h`
  return minutes < 60 ? `${minutes.toFixed(1)} 分钟` : `${(minutes / 60).toFixed(1)} 小时`
}
