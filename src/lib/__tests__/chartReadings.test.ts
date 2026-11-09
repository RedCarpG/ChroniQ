import { describe, expect, it } from 'vitest'
import { buildStarChart } from '../astrology'
import { starReading, ziweiReading } from '../chartReadings'
import { DEFAULT_PLACE } from '../place'
import { DEFAULT_STAR_SETTINGS } from '../starPrefs'
import { buildZiwei, sanFangSiZheng } from '../ziwei'
import { STAR_INFO } from '../ziweiInfo'
import { DEFAULT_ZIWEI_SCHOOLS } from '../ziweiSchools'

const INPUT = { year: 1990, month: 5, day: 15, hour: 10, minute: 30, gender: 1 as const }

describe('ziweiReading', () => {
  const chart = buildZiwei(INPUT, DEFAULT_ZIWEI_SCHOOLS)
  const reading = ziweiReading(chart, 2026)

  it('reads the 命宫, with words for its stars', () => {
    expect(reading.soul.isSoul).toBe(true)
    expect(reading.soul.name).toBe('命宫')
    expect(reading.soulStars.length).toBeGreaterThan(0)
    for (const s of reading.soulStars) expect(STAR_INFO[s.name]).toBeTruthy()
  })

  it('borrows the opposite palace’s stars for an empty 命宫', () => {
    const soul = Object.values(chart.palaces).find((p) => p.isSoul)!
    const empty = { ...chart, palaces: { ...chart.palaces, [soul.branch]: { ...soul, major: [] } } }
    const r = ziweiReading(empty, 2026)
    expect(r.borrowed).toBe(true)
    const opposite = chart.palaces[sanFangSiZheng(soul.branch).opposite]
    expect(r.soulStars.map((s) => s.name)).toEqual(opposite.major.map((s) => s.name))
    expect(reading.borrowed).toBe(soul.major.length === 0)
  })

  it('finds the four 生年四化, in order', () => {
    expect(reading.mutagens.map((m) => m.mutagen)).toEqual(['禄', '权', '科', '忌'])
  })

  it('finds the 大限 of the year, and none outside the chart', () => {
    expect(reading.decade?.from).toBeLessThanOrEqual(2026)
    expect(reading.decade?.to).toBeGreaterThanOrEqual(2026)
    expect(ziweiReading(chart, 1800).decade).toBeUndefined()
  })
})

describe('starReading', () => {
  const chart = buildStarChart(INPUT, DEFAULT_PLACE, DEFAULT_STAR_SETTINGS)
  const reading = starReading(chart)

  it('reads the Sun, the Moon and the Ascendant', () => {
    // 15 May: the Sun in Taurus
    expect(reading.sun.sign).toBe(1)
    expect(reading.moon.key).toBe('moon')
    expect(reading.ascSign).toBeGreaterThanOrEqual(0)
    expect(reading.ascSign).toBeLessThan(12)
  })

  it('counts the elements over the same ten planets as the chart tally', () => {
    // 1995-11-26 17:45, Beijing: six of the ten in 射手 (Pluto with them), three in 摩羯, Saturn in 双鱼
    const c = buildStarChart({ ...INPUT, year: 1995, month: 11, day: 26, hour: 17, minute: 45 }, DEFAULT_PLACE, DEFAULT_STAR_SETTINGS)
    const r = starReading(c)
    expect(r.elements).toEqual([{ key: 'fire', count: 6 }])
    expect(r.modalities).toEqual([{ key: '变动', count: 7 }])
  })

  it('counts by element and modality, and finds crowded houses', () => {
    expect(reading.elements[0].count).toBeGreaterThanOrEqual(2)
    expect(['基本', '固定', '变动']).toContain(reading.modalities[0].key)
    for (const c of reading.crowded) expect(c.planets.length).toBeGreaterThanOrEqual(3)
  })

  it('takes the tightest aspects of the Sun, the Moon or the Ascendant', () => {
    expect(reading.aspects.length).toBeLessThanOrEqual(3)
    for (const a of reading.aspects) expect(['sun', 'moon', 'asc'].some((k) => a.a.key === k || a.b.key === k)).toBe(true)
    const orbs = reading.aspects.map((a) => a.orb)
    expect(orbs).toEqual([...orbs].sort((a, b) => a - b))
  })
})
