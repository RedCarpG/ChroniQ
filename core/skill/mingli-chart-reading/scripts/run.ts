// What the chart script of the skill mingli-chart-reading does (chart.ts runs it): a birth (or a day)
// in, the chart chroniq-core casts for it out, in the plain Chinese text ChroniQ hands its own AI 解读
// (src/lib/chartText). It reads nothing but its arguments, writes nothing anywhere and sends nothing
// over the network.
import {
  almanacText,
  baziReading,
  baziText,
  birthNotes,
  buildBazi,
  buildHoroscope,
  buildQizheng,
  buildStarChart,
  buildZiwei,
  CITIES,
  DEFAULT_JIE,
  DEFAULT_PLACE,
  DEFAULT_QIZHENG_SCHOOLS,
  DEFAULT_SCHOOLS,
  DEFAULT_STAR_SETTINGS,
  DEFAULT_ZIWEI_SCHOOLS,
  ELEMENTS,
  findCity,
  JIE_SCHOOL,
  findPatterns,
  fortuneText,
  lunarToSolar,
  progressions,
  solarToLunar,
  QIZHENG_SCHOOLS,
  qizhengText,
  SCHOOLS,
  skyEventText,
  STAR_SCHOOLS,
  starChartText,
  synastry,
  toUtc,
  transits,
  upcomingSkyEvents,
  WORLD_CITIES,
  ZIWEI_SCHOOLS,
  ziweiHoroscopeText,
  ziweiText,
  type BaziChart,
  type BaziInput,
  type BirthNote,
  type ElementName,
  type LayerKind,
  type Place,
  type QizhengSchoolSettings,
  type SchoolSettings,
  type StarSettings,
  type ZiweiSchoolSettings,
} from '../../../index'

declare const __CORE_VERSION__: string
/** chroniq-core's version, set by the build; 'dev' when run from the source */
export const VERSION = typeof __CORE_VERSION__ === 'string' ? __CORE_VERSION__ : 'dev'

/** A mistake in what was asked: shown as it is, with no stack */
export class UsageError extends Error {}

const USAGE = `用法：node chart.mjs <盘> [选项]

盘：
  bazi      八字：四柱、藏干十神、纳音、神煞、大运、旺衰简析，加流年（含十二流月）或某一天的岁运
  ziwei     紫微斗数：十二宫星曜、亮度、四化、宫干飞化、大限、格局，加大限和流年（或某一天）的运限
  star      星盘（西洋占星，回归黄道）：本命；加 --transit 行运、--progress 推运、--partner-* 合盘
  qizheng   七政四余：七政四余各在哪一宿、哪一次、哪一宫，十二宫，四象
  almanac   某一天的黄历（--on）；同时给出生信息，再加这一天对这张八字的岁运
  sky       一段时间的天象（--on 起 --days 天，--place 观测地）
  schools   列出所有流派选项（--school 用的键和值）
  cities    列出 --place 可以直接写的城市

出生：
  --date YYYY-MM-DD     出生日期，默认公历；农历加 --lunar（闰月再加 --leap）
  --time HH:MM          出生地当地的钟表时间，24 小时制；不知道写 unknown（只有八字能排，排三柱）
  --gender 男|女        也可写 male / female
  --place 地点          城市名（见 cities），或 "名称,纬度,经度,IANA时区"，北纬、东经为正，
                        如 "Vancouver,49.28,-123.12,America/Vancouver"
  --clock               八字、紫微按钟表时间排；默认给了出生地就按真太阳时排

运限：
  --year 2026           八字流年、紫微流年（默认今年）；可写 2026-2028 或 2026,2028
  --on YYYY-MM-DD       八字和紫微看这一天（流月、流日）；almanac 和 sky 的日期
  --transit YYYY-MM-DD[THH:MM]   星盘行运，出生地时区的时刻（默认中午）
  --progress YYYY-MM-DD          星盘次限推运
  --partner-date / --partner-time / --partner-place / --partner-lunar / --partner-leap
                        星盘合盘：对方的出生信息
  --days 30             sky 往后看几天

流派：
  --school 键=值        可重复，如 --school bazi.ziHour=nextDay --school star.houses=whole；
                        值也可以写选项的中文名。不写的用默认值，schools 列出全部

其他：--version 显示 chroniq-core 版本，--help 显示这段说明`

