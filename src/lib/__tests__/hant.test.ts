import { beforeAll, describe, expect, it } from 'vitest'
import { hant, loadHant } from '../hant'
import { HANT_FIXES } from '../hantFixes'
import { toTrad } from '../trad'

beforeAll(() => loadHant())

describe('hant', () => {
  it('converts by word, not by character', () => {
    expect(hant('头发与发展')).toBe('頭髮與發展')
    expect(hant('历法数据由 {lib} 提供 · 仅供参考')).toBe('曆法數據由 {lib} 提供 · 僅供參考')
  })

  it('keeps the 命理 forms of the terms, in 繁體 already or inside a 简体 sentence', () => {
    for (const term of ['天干', '藏干', '相冲', '丑未相刑', '斗柄指月']) {
      expect(hant(toTrad(term))).toBe(toTrad(term))
    }
    expect(hant('日主在地支藏干里的同类五行。')).toContain('藏干')
    expect(hant('天干是{star}。')).toBe('天干是{star}。')
  })

  it('takes 丑, 斗 and 冲 in the sense this app uses them', () => {
    expect(hant('丑未相刑')).toBe('丑未相刑')
    expect(hant('北斗七星的斗柄')).toBe('北斗七星的斗柄')
    expect(hant('原局刑冲合会，冲太岁')).toBe('原局刑沖合會，沖太歲')
    expect(hant('土星冲日，主冲劲，易冲动，与冲突')).toBe('土星衝日，主衝勁，易衝動，與衝突')
  })

  it('leaves text with no Chinese, and its slots, alone', () => {
    expect(hant('Saturn {n}')).toBe('Saturn {n}')
  })

  it('has fixes that say something', () => {
    for (const [wrong, right] of HANT_FIXES) expect(wrong).not.toBe(right)
  })
})
