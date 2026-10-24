// 此刻天空: where the Sun, Moon, planets and bright stars stand in the sky
// above a place at a moment, as azimuth / altitude, from astronomy-engine.
// Stars come from brightStars.ts (J2000) and are carried to the date
// (precession, nutation) by the same EQJ→HOR rotation; refraction is included.
// Only the 星盘 tab imports this module.
import * as A from 'astronomy-engine'
import { BODY_INFO, type BodyKey } from './astrology'
import { BRIGHT_STARS, STAR_FIELDS } from './brightStars'

export interface SkyBody {
  key: BodyKey
  name: string
  glyph: string
  /** Azimuth, degrees from north through east, 0–360 */
  az: number
  /** Altitude above the horizon, degrees (refraction included) */
  alt: number
  /** Apparent magnitude */
  mag: number
  /** Lit fraction of the disc, 0–1 (the Moon's phase) */
  lit: number
}

export interface SkyStar {
  hip: number
  /** Common Chinese name, for the brightest few */
  name?: string
  az: number
  alt: number
  mag: number
  /** B−V colour index (blue < 0.3 < white … red > 1.4) */
  bv: number
}

export interface Sky {
  bodies: SkyBody[]
  /** Stars above the horizon */
  stars: SkyStar[]
  /** The Sun's altitude, which says how dark the sky is */
  sunAlt: number
  light: 'day' | 'twilight' | 'night'
}

// The bodies on the map: everything in the 星盘 but Pluto (far too faint to see)
// and the lunar nodes (points, not bodies).
const SKY_BODIES: [BodyKey, A.Body][] = [
  ['sun', A.Body.Sun],
  ['moon', A.Body.Moon],
  ['mercury', A.Body.Mercury],
  ['venus', A.Body.Venus],
  ['mars', A.Body.Mars],
  ['jupiter', A.Body.Jupiter],
  ['saturn', A.Body.Saturn],
  ['uranus', A.Body.Uranus],
  ['neptune', A.Body.Neptune],
]

/** Common Chinese names of the brightest stars, by Hipparcos number */
export const STAR_NAMES: Record<number, string> = {
  32349: '天狼星',
  30438: '老人星',
  71683: '南门二',
  69673: '大角星',
  91262: '织女星',
  24608: '五车二',
  24436: '参宿七',
  37279: '南河三',
  7588: '水委一',
  27989: '参宿四',
  68702: '马腹一',
  97649: '牛郎星',
  60718: '十字架二',
  21421: '毕宿五',
  80763: '心宿二',
  65474: '角宿一',
  37826: '北河三',
  113368: '北落师门',
  102098: '天津四',
  62434: '十字架三',
  49669: '轩辕十四',
  11767: '北极星',
  36850: '北河二',
  54061: '天枢',
  67301: '摇光',
}

/** below: list the stars under the horizon instead (the half of the sky beneath one's feet) */
export function skyAt(utc: Date, latitude: number, longitude: number, below = false): Sky {
  const time = A.MakeTime(utc)
  const observer = new A.Observer(latitude, longitude, 0)

  const bodies = SKY_BODIES.map(([key, body]): SkyBody => {
    const eq = A.Equator(body, time, observer, true, true)
    const hor = A.Horizon(time, observer, eq.ra, eq.dec, 'normal')
    const illum = A.Illumination(body, time)
    return {
      key,
      ...BODY_INFO[key],
      az: hor.azimuth,
      alt: hor.altitude,
      mag: illum.mag,
      lit: illum.phase_fraction,
    }
  })

  const toHorizon = A.Rotation_EQJ_HOR(time, observer)
  const stars: SkyStar[] = []
  for (let i = 0; i < BRIGHT_STARS.length; i += STAR_FIELDS) {
    const [hip, ra, dec, mag, bv] = BRIGHT_STARS.slice(i, i + STAR_FIELDS)
    const j2000 = A.VectorFromSphere(new A.Spherical(dec, ra, 1), time)
    const hor = A.HorizonFromVector(A.RotateVector(toHorizon, j2000), 'normal')
    if (hor.lat < 0 !== below) continue
    stars.push({ hip, name: STAR_NAMES[hip], az: hor.lon, alt: hor.lat, mag, bv })
  }

  const sunAlt = bodies[0].alt
  return { bodies, stars, sunAlt, light: sunAlt > -0.833 ? 'day' : sunAlt > -12 ? 'twilight' : 'night' }
}