// ---- Arguments ----

type Args = { _: string[]; school: string[] } & Record<string, string | string[] | boolean | undefined>

const FLAGS = new Set(['lunar', 'leap', 'clock', 'help', 'version', 'partner-lunar', 'partner-leap'])
const VALUES = new Set(['date', 'time', 'gender', 'place', 'year', 'on', 'transit', 'progress', 'days', 'school', 'partner-date', 'partner-time', 'partner-place', 'partner-gender'])

export function parseArgs(argv: string[]): Args {
  const out: Args = { _: [], school: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) {
      out._.push(arg)
      continue
    }
    const eq = arg.indexOf('=')
    const key = arg.slice(2, eq < 0 ? undefined : eq)
    if (FLAGS.has(key)) {
      out[key] = true
      continue
    }
    if (!VALUES.has(key)) throw new UsageError(`不认识的选项 --${key}`)
    const value = eq < 0 ? argv[++i] : arg.slice(eq + 1)
    if (value === undefined || (eq < 0 && value.startsWith('--'))) throw new UsageError(`--${key} 后面要跟一个值`)
    if (key === 'school') out.school.push(value)
    else out[key] = value
  }
  return out
}

const str = (args: Args, key: string) => (typeof args[key] === 'string' ? (args[key] as string) : undefined)

type Ymd = { year: number; month: number; day: number }

function parseDate(text: string, what: string): Ymd {
  const m = /^(\d{1,4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/.exec(text.trim())
  if (!m) throw new UsageError(`${what}「${text}」看不懂，请写成 YYYY-MM-DD`)
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) throw new UsageError(`${what}「${text}」不是存在的日期`)
  return { year, month, day }
}

function parseTime(text: string, what: string): { hour: number; minute: number } | null {
  if (/^(unknown|不详|未知|\?)$/i.test(text.trim())) return null
  const m = /^(\d{1,2})[:：](\d{2})$/.exec(text.trim())
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new UsageError(`${what}「${text}」看不懂，请写成 24 小时制的 HH:MM，不知道就写 unknown`)
  return { hour: Number(m[1]), minute: Number(m[2]) }
}

function parseGender(text: string | undefined): 0 | 1 {
  if (text === undefined) throw new UsageError('要给性别：--gender 男 或 --gender 女（大运顺逆、紫微和七政四余都要用）')
  const t = text.trim().toLowerCase()
  if (['男', 'm', 'male', 'man', '1', '乾', '乾造'].includes(t)) return 1
  if (['女', 'f', 'female', 'woman', '0', '坤', '坤造'].includes(t)) return 0
  throw new UsageError(`性别「${text}」看不懂，请写 男 或 女`)
}

const validZone = (zone: string) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

export function parsePlace(text: string): Place {
  const parts = text.split(/[,，]/).map((s) => s.trim())
  if (parts.length === 4) {
    const [name, lat, lon, timeZone] = parts
    const latitude = Number(lat)
    const longitude = Number(lon)
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180)
      throw new UsageError(`地点「${text}」的纬度、经度不对：纬度 −90 到 90（北为正），经度 −180 到 180（东为正）`)
    if (!validZone(timeZone)) throw new UsageError(`时区「${timeZone}」不认识，请写 IANA 时区名，如 Asia/Shanghai、America/New_York`)
    return { name: name || '自定义', latitude, longitude, timeZone }
  }
  const city = findCity(text)
  if (!city)
    throw new UsageError(
      `不认识地点「${text}」。可以直接写的城市用 cities 列出；别的地方写成 "名称,纬度,经度,IANA时区"，如 "Vancouver,49.28,-123.12,America/Vancouver"`,
    )
  return city
}

