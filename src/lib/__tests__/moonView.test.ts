import { describe, expect, it } from 'vitest'
import { heightsAround, lunation, moonAge, moonTimes, moonView, nextApsis, wallOf } from '../moonView'

// Beijing, and the full Moon of 3 March 2026 (11:38 UT, a total lunar eclipse) after the new Moon of
// 17 February (12:01 UT, an annular eclipse of the Sun)
const BEIJING = [39.9, 116.4] as const
const FULL = new Date('2026-03-03T11:38:00Z')

const deg = (r: number) => (r * 180) / Math.PI
const diff = (a: number, b: number) => ((((a - b) % 360) + 540) % 360) - 180

describe('观月: the Moon from a place', () => {
  it('knows the full Moon: its phase, its age, and the Sun behind the viewer', () => {
    const m = moonView(FULL, ...BEIJING)
    expect(Math.abs(m.phase - 180)).toBeLessThan(0.5)
    expect(m.lit).toBeGreaterThan(0.99)
    expect(moonAge(FULL)).toBeGreaterThan(13.9)
    expect(moonAge(FULL)).toBeLessThan(14.1)
    expect(m.frame.sun[2]).toBeGreaterThan(0.99)
    expect(m.distanceKm).toBeGreaterThan(356_000)
    expect(m.distanceKm).toBeLessThan(407_000)
  })

  it('turns the Moon’s near side to the viewer, off centre by its libration', () => {
    for (const day of [0, 5, 10, 20]) {
      const m = moonView(new Date(FULL.getTime() + day * 86_400_000), ...BEIJING)
      const [x, y] = m.frame.body
      // The viewer's direction (screen z) in the Moon's own axes: the point of the Moon facing us
      const lon = deg(Math.atan2(y[2], x[2]))
      const lat = deg(Math.asin(m.frame.body[2][2]))
      // As astronomy-engine's (geocentric, optical) libration, within what the viewer's place adds
      expect(Math.abs(diff(lon, m.libration.lon))).toBeLessThan(1.5)
      expect(Math.abs(lat - m.libration.lat)).toBeLessThan(1.5)
    }
  })

  it('lights the limb towards the Sun, turned by the parallactic angle for a zenith-up view', () => {
    for (const hours of [3, 30, 100, 200, 500]) {
      const m = moonView(new Date(FULL.getTime() + hours * 3_600_000), ...BEIJING)
      if (m.lit > 0.98 || m.lit < 0.02) continue
      // The sunlight's direction on screen, counted from up towards the left (the sky's east)
      const onScreen = deg(Math.atan2(-m.frame.sun[0], m.frame.sun[1]))
      expect(Math.abs(diff(onScreen, m.brightLimb - m.parallactic))).toBeLessThan(1)
    }
  })

  it('finds the lunation, with its quarters in order, and the age from its new Moon', () => {
    const l = lunation(FULL)
    expect(Math.abs(l.start.getTime() - Date.parse('2026-02-17T12:01:00Z'))).toBeLessThan(5 * 60_000)
    expect(l.quarters.map((q) => q.name)).toEqual(['朔', '上弦', '望', '下弦', '朔'])
    expect(moonAge(l.start)).toBeCloseTo(0, 5)
  })

  it('times moonrise, culmination and moonset on a local date', () => {
    const t = moonTimes({ year: 2026, month: 3, day: 3 }, ...BEIJING, 'Asia/Shanghai')
    // The full Moon rises about sunset and sets about sunrise
    const hour = (d: Date | null) => wallOf(d!, 'Asia/Shanghai').hour
    expect(hour(t.rise)).toBeGreaterThanOrEqual(17)
    expect(hour(t.rise)).toBeLessThanOrEqual(19)
    expect(hour(t.set)).toBeGreaterThanOrEqual(5)
    expect(hour(t.set)).toBeLessThanOrEqual(7)
  })

  it('samples the heights from the local noon before to the noon after', () => {
    const h = heightsAround(new Date('2026-03-03T16:00:00Z'), ...BEIJING, 'Asia/Shanghai')
    expect(wallOf(h.start, 'Asia/Shanghai')).toMatchObject({ day: 3, hour: 12, minute: 0 })
    expect(wallOf(h.end, 'Asia/Shanghai')).toMatchObject({ day: 4, hour: 12, minute: 0 })
    expect(h.samples).toHaveLength(97)
    // The full Moon is up through the night and down at noon, the Sun the other way round
    const midnight = h.samples[48]
    expect(midnight.moon).toBeGreaterThan(30)
    expect(midnight.sun).toBeLessThan(-30)
    // Before noon, the window is the day before's
    expect(wallOf(heightsAround(new Date('2026-03-03T02:00:00Z'), ...BEIJING, 'Asia/Shanghai').start, 'Asia/Shanghai').day).toBe(2)
  })

  it('finds the next perigee or apogee', () => {
    const a = nextApsis(FULL)
    expect(a.time.getTime()).toBeGreaterThan(FULL.getTime())
    expect(a.time.getTime() - FULL.getTime()).toBeLessThan(15 * 86_400_000)
    expect(a.distanceKm).toBeGreaterThan(a.kind === 'perigee' ? 355_000 : 403_000)
  })
})
