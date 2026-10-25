// 此刻天空: where the Sun, Moon, planets and bright stars stand in the sky
// above a place at a moment, as azimuth / altitude, from astronomy-engine.
// Stars come from brightStars.ts (J2000) and are carried to the date
// (precession, nutation) by the same EQJ→HOR rotation; refraction is included.
// Only the 星盘 tab imports this module.
import * as A from 'astronomy-engine'
import { BODY_INFO, type BodyKey } from './astrology'
import { BRIGHT_STARS, STAR_FIELDS } from './brightStars'
import { MANSIONS, mansionWidth } from './mansions'

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
  /** The Moon's phase, as degrees of its ecliptic longitude past the Sun's: 0 new, 90 first quarter, 180 full, 270 last quarter */
  phase?: number
  /** Right ascension, degrees, J2000 (which 二十八宿 it is in) */
  ra: number
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

/* ---------- Turning J2000 directions into the local sky, fast ---------- */

/** A J2000 RA / Dec (degrees) as a unit vector, as astronomy-engine's VectorFromSphere makes it */
function unitVector(ra: number, dec: number, out: Float64Array, at: number) {
  const radlat = dec * A.DEG2RAD
  const radlon = ra * A.DEG2RAD
  const rcoslat = Math.cos(radlat)
  out[at] = rcoslat * Math.cos(radlon)
  out[at + 1] = rcoslat * Math.sin(radlon)
  out[at + 2] = Math.sin(radlat)
}

/** The bright stars' unit vectors, worked out once: three numbers a star, in catalogue order */
let starVectors: Float64Array | null = null
function brightStarVectors() {
  if (starVectors) return starVectors
  const count = BRIGHT_STARS.length / STAR_FIELDS
  starVectors = new Float64Array(count * 3)
  for (let s = 0; s < count; s++) unitVector(BRIGHT_STARS[s * STAR_FIELDS + 1], BRIGHT_STARS[s * STAR_FIELDS + 2], starVectors, s * 3)
  return starVectors
}

/** A figure line's points ([RA, Dec, …]) as unit vectors, worked out once a line */
const lineVectors = new WeakMap<readonly number[], Float64Array>()
function vectorsOf(line: readonly number[]) {
  let v = lineVectors.get(line)
  if (!v) {
    v = new Float64Array((line.length / 2) * 3)
    for (let i = 0; i < line.length; i += 2) unitVector(line[i], line[i + 1], v, (i / 2) * 3)
    lineVectors.set(line, v)
  }
  return v
}

/**
 * The J2000 → horizon rotation for a moment and place. The map's layers (stars, figures, 二十八宿,
 * Milky Way) all ask for the same one when the sky is redrawn, so the last one is kept.
 */
let lastRotation: { key: string; time: A.AstroTime; rot: number[][] } | null = null
function rotationFor(utc: Date, latitude: number, longitude: number) {
  const key = `${utc.getTime()} ${latitude} ${longitude}`
  if (lastRotation?.key !== key) {
    const time = A.MakeTime(utc)
    lastRotation = { key, time, rot: A.Rotation_EQJ_HOR(time, new A.Observer(latitude, longitude, 0)).rot }
  }
  return lastRotation
}