function parseYears(text: string): number[] {
  const range = /^(\d{4})\s*[-–~到至]\s*(\d{4})$/.exec(text.trim())
  if (range) {
    const [from, to] = [Number(range[1]), Number(range[2])]
    if (to < from || to - from > 20) throw new UsageError(`年份范围「${text}」不对（最多 20 年）`)
    return Array.from({ length: to - from + 1 }, (_, i) => from + i)
  }
  const years = text.split(/[,，\s]+/).filter(Boolean).map(Number)
  if (!years.length || years.some((y) => !Number.isInteger(y) || y < 1000 || y > 9999)) throw new UsageError(`年份「${text}」看不懂，请写 2026、2026-2028 或 2026,2028`)
  return years
}

// ---- 流派 ----

type SchoolTable = Record<string, { title: string; summary: string; options: { value: string; label: string; source: string }[] }>
// 交节对照 is not among the 流派 in ChroniQ's settings, as its pages always set a birth against the 节
// by the actual moment. Here it can be switched, to show what a 万年历 in 北京时间 gives
const BAZI_SCHOOLS = { ...SCHOOLS, jie: JIE_SCHOOL }
const DEFAULT_BAZI = { ...DEFAULT_SCHOOLS, jie: DEFAULT_JIE }
const SYSTEMS = {
  bazi: { name: '八字', table: BAZI_SCHOOLS as unknown as SchoolTable, defaults: DEFAULT_BAZI as unknown as Record<string, string> },
  ziwei: { name: '紫微', table: ZIWEI_SCHOOLS as unknown as SchoolTable, defaults: DEFAULT_ZIWEI_SCHOOLS as unknown as Record<string, string> },
  star: { name: '星盘', table: STAR_SCHOOLS as unknown as SchoolTable, defaults: DEFAULT_STAR_SETTINGS as unknown as Record<string, string> },
  qizheng: { name: '七政四余', table: QIZHENG_SCHOOLS as unknown as SchoolTable, defaults: DEFAULT_QIZHENG_SCHOOLS as unknown as Record<string, string> },
}
type System = keyof typeof SYSTEMS

export interface Schools {
  bazi: SchoolSettings & { jie: 'local' | 'instant' }
  ziwei: ZiweiSchoolSettings
  star: StarSettings
  qizheng: QizhengSchoolSettings
}

/** --school entries (bazi.ziHour=nextDay, or ziHour=nextDay where the key is only one system's) over the defaults */
export function parseSchools(entries: string[]): Schools {
  const out = Object.fromEntries(Object.entries(SYSTEMS).map(([k, s]) => [k, { ...s.defaults }])) as Record<System, Record<string, string>>
  for (const entry of entries) {
    const m = /^(?:(\w+)\.)?(\w+)\s*=\s*(.+)$/.exec(entry.trim())
    if (!m) throw new UsageError(`流派「${entry}」看不懂，请写成 系统.键=值，如 bazi.ziHour=nextDay（schools 列出全部）`)
    const [, system, key, value] = m
    if (system && !(system in SYSTEMS)) throw new UsageError(`没有「${system}」这一类流派，可选 ${Object.keys(SYSTEMS).join('、')}`)
    const targets = (system ? [system] : Object.keys(SYSTEMS)).filter((s) => key in SYSTEMS[s as System].table) as System[]
    if (!targets.length) throw new UsageError(`没有流派「${entry.split('=')[0]}」，schools 列出全部`)
    for (const s of targets) {
      const info = SYSTEMS[s].table[key]
      const want = value.trim()
      const prefixed = info.options.filter((o) => o.label.startsWith(want))
      const option =
        info.options.find((o) => o.value === want) ?? info.options.find((o) => o.label === want) ?? (prefixed.length === 1 ? prefixed[0] : undefined)
      if (!option) throw new UsageError(`${SYSTEMS[s].name}「${info.title}」没有「${value}」，可选：${info.options.map((o) => `${o.value}（${o.label}）`).join('、')}`)
      out[s][key] = option.value
    }
  }
  return out as unknown as Schools
}

/** 流派：晚子时日柱取日柱算当天；…, with the ones changed from the default marked */
function schoolLine(system: System, settings: object): string {
  const { table, defaults } = SYSTEMS[system]
  const values = settings as Record<string, string>
  return `流派：${Object.entries(table)
    .map(([key, info]) => `${info.title}取${info.options.find((o) => o.value === values[key])!.label}${values[key] !== defaults[key] ? '（非默认）' : ''}`)
    .join('；')}`
}

