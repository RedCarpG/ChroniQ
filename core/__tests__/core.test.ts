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
  buildQizheng,
  qizhengText,
  DEFAULT_QIZHENG_SCHOOLS,
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
    expect(text).toMatch(/太阳 金牛座 2\d°\d\d′，第\d+宫/)
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

  it('writes out a 七政四余 chart: each body in its 宿 and palace, the twelve palaces from 命宫', () => {
    const chart = buildQizheng({ ...INPUT, place: findCity('北京市')! }, DEFAULT_QIZHENG_SCHOOLS)
    const text = qizhengText(chart, DEFAULT_QIZHENG_SCHOOLS)
    expect(text).toMatch(/^乾造（男命）/)
    expect(text).toContain('命宫：鹑首之次（未宫），上升点黄经')
    expect(text).toMatch(/^ {2}木星（岁星，五行属木）：井宿.+落命宫$/m)
    expect(text).toMatch(/^ {2}土星（镇星，五行属土）：斗宿.+落夫妻宫，逆行$/m)
    expect(text).toContain('出生：1990年5月17日 10:30（当地时间，UTC+9，夏令时）· 北京')
    expect(text).toMatch(/^ {2}太阳（五行属火）：胃宿（胃土雉）入宿 \d+\.\d 古度/m)
    expect(text).toMatch(/^ {2}太阴（五行属水）：女宿/m)
    expect(text).toMatch(/^ {2}紫炁（五行属木）：.+（依流派推算，天上没有对应的天体）$/m)
    const palaces = text.split('\n').filter((l) => /^ {2}\S{2}（\S{2} · [子丑寅卯辰巳午未申酉戌亥]）：/.test(l))
    expect(palaces).toHaveLength(12)
    expect(palaces[0]).toMatch(/^ {2}命宫/)
    expect(text).toContain('流派：罗睺计都取罗睺为升交点（北交）；月交点取真交点；紫炁取二十八年一周天')
    const hidden = qizhengText(buildQizheng(INPUT, { ...DEFAULT_QIZHENG_SCHOOLS, ziqi: 'hidden' }), { ...DEFAULT_QIZHENG_SCHOOLS, ziqi: 'hidden' })
    expect(hidden).not.toMatch(/^ {2}紫炁/m)
  })
})
