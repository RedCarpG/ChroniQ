// 西洋占星 natal chart (星盘). Planet positions come from astronomy-engine
// (MIT, about 1′ accuracy for these dates); houses, nodes and aspects are
// computed here. Tropical zodiac, geocentric, true ecliptic of date.
// Only the 星盘 tab imports this module.
import * as A from 'astronomy-engine'

const RAD = Math.PI / 180
const norm = (d: number) => ((d % 360) + 360) % 360
const sind = (d: number) => Math.sin(d * RAD)
const cosd = (d: number) => Math.cos(d * RAD)
const tand = (d: number) => Math.tan(d * RAD)
const atan2d = (y: number, x: number) => Math.atan2(y, x) / RAD

import type { StarPlace, StarSettings } from './starPrefs'

export type { StarPlace, StarSettings } from './starPrefs'

import { toUtc, zoneOffset } from './timeZone'

export { toUtc }

/* ---------- Bodies, signs, aspects ---------- */

export const SIGNS = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'] as const
/** Text-presentation zodiac glyphs (U+FE0E keeps them from turning into emoji). */
export const SIGN_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'].map((g) => g + '︎')
export type Element = 'fire' | 'earth' | 'air' | 'water'
export const SIGN_ELEMENT: Element[] = ['fire', 'earth', 'air', 'water', 'fire', 'earth', 'air', 'water', 'fire', 'earth', 'air', 'water']
export const ELEMENT_NAME: Record<Element, string> = { fire: '火象', earth: '土象', air: '风象', water: '水象' }

export type BodyKey =
  | 'sun'
  | 'moon'
  | 'mercury'
  | 'venus'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto'
  | 'node'
  | 'southNode'

export const BODY_INFO: Record<BodyKey, { name: string; glyph: string }> = {
  sun: { name: '太阳', glyph: '☉' },
  moon: { name: '月亮', glyph: '☽' },
  mercury: { name: '水星', glyph: '☿' },
  venus: { name: '金星', glyph: '♀' },
  mars: { name: '火星', glyph: '♂' },
  jupiter: { name: '木星', glyph: '♃' },
  saturn: { name: '土星', glyph: '♄' },
  uranus: { name: '天王星', glyph: '♅' },
  neptune: { name: '海王星', glyph: '♆' },
  pluto: { name: '冥王星', glyph: '♇' },
  node: { name: '北交点', glyph: '☊' },
  southNode: { name: '南交点', glyph: '☋' },
}
// Text presentation, so the symbols don't turn into colour emoji on some systems.
for (const info of Object.values(BODY_INFO)) info.glyph += '\uFE0E'

const PLANETS: [BodyKey, A.Body][] = [
  ['sun', A.Body.Sun],
  ['moon', A.Body.Moon],
  ['mercury', A.Body.Mercury],
  ['venus', A.Body.Venus],
  ['mars', A.Body.Mars],
  ['jupiter', A.Body.Jupiter],
  ['saturn', A.Body.Saturn],
  ['uranus', A.Body.Uranus],
  ['neptune', A.Body.Neptune],
  ['pluto', A.Body.Pluto],
]

export type AspectKey = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition'
export const ASPECTS: { key: AspectKey; name: string; glyph: string; angle: number; orb: number; tone: 'major' | 'soft' | 'hard' }[] = [
  { key: 'conjunction', name: '合', glyph: '☌\uFE0E', angle: 0, orb: 8, tone: 'major' },
  { key: 'sextile', name: '六合', glyph: '⚹\uFE0E', angle: 60, orb: 5, tone: 'soft' },
  { key: 'square', name: '刑', glyph: '□', angle: 90, orb: 7, tone: 'hard' },
  { key: 'trine', name: '拱', glyph: '△', angle: 120, orb: 7, tone: 'soft' },
  { key: 'opposition', name: '冲', glyph: '☍\uFE0E', angle: 180, orb: 8, tone: 'hard' },
]
/** Wider orbs when the Sun or Moon is involved */
const LUMINARY_BONUS = 2

export interface ChartPoint {
  key: BodyKey | 'asc' | 'mc'
  name: string
  glyph: string
  /** Ecliptic longitude, 0–360 */
  lon: number
  /** Degrees per day (bodies only) */
  speed?: number
  retrograde: boolean
  sign: number
  /** 1–12 */
  house: number
}

