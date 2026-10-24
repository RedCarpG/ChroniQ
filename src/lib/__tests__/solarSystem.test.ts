import { describe, expect, it } from 'vitest'
import { lightTime, orbits, planetsAt } from '../solarSystem'

describe('太阳系', () => {
  const at = (d: string) => Object.fromEntries(planetsAt(new Date(d)).map((p) => [p.key, p]))

  it('puts the planets at their known distances from the Sun', () => {
    const p = at('2026-01-01T00:00:00Z')
    expect(p.earth.sun).toBeGreaterThan(0.983)
    expect(p.earth.sun).toBeLessThan(0.984) // perihelion is in early January
    expect(p.mercury.sun).toBeGreaterThan(0.3)
    expect(p.mercury.sun).toBeLessThan(0.47)
    expect(p.jupiter.sun).toBeGreaterThan(4.9)
    expect(p.neptune.sun).toBeGreaterThan(29.7)
    expect(p.neptune.sun).toBeLessThan(30.4)
  })

  it('sees Earth from the Sun opposite to where the Sun is seen from Earth', () => {
    // March equinox 2026 (Mar 20 14:46 UT): the Sun at 0°, so Earth at 180° from the Sun
    const p = at('2026-03-20T14:46:00Z')
    expect(Math.abs(p.earth.lon - 180)).toBeLessThan(0.05)
  })

  it('flags retrograde motion: Mars around its January 2025 opposition', () => {
    expect(at('2025-01-16T00:00:00Z').mars.retrograde).toBe(true)
    expect(at('2025-06-01T00:00:00Z').mars.retrograde).toBe(false)
  })

  it('samples closed orbits', () => {
    const o = orbits(new Date('2026-01-01T00:00:00Z'), 60)
    const [x0, y0] = o.mars[0]
    expect(Math.hypot(x0, y0)).toBeCloseTo(at('2026-01-01T00:00:00Z').mars.sun, 1)
  })

  it('formats light time', () => {
    expect(lightTime(1)).toBe('8.3 分钟')
    expect(lightTime(30)).toBe('4.2 小时')
  })
})
