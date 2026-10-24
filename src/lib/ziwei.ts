// 紫微斗数命盘, built on iztro (https://github.com/SylarLong/iztro, MIT).
// iztro is only imported here, and this module is only loaded by the 紫微
// tab, so the calendar and bazi pages don't pay for it.
import { astro, util } from 'iztro'
import { LunarDay, LunarHour, LunarMonth, LunarYear, SolarDay } from 'tyme4ts'
import { effectiveTime, formatTime, type BaziInput, type ElementName } from './bazi'
import { mutagenTable, type ZiweiSchoolSettings } from './ziweiSchools'
import { STAR_ELEMENT, starLuck, type StarLuck } from './ziweiStars'

export interface ZiweiStar {
  name: string
  /** 庙 旺 得 利 平 不 陷 */
  brightness?: string
  /** 生年四化: 禄 权 科 忌 */
  mutagen?: string
  /** 五行, for 主星 and 辅星 */
  element?: ElementName
  /** 吉凶 category */
  luck: StarLuck
}

export interface ZiweiPalace {
  /** 命宫、兄弟 … */
  name: string
  stem: string
  branch: string
  isSoul: boolean
  isBody: boolean
  major: ZiweiStar[]
  minor: ZiweiStar[]
  adjective: ZiweiStar[]
  /** 长生十二神 */
  changsheng: string
  /** 大限 age range */
  decadal: [number, number]
  /** 宫干四化: where this palace's 天干 sends 禄、权、科、忌 */
  flies: ZiweiFly[]
}

/** One of a palace's four 飞化: the star its 天干 transforms and the palace that star sits in. */
export interface ZiweiFly {
  mutagen: string
  star: string
  /** 地支 of the palace the star is in; the palace's own 地支 is a 自化 */
  to: string
}

export interface ZiweiChart {
  gender: '男' | '女'
  solarText: string
  trueSolar?: { text: string; offsetMinutes: number }
  lunarText: string
  /** 四柱, e.g. 庚午 辛巳 庚辰 辛巳 */
  chineseDate: string
  /** 时辰, e.g. 巳时 */
  time: string
  timeRange: string
  zodiac: string
  sign: string
  /** 五行局 */
  fiveElementsClass: string
  /** 命主 / 身主 */
  soul: string
  body: string
  /** All twelve palaces, keyed by 地支 */
  palaces: Record<string, ZiweiPalace>
  /** 大限 in age order */
  decades: ZiweiDecade[]
  /** Lunar year of birth: 虚岁 1 */
  birthYear: number
}

export interface ZiweiDecade {
  /** The palace the 大限 runs through */
  branch: string
  stem: string
  palace: string
  range: [number, number]
  /** Lunar years covered, one per 虚岁 */
  years: number[]
}

export type LayerKind = 'decadal' | 'yearly' | 'monthly' | 'daily' | 'hourly'

/** One 运限 layer (大限, 流年, 流月, 流日 or 流时) laid over the natal board. */
export interface ZiweiLayer {
  kind: LayerKind
  stem: string
  branch: string
  /** 地支 → this layer's palace name (命宫, 兄弟 …) */
  palaceNames: Record<string, string>
  /** Star name → this layer's 四化 (禄 权 科 忌) */
  mutagens: Record<string, string>
  /** 地支 → 流耀 (运禄, 流羊, 月马 …) */
  stars: Record<string, ZiweiStar[]>
}

/** Clock hour → iztro 时辰 index: 0 早子 (00–01), 1 丑 … 11 亥, 12 晚子 (23–24). */
export const timeIndex = (hour: number) => (hour === 23 ? 12 : Math.floor((hour + 1) / 2))

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Cast the iztro astrolabe. iztro keeps its config globally, so anything that
 * reads the astrolabe later (运限) casts again rather than reuse an old one.
 */
function cast(input: BaziInput, schools: ZiweiSchoolSettings) {
  const { corrected, time } = effectiveTime(input)
  const dateStr = `${time.year}-${pad(time.month)}-${pad(time.day)}`
  const timeIdx = timeIndex(time.hour)
  const chart = astro.withOptions({
    type: 'solar',
    dateStr,
    timeIndex: timeIdx,
    gender: input.gender === 1 ? '男' : '女',
    language: 'zh-CN',
    config: {
      algorithm: schools.algorithm,
      yearDivide: schools.yearDivide,
      horoscopeDivide: schools.horoscopeDivide,
      ageDivide: schools.ageDivide,
      dayDivide: schools.dayDivide,
      // iztro types the keys/values as its own name unions; zh-CN names are accepted
      mutagens: mutagenTable(schools) as never,
    },
  })
  return { chart, corrected, dateStr, timeIdx }
}

