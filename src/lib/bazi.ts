// Bazi (四柱八字) chart built on tyme4ts. Field layout follows the common
// 排盘 convention (主星 / 天干 / 地支 / 藏干 / 纳音 / 星运 / 自坐 / 空亡),
// similar to cantian-ai/bazi-mcp, but uses tyme4ts only.
import {
  ChildLimit,
  China95ChildLimitProvider,
  DefaultChildLimitProvider,
  DefaultEightCharProvider,
  LunarSect1ChildLimitProvider,
  LunarSect2ChildLimitProvider,
  Gender,
  HeavenStem,
  LunarHour,
  LunarSect2EightCharProvider,
  SixtyCycle,
  SixtyCycleYear,
  SolarDay,
  SolarTime,
  type DecadeFortune,
} from 'tyme4ts'
import { computeRelations, type Relation, type RelationMember } from './relations'
import { DEFAULT_SCHOOLS, type SchoolSettings } from './schools'
import { computeShenSha, type ShenSha } from './shensha'
import { DEFAULT_PLACE, type Place } from './place'
import { toTrueSolarTime, type WallTime } from './solarTime'

export type ElementName = '木' | '火' | '土' | '金' | '水'
export const ELEMENTS: ElementName[] = ['木', '火', '土', '金', '水']

export interface Glyph {
  char: string
  element: ElementName
  tenStar?: string
}

export interface Pillar {
  label: string
  stem: Glyph
  branch: Glyph
  hidden: Glyph[]
  sound: string
  terrain: string
  selfTerrain: string
  empty: string
  /** 旬首, e.g. 甲子 (this pillar belongs to the 甲子旬) */
  xun: string
  shenSha: ShenSha[]
}

export interface FortuneYear {
  year: number
  age: number
  ganzhi: string
  stem: Glyph
  branch: Glyph
}

export interface DecadeInfo {
  ganzhi: string
  startAge: number
  endAge: number
  startYear: number
  endYear: number
  stem: Glyph
  branch: Glyph
  years: FortuneYear[]
}

export interface BaziChart {
  gender: '男' | '女'
  solarText: string
  lunarText: string
  zodiac: string
  dayMaster: Glyph
  pillars: Pillar[]
  fetalOrigin: string
  fetalBreath: string
  ownSign: string
  bodySign: string
  startText: string
  /** The numbers behind startText, for building it in other languages */
  start: { years: number; months: number; days: number; year: number; month: number; day: number; forward: boolean }
  decades: DecadeInfo[]
  elementCount: Record<ElementName, number>
  relations: Relation[]
  /** Born 23:00–24:00 (after 真太阳时), where the 晚子时 setting matters */
  lateZiHour: boolean
  /** Set when 真太阳时 is applied */
  trueSolar?: { text: string; offsetMinutes: number; time: WallTime }
}

export interface BaziInput {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  gender: 0 | 1
  /** Birthplace (北京 when unset): for 真太阳时, and for 星盘 houses and time zone */
  place?: Place
  /** Cast 八字 / 紫微 from 真太阳时 at the birthplace instead of the clock time */
  trueSolar?: boolean
}

const eightCharProviders = { nextDay: new DefaultEightCharProvider(), sameDay: new LunarSect2EightCharProvider() }
const childLimitProviders = {
  default: new DefaultChildLimitProvider(),
  sect1: new LunarSect1ChildLimitProvider(),
  sect2: new LunarSect2ChildLimitProvider(),
  china95: new China95ChildLimitProvider(),
}

export function glyph(x: { getName(): string; getElement(): { getName(): string } }, tenStar?: string): Glyph {
  return { char: x.getName(), element: x.getElement().getName() as ElementName, tenStar }
}

function stemGlyph(stem: HeavenStem, me: HeavenStem): Glyph {
  return glyph(stem, me.getTenStar(stem).getName())
}

function pillar(label: string, sc: SixtyCycle, me: HeavenStem, isDay: boolean): Pillar {
  const stem = sc.getHeavenStem()
  const branch = sc.getEarthBranch()
  return {
    label,
    stem: isDay ? glyph(stem, '日主') : stemGlyph(stem, me),
    branch: glyph(branch),
    hidden: [branch.getHideHeavenStemMain(), branch.getHideHeavenStemMiddle(), branch.getHideHeavenStemResidual()]
      .filter((h): h is HeavenStem => h != null)
      .map((h) => stemGlyph(h, me)),
    sound: sc.getSound().getName(),
    terrain: me.getTerrain(branch).getName(),
    selfTerrain: stem.getTerrain(branch).getName(),
    empty: sc.getExtraEarthBranches().map((b) => b.getName()).join(''),
    xun: sc.getTen().getName(),
    shenSha: [],
  }
}

