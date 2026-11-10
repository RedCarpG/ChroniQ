// What ChroniQ works out, as plain Chinese text to hand to an AI (or read aloud): a day's 黄历, a
// 八字, 紫微, 星盘 or 七政四余 chart in full, and the sky's coming events. The app draws all of this; these say it
// in words, complete enough that a model can read the chart without casting it itself.
import { SixtyCycleYear, SolarDay } from 'tyme4ts'
import {
  formatCoords,
  formatLon,
  formatOffset,
  type Aspect,
  type ChartPoint,
  type Overlay,
  type OverlayKind,
  type StarChart,
} from './astrology'
import type { StarSettings } from './starPrefs'
import { buildDayDetail } from './calendar'
import { flowMonths, fortunePillars, fortuneRelations, type BaziChart, type FortuneColumn, type Glyph, type Pillar } from './bazi'
import type { BaziReading } from './baziReading'
import { moonOf } from './moon'
import { isPair, SIX_CLASH, type Relation } from './relations'
import { DEFAULT_SCHOOLS, type SchoolSettings } from './schools'
import { computeSkyEvents, type SkyEvent, type SkyPlaceLike } from './skyEvents'
import type { LayerKind, ZiweiChart, ZiweiLayer, ZiweiStar } from './ziwei'
import { ZONES, type MansionZone } from './mansions'
import { CI, FOUR, PALACES, QIZHENG_INFO, SEVEN, type QizhengBody, type QizhengChart } from './qizheng'
import { QIZHENG_SCHOOLS, type QizhengSchoolSettings } from './qizhengSchools'
import type { ZiweiPattern } from './ziweiPatterns'

const list = (items: string[], none = '无') => (items.length ? items.join('、') : none)

// ---- 黄历 ----

/** A day's 黄历 and Moon, as the calendar's day panel shows them */
export function almanac(year: number, month: number, day: number) {
  const solar = SolarDay.fromYmd(year, month, day)
  return { ...buildDayDetail(solar), moon: moonOf(solar) }
}

/** A day's 黄历 in a few lines */
export function almanacText(year: number, month: number, day: number): string {
  const d = almanac(year, month, day)
  const lines = [
    `${d.solarText} ${d.weekText} · 农历${d.lunarText} · ${d.ganzhi}（属${d.zodiac}）`,
    `节气：${d.term}`,
    ...(d.festivals.length ? [`节日：${list(d.festivals)}`] : []),
    `月相：${d.moon.name}（照亮 ${Math.round(d.moon.lit * 100)}%）${d.moon.time ? `，${d.moon.time}（北京时间）` : ''}`,
    `建除：${d.duty}日 · 值神：${d.twelveStar} · 星宿：${d.twentyEightStar}宿`,
    `宜：${list(d.recommends)}`,
    `忌：${list(d.avoids)}`,
    `吉神：${list(d.goodGods)}`,
    `凶煞：${list(d.badGods)}`,
  ]
  return lines.join('\n')
}

// ---- 八字 ----

const glyphText = (g: Glyph) => `${g.char}${g.element}${g.tenStar ? `（${g.tenStar}）` : ''}`

/** A pillar's 天干, 地支, 藏干 and all reckoned on it, as one line reads it */
const pillarText = (p: Pillar) =>
  `天干 ${glyphText(p.stem)}，地支 ${glyphText(p.branch)}，藏干 ${list(p.hidden.map(glyphText))}；` +
  `纳音 ${p.sound}，星运 ${p.terrain}，自坐 ${p.selfTerrain}，空亡 ${p.empty || '无'}；神煞 ${list(p.shenSha.map((s) => s.name))}`

const relationText = (r: Relation) => `${r.text}（${r.members.join('、')}）`

const TENDENCY: Record<BaziReading['tendency'], string> = { strong: '日主偏旺', weak: '日主偏弱', balanced: '比较平衡' }

/** A 八字 chart in full: the four pillars with all that is reckoned on them, the 大运, and (given a
 *  reading, lib/baziReading) how strong the 日主 is and which 十神 weigh most */
