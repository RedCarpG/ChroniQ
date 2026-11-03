// 今日星象: the day by the Western reckoning, as 今日 shows it beside the 黄历. Where the Sun and Moon
// are and when the Moon next changes sign, which planets are retrograde, the tightest aspects among
// the planets, and, for a chart, the tightest transits to it.
import * as A from 'astronomy-engine'
import { bodyLon, buildStarChart, computeChart, transits, type Aspect, type ChartPoint, type StarChart } from './astrology'
import type { BaziInput } from './bazi'
import { DEFAULT_PLACE } from './place'
import type { StarSettings } from './starPrefs'

const HOUR = 3600_000
/** The planets that can turn retrograde, in order from the Sun */
const RETRO = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']
const PLANETS = ['sun', 'moon', ...RETRO]

export interface WesternToday {
  sun: ChartPoint
  moon: ChartPoint
  /** When the Moon goes into the next sign, UTC ms */
  moonNext: { sign: number; at: number } | null
  retrograde: ChartPoint[]
  /** The tightest aspects among the planets now, within 1.5° */
  aspects: Aspect[]
}

/** When the Moon next crosses into a sign, within the 2½ days it takes to cross one */
export function moonNextSign(now: Date): { sign: number; at: number } | null {
  const signAt = (ms: number) => Math.floor(bodyLon(A.Body.Moon, A.MakeTime(new Date(ms))) / 30)
  const start = signAt(now.getTime())
  let lo = now.getTime()
  for (let ms = lo + HOUR; ms <= lo + 62 * HOUR; ms += HOUR) {
    if (signAt(ms) !== start) {
      // To the minute, between the last hour in the old sign and the first in the new
      let a = ms - HOUR
      let b = ms
      while (b - a > 60_000) {
        const mid = (a + b) / 2
        if (signAt(mid) === start) a = mid
        else b = mid
      }
      return { sign: signAt(b), at: b }
    }
    lo = ms
  }
  return null
}

export function westernToday(now: Date, settings: StarSettings): WesternToday {
  // The signs and aspects are the same from anywhere: the place only moves the houses, not used here
  const sky = computeChart(now, 0, 0, settings)
  const of = (key: string) => sky.points.find((p) => p.key === key)!
  return {
    sun: of('sun'),
    moon: of('moon'),
    moonNext: moonNextSign(now),
    retrograde: sky.points.filter((p) => RETRO.includes(p.key) && p.retrograde),
    aspects: sky.aspects.filter((a) => PLANETS.includes(a.a.key) && PLANETS.includes(a.b.key) && a.orb <= 1.5).slice(0, 3),
  }
}

/** The tightest transits now to a chart, the Moon's left out as it passes every point within a month */
export function transitsToday(input: BaziInput, now: Date, settings: StarSettings): { natal: StarChart; aspects: Aspect[] } {
  const natal = buildStarChart(input, input.place ?? DEFAULT_PLACE, settings)
  return { natal, aspects: transits(natal, now, settings).aspects.filter((a) => a.a.key !== 'moon').slice(0, 3) }
}