export interface Aspect {
  a: ChartPoint
  b: ChartPoint
  type: (typeof ASPECTS)[number]
  /** Distance from exact, in degrees */
  orb: number
}

export interface StarChart {
  utc: Date
  offsetMinutes: number
  /** The zone was on daylight saving time at birth */
  dst: boolean
  /** Placidus can't be drawn this close to the poles; equal houses were used */
  housesFallback: boolean
  place: StarPlace
  points: ChartPoint[]
  asc: number
  mc: number
  /** Ecliptic longitudes of house cusps 1–12 */
  cusps: number[]
  aspects: Aspect[]
}

/** "UTC+8", "UTC+5:30", "UTC−4" */
export function formatOffset(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60)
  const m = Math.abs(minutes) % 60
  return `UTC${minutes >= 0 ? '+' : '−'}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`
}

/** "39.90°N 116.41°E" */
export const formatCoords = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`

/** "白羊 12°34′"; signName renames the sign (e.g. into English), by default as in SIGNS. */
export function formatLon(lon: number, signName: (sign: string) => string = (s) => s): string {
  const inSign = norm(lon) % 30
  let deg = Math.floor(inSign)
  let min = Math.round((inSign - deg) * 60)
  if (min === 60) {
    deg += 1
    min = 0
  }
  return `${signName(SIGNS[Math.floor(norm(lon) / 30)])} ${deg}°${String(min).padStart(2, '0')}′`
}

/* ---------- Computation ---------- */

/** Geocentric apparent longitude on the true ecliptic of date. */
function bodyLon(body: A.Body, t: A.AstroTime): number {
  return A.Ecliptic(A.GeoVector(body, t, true)).elon
}

/** Longitude of the Moon's ascending node: mean (Meeus 47.7) or true (instantaneous orbital plane). */
function nodeLon(t: A.AstroTime, kind: StarSettings['node']): number {
  if (kind === 'mean') {
    const T = t.tt / 36525
    return norm(125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000)
  }
  const s = A.GeoMoonState(t)
  const dt = 1 / 1440 // one minute, in days
  const r = A.Ecliptic(new A.Vector(s.x, s.y, s.z, t)).vec
  const r2 = A.Ecliptic(new A.Vector(s.x + s.vx * dt, s.y + s.vy * dt, s.z + s.vz * dt, t)).vec
  const v = { x: r2.x - r.x, y: r2.y - r.y, z: r2.z - r.z }
  // Orbit normal h = r × v; the ascending node points along z × h.
  const hx = r.y * v.z - r.z * v.y
  const hy = r.z * v.x - r.x * v.z
  return norm(atan2d(hx, -hy))
}

/** Ecliptic longitude of the point on the ecliptic with right ascension ra. */
const raToLon = (ra: number, eps: number) => norm(atan2d(sind(ra), cosd(ra) * cosd(eps)))

/** Placidus cusps 11, 12, 2, 3: trisect each point's own diurnal / nocturnal semi-arc in time. */
function placidusCusp(ramc: number, eps: number, lat: number, fraction: number, above: boolean): number {
  let lon = raToLon(ramc + (above ? 90 : 270) * fraction, eps)
  for (let i = 0; i < 30; i++) {
    const decl = Math.asin(sind(eps) * sind(lon)) / RAD
    const x = tand(lat) * tand(decl)
    if (Math.abs(x) >= 1) return NaN // circumpolar: Placidus is undefined
    const ad = Math.asin(x) / RAD
    const ra = above ? ramc + fraction * (90 + ad) : ramc + 180 - fraction * (90 - ad)
    const next = raToLon(ra, eps)
    if (Math.abs(next - lon) < 1e-7) return next
    lon = next
  }
  return lon
}

function houseCusps(system: StarSettings['houses'], asc: number, mc: number, ramc: number, eps: number, lat: number): number[] {
  if (system === 'whole') return Array.from({ length: 12 }, (_, i) => norm(Math.floor(asc / 30) * 30 + i * 30))
  if (system === 'equal') return Array.from({ length: 12 }, (_, i) => norm(asc + i * 30))
  const c11 = placidusCusp(ramc, eps, lat, 1 / 3, true)
  const c12 = placidusCusp(ramc, eps, lat, 2 / 3, true)
  const c2 = placidusCusp(ramc, eps, lat, 2 / 3, false)
  const c3 = placidusCusp(ramc, eps, lat, 1 / 3, false)
  // Above the polar circles Placidus breaks down; fall back to equal houses there.
  if ([c11, c12, c2, c3].some(Number.isNaN)) return houseCusps('equal', asc, mc, ramc, eps, lat)
  const top = [asc, c2, c3, norm(mc + 180), norm(c11 + 180), norm(c12 + 180)]
  return [...top, ...top.map((c) => norm(c + 180))]
}

/** Which house (1–12) a longitude falls in. */
export function houseOf(lon: number, cusps: number[]): number {
  for (let i = 0; i < 12; i++) {
    const start = cusps[i]
    const span = norm(cusps[(i + 1) % 12] - start)
    if (norm(lon - start) < span) return i + 1
  }
  return 1
}

function makePoint(key: ChartPoint['key'], name: string, glyph: string, l: number, cusps: number[], speed?: number): ChartPoint {
  return {
    key,
    name,
    glyph,
    lon: norm(l),
    speed,
    retrograde: speed != null && speed < 0,
    sign: Math.floor(norm(l) / 30),
    house: houseOf(norm(l), cusps),
  }
}

/** Planets and nodes at an instant, placed in the given houses. */
function bodiesAt(utc: Date, settings: StarSettings, cusps: number[]): ChartPoint[] {
  const t = A.MakeTime(utc)
  const before = A.MakeTime(new Date(utc.getTime() - 43200000))
  const after = A.MakeTime(new Date(utc.getTime() + 43200000))
  const points = PLANETS.map(([key, body]) => {
    // Degrees moved over the surrounding day; negative means retrograde.
    const speed = norm(bodyLon(body, after) - bodyLon(body, before) + 180) - 180
    return makePoint(key, BODY_INFO[key].name, BODY_INFO[key].glyph, bodyLon(body, t), cusps, speed)
  })
  const node = nodeLon(t, settings.node)
  points.push(makePoint('node', BODY_INFO.node.name, BODY_INFO.node.glyph, node, cusps))
  points.push(makePoint('southNode', BODY_INFO.southNode.name, BODY_INFO.southNode.glyph, node + 180, cusps))
  return points
}

/** Aspects within one chart, between planets and the angles; the nodes are left out. */
function chartAspects(points: ChartPoint[]): Aspect[] {
  const aspectable = points.filter((p) => p.key !== 'node' && p.key !== 'southNode')
  const aspects: Aspect[] = []
  for (let i = 0; i < aspectable.length; i++) {
    for (let j = i + 1; j < aspectable.length; j++) {
      const a = aspectable[i]
      const b = aspectable[j]
      if ((a.key === 'asc' || a.key === 'mc') && (b.key === 'asc' || b.key === 'mc')) continue
      const sep = Math.abs(norm(a.lon - b.lon + 180) - 180)
      const bonus = [a.key, b.key].some((k) => k === 'sun' || k === 'moon') ? LUMINARY_BONUS : 0
      for (const type of ASPECTS) {
        const orb = Math.abs(sep - type.angle)
        if (orb <= type.orb + bonus) {
          aspects.push({ a, b, type, orb })
          break
        }
      }
    }
  }
  return aspects.sort((x, y) => x.orb - y.orb)
}

/** Chart for a UTC instant at a latitude / east longitude. */
export function computeChart(
  utc: Date,
  lat: number,
  lon: number,
  settings: StarSettings,
): Omit<StarChart, 'offsetMinutes' | 'dst' | 'place'> {
  const t = A.MakeTime(utc)
  const eps = A.e_tilt(t).tobl
  const ramc = norm(A.SiderealTime(t) * 15 + lon)
  const mc = raToLon(ramc, eps)
  const asc = norm(atan2d(cosd(ramc), -(sind(ramc) * cosd(eps) + tand(lat) * sind(eps))))
  const cusps = houseCusps(settings.houses, asc, mc, ramc, eps, lat)

  const points = bodiesAt(utc, settings, cusps)
  points.push(makePoint('asc', '上升', 'ASC', asc, cusps))
  points.push(makePoint('mc', '天顶', 'MC', mc, cusps))

  const aspects = chartAspects(points)
  // Placidus needs every cusp's semi-arc, which fails inside the polar circles.
  const housesFallback = settings.houses === 'placidus' && Math.abs(lat) >= 90 - eps
  return { utc, points, asc, mc, cusps, aspects, housesFallback }
}

/** Chart from wall-clock birth time at a place. */
export function buildStarChart(
  wall: { year: number; month: number; day: number; hour: number; minute: number },
  place: StarPlace,
  settings: StarSettings,
): StarChart {
  const { date, offsetMinutes } = toUtc(wall, place.timeZone)
  // Standard time is the smaller of the January and July offsets that year.
  const standard = Math.min(
    zoneOffset(Date.UTC(wall.year, 0, 1), place.timeZone),
    zoneOffset(Date.UTC(wall.year, 6, 1), place.timeZone),
  )
  return {
    ...computeChart(date, place.latitude, place.longitude, settings),
    offsetMinutes,
    dst: offsetMinutes > standard,
    place,
  }
}

/* ---------- 行运与推运 ---------- */

export type OverlayKind = 'transit' | 'progressed' | 'synastry'

export interface Overlay {
  kind: OverlayKind
  /** The moment the overlay is for (the chosen date) */
  target: Date
  /** For progressions: the ephemeris instant used (birth + one day per year of life) */
  progressedUtc?: Date
  /** Years of life at the target date */
  age: number
  /** Overlay bodies (and progressed angles); house = natal house they fall in */
  points: ChartPoint[]
  /** Overlay body (a) to natal point (b) */
  aspects: Aspect[]
  /** 合盘 only: the other person's chart, and which of their houses each of my points falls in */
  partner?: StarChart
  inPartnerHouses?: ChartPoint[]
}

/** Orbs for overlay-to-natal aspects: transits are read tightly, progressions tighter still. */
export const OVERLAY_ORB: Record<Exclude<OverlayKind, 'synastry'>, number> = { transit: 2, progressed: 1 }
/** 合盘 orbs: the natal orbs less 2° (合、冲 6°, 刑、拱 5°, 六合 3°), no extra for the Sun and Moon */
export const SYNASTRY_ORB_LESS = 2
const TROPICAL_YEAR_MS = 365.24219 * 86400000
/** Naibod rate: the Sun's mean daily motion, in degrees per year of life */
const NAIBOD = 0.98564736

/** Aspects from overlay points to natal points (planets and angles, no nodes). */
function crossAspects(
  over: ChartPoint[],
  natal: ChartPoint[],
  orbOf: number | ((type: (typeof ASPECTS)[number]) => number),
): Aspect[] {
  const usable = (p: ChartPoint) => p.key !== 'node' && p.key !== 'southNode'
  const out: Aspect[] = []
  for (const a of over.filter(usable)) {
    for (const b of natal.filter(usable)) {
      const sep = Math.abs(norm(a.lon - b.lon + 180) - 180)
      for (const type of ASPECTS) {
        const d = Math.abs(sep - type.angle)
        if (d <= (typeof orbOf === 'number' ? orbOf : orbOf(type))) {
          out.push({ a, b, type, orb: d })
          break
        }
      }
    }
  }
  return out.sort((x, y) => x.orb - y.orb)
}

/** 行运: where the planets are at target, against the natal chart. */
export function transits(natal: StarChart, target: Date, settings: StarSettings): Overlay {
  const points = bodiesAt(target, settings, natal.cusps)
  return {
    kind: 'transit',
    target,
    age: (target.getTime() - natal.utc.getTime()) / TROPICAL_YEAR_MS,
    points,
    aspects: crossAspects(points, natal.points, OVERLAY_ORB.transit),
  }
}

/**
 * 推运 (secondary progressions): the sky one day after birth stands for the
 * first year of life, two days for the second, and so on. The angles move by
 * solar arc (the progressed Sun's advance) or at the Naibod rate.
 */
export function progressions(natal: StarChart, target: Date, settings: StarSettings): Overlay {
  const age = (target.getTime() - natal.utc.getTime()) / TROPICAL_YEAR_MS
  const progressedUtc = new Date(natal.utc.getTime() + age * 86400000)
  const points = bodiesAt(progressedUtc, settings, natal.cusps)
  const natalSun = natal.points.find((p) => p.key === 'sun')!.lon
  const progSun = points.find((p) => p.key === 'sun')!.lon
  const arc = settings.progAngles === 'naibod' ? age * NAIBOD : norm(progSun - natalSun + 180) - 180
  const mc = norm(natal.mc + arc)
  // The ascendant that goes with the progressed MC at the birth latitude.
  const t = A.MakeTime(natal.utc)
  const eps = A.e_tilt(t).tobl
  const ramc = norm(atan2d(sind(mc) * cosd(eps), cosd(mc)))
  const lat = natal.place.latitude
  const asc = norm(atan2d(cosd(ramc), -(sind(ramc) * cosd(eps) + tand(lat) * sind(eps))))
  points.push(makePoint('asc', '上升', 'ASC', asc, natal.cusps))
  points.push(makePoint('mc', '天顶', 'MC', mc, natal.cusps))
  return {
    kind: 'progressed',
    target,
    progressedUtc,
    age,
    points,
    aspects: crossAspects(points, natal.points, OVERLAY_ORB.progressed),
  }
}

/* ---------- 合盘 ---------- */

const GENERATIONAL = new Set<ChartPoint['key']>(['uranus', 'neptune', 'pluto'])

/** Re-house a point into another chart's houses. */
const rehouse = (p: ChartPoint, cusps: number[]): ChartPoint => ({ ...p, house: houseOf(p.lon, cusps) })

/**
 * 合盘 (synastry): the other person's planets and angles laid round my chart,
 * the houses of mine they fall in (and mine in theirs), and the aspects
 * between the two charts. Their points are the overlay (a), mine natal (b).
 */
export function synastry(me: StarChart, partner: StarChart): Overlay {
  const points = partner.points.map((p) => rehouse(p, me.cusps))
  return {
    kind: 'synastry',
    target: partner.utc,
    age: 0,
    points,
    // Outer planet to outer planet is shared by everyone born within a few years: a generation, not the pair.
    aspects: crossAspects(points, me.points, (type) => type.orb - SYNASTRY_ORB_LESS).filter(
      (x) => !(GENERATIONAL.has(x.a.key) && GENERATIONAL.has(x.b.key)),
    ),
    partner,
    inPartnerHouses: me.points.map((p) => rehouse(p, partner.cusps)),
  }
}

/* ---------- 组合盘 ---------- */

/** The nearer midpoint of two longitudes (across 0° when that is shorter). */
export const midpoint = (a: number, b: number) => norm(a + (norm(b - a + 180) - 180) / 2)

/**
 * 组合盘: one chart for the relationship itself.
 * - midpoint (Composite): each pair of planets at its nearer midpoint; the MC
 *   at the MCs' midpoint, with the ascendant and houses derived from it at
 *   the mean latitude (so the houses stay a real house system).
 * - davison: the actual sky at the midpoint in time between the births, over
 *   the midpoint between the birthplaces.
 */
export function composite(a: StarChart, b: StarChart, settings: StarSettings): StarChart {
  const utc = new Date((a.utc.getTime() + b.utc.getTime()) / 2)
  const lat = (a.place.latitude + b.place.latitude) / 2
  const lon = norm(midpoint(a.place.longitude, b.place.longitude) + 180) - 180
  const place = { name: settings.composite === 'davison' ? '时空中点' : '两地中点', latitude: lat, longitude: lon, timeZone: 'UTC' }
  const base = { offsetMinutes: 0, dst: false, place }
  if (settings.composite === 'davison') return { ...computeChart(utc, lat, lon, settings), ...base }

  const eps = A.e_tilt(A.MakeTime(utc)).tobl
  const mc = midpoint(a.mc, b.mc)
  const ramc = norm(atan2d(sind(mc) * cosd(eps), cosd(mc)))
  const asc = norm(atan2d(cosd(ramc), -(sind(ramc) * cosd(eps) + tand(lat) * sind(eps))))
  const cusps = houseCusps(settings.houses, asc, mc, ramc, eps, lat)
  const points = a.points
    .filter((p) => p.key !== 'asc' && p.key !== 'mc')
    .map((p) => {
      const q = b.points.find((x) => x.key === p.key)!
      return makePoint(p.key, p.name, p.glyph, midpoint(p.lon, q.lon), cusps)
    })
  // Keep the south node opposite the north node, whichever midpoint that took.
  const north = points.find((p) => p.key === 'node')!
  const si = points.findIndex((p) => p.key === 'southNode')
  points[si] = makePoint('southNode', points[si].name, points[si].glyph, north.lon + 180, cusps)
  points.push(makePoint('asc', '上升', 'ASC', asc, cusps))
  points.push(makePoint('mc', '天顶', 'MC', mc, cusps))
  const housesFallback = settings.houses === 'placidus' && Math.abs(lat) >= 90 - eps
  return { utc, points, asc, mc, cusps, aspects: chartAspects(points), housesFallback, ...base }
}
