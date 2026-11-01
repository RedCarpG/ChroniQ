// 人生时间轴: the turning points of one life in three systems on one line: the 八字's 大运, the 紫微's
// 大限 and the slow planets coming back to, or opposite, where they stood at birth. Which years see
// several at once is worked out here too.
import * as A from 'astronomy-engine'
import { SolarDay } from 'tyme4ts'
import { bodyLon } from './astrology'
import { buildBazi, type BaziInput } from './bazi'
import { DEFAULT_PLACE } from './place'
import type { SchoolSettings } from './schools'
import { toUtc } from './timeZone'
import { buildZiwei } from './ziwei'
import type { ZiweiSchoolSettings } from './ziweiSchools'

/** How far the line runs, in years from birth */
export const SPAN_YEARS = 90
const MONTH = 30.44 * 86400_000

export interface TimelineSpan {
  from: number
  /** The last year it covers */
  to: number
  /** 大运's 干支, or 大限's palace */
  label: string
  /** And the 干支 of a 大限 */
  ganzhi?: string
}

export type PlanetEventKind = 'saturnReturn' | 'saturnOpposition' | 'uranusOpposition' | 'jupiterReturn'
export interface PlanetEvent {
  kind: PlanetEventKind
  year: number
  /** A Jupiter return comes every twelve years, too regular to count as a turning point */
  minor: boolean
}

export type TimelineSystem = 'bazi' | 'ziwei' | 'planets'
export interface Convergence {
  from: number
  to: number
  systems: TimelineSystem[]
}

export interface LifeTimeline {
  birthYear: number
  lastYear: number
  /** The years before the first 大运 are 童限: left out of the spans */
  bazi: TimelineSpan[]
  ziwei: TimelineSpan[]
  planets: PlanetEvent[]
  /** 本命年: every twelve years */
  ownYears: number[]
  convergences: Convergence[]
}

/** The 干支 of a year, by the year most of it falls in (from 立春) */
export function yearGanzhi(year: number) {
  return SolarDay.fromYmd(year, 6, 1).getSixtyCycleDay().getYear().getName()
}

/** Signed difference a − b in degrees, in −180…180 */
const diff = (a: number, b: number) => ((((a - b) % 360) + 540) % 360) - 180

/**
 * The years a planet reaches a longitude. A slow planet can pass it up to three times in a year or
 * so as it turns retrograde: those count as one, from the first pass.
 */
export function crossingYears(body: A.Body, target: number, startMs: number, endMs: number): number[] {
  const out: number[] = []
  let lastHit = -Infinity
  let before = diff(bodyLon(body, A.MakeTime(new Date(startMs))), target)
  for (let ms = startMs + MONTH; ms <= endMs; ms += MONTH) {
    const now = diff(bodyLon(body, A.MakeTime(new Date(ms))), target)
    // A crossing of zero, not the jump at the far side of the circle
    if (before * now <= 0 && Math.abs(before) < 30 && Math.abs(now) < 30) {
      if (ms - lastHit > 18 * MONTH) out.push(new Date(ms).getUTCFullYear())
      lastHit = ms
    }
    before = now
  }
  return out
}

function planetEvents(input: BaziInput, lastYear: number): PlanetEvent[] {
  const place = input.place ?? DEFAULT_PLACE
  const { year, month, day, hour, minute } = input
  const birth = toUtc({ year, month, day, hour, minute }, place.timeZone).date
  const start = birth.getTime() + 2 * 365 * 86400_000
  const end = Date.UTC(lastYear + 1, 0, 1)
  const natal = (body: A.Body) => bodyLon(body, A.MakeTime(birth))
  const of = (kind: PlanetEventKind, body: A.Body, offset: number, minor = false): PlanetEvent[] =>
    crossingYears(body, (natal(body) + offset) % 360, start, end).map((y) => ({ kind, year: y, minor }))
  return [
    ...of('jupiterReturn', A.Body.Jupiter, 0, true),
    ...of('saturnOpposition', A.Body.Saturn, 180),
    ...of('saturnReturn', A.Body.Saturn, 0),
    ...of('uranusOpposition', A.Body.Uranus, 180),
  ].sort((a, b) => a.year - b.year)
}

/**
 * Years with turning points in at least two systems: runs of events no more than a year apart. As
 * 大运 and 大限 both come every ten years, those two can stay in step for a whole life.
 */
export function findConvergences(events: { year: number; system: TimelineSystem }[]): Convergence[] {
  const sorted = [...events].sort((a, b) => a.year - b.year)
  const out: Convergence[] = []
  let run: typeof sorted = []
  const finish = () => {
    const systems = [...new Set(run.map((e) => e.system))]
    if (systems.length >= 2) out.push({ from: run[0].year, to: run[run.length - 1].year, systems })
    run = []
  }
  for (const e of sorted) {
    if (run.length > 0 && e.year - run[run.length - 1].year > 1) finish()
    run.push(e)
  }
  finish()
  return out
}

export function buildLifeTimeline(input: BaziInput, schools: SchoolSettings, ziweiSchools: ZiweiSchoolSettings): LifeTimeline {
  const birthYear = input.year
  const lastYear = birthYear + SPAN_YEARS
  const chart = buildBazi(input, schools)
  const bazi = chart.decades
    .filter((d) => d.startYear <= lastYear)
    .map((d) => ({ from: d.startYear, to: Math.min(d.endYear, lastYear), label: d.ganzhi }))
  const ziwei = buildZiwei(input, ziweiSchools)
    .decades.filter((d) => d.years[0] <= lastYear)
    .map((d) => ({ from: d.years[0], to: Math.min(d.years[d.years.length - 1], lastYear), label: d.palace, ganzhi: d.stem + d.branch }))
  const planets = planetEvents(input, lastYear)
  const birthBranch = chart.pillars[0].branch.char
  const ownYears: number[] = []
  for (let y = birthYear + 1; y <= lastYear; y++) {
    if (yearGanzhi(y)[1] === birthBranch) ownYears.push(y)
  }
  const convergences = findConvergences([
    ...bazi.map((s) => ({ year: s.from, system: 'bazi' as const })),
    ...ziwei.map((s) => ({ year: s.from, system: 'ziwei' as const })),
    ...planets.filter((p) => !p.minor).map((p) => ({ year: p.year, system: 'planets' as const })),
  ]).filter((c) => c.from > birthYear)
  return { birthYear, lastYear, bazi, ziwei, planets, ownYears, convergences }
}

/** What is going on in a year */
export function yearOf(line: LifeTimeline, year: number) {
  const during = (s: TimelineSpan) => s.from <= year && year <= s.to
  return {
    year,
    age: year - line.birthYear + 1,
    ganzhi: yearGanzhi(year),
    bazi: line.bazi.find(during),
    ziwei: line.ziwei.find(during),
    baziStarts: line.bazi.some((s) => s.from === year),
    ziweiStarts: line.ziwei.some((s) => s.from === year),
    planets: line.planets.filter((p) => p.year === year),
    own: line.ownYears.includes(year),
    convergence: line.convergences.find((c) => c.from <= year && year <= c.to),
  }
}