const star = (s: { name: string; type: string; brightness?: string; mutagen?: string }): ZiweiStar => ({
  name: s.name,
  brightness: s.brightness || undefined,
  mutagen: s.mutagen || undefined,
  element: STAR_ELEMENT[s.name],
  luck: starLuck(s.type),
})

export function buildZiwei(input: BaziInput, schools: ZiweiSchoolSettings): ZiweiChart {
  const { chart, corrected, dateStr, timeIdx } = cast(input, schools)

  const palaces: Record<string, ZiweiPalace> = {}
  for (const p of chart.palaces) {
    palaces[p.earthlyBranch] = {
      name: p.name,
      stem: p.heavenlyStem,
      branch: p.earthlyBranch,
      isSoul: p.name === '命宫',
      isBody: p.isBodyPalace,
      major: p.majorStars.map(star),
      minor: p.minorStars.map(star),
      adjective: p.adjectiveStars.map(star),
      changsheng: p.changsheng12,
      decadal: p.decadal.range,
      flies: [],
    }
  }

  if (schools.tianma === 'month') {
    // 月马: same table as 年马, keyed by the lunar month's branch. iztro's own
    // month index (寅 = 0) keeps 闰月 handling in line with its other 月系 stars.
    const month = BRANCH_ORDER[(2 + util.fixLunarMonthIndex(dateStr, timeIdx, true)) % 12]
    moveStar(palaces, '天马', MA[month])
  }

  // 飞化 after any star moves, so they land where the board shows the star.
  const starBranch = new Map<string, string>()
  for (const p of Object.values(palaces)) for (const s of [...p.major, ...p.minor]) starBranch.set(s.name, p.branch)
  const table = { ...MUTAGEN_TABLE, ...mutagenTable(schools) }
  for (const p of Object.values(palaces)) {
    p.flies = (table[p.stem] ?? []).flatMap((name, i) => {
      const to = starBranch.get(name)
      return to ? [{ mutagen: MUTAGENS[i], star: name, to }] : []
    })
  }

  const birthYear = chart.rawDates.lunarDate.lunarYear
  const decades = Object.values(palaces)
    .map((p) => ({
      branch: p.branch,
      stem: p.stem,
      palace: p.name,
      range: p.decadal,
      years: Array.from({ length: p.decadal[1] - p.decadal[0] + 1 }, (_, i) => birthYear + p.decadal[0] - 1 + i),
    }))
    .sort((a, b) => a.range[0] - b.range[0])

  return {
    gender: input.gender === 1 ? '男' : '女',
    solarText: formatTime(input),
    trueSolar: corrected && { text: formatTime(corrected.time), offsetMinutes: corrected.offsetMinutes },
    lunarText: chart.lunarDate,
    chineseDate: chart.chineseDate,
    time: chart.time,
    timeRange: chart.timeRange,
    zodiac: chart.zodiac,
    sign: chart.sign,
    fiveElementsClass: chart.fiveElementsClass,
    soul: chart.soul,
    body: chart.body,
    palaces,
    decades,
    birthYear,
  }
}

const MUTAGENS = ['禄', '权', '科', '忌']

/**
 * 十干四化 (禄 权 科 忌), the common table; the 庚、戊、壬 rows that schools
 * dispute come from the 流派设置 (mutagenTable). Kept here rather than read
 * from iztro, whose table only follows the 流派 inside its own calculations.
 */
const MUTAGEN_TABLE: Partial<Record<string, string[]>> = {
  甲: ['廉贞', '破军', '武曲', '太阳'],
  乙: ['天机', '天梁', '紫微', '太阴'],
  丙: ['天同', '天机', '文昌', '廉贞'],
  丁: ['太阴', '天同', '天机', '巨门'],
  己: ['武曲', '贪狼', '天梁', '文曲'],
  辛: ['巨门', '太阳', '文曲', '文昌'],
  癸: ['破军', '巨门', '太阴', '贪狼'],
}

/** A 运限 moment: lunar year, month (1–12), day, and 时辰 (0 子 … 11 亥). */
export interface HoroscopeTarget {
  year: number
  month: number
  day: number
  hour: number
}