/** A J2000 unit vector → azimuth / altitude, refraction included (RotateVector + HorizonFromVector) */
function toHorizonOf({ time, rot: r }: { time: A.AstroTime; rot: number[][] }) {
  return (x: number, y: number, z: number) => {
    const hor = A.HorizonFromVector(
      new A.Vector(r[0][0] * x + r[1][0] * y + r[2][0] * z, r[0][1] * x + r[1][1] * y + r[2][1] * z, r[0][2] * x + r[1][2] * y + r[2][2] * z, time),
      'normal',
    )
    return { az: hor.lon, alt: hor.lat }
  }
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
      ...(key === 'moon' && { phase: A.MoonPhase(time) }),
      ra: A.Equator(body, time, observer, false, true).ra * 15,
    }
  })

  const toHorizon = toHorizonOf(rotationFor(utc, latitude, longitude))
  const vectors = brightStarVectors()
  const stars: SkyStar[] = []
  for (let i = 0, s = 0; i < BRIGHT_STARS.length; i += STAR_FIELDS, s += 3) {
    const { az, alt } = toHorizon(vectors[s], vectors[s + 1], vectors[s + 2])
    if (alt < 0 !== below) continue
    const hip = BRIGHT_STARS[i]
    stars.push({ hip, name: STAR_NAMES[hip], az, alt, mag: BRIGHT_STARS[i + 3], bv: BRIGHT_STARS[i + 4] })
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
  const toHorizon = toHorizonOf(rotationFor(utc, latitude, longitude))
  const v = new Float64Array(3)
  return (ra: number, dec: number) => {
    unitVector(ra, dec, v, 0)
    return toHorizon(v[0], v[1], v[2])
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
  const toHorizon = toHorizonOf(rotationFor(utc, latitude, longitude))
  const labelOf = horizonOf(utc, latitude, longitude)
  const out: ConstellationView[] = []
  for (const c of set) {
    const lines = c.lines.map((line) => {
      const v = vectorsOf(line)
      const pts: { az: number; alt: number }[] = []
      for (let i = 0; i < v.length; i += 3) pts.push(toHorizon(v[i], v[i + 1], v[i + 2]))
      return pts
    })
    if (!lines.some((l) => l.some((p) => (below ? p.alt < 0 : p.alt > 0)))) continue
    out.push({ id: c.id, name: c.name, trad: c.trad, en: c.en, rank: c.rank, label: labelOf(...c.label), lines })
  }
  return out
}

/**
 * 二十八宿 on the sky at a moment and place: each mansion's boundary, the hour circle through its
 * 距星, drawn as on old Chinese star maps from the circle of always-visible stars (内规, declination
 * 90° − latitude) to its mirror in the south (外规); the celestial equator they divide; and the
 * middle of each mansion on the equator, where its name goes.
 */
export function mansionsAt(utc: Date, latitude: number, longitude: number) {
  const toHorizon = horizonOf(utc, latitude, longitude)
  const reach = Math.max(30, 90 - Math.abs(latitude))
  const bounds = MANSIONS.map((x) => {
    const pts: { az: number; alt: number }[] = []
    for (let dec = -reach; dec <= reach + 0.01; dec += 2.5) pts.push(toHorizon(x.ra, dec))
    return pts
  })
  const equator: { az: number; alt: number }[] = []
  for (let ra = 0; ra <= 360; ra += 2.5) equator.push(toHorizon(ra, 0))
  const middles = MANSIONS.map((x, i) => toHorizon(x.ra + mansionWidth(i) / 2, 0))
  return { bounds, equator, middles }
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
  const at = starPlace(what.hip)
  if (!at) return []
  return times.map((utc) => horizonOf(utc, latitude, longitude)(at.ra, at.dec))
}

/** A bright star's J2000 right ascension and declination (degrees), from the catalogue */
export function starPlace(hip: number) {
  let i = 0
  while (i < BRIGHT_STARS.length && BRIGHT_STARS[i] !== hip) i += STAR_FIELDS
  return i < BRIGHT_STARS.length ? { ra: BRIGHT_STARS[i + 1], dec: BRIGHT_STARS[i + 2] } : null
}

/**
 * When a body or bright star rises and sets about a moment, within a day either way (astronomy-
 * engine's SearchRiseSet: the top of the Sun's or Moon's disc, refraction included): one up rose
 * before it and sets after, one down set before it and rises after. A star always up at this
 * latitude, or never, says so instead; a body that does not rise or set within the day has null.
 */
export function riseSet(what: { body: BodyKey } | { hip: number }, utc: Date, latitude: number, longitude: number, up: boolean) {
  const observer = new A.Observer(latitude, longitude, 0)
  let body: A.Body
  if ('body' in what) {
    const found = SKY_BODIES.find(([k]) => k === what.body)
    if (!found) return null
    body = found[1]
  } else {
    const at = starPlace(what.hip)
    if (!at) return null
    // Circumpolar: always above the horizon, or never
    if (latitude >= 0 ? at.dec > 90 - latitude : at.dec < -90 - latitude) return { always: 'up' as const }
    if (latitude >= 0 ? at.dec < latitude - 90 : at.dec > 90 + latitude) return { always: 'down' as const }
    A.DefineStar(A.Body.Star1, at.ra / 15, at.dec, 1000)
    body = A.Body.Star1
  }
  const start = A.MakeTime(utc)
  const rise = A.SearchRiseSet(body, observer, +1, start, up ? -1 : 1)?.date ?? null
  const set = A.SearchRiseSet(body, observer, -1, start, up ? 1 : -1)?.date ?? null
  return { rise, set }
}

/** How far a body is from the Earth's centre at a moment, in astronomical units */
export function distanceOf(key: BodyKey, utc: Date) {
  const body = SKY_BODIES.find(([k]) => k === key)?.[1]
  return body === undefined ? null : A.GeoVector(body, A.MakeTime(utc), true).Length()
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
  const r = rotationFor(utc, latitude, longitude).rot
  const place = <T extends MilkyWayPoint>({ v: [x, y, z], ...rest }: T) => {
    const hx = r[0][0] * x + r[1][0] * y + r[2][0] * z
    const hy = r[0][1] * x + r[1][1] * y + r[2][1] * z
    const hz = r[0][2] * x + r[1][2] * y + r[2][2] * z
    return { ...rest, az: (360 - ((Math.atan2(hy, hx) / RAD + 360) % 360)) % 360, alt: Math.atan2(hz, Math.hypot(hx, hy)) / RAD }
  }
  const m = milkyWayModel()
  // The grain is some 1,700 points: worked through as plain numbers rather than an object each
  const g = grainVectors()
  const count = m.grain.length
  const az = new Float64Array(count)
  const alt = new Float64Array(count)
  for (let i = 0, j = 0; i < count; i++, j += 3) {
    const x = g[j]
    const y = g[j + 1]
    const z = g[j + 2]
    const hx = r[0][0] * x + r[1][0] * y + r[2][0] * z
    const hy = r[0][1] * x + r[1][1] * y + r[2][1] * z
    const hz = r[0][2] * x + r[1][2] * y + r[2][2] * z
    az[i] = (360 - ((Math.atan2(hy, hx) / RAD + 360) % 360)) % 360
    alt[i] = Math.atan2(hz, Math.sqrt(hx * hx + hy * hy)) / RAD
  }
  return {
    grain: { az, alt, weight: grainWeights() },
    glow: m.glow.map(place),
    dust: m.dust.map(place),
    spine: m.spine.map(place),
    rift: m.rift.map(place),
  }
}

/** The grain's unit vectors and brightness levels, laid out flat once */
let grainFlat: { v: Float64Array; weight: Uint8Array } | null = null
function grainLayout() {
  if (!grainFlat) {
    const grain = milkyWayModel().grain
    const v = new Float64Array(grain.length * 3)
    grain.forEach((p, i) => v.set(p.v, i * 3))
    grainFlat = { v, weight: Uint8Array.from(grain, (p) => p.weight) }
  }
  return grainFlat
}
const grainVectors = () => grainLayout().v
const grainWeights = () => grainLayout().weight

/* ---------- The 天象 page's canvas: the Milky Way's star clouds and the faint stars ---------- */

/** Smooth value noise, 0–1, on a grid of `cell` degrees over galactic longitude (wrapping) and latitude */
function valueNoise(l: number, b: number, cell: number, seed: number) {
  const cols = Math.round(360 / cell)
  const x = l / cell
  const y = (b + 90) / cell
  const [i, j] = [Math.floor(x), Math.floor(y)]
  const [fx, fy] = [x - i, y - j]
  const hash = (u: number, v: number) => {
    let h = Math.imul((((u % cols) + cols) % cols) + 1, 0x27d4eb2d) ^ Math.imul(v + 1, 0x165667b1) ^ Math.imul(seed, 0x9e3779b9)
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
    return ((h ^ (h >>> 13)) >>> 0) / 4294967296
  }
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const top = hash(i, j) + (hash(i + 1, j) - hash(i, j)) * sx
  const bottom = hash(i, j + 1) + (hash(i + 1, j + 1) - hash(i, j + 1)) * sx
  return top + (bottom - top) * sy
}

export interface MilkyWayCloud {
  /** Its points, brightest first: J2000 unit vectors, brightness 0–1, and whether towards the bulge */
  v: Float64Array
  weight: Float32Array
  warm: Uint8Array
  /** How many points, from the first, are bright enough (0.5 and over) to show singly at the full view */
  bright: number
  /** The points gathered in cells 1.5° across, to draw their light at the full view in far fewer
   *  strokes: each cell's direction (its points' mean), its light (the sum of theirs) and warmth */
  cells: { v: Float64Array; light: Float32Array; warm: Uint8Array }
}
/** How much light one point of the star clouds gives, by its brightness */
export const cloudLight = (weight: number) => 0.017 * (1 + Math.min(3, Math.floor(weight * 4)))
/** The size of a cell of the star clouds, in degrees */
export const CLOUD_CELL = 1.5

let cloud: MilkyWayCloud | null = null

/**
 * The Milky Way as the eye half sees it on a dark night: a mist of countless faint stars, drawn as
 * many points (made once). They follow the same band, brightness and dust as milkyWayModel, and
 * are thinned further by noise at a few degrees and less, so the band comes out mottled with star
 * clouds and dark lanes rather than as a smooth glow.
 */
export function milkyWayCloud(count = 24000): MilkyWayCloud {
  if (cloud) return cloud
  const rand = seeded(2203)
  const points: { l: number; b: number; weight: number }[] = []
  // Most tries are thrown away: the band's light and width, by half degrees of longitude, looked up
  const light = Float32Array.from({ length: 720 }, (_, i) => bandBrightness(i / 2) / 1.6)
  const spread = Float32Array.from({ length: 720 }, (_, i) => bandSpread(i / 2) * 0.8)
  while (points.length < count) {
    const step = Math.floor(rand() * 720)
    const l = step / 2 + rand() / 2
    const b = gaussian(rand) * spread[step]
    // Kept by the band's light and dust first, the cheaper test, and then by the mottle
    const lit = light[step] * dustAt(l, b)
    if (rand() >= lit) continue
    const mottle = 0.5 * valueNoise(l, b, 6, 1) + 0.3 * valueNoise(l, b, 2.5, 2) + 0.2 * valueNoise(l, b, 1, 3)
    const clump = Math.max(0, mottle * 1.6 - 0.45)
    if (rand() >= clump) continue
    points.push({ l, b, weight: Math.min(1, 0.25 + 0.75 * lit * clump) })
  }
  points.sort((p, q) => q.weight - p.weight)
  const v = new Float64Array(count * 3)
  const weight = new Float32Array(count)
  const warm = new Uint8Array(count)
  const cells = new Map<number, { x: number; y: number; z: number; light: number; warm: number }>()
  points.forEach((p, n) => {
    const [ra, dec] = galacticToEquatorial(p.l, p.b)
    unitVector(ra, dec, v, n * 3)
    weight[n] = p.weight
    warm[n] = apart(p.l, 0) < 40 ? 1 : 0
    const key = Math.floor(p.l / CLOUD_CELL) * 1000 + Math.floor((p.b + 90) / CLOUD_CELL)
    const cell = cells.get(key) ?? { x: 0, y: 0, z: 0, light: 0, warm: warm[n] }
    cell.x += v[n * 3]
    cell.y += v[n * 3 + 1]
    cell.z += v[n * 3 + 2]
    cell.light += cloudLight(p.weight)
    cells.set(key, cell)
  })
  const list = [...cells.values()]
  const cellV = new Float64Array(list.length * 3)
  list.forEach((c, i) => {
    const r = Math.hypot(c.x, c.y, c.z)
    cellV.set([c.x / r, c.y / r, c.z / r], i * 3)
  })
  cloud = {
    v,
    weight,
    warm,
    bright: points.findIndex((p) => p.weight < 0.5),
    cells: { v: cellV, light: Float32Array.from(list, (c) => c.light), warm: Uint8Array.from(list, (c) => c.warm) },
  }
  return cloud
}

let field: { v: Float64Array; weight: Float32Array } | null = null

/**
 * Stars fainter than the catalogue goes (beyond magnitude 6), scattered evenly over the sky (made
 * once): too faint to see at the full view, they come out as the map is zoomed in, as more stars
 * do through binoculars. Each has a brightness, 0–1, most of them faint.
 */
export function fieldStars(count = 9000) {
  if (field) return field
  const rand = seeded(6151)
  const v = new Float64Array(count * 3)
  const weight = new Float32Array(count)
  for (let n = 0; n < count; n++) {
    const ra = rand() * 360
    const dec = Math.asin(2 * rand() - 1) / RAD
    unitVector(ra, dec, v, n * 3)
    weight[n] = rand() ** 2
  }
  field = { v, weight }
  return field
}

/** A list of stars in the catalogue's row layout ([hip, RA, Dec, mag, B−V]…) as unit vectors, once a list */
const listVectors = new WeakMap<readonly number[], Float64Array>()
export function vectorsOfStars(rows: readonly number[]) {
  let v = listVectors.get(rows)
  if (!v) {
    const count = rows.length / STAR_FIELDS
    v = new Float64Array(count * 3)
    for (let s = 0; s < count; s++) unitVector(rows[s * STAR_FIELDS + 1], rows[s * STAR_FIELDS + 2], v, s * 3)
    listVectors.set(rows, v)
  }
  return v
}

/** Unit vectors (J2000; the first `count`, or all) → azimuth and altitude at a moment and place,
 *  without refraction (for faint points) */
export function directionsAt(vectors: Float64Array, utc: Date, latitude: number, longitude: number, count = vectors.length / 3) {
  const r = rotationFor(utc, latitude, longitude).rot
  const az = new Float32Array(count)
  const alt = new Float32Array(count)
  for (let i = 0, j = 0; i < count; i++, j += 3) {
    const x = vectors[j]
    const y = vectors[j + 1]
    const z = vectors[j + 2]
    const hx = r[0][0] * x + r[1][0] * y + r[2][0] * z
    const hy = r[0][1] * x + r[1][1] * y + r[2][1] * z
    const hz = r[0][2] * x + r[1][2] * y + r[2][2] * z
    az[i] = (360 - ((Math.atan2(hy, hx) / RAD + 360) % 360)) % 360
    alt[i] = Math.atan2(hz, Math.sqrt(hx * hx + hy * hy)) / RAD
  }
  return { az, alt }
}

/** The Moon's phase by name, from its phase angle (degrees past the Sun: 0 new, 180 full) */
export function moonPhaseName(phase: number): string {
  const p = ((phase % 360) + 360) % 360
  if (p < 10 || p >= 350) return '新月'
  if (p < 80) return '蛾眉月'
  if (p < 100) return '上弦月'
  if (p < 170) return '盈凸月'
  if (p < 190) return '满月'
  if (p < 260) return '亏凸月'
  if (p < 280) return '下弦月'
  return '残月'
}

/**
 * The lit part of a disc of radius r, centred on 0,0, with the Sun towards +x: the limb's half on
 * the Sun's side, closed by the terminator, a half-ellipse across the disc (to the far side when
 * more than half is lit). lit is the lit fraction, 0 (new) to 1 (full).
 */
export function litPart(lit: number, r: number): string {
  const across = Math.abs(2 * lit - 1) * r
  return `M0 ${-r}A${r} ${r} 0 0 1 0 ${r}A${across.toFixed(2)} ${r} 0 0 ${lit > 0.5 ? 1 : 0} 0 ${-r}Z`
}

/** A point a little way along the great circle from one place in the sky towards another (to aim the Moon's lit side at the Sun) */
export function towards(from: { az: number; alt: number }, to: { az: number; alt: number }, degrees = 0.5) {
  const v = (p: { az: number; alt: number }) => {
    const [a, h] = [p.az * RAD, p.alt * RAD]
    return [Math.cos(h) * Math.cos(a), Math.cos(h) * Math.sin(a), Math.sin(h)]
  }
  const [a, b] = [v(from), v(to)]
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const t = b.map((x, i) => x - dot * a[i])
  const len = Math.hypot(...t) || 1
  const [c, s] = [Math.cos(degrees * RAD), Math.sin(degrees * RAD)]
  const p = a.map((x, i) => x * c + (t[i] / len) * s)
  return { az: ((Math.atan2(p[1], p[0]) / RAD) + 360) % 360, alt: Math.asin(Math.max(-1, Math.min(1, p[2]))) / RAD }
}

const COMPASS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
const COMPASS_EN = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

/** 方位 in words and degrees, e.g. 东南 135° (or SE 135° in English) */
export function formatAzimuth(az: number, lang: 'zh' | 'en' = 'zh'): string {
  return `${(lang === 'en' ? COMPASS_EN : COMPASS)[Math.round(az / 45) % 8]} ${Math.round(az)}°`
}