export function baziText(chart: BaziChart, reading?: BaziReading): string {
  const lines = [
    `${chart.gender}命 · 阳历 ${chart.solarText} · 农历 ${chart.lunarText} · 属${chart.zodiac}`,
    ...(chart.trueSolar ? [`按真太阳时：${chart.trueSolar.text}`] : []),
    `日主：${glyphText(chart.dayMaster)}`,
    '四柱：',
    ...chart.pillars.map((p) => `  ${p.label} ${p.stem.char}${p.branch.char}：${pillarText(p)}`),
    `胎元 ${chart.fetalOrigin} · 胎息 ${chart.fetalBreath} · 命宫 ${chart.ownSign} · 身宫 ${chart.bodySign}`,
    `五行个数：${Object.entries(chart.elementCount)
      .map(([e, n]) => `${e}${n}`)
      .join(' ')}`,
    `干支关系：${list(chart.relations.map(relationText))}`,
    `起运：${chart.startText}`,
    `大运：${chart.decades.map((d) => `${d.ganzhi}（${d.startAge}–${d.endAge}岁，${d.startYear}–${d.endYear}）`).join('，')}`,
  ]
  if (reading) {
    lines.push(
      `旺衰：${TENDENCY[reading.tendency]}（生扶 ${reading.support.toFixed(1)} 对 克泄耗 ${reading.drain.toFixed(1)}；` +
        `${reading.inSeason ? '得令' : '不得令'}，月令${reading.monthElement}；` +
        `通根 ${list(reading.roots.map((r) => `${r.pillar}支${r.stem}${r.qi}`))}）`,
      `五行最多：${reading.most.map((m) => `${m.element}${m.count}`).join('、')}；缺：${list(reading.missing)}`,
      `十神偏重：${list(reading.groups.map((g) => `${g.group}${g.count}`))}`,
      ...(reading.decade
        ? [
            `当前大运：${reading.decade.ganzhi}${reading.decade.tenStar ? `（${reading.decade.tenStar}）` : ''}，${reading.decade.from}–${reading.decade.to}`,
          ]
        : []),
    )
  }
  return lines.join('\n')
}

/** A moment to read 岁运 for: a year (the 干支 year from its 立春), or a day in it */
export interface FortuneWhen {
  year: number
  month?: number
  day?: number
}

/** When the 大运 of a chart begins: its year, on the month and day of the first 交运 */
const decadeStart = (chart: BaziChart, i: number) =>
  Date.UTC(chart.decades[i].startYear, chart.start.month - 1, chart.start.day)

/**
 * 岁运 against a 八字: the 大运 running then, the 流年 (and, given a day, its 流月 and 流日), each with
 * its 十神, 藏干, 纳音 and 神煞 as the four pillars have them, the 太岁, and how they 刑冲合会 the four
 * pillars and each other. For a year alone, the twelve 流月 follow, each with what it does to the
 * four pillars. What a reading of a year, or of 「今年适合换工作吗」, rests on.
 */
