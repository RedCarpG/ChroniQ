import { describe, expect, it } from 'vitest'
import { buildZiwei } from '../ziwei'
import { DEFAULT_ZIWEI_SCHOOLS } from '../ziweiSchools'

describe('宫干四化', () => {
  const chart = buildZiwei({ year: 1997, month: 11, day: 2, hour: 10, minute: 30, gender: 1 }, DEFAULT_ZIWEI_SCHOOLS)
  const palaces = Object.values(chart.palaces)

  it('gives every palace its four 飞化, landing on the palace holding each star', () => {
    for (const p of palaces) {
      expect(p.flies.map((f) => f.mutagen)).toEqual(['禄', '权', '科', '忌'])
      for (const f of p.flies) {
        const host = chart.palaces[f.to]
        expect([...host.major, ...host.minor].some((s) => s.name === f.star)).toBe(true)
      }
    }
  })

  it('uses the standard table: 甲 廉破武阳', () => {
    const jia = palaces.find((p) => p.stem === '甲')!
    expect(jia.flies.map((f) => f.star)).toEqual(['廉贞', '破军', '武曲', '太阳'])
  })

  it('agrees with iztro’s 生年四化 for the birth-year stem', () => {
    // Every year stem in turn, via a birth in each of ten consecutive years
    for (let year = 1990; year < 2000; year++) {
      const c = buildZiwei({ year, month: 6, day: 15, hour: 12, minute: 0, gender: 0 }, DEFAULT_ZIWEI_SCHOOLS)
      const stem = c.chineseDate[0]
      const birth = Object.values(c.palaces)
        .flatMap((p) => [...p.major, ...p.minor])
        .filter((s) => s.mutagen)
        .sort((a, b) => '禄权科忌'.indexOf(a.mutagen!) - '禄权科忌'.indexOf(b.mutagen!))
        .map((s) => s.name)
      const fromStem = Object.values(c.palaces).find((p) => p.stem === stem)
      if (fromStem) expect(fromStem.flies.map((f) => f.star)).toEqual(birth)
    }
  })

  it('follows the 流派 四化 choice for 庚', () => {
    const geng = (s: typeof DEFAULT_ZIWEI_SCHOOLS) =>
      Object.values(buildZiwei({ year: 1997, month: 11, day: 2, hour: 10, minute: 30, gender: 1 }, s).palaces).find(
        (p) => p.stem === '庚',
      )
    const a = geng({ ...DEFAULT_ZIWEI_SCHOOLS, mutagenGeng: 'yangWuTongYin' })
    const b = geng({ ...DEFAULT_ZIWEI_SCHOOLS, mutagenGeng: 'yangWuYinTong' })
    if (!a || !b) return
    expect(a.flies[2].star).toBe('天同')
    expect(b.flies[2].star).toBe('太阴')
  })
})
