// chroniq-core in Node (no DOM): what another program gets from it
import { describe, expect, it } from 'vitest'
import {
  almanac,
  almanacText,
  baziReading,
  baziText,
  buildBazi,
  buildZiwei,
  DEFAULT_PLACE,
  DEFAULT_ZIWEI_SCHOOLS,
  findPatterns,
  skyEventText,
  upcomingSkyEvents,
  ziweiText,
  buildStarChart,
  DEFAULT_STAR_SETTINGS,
  findCity,
  lunarToSolar,
  starChartText,
  transits,
} from '../index'

const INPUT = { year: 1990, month: 5, day: 17, hour: 10, minute: 30, gender: 1 as const }

describe('chroniq-core', () => {
  it('runs without a browser', () => {
    expect(typeof window).toBe('undefined')
  })

  it('tells a day’s 黄历', () => {
    const d = almanac(2026, 11, 3)
    expect(d.ganzhi).toBe('丙午年戊戌月辛巳日')
    const text = almanacText(2026, 11, 3)
    expect(text).toContain('农历九月廿五')
    expect(text).toContain('节气：霜降第12天')
    expect(text).toMatch(/^宜：.+/m)
    expect(text).toMatch(/^忌：.+/m)
  })

  it('writes out a 八字 chart with its reading', () => {
    const chart = buildBazi(INPUT)
    const text = baziText(chart, baziReading(chart, 2026))
    expect(text).toContain('日主：壬水')
    for (const label of ['年柱 庚午', '月柱 辛巳', '日柱 壬午', '时柱 乙巳']) expect(text).toContain(label)
    expect(text).toContain('当前大运：乙酉')
    expect(text).toMatch(/旺衰：日主偏(弱|旺)|旺衰：比较平衡/)
  })

  it('writes out a 紫微 chart, the twelve palaces from 命宫 round', () => {
    const chart = buildZiwei(INPUT, DEFAULT_ZIWEI_SCHOOLS)
    const lines = ziweiText(chart, findPatterns(chart)).split('\n')
    const palaces = lines.filter((l) => /^ {2}\S+（[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]）/.test(l))
    expect(palaces).toHaveLength(12)
    expect(palaces[0]).toMatch(/^ {2}命宫/)
    expect(palaces[1]).toMatch(/^ {2}兄弟/)
    expect(lines.join('\n')).toContain('火六局')
  })

  it('lists the coming sky events in order, in the place’s time', () => {
    const from = new Date('2026-11-03T00:00:00Z')
    const events = upcomingSkyEvents(from, 60, DEFAULT_PLACE)
    expect(events.length).toBeGreaterThan(2)
    expect(events.every((e, i) => e.time >= from.getTime() && (i === 0 || events[i - 1].time <= e.time))).toBe(true)
    const gem = events.find((e) => e.kind === 'meteors' && e.shower === 'GEM')!
    expect(skyEventText(gem, DEFAULT_PLACE.timeZone)).toMatch(/^12\/1[345] \d\d:\d\d · 双子座流星雨 · /)
  })

  it('writes out a 星盘, with a 行运 over it', () => {
    const place = findCity('北京市')!
    const chart = buildStarChart(INPUT, place, DEFAULT_STAR_SETTINGS)
    const text = starChartText(chart, DEFAULT_STAR_SETTINGS)
    // China kept summer time in 1986–1991: May 1990 was UTC+9
    expect(text).toContain('出生：1990年5月17日 10:30（当地时间，UTC+9，夏令时）· 北京')
    expect(text).toContain('宫位制：普拉西度制')
    expect(text).toMatch(/太阳 金牛 2\d°\d\d′座，第\d+宫/)
    expect(text).toMatch(/^相位：.+（差 \d\.\d°）/m)
    const over = starChartText(
      chart,
      DEFAULT_STAR_SETTINGS,
      transits(chart, new Date('2026-11-03T00:00:00Z'), DEFAULT_STAR_SETTINGS),
    )
    expect(over).toContain('行运（2026-11-03，36.5 岁）')
  })

  it('takes a birth as people say it: a 农历 date, a city by name', () => {
    // 农历 1990 年四月廿三 is 5 月 17 日; 2023 has a 闰二月
    expect(lunarToSolar(1990, 4, 23)).toEqual({ year: 1990, month: 5, day: 17 })
    expect(lunarToSolar(2023, 2, 1, true)).toEqual({ year: 2023, month: 3, day: 22 })
    expect(lunarToSolar(1990, 4, 31)).toBeNull()
    expect(findCity('上海')).toMatchObject({ name: '上海', timeZone: 'Asia/Shanghai' })
    expect(findCity('东京')).toMatchObject({ timeZone: 'Asia/Tokyo' })
    expect(findCity('不存在的地方')).toBeNull()
  })
})