export function fortuneText(chart: BaziChart, when: FortuneWhen, schools: SchoolSettings = DEFAULT_SCHOOLS): string {
  const birthYear = parseInt(chart.solarText, 10)
  const day = when.month && when.day ? SolarDay.fromYmd(when.year, when.month, when.day).getSixtyCycleDay() : null
  const yearGz = day ? day.getYear().getName() : SixtyCycleYear.fromYear(when.year).getSixtyCycle().getName()
  // The 干支 year a day falls in starts at 立春, so early in January it is still last year's
  const year = day ? day.getSixtyCycleMonth().getSixtyCycleYear().getYear() : when.year
  const at = day ? Date.UTC(when.year, when.month! - 1, when.day!) : null
  const index = chart.decades.findLastIndex((_, i) => (at === null ? chart.decades[i].startYear <= year : decadeStart(chart, i) <= at))
  const decade = index >= 0 ? chart.decades[index] : undefined
  const handover = `${chart.decades[0].startYear}年${chart.start.month}月${chart.start.day}日`

  const columns: FortuneColumn[] = [
    ...(decade ? [{ label: '大运', ganzhi: decade.ganzhi }] : []),
    { label: '流年', ganzhi: yearGz },
    ...(day ? [{ label: '流月', ganzhi: day.getMonth().getName() }, { label: '流日', ganzhi: day.getSixtyCycle().getName() }] : []),
  ]
  const pillars = fortunePillars(chart, columns, schools)
  const of = (label: string) => pillars[columns.findIndex((c) => c.label === label)]

  const title = day ? `${when.year}年${when.month}月${when.day}日` : `${when.year}年`
  const lines = [`岁运（${title}）：`]
  if (decade) {
    const changes = at === null && index > 0 && decade.startYear === year
    lines.push(
      `  大运 ${decade.ganzhi}（${decade.startYear}–${decade.endYear}，${decade.startAge}–${decade.endAge}岁）：${pillarText(of('大运'))}` +
        (changes ? `。这一年${chart.start.month}月${chart.start.day}日交运，之前仍走${chart.decades[index - 1].ganzhi}大运` : ''),
    )
  } else lines.push(`  尚未起运（${handover}交运），还在童限`)
  if (at === null && index === 0 && decade!.startYear === year) lines.push(`  这一年${chart.start.month}月${chart.start.day}日起运，之前在童限`)
  lines.push(`  流年 ${yearGz}（${year}年立春起，虚岁 ${year - birthYear + 1}）：${pillarText(of('流年'))}`)
  if (day) {
    const first = day.getSixtyCycleMonth().getFirstDay().getSolarDay()
    lines.push(
      `  流月 ${day.getMonth().getName()}（${first.getMonth()}月${first.getDay()}日${first.getTerm().getName()}起）：${pillarText(of('流月'))}`,
      `  流日 ${day.getSixtyCycle().getName()}：${pillarText(of('流日'))}`,
    )
  }
  const natal = chart.pillars[0].branch.char
  const taiSui = yearGz[1] === natal ? '本命年（流年地支与年支相同）' : SIX_CLASH.some((p) => isPair(p, natal, yearGz[1])) ? '冲太岁（流年地支冲年支）' : ''
  if (taiSui) lines.push(`  太岁：${taiSui}`)
  lines.push(`岁运与原局、岁运之间的刑冲合会：${list(fortuneRelations(chart, columns, schools).map(relationText))}`)

  if (!day) {
    const months = flowMonths(year, chart.dayMaster.char)
    const monthPillars = fortunePillars(chart, months.map((m) => ({ label: '流月', ganzhi: m.ganzhi })), schools)
    lines.push(
      '流月（以节为界）：',
      ...months.map((m, i) => {
        const [mm, dd] = m.start.split('/')
        // 子月 and 丑月 reach into the next year
        const next = i >= 10 && Number(mm) <= 2 ? `${year + 1}年` : ''
        const p = monthPillars[i]
        const rel = fortuneRelations(chart, [{ label: '流月', ganzhi: m.ganzhi }], schools)
        return (
          `  ${m.ganzhi[1]}月 ${m.ganzhi}（${next}${mm}月${dd}日起）：天干 ${glyphText(p.stem)}，地支 ${glyphText(p.branch)}` +
          `（本气 ${p.hidden[0] ? glyphText(p.hidden[0]) : '无'}）；与原局 ${list(rel.map(relationText))}`
        )
      }),
    )
  }
  return lines.join('\n')
}

// ---- 紫微 ----

const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'

const starText = (s: ZiweiStar) => {
  const marks = [s.brightness, s.mutagen && `化${s.mutagen}`].filter(Boolean)
  return marks.length ? `${s.name}（${marks.join('，')}）` : s.name
}

/** A 紫微 chart in full: its heading, then the twelve palaces from 命宫 round, each with its stars,
 *  their brightness and 四化, the palace's 宫干四化 and 大限; and (given them) the 格局 it makes */