function decadeInfo(df: DecadeFortune, me: HeavenStem): DecadeInfo {
  const sc = df.getSixtyCycle()
  const years: FortuneYear[] = []
  let f = df.getStartFortune()
  for (let i = 0; i < 10; i++) {
    // Fortune.getSixtyCycle() is the 小运; the 流年 is the year's own ganzhi.
    const sixtyCycleYear = f.getSixtyCycleYear()
    const ysc = sixtyCycleYear.getSixtyCycle()
    years.push({
      year: sixtyCycleYear.getYear(),
      age: f.getAge(),
      ganzhi: ysc.getName(),
      stem: stemGlyph(ysc.getHeavenStem(), me),
      branch: glyph(ysc.getEarthBranch()),
    })
    f = f.next(1)
  }
  return {
    ganzhi: sc.getName(),
    startAge: df.getStartAge(),
    endAge: df.getEndAge(),
    startYear: df.getStartSixtyCycleYear().getYear(),
    endYear: df.getEndSixtyCycleYear().getYear(),
    stem: stemGlyph(sc.getHeavenStem(), me),
    branch: glyph(sc.getEarthBranch()),
    years,
  }
}

export function buildBazi(input: BaziInput, schools: SchoolSettings = DEFAULT_SCHOOLS): BaziChart {
  // tyme4ts selects these algorithms through static providers.
  LunarHour.provider = eightCharProviders[schools.ziHour]
  ChildLimit.provider = childLimitProviders[schools.childLimit]
  const { corrected, time: t } = effectiveTime(input)
  const time = SolarTime.fromYmdHms(t.year, t.month, t.day, t.hour, t.minute, 0)
  const lunarHour = time.getLunarHour()
  const ec = lunarHour.getEightChar()
  const me = ec.getDay().getHeavenStem()
  const pillars = [
    pillar('年柱', ec.getYear(), me, false),
    pillar('月柱', ec.getMonth(), me, false),
    pillar('日柱', ec.getDay(), me, true),
    pillar('时柱', ec.getHour(), me, false),
  ]

  const shenSha = computeShenSha(
    pillars.map((p) => ({ stem: p.stem.char, branch: p.branch.char })),
    schools,
  )
  pillars.forEach((p, i) => (p.shenSha = shenSha[i]))

  const elementCount = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<ElementName, number>
  for (const p of pillars) {
    elementCount[p.stem.element]++
    elementCount[p.branch.element]++
  }

  const childLimit = ChildLimit.fromSolarTime(time, input.gender === 1 ? Gender.MAN : Gender.WOMAN)
  const end = childLimit.getEndTime()
  const decades: DecadeInfo[] = []
  let df = childLimit.getStartDecadeFortune()
  for (let i = 0; i < 10; i++) {
    decades.push(decadeInfo(df, me))
    df = df.next(1)
  }

  const lunarDay = lunarHour.getLunarDay()
  return {
    gender: input.gender === 1 ? '男' : '女',
    solarText: formatTime(input),
    lunarText: `${lunarDay.getLunarMonth().getLunarYear().getSixtyCycle().getName()}年${lunarDay.getLunarMonth().getName()}${lunarDay.getName()} ${lunarHour.getName()}`,
    zodiac: ec.getYear().getEarthBranch().getZodiac().getName(),
    dayMaster: glyph(me),
    pillars,
    fetalOrigin: ec.getFetalOrigin().getName(),
    fetalBreath: ec.getFetalBreath().getName(),
    ownSign: ec.getOwnSign().getName(),
    bodySign: ec.getBodySign().getName(),
    startText: `出生后${childLimit.getYearCount()}年${childLimit.getMonthCount()}个月${childLimit.getDayCount()}天起运（${end.getYear()}年${end.getMonth()}月${end.getDay()}日交运），${childLimit.isForward() ? '顺' : '逆'}排`,
    start: {
      years: childLimit.getYearCount(),
      months: childLimit.getMonthCount(),
      days: childLimit.getDayCount(),
      year: end.getYear(),
      month: end.getMonth(),
      day: end.getDay(),
      forward: childLimit.isForward(),
    },
    decades,
    elementCount,
    relations: computeRelations(relationMembers(pillars), undefined, schools),
    lateZiHour: t.hour === 23,
    trueSolar: corrected && { text: formatTime(corrected.time), offsetMinutes: corrected.offsetMinutes, time: corrected.time },
  }
}

/** The birth time charts are cast from: 真太阳时 at the birthplace when chosen, else the clock time. */
export function effectiveTime(input: BaziInput) {
  const place = input.place ?? DEFAULT_PLACE
  const corrected = input.trueSolar ? toTrueSolarTime(input, place.longitude, place.timeZone) : undefined
  return { corrected, time: corrected?.time ?? input }
}

