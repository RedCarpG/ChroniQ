import { describe, expect, it } from 'vitest'
import { buildStarChart, computeChart, formatLon, houseOf, synastry, toUtc } from '../astrology'
import { DEFAULT_STAR_SETTINGS } from '../starPrefs'

// Einstein, 1879-03-14 11:30 LMT Ulm (48°24′N, 10°E) = 10:50 UT.
// Published positions (Astrodatabank, Rodden rating AA), Placidus.
const einstein = computeChart(new Date(Date.UTC(1879, 2, 14, 10, 50)), 48.4, 10, DEFAULT_STAR_SETTINGS)
const at = (key: string) => einstein.points.find((p) => p.key === key)!

describe('星盘 positions', () => {
  it('matches a well-documented chart to within about 1′', () => {
    const expected: [string, string][] = [
      ['sun', '双鱼 23°30′'],
      ['moon', '射手 14°32′'],
      ['mercury', '白羊 3°09′'],
      ['venus', '白羊 16°59′'],
      ['mars', '摩羯 26°55′'],
      ['jupiter', '水瓶 27°29′'],
      ['saturn', '白羊 4°11′'],
      ['uranus', '处女 1°17′'],
      ['neptune', '金牛 7°52′'],
      ['pluto', '金牛 24°44′'],
    ]
    for (const [key, text] of expected) expect(formatLon(at(key).lon), key).toBe(text)
    // Angles: ASC 11°38′ 巨蟹, MC 12°49′ 双鱼 published; allow 2′ for ΔT and rounding.
    expect(Math.abs(einstein.asc - (90 + 11 + 38 / 60))).toBeLessThan(2 / 60)
    expect(Math.abs(einstein.mc - (330 + 12 + 49 / 60))).toBeLessThan(2 / 60)
    expect(at('uranus').retrograde).toBe(true)
    expect(at('sun').retrograde).toBe(false)
  })

  it('keeps the nodes opposite and the true node near the mean one', () => {
    expect(Math.abs(((at('southNode').lon - at('node').lon + 360) % 360) - 180)).toBeLessThan(1e-9)
    const mean = computeChart(einstein.utc, 48.4, 10, { ...DEFAULT_STAR_SETTINGS, node: 'mean' })
    const diff = Math.abs(((at('node').lon - mean.points.find((p) => p.key === 'node')!.lon + 540) % 360) - 180)
    expect(diff).toBeLessThan(2)
  })

  it('finds the tight aspects', () => {
    const names = einstein.aspects.map((a) => `${a.a.key}-${a.type.key}-${a.b.key}`)
    expect(names).toContain('mercury-conjunction-saturn')
    expect(names).toContain('sun-sextile-pluto')
    for (const a of einstein.aspects) expect(a.orb).toBeLessThanOrEqual(10)
  })
})

describe('星盘 houses', () => {
  it('builds Whole Sign and Equal houses from the ascendant', () => {
    const whole = computeChart(einstein.utc, 48.4, 10, { ...DEFAULT_STAR_SETTINGS, houses: 'whole' })
    expect(whole.cusps[0]).toBe(90) // 巨蟹 0°
    expect(whole.cusps[6]).toBe(270)
    const equal = computeChart(einstein.utc, 48.4, 10, { ...DEFAULT_STAR_SETTINGS, houses: 'equal' })
    expect(equal.cusps[3]).toBeCloseTo((einstein.asc + 90) % 360, 9)
  })

  it('puts Placidus angles on the cusps and keeps cusps in order', () => {
    expect(einstein.cusps[0]).toBeCloseTo(einstein.asc, 9)
    expect(einstein.cusps[9]).toBeCloseTo(einstein.mc, 9)
    for (let i = 0; i < 12; i++) {
      const span = (einstein.cusps[(i + 1) % 12] - einstein.cusps[i] + 360) % 360
      expect(span).toBeGreaterThan(10)
      expect(span).toBeLessThan(60)
    }
    expect(houseOf(einstein.asc + 0.01, einstein.cusps)).toBe(1)
    expect(houseOf(einstein.mc - 0.01, einstein.cusps)).toBe(9)
  })
})

