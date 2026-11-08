// 订阅日历: the calendar a phone subscribes to once and keeps up to date by itself. Written at build
// time (scripts/feed.ts) into calendar/*.ics on the site, so it needs no server: each deploy, and a
// monthly rebuild, rolls it on. Unlike the 天象预告 file it is the same for everyone, so it holds what
// does not depend on where one stands, at its moment (UTC; the phone shows it in its own time):
// 节气, 月相, the peaks of the main meteor showers, the lunar eclipses and the planets at opposition.
import { Body, SearchLunarEclipse, NextLunarEclipse, NextMoonQuarter, SearchMoonQuarter, SearchRelativeLongitude, SearchSunLongitude } from 'astronomy-engine'
import type { FeedLanguage } from './feedPath'
import { buildIcs, type IcsEntry } from './ics'
import { SHOWERS } from './skyEvents'

/** Words in 简体 and in English; 繁體 is converted from the 简体 when the file is written */
export interface FeedWords {
  zh: string
  en: string
}
export interface FeedEvent {
  uid: string
  start: number
  end: number
  title: FeedWords
  description: FeedWords
}

const MINUTE = 60_000
const DAY = 86400_000
const w = (zh: string, en: string): FeedWords => ({ zh, en })
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** From 春分 (0°), every 15° of the Sun's longitude */
const TERMS: [string, string][] = [
  ['春分', 'Spring Equinox'],
  ['清明', 'Clear and Bright'],
  ['谷雨', 'Grain Rain'],
  ['立夏', 'Start of Summer'],
  ['小满', 'Grain Buds'],
  ['芒种', 'Grain in Ear'],
  ['夏至', 'Summer Solstice'],
  ['小暑', 'Minor Heat'],
  ['大暑', 'Major Heat'],
  ['立秋', 'Start of Autumn'],
  ['处暑', 'End of Heat'],
  ['白露', 'White Dew'],
  ['秋分', 'Autumn Equinox'],
  ['寒露', 'Cold Dew'],
  ['霜降', 'Frost Descent'],
  ['立冬', 'Start of Winter'],
  ['小雪', 'Minor Snow'],
  ['大雪', 'Major Snow'],
  ['冬至', 'Winter Solstice'],
  ['小寒', 'Minor Cold'],
  ['大寒', 'Major Cold'],
  ['立春', 'Start of Spring'],
  ['雨水', 'Rain Water'],
  ['惊蛰', 'Awakening of Insects'],
]
const QUARTERS: [string, string, string][] = [
  ['🌑', '新月', 'New Moon'],
  ['🌓', '上弦月', 'First Quarter'],
  ['🌕', '满月', 'Full Moon'],
  ['🌗', '下弦月', 'Last Quarter'],
]
const SHOWER_NAMES: Record<string, [string, string]> = {
  QUA: ['象限仪座流星雨', 'Quadrantids'],
  LYR: ['天琴座流星雨', 'Lyrids'],
  ETA: ['宝瓶座η流星雨', 'Eta Aquariids'],
  PER: ['英仙座流星雨', 'Perseids'],
  ORI: ['猎户座流星雨', 'Orionids'],
  LEO: ['狮子座流星雨', 'Leonids'],
  GEM: ['双子座流星雨', 'Geminids'],
}
const PLANETS: [Body, string, string][] = [
  [Body.Mars, '火星', 'Mars'],
  [Body.Jupiter, '木星', 'Jupiter'],
  [Body.Saturn, '土星', 'Saturn'],
]

function terms(from: number, to: number): FeedEvent[] {
  const out: FeedEvent[] = []
  for (let ms = from; ms < to; ) {
    // The next term after `ms`: the Sun's next multiple of 15°
    let found: { ms: number; i: number } | null = null
    for (let i = 0; i < 24; i++) {
      const t = SearchSunLongitude(i * 15, new Date(ms), 20)
      if (t && (!found || t.date.getTime() < found.ms)) found = { ms: t.date.getTime(), i }
    }
    if (!found || found.ms >= to) break
    const [zh, en] = TERMS[found.i]
    out.push({
      uid: `feed-term-${found.i * 15}-${utcDay(found.ms)}`,
      start: found.ms,
      end: found.ms,
      title: w(zh, `${zh} · ${en}`),
      description: w(`二十四节气之一：太阳到达黄经 ${found.i * 15}°。`, `One of the 24 solar terms: the Sun reaches ecliptic longitude ${found.i * 15}°.`),
    })
    ms = found.ms + DAY
  }
  return out
}

function moonPhases(from: number, to: number): FeedEvent[] {
  const out: FeedEvent[] = []
  for (let q = SearchMoonQuarter(new Date(from)); q.time.date.getTime() < to; q = NextMoonQuarter(q)) {
    const ms = q.time.date.getTime()
    const [icon, zh, en] = QUARTERS[q.quarter]
    out.push({
      uid: `feed-moon-${q.quarter}-${utcDay(ms)}`,
      start: ms,
      end: ms,
      title: w(`${icon} ${zh}`, `${icon} ${en}`),
      description: w('月相的时刻，各地相同。', 'The moment of the phase, the same everywhere.'),
    })
  }
  return out
}

