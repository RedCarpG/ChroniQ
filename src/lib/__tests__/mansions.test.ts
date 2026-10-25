import { describe, expect, it } from 'vitest'
import { MANSIONS, mansionOf, mansionWidth, toGuDu } from '../mansions'
import { XINGGUAN } from '../xingguan'

describe('二十八宿', () => {
  it('has 28 mansions, seven to each 四象, running eastward round the sky', () => {
    expect(MANSIONS).toHaveLength(28)
    for (const zone of ['east', 'north', 'west', 'south']) expect(MANSIONS.filter((m) => m.zone === zone)).toHaveLength(7)
    const total = MANSIONS.reduce((sum, _, i) => sum + mansionWidth(i), 0)
    expect(total).toBeCloseTo(360, 6)
  })

  it('gives the familiar widths: 井 the widest, 觜 and 鬼 the narrowest', () => {
    const widths = MANSIONS.map((m, i) => [m.char, mansionWidth(i)] as const)
    const sorted = [...widths].sort((a, b) => b[1] - a[1])
    expect(sorted[0][0]).toBe('井')
    expect(sorted.slice(-2).map(([c]) => c).sort()).toEqual(['觜', '鬼'].sort())
    // 井 is about 33 古度 in the old tables
    expect(toGuDu(mansionWidth(MANSIONS.findIndex((m) => m.char === '井')))).toBeGreaterThan(30)
  })

  it('finds the mansion of a right ascension', () => {
    expect(mansionOf(201.3).mansion.char).toBe('角') // Spica, 角宿一 itself
    expect(mansionOf(200).mansion.char).toBe('轸') // just west of it
    expect(mansionOf(0).mansion.char).toBe('室') // the March equinox point
    expect(mansionOf(359.9).mansion.char).toBe('室')
    expect(mansionOf(5).mansion.char).toBe('壁')
  })

  it('matches the 星官 figures: each mansion has one, and its 距星 is one of the figure’s stars', () => {
    for (const m of MANSIONS) {
      const figure = XINGGUAN.find((c) => c.name === m.name)
      expect(figure?.rank, m.name).toBe(1)
      const points = figure!.lines.flatMap((l) => l.flatMap((_, i) => (i % 2 ? [] : [[l[i], l[i + 1]]])))
      expect(points.some(([ra, dec]) => Math.abs(ra - m.ra) < 0.05 && Math.abs(dec - m.dec) < 0.05), m.name).toBe(true)
    }
  })
})
