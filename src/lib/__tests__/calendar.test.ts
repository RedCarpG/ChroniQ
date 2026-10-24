import { describe, expect, it } from 'vitest'
import { buildMonthGrid, buildMonthStrip } from '../calendar'

const keys = (cells: { key: string }[]) => cells.map((c) => c.key)

describe('buildMonthStrip', () => {
  it('holds both months’ grids, sharing their common weeks', () => {
    // October → November 2026, weeks starting Monday
    const { cells, fromRow, toRow } = buildMonthStrip({ year: 2026, month: 10 }, { year: 2026, month: 11 }, 'mon')
    expect(fromRow).toBe(0)
    expect(toRow).toBeGreaterThan(0)
    expect(cells.length).toBe((toRow + 6) * 7)
    expect(keys(cells.slice(fromRow * 7, fromRow * 7 + 42))).toEqual(keys(buildMonthGrid(2026, 10, 'mon')))
    expect(keys(cells.slice(toRow * 7, toRow * 7 + 42))).toEqual(keys(buildMonthGrid(2026, 11, 'mon')))
  })

  it('works backwards and across a year, marking days in the month scrolled to', () => {
    const { cells, fromRow, toRow } = buildMonthStrip({ year: 2027, month: 1 }, { year: 2026, month: 12 }, 'sun')
    expect(toRow).toBe(0)
    expect(fromRow).toBeGreaterThan(0)
    expect(keys(cells.slice(fromRow * 7, fromRow * 7 + 42))).toEqual(keys(buildMonthGrid(2027, 1, 'sun')))
    expect(cells.filter((c) => c.inMonth).length).toBe(31) // December's days
  })
})
