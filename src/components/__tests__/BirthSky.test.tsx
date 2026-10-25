// @vitest-environment happy-dom
import './dom'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { toTrad } from '../../lib/trad'
import { FIVE_STARS } from '../../lib/fiveStars'
import { BirthSky, FiveStars } from '../BirthSky'

// 1990-05-15 10:30 in 北京, when China kept summer time (UTC+9): 01:30 UTC
const moment = { utc: new Date(Date.UTC(1990, 4, 15, 1, 30)), latitude: 39.9, longitude: 116.4 }

describe('五星 under the 五行', () => {
  it('names each planet for its 五行, in the order of the 五行 bars', () => {
    expect(FIVE_STARS.map((f) => `${f.element}${f.name}`)).toEqual(['木岁星', '火荧惑', '土镇星', '金太白', '水辰星'])
    expect(FIVE_STARS.map((f) => toTrad(f.name))).toEqual(['歲星', '熒惑', '鎮星', '太白', '辰星'])
  })

  it('gives each its 宿 and height at the moment of birth, and the Sun’s and Moon’s 宿', () => {
    const { container } = render(<FiveStars moment={moment} focus={null} pick={() => ({})} />)
    const rows = [...container.querySelectorAll('.five-star')].map((r) => r.textContent)
    // Names in 繁體, the default; checked against astronomy-engine directly: Jupiter RA 100° alt 15.5°, Mars 350° 39.6°,
    // Saturn 297° −1.3°, Venus 12° 53.3°, Mercury 37° 54.3° (with refraction, a little higher)
    expect(rows).toEqual([
      '✦歲星井宿 · 地平上 16°',
      '✦熒惑室宿 · 地平上 40°',
      '✧鎮星斗宿 · 地平下',
      '✦太白奎宿 · 地平上 53°',
      '✦辰星婁宿 · 地平上 54°',
    ])
    expect(container.querySelector('.five-stars-note')!.textContent).toBe('日躔胃宿 · 月离斗宿 · 昼生')
  })

  it('picks a planet out in the sky behind while it is pointed at', () => {
    const pick = vi.fn((key: string) => ({ 'data-key': key }))
    const { container } = render(<FiveStars moment={moment} focus={null} pick={pick} />)
    expect(pick).toHaveBeenCalledWith('venus')
    expect(container.querySelectorAll('.five-star')[3].getAttribute('data-key')).toBe('venus')
  })
})

describe('生辰星空', () => {
  it('draws the sky behind the page, with the bodies above the horizon over it', () => {
    render(<BirthSky moment={moment} focus="venus" />)
    const sky = document.querySelector('.birth-sky')!
    // Born by day; the stars, Milky Way and 二十八宿 go to the canvas (drawn in a browser, not in the test DOM)
    expect(sky.classList.contains('day')).toBe(true)
    expect(sky.querySelector('canvas')).not.toBeNull()
    // Sun and four planets up; the Moon and Saturn below
    expect(sky.querySelector('.bs-body.sun')).not.toBeNull()
    expect(sky.querySelector('.bs-body.moon')).toBeNull()
    expect([...sky.querySelectorAll('.bs-body.planet b')].map((t) => t.textContent)).toEqual([
      '歲星',
      '熒惑',
      '太白',
      '辰星',
    ])
    expect(sky.querySelector('.bs-body.planet.on b')!.textContent).toBe('太白')
  })
})
