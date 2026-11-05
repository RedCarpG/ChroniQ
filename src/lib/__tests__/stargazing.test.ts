// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { BORTLE, darkness, moonGlare, nightPlan } from '../stargazing'
import { fetchForecast, forecastUrl, parseForecast, weatherAt, type WeatherHour } from '../weather'

const HOUR = 3600_000
const hours = (start: number, clouds: number[]): WeatherHour[] =>
  clouds.map((cloud, i) => ({
    time: start + i * HOUR,
    cloud,
    low: cloud / 2,
    mid: 0,
    high: cloud / 2,
    humidity: 60,
    wind: 10,
    windFrom: 270,
  }))

describe('the weather for stargazing', () => {
  it('asks Open-Meteo for the cloud by the hour, the place rounded to about a kilometre', () => {
    const url = new URL(forecastUrl(39.9042, 116.4074))
    expect(url.host).toBe('api.open-meteo.com')
    expect(url.searchParams.get('latitude')).toBe('39.90')
    expect(url.searchParams.get('longitude')).toBe('116.41')
    expect(url.searchParams.get('hourly')).toContain('cloud_cover')
  })

  it('reads its answer, and the cover between the hours', () => {
    const h = parseForecast({ hourly: { time: [0, 3600], cloud_cover: [20, 60], wind_speed_10m: [5, 5] } })
    expect(h.map((x) => x.cloud)).toEqual([20, 60])
    expect(weatherAt(h, 1800_000)!.cloud).toBeCloseTo(40)
    expect(weatherAt(h, 7200_000)).toBeNull()
  })

  it('keeps an answer for half an hour', async () => {
    localStorage.clear()
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ hourly: { time: [0], cloud_cover: [10] } })))
    await fetchForecast(10, 20, fetcher as typeof fetch)
    await fetchForecast(10, 20, fetcher as typeof fetch)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})

describe('今晚观星', () => {
  it('rates the sky by its darkness and the Moon', () => {
    expect(darkness(-3)).toBe(0)
    expect(darkness(-12)).toBe(0.5)
    expect(darkness(-20)).toBe(1)
    expect(moonGlare(1, -5)).toBe(0)
    expect(moonGlare(1, 60)).toBe(1)
  })

  it('runs from sunset to sunrise, the best hours in the dark before the Moon rises', () => {
    // Beijing, 3 November 2026: the waning Moon rises a little after midnight
    const plan = nightPlan(new Date('2026-11-03T12:00:00Z'), 39.9, 116.4)!
    expect(new Date(plan.start).toISOString()).toMatch(/^2026-11-03T09:1/)
    expect(new Date(plan.end).toISOString()).toMatch(/^2026-11-03T22:4/)
    expect(plan.best!.from).toBe(Date.parse('2026-11-03T10:00:00Z'))
    expect(plan.hours.find((h) => h.time === Date.parse('2026-11-03T13:00:00Z'))!.moon).toBe(0)
  })

  it('leaves out the cloudy hours', () => {
    const start = Date.parse('2026-11-03T09:00:00Z')
    // Clear until 13:00 UTC, overcast from 14:00 (the hour between, read at its middle, half cloudy)
    const weather = hours(
      start,
      Array.from({ length: 16 }, (_, i) => (i < 5 ? 5 : 95)),
    )
    const plan = nightPlan(new Date('2026-11-03T12:00:00Z'), 39.9, 116.4, weather)!
    expect(plan.best!.to).toBe(Date.parse('2026-11-03T13:00:00Z'))
    expect(plan.best!.cloud).toBe(5)
  })

  it('names the Bortle classes, the faintest star getting brighter towards the city', () => {
    expect(BORTLE).toHaveLength(9)
    for (let i = 1; i < 9; i++) expect(BORTLE[i].limit).toBeLessThan(BORTLE[i - 1].limit)
  })
})