describe('星盘 time zones', () => {
  it('applies China daylight saving (1986–1991) and Beijing time otherwise', () => {
    expect(toUtc({ year: 1990, month: 7, day: 1, hour: 12, minute: 0 }, 'Asia/Shanghai')).toEqual({
      date: new Date(Date.UTC(1990, 6, 1, 3)),
      offsetMinutes: 540,
    })
    expect(toUtc({ year: 1990, month: 12, day: 1, hour: 12, minute: 0 }, 'Asia/Shanghai').offsetMinutes).toBe(480)
    expect(toUtc({ year: 2026, month: 7, day: 1, hour: 12, minute: 0 }, 'Asia/Shanghai').offsetMinutes).toBe(480)
  })

  it('casts from wall-clock time at a city', () => {
    const chart = buildStarChart({ year: 1997, month: 11, day: 2, hour: 9, minute: 30 }, {
      name: '北京',
      latitude: 39.9,
      longitude: 116.41,
      timeZone: 'Asia/Shanghai',
    }, DEFAULT_STAR_SETTINGS)
    expect(chart.utc.toISOString()).toBe('1997-11-02T01:30:00.000Z')
    // Sun in 天蝎 around 9–10°, rising sign 射手 on a November morning in Beijing
    expect(formatLon(chart.points.find((p) => p.key === 'sun')!.lon)).toMatch(/^天蝎 9°/)
    expect(Math.floor(chart.asc / 30)).toBe(8)
  })
})

describe('星盘 overseas places', () => {
  const wall = (year: number, month: number, day: number, hour = 12) => ({ year, month, day, hour, minute: 0 })
  const place = (timeZone: string, latitude = 40, longitude = 0) => ({ name: 'x', latitude, longitude, timeZone })

  it('follows each zone’s daylight saving, both hemispheres', () => {
    const ny = buildStarChart(wall(1990, 7, 1), place('America/New_York', 40.71, -74.01), DEFAULT_STAR_SETTINGS)
    expect(ny.offsetMinutes).toBe(-240)
    expect(ny.dst).toBe(true)
    expect(buildStarChart(wall(1990, 1, 15), place('America/New_York'), DEFAULT_STAR_SETTINGS).dst).toBe(false)
    // Southern summer: Sydney is on daylight time in January
    const syd = buildStarChart(wall(2000, 1, 15), place('Australia/Sydney', -33.87, 151.21), DEFAULT_STAR_SETTINGS)
    expect(syd.offsetMinutes).toBe(660)
    expect(syd.dst).toBe(true)
    expect(buildStarChart(wall(2000, 7, 15), place('Australia/Sydney'), DEFAULT_STAR_SETTINGS).dst).toBe(false)
  })

  it('handles half-hour zones and labels them', async () => {
    const { formatOffset, formatCoords } = await import('../astrology')
    const india = buildStarChart(wall(2000, 1, 1), place('Asia/Kolkata', 28.61, 77.21), DEFAULT_STAR_SETTINGS)
    expect(india.offsetMinutes).toBe(330)
    expect(formatOffset(india.offsetMinutes)).toBe('UTC+5:30')
    expect(formatOffset(-240)).toBe('UTC−4')
    expect(formatCoords(-33.87, -70.67)).toBe('33.87°S 70.67°W')
  })

  it('falls back to equal houses inside the polar circles', () => {
    const north = buildStarChart(wall(2000, 6, 21), place('Europe/Oslo', 70, 25), DEFAULT_STAR_SETTINGS)
    expect(north.housesFallback).toBe(true)
    for (let i = 0; i < 12; i++) expect(north.cusps[i]).toBeCloseTo((north.asc + i * 30) % 360, 9)
    expect(buildStarChart(wall(2000, 6, 21), place('Europe/Oslo', 59.91, 10.75), DEFAULT_STAR_SETTINGS).housesFallback).toBe(false)
  })

  it('lists every city once, with a zone the runtime knows', async () => {
    const { WORLD_CITIES } = await import('../worldCities')
    const { CITIES } = await import('../solarTime')
    const all = [...CITIES, ...WORLD_CITIES.flatMap((r) => r.cities)]
    expect(new Set(all.map((c) => c.name)).size).toBe(all.length)
    for (const c of all) {
      expect(() => new Intl.DateTimeFormat('en', { timeZone: c.timeZone ?? 'Asia/Shanghai' }), c.name).not.toThrow()
      expect(Math.abs(c.latitude)).toBeLessThan(70)
    }
  })
})

