import { describe, expect, it } from 'vitest'
import { computeTonight } from '../tonight'

const BEIJING = { latitude: 39.9, longitude: 116.4, timeZone: 'Asia/Shanghai' }

describe('computeTonight', () => {
  it('takes the coming night by day and the night under way by night', () => {
    const byDay = computeTonight(new Date('2024-06-15T04:00:00Z'), BEIJING)! // noon there
    expect(new Date(byDay.sunset).toISOString().slice(0, 10)).toBe('2024-06-15')
    expect(byDay.sunset).toBeGreaterThan(Date.parse('2024-06-15T04:00:00Z'))
    expect(byDay.sunrise).toBeGreaterThan(byDay.sunset)
    const byNight = computeTonight(new Date('2024-06-15T15:00:00Z'), BEIJING)! // 23:00 there
    expect(Math.abs(byNight.sunset - byDay.sunset)).toBeLessThan(1000)
    expect(Math.abs(byNight.sunrise - byDay.sunrise)).toBeLessThan(1000)
  })

  it('finds Jupiter and Saturn up together in the evenings of late 2020, the brighter first', () => {
    const night = computeTonight(new Date('2020-10-01T04:00:00Z'), BEIJING)!
    const keys = night.planets.map((p) => p.key)
    expect(keys).toEqual(expect.arrayContaining(['jupiter', 'saturn']))
    expect(keys.indexOf('jupiter')).toBeLessThan(keys.indexOf('saturn'))
    const jupiter = night.planets.find((p) => p.key === 'jupiter')!
    expect(jupiter.from).toBeLessThan(jupiter.to)
    expect(jupiter.from).toBeGreaterThanOrEqual(night.sunset)
    expect(jupiter.to).toBeLessThanOrEqual(night.sunrise)
  })

  it('has a full Moon up through the dark and a new one not at all', () => {
    const full = computeTonight(new Date('2024-09-18T04:00:00Z'), BEIJING)!
    expect(full.moonLit).toBeGreaterThan(0.95)
    expect(full.moon).not.toBeNull()
    expect(computeTonight(new Date('2024-10-02T04:00:00Z'), BEIJING)!.moon).toBeNull()
  })

  it('has no night where the Sun does not set', () => {
    expect(computeTonight(new Date('2024-06-21T12:00:00Z'), { latitude: 78.2, longitude: 15.6, timeZone: 'Arctic/Longyearbyen' })).toBeNull()
  })
})
