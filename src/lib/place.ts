// The birthplace: one place per chart, used by 八字 / 紫微 for 真太阳时 and
// by 星盘 for houses and the time zone the birth time was recorded in.
import { CITIES, type City } from './solarTime'
import { validZone } from './timeZone'

export interface Place {
  name: string
  latitude: number
  /** East positive */
  longitude: number
  /** IANA zone the birth time was recorded in */
  timeZone: string
}

const SHANGHAI = 'Asia/Shanghai'

export const cityPlace = (c: City): Place => ({
  name: c.name,
  latitude: c.latitude,
  longitude: c.longitude,
  timeZone: c.timeZone ?? SHANGHAI,
})

/** 北京, where a chart with no birthplace is taken to be from */
export const DEFAULT_PLACE: Place = cityPlace(CITIES[0])

/** A well-formed place, or null. */
export function toPlace(v: unknown): Place | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (
    typeof o.name === 'string' &&
    typeof o.latitude === 'number' &&
    typeof o.longitude === 'number' &&
    Number.isFinite(o.latitude) &&
    Number.isFinite(o.longitude) &&
    Math.abs(o.latitude) <= 90 &&
    Math.abs(o.longitude) <= 180 &&
    typeof o.timeZone === 'string' &&
    validZone(o.timeZone)
  )
    return { name: o.name.slice(0, 40), latitude: o.latitude, longitude: o.longitude, timeZone: o.timeZone }
  return null
}

export const samePlace = (a?: Place, b?: Place): boolean =>
  a === b ||
  (!!a &&
    !!b &&
    a.name === b.name &&
    a.latitude === b.latitude &&
    a.longitude === b.longitude &&
    a.timeZone === b.timeZone)

/**
 * The place an old 真太阳时 longitude stood for: its city, else a custom place
 * at that longitude (latitude from the nearest city by longitude), in 北京时间.
 */
export function placeFromLongitude(longitude: number): Place {
  const city = CITIES.find((c) => c.longitude === longitude)
  if (city) return cityPlace(city)
  const near = CITIES.reduce((a, b) => (Math.abs(b.longitude - longitude) < Math.abs(a.longitude - longitude) ? b : a))
  return { name: '自定义', latitude: near.latitude, longitude, timeZone: SHANGHAI }
}
