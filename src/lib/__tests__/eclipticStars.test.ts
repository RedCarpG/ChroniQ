import { describe, expect, it } from 'vitest'
import { zodiacStars } from '../eclipticStars'

const star = (year: number, hip: number) => zodiacStars(year).find((s) => s.hip === hip)!

describe('zodiacStars', () => {
  it('puts the royal stars where they are on the ecliptic (J2000)', () => {
    // Aldebaran 9°47′ Gemini, Regulus 29°50′ Leo, Spica 23°50′ Libra, Antares 9°46′ Sagittarius
    expect(star(2000, 21421).lon).toBeCloseTo(69.79, 1)
    expect(star(2000, 49669).lon).toBeCloseTo(149.83, 1)
    expect(star(2000, 65474).lon).toBeCloseTo(203.84, 1)
    expect(star(2000, 80763).lon).toBeCloseTo(249.76, 1)
    expect(star(2000, 49669).lat).toBeCloseTo(0.47, 1)
  })

  it('moves them on by precession, about 1.4° a century', () => {
    expect(star(2100, 49669).lon - star(2000, 49669).lon).toBeCloseTo(1.397, 2)
  })

  it('keeps to the zodiac band and the brighter stars', () => {
    const stars = zodiacStars(2026)
    expect(stars.length).toBeGreaterThan(120)
    expect(stars.every((s) => Math.abs(s.lat) <= 10 && s.mag <= 4.6)).toBe(true)
  })
})