function schoolsText(): string {
  const lines = ['流派选项（--school 系统.键=值；默认值标 *）：']
  for (const [system, { name, table, defaults }] of Object.entries(SYSTEMS)) {
    lines.push('', `【${name}】`)
    for (const [key, info] of Object.entries(table)) {
      lines.push(`  ${system}.${key}：${info.title}。${info.summary}`)
      for (const o of info.options) lines.push(`    ${o.value === defaults[key] ? '*' : ' '} ${o.value}：${o.label}。${o.source}`)
    }
  }
  return lines.join('\n')
}

function citiesText(): string {
  return [
    '可以直接写的城市（别的地方写 "名称,纬度,经度,IANA时区"）：',
    `中国：${CITIES.map((c) => c.name).join('、')}`,
    ...WORLD_CITIES.map((r) => `${r.region}：${r.cities.map((c) => c.name).join('、')}`),
  ].join('\n')
}

// ---- A birth ----

interface Birth {
  input: BaziInput
  hourKnown: boolean
  /** Given with --place; without one, 八字 and 紫微 are cast in 北京时间 by the clock */
  placeGiven: boolean
  /** 排盘依据: how the birth was read */
  basis: string
}

const coords = (p: Place) =>
  `${Math.abs(p.latitude).toFixed(2)}°${p.latitude >= 0 ? 'N' : 'S'} ${Math.abs(p.longitude).toFixed(2)}°${p.longitude >= 0 ? 'E' : 'W'}`
const pad = (n: number) => String(n).padStart(2, '0')

function readBirth(args: Args, schools: Schools, prefix = '', needGender = true): Birth {
  const dateText = str(args, `${prefix}date`)
  if (!dateText) throw new UsageError(prefix ? '合盘要给对方的出生日期：--partner-date' : '要给出生日期：--date YYYY-MM-DD（农历加 --lunar）')
  let date = parseDate(dateText, '出生日期')
  const lunar = args[`${prefix}lunar`] === true
  let lunarNote = ''
  if (lunar) {
    const leap = args[`${prefix}leap`] === true
    const solar = lunarToSolar(date.year, date.month, date.day, leap)
    if (!solar) throw new UsageError(`农历 ${date.year} 年${leap ? '闰' : ''}${date.month}月${date.day}日不存在`)
    lunarNote = `（农历 ${date.year} 年${leap ? '闰' : ''}${date.month}月${date.day}日）`
    date = solar
  }
  const timeText = str(args, `${prefix}time`)
  const time = timeText === undefined ? null : parseTime(timeText, '出生时间')
  if (timeText === undefined && !prefix) throw new UsageError('要给出生时间：--time HH:MM；不知道就写 --time unknown（八字排三柱，别的盘排不了）')
  if (!time && prefix) throw new UsageError('合盘要给对方的出生时间：--partner-time HH:MM')
  const placeText = str(args, `${prefix}place`)
  const place = placeText ? parsePlace(placeText) : undefined
  const gender = needGender ? parseGender(str(args, `${prefix}gender`)) : str(args, `${prefix}gender`) ? parseGender(str(args, `${prefix}gender`)) : 1
  const trueSolar = !!place && !!time && args.clock !== true
  const input: BaziInput = { ...date, hour: time?.hour ?? 12, minute: time?.minute ?? 0, gender, place, trueSolar, jie: schools.bazi.jie }
  const when = `公历 ${date.year}-${pad(date.month)}-${pad(date.day)}${lunarNote} ${time ? `${pad(time.hour)}:${pad(time.minute)}` : '时辰不详'}`
  const where = place ? `出生地 ${place.name}（${coords(place)}，${place.timeZone}）` : '没有给出生地（按北京时间，不做真太阳时修正）'
  const how = !time ? '' : trueSolar ? '；八字、紫微按真太阳时排' : place ? '；八字、紫微按钟表时间排（--clock）' : ''
  return { input, hourKnown: !!time, placeGiven: !!place, basis: `排盘依据：${when} · ${needGender ? (gender ? '男' : '女') + ' · ' : ''}${where}${how}` }
}

