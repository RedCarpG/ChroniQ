import { describe, expect, it } from 'vitest'
import { parseShareHash, shareHash } from '../shareLink'

describe('share links', () => {
  const input = { year: 1997, month: 11, day: 2, hour: 10, minute: 30, gender: 1 as const }
  const ny = { name: '纽约', latitude: 40.71, longitude: -74.01, timeZone: 'America/New_York' }

  it('round-trips a chart', () => {
    const hash = shareHash({ tab: 'ziwei', input })
    expect(hash).toBe('#t=ziwei&d=1997-11-02T10%3A30&g=m')
    expect(parseShareHash(hash)).toEqual({ tab: 'ziwei', input })
  })

  it('keeps the birthplace and 真太阳时', () => {
    const shared = { tab: 'star' as const, input: { ...input, gender: 0 as const, place: ny, trueSolar: true } }
    expect(parseShareHash(shareHash(shared))).toEqual(shared)
  })

  it('opens older links: a 真太阳时 longitude, and a separate 星盘 place', () => {
    expect(parseShareHash('#t=bazi&d=1997-11-02T10:30&g=m&lng=121.47')?.input).toEqual({
      ...input,
      place: { name: '上海', latitude: 31.23, longitude: 121.47, timeZone: 'Asia/Shanghai' },
      trueSolar: true,
    })
    expect(
      parseShareHash('#t=star&d=1997-11-02T10:30&g=m&pn=%E7%BA%BD%E7%BA%A6&lat=40.71&lon=-74.01&tz=America%2FNew_York')
        ?.input,
    ).toEqual({ ...input, place: ny })
  })

  it('rejects malformed links', () => {
    expect(parseShareHash('')).toBeNull()
    expect(parseShareHash('#t=calendar&d=1997-11-02T10:30&g=m')).toBeNull()
    expect(parseShareHash('#t=bazi&d=1997-13-02T10:30&g=m')).toBeNull()
    expect(parseShareHash('#t=bazi&d=1997-11-02T10:30&g=x')).toBeNull()
  })

  it('drops a bad birthplace but keeps the chart', () => {
    const shared = parseShareHash('#t=star&d=1997-11-02T10:30&g=m&lat=40&lon=-74&tz=Not/AZone')
    expect(shared?.input).toEqual(input)
  })
})