export function ziweiText(chart: ZiweiChart, patterns: ZiweiPattern[] = []): string {
  const soul = Object.values(chart.palaces).find((p) => p.isSoul)!
  const start = BRANCHES.indexOf(soul.branch)
  // 命宫, 兄弟, 夫妻 … run back through the 地支
  const order = Array.from({ length: 12 }, (_, i) => chart.palaces[BRANCHES[(start - i + 12) % 12]])
  const lines = [
    `${chart.gender}命 · 阳历 ${chart.solarText} · 农历 ${chart.lunarText} · ${chart.time}（${chart.timeRange}）`,
    ...(chart.trueSolar ? [`按真太阳时：${chart.trueSolar.text}`] : []),
    `四柱 ${chart.chineseDate} · 属${chart.zodiac} · ${chart.sign} · ${chart.fiveElementsClass} · 命主 ${chart.soul} · 身主 ${chart.body}`,
    '十二宫：',
    ...order.map(
      (p) =>
        `  ${p.name}（${p.stem}${p.branch}）${p.isBody ? '［身宫］' : ''}：` +
        `主星 ${list(p.major.map(starText), '无（空宫）')}；辅星 ${list(p.minor.map(starText))}；` +
        `杂曜 ${list(p.adjective.map((s) => s.name))}；长生 ${p.changsheng}；大限 ${p.decadal[0]}–${p.decadal[1]}岁；` +
        `宫干四化 ${p.flies.map((f) => `${f.star}化${f.mutagen}入${chart.palaces[f.to]?.name ?? f.to}`).join('，')}`,
    ),
  ]
  if (patterns.length) {
    const kind = { good: '吉格', bad: '凶格', neutral: '格局' } as const
    lines.push(
      '格局：',
      ...patterns.map(
        (p) =>
          `  ${p.name}（${kind[p.kind]}）：${p.rule}。${p.meaning}` +
          (p.plus.length ? ` 加分：${list(p.plus)}。` : '') +
          (p.minus.length ? ` 破格：${list(p.minus)}。` : ''),
      ),
    )
  }
  return lines.join('\n')
}

const LAYER_NAME: Record<LayerKind, string> = { decadal: '大限', yearly: '流年', monthly: '流月', daily: '流日', hourly: '流时' }
const LAYER_ORDER = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母']

/**
 * 紫微 运限 in words (lib/ziwei buildHoroscope): for each layer asked for (大限, 流年 …), where its
 * 命宫 falls on the natal board, which natal palace each of its twelve palaces is, its 四化 and the
 * natal palace each transformed star sits in, and its 流耀. `year` is the lunar year the 运限 are for.
 */
export function ziweiHoroscopeText(
  chart: ZiweiChart,
  layers: Partial<Record<LayerKind, ZiweiLayer>>,
  year: number,
): string {
  const natal = (branch: string) => `${chart.palaces[branch].name}${chart.palaces[branch].name === '命宫' ? '' : '宫'}`
  const where = (star: string) => {
    const p = Object.values(chart.palaces).find((q) => [...q.major, ...q.minor, ...q.adjective].some((s) => s.name === star))
    return p ? `本命${natal(p.branch)}` : '盘上未列出'
  }
  const decade = chart.decades.find((d) => d.years.includes(year))
  const lines = [`运限（农历 ${year} 年，虚岁 ${year - chart.birthYear + 1}）：`]
  for (const kind of ['decadal', 'yearly', 'monthly', 'daily', 'hourly'] as LayerKind[]) {
    const layer = layers[kind]
    if (!layer) continue
    const name = LAYER_NAME[kind]
    const byName = Object.fromEntries(Object.entries(layer.palaceNames).map(([b, n]) => [n, b]))
    const mutagens = ['禄', '权', '科', '忌'].flatMap((m) => {
      const star = Object.keys(layer.mutagens).find((s) => layer.mutagens[s] === m)
      return star ? [`${star}化${m}（${where(star)}）`] : []
    })
    const stars = Object.entries(layer.stars).flatMap(([b, s]) => (s.length ? [`${s.map((x) => x.name).join('、')}在本命${natal(b)}`] : []))
    const range = kind === 'decadal' && decade ? `，${decade.range[0]}–${decade.range[1]}岁` : ''
    // The layer's 命宫 is where its palace names put it: for 大限 and 流年 on the 运限's own 地支, for
    // 流月 and 流日 counted on from the 流年 (斗君), not on the month's or the day's
    const ming = byName['命宫'] ?? layer.branch
    lines.push(
      `  ${name} ${layer.stem}${layer.branch}${range}：${name}命宫在本命${natal(ming)}（${ming}）；` +
        `${name}四化 ${list(mutagens)}；${kind === 'decadal' ? '运曜' : '流耀'} ${stars.join('，') || '无'}`,
      `    ${name}十二宫：${LAYER_ORDER.filter((n) => byName[n]).map((n) => `${n}=本命${natal(byName[n])}`).join('，')}`,
    )
  }
  return lines.join('\n')
}

