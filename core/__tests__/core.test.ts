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
  fortuneText,
  buildHoroscope,
  ziweiHoroscopeText,
  birthNotes,
  solarToLunar,
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

  it('writes out the 岁运 of a year: the 大运 (and when it changes), the 流年 and its twelve 流月', () => {
    const chart = buildBazi(INPUT)
    const text = fortuneText(chart, { year: 2026 })
    // 乙酉 begins on 1996-12-28's anniversary, so 2026 runs on 甲申 until then
    expect(text).toMatch(/^ {2}大运 乙酉（2026–2035，37–46岁）：天干 乙木（伤官）.+这一年12月28日交运，之前仍走甲申大运$/m)
    expect(text).toMatch(/^ {2}流年 丙午（2026年立春起，虚岁 37）：天干 丙火（偏财）/m)
    expect(text).toContain('太岁：本命年')
    expect(text).toMatch(/^岁运与原局、岁运之间的刑冲合会：.*壬丙相冲（日、流年）/m)
    const months = text.split('\n').filter((l) => /^ {2}.月 \S\S（/.test(l))
    expect(months).toHaveLength(12)
    expect(months[0]).toMatch(/^ {2}寅月 庚寅（2月4日起）/)
    expect(months[11]).toMatch(/^ {2}丑月 辛丑（2027年1月5日起）/)
  })

  it('writes out the 岁运 of a day: its 大运 by the 交运 date, 流年 by 立春, 流月 by 节', () => {
    const chart = buildBazi(INPUT)
    const day = fortuneText(chart, { year: 2026, month: 11, day: 10 })
    expect(day).toMatch(/^ {2}大运 甲申/m)
    expect(day).toMatch(/^ {2}流月 己亥（11月7日立冬起）/m)
    expect(day).toMatch(/^ {2}流日 戊子：/m)
    expect(day).not.toContain('流月（以节为界）')
    // Before 立春 the 流年 is still last year's
    expect(fortuneText(chart, { year: 2027, month: 1, day: 20 })).toMatch(/^ {2}流年 丙午（2026年立春起/m)
  })

  it('writes out 紫微 运限, each layer’s 命宫 where its palace names put it', () => {
    const chart = buildZiwei(INPUT, DEFAULT_ZIWEI_SCHOOLS)
    const layers = buildHoroscope(INPUT, DEFAULT_ZIWEI_SCHOOLS, { year: 2026, month: 10, day: 2, hour: 0 })
    const text = ziweiHoroscopeText(chart, { decadal: layers.decadal, yearly: layers.yearly, monthly: layers.monthly }, 2026)
    expect(text).toMatch(/^运限（农历 2026 年，虚岁 37）/)
    expect(text).toMatch(/^ {2}流年 丙午：流年命宫在本命\S+（午）；流年四化 天同化禄（本命\S+）、天机化权/m)
    for (const name of ['大限', '流年', '流月']) {
      // 流月's 命宫 is counted from the 流年, not on the month's 地支 (亥)
      const palace = new RegExp(`^ {2}${name} .+${name}命宫在本命(\\S+?)（`, 'm').exec(text)![1]
      expect(text).toMatch(new RegExp(`^ {4}${name}十二宫：命宫=本命${palace}，`, 'm'))
    }
  })

  it('says where a birth time sits: daylight saving, a 节 near, the edge of a 时辰, the 晚子时', () => {
    const shanghai = findCity('上海')!
    // China's clocks went from 2:00 to 3:00 on 1988-04-17, and back from 2:00 to 1:00 on 1988-09-11
    expect(() => birthNotes({ ...INPUT, year: 1988, month: 4, day: 17, hour: 2, minute: 30, place: shanghai })).toThrow(/没有 1988年4月17日 02:30/)
    const twice = birthNotes({ ...INPUT, year: 1988, month: 9, day: 11, hour: 1, minute: 30, place: shanghai, trueSolar: true })
    // 真太阳时 takes the hour off and more: 00:39, 子时 where the clock says 丑时
    expect(twice.map((n) => n.kind)).toEqual(['overlap', 'dst', 'solarPillars'])
    // 成都 is 16° west of 120°E: 07:40 by the clock is 06:34 by the Sun, 卯时 not 辰时
    const chengdu = birthNotes({ ...INPUT, year: 1993, month: 8, day: 21, hour: 7, minute: 40, gender: 0, place: findCity('成都')!, trueSolar: true })
    expect(chengdu.map((n) => n.text)).toEqual(['按真太阳时（06:34）为 时柱丁卯；按钟表时间（07:40）则为 时柱戊辰。本盘按真太阳时排。用不用真太阳时，各家做法不同，解读时要说明。'])
    // New York 22:00 on 5 May 1990 was after 立夏 (02:35 on the 6th in 北京), though its clock reads earlier
    const ny = birthNotes({ ...INPUT, year: 1990, month: 5, day: 5, hour: 22, minute: 0, place: findCity('纽约')! })
    expect(ny.find((n) => n.kind === 'jie')!.text).toMatch(/之后，应为 月柱辛巳；.+排成了 月柱庚辰/)
    const edge = birthNotes({ ...INPUT, hour: 10, minute: 58 })
    expect(edge.find((n) => n.kind === 'hourEdge')!.text).toContain('之前为 时柱乙巳，之后为 时柱丙午')
    const late = birthNotes({ ...INPUT, hour: 23, minute: 30 })
    expect(late.find((n) => n.kind === 'lateZi')!.text).toMatch(/日柱算当天」，日柱壬午.+日柱算次日」则为 日柱癸未/)
    // With the hour unknown, a day with a 节 in it leaves the month open
    const open = birthNotes({ ...INPUT, month: 5, day: 6 }, undefined, false)
    expect(open.map((n) => n.kind)).toEqual(['noHour', 'jie'])
    expect(open[1].text).toMatch(/交立夏：出生在交节之前为 月柱庚辰，之后为 月柱辛巳/)
    // 北京 kept summer time in May 1990; by the clock, it stays in
    expect(birthNotes(INPUT).map((n) => n.text)).toEqual(['出生时北京实行夏令时（UTC+9）：本盘按钟表时间排，没有扣除夏令时的一小时；按真太阳时排会自动扣除。各家做法不同。'])
    expect(birthNotes({ ...INPUT, year: 1995 })).toEqual([])
  })

  it('sets a birth against the 节 by its actual moment when asked (BaziInput.jie)', () => {
    // Toronto, 06:15 on 4 Feb 1995: four hours after 立春 (15:12 in 北京), though its local time reads earlier
    const toronto = { year: 1995, month: 2, day: 4, hour: 6, minute: 15, gender: 1 as const, place: findCity('多伦多')!, trueSolar: true }
    const local = buildBazi(toronto)
    const instant = buildBazi({ ...toronto, jie: 'instant' })
    expect(local.pillars.map((p) => p.stem.char + p.branch.char)).toEqual(['甲戌', '丁丑', '丙寅', '辛卯'])
    expect(instant.pillars.map((p) => p.stem.char + p.branch.char)).toEqual(['乙亥', '戊寅', '丙寅', '辛卯'])
    expect(instant.zodiac).toBe('猪')
    // A 阴 year for a man: the 大运 run back from 戊寅, starting some three weeks on
    expect(instant.startText).toMatch(/^出生后0年0个月\d+天起运（1995年2月\d+日交运），逆排$/)
    expect(instant.decades[0].ganzhi).toBe('丁丑')
    expect(local.decades[0].ganzhi).toBe('戊寅')
    const note = birthNotes({ ...toronto, jie: 'instant' }).find((n) => n.kind === 'jie')!.text
    expect(note).toMatch(/本盘按实际时刻对照，为 年柱乙亥、月柱戊寅；.+则为 年柱甲戌、月柱丁丑/)
    // Away from a 节, and in 北京时间 by the clock with no summer time, the two agree; in May 1990 China's
    // clocks were an hour on, and the 起运 by the actual moment counts from an hour earlier
    expect(buildBazi({ ...INPUT, year: 1995, jie: 'instant' })).toEqual(buildBazi({ ...INPUT, year: 1995 }))
    expect(buildBazi({ ...INPUT, jie: 'instant' }).start).not.toEqual(buildBazi(INPUT).start)
  })

  it('turns a 公历 date to the 农历 one', () => {
    expect(solarToLunar(1990, 5, 17)).toEqual({ year: 1990, month: 4, day: 23, leap: false })
    expect(solarToLunar(2023, 3, 22)).toEqual({ year: 2023, month: 2, day: 1, leap: true })
    expect(solarToLunar(2027, 1, 20)).toMatchObject({ year: 2026, month: 12 })
  })
})
