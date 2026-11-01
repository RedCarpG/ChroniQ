import { describe, expect, it } from 'vitest'
import { project } from '../../components/skyGeometry'
import { compassAlpha, mapTurn, pointingFrom, smoothAngle } from '../devicePointing'

describe('pointingFrom', () => {
  it('points the way the phone faces when held upright', () => {
    const north = pointingFrom(0, 90, 0)
    expect(north.az).toBeCloseTo(0)
    expect(north.alt).toBeCloseTo(0)
    // alpha grows anticlockwise: turning left from north faces west
    expect(pointingFrom(90, 90, 0).az).toBeCloseTo(270)
    expect(pointingFrom(270, 90, 0).az).toBeCloseTo(90)
    expect(pointingFrom(180, 90, 0).az).toBeCloseTo(180)
  })

  it('points at the ground lying flat, and up when tipped back', () => {
    expect(pointingFrom(0, 0, 0).alt).toBeCloseTo(-90)
    expect(pointingFrom(0, 135, 0).alt).toBeCloseTo(45)
    expect(pointingFrom(0, 135, 0).az).toBeCloseTo(0)
    expect(pointingFrom(0, 180, 0).alt).toBeCloseTo(90)
  })
})

describe('compassAlpha', () => {
  it('takes an absolute alpha, and not a relative one', () => {
    expect(compassAlpha({ alpha: 40, absolute: true })).toBe(40)
    expect(compassAlpha({ alpha: 40, absolute: false })).toBeNull()
    expect(compassAlpha({ alpha: null, absolute: true })).toBeNull()
  })

  it('turns an iOS heading into an alpha', () => {
    expect(compassAlpha({ alpha: 12, absolute: false, webkitCompassHeading: 90 })).toBe(270)
    expect(compassAlpha({ alpha: 12, absolute: false, webkitCompassHeading: 0 })).toBe(0)
    expect(pointingFrom(compassAlpha({ alpha: 0, absolute: false, webkitCompassHeading: 90 })!, 90, 0).az).toBeCloseTo(90)
  })
})

describe('smoothAngle', () => {
  it('goes the short way across north', () => {
    expect(smoothAngle(350, 10, 0.5)).toBeCloseTo(0)
    expect(smoothAngle(10, 350, 0.5)).toBeCloseTo(0)
    expect(smoothAngle(100, 120, 0.25)).toBeCloseTo(105)
  })
})

describe('mapTurn', () => {
  /** Where the zenith lies from a point on the map, after turning the map clockwise by degrees */
  const towardsZenith = (az: number) => {
    const [x, y] = project(az, 30)
    const [zx, zy] = project(0, 90)
    const a = (mapTurn(az) * Math.PI) / 180
    const [dx, dy] = [zx - x, zy - y]
    return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)]
  }

  it('leaves the zenith straight up from whatever one looks at', () => {
    for (const az of [0, 45, 90, 180, 270, 300]) {
      const [x, y] = towardsZenith(az)
      expect(x).toBeCloseTo(0)
      expect(y).toBeLessThan(0)
    }
  })
})
