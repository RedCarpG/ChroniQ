import { SolarDay, type SixtyCycle } from 'tyme4ts'
import { glyph, type Glyph } from './bazi'

export interface DayCell {
  key: string
  solar: SolarDay
  day: number
  inMonth: boolean
  isToday: boolean
  isWeekend: boolean
  /** Text under the day number: festival > solar term > lunar day */
  sub: string
  subKind: 'festival' | 'term' | 'lunar' | 'month'
  /** The same line without festivals (节气 > lunar day), for when Chinese festivals are hidden */
  plainSub: string
  plainKind: 'term' | 'lunar' | 'month'
  /** 日干支, e.g. 庚午 */
  ganzhi: string
  /** 节气 starting this day, if any */
  termName?: string
  /** Solar or lunar festival, if any */
  festival?: string
  /** Statutory holiday marker: 休 (off) / 班 (make-up workday) */
  holiday?: '休' | '班'
}

export type WeekStart = 'mon' | 'sun'

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'] // tyme4ts index: 0 = Sunday

/** Short English weekday names, for the calendar in English (tyme4ts index: 0 = Sunday) */
export const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Column headers starting from the given weekday, with weekend flags and the weekday index (0 = Sunday). */
export function weekTitles(weekStart: WeekStart = 'mon'): { name: string; weekend: boolean; index: number }[] {
  const offset = weekStart === 'mon' ? 1 : 0
  return Array.from({ length: 7 }, (_, i) => {
    const index = (i + offset) % 7
    return { name: WEEKDAY_NAMES[index], weekend: index === 0 || index === 6, index }
  })
}

/**
 * A calendar date in English (British style, e.g. 24 October 2026), from the
 * date's own year, month and day: no time zone comes into it.
 */
export function enDate(year: number, month: number, day: number, options: Intl.DateTimeFormatOptions): string {
  const d = new Date(Date.UTC(2000, month - 1, day))
  d.setUTCFullYear(year)
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(d)
}

/** English month name, e.g. October / Oct */
export const enMonth = (month: number, style: 'long' | 'short' = 'long') => enDate(2000, month, 1, { month: style })

export function todaySolar(): SolarDay {
  const d = new Date()
  return SolarDay.fromYmd(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

export function sameDay(a: SolarDay, b: SolarDay): boolean {
  return a.getYear() === b.getYear() && a.getMonth() === b.getMonth() && a.getDay() === b.getDay()
}

function makeCell(solar: SolarDay, month: number, today: SolarDay): DayCell {
  // getLunarDay() is the expensive call; compute it once per cell.
  const lunar = solar.getLunarDay()
  const termDay = solar.getTermDay()
  const termName = termDay.getDayIndex() === 0 ? termDay.getSolarTerm().getName() : undefined
  const festival = solar.getFestival() ?? lunar.getFestival()
  const holiday = solar.getLegalHoliday()
  const plain: Pick<DayCell, 'plainSub' | 'plainKind'> = termName
    ? { plainSub: termName, plainKind: 'term' }
    : lunar.getDay() === 1
      ? { plainSub: lunar.getLunarMonth().getName(), plainKind: 'month' }
      : { plainSub: lunar.getName(), plainKind: 'lunar' }
  const sub: Pick<DayCell, 'sub' | 'subKind'> = festival
    ? { sub: festival.getName(), subKind: 'festival' }
    : { sub: plain.plainSub, subKind: plain.plainKind }
  return {
    key: solar.toString(),
    solar,
    day: solar.getDay(),
    inMonth: solar.getMonth() === month,
    isToday: sameDay(solar, today),
    isWeekend: solar.getWeek().getIndex() % 6 === 0,
    holiday: holiday ? (holiday.isWork() ? '班' : '休') : undefined,
    ganzhi: lunar.getSixtyCycle().getName(),
    termName,
    festival: festival?.getName(),
    ...sub,
    ...plain,
  }
}

/** Days to show before the 1st so that weekStart is column 0. */
function leadDays(first: SolarDay, weekStart: WeekStart): number {
  // tyme4ts weeks: 0 = Sunday … 6 = Saturday
  return (first.getWeek().getIndex() + (weekStart === 'mon' ? 6 : 0)) % 7
}

/** Six-week grid covering the given month, starting on Monday or Sunday. */
export function buildMonthGrid(year: number, month: number, weekStart: WeekStart = 'mon'): DayCell[] {
  const first = SolarDay.fromYmd(year, month, 1)
  const start = first.next(-leadDays(first, weekStart))
  const today = todaySolar()
  return Array.from({ length: 42 }, (_, i) => makeCell(start.next(i), month, today))
}

/**
 * The weeks covering two neighbouring months' grids, for scrolling from one to
 * the other: the six weeks of each, merged into one run of weeks (they share
 * some). `fromRow` and `toRow` are where each month's six-week grid starts in
 * it. Days are marked in-month for the month scrolled to.
 */
export function buildMonthStrip(
  from: { year: number; month: number },
  to: { year: number; month: number },
  weekStart: WeekStart = 'mon',
): { cells: DayCell[]; fromRow: number; toRow: number } {
  const gridStart = ({ year, month }: { year: number; month: number }) => {
    const first = SolarDay.fromYmd(year, month, 1)
    return first.next(-leadDays(first, weekStart))
  }
  const a = gridStart(from)
  const b = gridStart(to)
  const start = a.isBefore(b) ? a : b
  const fromRow = a.subtract(start) / 7
  const toRow = b.subtract(start) / 7
  const today = todaySolar()
  const rows = Math.max(fromRow, toRow) + 6
  return { cells: Array.from({ length: rows * 7 }, (_, i) => makeCell(start.next(i), to.month, today)), fromRow, toRow }
}

export interface WeekDay extends DayCell {
  duty: string
  recommends: string[]
  avoids: string[]
}

/** The seven days of the week containing anchor, with 建除 and 宜忌. */
export function buildWeek(anchor: SolarDay, weekStart: WeekStart = 'mon'): WeekDay[] {
  const start = anchor.next(-leadDays(anchor, weekStart))
  const today = todaySolar()
  return Array.from({ length: 7 }, (_, i) => {
    const solar = start.next(i)
    const lunar = solar.getLunarDay()
    return {
      ...makeCell(solar, solar.getMonth(), today),
      duty: lunar.getDuty().getName(),
      recommends: lunar.getRecommends().map((t) => t.getName()),
      avoids: lunar.getAvoids().map((t) => t.getName()),
    }
  })
}

export interface MiniMonth {
  month: number
  /** Empty cells before the 1st */
  lead: number
  days: DayCell[]
}

/** Twelve compact months for the year view (in-month days only). */
export function buildYear(year: number, weekStart: WeekStart = 'mon'): MiniMonth[] {
  const today = todaySolar()
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const first = SolarDay.fromYmd(year, month, 1)
    const count = first.getSolarMonth().getDayCount()
    return {
      month,
      lead: leadDays(first, weekStart),
      days: Array.from({ length: count }, (_, d) => makeCell(first.next(d), month, today)),
    }
  })
}

