import { describe, expect, it } from 'vitest'
import { MESSIER, messierAt, messierConstellation, messierName } from '../messier'
import { gridAt, riseSet } from '../sky'
import { searchSky, type SearchItem } from '../../components/SkySearch'

const BEIJING = [39.9, 116.4] as const
const EVENING = new Date('2026-11-03T13:00:00Z') // 21:00 in Beijing

describe('the Messier catalogue', () => {
  it('has all 110, numbered in order, in their constellations', () => {
    expect(MESSIER.map((m) => m.n)).toEqual(Array.from({ length: 110 }, (_, i) => i + 1))
    const m31 = MESSIER[30]
    expect(m31.kind).toBe('galaxy')
    expect(messierConstellation(m31)).toBe('And')
    expect(messierConstellation(MESSIER[41])).toBe('Ori')
    expect(messierConstellation(MESSIER[44])).toBe('Tau')
    expect(messierName(m31, false)).toBe('仙女座大星系')
    expect(messierName(MESSIER[1], false)).toBe('M2')
  })

  it('places them in the sky: M31 high on an autumn evening, M42 not yet risen', () => {
    const up = messierAt(EVENING, ...BEIJING)
    const m31 = up.find((d) => d.m.n === 31)!
    expect(m31.alt).toBeGreaterThan(70)
    expect(up.find((d) => d.m.n === 42)).toBeUndefined()
    const down = messierAt(EVENING, ...BEIJING, true)
    expect(down.find((d) => d.m.n === 42)!.alt).toBeLessThan(0)
    expect(up.length + down.length).toBe(110)
  })

  it('finds when one rises and sets from its RA and Dec', () => {
    const m42 = MESSIER[41]
    const times = riseSet({ ra: m42.ra, dec: m42.dec }, EVENING, ...BEIJING, false)
    expect(times && 'rise' in times && times.rise!.getTime()).toBeGreaterThan(EVENING.getTime())
    expect(times && 'rise' in times && times.rise!.getTime()).toBeLessThan(EVENING.getTime() + 3600_000)
  })
})

describe('the equatorial grid', () => {
  it('runs the equator through due east and due west', () => {
    const { decs, ecliptic, hours } = gridAt(EVENING, ...BEIJING)
    const equator = decs.find((d) => d.dec === 0)!.pts
    const near = (az: number) =>
      Math.min(...equator.filter((p) => Math.abs(p.alt) < 3).map((p) => Math.abs(((p.az - az + 540) % 360) - 180)))
    expect(near(90)).toBeLessThan(4)
    expect(near(270)).toBeLessThan(4)
    // The equator's highest point is 90° − latitude up, due south
    expect(Math.max(...equator.map((p) => p.alt))).toBeCloseTo(90 - BEIJING[0], 0)
    expect(hours).toHaveLength(12)
    expect(ecliptic.length).toBeGreaterThan(100)
  })
})

describe('search', () => {
  const items: SearchItem[] = [
    {
      key: 'dso31',
      label: '仙女座大星系',
      sub: '',
      names: ['M31', 'NGC 224', '仙女座大星系', 'Andromeda'],
      colour: '',
    },
    { key: 'dso32', label: 'M32', sub: '', names: ['M32', 'NGC 221'], colour: '' },
    { key: 'figAnd', label: '仙女座', sub: '', names: ['仙女座', 'Andromeda', 'And'], colour: '' },
    { key: 'dso3', label: 'M3', sub: '', names: ['M3', 'NGC 5272'], colour: '' },
  ]
  it('puts exact and leading matches first, ignoring case and spaces', () => {
    expect(searchSky(items, 'm3').map((i) => i.key)).toEqual(['dso3', 'dso31', 'dso32'])
    expect(searchSky(items, 'ngc224').map((i) => i.key)).toEqual(['dso31'])
    expect(searchSky(items, 'andromeda').map((i) => i.key)).toEqual(['dso31', 'figAnd'])
    expect(searchSky(items, '仙女').map((i) => i.key)).toEqual(['dso31', 'figAnd'])
    expect(searchSky(items, '  ')).toEqual([])
  })
})
