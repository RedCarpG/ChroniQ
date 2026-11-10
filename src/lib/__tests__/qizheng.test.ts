import { describe, expect, it } from 'vitest'
import { buildQizheng, CI, meanApogee, PALACES } from '../qizheng'
import { DEFAULT_QIZHENG_SCHOOLS } from '../qizhengSchools'
import { DEFAULT_PLACE } from '../place'
import * as A from 'astronomy-engine'

const beijing = { year: 1990, month: 5, day: 17, hour: 10, minute: 30, gender: 1 as const, place: DEFAULT_PLACE }
const at = (chart: ReturnType<typeof buildQizheng>, key: string) => chart.bodies.find((b) => b.key === key)!

describe('七政四余', () => {
  const chart = buildQizheng(beijing, DEFAULT_QIZHENG_SCHOOLS)

  it('places the 七政 in their 宿: 日躔胃宿, 月离女宿, Saturn in 斗, Jupiter in 井', () => {
    expect(at(chart, 'sun').mansion.char).toBe('胃')
    expect(at(chart, 'moon').mansion.char).toBe('女')
    expect(at(chart, 'saturn').mansion.char).toBe('斗')
    expect(at(chart, 'jupiter').mansion.char).toBe('井')
  })

  it('puts the Sun in 大梁 (金牛) in mid-May, and every body in a palace from the 命宫', () => {
    expect(CI[at(chart, 'sun').ci].name).toBe('大梁')
    for (const b of chart.bodies) expect(b.palace).toBe((b.ci - chart.mingCi + 12) % 12)
    expect(PALACES).toHaveLength(12)
  })

  it('has 罗睺 and 计都 opposite, and swaps them by school', () => {
    const rahu = at(chart, 'rahu').lon
    const ketu = at(chart, 'ketu').lon
    expect((rahu - ketu + 360) % 360).toBeCloseTo(180, 6)
    const swapped = buildQizheng(beijing, { ...DEFAULT_QIZHENG_SCHOOLS, rahu: 'descending' })
    expect(at(swapped, 'rahu').lon).toBeCloseTo(ketu, 6)
  })

  it('leaves 紫炁 out when asked, and marks it as reckoned', () => {
    expect(at(chart, 'ziqi').reckoned).toBe(true)
    expect(buildQizheng(beijing, { ...DEFAULT_QIZHENG_SCHOOLS, ziqi: 'hidden' }).bodies.some((b) => b.key === 'ziqi')).toBe(false)
  })

  it('gives the mean apogee about 40.7° a year eastward', () => {
    const a = meanApogee(A.MakeTime(new Date(Date.UTC(2000, 0, 1))))
    const b = meanApogee(A.MakeTime(new Date(Date.UTC(2001, 0, 1))))
    expect(((b - a + 360) % 360)).toBeCloseTo(40.7, 0)
  })
})
