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
  /** Heliocentric ecliptic longitude, 0–360 */
  lon: number
  /** Distance from the Sun, AU */
  sun: number
  /** Distance from Earth, AU (0 for Earth) */
  earth: number
  /** Seen from Earth, moving backwards along the ecliptic */
  retrograde: boolean
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
      lon: norm((Math.atan2(y, x) * 180) / Math.PI),
      sun: Math.hypot(x, y, z),
      earth: key === 'earth' ? 0 : Math.hypot(x - ex, y - ey, z - ez),
      retrograde: key !== 'earth' && norm(geoLon(body, after) - geoLon(body, before) + 180) - 180 < 0,
    }
  })
}

/** One orbit of each planet, sampled from the given moment: [x, y] points in AU. */
export function orbits(utc: Date, samples = 180): Record<PlanetKey, [number, number][]> {
  const out = {} as Record<PlanetKey, [number, number][]>
  for (const { key, body, period } of PLANETS) {
    out[key] = Array.from({ length: samples }, (_, i) => {
      const [x, y] = helio(body, A.MakeTime(new Date(utc.getTime() + (i / samples) * period * DAY)))
      return [x, y] as [number, number]
    })
  }
  return out
}

/** Light travel time for a distance in AU, e.g. 8.3 分钟, 4.1 小时 (8.3 min, 4.1 h in English) */
export function lightTime(au: number, lang: 'zh' | 'en' = 'zh'): string {
  const minutes = (au * 149597870.7) / 299792.458 / 60
  if (lang === 'en') return minutes < 60 ? `${minutes.toFixed(1)} min` : `${(minutes / 60).toFixed(1)} h`
  return minutes < 60 ? `${minutes.toFixed(1)} 分钟` : `${(minutes / 60).toFixed(1)} 小时`
}
