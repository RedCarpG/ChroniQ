import { describe, expect, it } from 'vitest'
import { chartYear, pillarDays, taiSui } from '../chartDays'
import type { SavedChart } from '../savedCharts'

// 1990-05-15 10:30, male: 庚午年 辛巳月 庚辰日; lunar birthday 四月廿一
const chart: SavedChart = { id: 'a', name: '张三', input: { year: 1990, month: 5, day: 15, hour: 10, minute: 30, gender: 1 } }
const all = ['birthday', 'clash', 'fortune', 'western'] as const
const on = (year: number, m: number, d: number) => chartYear(chart, year, [...all]).get(`${m}-${d}`) ?? []

describe('chart dates', () => {
  it('has the solar birthday with the age', () => {
    expect(on(2026, 5, 15)).toContainEqual({ chartId: 'a', name: '张三', kind: 'birthday', age: 36 })
  })

  it('has the lunar birthday where 四月廿一 falls that year', () => {
    // 2026: 农历四月廿一 is 6 June
    expect(on(2026, 6, 6)).toContainEqual({ chartId: 'a', name: '张三', kind: 'lunarBirthday' })
    const lunar = [...chartYear(chart, 2026, [...all]).values()].flat().filter((d) => d.kind === 'lunarBirthday')
    expect(lunar).toHaveLength(1)
  })

  it('keeps a 29 February birthday on the 28th in common years', () => {
    const leapling: SavedChart = { ...chart, input: { ...chart.input, year: 2000, month: 2, day: 29 } }
    expect(chartYear(leapling, 2026, ['birthday']).get('2-28')?.[0]).toMatchObject({ kind: 'birthday', age: 26 })
    expect(chartYear(leapling, 2028, ['birthday']).get('2-29')?.[0]).toMatchObject({ kind: 'birthday', age: 28 })
  })

  it('marks the day each 大运 begins', () => {
    const decades = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035].flatMap((y) =>
      [...chartYear(chart, y, ['fortune']).values()].flat(),
    )
    expect(decades).toHaveLength(1) // one 大运 starts in any ten years
    expect(decades[0].kind).toBe('decade')
  })

  it('shows only what is asked for', () => {
    expect([...chartYear(chart, 2026, ['clash']).values()]).toEqual([])
  })
})

describe('pillar days', () => {
  it('finds a day that clashes, combines with or punishes the day and year branches', () => {
    // 日支 辰: 戌 clashes, 酉 combines, 辰 punishes itself; 年支 午: 子 clashes
    expect(pillarDays(chart, '戌')).toContainEqual(expect.objectContaining({ relation: '冲', pillar: '日柱' }))
    expect(pillarDays(chart, '酉')).toContainEqual(expect.objectContaining({ relation: '合', pillar: '日柱' }))
    expect(pillarDays(chart, '辰')).toContainEqual(expect.objectContaining({ relation: '刑', pillar: '日柱' }))
    expect(pillarDays(chart, '子')).toContainEqual(expect.objectContaining({ relation: '冲', pillar: '年柱' }))
    expect(pillarDays(chart, '寅')).toEqual([])
  })

  it('knows 本命年 and 冲太岁', () => {
    expect(taiSui(chart, '午')).toBe('本命年')
    expect(taiSui(chart, '子')).toBe('冲太岁')
    expect(taiSui(chart, '卯')).toBeNull()
  })
})
