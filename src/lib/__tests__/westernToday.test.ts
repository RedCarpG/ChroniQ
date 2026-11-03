import * as A from 'astronomy-engine'
import { describe, expect, it } from 'vitest'
import { bodyLon } from '../astrology'
import { DEFAULT_STAR_SETTINGS } from '../starPrefs'
import { moonNextSign, transitsToday, westernToday } from '../westernToday'

describe('westernToday', () => {
  it('has the Sun in Scorpio in early November, and Mercury retrograde in its 2024 station', () => {
    const day = westernToday(new Date('2024-11-30T12:00:00Z'), DEFAULT_STAR_SETTINGS)
    expect(day.sun.sign).toBe(8) // Sagittarius from 21 November
    expect(day.retrograde.map((p) => p.key)).toContain('mercury')
    expect(westernToday(new Date('2026-11-03T12:00:00Z'), DEFAULT_STAR_SETTINGS).sun.sign).toBe(7)
  })

  it('keeps only tight aspects among the planets', () => {
    const day = westernToday(new Date('2020-12-21T18:00:00Z'), DEFAULT_STAR_SETTINGS)
    // The great conjunction of 2020
    expect(day.aspects.some((a) => [a.a.key, a.b.key].sort().join() === 'jupiter,saturn' && a.type.key === 'conjunction')).toBe(true)
    for (const a of day.aspects) expect(a.orb).toBeLessThanOrEqual(1.5)
  })
})

describe('moonNextSign', () => {
  it('finds the minute the Moon crosses into the next sign', () => {
    const now = new Date('2026-11-03T00:00:00Z')
    const next = moonNextSign(now)!
    expect(next.at).toBeGreaterThan(now.getTime())
    expect(next.at - now.getTime()).toBeLessThan(62 * 3600_000)
    const lon = (ms: number) => bodyLon(A.Body.Moon, A.MakeTime(new Date(ms)))
    expect(Math.floor(lon(next.at + 60_000) / 30)).toBe(next.sign)
    expect(Math.floor(lon(next.at - 120_000) / 30)).not.toBe(next.sign)
  })
})

describe('transitsToday', () => {
  it('gives the tightest transits to a chart, without the Moon', () => {
    const { aspects } = transitsToday({ year: 1990, month: 5, day: 15, hour: 10, minute: 30, gender: 1 }, new Date('2026-11-03T12:00:00Z'), DEFAULT_STAR_SETTINGS)
    expect(aspects.length).toBeLessThanOrEqual(3)
    for (const a of aspects) expect(a.a.key).not.toBe('moon')
    const orbs = aspects.map((a) => a.orb)
    expect(orbs).toEqual([...orbs].sort((x, y) => x - y))
  })
})