export interface DayDetail {
  solarText: string
  weekText: string
  constellation: string
  lunarText: string
  ganzhi: string
  /** 年、月、日三柱，供竖排显示 */
  pillars: { label: string; stem: Glyph; branch: Glyph }[]
  zodiac: string
  /** 节气 and the day within it, e.g. 霜降第1天 */
  term: string
  /** The 节气 of term, e.g. 霜降 */
  termName: string
  /** The day within it, from 1 */
  termDay: number
  festivals: string[]
  duty: string
  twelveStar: string
  twentyEightStar: string
  recommends: string[]
  avoids: string[]
  goodGods: string[]
  badGods: string[]
}

const pillar = (label: string, sc: SixtyCycle) => ({
  label,
  stem: glyph(sc.getHeavenStem()),
  branch: glyph(sc.getEarthBranch()),
})

export function buildDayDetail(solar: SolarDay): DayDetail {
  const lunar = solar.getLunarDay()
  const term = solar.getTermDay()
  const gods = lunar.getGods()
  const festivals = [solar.getFestival(), lunar.getFestival(), solar.getLegalHoliday()]
    .filter((f) => f != null)
    .map((f) => f.getName())
  return {
    solarText: `${solar.getYear()}年${solar.getMonth()}月${solar.getDay()}日`,
    weekText: `星期${solar.getWeek().getName()}`,
    constellation: `${solar.getConstellation().getName()}座`,
    lunarText: `${lunar.getLunarMonth().getName()}${lunar.getName()}`,
    ganzhi: solar.getSixtyCycleDay().toString(),
    pillars: [
      pillar('年', solar.getSixtyCycleDay().getYear()),
      pillar('月', solar.getSixtyCycleDay().getMonth()),
      pillar('日', solar.getSixtyCycleDay().getSixtyCycle()),
    ],
    zodiac: lunar.getYearSixtyCycle().getEarthBranch().getZodiac().getName(),
    term: `${term.getSolarTerm().getName()}第${term.getDayIndex() + 1}天`,
    termName: term.getSolarTerm().getName(),
    termDay: term.getDayIndex() + 1,
    festivals: [...new Set(festivals)],
    duty: lunar.getDuty().getName(),
    twelveStar: lunar.getTwelveStar().getName(),
    twentyEightStar: lunar.getTwentyEightStar().getName(),
    recommends: lunar.getRecommends().map((t) => t.getName()),
    avoids: lunar.getAvoids().map((t) => t.getName()),
    goodGods: gods.filter((g) => g.getLuck().getName() === '吉').map((g) => g.getName()),
    badGods: gods.filter((g) => g.getLuck().getName() !== '吉').map((g) => g.getName()),
  }
}