/** A constellation figure (lib/constellations.ts, lib/xingguan.ts) */
export interface Constellation {
  id: string
  /** Chinese name, simplified */
  name: string
  /** The same in 繁體 (made with the project's OpenCC rules, as term() would) */
  trad: string
  /** English name (Western) or gloss (星官) */
  en: string
  /** 1 = best known … 3; decides which are labelled */
  rank: number
  /** Label point, [RA, Dec] in degrees, J2000 */
  label: [number, number]
  /** Stick figure: polylines of [RA, Dec, RA, Dec, …] in degrees, J2000 */
  lines: number[][]
}

export interface ConstellationView {
  id: string
  name: string
  trad: string
  en: string
  rank: number
  /** Label point on the sky (alt < 0: below the horizon) */
  label: { az: number; alt: number }
  /** Figure on the sky, kept whole (draw clipped at the horizon) */
  lines: { az: number; alt: number }[][]
}

/** J2000 RA / Dec (degrees) → azimuth / altitude at a moment and place, refraction included */
function horizonOf(utc: Date, latitude: number, longitude: number) {
  const time = A.MakeTime(utc)
  const rotation = A.Rotation_EQJ_HOR(time, new A.Observer(latitude, longitude, 0))
  return (ra: number, dec: number) => {
    const hor = A.HorizonFromVector(A.RotateVector(rotation, A.VectorFromSphere(new A.Spherical(dec, ra, 1), time)), 'normal')
    return { az: hor.lon, alt: hor.lat }
  }
}

/** Constellation figures as they stand in the sky; those wholly on the other side of the horizon are left out */
export function constellationsAt(
  set: Constellation[],
  utc: Date,
  latitude: number,
  longitude: number,
  /** keep the figures under the horizon instead */
  below = false,
): ConstellationView[] {
  const toHorizon = horizonOf(utc, latitude, longitude)
  const out: ConstellationView[] = []
  for (const c of set) {
    const lines = c.lines.map((line) => {
      const pts: { az: number; alt: number }[] = []
      for (let i = 0; i < line.length; i += 2) pts.push(toHorizon(line[i], line[i + 1]))
      return pts
    })
    if (!lines.some((l) => l.some((p) => (below ? p.alt < 0 : p.alt > 0)))) continue
    out.push({ id: c.id, name: c.name, trad: c.trad, en: c.en, rank: c.rank, label: toHorizon(...c.label), lines })
  }
  return out
}

/**
 * A body's way among the stars over the `days` before `utc`: its J2000
 * position at evenly spaced moments, placed in the sky as it stands at `utc`
 * (so it lies among today's stars, and a planet's retrograde loop shows).
 * The last point is the body now.
 */
export function historyTrack(key: BodyKey, utc: Date, latitude: number, longitude: number, days: number, samples = 240) {
  const body = SKY_BODIES.find(([k]) => k === key)![1]
  const observer = new A.Observer(latitude, longitude, 0)
  const toHorizon = horizonOf(utc, latitude, longitude)
  const end = utc.getTime()
  const step = (days * 86400_000) / samples
  const points: { utc: Date; az: number; alt: number }[] = []
  for (let i = 0; i <= samples; i++) {
    const at = new Date(end - (samples - i) * step)
    const eq = A.Equator(body, A.MakeTime(at), observer, false, true)
    points.push({ utc: at, ...toHorizon(eq.ra * 15, eq.dec) })
  }
  return points
}

/** The bodies whose path across the sky is drawn: the Sun, the Moon and the planets seen by eye */
export const PATH_BODIES: BodyKey[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']

/**
 * Where each of PATH_BODIES stands (azimuth / altitude) at each of the given
 * moments, for drawing its path across the sky; altitudes below 0 are kept,
 * so a path can be drawn to the horizon and clipped there.
 */
export function tracksAt(times: Date[], latitude: number, longitude: number): Record<string, { az: number; alt: number }[]> {
  const observer = new A.Observer(latitude, longitude, 0)
  const bodies = SKY_BODIES.filter(([key]) => PATH_BODIES.includes(key))
  const out: Record<string, { az: number; alt: number }[]> = Object.fromEntries(bodies.map(([key]) => [key, []]))
  for (const utc of times) {
    const time = A.MakeTime(utc)
    for (const [key, body] of bodies) {
      const eq = A.Equator(body, time, observer, true, true)
      const hor = A.Horizon(time, observer, eq.ra, eq.dec, 'normal')
      out[key].push({ az: hor.azimuth, alt: hor.altitude })
    }
  }
  return out
}

const COMPASS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
const COMPASS_EN = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

/** 方位 in words and degrees, e.g. 东南 135° (or SE 135° in English) */
export function formatAzimuth(az: number, lang: 'zh' | 'en' = 'zh'): string {
  return `${(lang === 'en' ? COMPASS_EN : COMPASS)[Math.round(az / 45) % 8]} ${Math.round(az)}°`
}