function meteorPeaks(from: number, to: number): FeedEvent[] {
  const out: FeedEvent[] = []
  for (let year = new Date(from).getUTCFullYear(); year <= new Date(to).getUTCFullYear(); year++) {
    // The peaks are given for J2000; SearchSunLongitude takes the equinox of the date
    const precession = (1.397 * (year - 2000)) / 100
    for (const s of SHOWERS) {
      const t = SearchSunLongitude((s.longitude + precession + 360) % 360, new Date(Date.UTC(year, 0, 1)), 366)
      if (!t) continue
      const ms = t.date.getTime()
      if (ms < from || ms >= to) continue
      const [zh, en] = SHOWER_NAMES[s.code]
      out.push({
        uid: `feed-meteors-${s.code}-${year}`,
        start: ms,
        end: ms,
        title: w(`${zh}极大`, `${en} peak`),
        description: w(
          `理想条件下每小时约 ${s.zhr} 颗。极大前后的那一夜，午夜之后、远离灯光处最好看。`,
          `About ${s.zhr} an hour under ideal skies. Best on the night around the peak, after midnight and away from lights.`,
        ),
      })
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

function lunarEclipses(from: number, to: number): FeedEvent[] {
  const out: FeedEvent[] = []
  for (let e = SearchLunarEclipse(new Date(from)); e.peak.date.getTime() < to; e = NextLunarEclipse(e.peak)) {
    // A penumbral eclipse only dims the Moon a little: not worth a night out
    if (e.kind === 'penumbral') continue
    const peak = e.peak.date.getTime()
    const total = e.kind === 'total'
    out.push({
      uid: `feed-lunar-eclipse-${utcDay(peak)}`,
      start: peak - e.sd_partial * MINUTE,
      end: peak + e.sd_partial * MINUTE,
      title: total ? w('月全食', 'Total lunar eclipse') : w('月偏食', 'Partial lunar eclipse'),
      description: total
        ? w(
            `全食约 ${Math.round(e.sd_total * 2)} 分钟。此时月亮在地平线上的地方都能看到，肉眼即可。`,
            `Totality lasts about ${Math.round(e.sd_total * 2)} minutes. Seen with the naked eye wherever the Moon is up.`,
          )
        : w('此时月亮在地平线上的地方都能看到，肉眼即可。', 'Seen with the naked eye wherever the Moon is up.'),
    })
  }
  return out
}

function oppositions(from: number, to: number): FeedEvent[] {
  const out: FeedEvent[] = []
  for (const [body, zh, en] of PLANETS) {
    for (let ms = SearchRelativeLongitude(body, 0, new Date(from)).date.getTime(); ms < to; ms = SearchRelativeLongitude(body, 0, new Date(ms + 30 * DAY)).date.getTime()) {
      out.push({
        uid: `feed-opposition-${en}-${utcDay(ms)}`,
        start: ms,
        end: ms,
        title: w(`${zh}冲日`, `${en} at opposition`),
        description: w(`${zh}整夜可见，是一年中最亮的时候。`, `${en} is up all night, at its brightest of the year.`),
      })
    }
  }
  return out
}

/** Every event of the feed between two moments (UTC ms), by time */
export function feedEvents(from: number, to: number): FeedEvent[] {
  return [...terms(from, to), ...moonPhases(from, to), ...meteorPeaks(from, to), ...lunarEclipses(from, to), ...oppositions(from, to)].sort(
    (a, b) => a.start - b.start,
  )
}

/** The years a feed written at `now` holds: the year before (for looking back) to two years on */
export function feedSpan(now: number): [number, number] {
  const year = new Date(now).getUTCFullYear()
  return [Date.UTC(year - 1, 0, 1), Date.UTC(year + 3, 0, 1)]
}

/** A feed's file in a language; `toTrad` converts 简体 text for zh-Hant */
export function feedIcs(lang: FeedLanguage, events: FeedEvent[], stamp: number, toTrad: (s: string) => string = (s) => s): string {
  const say = (words: FeedWords) => (lang === 'en' ? words.en : lang === 'zh-Hant' ? toTrad(words.zh) : words.zh)
  const entries: IcsEntry[] = events.map((e) => ({ uid: e.uid, title: say(e.title), description: say(e.description), start: e.start, end: e.end }))
  return buildIcs(say(w('星曆 · 节气与天象', 'ChroniQ · Solar terms and sky')), entries, stamp, {
    description: say(w('二十四节气、月相、流星雨、月食与行星冲日，由星曆提供，自动更新。', 'The 24 solar terms, Moon phases, meteor showers, lunar eclipses and planets at opposition, from ChroniQ.')),
    refresh: 'P1D',
  })
}
