import { describe, expect, it } from 'vitest'
import { toUtc } from '../timeZone'

describe('local clock changes', () => {
  it('uses earlier for an overlap and forward for a gap', () => {
    const gap = toUtc({ year: 2024, month: 3, day: 10, hour: 2, minute: 30 }, 'America/New_York')
    expect(gap.resolution).toBe('gap')
    expect(gap.date.toISOString()).toBe('2024-03-10T07:30:00.000Z')
    const overlap = toUtc({ year: 2024, month: 11, day: 3, hour: 1, minute: 30 }, 'America/New_York')
    expect(overlap.resolution).toBe('overlap')
    expect(overlap.date.toISOString()).toBe('2024-11-03T05:30:00.000Z')
  })
  it('handles half-hour DST transitions', () => {
    const gap = toUtc({ year: 2024, month: 10, day: 6, hour: 2, minute: 15 }, 'Australia/Lord_Howe')
    expect(gap.resolution).toBe('gap')
    expect(gap.date.toISOString()).toBe('2024-10-05T15:45:00.000Z')
  })
  it('handles a skipped whole day', () => {
    const gap = toUtc({ year: 2011, month: 12, day: 30, hour: 12, minute: 0 }, 'Pacific/Apia')
    expect(gap.resolution).toBe('gap')
    expect(gap.date.toISOString()).toBe('2011-12-30T22:00:00.000Z')
  })
  it('preserves exact wall times in fractional-offset zones', () => {
    const exact = toUtc({ year: 2024, month: 1, day: 1, hour: 0, minute: 0 }, 'Asia/Kathmandu')
    expect(exact.resolution).toBe('exact')
    expect(exact.date.toISOString()).toBe('2023-12-31T18:15:00.000Z')
  })
})
