// A birth as people say it, made into what the charts take: a 农历 date to the 公历 one, and a city's
// name to its place (latitude, longitude and the time zone its clocks keep), from the cities the
// birth form offers; and what to know about where its time falls (daylight saving, a 节, the edge of
// a 时辰). For programs that take a birth in words (chroniq-core).
import { LunarDay, SolarDay, SolarTerm } from 'tyme4ts'
import { buildBazi, effectiveTime, formatTime, type BaziChart, type BaziInput } from './bazi'
import { cityPlace, DEFAULT_PLACE, type Place } from './place'
import { DEFAULT_JIE, DEFAULT_SCHOOLS, SCHOOLS, type SchoolSettings } from './schools'
import { CITIES } from './solarTime'
import { toUtc, zoneOffset } from './timeZone'
import { WORLD_CITIES } from './worldCities'

/** A 农历 date (leap: in the 闰月) as the 公历 date it falls on; null if there is no such day */
export function lunarToSolar(
  year: number,
  month: number,
  day: number,
  leap = false,
): { year: number; month: number; day: number } | null {
  try {
    const solar = LunarDay.fromYmd(year, leap ? -month : month, day).getSolarDay()
    return { year: solar.getYear(), month: solar.getMonth(), day: solar.getDay() }
  } catch {
    return null
  }
}

/** A 公历 date as the 农历 one: its year, month (a 闰月 by its number, with leap set) and day */
export function solarToLunar(year: number, month: number, day: number): { year: number; month: number; day: number; leap: boolean } {
  const d = SolarDay.fromYmd(year, month, day).getLunarDay()
  const m = d.getLunarMonth()
  return { year: m.getLunarYear().getYear(), month: m.getMonth(), day: d.getDay(), leap: m.isLeap() }
}

const bare = (name: string) => name.trim().replace(/[市省县区]$/, '')

/** The place of a city the birth form knows (China's, and major cities abroad), by its Chinese
 *  name with or without 市; null if it is not one of them */
export function findCity(name: string): Place | null {
  const want = bare(name)
  if (!want) return null
  const all = [...CITIES, ...WORLD_CITIES.flatMap((r) => r.cities)]
  const city = all.find((c) => c.name === want) ?? all.find((c) => bare(c.name) === want)
  return city ? cityPlace(city) : null
}

// ---- Where a birth time sits on a boundary ----

const HOUR = 3600_000
/** tyme4ts reckons the 节气 in 北京时间 */
const BEIJING = 8 * HOUR

type Wall = { year: number; month: number; day: number; hour: number; minute: number }
const wallMs = (t: Wall) => Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute)
const msWall = (ms: number): Wall => {
  const d = new Date(ms)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes() }
}
const hm = (t: Wall) => `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`
const utcOffset = (minutes: number) =>
  `UTC${minutes < 0 ? '−' : '+'}${Math.floor(Math.abs(minutes) / 60)}${Math.abs(minutes) % 60 ? `:${String(Math.abs(minutes) % 60).padStart(2, '0')}` : ''}`
const span = (ms: number) => {
  const m = Math.round(Math.abs(ms) / 60_000)
  return m >= 60 ? `${Math.floor(m / 60)} 小时 ${m % 60} 分钟` : `${m} 分钟`
}

/** The 节 (the twelve 节气 that begin the 干支 months; 立春 also the year) nearest a UTC instant */
function nearestJie(utc: number): { name: string; utc: number } {
  const year = new Date(utc + BEIJING).getUTCFullYear()
  let best = { name: '', utc: Infinity }
  for (const y of [year - 1, year, year + 1])
    for (let i = 1; i < 24; i += 2) {
      const term = SolarTerm.fromIndex(y, i)
      const t = term.getJulianDay().getSolarTime()
      const ms = Date.UTC(t.getYear(), t.getMonth() - 1, t.getDay(), t.getHour(), t.getMinute(), t.getSecond()) - BEIJING
      if (Math.abs(ms - utc) < Math.abs(best.utc - utc)) best = { name: term.getName(), utc: ms }
    }
  return best
}

/** 八字 cast at a wall time taken as it is (no 真太阳时) */
const castAt = (input: BaziInput, t: Wall, schools: SchoolSettings) => buildBazi({ ...input, ...t, trueSolar: false, jie: 'local' }, schools)
const pillarNames = (c: BaziChart, labels: string[]) =>
  c.pillars.filter((p) => labels.includes(p.label)).map((p) => `${p.label}${p.stem.char}${p.branch.char}`).join('、')

/** One thing about a birth time, and what kind: the hour unknown, a time daylight saving made twice, daylight saving in
 *  force, a 真太阳时 on another day, a pillar 真太阳时 changes, a 节 near, the edge of a 时辰, the 晚子时 */
