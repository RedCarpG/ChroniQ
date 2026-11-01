import { describe, expect, it } from 'vitest'
import { POSTER_W, posterPoint, posterScene } from '../birthPoster'

const BEIJING = { latitude: 39.9, longitude: 116.4 }

describe('posterPoint', () => {
  it('has the zenith in the middle, north up and east to the left', () => {
    const [cx, cy] = posterPoint(0, 90)
    expect(cx).toBe(POSTER_W / 2)
    const north = posterPoint(0, 0)
    const east = posterPoint(90, 0)
    expect(north[0]).toBeCloseTo(cx)
    expect(north[1]).toBeLessThan(cy)
    expect(east[0]).toBeLessThan(cx)
  })

  it('keeps what is above the horizon inside the rim', () => {
    const [cx, cy] = posterPoint(0, 90)
    const [x, y] = posterPoint(123, 1)
    expect(Math.hypot(x - cx, y - cy)).toBeLessThan(450)
  })
})

describe('posterScene', () => {
  const night = posterScene(new Date('2000-01-01T16:00:00Z'), BEIJING.latitude, BEIJING.longitude, 'west')

  it('has only stars and bodies above the horizon', () => {
    expect(night.stars.length).toBeGreaterThan(500)
    expect(night.stars.every((s) => s.alt > 0)).toBe(true)
    expect(night.bodies.every((b) => b.alt > 0)).toBe(true)
  })

  it('tells a birth by night from one by day', () => {
    expect(night.daytime).toBe(false)
    expect(night.bodies.some((b) => b.key === 'sun')).toBe(false)
    const day = posterScene(new Date('2000-06-21T04:00:00Z'), BEIJING.latitude, BEIJING.longitude, 'west')
    expect(day.daytime).toBe(true)
    expect(day.bodies.some((b) => b.key === 'sun')).toBe(true)
  })

  it('draws the figures asked for', () => {
    const count = (figures: 'west' | 'mansions' | 'none') => posterScene(new Date('2000-01-01T16:00:00Z'), BEIJING.latitude, BEIJING.longitude, figures).figures.length
    expect(count('west')).toBeGreaterThan(40)
    expect(count('mansions')).toBeGreaterThan(0)
    expect(count('none')).toBe(0)
  })
})
