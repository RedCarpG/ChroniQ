// Saved charts on the calendar: the dates that matter to a chart. Birthdays
// (solar and lunar), the day's 干支 against the chart's day and year pillars,
// the days a 大运 begins, and 本命年 / 冲太岁. The 星盘 dates (solar return,
// slow-planet transits) are in chartWestern.ts, which loads separately.
import { LruCache } from './lruCache'
import { LunarDay, LunarMonth, SolarDay } from 'tyme4ts'
import { buildBazi, type BaziChart } from './bazi'
import { PUNISH, SELF_PUNISH, SIX_CLASH, SIX_COMBINE, isPair } from './relations'
import type { SavedChart } from './savedCharts'
import { DEFAULT_SCHOOLS, type SchoolSettings } from './schools'

/** What the calendar can show of a chart */
export type ChartItem = 'birthday' | 'clash' | 'fortune' | 'western'
export const CHART_ITEMS: ChartItem[] = ['birthday', 'clash', 'fortune', 'western']

/** One chart's date: structured, so the page words it in either language */
export type ChartDay = { chartId: string; name: string } & (
  | { kind: 'birthday'; age: number }
  | { kind: 'lunarBirthday' }
  | { kind: 'pillar'; relation: '冲' | '合' | '刑'; pillar: '日柱' | '年柱' }
  | { kind: 'decade'; ganzhi: string }
  | { kind: 'solarReturn' }
  | { kind: 'transit'; planet: string; aspect: string; point: string }
)

/** Whether a date is worth a line in the calendar grid (the rest show in the day panel) */
export const onGrid = (d: ChartDay) => d.kind !== 'pillar' || (d.relation === '冲' && d.pillar === '日柱')

const charts = new LruCache<string, BaziChart>(16)
/** The chart's 八字, cached by its input */
export function baziOf(chart: SavedChart, schools: SchoolSettings = DEFAULT_SCHOOLS): BaziChart {
  const key = JSON.stringify([chart.input, schools])
  let bazi = charts.get(key)
  if (!bazi) charts.set(key, (bazi = buildBazi(chart.input, schools)))
  return bazi
}

/** The month and day of the birth in the lunar calendar (a leap month counts as its month) */
function lunarBirth(chart: SavedChart) {
  const lunar = SolarDay.fromYmd(chart.input.year, chart.input.month, chart.input.day).getLunarDay()
  const month = lunar.getLunarMonth()
  return { year: month.getLunarYear().getYear(), month: month.getMonth(), day: lunar.getDay() }
}

const yearCache = new LruCache<string, Map<string, ChartDay[]>>(48)

/**
 * A chart's fixed dates in a (Gregorian) year, keyed by `${month}-${day}`:
 * birthdays, lunar birthdays and the days a 大运 begins.
 */
export function chartYear(chart: SavedChart, year: number, items: ChartItem[], schools: SchoolSettings = DEFAULT_SCHOOLS) {
  const key = JSON.stringify([chart.id, chart.name, chart.input, year, items, schools])
  const cached = yearCache.get(key)
  if (cached) return cached
  const days = new Map<string, ChartDay[]>()
  const add = (m: number, d: number, day: ChartDay) => days.set(`${m}-${d}`, [...(days.get(`${m}-${d}`) ?? []), day])
  const who = { chartId: chart.id, name: chart.name }
  const { input } = chart

  if (items.includes('birthday') && year > input.year) {
    // 29 February is kept on the 28th in common years
    const leap = SolarMonthDays(year, 2) === 29
    const [m, d] = input.month === 2 && input.day === 29 && !leap ? [2, 28] : [input.month, input.day]
    add(m, d, { ...who, kind: 'birthday', age: year - input.year })
    // The lunar birthday falls in lunar year year-1 or year; a 30th in a short month becomes the 29th
    const birth = lunarBirth(chart)
    for (const ly of [year - 1, year]) {
      if (ly <= birth.year || ly < 1900) continue
      const dayCount = LunarMonth.fromYm(ly, birth.month).getDayCount()
      const solar = LunarDay.fromYmd(ly, birth.month, Math.min(birth.day, dayCount)).getSolarDay()
      if (solar.getYear() === year) add(solar.getMonth(), solar.getDay(), { ...who, kind: 'lunarBirthday' })
    }
  }

  if (items.includes('fortune')) {
    const bazi = baziOf(chart, schools)
    for (const decade of bazi.decades) {
      if (decade.startYear === year) add(bazi.start.month, bazi.start.day, { ...who, kind: 'decade', ganzhi: decade.ganzhi })
    }
  }

  yearCache.set(key, days)
  return days
}

const SolarMonthDays = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate()

/** How a day's 干支 meets the chart's day and year pillars (地支 冲 / 合 / 刑) */
export function pillarDays(chart: SavedChart, dayBranch: string, schools: SchoolSettings = DEFAULT_SCHOOLS): ChartDay[] {
  const bazi = baziOf(chart, schools)
  const out: ChartDay[] = []
  for (const [pillar, index] of [
    ['日柱', 2],
    ['年柱', 0],
  ] as const) {
    const b = bazi.pillars[index].branch.char
    const relation = SIX_CLASH.some((p) => isPair(p, b, dayBranch))
      ? '冲'
      : SIX_COMBINE.some(([p]) => isPair(p, b, dayBranch)) || isPair('午未', b, dayBranch)
        ? '合'
        : PUNISH.some(([p]) => isPair(p, b, dayBranch)) || (b === dayBranch && SELF_PUNISH.includes(b))
          ? '刑'
          : null
    if (relation) out.push({ chartId: chart.id, name: chart.name, kind: 'pillar', relation, pillar })
  }
  return out
}

/** 本命年 (the year's branch is the birth year's) or 冲太岁 (it clashes with it), for a 干支 year's branch */
export function taiSui(chart: SavedChart, yearBranch: string, schools: SchoolSettings = DEFAULT_SCHOOLS): '本命年' | '冲太岁' | null {
  const birth = baziOf(chart, schools).pillars[0].branch.char
  if (birth === yearBranch) return '本命年'
  return SIX_CLASH.some((p) => isPair(p, birth, yearBranch)) ? '冲太岁' : null
}