export interface BirthNote {
  kind: 'noHour' | 'overlap' | 'dst' | 'solarDay' | 'solarPillars' | 'jie' | 'hourEdge' | 'lateZi'
  text: string
}

/**
 * What a reader of a 八字 should know about where its birth time sits: a clock time daylight saving
 * skipped (thrown, as there is no such birth) or that came twice, daylight saving in force, a
 * 真太阳时 that crosses midnight or changes a pillar (given a birthplace), a birth near a 节 (whose exact moment decides the month pillar, and
 * at 立春 the year's) or near the edge of a 时辰, and the 晚子时. With the hour unknown, what a
 * three-pillar chart can and cannot say. Each note in a sentence, for the reader to pass on.
 */
export function birthNotes(input: BaziInput, schools: SchoolSettings = DEFAULT_SCHOOLS, hourKnown = true): BirthNote[] {
  const place = input.place ?? DEFAULT_PLACE
  const notes: BirthNote[] = []
  const note = (kind: BirthNote['kind'], text: string) => notes.push({ kind, text })
  const wall: Wall = { year: input.year, month: input.month, day: input.day, hour: input.hour, minute: input.minute }

  if (!hourKnown) {
    note('noHour', '时辰不详：只排年、月、日三柱。时柱、命宫、身宫排不出；五行个数、旺衰和干支关系只按三柱算；起运时间按中午估算，实际可差约两个月。')
    const early = castAt(input, { ...wall, hour: 0, minute: 0 }, schools)
    const late = castAt(input, { ...wall, hour: 23, minute: 59 }, schools)
    const changed = ['年柱', '月柱'].filter((l) => pillarNames(early, [l]) !== pillarNames(late, [l]))
    if (changed.length) {
      const jie = nearestJie(Date.UTC(wall.year, wall.month - 1, wall.day, 12) - BEIJING)
      note(
        'jie',
        `这一天${hm(msWall(jie.utc + BEIJING))}（北京时间）交${jie.name}：出生在交节之前为 ${pillarNames(early, changed)}，` +
          `之后为 ${pillarNames(late, changed)}。没有出生时间定不下来，请先问出生时间。`,
      )
    }
    if (schools.ziHour === 'nextDay') note('lateZi', `按「${SCHOOLS.ziHour.options[1].label}」，若生于 23 点以后，日柱要换成次日的。`)
    return notes
  }

  const zoned = toUtc(wall, place.timeZone)
  if (zoned.resolution === 'gap')
    throw new RangeError(`${place.name}当地没有 ${formatTime(wall)} 这个时刻：那天夏令时开始，钟表拨快了一小时，跳过了这段时间。请核对出生时间。`)
  if (zoned.resolution === 'overlap')
    note(
      'overlap',
      `${formatTime(wall)} 在${place.name}出现过两次（那天夏令时结束，钟表回拨一小时），按较早的一次（夏令时，${utcOffset(zoned.offsetMinutes)}）排；` +
        '如果出生在回拨之后，实际时刻要晚一小时，请向本人确认。',
    )
  const standard = Math.min(
    zoneOffset(Date.UTC(wall.year, 0, 1), place.timeZone),
    zoneOffset(Date.UTC(wall.year, 6, 1), place.timeZone),
  )
  // 交节对照: by the actual moment, the year and month pillars and the 起运 take no part of the clock
  const byMoment = (input.jie ?? DEFAULT_JIE) === 'instant'
  if (zoned.offsetMinutes > standard)
    note(
      'dst',
      input.trueSolar
        ? `出生时${place.name}实行夏令时（${utcOffset(zoned.offsetMinutes)}）：真太阳时从世界时算起，已扣除夏令时。`
        : byMoment
          ? `出生时${place.name}实行夏令时（${utcOffset(zoned.offsetMinutes)}）：本盘的日柱、时柱按钟表时间排，没有扣除夏令时的一小时；` +
            '年柱、月柱和起运按出生的实际时刻定，不受影响。按真太阳时排会全部扣除。各家做法不同。'
          : `出生时${place.name}实行夏令时（${utcOffset(zoned.offsetMinutes)}）：本盘按钟表时间排，没有扣除夏令时的一小时；按真太阳时排会自动扣除。各家做法不同。`,
    )

  const { corrected, time } = effectiveTime(input)
  if (corrected && (time.day !== wall.day || time.month !== wall.month))
    note('solarDay', `真太阳时（${formatTime(time)}）和钟表时间不在同一天，日柱按真太阳时的日期排。`)
  const which = corrected ? '真太阳时' : '钟表时间'

  // 真太阳时 or the clock: with a birthplace known, whether the choice changes a pillar
  if (input.place) {
    const solar = buildBazi({ ...input, trueSolar: true }, schools)
    const clock = buildBazi({ ...input, trueSolar: false }, schools)
    const labels = ['年柱', '月柱', '日柱', '时柱'].filter((l) => pillarNames(solar, [l]) !== pillarNames(clock, [l]))
    if (labels.length)
      note(
        'solarPillars',
        `按真太阳时（${hm(solar.trueSolar!.time)}）为 ${pillarNames(solar, labels)}；按钟表时间（${hm(wall)}）则为 ${pillarNames(clock, labels)}。` +
          `本盘按${which}排。用不用真太阳时，各家做法不同，解读时要说明。`,
      )
  }

  // 节: the month pillar (and at 立春 the year's) turns at the 节's exact moment
  const birthUtc = zoned.date.getTime()
  const castUtc = wallMs(time) - BEIJING
  const jie = nearestJie(birthUtc)
  const jieBeijing = `北京时间 ${formatTime(msWall(jie.utc + BEIJING))}`
  const turning = jie.name === '立春' ? ['年柱', '月柱'] : ['月柱']
  if (birthUtc >= jie.utc !== castUtc >= jie.utc) {
    // The two 交节对照 (schools JIE_SCHOOL) put this birth on either side of the 节
    const actual = castAt(input, msWall(birthUtc + BEIJING), schools)
    const local = buildBazi({ ...input, jie: 'local' }, schools)
    const side = (utc: number) => (utc >= jie.utc ? '后' : '前')
    note(
      'jie',
      byMoment
        ? `出生的实际时刻在${jie.name}交节（${jieBeijing}）之${side(birthUtc)}，本盘按实际时刻对照，为 ${pillarNames(actual, turning)}；` +
            `若把${which} ${formatTime(time)} 直接和北京时间的交节时刻比（等于直接查北京时间的万年历），算在交节之${side(castUtc)}，则为 ${pillarNames(local, turning)}，` +
            '大运的顺逆和起运也会不同。解读前请向用户说明。'
        : `按出生的实际时刻，是在${jie.name}交节（${jieBeijing}）之${side(birthUtc)}，应为 ${pillarNames(actual, turning)}；` +
            `本盘把${which} ${formatTime(time)} 直接和北京时间的交节时刻比，算在交节之${side(castUtc)}，排成了 ${pillarNames(local, turning)}。` +
            '节气是天文时刻，以实际时刻为准时取前者；解读前请向用户说明。',
    )
  } else if (Math.abs(birthUtc - jie.utc) < 6 * HOUR) {
    const before = castAt(input, msWall(jie.utc + BEIJING - 60_000), schools)
    const after = castAt(input, msWall(jie.utc + BEIJING + 60_000), schools)
    note(
      'jie',
      `出生在${jie.name}交节（${jieBeijing}）之${birthUtc >= jie.utc ? '后' : '前'} ${span(birthUtc - jie.utc)}：` +
        `${turning.join('和')}以交节时刻划分，交节前为 ${pillarNames(before, turning)}，交节后为 ${pillarNames(after, turning)}。出生时间如果记得不准，要核对。`,
    )
  }

  // 时辰: the 时柱 turns on the odd hours, and at midnight the 日柱
  const minutes = time.hour * 60 + time.minute
  const edge = [0, ...Array.from({ length: 12 }, (_, i) => 60 + 120 * i), 1440].find((b) => Math.abs(minutes - b) <= 10)
  if (edge !== undefined && minutes !== edge) {
    const day0 = Date.UTC(time.year, time.month - 1, time.day)
    const before = castAt(input, msWall(day0 + (edge - 1) * 60_000), schools)
    const after = castAt(input, msWall(day0 + edge * 60_000), schools)
    const labels = ['日柱', '时柱'].filter((l) => pillarNames(before, [l]) !== pillarNames(after, [l]))
    if (labels.length)
      note(
        'hourEdge',
        `${which} ${hm(time)} 离 ${hm(msWall(day0 + edge * 60_000))} 只差 ${span((minutes - edge) * 60_000)}，正在时辰交界：` +
          `之前为 ${pillarNames(before, labels)}，之后为 ${pillarNames(after, labels)}。出生时间差几分钟就会换柱，要核对。`,
      )
  }

  if (time.hour === 23) {
    const other = schools.ziHour === 'sameDay' ? 'nextDay' : 'sameDay'
    const label = (v: SchoolSettings['ziHour']) => SCHOOLS.ziHour.options.find((o) => o.value === v)!.label
    const mine = buildBazi(input, schools)
    const theirs = buildBazi(input, { ...schools, ziHour: other })
    if (pillarNames(mine, ['日柱']) !== pillarNames(theirs, ['日柱']))
      note(
        'lateZi',
        `${which} ${hm(time)} 在晚子时（23 点以后）：本盘按「${label(schools.ziHour)}」，${pillarNames(mine, ['日柱', '时柱'])}；` +
          `按「${label(other)}」则为 ${pillarNames(theirs, ['日柱', '时柱'])}。这是流派分歧，解读时要说明。`,
      )
  }
  return notes
}
