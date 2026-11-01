import { describe, expect, it } from 'vitest'
import type { BaziInput } from '../bazi'
import { buildZiwei } from '../ziwei'
import { findPatterns } from '../ziweiPatterns'
import { DEFAULT_ZIWEI_SCHOOLS } from '../ziweiSchools'

const at = (year: number, month: number, day: number, hour: number, gender: 0 | 1): BaziInput => ({
  year,
  month,
  day,
  hour,
  minute: 30,
  gender,
})
const patternsOf = (input: BaziInput) => {
  const chart = buildZiwei(input, DEFAULT_ZIWEI_SCHOOLS)
  return { chart, ming: Object.values(chart.palaces).find((p) => p.isSoul)!, found: findPatterns(chart) }
}
const named = (input: BaziInput, name: string) => patternsOf(input).found.find((p) => p.name === name)

describe('紫微斗数格局', () => {
  it('finds 紫府同宫 where 紫微 and 天府 sit together in 命宫, and lists what adds to it', () => {
    const input = at(1970, 6, 17, 20, 0)
    const { ming } = patternsOf(input)
    expect(ming.major.map((s) => s.name)).toEqual(expect.arrayContaining(['紫微', '天府']))
    const p = named(input, '紫府同宫')!
    expect(p).toMatchObject({
      kind: 'good',
      rule: '紫微、天府同坐命宫（申）',
      verse: '紫府同宫，终身福厚',
      palaces: ['申'],
    })
    expect(p.plus).toEqual(['会左辅右弼', '会禄存'])
  })

  it('finds 明珠出海: 命宫 in 未 with no main star, the Sun in 卯 and the Moon in 亥', () => {
    const p = named(at(1970, 7, 17, 0, 0), '明珠出海')!
    expect(p.palaces).toEqual(['未', '卯', '亥'])
  })

  it('finds 府相朝垣 with the 化忌 that spoils it', () => {
    const p = named(at(1970, 1, 3, 20, 0), '府相朝垣')!
    expect(p.rule).toBe('天府、天相分居命宫的三合宫（官禄、财帛）来朝')
    expect(p.plus).toContain('会化禄')
    expect(p.minus).toEqual(['文曲化忌'])
  })

  it('finds 三奇加会, naming the stars, and warns of a 化忌 among them', () => {
    const p = named(at(1971, 2, 17, 4, 1), '三奇加会')!
    expect(p.rule).toContain('巨门化禄、太阳化权、文曲化科')
    expect(p.minus).toEqual(['文昌化忌也在三方四正'])
  })

  it('finds the 凶格 of a palace held between two stars: 羊陀夹忌, 刑忌夹印', () => {
    const yangtuo = named(at(1970, 7, 3, 22, 0), '羊陀夹忌')!
    expect(yangtuo).toMatchObject({
      kind: 'bad',
      rule: '命宫天同化忌，擎羊、陀罗前后相夹',
      palaces: ['申', '未', '酉'],
    })
    expect(named(at(1977, 7, 17, 2, 1), '刑忌夹印')).toMatchObject({ kind: 'bad', palaces: ['午', '巳', '未'] })
  })

  it('puts the 吉格 first, then the 凶格, then the structures', () => {
    const { found } = patternsOf(at(1990, 5, 15, 10, 1))
    expect(found.map((p) => p.name)).toEqual(['英星入庙', '禄马交驰', '杀破狼'])
    expect(found.map((p) => p.kind)).toEqual(['good', 'good', 'neutral'])
  })

  it('keeps to its definitions across many charts', () => {
    for (let i = 0; i < 24; i++) {
      const { chart, ming, found } = patternsOf(
        at(1960 + i * 2, 1 + (i % 12), 1 + ((i * 7) % 28), (i * 5) % 24, (i % 2) as 0 | 1),
      )
      const majors = ming.major.map((s) => s.name)
      for (const p of found) {
        expect(p.palaces.length, p.name).toBeGreaterThan(0)
        for (const b of p.palaces) expect(chart.palaces[b], p.name).toBeDefined()
      }
      const has = (name: string) => found.some((p) => p.name === name)
      expect(has('命无正曜')).toBe(majors.length === 0)
      expect(has('杀破狼')).toBe(majors.some((n) => ['七杀', '破军', '贪狼'].includes(n)))
      expect(has('紫府同宫')).toBe(majors.includes('紫微') && majors.includes('天府'))
    }
  })
})