function notesBlock(notes: BirthNote[]): string[] {
  return notes.length ? ['提示：', ...notes.map((n) => `  - ${n.text}`)] : []
}

/** Checks the time (a clock time daylight saving skipped is an error) and returns its notes */
function checkBirth(b: Birth, schools: SchoolSettings): BirthNote[] {
  try {
    return birthNotes(b.input, schools, b.hourKnown)
  } catch (e) {
    if (e instanceof RangeError) throw new UsageError(e.message)
    throw e
  }
}

// ---- 八字 ----

/** A chart cast at noon, cut to the three pillars a birth with its hour unknown has */
function threePillars(chart: BaziChart): BaziChart {
  const pillars = chart.pillars.slice(0, 3)
  const elementCount = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<ElementName, number>
  for (const p of pillars) {
    elementCount[p.stem.element]++
    elementCount[p.branch.element]++
  }
  return {
    ...chart,
    solarText: chart.solarText.replace(/ \d\d:\d\d$/, '（时辰不详）'),
    lunarText: chart.lunarText.replace(/ \S+时$/, ''),
    pillars,
    elementCount,
    relations: chart.relations.filter((r) => !r.members.includes('时')),
    ownSign: '（缺时辰，不排）',
    bodySign: '（缺时辰，不排）',
    startText: `${chart.startText}（按中午估算）`,
    lateZiHour: false,
    trueSolar: undefined,
  }
}

/** The results that depend on a 流派 setting, so the reading can say so */
function baziMarks(chart: BaziChart): string {
  const marks = [
    ...chart.pillars.flatMap((p) => p.shenSha.filter((s) => s.school).map((s) => `${p.label}${s.name}（${SCHOOLS[s.school!].title}）`)),
    ...chart.relations.filter((r) => r.school).map((r) => `${r.text}（${SCHOOLS[r.school!].title}）`),
  ]
  return `受流派影响的结果：${marks.length ? marks.join('、') : '无'}`
}

function bazi(args: Args, schools: Schools, now: Date): string {
  const b = readBirth(args, schools)
  const notes = checkBirth(b, schools.bazi)
  const cast = buildBazi(b.input, schools.bazi)
  const chart = b.hourKnown ? cast : threePillars(cast)
  const on = str(args, 'on') ? parseDate(str(args, 'on')!, '--on 的日期') : null
  const years = str(args, 'year') ? parseYears(str(args, 'year')!) : on ? [] : [now.getFullYear()]
  const readingYear = on?.year ?? years[0] ?? now.getFullYear()
  return [
    '【八字】',
    b.basis,
    schoolLine('bazi', schools.bazi),
    ...notesBlock(notes),
    '',
    baziText(chart, baziReading(chart, readingYear)),
    baziMarks(chart),
    ...years.flatMap((year) => ['', fortuneText(chart, { year }, schools.bazi)]),
    ...(on ? ['', fortuneText(chart, on, schools.bazi)] : []),
  ].join('\n')
}

// ---- 紫微 ----

const LAYERS_FOR_YEAR: LayerKind[] = ['decadal', 'yearly']
const LAYERS_FOR_DAY: LayerKind[] = ['decadal', 'yearly', 'monthly', 'daily']

