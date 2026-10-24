// Holidays and notable dates of other countries, for the calendar (设置 →
// 其他地区节日). Each country is a short table of rules: a fixed date, a day
// counted from Easter, or the n-th (or last) given weekday of a month. Names
// come in Chinese, English and the local language.
//
// To add a country: add its code to RegionCode, a REGIONS entry and its rules.

export type RegionCode = 'fr'
export type Region = 'none' | RegionCode

export interface RegionDay {
  /** Chinese name */
  name: string
  en: string
  /** Name in the country's own language */
  local: string
  /** public: a day off nationwide; regional: off only where `note` says; observance: a notable day, not off */
  kind: 'public' | 'regional' | 'observance'
  /** Chinese note (where a regional day applies, or what to know), with its English */
  note?: string
  noteEn?: string
}

type DateRule = (year: number) => [month: number, day: number]
interface Rule extends RegionDay {
  date: DateRule
}

/** Easter Sunday (Gregorian), by the anonymous Gregorian computus */
export function easter(year: number): [number, number] {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return [month, day]
}

const ymd = (d: Date): [number, number] => [d.getUTCMonth() + 1, d.getUTCDate()]
const fixed = (month: number, day: number): DateRule => () => [month, day]
/** Days after (or before, if negative) Easter Sunday */
const fromEaster =
  (days: number): DateRule =>
  (year) => {
    const [m, d] = easter(year)
    return ymd(new Date(Date.UTC(year, m - 1, d + days)))
  }
/** The n-th weekday (0 = Sunday) of a month; n = -1 for the last */
const nthWeekday =
  (month: number, weekday: number, n: number): DateRule =>
  (year) => {
    if (n > 0) {
      const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
      return [month, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7]
    }
    const lastDay = new Date(Date.UTC(year, month, 0))
    return [month, lastDay.getUTCDate() - ((lastDay.getUTCDay() - weekday + 7) % 7)]
  }

const ALSACE = { note: '仅阿尔萨斯-摩泽尔放假', noteEn: 'Day off in Alsace-Moselle only' }

const FRANCE: Rule[] = [
  // Jours fériés
  { date: fixed(1, 1), kind: 'public', name: '元旦', en: "New Year's Day", local: "Jour de l'An" },
  { date: fromEaster(1), kind: 'public', name: '复活节星期一', en: 'Easter Monday', local: 'Lundi de Pâques' },
  { date: fixed(5, 1), kind: 'public', name: '劳动节', en: 'Labour Day', local: 'Fête du Travail' },
  { date: fixed(5, 8), kind: 'public', name: '欧战胜利日', en: 'Victory in Europe Day', local: 'Victoire 1945' },
  { date: fromEaster(39), kind: 'public', name: '耶稣升天节', en: 'Ascension Day', local: 'Ascension' },
  {
    date: fromEaster(50),
    kind: 'public',
    name: '圣灵降临节星期一',
    en: 'Whit Monday',
    local: 'Lundi de Pentecôte',
    note: '也是「团结日」，部分单位照常上班',
    noteEn: 'Also the day of solidarity: some employers work as usual',
  },
  { date: fixed(7, 14), kind: 'public', name: '法国国庆日', en: 'Bastille Day', local: 'Fête nationale' },
  { date: fixed(8, 15), kind: 'public', name: '圣母升天节', en: 'Assumption Day', local: 'Assomption' },
  { date: fixed(11, 1), kind: 'public', name: '诸圣节', en: "All Saints' Day", local: 'Toussaint' },
  { date: fixed(11, 11), kind: 'public', name: '一战停战纪念日', en: 'Armistice Day', local: 'Armistice 1918' },
  { date: fixed(12, 25), kind: 'public', name: '圣诞节', en: 'Christmas Day', local: 'Noël' },
  // Off in Alsace-Moselle only
  { date: fromEaster(-2), kind: 'regional', name: '耶稣受难日', en: 'Good Friday', local: 'Vendredi saint', ...ALSACE },
  { date: fixed(12, 26), kind: 'regional', name: '圣斯德望日', en: "St Stephen's Day", local: 'Saint-Étienne', ...ALSACE },
  // Notable days
  { date: fixed(1, 6), kind: 'observance', name: '主显节', en: 'Epiphany', local: 'Épiphanie', note: '吃国王饼', noteEn: 'Time for a galette des rois' },
  { date: fixed(2, 2), kind: 'observance', name: '圣烛节', en: 'Candlemas', local: 'Chandeleur', note: '吃可丽饼', noteEn: 'Crêpe day' },
  { date: fixed(2, 14), kind: 'observance', name: '情人节', en: "Valentine's Day", local: 'Saint-Valentin' },
  { date: fromEaster(-47), kind: 'observance', name: '狂欢节', en: 'Shrove Tuesday', local: 'Mardi gras' },
  {
    date: nthWeekday(3, 0, -1),
    kind: 'observance',
    name: '夏令时开始',
    en: 'Clocks go forward',
    local: "Passage à l'heure d'été",
    note: '凌晨 2 点拨快到 3 点',
    noteEn: '2:00 becomes 3:00',
  },
  { date: fromEaster(0), kind: 'observance', name: '复活节', en: 'Easter Sunday', local: 'Pâques' },
  { date: fromEaster(49), kind: 'observance', name: '圣灵降临节', en: 'Pentecost', local: 'Pentecôte' },
  {
    // The last Sunday of May, moved to the first Sunday of June when it falls on Pentecost
    date: (year) => {
      const may = nthWeekday(5, 0, -1)(year)
      const pentecost = fromEaster(49)(year)
      return may[0] === pentecost[0] && may[1] === pentecost[1] ? nthWeekday(6, 0, 1)(year) : may
    },
    kind: 'observance',
    name: '母亲节',
    en: "Mother's Day",
    local: 'Fête des mères',
  },
  { date: nthWeekday(6, 0, 3), kind: 'observance', name: '父亲节', en: "Father's Day", local: 'Fête des pères' },
  { date: fixed(6, 21), kind: 'observance', name: '音乐节', en: 'Music Day', local: 'Fête de la musique' },
  {
    date: nthWeekday(10, 0, -1),
    kind: 'observance',
    name: '冬令时开始',
    en: 'Clocks go back',
    local: "Passage à l'heure d'hiver",
    note: '凌晨 3 点拨回到 2 点',
    noteEn: '3:00 becomes 2:00',
  },
]