/** All five 运限 layers for a lunar moment. iztro works from a solar date plus 时辰. */
export function buildHoroscope(
  input: BaziInput,
  schools: ZiweiSchoolSettings,
  { year, month, day, hour }: HoroscopeTarget,
): Record<LayerKind, ZiweiLayer> {
  const { chart } = cast(input, schools)
  const solar = LunarDay.fromYmd(year, month, Math.min(day, daysInMonth(year, month))).getSolarDay()
  const h = chart.horoscope(`${solar.getYear()}-${pad(solar.getMonth())}-${pad(solar.getDay())}`, hour)
  const branches = chart.palaces.map((p) => p.earthlyBranch)
  const layer = (kind: LayerKind, item: (typeof h)['decadal']): ZiweiLayer => ({
    kind,
    stem: item.heavenlyStem,
    branch: item.earthlyBranch,
    palaceNames: Object.fromEntries(branches.map((b, i) => [b, item.palaceNames[i]])),
    mutagens: Object.fromEntries(item.mutagen.map((name, i) => [name, MUTAGENS[i]])),
    stars: Object.fromEntries(branches.map((b, i) => [b, (item.stars?.[i] ?? []).map(star)])),
  })
  return {
    decadal: layer('decadal', h.decadal),
    yearly: layer('yearly', h.yearly),
    monthly: layer('monthly', h.monthly),
    daily: layer('daily', h.daily),
    hourly: layer('hourly', h.hourly),
  }
}

/** Now as a 运限 moment (a 闰月 counts as its month number; 23:00 counts as this day's 子时). */
export function lunarToday(): HoroscopeTarget {
  const now = new Date()
  const d = SolarDay.fromYmd(now.getFullYear(), now.getMonth() + 1, now.getDate()).getLunarDay()
  const m = d.getLunarMonth()
  return { year: m.getLunarYear().getYear(), month: m.getMonth(), day: d.getDay(), hour: timeIndex(now.getHours()) % 12 }
}

/** 干支 of a lunar year, e.g. 丙午 */
export const yearGanzhi = (year: number) => LunarYear.fromYear(year).getSixtyCycle().getName()

/** Name and 干支 of a lunar month, e.g. 正月 庚寅 */
export function monthInfo(year: number, month: number) {
  const m = LunarMonth.fromYm(year, month)
  return { name: m.getName(), ganzhi: m.getSixtyCycle().getName() }
}

/**
 * Board positions: 地支 → [row, column] on the traditional 4×4 square, with
 * 巳 at the top-left and 寅 at the bottom-left; the middle 2×2 is the centre.
 */
export const BOARD: Record<string, [number, number]> = {
  巳: [1, 1], 午: [1, 2], 未: [1, 3], 申: [1, 4],
  辰: [2, 1], 酉: [2, 4],
  卯: [3, 1], 戌: [3, 4],
  寅: [4, 1], 丑: [4, 2], 子: [4, 3], 亥: [4, 4],
}

const BRANCH_ORDER = '子丑寅卯辰巳午未申酉戌亥'

/** 驿马: 寅午戌马在申，申子辰马在寅，巳酉丑马在亥，亥卯未马在巳 */
const MA: Record<string, string> = Object.fromEntries(
  ['寅午戌申', '申子辰寅', '巳酉丑亥', '亥卯未巳'].flatMap((g) => [...g.slice(0, 3)].map((b) => [b, g[3]])),
)

/** Move a 辅星 to the palace on another branch. */
function moveStar(palaces: Record<string, ZiweiPalace>, name: string, to: string) {
  for (const p of Object.values(palaces)) {
    const i = p.minor.findIndex((s) => s.name === name)
    if (i < 0) continue
    if (p.branch === to) return
    palaces[to].minor.push(...p.minor.splice(i, 1))
    return
  }
}

/** 三方四正 of a palace: its 对宫 (six palaces on) and the two 三合 palaces (four on, either way). */
export function sanFangSiZheng(branch: string): { opposite: string; trines: [string, string] } {
  const i = BRANCH_ORDER.indexOf(branch)
  const at = (n: number) => BRANCH_ORDER[(i + n) % 12]
  return { opposite: at(6), trines: [at(4), at(8)] }
}

/** Days in a (non-leap) lunar month: 29 or 30 */
export const daysInMonth = (year: number, month: number) => LunarMonth.fromYm(year, month).getDayCount()

/** Name and 干支 of a lunar day, e.g. 初一 庚午 */
export function dayInfo(year: number, month: number, day: number) {
  const d = LunarDay.fromYmd(year, month, day)
  return { name: d.getName(), ganzhi: d.getSixtyCycle().getName() }
}

/** Name and 干支 of a 时辰 (0 子 … 11 亥) on a lunar day, e.g. 子时 丙子 */
export function hourInfo(year: number, month: number, day: number, hour: number) {
  const h = LunarHour.fromYmdHms(year, month, day, hour * 2, 0, 0)
  return { name: `${BRANCH_ORDER[hour]}时`, ganzhi: h.getSixtyCycle().getName() }
}
