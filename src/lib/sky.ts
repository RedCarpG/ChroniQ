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

/**
 * The way any one body on the map, or a bright star by its Hipparcos number, goes across the
 * sky over the given moments (for the one picked out on the map; tracksAt does the usual bodies).
 */
export function trackOf(what: { body: BodyKey } | { hip: number }, times: Date[], latitude: number, longitude: number) {
  const observer = new A.Observer(latitude, longitude, 0)
  if ('body' in what) {
    const body = SKY_BODIES.find(([k]) => k === what.body)?.[1]
    if (body === undefined) return []
    return times.map((utc) => {
      const time = A.MakeTime(utc)
      const eq = A.Equator(body, time, observer, true, true)
      const hor = A.Horizon(time, observer, eq.ra, eq.dec, 'normal')
      return { az: hor.azimuth, alt: hor.altitude }
    })
  }
  let i = 0
  while (i < BRIGHT_STARS.length && BRIGHT_STARS[i] !== what.hip) i += STAR_FIELDS
  if (i >= BRIGHT_STARS.length) return []
  const [ra, dec] = [BRIGHT_STARS[i + 1], BRIGHT_STARS[i + 2]]
  return times.map((utc) => horizonOf(utc, latitude, longitude)(ra, dec))
}

// The galactic frame: the north galactic pole and the galactic longitude of the north celestial pole (J2000)
const NGP_RA = 192.85948
const NGP_DEC = 27.12825
const NCP_L = 122.93192
const RAD = Math.PI / 180

/** Galactic longitude and latitude (degrees) → J2000 RA / Dec (degrees) */
export function galacticToEquatorial(l: number, b: number): [number, number] {
  const [sb, cb] = [Math.sin(b * RAD), Math.cos(b * RAD)]
  const [sd, cd] = [Math.sin(NGP_DEC * RAD), Math.cos(NGP_DEC * RAD)]
  const dl = (NCP_L - l) * RAD
  const dec = Math.asin(sb * sd + cb * cd * Math.cos(dl))
  const ra = NGP_RA * RAD + Math.atan2(cb * Math.sin(dl), sb * cd - cb * sd * Math.cos(dl))
  return [((ra / RAD) % 360 + 360) % 360, dec / RAD]
}

/** A small seeded random generator (mulberry32): the same Milky Way every time */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}
/** Roughly normal, mean 0, spread 1 */
const gaussian = (rand: () => number) => (rand() + rand() + rand() + rand() + rand() + rand() - 3) * 1.41
/** Degrees between two galactic longitudes */
const apart = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)
const bump = (l: number, at: number, width: number) => Math.exp(-((apart(l, at) / width) ** 2))

/** How bright the Milky Way is along its length: most towards the centre (Sagittarius), with Cygnus, Carina and Norma */
const bandBrightness = (l: number) =>
  0.2 + 0.8 * ((Math.cos(l * RAD) + 1) / 2) ** 1.8 + 0.45 * bump(l, 78, 14) + 0.35 * bump(l, 287, 16) + 0.25 * bump(l, 330, 14)
/** How far it spreads from the plane (degrees): thickest in the central bulge */
const bandSpread = (l: number) => 2.6 + 6.5 * ((Math.cos(l * RAD) + 1) / 2) ** 2.5
/** Its dust: the Great Rift (Cygnus to Sagittarius, just north of the plane), the Coalsack, a lane through the centre */
function dustAt(l: number, b: number) {
  let clear = 1
  if (l > 6 && l < 86 && Math.abs(b - 1.8) < 2.4) clear *= 0.15 + 0.85 * (Math.abs(b - 1.8) / 2.4) ** 2
  if (apart(l, 303) < 4 && Math.abs(b + 0.5) < 3) clear *= 0.2
  if (apart(l, 0) < 22 && Math.abs(b) < 0.9) clear *= 0.45
  return clear
}

interface MilkyWayPoint {
  /** J2000 unit vector */
  v: [number, number, number]
  l: number
  b: number
  /** grain: brightness level 0–2; glow: opacity */
  weight: number
  /** glow and dust: radius in degrees */
  size?: number
}
let model: {
  grain: MilkyWayPoint[]
  glow: MilkyWayPoint[]
  dust: MilkyWayPoint[]
  spine: MilkyWayPoint[]
  rift: MilkyWayPoint[]
} | null = null

/**
 * The Milky Way as a scatter of faint points about the galactic plane, made once: fine grain (as
 * many tiny stars), larger soft patches for its glow, and dark patches for its dust. Points are
 * drawn where the band is bright and wide, thinned where faint drifting waves make gaps and where
 * the dust lies, so it comes out patchy, with star clouds and lanes, as it looks.
 */
