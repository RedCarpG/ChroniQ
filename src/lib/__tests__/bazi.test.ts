import { describe, expect, it } from 'vitest'
import { buildBazi, flowDays, flowMonths, fortunePillars, fortuneRelations } from '../bazi'
import { computeRelations } from '../relations'
import { DEFAULT_SCHOOLS } from '../schools'
import { DEFAULT_ZIWEI_SCHOOLS } from '../ziweiSchools'
import { STAR_ELEMENT, starLuck } from '../ziweiStars'
import { BRIGHTNESS_INFO, MUTAGEN_INFO, STAR_INFO } from '../ziweiInfo'
import { computeShenSha } from '../shensha'
import { equationOfTime, toTrueSolarTime } from '../solarTime'

const base = { year: 1990, month: 5, day: 15, hour: 10, minute: 30, gender: 1 } as const
const urumqi = { name: '乌鲁木齐', latitude: 43.83, longitude: 87.62, timeZone: 'Asia/Shanghai' }
const ny = { name: '纽约', latitude: 40.71, longitude: -74.01, timeZone: 'America/New_York' }
const names = (xs: { name: string }[]) => xs.map((x) => x.name).sort()

describe('buildBazi', () => {
  it('builds the four pillars', () => {
    const chart = buildBazi(base)
    expect(chart.pillars.map((p) => p.stem.char + p.branch.char)).toEqual(['庚午', '辛巳', '庚辰', '辛巳'])
  })

  it('uses the year ganzhi (not 小运) for 流年', () => {
    const years = buildBazi(base).decades.flatMap((d) => d.years)
    expect(years.find((y) => y.year === 2026)?.ganzhi).toBe('丙午')
    expect(years.find((y) => y.year === 1997)?.ganzhi).toBe('丁丑')
  })

  it('applies true solar time', () => {
    // 乌鲁木齐 10:30 北京时间, on 1990 summer time (UTC+9): 01:30 UT → ≈ 07:24 真太阳时 → 辰时 (庚辰)
    const chart = buildBazi({ ...base, place: urumqi, trueSolar: true })
    expect(chart.trueSolar?.text).toMatch(/1990年5月15日 07:2\d/)
    expect(chart.pillars[3].stem.char + chart.pillars[3].branch.char).toBe('庚辰')
    // The birthplace alone, without 真太阳时, leaves the clock time
    expect(buildBazi({ ...base, place: urumqi }).trueSolar).toBeUndefined()
  })

  it('applies 真太阳时 abroad, in the local time zone', () => {
    // 纽约 1990-05-15 10:30 EDT (UTC−4) = 14:30 UT; −74.01° → −296 min, EoT ≈ +3.7 → ≈ 09:38
    const chart = buildBazi({ ...base, place: ny, trueSolar: true })
    expect(chart.trueSolar?.text).toMatch(/1990年5月15日 09:3\d/)
  })

  it('lists 岁运 relations only when they involve a fortune column', () => {
    const chart = buildBazi(base)
    // 壬午运: 午 meets 年支午 → 自刑; every relation must involve 大运
    const rels = fortuneRelations(chart, [{ label: '大运', ganzhi: '壬午' }])
    expect(rels.map((r) => r.text)).toContain('午午自刑')
    expect(rels.every((r) => r.members.includes('大运'))).toBe(true)
    expect(fortuneRelations(chart, []).length).toBe(0)
  })

  it('builds 流月 by 节令 and 流日 within them', () => {
    const months = flowMonths(2026, '庚')
    expect(months.map((m) => m.ganzhi)).toEqual(['庚寅', '辛卯', '壬辰', '癸巳', '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑'])
    expect(months[0].start).toBe('2/4') // 立春
    expect(months[8].stem.tenStar).toBe('偏印') // 庚 → 戊
    const days = flowDays(2026, 8, '庚') // 戊戌月: 寒露 10/8 – 11/6
    expect([days[0].month, days[0].day, days.at(-1)!.month, days.at(-1)!.day]).toEqual([10, 8, 11, 6])
    expect(days.find((d) => d.month === 10 && d.day === 23)?.ganzhi).toBe('庚午')
  })

  it('gives 岁运 columns full pillar data with natal-based 神煞', () => {
    const chart = buildBazi(base) // 庚午 辛巳 庚辰 辛巳
    const [decade] = fortunePillars(chart, [{ label: '大运', ganzhi: '丁丑' }])
    expect(decade.stem.tenStar).toBe('正官')
    expect(decade.hidden.map((h) => h.char)).toEqual(['己', '癸', '辛'])
    // 庚日 天乙 in 丑未 → 丑 qualifies; 年支午 → 华盖戌 does not
    expect(decade.shenSha.map((x) => x.name)).toContain('天乙贵人')
  })
})

