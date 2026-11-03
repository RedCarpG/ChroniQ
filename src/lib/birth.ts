// A birth as people say it, made into what the charts take: a 农历 date to the 公历 one, and a city's
// name to its place (latitude, longitude and the time zone its clocks keep), from the cities the
// birth form offers. For programs that take a birth in words (chroniq-core).
import { LunarDay } from 'tyme4ts'
import { cityPlace, type Place } from './place'
import { CITIES } from './solarTime'
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