export const REGIONS: Record<RegionCode, { name: string; en: string; tag: string; rules: Rule[] }> = {
  fr: { name: '法国', en: 'France', tag: 'FR', rules: FRANCE },
}

/** Which holidays the calendar shows: China's (festivals and 休 / 班) and any other countries' */
export interface HolidayChoice {
  china: boolean
  regions: RegionCode[]
}

const CHOICE_KEY = 'chroniq-calendar-holidays'
const isCode = (v: unknown): v is RegionCode => typeof v === 'string' && v in REGIONS

/**
 * The calendar's holiday choice, kept in this browser. Earlier versions kept a
 * single other country, on the calendar page or in the app settings; that
 * carries over.
 */
export function loadHolidayChoice(): HolidayChoice {
  try {
    const saved = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? 'null') as Partial<HolidayChoice> | null
    if (saved) return { china: saved.china !== false, regions: (saved.regions ?? []).filter(isCode) }
    const legacy =
      localStorage.getItem('chroniq-calendar-region') ??
      (JSON.parse(localStorage.getItem('chroniq-settings') ?? '{}') as { region?: unknown }).region
    return { china: true, regions: isCode(legacy) ? [legacy] : [] }
  } catch {
    return { china: true, regions: [] }
  }
}

export function saveHolidayChoice(choice: HolidayChoice): void {
  try {
    localStorage.setItem(CHOICE_KEY, JSON.stringify(choice))
  } catch {
    // storage unavailable: lasts for this visit
  }
}

/** A country's day with that country's tag (e.g. FR), for the calendar */
export interface TaggedRegionDay extends RegionDay {
  code: RegionCode
  tag: string
}

/** The chosen countries' days on a date */
export function chosenDays(regions: RegionCode[], year: number, month: number, day: number): TaggedRegionDay[] {
  return regions.flatMap((code) => regionDays(code, year, month, day).map((d) => ({ ...d, code, tag: REGIONS[code].tag })))
}

/** The tags to show on a date: countries with a day off (all of it, or only part) */
export function offTags(days: TaggedRegionDay[]): { tag: string; partial: boolean }[] {
  const codes = [...new Set(days.filter((d) => d.kind !== 'observance').map((d) => d.code))]
  return codes.map((code) => ({
    tag: REGIONS[code].tag,
    partial: !days.some((d) => d.code === code && d.kind === 'public'),
  }))
}

const cache = new Map<string, Map<string, RegionDay[]>>()

/** All of a region's days in a year, keyed by `${month}-${day}` */
export function regionYear(region: RegionCode, year: number): Map<string, RegionDay[]> {
  const key = `${region}${year}`
  let days = cache.get(key)
  if (!days) {
    days = new Map()
    for (const { date, ...day } of REGIONS[region].rules) {
      const [m, d] = date(year)
      days.set(`${m}-${d}`, [...(days.get(`${m}-${d}`) ?? []), day])
    }
    // Days off first, then the rest
    const order = { public: 0, regional: 1, observance: 2 }
    for (const list of days.values()) list.sort((a, b) => order[a.kind] - order[b.kind])
    cache.set(key, days)
  }
  return days
}

/** A region's holidays and notable days on a date (none for region 'none') */
export function regionDays(region: Region, year: number, month: number, day: number): RegionDay[] {
  return region === 'none' ? [] : (regionYear(region, year).get(`${month}-${day}`) ?? [])
}
