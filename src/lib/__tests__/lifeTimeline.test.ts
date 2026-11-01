import * as A from 'astronomy-engine'
import { describe, expect, it } from 'vitest'
import { bodyLon } from '../astrology'
import { buildLifeTimeline, crossingYears, findConvergences, yearGanzhi, yearOf } from '../lifeTimeline'
import { DEFAULT_SCHOOLS } from '../schools'
import { DEFAULT_ZIWEI_SCHOOLS } from '../ziweiSchools'

const INPUT = { year: 1990, month: 5, day: 15, hour: 10, minute: 30, gender: 1 as const }
const line = buildLifeTimeline(INPUT, DEFAULT_SCHOOLS, DEFAULT_ZIWEI_SCHOOLS)

describe('crossingYears', () => {
  it('counts a planet’s passes as it turns retrograde as one', () => {
    const start = Date.UTC(1990, 4, 15)
    const target = bodyLon(A.Body.Saturn, A.MakeTime(new Date(start)))
    const years = crossingYears(A.Body.Saturn, target, start + 2 * 365 * 86400_000, Date.UTC(2080, 0, 1))
    expect(years).toHaveLength(3)
    expect(years[0]).toBeGreaterThanOrEqual(2019)
    expect(years[0]).toBeLessThanOrEqual(2021)
  })
})

describe('buildLifeTimeline', () => {
  it('runs the 大运 and the 大限 year after year without a gap', () => {
    for (const spans of [line.bazi, line.ziwei]) {
      expect(spans.length).toBeGreaterThan(5)
      for (let i = 1; i < spans.length; i++) expect(spans[i].from).toBe(spans[i - 1].to + 1)
      expect(spans.at(-1)!.to).toBeLessThanOrEqual(line.lastYear)
    }
  })

  it('has the Saturn return at about 29 and the Uranus opposition at about 40', () => {
    const saturn = line.planets.filter((p) => p.kind === 'saturnReturn')
    expect(saturn[0].year - 1990).toBeGreaterThanOrEqual(28)
    expect(saturn[0].year - 1990).toBeLessThanOrEqual(31)
    const uranus = line.planets.filter((p) => p.kind === 'uranusOpposition')
    expect(uranus).toHaveLength(1)
    expect(uranus[0].year - 1990).toBeGreaterThanOrEqual(36)
    expect(uranus[0].year - 1990).toBeLessThanOrEqual(46)
  })

  it('has a 本命年 every twelve years, in the birth year’s branch', () => {
    expect(line.ownYears.slice(0, 3)).toEqual([2002, 2014, 2026])
    expect(yearGanzhi(2026)).toBe('丙午')
  })
})

describe('findConvergences', () => {
  it('needs two systems, within a year of each other', () => {
    expect(
      findConvergences([
        { year: 2000, system: 'bazi' },
        { year: 2001, system: 'ziwei' },
        { year: 2010, system: 'bazi' },
        { year: 2013, system: 'planets' },
      ]),
    ).toEqual([{ from: 2000, to: 2001, systems: ['bazi', 'ziwei'] }])
  })

  it('does not count one system twice', () => {
    expect(findConvergences([{ year: 2000, system: 'planets' }, { year: 2000, system: 'planets' }])).toEqual([])
  })
})

describe('yearOf', () => {
  it('says what is running in a year', () => {
    const info = yearOf(line, 2026)
    expect(info.age).toBe(37)
    expect(info.ganzhi).toBe('丙午')
    expect(info.own).toBe(true)
    expect(info.bazi).toBeDefined()
    expect(info.ziwei).toBeDefined()
  })
})