describe('computeShenSha', () => {
  // 庚午 辛巳 庚辰 辛巳, hand-checked against the rule tables
  const stars = computeShenSha([
    { stem: '庚', branch: '午' },
    { stem: '辛', branch: '巳' },
    { stem: '庚', branch: '辰' },
    { stem: '辛', branch: '巳' },
  ])

  it('year pillar', () => expect(names(stars[0])).toEqual(['月德贵人', '灾煞'].sort()))
  it('month pillar', () => expect(names(stars[1])).toEqual(['亡神', '劫煞', '天德贵人'].sort()))
  it('day pillar', () =>
    expect(names(stars[2])).toEqual(['十恶大败', '吊客', '国印贵人', '天医', '寡宿', '月德贵人', '魁罡'].sort()))
  it('hour pillar', () => expect(names(stars[3])).toEqual(['亡神', '劫煞', '天德贵人'].sort()))

  it('finds 天乙贵人 and 驿马', () => {
    const s = computeShenSha([
      { stem: '甲', branch: '子' },
      { stem: '丙', branch: '寅' },
      { stem: '甲', branch: '申' },
      { stem: '乙', branch: '丑' },
    ])
    expect(names(s[3])).toContain('天乙贵人') // 甲 → 丑未
    expect(names(s[1])).toContain('驿马') // 子年 / 申日 → 寅
    expect(names(s[0])).toContain('将星') // 申日 → 子
  })
})

describe('computeRelations', () => {
  const rels = computeRelations([
    { label: '年', stem: '甲', branch: '寅' },
    { label: '月', stem: '己', branch: '午' },
    { label: '日', stem: '庚', branch: '戌' },
    { label: '时', stem: '丙', branch: '申' },
  ]).map((r) => r.text)

  it('stem combine and clash', () => {
    expect(rels).toContain('甲己合土')
    expect(rels).toContain('甲庚相冲')
  })
  it('branch three-combine, half-combine, clash', () => {
    expect(rels).toContain('寅午戌三合火局')
    expect(rels).toContain('寅午半合火局')
    expect(rels).toContain('寅申相冲')
  })
  it('punishments', () => {
    expect(computeRelations([
      { label: '年', stem: '甲', branch: '子' },
      { label: '日', stem: '乙', branch: '卯' },
      { label: '时', stem: '丙', branch: '午' },
      { label: '月', stem: '丁', branch: '午' },
    ]).map((r) => r.text)).toEqual(expect.arrayContaining(['子卯无礼之刑', '午午自刑', '子午相冲', '卯午相破']))
  })
})

describe('solarTime', () => {
  it('equation of time peaks near +16 min in early November', () => {
    expect(equationOfTime(2000, 11, 3)).toBeCloseTo(16.4, 0)
  })
  it('crosses midnight correctly', () => {
    const { time } = toTrueSolarTime({ year: 2000, month: 1, day: 1, hour: 0, minute: 10 }, 87.62)
    expect(time).toMatchObject({ year: 1999, month: 12, day: 31, hour: 21 })
  })
  it('takes China’s 1986–91 daylight saving off', () => {
    // 1988-07-01 12:00 北京夏令时 = 03:00 UT; at 120°E solar time is about 10:56 (EoT ≈ −3.8 min)
    const summer = toTrueSolarTime({ year: 1988, month: 7, day: 1, hour: 12, minute: 0 }, 120)
    expect(summer.time).toMatchObject({ hour: 10, minute: 56 })
    // Outside daylight saving, 120°E is only the equation of time away
    const winter = toTrueSolarTime({ year: 1988, month: 1, day: 1, hour: 12, minute: 0 }, 120)
    expect(winter.time.hour).toBe(11)
  })
})

