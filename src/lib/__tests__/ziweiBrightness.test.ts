import { describe, expect, it } from 'vitest'
import { buildZiwei } from '../ziwei'
import { QUANSHU_BRIGHTNESS, quanshuBrightness } from '../ziweiBrightness'
import { DEFAULT_ZIWEI_SCHOOLS } from '../ziweiSchools'

const all = (palaces: string, star: string) => [...palaces].map((b) => quanshuBrightness(star, b))

describe('星曜庙旺 by the 《全书》 table', () => {
  it('gives each star a level for each of the twelve palaces, from 子', () => {
    for (const [star, row] of Object.entries(QUANSHU_BRIGHTNESS)) {
      expect([...row], star).toHaveLength(12)
      expect(row, star).toMatch(/^[庙旺得利平不陷·]+$/)
    }
  })

  it('keeps the classic rules', () => {
    // 太阴庙于亥子丑、陷于卯辰巳; 擎羊庙于辰戌丑未、陷于子午卯酉; 文昌庙于巳酉丑、陷于寅午戌; 天马寅申旺
    expect(all('亥子丑', '太阴')).toEqual(['庙', '庙', '庙'])
    expect(all('卯辰巳', '太阴')).toEqual(['陷', '陷', '陷'])
    expect(all('辰戌丑未', '擎羊')).toEqual(['庙', '庙', '庙', '庙'])
    expect(all('子午卯酉', '擎羊')).toEqual(['陷', '陷', '陷', '陷'])
    expect(all('巳酉丑', '文昌')).toEqual(['庙', '庙', '庙'])
    expect(all('寅午戌', '文昌')).toEqual(['陷', '陷', '陷'])
    expect(all('寅申', '天马')).toEqual(['旺', '旺'])
    // 擎羊 never falls in 寅申巳亥: no level there
    expect(quanshuBrightness('擎羊', '寅')).toBeUndefined()
    expect(quanshuBrightness('天厨', '子')).toBeUndefined()
  })

  it('puts it on the board, for the 辅星 iztro leaves without one too', () => {
    const chart = buildZiwei({ year: 1990, month: 5, day: 15, hour: 10, minute: 30, gender: 1 }, DEFAULT_ZIWEI_SCHOOLS)
    const stars = Object.values(chart.palaces).flatMap((p) =>
      [...p.major, ...p.minor, ...p.adjective].map((s) => ({ s, p })),
    )
    for (const { s, p } of stars)
      expect(s.brightness, `${s.name}@${p.branch}`).toBe(quanshuBrightness(s.name, p.branch))
    for (const name of ['左辅', '右弼', '禄存', '天马', '地空', '地劫']) {
      expect(stars.find(({ s }) => s.name === name)!.s.brightness, name).toBeTruthy()
    }
  })

  it('follows 天马 to its palace when it goes by the month (月马)', () => {
    const chart = buildZiwei(
      { year: 1990, month: 5, day: 15, hour: 10, minute: 30, gender: 1 },
      { ...DEFAULT_ZIWEI_SCHOOLS, tianma: 'month' },
    )
    const home = Object.values(chart.palaces).find((p) => p.minor.some((s) => s.name === '天马'))!
    expect(home.minor.find((s) => s.name === '天马')!.brightness).toBe(quanshuBrightness('天马', home.branch))
  })
})
