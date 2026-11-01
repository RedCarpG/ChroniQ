import { describe, expect, it } from 'vitest'
import { buildBazi } from '../bazi'
import { DAY_MASTER_IMAGE, GROUP_NOTE, TEN_STAR_NOTE, baziReading } from '../baziReading'
import { DEFAULT_SCHOOLS } from '../schools'

const chart = buildBazi({ year: 1990, month: 5, day: 15, hour: 10, minute: 30, gender: 1 }, DEFAULT_SCHOOLS)
const reading = baziReading(chart, 2026)

describe('baziReading', () => {
  it('reads the 日主 and has words for it', () => {
    expect(reading.dayMaster.char).toBe(chart.dayMaster.char)
    expect(DAY_MASTER_IMAGE[reading.dayMaster.char]).toBeTruthy()
  })

  it('counts the eight characters', () => {
    const total = Object.values(chart.elementCount).reduce((a, b) => a + b, 0)
    expect(total).toBe(8)
    expect(reading.most[0].count).toBe(Math.max(...Object.values(chart.elementCount)))
    for (const e of reading.missing) expect(chart.elementCount[e]).toBe(0)
  })

  it('weighs seven characters with the month three times over', () => {
    expect(reading.support + reading.drain).toBe(9)
    expect(reading.tendency).toBe(reading.support - reading.drain >= 2 ? 'strong' : reading.support - reading.drain <= -2 ? 'weak' : 'balanced')
  })

  it('tells whether the season helps: the same element or the one that generates it', () => {
    // 木 helped by 水 and 木, not by 火
    const fake = (day: '木', month: '水' | '木' | '火') =>
      baziReading({ ...chart, dayMaster: { ...chart.dayMaster, element: day }, pillars: chart.pillars.map((p, i) => (i === 1 ? { ...p, branch: { ...p.branch, element: month } } : p)) }, 2026).inSeason
    expect(fake('木', '水')).toBe(true)
    expect(fake('木', '木')).toBe(true)
    expect(fake('木', '火')).toBe(false)
  })

  it('names the heaviest 十神 groups, with words for each', () => {
    expect(reading.groups.length).toBeGreaterThan(0)
    expect(reading.groups.length).toBeLessThanOrEqual(2)
    for (const g of reading.groups) expect(GROUP_NOTE[g.group]).toBeTruthy()
    if (reading.groups[1]) expect(reading.groups[0].count).toBeGreaterThanOrEqual(reading.groups[1].count)
  })

  it('finds the 大运 of the year, and none before the first', () => {
    expect(reading.decade?.from).toBeLessThanOrEqual(2026)
    expect(reading.decade?.to).toBeGreaterThanOrEqual(2026)
    expect(TEN_STAR_NOTE[reading.decade!.tenStar!]).toBeTruthy()
    expect(baziReading(chart, 1990).decade).toBeUndefined()
  })
})
