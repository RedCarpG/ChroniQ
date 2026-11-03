// What ChroniQ works out, as plain Chinese text to hand to an AI (or read aloud): a day's 黄历, a
// 八字 or 紫微 chart in full, and the sky's coming events. The app draws all of this; these say it
// in words, complete enough that a model can read the chart without casting it itself.
import { SolarDay } from 'tyme4ts'
import { buildDayDetail } from '../src/lib/calendar'
import type { BaziChart, Glyph } from '../src/lib/bazi'
import type { BaziReading } from '../src/lib/baziReading'
import { moonOf } from '../src/lib/moon'
import { computeSkyEvents, type SkyEvent, type SkyPlaceLike } from '../src/lib/skyEvents'
import type { ZiweiChart, ZiweiStar } from '../src/lib/ziwei'
import type { ZiweiPattern } from '../src/lib/ziweiPatterns'

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

const TENDENCY: Record<BaziReading['tendency'], string> = { strong: '日主偏旺', weak: '日主偏弱', balanced: '比较平衡' }

/** A 八字 chart in full: the four pillars with all that is reckoned on them, the 大运, and (given a
 *  reading, lib/baziReading) how strong the 日主 is and which 十神 weigh most */
export function baziText(chart: BaziChart, reading?: BaziReading): string {
  const lines = [
    `${chart.gender}命 · 阳历 ${chart.solarText} · 农历 ${chart.lunarText} · 属${chart.zodiac}`,
    ...(chart.trueSolar ? [`按真太阳时：${chart.trueSolar.text}`] : []),
    `日主：${glyphText(chart.dayMaster)}`,
    '四柱：',
    ...chart.pillars.map(
      (p) =>
        `  ${p.label} ${p.stem.char}${p.branch.char}：天干 ${glyphText(p.stem)}，地支 ${glyphText(p.branch)}，` +
        `藏干 ${list(p.hidden.map(glyphText))}；纳音 ${p.sound}，星运 ${p.terrain}，自坐 ${p.selfTerrain}，` +
        `空亡 ${p.empty || '无'}；神煞 ${list(p.shenSha.map((s) => s.name))}`,
    ),
    `胎元 ${chart.fetalOrigin} · 胎息 ${chart.fetalBreath} · 命宫 ${chart.ownSign} · 身宫 ${chart.bodySign}`,
    `五行个数：${Object.entries(chart.elementCount)
      .map(([e, n]) => `${e}${n}`)
      .join(' ')}`,
    `干支关系：${list(chart.relations.map((r) => `${r.text}（${r.members.join('、')}）`))}`,
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
