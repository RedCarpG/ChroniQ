import { describe, expect, it } from 'vitest'
import { bodyFaces } from '../sky'

describe('bodyFaces: how the bodies look close up', () => {
  // Beijing, 2 November 2026: Venus just past inferior conjunction, Saturn's rings opening again
  const faces = bodyFaces(new Date('2026-11-02T13:30:00Z'), 39.9, 116.4)

  it('gives each body its phase', () => {
    expect(faces.sun!.lit).toBe(1)
    expect(faces.venus!.lit).toBeLessThan(0.05)
    expect(faces.jupiter!.lit).toBeGreaterThan(0.98)
    expect(faces.moon!.lit).toBeGreaterThan(0.3)
    expect(faces.moon!.lit).toBeLessThan(0.5)
  })

  it('tilts Saturn’s rings a few degrees open, a year after they were edge-on', () => {
    expect(faces.saturn!.ringTilt).toBeGreaterThan(4)
    expect(faces.saturn!.ringTilt).toBeLessThan(9)
  })

  it('places Jupiter’s four moons within their orbits, Io nearest and Callisto farthest out', () => {
    const moons = faces.jupiter!.moons!
    expect(moons.map((m) => m.name)).toEqual(['木卫一', '木卫二', '木卫三', '木卫四'])
    const most = [6.1, 9.7, 15.3, 26.9] // their orbits, in Jupiter radii
    moons.forEach((m, i) => expect(m.rj).toBeLessThanOrEqual(most[i]))
  })
})