describe('流派 settings', () => {
  const p = (gz: string) => ({ stem: gz[0], branch: gz[1] })

  it('天乙贵人: 庚日 丑未 vs 寅午, flagged', () => {
    const chart = [p('甲子'), p('丙寅'), p('庚子'), p('乙丑')]
    const a = computeShenSha(chart, DEFAULT_SCHOOLS)
    expect(a[3].find((x) => x.name === '天乙贵人')?.school).toBe('tianYi')
    const b = computeShenSha(chart, { ...DEFAULT_SCHOOLS, tianYi: 'gengTigerHorse', stemRef: 'dayOnly' })
    expect(names(b[3])).not.toContain('天乙贵人')
    expect(names(b[1])).toContain('天乙贵人') // 寅
  })

  it('阴干羊刃 three variants', () => {
    const chart = [p('甲寅'), p('丙辰'), p('乙卯'), p('戊寅')]
    expect(names(computeShenSha(chart, { ...DEFAULT_SCHOOLS, yangRen: 'forward' })[1])).toContain('羊刃')
    const backward = computeShenSha(chart, { ...DEFAULT_SCHOOLS, yangRen: 'backward' })
    expect(backward[3].find((x) => x.name === '羊刃')?.school).toBe('yangRen')
    const none = computeShenSha(chart, { ...DEFAULT_SCHOOLS, yangRen: 'yangOnly' })
    expect(none.flat().some((x) => x.name === '羊刃')).toBe(false)
  })

  it('三合类神煞 reference pillar', () => {
    // 子年 → 驿马寅; 午日 → 驿马申
    const chart = [p('甲子'), p('丙寅'), p('庚午'), p('甲申')]
    const yearOnly = computeShenSha(chart, { ...DEFAULT_SCHOOLS, branchRef: 'yearOnly' })
    expect(names(yearOnly[1])).toContain('驿马')
    expect(names(yearOnly[3])).not.toContain('驿马')
    const dayOnly = computeShenSha(chart, { ...DEFAULT_SCHOOLS, branchRef: 'dayOnly' })
    expect(names(dayOnly[3])).toContain('驿马')
    expect(dayOnly[3].find((x) => x.name === '驿马')?.school).toBe('branchRef')
  })

  it('午未合 化土 / 化火', () => {
    const m = [
      { label: '年', stem: '甲', branch: '午' },
      { label: '日', stem: '乙', branch: '未' },
    ]
    expect(computeRelations(m)[0]).toMatchObject({ text: '午未六合土', school: 'wuWei' })
    expect(computeRelations(m, undefined, { ...DEFAULT_SCHOOLS, wuWei: '火' })[0].text).toBe('午未六合火')
  })

  it('晚子时 changes the day pillar', () => {
    const late = { ...base, hour: 23, minute: 30 }
    const same = buildBazi(late, { ...DEFAULT_SCHOOLS, ziHour: 'sameDay' })
    const next = buildBazi(late, { ...DEFAULT_SCHOOLS, ziHour: 'nextDay' })
    expect(same.lateZiHour).toBe(true)
    expect(same.pillars[2].stem.char + same.pillars[2].branch.char).toBe('庚辰')
    expect(next.pillars[2].stem.char + next.pillars[2].branch.char).toBe('辛巳')
  })

  it('起运算法 changes the start text', () => {
    const texts = (['default', 'sect1', 'sect2', 'china95'] as const).map(
      (childLimit) => buildBazi(base, { ...DEFAULT_SCHOOLS, childLimit }).startText,
    )
    expect(new Set(texts).size).toBeGreaterThan(1)
  })
})

describe('神煞说明', () => {
  it('has an explanation for every star computeShenSha can return', async () => {
    const { SHENSHA_INFO } = await import('../shenshaInfo')
    const { SCHOOLS } = await import('../schools')
    const STEMS = '甲乙丙丁戊己庚辛壬癸'
    const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'
    const sixty = Array.from({ length: 60 }, (_, i) => ({ stem: STEMS[i % 10], branch: BRANCHES[i % 12] }))
    const seen = new Set<string>()
    const variants = [DEFAULT_SCHOOLS, ...Object.entries(SCHOOLS).flatMap(([k, info]) =>
      info.options.map((o) => ({ ...DEFAULT_SCHOOLS, [k]: o.value })))]
    // Three years, every month and day: every star turns up within one year already (measured), so
    // three leave room for a star that needs some year, at a third of the time of the nine there were
    for (const schools of variants)
      for (const year of sixty.filter((_, i) => i % 20 === 0))
        for (const month of sixty.filter((_, i) => i < 12))
          for (const day of sixty)
            for (const s of computeShenSha([year, month, day, sixty[(sixty.indexOf(day) + 5) % 60]], schools).flat())
              seen.add(s.name)
    const missing = [...seen].filter((n) => !SHENSHA_INFO[n])
    expect(missing).toEqual([])
    expect(seen.size).toBe(Object.keys(SHENSHA_INFO).length)
  })
})

