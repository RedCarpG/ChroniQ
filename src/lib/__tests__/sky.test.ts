import { describe, expect, it } from 'vitest'
import { formatAzimuth, skyAt, tracksAt } from '../sky'

const BEIJING = [39.9, 116.4] as const

describe('skyAt', () => {
  it('puts Polaris at about the latitude, due north', () => {
    const sky = skyAt(new Date('2026-01-15T14:00:00Z'), ...BEIJING)
    const polaris = sky.stars.find((s) => s.name === '北极星')!
    expect(polaris.alt).toBeGreaterThan(BEIJING[0] - 1.5)
    expect(polaris.alt).toBeLessThan(BEIJING[0] + 1.5)
    expect(Math.min(polaris.az, 360 - polaris.az)).toBeLessThan(2)
  })

  it('has the midsummer noon Sun high in the south', () => {
    // Solar noon in Beijing is about 04:14 UT
    const sky = skyAt(new Date('2024-06-21T04:14:00Z'), ...BEIJING)
    const sun = sky.bodies.find((b) => b.key === 'sun')!
    expect(sun.alt).toBeCloseTo(90 - BEIJING[0] + 23.44, 0)
    expect(Math.abs(sun.az - 180)).toBeLessThan(3)
    expect(sky.light).toBe('day')
  })

  it('keeps only stars above the horizon, and night is dark', () => {
    const sky = skyAt(new Date('2026-01-15T14:00:00Z'), ...BEIJING) // 22:00 local
    expect(sky.light).toBe('night')
    expect(sky.stars.length).toBeGreaterThan(500)
    expect(sky.stars.every((s) => s.alt >= 0)).toBe(true)
    // Sirius is up in the south-east on a winter evening
    const sirius = sky.stars.find((s) => s.name === '天狼星')!
    expect(sirius.alt).toBeGreaterThan(15)
    expect(sirius.az).toBeGreaterThan(130)
    expect(sirius.az).toBeLessThan(200)
  })

  it('gives the Moon its phase', () => {
    // Full moon 2026-03-03 11:38 UT
    const moon = skyAt(new Date('2026-03-03T12:00:00Z'), ...BEIJING).bodies.find((b) => b.key === 'moon')!
    expect(moon.lit).toBeGreaterThan(0.98)
  })
})

describe('tracksAt', () => {
  const hours = (from: string, n: number) =>
    Array.from({ length: n }, (_, i) => new Date(new Date(from).getTime() + i * 3600_000))

  it('gives every path body a position for every moment', () => {
    const times = hours('2026-01-15T00:00:00Z', 24)
    const tracks = tracksAt(times, ...BEIJING)
    expect(Object.keys(tracks).sort()).toEqual(['jupiter', 'mars', 'mercury', 'moon', 'saturn', 'sun', 'venus'])
    expect(Object.values(tracks).every((track) => track.length === 24)).toBe(true)
  })

  it('has the Sun rise, peak due south around solar noon, and set over a day', () => {
    // 2024-06-20 16:00 UT is local midnight in Beijing; solar noon is about 04:14 UT
    const times = hours('2024-06-20T16:00:00Z', 24)
    const sun = tracksAt(times, ...BEIJING).sun
    const top = sun.reduce((best, p, i) => (p.alt > sun[best].alt ? i : best), 0)
    expect(times[top].getUTCHours()).toBe(4)
    expect(Math.abs(sun[top].az - 180)).toBeLessThan(20)
    expect(sun.some((p) => p.alt < 0)).toBe(true)
    // above the horizon for about 15 hours at midsummer
    expect(sun.filter((p) => p.alt > 0).length).toBeGreaterThanOrEqual(14)
  })
})

describe('formatAzimuth', () => {
  it('names the nearest of eight directions', () => {
    expect(formatAzimuth(0)).toBe('北 0°')
    expect(formatAzimuth(134)).toBe('东南 134°')
    expect(formatAzimuth(359)).toBe('北 359°')
  })
})