describe('星盘 行运 and 推运', () => {
  const ulm = { name: 'Ulm', latitude: 48.4, longitude: 10, timeZone: 'UTC' }
  const natal = { ...einstein, offsetMinutes: 0, dst: false, place: ulm }

  it('places transiting planets for a moment, in the natal houses', async () => {
    const { transits } = await import('../astrology')
    // J2000.0: the Sun's apparent longitude is about 280.37° (摩羯 10°22′)
    const t = transits(natal, new Date(Date.UTC(2000, 0, 1, 12)), DEFAULT_STAR_SETTINGS)
    const sun = t.points.find((p) => p.key === 'sun')!
    expect(formatLon(sun.lon)).toMatch(/^摩羯 10°2/)
    expect(sun.house).toBe(houseOf(sun.lon, einstein.cusps))
    expect(t.age).toBeCloseTo(120.8, 1)
    for (const a of t.aspects) expect(a.orb).toBeLessThanOrEqual(2)
  })

  it('progresses one day per year of life', async () => {
    const { progressions } = await import('../astrology')
    const target = new Date(einstein.utc.getTime() + 30 * 365.24219 * 86400000)
    const p = progressions(natal, target, DEFAULT_STAR_SETTINGS)
    expect(p.age).toBeCloseTo(30, 9)
    expect((p.progressedUtc!.getTime() - einstein.utc.getTime()) / 86400000).toBeCloseTo(30, 6)
    const sun = p.points.find((x) => x.key === 'sun')!.lon
    const arc = (sun - at('sun').lon + 360) % 360 // 双鱼 23° → 白羊, across 0°
    expect(arc).toBeGreaterThan(29)
    expect(arc).toBeLessThan(31)
    // Solar arc: the MC moves exactly as far as the progressed Sun
    expect(p.points.find((x) => x.key === 'mc')!.lon).toBeCloseTo((einstein.mc + arc) % 360, 6)
    // Naibod: 0.98564736° per year
    const n = progressions(natal, target, { ...DEFAULT_STAR_SETTINGS, progAngles: 'naibod' })
    expect(n.points.find((x) => x.key === 'mc')!.lon).toBeCloseTo((einstein.mc + 30 * 0.98564736) % 360, 6)
    for (const a of p.aspects) expect(a.orb).toBeLessThanOrEqual(1)
  })

  it('starts the progressed angles at the natal ones', async () => {
    const { progressions } = await import('../astrology')
    const p = progressions(natal, new Date(einstein.utc.getTime() + 1000), DEFAULT_STAR_SETTINGS)
    expect(p.points.find((x) => x.key === 'asc')!.lon).toBeCloseTo(einstein.asc, 3)
    expect(p.points.find((x) => x.key === 'mc')!.lon).toBeCloseTo(einstein.mc, 3)
  })
})

describe('合盘', () => {
  const place = { name: '北京', latitude: 39.9, longitude: 116.4, timeZone: 'Asia/Shanghai' }
  const a = buildStarChart({ year: 1990, month: 5, day: 1, hour: 8, minute: 0 }, place, DEFAULT_STAR_SETTINGS)
  const b = buildStarChart({ year: 1992, month: 9, day: 20, hour: 21, minute: 30 }, place, DEFAULT_STAR_SETTINGS)

  it('with oneself, every point conjoins its own place', () => {
    const s = synastry(a, a)
    const generational = ['uranus', 'neptune', 'pluto', 'node', 'southNode']
    for (const p of a.points.filter((p) => !generational.includes(p.key)))
      expect(s.aspects.some((x) => x.a.key === p.key && x.b.key === p.key && x.type.key === 'conjunction')).toBe(true)
    expect(s.inPartnerHouses!.map((p) => p.house)).toEqual(a.points.map((p) => p.house))
  })

  const generational = (k: string) => ['uranus', 'neptune', 'pluto'].includes(k)

  it('puts their points in my houses and mine in theirs, at synastry orbs', () => {
    const s = synastry(a, b)
    for (const p of s.points) expect(p.house).toBe(houseOf(p.lon, a.cusps))
    for (const p of s.inPartnerHouses!) expect(p.house).toBe(houseOf(p.lon, b.cusps))
    for (const x of s.aspects) expect(x.orb).toBeLessThanOrEqual(x.type.orb - 2)
    expect(s.aspects.some((x) => generational(x.a.key) && generational(x.b.key))).toBe(false)
    // The pair is symmetric: the same aspects either way round
    expect(synastry(b, a).aspects.length).toBe(s.aspects.length)
  })
})