describe('saved charts', () => {
  it('validates stored input and upserts by name', async () => {
    const { toBaziInput, upsertChart } = await import('../savedCharts')
    // Older saved input: a 真太阳时 longitude becomes 真太阳时 at its city
    expect(toBaziInput({ ...base, longitude: 87.62 })).toEqual({ ...base, place: urumqi, trueSolar: true })
    expect(toBaziInput({ ...base, place: ny, trueSolar: true })).toEqual({ ...base, place: ny, trueSolar: true })
    // A broken place is dropped, the rest kept; with no place, the fallback is used
    expect(toBaziInput({ ...base, place: { ...ny, timeZone: 'Mars/Base' } })).toEqual(base)
    expect(toBaziInput(base, ny)).toEqual({ ...base, place: ny })
    expect(toBaziInput({ ...base, month: 13 })).toBeNull()
    expect(toBaziInput({ ...base, gender: 2 })).toBeNull()
    expect(toBaziInput('junk')).toBeNull()
    let charts = upsertChart([], '张三', base)
    charts = upsertChart(charts, '李四', { ...base, gender: 0 })
    charts = upsertChart(charts, '张三', { ...base, hour: 8 })
    expect(charts.map((c) => [c.name, c.input.hour, c.input.gender])).toEqual([['张三', 8, 1], ['李四', 10, 0]])
  })
})

describe('术语说明', () => {
  it('covers every 纳音, 十二长生 and table concept', async () => {
    const { Sound, Terrain } = await import('tyme4ts')
    const { CONCEPTS, SOUND_INFO, TERRAIN_INFO } = await import('../glossary')
    const sounds = Array.from({ length: 30 }, (_, i) => Sound.fromIndex(i).getName())
    const terrains = Array.from({ length: 12 }, (_, i) => Terrain.fromIndex(i).getName())
    expect(sounds.filter((n) => !SOUND_INFO[n])).toEqual([])
    expect(terrains.filter((n) => !TERRAIN_INFO[n])).toEqual([])
    const shown = ['主星', '天干', '地支', '藏干', '纳音', '星运', '自坐', '空亡', '神煞', '大运', '流年', '流月', '流日', '胎元', '胎息', '命宫', '身宫']
    expect(shown.filter((n) => !CONCEPTS[n])).toEqual([])
  })

  it('records the 旬 behind each pillar\'s 空亡', () => {
    const [year] = buildBazi(base).pillars // 庚午: 甲子旬, 空亡 戌亥
    expect([year.xun, year.empty]).toEqual(['甲子', '戌亥'])
  })
})