function ziwei(args: Args, schools: Schools, now: Date): string {
  const b = readBirth(args, schools)
  if (!b.hourKnown) throw new UsageError('紫微斗数要有出生时辰：命宫由生月和时辰定，没有时辰排不出。请先问出生时间；实在不知道，只能排八字三柱（bazi --time unknown）')
  const notes = checkBirth(b, schools.bazi).filter((n) => ['overlap', 'dst', 'solarDay', 'solarPillars', 'hourEdge'].includes(n.kind))
  const chart = buildZiwei(b.input, schools.ziwei)
  if (notes.some((n) => n.kind === 'hourEdge' || n.kind === 'solarPillars'))
    notes.push({ kind: 'hourEdge', text: '紫微的命宫由时辰定：时辰一换，命宫和整张盘都会不同。' })
  const baziYear = buildBazi(b.input, schools.bazi).pillars[0]
  const ziweiYear = chart.chineseDate.split(' ')[0]
  if (ziweiYear !== `${baziYear.stem.char}${baziYear.branch.char}`)
    notes.push({
      kind: 'jie',
      text:
        `紫微按${schools.ziwei.yearDivide === 'exact' ? '立春' : '正月初一'}换年，生年干支为 ${ziweiYear}；八字按立春换年为 ${baziYear.stem.char}${baziYear.branch.char}。` +
        `出生在两者之间，生年四化等跟着年干走（ziwei.yearDivide 可切换）。`,
    })
  if (chart.time === '晚子时')
    notes.push({
      kind: 'lateZi',
      text: `出生在晚子时：紫微按「${ZIWEI_SCHOOLS.dayDivide.options.find((o) => o.value === schools.ziwei.dayDivide)!.label}」排（ziwei.dayDivide 可切换），另一派的日期不同，盘也会不同。`,
    })

  const on = str(args, 'on') ? parseDate(str(args, 'on')!, '--on 的日期') : null
  const years = str(args, 'year') ? parseYears(str(args, 'year')!) : on ? [] : [now.getFullYear()]
  const horoscope = (target: { year: number; month: number; day: number }, kinds: LayerKind[]) => {
    const all = buildHoroscope(b.input, schools.ziwei, { ...target, hour: 0 })
    return ziweiHoroscopeText(chart, Object.fromEntries(kinds.map((k) => [k, all[k]])), target.year)
  }
  return [
    '【紫微斗数】',
    b.basis,
    schoolLine('ziwei', schools.ziwei),
    ...notesBlock(notes),
    '',
    ziweiText(chart, findPatterns(chart)),
    // A year's 运限 read from the middle of the lunar year, past 正月 and 立春 alike
    ...years.flatMap((year) => ['', horoscope({ year, month: 6, day: 1 }, LAYERS_FOR_YEAR)]),
    ...(on ? ['', `（${on.year}年${on.month}月${on.day}日）`, horoscope(solarToLunar(on.year, on.month, on.day), LAYERS_FOR_DAY)] : []),
  ].join('\n')
}

// ---- 星盘 ----

function moment(text: string, place: Place): Date {
  const [datePart, timePart] = text.split(/[T\s]/)
  const d = parseDate(datePart, '日期')
  const t = timePart ? parseTime(timePart, '时刻') : null
  return toUtc({ ...d, hour: t?.hour ?? 12, minute: t?.minute ?? 0 }, place.timeZone).date
}

function star(args: Args, schools: Schools): string {
  const b = readBirth(args, schools, '', false)
  if (!b.hourKnown) throw new UsageError('星盘要出生时间：上升和宫位约每 4 分钟移动 1°，月亮每天走 12°–15°。请先问出生时间；只想看太阳和行星的星座，可以写 --time 12:00，但要说明上升、宫位和月亮不准')
  if (!b.placeGiven) throw new UsageError('星盘要出生地（--place）：时区、上升和宫位都由它定')
  const notes = checkBirth(b, schools.bazi).filter((n) => n.kind === 'overlap')
  const place = b.input.place!
  const chart = buildStarChart(b.input, place, schools.star)
  const asked = ['transit', 'progress', 'partner-date'].filter((k) => str(args, k))
  if (asked.length > 1) throw new UsageError('一次只排一种：行运（--transit）、推运（--progress）或合盘（--partner-*），要几种就分几次运行')
  let overlay = null
  let partnerBasis = ''
  if (str(args, 'transit')) overlay = transits(chart, moment(str(args, 'transit')!, place), schools.star)
  if (str(args, 'progress')) overlay = progressions(chart, moment(str(args, 'progress')!, place), schools.star)
  if (str(args, 'partner-date')) {
    const p = readBirth(args, schools, 'partner-', false)
    if (!p.placeGiven) throw new UsageError('合盘要给对方的出生地：--partner-place')
    checkBirth(p, schools.bazi)
    overlay = synastry(chart, buildStarChart(p.input, p.input.place!, schools.star))
    partnerBasis = p.basis.replace('排盘依据：', '对方：')
  }
  return [
    '【星盘】',
    b.basis.replace(/；八字、紫微.*$/, ''),
    ...(partnerBasis ? [partnerBasis.replace(/；八字、紫微.*$/, '')] : []),
    schoolLine('star', schools.star),
    ...notesBlock(notes),
    '',
    starChartText(chart, schools.star, overlay),
  ].join('\n')
}

