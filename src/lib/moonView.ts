// 观月: the Moon as seen from a place at a moment — its phase and age, how it is turned (its
// libration and the tilt it is seen at), when it rises, culminates and sets, how far it is, and the
// month of phases around it. All from astronomy-engine.
import * as A from 'astronomy-engine'
import { toUtc } from './timeZone'

const RAD = Math.PI / 180
const DAY = 86_400_000

type V3 = [number, number, number]
const vec = (v: A.Vector): V3 => [v.x, v.y, v.z]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const unit = (a: V3): V3 => scale(a, 1 / Math.hypot(a[0], a[1], a[2]))
const norm360 = (d: number) => ((d % 360) + 360) % 360

/**
 * How to draw the Moon as seen: the screen's x to the right, y up (towards the zenith) and z towards
 * the viewer. `body` holds the Moon's own axes in those coordinates (x: towards lunar longitude 0 on
 * its equator, y: towards longitude 90° east, z: its north pole), so a point on the disc maps to a
 * place on the Moon's map; `sun` is the direction of the sunlight on it.
 */
export interface MoonFrame {
  body: [V3, V3, V3]
  sun: V3
}

export interface MoonView {
  /** Degrees of ecliptic longitude past the Sun: 0 new, 90 first quarter, 180 full, 270 last quarter */
  phase: number
  /** Lit fraction of the disc, 0–1 */
  lit: number
  /** Where it is in the sky (with refraction), degrees */
  alt: number
  az: number
  /** Right ascension (J2000, degrees), for the 宿 it is in */
  ra: number
  distanceKm: number
  /** Apparent diameter, degrees */
  diameter: number
  /** Optical libration (degrees): the near side's centre seen this far east (lon) and north (lat) */
  libration: { lon: number; lat: number }
  /** Position angle of the bright limb, degrees from celestial north towards east */
  brightLimb: number
  /** Parallactic angle: how far the zenith is turned from celestial north, at the Moon, degrees */
  parallactic: number
  frame: MoonFrame
}

/** The Moon from a place (latitude, longitude in degrees) at an instant */
export function moonView(utc: Date, latitude: number, longitude: number): MoonView {
  const t = A.MakeTime(utc)
  const observer = new A.Observer(latitude, longitude, 0)
  // Vectors in J2000 equatorial coordinates (AU), as the Moon's rotation axis is given
  const moonGeo = vec(A.GeoVector(A.Body.Moon, t, true))
  const here = vec(A.ObserverVector(t, observer, false))
  const sunGeo = vec(A.GeoVector(A.Body.Sun, t, true))
  const d = unit(sub(moonGeo, here))
  const zenith = unit(here)
  const up = unit(sub(zenith, scale(d, dot(zenith, d))))
  const right = cross(d, up)
  const toward = scale(d, -1)
  const screen = (v: V3): V3 => [dot(v, right), dot(v, up), dot(v, toward)]
  // The Moon's own axes: its north pole, and its prime meridian `spin` degrees along its equator
  // from where that crosses the J2000 equator going north (the IAU's convention)
  const axis = A.RotationAxis(A.Body.Moon, t)
  const north = vec(axis.north)
  const node = unit([-north[1], north[0], 0])
  const w = axis.spin * RAD
  const x = unit([...cross(north, node)].map((c, i) => node[i] * Math.cos(w) + c * Math.sin(w)) as V3)
  const y = cross(north, x)

  const eq = A.Equator(A.Body.Moon, t, observer, true, true)
  const hor = A.Horizon(t, observer, eq.ra, eq.dec, 'normal')
  const sunEq = A.Equator(A.Body.Sun, t, observer, true, true)
  const lib = A.Libration(t)
  const illum = A.Illumination(A.Body.Moon, t)
  // Meeus 48.5: the bright limb's position angle, from the Sun's and Moon's places
  const [a, dl, a0, d0] = [eq.ra * 15 * RAD, eq.dec * RAD, sunEq.ra * 15 * RAD, sunEq.dec * RAD]
  const brightLimb = norm360(
    Math.atan2(Math.cos(d0) * Math.sin(a0 - a), Math.sin(d0) * Math.cos(dl) - Math.cos(d0) * Math.sin(dl) * Math.cos(a0 - a)) / RAD,
  )
  // Meeus 14.1: the parallactic angle, from the hour angle
  const hourAngle = (A.SiderealTime(t) * 15 + longitude) * RAD - a
  const phi = latitude * RAD
  const parallactic = Math.atan2(Math.sin(hourAngle), Math.tan(phi) * Math.cos(dl) - Math.sin(dl) * Math.cos(hourAngle)) / RAD

  return {
    phase: A.MoonPhase(t),
    lit: illum.phase_fraction,
    alt: hor.altitude,
    az: hor.azimuth,
    ra: A.Equator(A.Body.Moon, t, observer, false, true).ra * 15,
    distanceKm: lib.dist_km,
    diameter: lib.diam_deg,
    libration: { lon: lib.elon, lat: lib.elat },
    brightLimb,
    parallactic,
    frame: { body: [screen(x), screen(y), screen(north)], sun: screen(unit(sub(sunGeo, moonGeo))) },
  }
}