describe('紫微斗数', () => {
  it('maps clock hours to 时辰 indexes', async () => {
    const { timeIndex } = await import('../ziwei')
    expect([0, 1, 2, 10, 11, 22, 23].map(timeIndex)).toEqual([0, 1, 1, 5, 6, 11, 12])
  })

  it('casts the chart (checked by hand: 命宫子, 身宫戌, 火六局)', async () => {
    const { buildZiwei } = await import('../ziwei')
    const z = buildZiwei(base, DEFAULT_ZIWEI_SCHOOLS) // 1990-05-15 10:30 巳时 男
    expect(z.chineseDate).toBe('庚午 辛巳 庚辰 辛巳') // same 四柱 as the bazi chart
    expect(z.palaces['子'].isSoul).toBe(true)
    expect(z.palaces['戌'].isBody).toBe(true)
    expect(z.fiveElementsClass).toBe('火六局')
    // 庚年四化: 太阳禄 武曲权 太阴科 天同忌
    const mutagens = Object.values(z.palaces).flatMap((p) => p.major.filter((s) => s.mutagen).map((s) => s.name + s.mutagen))
    expect(mutagens.sort()).toEqual(['天同忌', '太阳禄', '太阴科', '武曲权'].sort())
  })

  it('places every palace on the board once', async () => {
    const { BOARD, buildZiwei } = await import('../ziwei')
    const z = buildZiwei(base, DEFAULT_ZIWEI_SCHOOLS)
    expect(Object.keys(z.palaces).sort()).toEqual(Object.keys(BOARD).sort())
    expect(new Set(Object.values(BOARD).map(String)).size).toBe(12)
  })

  it('has its own 流派设置: 庚年四化 and 安星法 variants', async () => {
    const { buildZiwei } = await import('../ziwei')
    const z = buildZiwei(base, { ...DEFAULT_ZIWEI_SCHOOLS, mutagenGeng: 'yangWuTongYin' })
    const mutagens = Object.values(z.palaces).flatMap((p) => p.major.filter((s) => s.mutagen).map((s) => s.name + s.mutagen))
    expect(mutagens).toContain('天同科')
    expect(mutagens).toContain('太阴忌')
    expect(buildZiwei(base, DEFAULT_ZIWEI_SCHOOLS).soul).toBe('贪狼')
    expect(buildZiwei(base, { ...DEFAULT_ZIWEI_SCHOOLS, algorithm: 'zhongzhou' }).soul).toBe('破军')
  })

  it('gives every 主星 and 辅星 an element and a 吉凶 class', async () => {
    const { buildZiwei } = await import('../ziwei')
    const z = buildZiwei(base, DEFAULT_ZIWEI_SCHOOLS)
    const stars = Object.values(z.palaces).flatMap((p) => [...p.major, ...p.minor])
    expect(stars.length).toBeGreaterThanOrEqual(14)
    for (const s of stars) expect(s.element, s.name).toBeDefined()
    expect(Object.keys(STAR_ELEMENT)).toHaveLength(28)
    expect(stars.filter((s) => s.luck === 'major')).toHaveLength(14)
    expect(stars.find((s) => s.name === '擎羊')?.luck).toBe('bad')
    expect(stars.find((s) => s.name === '禄存')?.luck).toBe('good')
    expect(starLuck('adjective')).toBe('neutral')
  })

  it('places 天马 by year (年马) or by lunar month (月马)', async () => {
    const { buildZiwei } = await import('../ziwei')
    const where = (z: ReturnType<typeof buildZiwei>) =>
      Object.values(z.palaces).filter((p) => p.minor.some((s) => s.name === '天马')).map((p) => p.branch)
    // 1997-11-02 09:30: 丑年 → 马在亥; 农历十月 (亥月) → 马在巳, as 文墨天机 shows
    const input = { ...base, year: 1997, month: 11, day: 2, hour: 9, minute: 30 }
    expect(where(buildZiwei(input, DEFAULT_ZIWEI_SCHOOLS))).toEqual(['亥'])
    expect(where(buildZiwei(input, { ...DEFAULT_ZIWEI_SCHOOLS, tianma: 'month' }))).toEqual(['巳'])
    // 1990-05-15 is 农历四月 (巳月) of a 午年: 年马 申, 月马 亥
    expect(where(buildZiwei(base, DEFAULT_ZIWEI_SCHOOLS))).toEqual(['申'])
    expect(where(buildZiwei(base, { ...DEFAULT_ZIWEI_SCHOOLS, tianma: 'month' }))).toEqual(['亥'])
    // 2023 闰二月: the first half counts as 二月 (卯 → 巳), the second half as 三月 (辰 → 寅)
    const month = { ...DEFAULT_ZIWEI_SCHOOLS, tianma: 'month' as const }
    expect(where(buildZiwei({ ...base, year: 2023, month: 3, day: 25 }, month))).toEqual(['巳'])
    expect(where(buildZiwei({ ...base, year: 2023, month: 4, day: 10 }, month))).toEqual(['寅'])
  })

  it('lists 大限 with their years, matching iztro\'s own 运限', async () => {
    const { buildZiwei, buildHoroscope } = await import('../ziwei')
    for (const input of [base, { ...base, year: 1997, month: 11, day: 2, hour: 9 }, { ...base, gender: 0 as const, year: 1984, month: 2, day: 3 }]) {
      const z = buildZiwei(input, DEFAULT_ZIWEI_SCHOOLS)
      expect(z.decades).toHaveLength(12)
      for (const d of z.decades.slice(0, 6))
        for (const y of [d.years[0], d.years[d.years.length - 1]]) {
          const h = buildHoroscope(input, DEFAULT_ZIWEI_SCHOOLS, { year: y, month: 6, day: 15, hour: 6 })
          expect(h.decadal.branch, `${input.year} ${y}`).toBe(d.branch)
          expect(h.yearly.branch).toBe('子丑寅卯辰巳午未申酉戌亥'[(y - 4) % 12])
        }
    }
  })

  it('gives each 运限 layer its palace names, 四化 and 流耀', async () => {
    const { buildHoroscope } = await import('../ziwei')
    // 1990 男, 2026 丙午年: 流年命宫 in 午; 丙干四化 天同禄 天机权 文昌科 廉贞忌
    const h = buildHoroscope(base, DEFAULT_ZIWEI_SCHOOLS, { year: 2026, month: 9, day: 15, hour: 6 })
    expect(h.yearly.stem + h.yearly.branch).toBe('丙午')
    expect(h.yearly.palaceNames['午']).toBe('命宫')
    expect(h.yearly.mutagens).toEqual({ 天同: '禄', 天机: '权', 文昌: '科', 廉贞: '忌' })
    expect(Object.values(h.yearly.stars).flat().map((s) => s.name)).toContain('流禄')
    expect(Object.values(h.decadal.stars).flat().map((s) => s.name)).toContain('运禄')
    expect(Object.values(h.monthly.stars).flat().map((s) => s.name)).toContain('月禄')
    // 流禄 sits with 禄存's table: 丙 → 巳
    expect(h.yearly.stars['巳'].map((s) => s.name)).toContain('流禄')
  })

  it('adds 流日 and 流时 layers for a lunar day and 时辰', async () => {
    const { buildHoroscope, dayInfo, hourInfo } = await import('../ziwei')
    // 2026 九月十四 (2026-10-23) is a 庚午 day; its 未时 is 癸未
    const input = { ...base, year: 1997, month: 11, day: 2, hour: 9, minute: 30 }
    const h = buildHoroscope(input, DEFAULT_ZIWEI_SCHOOLS, { year: 2026, month: 9, day: 14, hour: 7 })
    expect(dayInfo(2026, 9, 14)).toEqual({ name: '十四', ganzhi: '庚午' })
    expect(hourInfo(2026, 9, 14, 7)).toEqual({ name: '未时', ganzhi: '癸未' })
    expect(h.daily.stem + h.daily.branch).toBe('庚午')
    expect(h.hourly.stem + h.hourly.branch).toBe('癸未')
    // 庚干四化 for the day, 癸干 for the hour
    expect(h.daily.mutagens).toEqual({ 太阳: '禄', 武曲: '权', 太阴: '科', 天同: '忌' })
    expect(h.hourly.mutagens).toEqual({ 破军: '禄', 巨门: '权', 太阴: '科', 贪狼: '忌' })
    expect(Object.values(h.daily.stars).flat().map((s) => s.name)).toContain('日禄')
    expect(Object.values(h.hourly.stars).flat().map((s) => s.name)).toContain('时禄')
    expect(Object.values(h.daily.palaceNames).filter((n) => n === '命宫')).toHaveLength(1)
  })

  it('finds the 三方四正 of a palace', async () => {
    const { sanFangSiZheng } = await import('../ziwei')
    expect(sanFangSiZheng('子')).toEqual({ opposite: '午', trines: ['辰', '申'] })
    expect(sanFangSiZheng('寅')).toEqual({ opposite: '申', trines: ['午', '戌'] })
    expect(sanFangSiZheng('亥')).toEqual({ opposite: '巳', trines: ['卯', '未'] })
  })

  it('explains every star, 亮度 and 四化 iztro can place', async () => {
    const { buildZiwei } = await import('../ziwei')
    const missing = new Set<string>()
    // Six charts each way: every name has turned up by the second (measured); iztro takes ~40 ms a chart
    for (const algorithm of ['default', 'zhongzhou'] as const)
      for (let i = 0; i < 6; i++) {
        const input = { ...base, year: 1960 + i * 7, month: 1 + ((i * 5) % 12), hour: (i * 5) % 24, gender: (i % 2) as 0 | 1 }
        const z = buildZiwei(input, { ...DEFAULT_ZIWEI_SCHOOLS, algorithm })
        for (const p of Object.values(z.palaces))
          for (const s of [...p.major, ...p.minor, ...p.adjective]) {
            if (!STAR_INFO[s.name]) missing.add(s.name)
            if (s.brightness && !BRIGHTNESS_INFO[s.brightness]) missing.add(s.brightness)
            if (s.mutagen && !MUTAGEN_INFO[s.mutagen]) missing.add(s.mutagen)
          }
      }
    expect([...missing]).toEqual([])
  })
})
