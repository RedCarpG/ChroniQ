import { describe, expect, it } from 'vitest'
import { cameraFor, dirOf, groundOf, projectDir, projectXYZ, turnCamera, unproject, viewShift, type DomeView } from '../domeProjection'
import { directionsAt, horizonMatrix } from '../sky'

const at = (): [number, number] => [0, 0]

describe('domeProjection', () => {
  const view: DomeView = { az: 200, alt: 30, fov: 90 }
  const cam = cameraFor(view, 390, 844)

  it('puts the way one looks in the middle, up above it and right to the right', () => {
    const p = at()
    expect(projectDir(cam, dirOf(200, 30), p)).toBe(true)
    expect(p[0]).toBeCloseTo(195)
    expect(p[1]).toBeCloseTo(422)
    projectDir(cam, dirOf(200, 50), p)
    expect(p[1]).toBeLessThan(422)
    // Facing south-south-west, west is to the right
    projectDir(cam, dirOf(230, 30), p)
    expect(p[0]).toBeGreaterThan(195)
  })

  it('spans the field of view across the shorter side', () => {
    const p = at()
    projectDir(cam, dirOf(200, 30 + 45), p)
    expect(422 - p[1]).toBeCloseTo(195, 0)
  })

  it('takes a point on the screen back to its direction', () => {
    const p = at()
    for (const [az, alt] of [[150, 10], [260, -20], [200, 80], [120, 45]]) {
      const v = dirOf(az, alt)
      expect(projectDir(cam, v, p)).toBe(true)
      const back = unproject(cam, p[0], p[1])
      for (let i = 0; i < 3; i++) expect(back[i]).toBeCloseTo(v[i], 6)
    }
  })

  it('leaves out what is far behind', () => {
    expect(projectDir(cam, dirOf(20, -30), at())).toBe(false)
  })

  it('draws the horizon as a circle the ground lies outside of looking up, inside looking down', () => {
    for (const alt of [30, -25]) {
      const v = { ...view, alt }
      const c = cameraFor(v, 390, 844)
      const g = groundOf(c, v)
      expect(g.kind).toBe('circle')
      if (g.kind !== 'circle') continue
      expect(g.inside).toBe(alt < 0)
      const p = at()
      for (const az of [150, 180, 230, 260]) {
        projectDir(c, dirOf(az, 0), p)
        expect(Math.hypot(p[0] - g.x, p[1] - g.y)).toBeCloseTo(g.r, 3)
      }
      // The nadir is on the ground's side
      if (projectDir(c, [0, 0, -1], p)) expect(Math.hypot(p[0] - g.x, p[1] - g.y) < g.r).toBe(g.inside)
    }
  })

  it('draws the horizon straight when looking level', () => {
    const v = { ...view, alt: 0 }
    const g = groundOf(cameraFor(v, 390, 844), v)
    expect(g).toEqual({ kind: 'line', y: 422 })
  })

  it('turns the camera instead of the stars: a J2000 direction lands where its azimuth and altitude do', () => {
    const utc = new Date('2026-11-05T13:30:00Z')
    const [lat, lon] = [39.9, 116.4]
    const sky = turnCamera(cam, horizonMatrix(utc, lat, lon))
    const v = new Float64Array(3)
    const [p, q] = [at(), at()]
    for (const [ra, dec] of [[310.36, 45.28], [344.41, -29.62], [37.95, 89.26], [101.29, -16.72]]) {
      v[0] = Math.cos((dec * Math.PI) / 180) * Math.cos((ra * Math.PI) / 180)
      v[1] = Math.cos((dec * Math.PI) / 180) * Math.sin((ra * Math.PI) / 180)
      v[2] = Math.sin((dec * Math.PI) / 180)
      const { az, alt } = directionsAt(v, utc, lat, lon)
      const shown = projectDir(cam, dirOf(az[0], alt[0]), p)
      expect(projectXYZ(sky, v[0], v[1], v[2], q)).toBe(shown)
      if (!shown) continue
      expect(q[0]).toBeCloseTo(p[0], 3)
      expect(q[1]).toBeCloseTo(p[1], 3)
    }
  })

  it('measures how far the picture shifts between two views', () => {
    expect(viewShift(view, view, 390)).toBe(0)
    // One degree across at 90° over 390px: a little over 4 pixels
    expect(viewShift(view, { ...view, az: view.az + 1 / Math.cos((30 * Math.PI) / 180) }, 390)).toBeGreaterThan(4)
    // Straight up, turning round moves nothing at the middle but spins the picture
    const up = { az: 0, alt: 90, fov: 90 }
    expect(viewShift(up, { ...up, az: 10 }, 390)).toBeGreaterThan(30)
    // A sensor's tremble of a hundredth of a degree is under a quarter pixel
    expect(viewShift(view, { ...view, alt: view.alt + 0.01 }, 390)).toBeLessThan(0.25)
  })
})
