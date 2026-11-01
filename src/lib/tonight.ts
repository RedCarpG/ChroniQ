// 今晚: what can be seen tonight from a place, without any event to go out for: when it gets dark, the
// Moon, and which planets are up and when. The night is the one under way, or else the coming one.
import { Body, Equator, Horizon, Illumination, MakeTime, Observer, SearchRiseSet } from 'astronomy-engine'
import type { BodyKey } from './astrology'
import type { SkyPlaceLike } from './skyEvents'

const MINUTE = 60_000
const STEP = 15 * MINUTE

export interface TonightBody {
  key: BodyKey
  /** When it is up in the dark tonight, UTC ms */
  from: number
  to: number
  /** Its highest in that time, and where */
  best: number
  altitude: number
  azimuth: number
  mag: number
}

export interface Tonight {
  /** Sunset and the next sunrise, UTC ms */
  sunset: number
  sunrise: number
  /** The Moon, if it is up in the dark, and how much of it is lit */
  moon: TonightBody | null
  moonLit: number
  /** The planets to see, brightest first */
  planets: TonightBody[]
}

const PLANETS: [BodyKey, Body][] = [
  ['mercury', Body.Mercury],
  ['venus', Body.Venus],
  ['mars', Body.Mars],
  ['jupiter', Body.Jupiter],
  ['saturn', Body.Saturn],
]

function bodyTonight(key: BodyKey, body: Body, sunset: number, sunrise: number, observer: Observer, minAltitude: number): TonightBody | null {
  let from = 0
  let to = 0
  let best = 0
  let altitude = -90
  let azimuth = 0
  for (let ms = sunset; ms <= sunrise; ms += STEP) {
    const time = MakeTime(new Date(ms))
    const sunEq = Equator(Body.Sun, time, observer, true, true)
    if (Horizon(time, observer, sunEq.ra, sunEq.dec, 'normal').altitude > -6) continue
    const eq = Equator(body, time, observer, true, true)
    const h = Horizon(time, observer, eq.ra, eq.dec, 'normal')
    if (h.altitude < minAltitude) continue
    if (!from) from = ms
    to = ms
    if (h.altitude > altitude) {
      altitude = h.altitude
      azimuth = h.azimuth
      best = ms
    }
  }
  if (!from) return null
  return { key, from, to, best, altitude, azimuth, mag: Illumination(body, new Date(best)).mag }
}

/** Tonight from a place; null where the Sun does not set or rise (near the poles) */
export function computeTonight(now: Date, place: SkyPlaceLike): Tonight | null {
  const observer = new Observer(place.latitude, place.longitude, 0)
  const nextSet = SearchRiseSet(Body.Sun, observer, -1, MakeTime(now), 1.5)
  const nextRise = SearchRiseSet(Body.Sun, observer, +1, MakeTime(now), 1.5)
  if (!nextSet || !nextRise) return null
  // A sunrise before the next sunset: it is night now, and the night began at the sunset before
  const lastSet = nextRise.date < nextSet.date ? SearchRiseSet(Body.Sun, observer, -1, MakeTime(now), -1.5) : nextSet
  if (!lastSet) return null
  const sunset = lastSet.date.getTime()
  const rise = nextRise.date.getTime() > sunset ? nextRise : SearchRiseSet(Body.Sun, observer, +1, lastSet, 1.5)
  if (!rise) return null
  const sunrise = rise.date.getTime()
  const planets = PLANETS.map(([key, body]) => bodyTonight(key, body, sunset, sunrise, observer, 8))
    .filter((b): b is TonightBody => b !== null)
    .sort((a, b) => a.mag - b.mag)
  return {
    sunset,
    sunrise,
    moon: bodyTonight('moon', Body.Moon, sunset, sunrise, observer, 3),
    moonLit: Illumination(Body.Moon, new Date((sunset + sunrise) / 2)).phase_fraction,
    planets,
  }
}
