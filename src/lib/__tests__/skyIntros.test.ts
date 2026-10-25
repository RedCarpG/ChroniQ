import { describe, expect, it } from 'vitest'
import { WESTERN } from '../constellations'
import { MANSIONS } from '../mansions'
import { STAR_NAMES, skyAt } from '../sky'
import { BODY_INTRO, CHINA_INTRO, STAR_INTRO, WESTERN_INTRO } from '../skyIntros'
import { XINGGUAN } from '../xingguan'

describe('天象 intros', () => {
  const filled = (x: { zh: string; en: string } | undefined) => !!x && x.zh.length > 10 && x.en.length > 10
  it('has one, in both languages, for each body, named star, Western constellation and 宿', () => {
    const bodies = skyAt(new Date('2026-10-25T12:00:00Z'), 39.9, 116.4).bodies.map((b) => b.key)
    expect(bodies.filter((k) => !filled(BODY_INTRO[k]))).toEqual([])
    expect(Object.keys(STAR_NAMES).filter((hip) => !filled(STAR_INTRO[Number(hip)]))).toEqual([])
    expect([...new Set(WESTERN.map((c) => c.id))].filter((id) => !filled(WESTERN_INTRO[id]))).toEqual([])
    expect(MANSIONS.map((m) => m.name).filter((n) => !filled(CHINA_INTRO[n]))).toEqual([])
  })

  it('names only 星官 that are in the map', () => {
    const names = new Set(XINGGUAN.map((c) => c.name))
    expect(Object.keys(CHINA_INTRO).filter((n) => !names.has(n))).toEqual([])
    expect(Object.keys(WESTERN_INTRO)).toHaveLength(88)
  })
})
