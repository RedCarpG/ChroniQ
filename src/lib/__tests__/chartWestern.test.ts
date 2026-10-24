import { describe, expect, it } from 'vitest'
import { westernYear } from '../chartWestern'
import type { SavedChart } from '../savedCharts'

// 1990-05-15 10:30 Beijing: Sun at about 24° Taurus
const chart: SavedChart = { id: 'a', name: '张三', input: { year: 1990, month: 5, day: 15, hour: 10, minute: 30, gender: 1 } }
const all = (year: number) => [...westernYear(chart, year).entries()].flatMap(([date, days]) => days.map((d) => ({ date, ...d })))

describe('星盘 dates', () => {
  it('puts the solar return within a day of the birthday', () => {
    const returns = all(2026).filter((d) => d.kind === 'solarReturn')
    expect(returns).toHaveLength(1)
    expect(['5-14', '5-15', '5-16']).toContain(returns[0].date)
  })

  it('finds Saturn reaching the natal Sun (Taurus) around 2029–2030', () => {
    const hits = [2028, 2029, 2030].flatMap((y) =>
      all(y).filter((d) => d.kind === 'transit' && d.planet === 'saturn' && d.aspect === 'conjunction' && d.point === 'sun'),
    )
    expect(hits.length).toBeGreaterThanOrEqual(1)
    expect(hits.length).toBeLessThanOrEqual(3) // once, or three times with a retrograde
  })

  it('finds only a handful of exact slow-planet aspects a year', () => {
    const transits = all(2026).filter((d) => d.kind === 'transit')
    expect(transits.length).toBeGreaterThan(0)
    expect(transits.length).toBeLessThan(40)
  })
})
