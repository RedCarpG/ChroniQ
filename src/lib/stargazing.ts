// 今晚观星: how good each hour of a night is for looking at the stars, from how dark the sky is (the
// Sun below −18° is full night), how much a Moon that is up washes it out, the cloud forecast if
// there is one (lib/weather.ts), and the light of the towns round about (the Bortle scale).
import * as A from 'astronomy-engine'
import { weatherAt, type WeatherHour } from './weather'

export interface NightHour {
  /** The start of the hour, ms since 1970 */
  time: number
  /** How dark the sky is from the Sun alone, 0 (twilight's start) to 1 (astronomical night) */
  dark: number
  /** How bright the Moon makes the sky, 0 (none, or set) to about 1 (full and high) */
  moon: number
  /** Cloud cover, 0–100 %, if forecast */
  cloud: number | null
  /** All together, 0–1 */
  score: number
}

export interface NightPlan {
  /** Sunset and the next sunrise */
  start: number
  end: number
  hours: NightHour[]
  /** The longest run of good hours, if any */
  best: { from: number; to: number; cloud: number | null; moonUp: boolean } | null
}

const HOUR = 3600_000
/** Hours at least this good make the best window */
export const GOOD = 0.55

/** The Bortle scale (1 a truly dark site … 9 a city centre): the faintest star seen, and how much of
 *  the Milky Way is left */
export const BORTLE: { name: string; limit: number; milkyWay: number }[] = [
  { name: '极暗夜空', limit: 6.6, milkyWay: 1.15 },
  { name: '典型暗夜', limit: 6.3, milkyWay: 1 },
  { name: '乡村', limit: 6, milkyWay: 0.85 },
  { name: '乡村与郊区之间', limit: 5.6, milkyWay: 0.55 },
  { name: '郊区', limit: 5.2, milkyWay: 0.3 },
  { name: '明亮的郊区', limit: 4.8, milkyWay: 0.12 },
  { name: '郊区与城市之间', limit: 4.3, milkyWay: 0 },
  { name: '城市', limit: 3.8, milkyWay: 0 },
  { name: '市中心', limit: 3.3, milkyWay: 0 },
]

/** How dark the sky is from the Sun's altitude: 0 above −6°, 1 below −18° */
export const darkness = (sunAlt: number) => Math.min(1, Math.max(0, (-6 - sunAlt) / 12))

/** How much the Moon brightens the sky: its lit fraction, more the higher it is, none once set */
export const moonGlare = (lit: number, alt: number) => (alt <= 0 ? 0 : lit * Math.min(1, 0.35 + alt / 30))

/**
 * The night around a moment: from the sunset before it (if the Sun is down) or after it, to the
 * next sunrise, hour by hour.
 */
export function nightPlan(
  utc: Date,
  latitude: number,
  longitude: number,
  weather: WeatherHour[] = [],
): NightPlan | null {
  const observer = new A.Observer(latitude, longitude, 0)
  const sunAlt = (t: Date) => {
    const eq = A.Equator(A.Body.Sun, t, observer, true, true)
    return A.Horizon(t, observer, eq.ra, eq.dec, 'normal').altitude
  }
  const down = sunAlt(utc) < 0
  const set = A.SearchRiseSet(A.Body.Sun, observer, -1, utc, down ? -1.2 : 1.2)
  if (!set) return null
  const rise = A.SearchRiseSet(A.Body.Sun, observer, +1, set.date, 1.2)
  if (!rise) return null
  const [start, end] = [set.date.getTime(), rise.date.getTime()]
  const hours: NightHour[] = []
  for (let t = Math.floor(start / HOUR) * HOUR; t < end; t += HOUR) {
    // Each hour read at its middle
    const mid = new Date(Math.min(Math.max(t + HOUR / 2, start), end))
    const moonEq = A.Equator(A.Body.Moon, mid, observer, true, true)
    const moonAlt = A.Horizon(mid, observer, moonEq.ra, moonEq.dec, 'normal').altitude
    const lit = A.Illumination(A.Body.Moon, mid).phase_fraction
    const dark = darkness(sunAlt(mid))
    const moon = moonGlare(lit, moonAlt)
    const w = weatherAt(weather, mid.getTime())
    const cloud = w ? Math.round(w.cloud) : null
    const score = dark * (1 - 0.6 * moon) * (cloud === null ? 1 : 1 - cloud / 100)
    hours.push({ time: t, dark, moon, cloud, score })
  }
  // The longest run of good hours
  let best: NightPlan['best'] = null
  let run: NightHour[] = []
  const close = () => {
    if (run.length && (!best || run.length > (best.to - best.from) / HOUR)) {
      const clouds = run.map((h) => h.cloud).filter((c): c is number => c !== null)
      best = {
        from: Math.max(run[0].time, start),
        to: Math.min(run[run.length - 1].time + HOUR, end),
        cloud: clouds.length ? Math.round(clouds.reduce((a, b) => a + b, 0) / clouds.length) : null,
        moonUp: run.some((h) => h.moon > 0.15),
      }
    }
    run = []
  }
  for (const h of hours) {
    if (h.score >= GOOD) run.push(h)
    else close()
  }
  close()
  return { start, end, hours, best }
}
