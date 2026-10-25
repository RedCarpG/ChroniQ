import * as A from 'astronomy-engine'
import { SolarDay } from 'tyme4ts'
import { describe, expect, it } from 'vitest'
import { litPath, moonOf } from '../moon'

const days = (y: number, m: number, d: number, count: number, step = 1) =>
  Array.from({ length: count }, (_, i) => SolarDay.fromYmd(y, m, d).next(i * step))

describe('moonOf', () => {
  it('names each day as tyme4ts does, across the years', () => {
    for (const day of days(1951, 3, 7, 60, 613)) expect(moonOf(day).name, day.toString()).toBe(day.getPhase().getName())
  })

  it('gives the 朔望弦 their day and time (北京时间)', () => {
    // October 2026: 下弦 3rd 21:25, 朔 10th 23:50, 上弦 19th 00:12, 望 26th 12:11
    const quarters = days(2026, 10, 1, 31)
      .map((d) => [d.getDay(), moonOf(d)] as const)
      .filter(([, m]) => m.time)
      .map(([day, m]) => [day, m.name, m.time, m.angle])
    expect(quarters).toEqual([
      [3, '下弦月', '21:25', 270],
      [10, '新月', '23:50', 0],
      [19, '上弦月', '00:12', 90],
      [26, '满月', '12:11', 180],
    ])
  })

  it('is within a few degrees of the Moon’s true elongation at the day’s noon', () => {
    for (const day of days(2024, 1, 1, 200, 7)) {
      if (moonOf(day).time) continue
      const noon = new Date(Date.UTC(day.getYear(), day.getMonth() - 1, day.getDay(), 4)) // 12:00 北京时间
      const off = Math.abs(((moonOf(day).angle - A.MoonPhase(noon) + 540) % 360) - 180)
      expect(off, day.toString()).toBeLessThan(6)
    }
  })

  it('lights the disc from nothing to full and back', () => {
    const lit = days(2026, 10, 10, 30).map((d) => moonOf(d).lit)
    expect(lit[0]).toBe(0)
    expect(Math.max(...lit)).toBe(1)
    expect(lit.slice(0, 16).every((x, i) => i === 0 || x >= lit[i - 1])).toBe(true)
  })
})

describe('litPath', () => {
  it('draws nothing at new moon, a half at the quarters and the whole disc at full', () => {
    expect(litPath(0, 5)).toBe('')
    // 上弦 lit on the right (the limb drawn clockwise), 下弦 on the left; a straight terminator
    expect(litPath(90, 5)).toMatch(/^M0 -5A5 5 0 0 1 0 5A0\.00 /)
    expect(litPath(270, 5)).toMatch(/^M0 -5A5 5 0 0 0 0 5A0\.00 /)
    // 望: two half circles, round both sides
    expect(litPath(180, 5)).toBe('M0 -5A5 5 0 0 0 0 5A5.00 5 0 0 0 0 -5Z')
  })

  it('bulges the terminator toward the lit side for a crescent, away from it when gibbous', () => {
    // Waxing, lit on the right: the terminator back up passes right (sweep 0) for a crescent, left (1) when gibbous
    expect(litPath(45, 5)).toBe('M0 -5A5 5 0 0 1 0 5A3.54 5 0 0 0 0 -5Z')
    expect(litPath(135, 5)).toBe('M0 -5A5 5 0 0 1 0 5A3.54 5 0 0 1 0 -5Z')
    // Waning, lit on the left: mirrored
    expect(litPath(315, 5)).toBe('M0 -5A5 5 0 0 0 0 5A3.54 5 0 0 1 0 -5Z')
    expect(litPath(225, 5)).toBe('M0 -5A5 5 0 0 0 0 5A3.54 5 0 0 0 0 -5Z')
  })
})