export type QuarterName = '朔' | '上弦' | '望' | '下弦'
const QUARTERS: QuarterName[] = ['朔', '上弦', '望', '下弦']
export interface Quarter {
  name: QuarterName
  time: Date
}

/** The new Moons, quarters and full Moons from a little before an instant to a little after */
export function quartersAround(utc: Date, days = 35): Quarter[] {
  const out: Quarter[] = []
  let q = A.SearchMoonQuarter(A.MakeTime(new Date(utc.getTime() - days * DAY)))
  while (q.time.date.getTime() < utc.getTime() + days * DAY) {
    out.push({ name: QUARTERS[q.quarter], time: q.time.date })
    q = A.NextMoonQuarter(q)
  }
  return out
}

/** The lunation an instant falls in: from the new Moon before it to the next, with the quarters between */
export function lunation(utc: Date): { start: Date; end: Date; quarters: Quarter[] } {
  const all = quartersAround(utc)
  const news = all.filter((q) => q.name === '朔')
  let i = news.length - 1
  while (i > 0 && news[i].time > utc) i--
  const start = news[i].time
  const end = news[i + 1].time
  return { start, end, quarters: all.filter((q) => q.time >= start && q.time <= end) }
}

/** Days since the last new Moon */
export function moonAge(utc: Date): number {
  return (utc.getTime() - lunation(utc).start.getTime()) / DAY
}

export interface MoonTimes {
  rise: Date | null
  transit: Date | null
  set: Date | null
}

/** Moonrise, the Moon's culmination and moonset on a local date (any may not happen that day) */
export function moonTimes(date: { year: number; month: number; day: number }, latitude: number, longitude: number, timeZone: string): MoonTimes {
  const observer = new A.Observer(latitude, longitude, 0)
  const start = toUtc({ ...date, hour: 0, minute: 0 }, timeZone).date
  const end = toUtc({ ...date, day: date.day + 1, hour: 0, minute: 0 }, timeZone).date
  const t0 = A.MakeTime(start)
  const span = (end.getTime() - start.getTime()) / DAY
  const inDay = (t: A.AstroTime | null) => (t && t.date < end ? t.date : null)
  const transit = A.SearchHourAngle(A.Body.Moon, observer, 0, t0, +1)
  return {
    rise: inDay(A.SearchRiseSet(A.Body.Moon, observer, +1, t0, span)),
    transit: inDay(transit.time),
    set: inDay(A.SearchRiseSet(A.Body.Moon, observer, -1, t0, span)),
  }
}

/** The Moon's and the Sun's heights through the day around an instant: local noon to noon, every `step` minutes */
export function heightsAround(
  utc: Date,
  latitude: number,
  longitude: number,
  timeZone: string,
  step = 15,
): { start: Date; end: Date; samples: { time: Date; moon: number; sun: number }[] } {
  const observer = new A.Observer(latitude, longitude, 0)
  // The last local noon at or before the instant (a day 0 is the month before's last, as Date.UTC takes it)
  const wall = wallOf(utc, timeZone)
  const noon = { ...wall, day: wall.hour < 12 ? wall.day - 1 : wall.day, hour: 12, minute: 0 }
  const start = toUtc(noon, timeZone).date
  const end = toUtc({ ...noon, day: noon.day + 1 }, timeZone).date
  const height = (body: A.Body, t: A.AstroTime) => {
    const eq = A.Equator(body, t, observer, true, true)
    return A.Horizon(t, observer, eq.ra, eq.dec, 'normal').altitude
  }
  const samples = []
  for (let ms = start.getTime(); ms <= end.getTime(); ms += step * 60_000) {
    const t = A.MakeTime(new Date(ms))
    samples.push({ time: new Date(ms), moon: height(A.Body.Moon, t), sun: height(A.Body.Sun, t) })
  }
  return { start, end, samples }
}

/** The next perigee or apogee after an instant */
export function nextApsis(utc: Date): { kind: 'perigee' | 'apogee'; time: Date; distanceKm: number } {
  const a = A.SearchLunarApsis(A.MakeTime(utc))
  return { kind: a.kind === A.ApsisKind.Pericenter ? 'perigee' : 'apogee', time: a.time.date, distanceKm: a.dist_km }
}

const wallFormats = new Map<string, Intl.DateTimeFormat>()
/** The local date and time of an instant in a time zone */
export function wallOf(utc: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number } {
  let format = wallFormats.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
    wallFormats.set(timeZone, format)
  }
  const parts = Object.fromEntries(format.formatToParts(utc).map((p) => [p.type, Number(p.value)]))
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute }
}

/** The Moon's phase at an instant, as the calendar's Moon glyphs take it */
export function phaseAt(utc: Date): { angle: number; lit: number } {
  const t = A.MakeTime(utc)
  return { angle: A.MoonPhase(t), lit: A.Illumination(A.Body.Moon, t).phase_fraction }
}