// ---- 天象 ----

const PLANET: Record<string, string> = { Mercury: '水星', Venus: '金星', Mars: '火星', Jupiter: '木星', Saturn: '土星' }
const SHOWER: Record<string, string> = {
  QUA: '象限仪座流星雨',
  LYR: '天琴座流星雨',
  ETA: '宝瓶座η流星雨',
  PER: '英仙座流星雨',
  ORI: '猎户座流星雨',
  LEO: '狮子座流星雨',
  GEM: '双子座流星雨',
}
const SOLAR: Record<string, string> = { partial: '日偏食', annular: '日环食', total: '日全食' }
const LUNAR: Record<string, string> = { penumbral: '半影月食', partial: '月偏食', total: '月全食' }
const COMPASS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']

/** What an event is called: 英仙座流星雨, 木星冲日, 月全食 … */
export function skyEventTitle(e: SkyEvent): string {
  switch (e.kind) {
    case 'solarEclipse':
      return SOLAR[e.type]
    case 'lunarEclipse':
      return LUNAR[e.type]
    case 'opposition':
      return `${PLANET[e.body]}冲日`
    case 'elongation':
      return `${PLANET[e.body]}${e.side === 'evening' ? '东' : '西'}大距`
    case 'conjunction':
      return `${PLANET[e.body]}合${PLANET[e.other]}`
    case 'meteors':
      return SHOWER[e.shower]
    case 'supermoon':
      return '超级月亮'
  }
}

/** An event in a line: when (in the place's time), what, where to look, and what to expect */
export function skyEventText(e: SkyEvent, timeZone: string): string {
  const clock = new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const hm = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const time = (ms: number) => hm.format(ms)
  const where = `${COMPASS[Math.round(e.azimuth / 45) % 8]}方 高 ${Math.round(e.altitude)}°`
  const note = (() => {
    switch (e.kind) {
      case 'solarEclipse':
        return `${time(e.start)}–${time(e.end)}，太阳被遮去 ${Math.round(e.obscuration * 100)}%。切勿直视太阳，须用专用日食眼镜。`
      case 'lunarEclipse':
        return e.type === 'penumbral'
          ? `${time(e.start)}–${time(e.end)}，月面只是略微变暗，肉眼不易察觉。`
          : e.whole
            ? `${time(e.start)}–${time(e.end)}，全程可见，肉眼即可观看。`
            : `${time(e.start)}–${time(e.end)}，此地只能看到月亮在地平线上的一段。`
      case 'opposition':
        return '整夜可见，是这颗行星最亮的时候。'
      case 'elongation':
        return `${e.side === 'evening' ? '日落后' : '日出前'}的低空，离太阳最远（${Math.round(e.degrees)}°），最容易看到。`
      case 'conjunction':
        return `两颗行星在天上相距约 ${e.degrees.toFixed(1)}°，肉眼可见。`
      case 'meteors':
        return e.moonLit > 0.5
          ? `理想条件下每小时约 ${e.zhr} 颗；月光（${Math.round(e.moonLit * 100)}%）会掩去较暗的流星。`
          : `理想条件下每小时约 ${e.zhr} 颗；月光干扰小。`
      case 'supermoon':
        return `满月离地球约 ${e.km.toLocaleString('zh')} 公里，比平常略大略亮。`
    }
  })()
  return `${clock.format(e.time)} · ${skyEventTitle(e)} · ${where} · ${note}`
}

/** The sky's events from a moment to some days on, seen from a place, in time order */
export function upcomingSkyEvents(from: Date, days: number, place: SkyPlaceLike): SkyEvent[] {
  const start = from.getTime()
  const end = start + days * 86400_000
  const years = new Set([from.getUTCFullYear() - 1, from.getUTCFullYear(), new Date(end).getUTCFullYear()])
  return [...years]
    .flatMap((y) => computeSkyEvents(y, place))
    .filter((e) => e.time >= start && e.time < end)
    .sort((a, b) => a.time - b.time)
}

