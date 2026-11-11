import { describe, expect, it } from 'vitest'
import { buildQizheng, PALACES } from '../qizheng'
import { DEFAULT_QIZHENG_SCHOOLS } from '../qizhengSchools'
import { DEFAULT_PLACE } from '../place'
import { limitAt, LIMIT_ORDER, LIMIT_YEARS, mingYears, qizhengLimits, qizhengTransit } from '../qizhengFortune'

const beijing = { year: 1990, month: 5, day: 17, hour: 10, minute: 30, gender: 1 as const, place: DEFAULT_PLACE }

describe('七政四余 运限', () => {
  const chart = buildQizheng(beijing, DEFAULT_QIZHENG_SCHOOLS)
  const limits = qizhengLimits(chart)

  it('runs the limits from 命宫 backward round the palaces', () => {
    expect(limits.map((l) => PALACES[l.palace])).toEqual(['命宫', '相貌', '福德', '官禄', '迁移', '疾厄', '夫妻', '奴仆', '男女', '田宅', '兄弟', '财帛'])
    expect(LIMIT_ORDER).toHaveLength(12)
  })

  it('gives the 命宫 10 years and a year for each 3° of the Sun into its 次; the rest their fixed years', () => {
    // The Sun at 黄经 55.9°: 25.9° into 大梁, so 10 + 8.6 years
    expect(mingYears(chart)).toBeCloseTo(18.6, 1)
    expect(limits[0].toAge).toBeCloseTo(mingYears(chart), 6)
    for (const l of limits.slice(1)) expect(l.toAge - l.fromAge).toBe(LIMIT_YEARS[l.palace])
    expect(limits[11].toAge - limits[0].toAge).toBeCloseTo(85.5, 6)
    // each one begins where the last ended
    for (let i = 1; i < 12; i++) expect(limits[i].fromAge).toBe(limits[i - 1].toAge)
  })

  it('puts each limit on its palace’s 次 and lists the natal bodies there', () => {
    expect(limits[0].ci).toBe(chart.mingCi)
    expect(limits[0].bodies.map((b) => b.key)).toEqual(chart.bodies.filter((b) => b.palace === 0).map((b) => b.key))
  })

  it('finds the limit running: at 36 the 福德 (28.6–39.6)', () => {
    const at = new Date(Date.UTC(2026, 10, 11))
    expect(PALACES[limitAt(limits, at)!.palace]).toBe('福德')
    expect(limitAt(limits, new Date(Date.UTC(1980, 0, 1)))).toBeUndefined()
  })

  it('places the sky of a moment over the natal palaces (流年)', () => {
    const t = qizhengTransit(chart, DEFAULT_QIZHENG_SCHOOLS, new Date(Date.UTC(2026, 10, 11)))
    expect(t.bodies).toHaveLength(chart.bodies.length)
    for (const b of t.bodies) expect(b.palace).toBe((b.ci - chart.mingCi + 12) % 12)
    expect(PALACES[t.limit!.palace]).toBe('福德')
    // the slow ones barely move in a month; the Moon does
    const later = qizhengTransit(chart, DEFAULT_QIZHENG_SCHOOLS, new Date(Date.UTC(2026, 11, 11)))
    const by = (x: typeof t, k: string) => x.bodies.find((b) => b.key === k)!.lon
    expect(Math.abs(by(later, 'saturn') - by(t, 'saturn'))).toBeLessThan(3)
  })
})