export function milkyWayModel() {
  if (model) return model
  const rand = seeded(1938)
  const phase = [rand(), rand(), rand(), rand()].map((x) => x * Math.PI * 2)
  // Slow waves along and across the band: star clouds and gaps
  const clumps = (l: number, b: number) =>
    0.5 +
    0.5 * (0.45 * Math.sin(l * 0.105 + phase[0]) + 0.3 * Math.sin(l * 0.29 + b * 0.35 + phase[1]) + 0.25 * Math.sin(l * 0.71 - b * 0.8 + phase[2]))
  const vector = (l: number, b: number): [number, number, number] => {
    const [ra, dec] = galacticToEquatorial(l, b)
    const cd = Math.cos(dec * RAD)
    return [cd * Math.cos(ra * RAD), cd * Math.sin(ra * RAD), Math.sin(dec * RAD)]
  }
  const sample = (count: number, widen: number, keep: (l: number, b: number) => number) => {
    const out: { l: number; b: number; p: number }[] = []
    while (out.length < count) {
      const l = rand() * 360
      const b = gaussian(rand) * bandSpread(l) * widen
      const p = keep(l, b)
      if (rand() < p) out.push({ l, b, p })
    }
    return out
  }
  const peak = 1.6
  const grain = sample(1700, 1, (l, b) => (bandBrightness(l) / peak) * (0.3 + 0.7 * clumps(l, b)) * dustAt(l, b)).map(({ l, b }) => ({
    v: vector(l, b),
    l,
    b,
    weight: Math.min(2, Math.floor(bandBrightness(l) * (0.4 + clumps(l, b)) * 1.6)),
  }))
  const glow = sample(130, 1.15, (l, b) => (bandBrightness(l) / peak) * (0.45 + 0.55 * clumps(l, b))).map(({ l, b }) => ({
    v: vector(l, b),
    l,
    b,
    weight: 0.09 + 0.17 * Math.min(1, bandBrightness(l) / 1.1) * dustAt(l, b),
    size: 4 + rand() * 3.5 + bandSpread(l) * 0.5,
  }))
  const dust: MilkyWayPoint[] = []
  for (let l = 10; l <= 82; l += 4.5) dust.push({ v: vector(l, 1.8 + (rand() - 0.5) * 1.2), l, b: 1.8, weight: 0.45, size: 2.2 + rand() * 1.4 })
  dust.push({ v: vector(303, -0.5), l: 303, b: -0.5, weight: 0.5, size: 3 })
  // The band itself, drawn as one continuous stroke: its centre line every 1.5° of galactic
  // longitude, with its brightness (weight) and half-width in degrees (size), the line wandering a
  // little off the plane as the real one does; and the Great Rift's dark lane, Cygnus to Sagittarius
  const spine: MilkyWayPoint[] = []
  for (let l = 0; l < 360; l += 1.5) {
    const b = 0.6 * Math.sin(l * 0.05 + phase[3]) * (1 - ((Math.cos(l * RAD) + 1) / 2) ** 2)
    spine.push({ v: vector(l, b), l, b, weight: bandBrightness(l) * (0.75 + 0.5 * clumps(l, b)), size: bandSpread(l) })
  }
  const rift: MilkyWayPoint[] = []
  for (let l = 4; l <= 88; l += 1.5) {
    const depth = Math.min(1, Math.min(l - 4, 88 - l) / 14) * (0.7 + 0.3 * Math.sin(l * 0.4 + phase[1]))
    rift.push({ v: vector(l, 1.6 + 0.5 * Math.sin(l * 0.23 + phase[2])), l, b: 1.6, weight: depth, size: 1.3 + 0.9 * depth })
  }
  model = { grain, glow, dust, spine, rift }
  return model
}

/**
 * The Milky Way as it stands in the sky at a moment and place: its points' azimuths and altitudes,
 * by one rotation applied to every point (as astronomy-engine's RotateVector and HorizonFromVector,
 * without refraction, which a soft glow does not need).
 */
export function milkyWayAt(utc: Date, latitude: number, longitude: number) {
  const r = A.Rotation_EQJ_HOR(A.MakeTime(utc), new A.Observer(latitude, longitude, 0)).rot
  const place = <T extends MilkyWayPoint>({ v: [x, y, z], ...rest }: T) => {
    const hx = r[0][0] * x + r[1][0] * y + r[2][0] * z
    const hy = r[0][1] * x + r[1][1] * y + r[2][1] * z
    const hz = r[0][2] * x + r[1][2] * y + r[2][2] * z
    return { ...rest, az: (360 - ((Math.atan2(hy, hx) / RAD + 360) % 360)) % 360, alt: Math.atan2(hz, Math.hypot(hx, hy)) / RAD }
  }
  const m = milkyWayModel()
  return {
    grain: m.grain.map(place),
    glow: m.glow.map(place),
    dust: m.dust.map(place),
    spine: m.spine.map(place),
    rift: m.rift.map(place),
  }
}

const COMPASS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
const COMPASS_EN = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

/** 方位 in words and degrees, e.g. 东南 135° (or SE 135° in English) */
export function formatAzimuth(az: number, lang: 'zh' | 'en' = 'zh'): string {
  return `${(lang === 'en' ? COMPASS_EN : COMPASS)[Math.round(az / 45) % 8]} ${Math.round(az)}°`
}