// ---- 星盘 ----

/** Where a birth was, then: 1990年5月17日 10:30（当地时间，UTC+9，夏令时）· 北京（39°54′N 116°24′E） */
function birthLine(utc: Date, offsetMinutes: number, dst: boolean, place: { name: string; latitude: number; longitude: number }): string {
  const wall = new Date(utc.getTime() + offsetMinutes * 60_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const when = `${wall.getUTCFullYear()}年${wall.getUTCMonth() + 1}月${wall.getUTCDate()}日 ${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}`
  return `${when}（当地时间，${formatOffset(offsetMinutes)}${dst ? '，夏令时' : ''}）· ${place.name}（${formatCoords(place.latitude, place.longitude)}）`
}

const HOUSE_SYSTEM: Record<StarSettings['houses'], string> = {
  placidus: '普拉西度制',
  whole: '整宫制',
  equal: '等宫制',
}
const OVERLAY_NAME: Record<OverlayKind, string> = { transit: '行运', progressed: '次限推运', synastry: '合盘' }

/** 白羊 → 白羊座, so a position reads 白羊座 12°34′ */
const sign = (s: string) => `${s}座`
const pointText = (p: ChartPoint) => `${p.name} ${formatLon(p.lon, sign)}，第${p.house}宫${p.retrograde ? '（逆行）' : ''}`
const aspectText = (a: Aspect) => `${a.a.name} ${a.type.name} ${a.b.name}（差 ${a.orb.toFixed(1)}°）`

/** A 星盘 in full: when and where, each planet's sign, degree and house, the angles, the house
 *  cusps, the elements and the aspects, tightest first; and (given one) a 行运, 推运 or 合盘 laid over it */
export function starChartText(chart: StarChart, settings: StarSettings, overlay?: Overlay | null): string {
  const bodies = chart.points.filter((p) => p.key !== 'asc' && p.key !== 'mc')
  const counted = bodies.filter((p) => p.key !== 'node' && p.key !== 'southNode')
  const tally = (names: string[], of: (p: ChartPoint) => number) =>
    names.map((n, i) => `${n}${counted.filter((p) => of(p) === i).length}`).join(' ')
  const lines = [
    `出生：${birthLine(chart.utc, chart.offsetMinutes, chart.dst, chart.place)}`,
    `宫位制：${chart.housesFallback ? `${HOUSE_SYSTEM.equal}（出生地太靠近极圈，普拉西度制算不出）` : HOUSE_SYSTEM[settings.houses]} · 月交点：${settings.node === 'true' ? '真交点' : '平交点'}`,
    `上升 ${formatLon(chart.asc, sign)} · 天顶 ${formatLon(chart.mc, sign)}`,
    '行星：',
    ...bodies.map((p) => `  ${pointText(p)}`),
    `宫头：${chart.cusps.map((c, i) => `${i + 1}宫 ${formatLon(c, sign)}`).join('，')}`,
    `元素（十颗行星）：${tally(['火象', '土象', '风象', '水象'], (p) => p.sign % 4)}`,
    `模式：${tally(['基本', '固定', '变动'], (p) => p.sign % 3)}`,
    `相位：${chart.aspects.map(aspectText).join('；') || '无'}`,
  ]
  if (overlay) {
    const target = overlay.target.toISOString().slice(0, 10)
    lines.push(
      '',
      overlay.kind === 'synastry'
        ? `合盘：对方的行星落在这张盘的哪一宫，和这张盘的相位（对方在前）。`
        : `${OVERLAY_NAME[overlay.kind]}（${target}，${overlay.age.toFixed(1)} 岁）：${overlay.kind === 'transit' ? '那时天上的行星' : '推进后的行星'}落在本命盘的哪一宫，和本命的相位（${OVERLAY_NAME[overlay.kind]}在前）。`,
      ...overlay.points.map((p) => `  ${pointText(p)}`),
      `相位：${overlay.aspects.map(aspectText).join('；') || '无'}`,
    )
    if (overlay.partner)
      lines.push(
        `对方的盘：上升 ${formatLon(overlay.partner.asc, sign)}，${overlay.partner.points
          .filter((p) => p.key === 'sun' || p.key === 'moon')
          .map((p) => `${p.name} ${formatLon(p.lon, sign)}`)
          .join('，')}`,
      )
  }
  return lines.join('\n')
}

// ---- 七政四余 ----

/** 命宫, 财帛宫 …: the palace names as the chart is read aloud */
const palaceName = (k: number) => (k === 0 ? PALACES[0] : `${PALACES[k]}宫`)
const ciText = (k: number) => `${CI[k].name}之次（${CI[k].branch}）`

/** One body: its 宿 and how far in (古度, and degrees of RA), its 次 and palace */
const qizhengBodyText = (b: QizhengBody) => {
  const info = QIZHENG_INFO[b.key]
  const name = info.old !== info.name ? `${info.name}（${info.old}，五行属${info.element}）` : `${info.name}（五行属${info.element}）`
  return (
    `${name}：${b.mansion.name}（${b.mansion.animal}）入宿 ${b.du.toFixed(1)} 古度（赤经 ${b.into.toFixed(1)}°），` +
    `黄经 ${b.lon.toFixed(1)}°，在${ciText(b.ci)}，落${palaceName(b.palace)}` +
    (b.retro ? '，逆行' : '') +
    (b.reckoned ? '（依流派推算，天上没有对应的天体）' : '')
  )
}

/** A 七政四余 chart in full: when and where, the 命宫 and 命度, each of the 七政 and the 四余 in its 宿,
 *  次 and palace, the twelve palaces from the 命宫 with what is in each, how the 七政 fall among the four
 *  quarters, and the 流派 it was cast by */
export function qizhengText(chart: QizhengChart, schools: QizhengSchoolSettings): string {
  const by = (key: string) => chart.bodies.find((b) => b.key === key)
  const name = (b: QizhengBody) => QIZHENG_INFO[b.key].name
  const zones: MansionZone[] = ['east', 'north', 'west', 'south']
  const seven = SEVEN.map(by).filter((b): b is QizhengBody => !!b)
  const four = FOUR.map(by).filter((b): b is QizhengBody => !!b)
  const inMing = chart.bodies.filter((b) => b.palace === 0)
  const lines = [
    `${chart.gender === '男' ? '乾造' : '坤造'}（${chart.gender}命）`,
    `出生：${birthLine(chart.utc, chart.offsetMinutes, chart.dst, chart.place)}`,
    `命宫：${CI[chart.mingCi].name}之次（${CI[chart.mingCi].branch}宫），上升点黄经 ${chart.asc.toFixed(1)}°，命度在${chart.ascMansion.name}；` +
      (inMing.length ? `${list(inMing.map(name))}守命` : '命宫无星守'),
    '七政（日、月、五星，天文算出的地心视位置，按赤经归入二十八宿，入宿度为古度，周天 365¼ 度）：',
    ...seven.map((b) => `  ${qizhengBodyText(b)}`),
    '四余：',
    ...four.map((b) => `  ${qizhengBodyText(b)}`),
    '十二宫（从命宫起，顺黄道往东）：',
    ...PALACES.map((palace, k) => {
      const ci = (chart.mingCi + k) % 12
      return `  ${palace}（${CI[ci].name} · ${CI[ci].branch}）：${list(chart.bodies.filter((b) => b.palace === k).map(name))}`
    }),
    `七政所在的四象：${zones
      .map((z) => {
        const here = seven.filter((b) => b.mansion.zone === z)
        return `${ZONES[z].name} ${here.length}${here.length ? `（${here.map(name).join('、')}）` : ''}`
      })
      .join('，')}`,
    `流派：${(Object.keys(QIZHENG_SCHOOLS) as (keyof QizhengSchoolSettings)[])
      .map((key) => `${QIZHENG_SCHOOLS[key].title}取${QIZHENG_SCHOOLS[key].options.find((o) => o.value === schools[key])!.label}`)
      .join('；')}`,
    '十二次按黄道从春分点起每 30° 一次（清代《时宪历》的分法），命宫取上升点所在的次；月孛取月亮的平远地点。',
  ]
  return lines.join('\n')
}
