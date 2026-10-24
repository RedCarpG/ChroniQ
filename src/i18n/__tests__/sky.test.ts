import { describe, expect, it } from 'vitest'
import { BODY_INFO } from '../../lib/astrology'
import { STAR_NAMES, formatAzimuth } from '../../lib/sky'
import { PLANETS, lightTime } from '../../lib/solarSystem'
import { EN } from '../en'

// Names the 天象 page puts through t() from data, not from literal t('…') calls
describe('天象 English', () => {
  it('names every bright star', () => {
    expect(Object.values(STAR_NAMES).filter((name) => EN[name] === undefined)).toEqual([])
  })

  it('names the Sun, Moon and planets', () => {
    const names = [...Object.values(BODY_INFO).map((b) => b.name), ...PLANETS.map((p) => p.name)].filter(
      (name) => name !== '北交点' && name !== '南交点',
    )
    expect(names.filter((name) => EN[name] === undefined)).toEqual([])
  })

  it('gives azimuths and light times in English, leaving the Chinese as it was', () => {
    expect(formatAzimuth(134, 'en')).toBe('SE 134°')
    expect(formatAzimuth(359, 'en')).toBe('N 359°')
    expect(formatAzimuth(134)).toBe('东南 134°')
    expect(lightTime(1, 'en')).toBe('8.3 min')
    expect(lightTime(10, 'en')).toBe('1.4 h')
    expect(lightTime(1)).toBe('8.3 分钟')
  })
})
