import { describe, expect, it } from 'vitest'
import { computeSkyEvents, eclipseShade, localDate, type SkyEvent } from '../skyEvents'

const BEIJING = { latitude: 39.9, longitude: 116.4, timeZone: 'Asia/Shanghai' }
const NASHVILLE = { latitude: 36.16, longitude: -86.78, timeZone: 'America/Chicago' }
const SYDNEY = { latitude: -33.87, longitude: 151.21, timeZone: 'Australia/Sydney' }

const ofKind = <K extends SkyEvent['kind']>(events: SkyEvent[], kind: K) => events.filter((e): e is Extract<SkyEvent, { kind: K }> => e.kind === kind)

describe('computeSkyEvents', () => {
  it('finds the eclipse of the Sun of 21 August 2017 where it was total, and not where it missed', () => {
    const total = ofKind(computeSkyEvents(2017, NASHVILLE), 'solarEclipse').find((e) => e.date === '2017-08-21')
    expect(total?.type).toBe('total')
    expect(total?.altitude).toBeGreaterThan(50)
    expect(ofKind(computeSkyEvents(2017, BEIJING), 'solarEclipse').find((e) => e.date === '2017-08-21')).toBeUndefined()
  })

  it('keeps an eclipse of the Moon only where the Moon is up', () => {
    // 8 November 2022: total, over the Pacific; Beijing had the Moon rising into it, London nothing
    const here = ofKind(computeSkyEvents(2022, BEIJING), 'lunarEclipse').find((e) => e.date === '2022-11-08')
    expect(here?.type).toBe('total')
    expect(here?.altitude).toBeGreaterThan(0)
    const london = { latitude: 51.5, longitude: -0.12, timeZone: 'Europe/London' }
    expect(ofKind(computeSkyEvents(2022, london), 'lunarEclipse').find((e) => e.date.startsWith('2022-11'))).toBeUndefined()
  })

  it('dates oppositions and greatest elongations', () => {
    const events = computeSkyEvents(2023, BEIJING)
    expect(ofKind(events, 'opposition').find((e) => e.body === 'Jupiter')?.date).toMatch(/^2023-11-0[23]/)
    const venus = ofKind(events, 'elongation').filter((e) => e.body === 'Venus')
    expect(venus.map((e) => e.side)).toEqual(['evening', 'morning'])
    expect(venus[0].date).toMatch(/^2023-06-0[345]/)
    expect(venus[0].degrees).toBeGreaterThan(44)
  })

  it('finds the great conjunction of 2020, seen in the evening', () => {
    const great = ofKind(computeSkyEvents(2020, BEIJING), 'conjunction').find((e) => e.body === 'Jupiter' && e.other === 'Saturn')
    expect(great?.date).toMatch(/^2020-12-2[012]/)
    expect(great?.degrees).toBeLessThan(0.2)
  })

  it('finds the showers at their dates, in the dark, with the Moon counted', () => {
    const showers = ofKind(computeSkyEvents(2024, BEIJING), 'meteors')
    const perseids = showers.find((e) => e.shower === 'PER')
    expect(perseids?.date).toMatch(/^2024-08-1[23]/)
    expect(showers.find((e) => e.shower === 'GEM')?.date).toMatch(/^2024-12-1[345]/)
    // The Geminids of 2024 fell by a nearly full Moon
    expect(showers.find((e) => e.shower === 'GEM')?.moonLit).toBeGreaterThan(0.9)
  })

  it('leaves out a shower whose radiant stays low here', () => {
    const shower = (place: typeof BEIJING) => ofKind(computeSkyEvents(2024, place), 'meteors').map((e) => e.shower)
    expect(shower(BEIJING)).toContain('QUA')
    expect(shower(SYDNEY)).not.toContain('QUA')
  })

  it('finds the supermoons of a year', () => {
    const moons = ofKind(computeSkyEvents(2024, BEIJING), 'supermoon')
    // Full on 18 September and 17 October; the Moon is highest in the night around that, here either side of it
    expect(moons.map((e) => e.date)).toEqual(['2024-09-17', '2024-10-18'])
    for (const m of moons) expect(m.km).toBeLessThanOrEqual(360_000)
  })

  it('keeps to the year, in order, with stable ids', () => {
    const events = computeSkyEvents(2025, BEIJING)
    expect(events.every((e) => e.date.startsWith('2025-'))).toBe(true)
    expect(events.map((e) => e.time)).toEqual([...events.map((e) => e.time)].sort((a, b) => a - b))
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length)
    expect(computeSkyEvents(2025, BEIJING).map((e) => e.id)).toEqual(events.map((e) => e.id))
  })
})

describe('localDate', () => {
  it('gives the date in the zone', () => {
    const ms = Date.UTC(2024, 11, 31, 20)
    expect(localDate(ms, 'Asia/Shanghai')).toBe('2025-01-01')
    expect(localDate(ms, 'America/New_York')).toBe('2024-12-31')
  })
})

describe('eclipseShade', () => {
  const total = ofKind(computeSkyEvents(2022, BEIJING), 'lunarEclipse').find((e) => e.date === '2022-11-08')!

  it('is nothing outside the eclipse', () => {
    expect(eclipseShade(total, total.start - 1)).toBeNull()
    expect(eclipseShade(total, total.end + 1)).toBeNull()
  })

  it('moves from touching to covering the body by the peak', () => {
    const start = eclipseShade(total, total.start)!
    const peak = eclipseShade(total, total.peak)!
    expect(peak.body).toBe('moon')
    expect(start.offset).toBeCloseTo(start.radius + 1)
    expect(peak.offset).toBe(0)
  })

  it('leaves a partial eclipse of the Sun part uncovered at its peak', () => {
    const shade = eclipseShade({ kind: 'solarEclipse', type: 'partial', obscuration: 0.5, peak: 10, start: 0, end: 20, id: '', date: '', time: 10, minutes: 20, altitude: 30, azimuth: 0 }, 10)!
    expect(shade.body).toBe('sun')
    expect(shade.offset).toBeCloseTo(1)
  })
})
