import { describe, expect, it } from 'vitest'
import { buildBazi } from '../../lib/bazi'
import { DEFAULT_SCHOOLS, SCHOOLS } from '../../lib/schools'
import { STAR_SCHOOLS } from '../../lib/starPrefs'
import { WORLD_CITIES } from '../../lib/worldCities'
import { ZIWEI_SCHOOLS } from '../../lib/ziweiSchools'
import { EN } from '../en'
import { translate } from '..'

interface Registry {
  [key: string]: { title: string; summary: string; options: { label: string; source: string }[] }
}

// These reach t() as variables, so the i18n test can't see them as literals.
describe('八字 and 流派设置 English', () => {
  it('covers every 流派设置 title, summary, option and source', () => {
    const registries: Registry[] = [SCHOOLS, ZIWEI_SCHOOLS, STAR_SCHOOLS]
    const texts = registries.flatMap((r) =>
      Object.values(r).flatMap((info) => [
        info.title,
        info.summary,
        ...info.options.flatMap((o) => [o.label, o.source]),
      ]),
    )
    expect(texts.filter((t) => EN[t] === undefined)).toEqual([])
  })

  it('covers the place picker regions', () => {
    expect(WORLD_CITIES.map((r) => r.region).filter((r) => EN[r] === undefined)).toEqual([])
  })

  it('builds the same 起运 note in Chinese as the lib', () => {
    for (const childLimit of ['default', 'sect1', 'sect2', 'china95'] as const) {
      for (const gender of [0, 1] as const) {
        const input = { year: 1990, month: 5, day: 15, hour: 10, minute: 30, gender }
        const chart = buildBazi(input, { ...DEFAULT_SCHOOLS, childLimit })
        const { years, months, days, year, month, day, forward } = chart.start
        const vars = { years, months, days, date: `${year}年${month}月${day}日`, direction: forward ? '顺排' : '逆排' }
        const text = translate('zh', '出生后{years}年{months}个月{days}天起运（{date}交运），{direction}', vars)
        expect(text).toBe(chart.startText)
      }
    }
  })
})