// ---- 七政四余 ----

function qizheng(args: Args, schools: Schools): string {
  const b = readBirth(args, schools)
  if (!b.hourKnown) throw new UsageError('七政四余要出生时间：命宫取出生那一刻的上升点，约两小时换一宫。请先问出生时间')
  if (!b.placeGiven) throw new UsageError('七政四余要出生地（--place）：命宫由出生地的上升点定')
  const notes = checkBirth(b, schools.bazi).filter((n) => n.kind === 'overlap')
  const chart = buildQizheng(b.input, schools.qizheng)
  return [
    '【七政四余】',
    b.basis.replace(/；八字、紫微.*$/, '；按当地钟表时间排（七政四余用真实星空，不用真太阳时）'),
    ...notesBlock(notes),
    '',
    qizhengText(chart, schools.qizheng),
  ].join('\n')
}

// ---- 黄历、天象 ----

function today(now: Date): Ymd {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
}

function almanac(args: Args, schools: Schools, now: Date): string {
  const day = str(args, 'on') ? parseDate(str(args, 'on')!, '--on 的日期') : today(now)
  const lines = ['【黄历】', almanacText(day.year, day.month, day.day)]
  if (str(args, 'date')) {
    const b = readBirth(args, schools)
    const notes = checkBirth(b, schools.bazi)
    const cast = buildBazi(b.input, schools.bazi)
    const chart = b.hourKnown ? cast : threePillars(cast)
    lines.push('', '【这一天与这张八字】', b.basis, schoolLine('bazi', schools.bazi), ...notesBlock(notes), '', baziText(chart), '', fortuneText(chart, day, schools.bazi))
  }
  return lines.join('\n')
}

function sky(args: Args, now: Date): string {
  const place = str(args, 'place') ? parsePlace(str(args, 'place')!) : DEFAULT_PLACE
  const day = str(args, 'on') ? parseDate(str(args, 'on')!, '--on 的日期') : today(now)
  const days = Number(str(args, 'days') ?? 30)
  if (!Number.isInteger(days) || days < 1 || days > 400) throw new UsageError('--days 要是 1 到 400 的整数')
  const from = toUtc({ ...day, hour: 0, minute: 0 }, place.timeZone).date
  const events = upcomingSkyEvents(from, days, place)
  return [
    `【天象】${place.name}（${coords(place)}，${place.timeZone}）· ${day.year}-${pad(day.month)}-${pad(day.day)} 起 ${days} 天${str(args, 'place') ? '' : '（没有给观测地，按北京）'}`,
    ...(events.length ? events.map((e) => skyEventText(e, place.timeZone)) : ['这段时间没有列入的天象（日月食、流星雨、冲日、大距、行星相合、超级月亮）。']),
  ].join('\n')
}

// ---- Main ----

const KINDS = ['bazi', 'ziwei', 'star', 'qizheng', 'almanac', 'sky', 'schools', 'cities']

/** What the script prints for these arguments; a UsageError for a mistake in them */
export function run(argv: string[], now = new Date()): string {
  const args = parseArgs(argv)
  if (args.version) return `chroniq-core ${VERSION}`
  if (args.help || !args._.length) return USAGE
  const kind = args._[0]
  if (!KINDS.includes(kind)) throw new UsageError(`不认识的盘「${kind}」，可选：${KINDS.join('、')}`)
  if (args._.length > 1) throw new UsageError(`多出来的参数：${args._.slice(1).join(' ')}（选项都要用 --名字）`)
  const schools = parseSchools(args.school)
  switch (kind) {
    case 'bazi':
      return bazi(args, schools, now)
    case 'ziwei':
      return ziwei(args, schools, now)
    case 'star':
      return star(args, schools)
    case 'qizheng':
      return qizheng(args, schools)
    case 'almanac':
      return almanac(args, schools, now)
    case 'sky':
      return sky(args, now)
    case 'schools':
      return schoolsText()
    default:
      return citiesText()
  }
}