const pad = (n: number) => String(n).padStart(2, '0')
export const formatTime = (t: { year: number; month: number; day: number; hour: number; minute: number }) =>
  `${t.year}年${t.month}月${t.day}日 ${pad(t.hour)}:${pad(t.minute)}`

function relationMembers(pillars: Pillar[]): RelationMember[] {
  return pillars.map((p) => ({ label: p.label[0], stem: p.stem.char, branch: p.branch.char }))
}

export interface FlowMonth {
  /** 0 = 寅月 (from 立春) … 11 = 丑月 */
  index: number
  ganzhi: string
  stem: Glyph
  branch: Glyph
  /** First day (the 节), e.g. "2/4" */
  start: string
}

export interface FlowDay {
  key: string
  ganzhi: string
  stem: Glyph
  branch: Glyph
  month: number
  day: number
  isToday: boolean
}

/** 流月: the twelve 节令 months of a 干支 year (立春 to 立春). */
export function flowMonths(year: number, dayMaster: string): FlowMonth[] {
  const me = HeavenStem.fromName(dayMaster)
  return SixtyCycleYear.fromYear(year)
    .getMonths()
    .map((m, index) => {
      const sc = m.getSixtyCycle()
      const first = m.getFirstDay().getSolarDay()
      return {
        index,
        ganzhi: sc.getName(),
        stem: stemGlyph(sc.getHeavenStem(), me),
        branch: glyph(sc.getEarthBranch()),
        start: `${first.getMonth()}/${first.getDay()}`,
      }
    })
}

/** 流日: every day of a 流月. */
export function flowDays(year: number, monthIndex: number, dayMaster: string): FlowDay[] {
  const me = HeavenStem.fromName(dayMaster)
  const now = new Date()
  const today = SolarDay.fromYmd(now.getFullYear(), now.getMonth() + 1, now.getDate())
  return SixtyCycleYear.fromYear(year)
    .getMonths()
    [monthIndex].getDays()
    .map((d) => {
      const sc = d.getSixtyCycle()
      const solar = d.getSolarDay()
      return {
        key: solar.toString(),
        ganzhi: sc.getName(),
        stem: stemGlyph(sc.getHeavenStem(), me),
        branch: glyph(sc.getEarthBranch()),
        month: solar.getMonth(),
        day: solar.getDay(),
        isToday: solar.equals(today),
      }
    })
}

/** Index of the 流月 containing today, if today falls in that 干支 year (立春 to 立春). */
export function currentFlowMonth(year: number): number | undefined {
  const now = new Date()
  const today = SolarDay.fromYmd(now.getFullYear(), now.getMonth() + 1, now.getDate())
  const starts = SixtyCycleYear.fromYear(year).getMonths().map((m) => m.getFirstDay().getSolarDay())
  const nextYearStart = SixtyCycleYear.fromYear(year + 1).getFirstMonth().getFirstDay().getSolarDay()
  if (today.isBefore(starts[0]) || !today.isBefore(nextYearStart)) return undefined
  return starts.findLastIndex((s) => !s.isAfter(today))
}

export interface FortuneColumn {
  /** 大运 / 流年 / 流月 / 流日 */
  label: string
  ganzhi: string
}

/** Full pillar data for 岁运 columns, with 神煞 looked up from the natal chart. */
export function fortunePillars(chart: BaziChart, columns: FortuneColumn[], schools: SchoolSettings = DEFAULT_SCHOOLS): Pillar[] {
  const me = HeavenStem.fromName(chart.dayMaster.char)
  const pillars = columns.map((c) => pillar(c.label, SixtyCycle.fromName(c.ganzhi), me, false))
  const stars = computeShenSha(
    chart.pillars.map((p) => ({ stem: p.stem.char, branch: p.branch.char })),
    schools,
    pillars.map((p) => ({ stem: p.stem.char, branch: p.branch.char })),
  ).slice(4)
  pillars.forEach((p, i) => (p.shenSha = stars[i]))
  return pillars
}

/** 岁运与原局的刑冲合会: only relations involving at least one 岁运 column. */
export function fortuneRelations(
  chart: BaziChart,
  columns: FortuneColumn[],
  schools: SchoolSettings = DEFAULT_SCHOOLS,
): Relation[] {
  if (columns.length === 0) return []
  const members = [
    ...relationMembers(chart.pillars),
    ...columns.map((c) => ({ label: c.label, stem: c.ganzhi[0], branch: c.ganzhi[1] })),
  ]
  return computeRelations(members, columns.map((c) => c.label), schools)
}
