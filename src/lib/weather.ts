// The weather for stargazing, from Open-Meteo (https://open-meteo.com: free, no key, CORS open): the
// cloud cover by the hour, high, middle and low, with the wind that moves it, for the place's latitude
// and longitude. Only those two numbers are sent, and only once the reader has switched it on (the
// 天象 page asks first). Kept for half an hour in memory and in this browser.

export interface WeatherHour {
  /** The hour, ms since 1970 (UTC) */
  time: number
  /** Cloud cover, 0–100 %: all of it, and by height */
  cloud: number
  low: number
  mid: number
  high: number
  /** Relative humidity at 2 m, % */
  humidity: number
  /** Wind at 10 m: km/h, and the direction it blows from (degrees, 0 north, 90 east) */
  wind: number
  windFrom: number
}

const URL_BASE = 'https://api.open-meteo.com/v1/forecast'
const KEEP_MS = 30 * 60_000
const STORE_KEY = 'chroniq-weather'
const VARS = [
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
  'relative_humidity_2m',
  'wind_speed_10m',
  'wind_direction_10m',
]

/** The request for a place: rounded to about a kilometre, which is all a forecast needs */
export function forecastUrl(latitude: number, longitude: number) {
  const p = new URLSearchParams({
    latitude: latitude.toFixed(2),
    longitude: longitude.toFixed(2),
    hourly: VARS.join(','),
    timeformat: 'unixtime',
    timezone: 'UTC',
    past_days: '1',
    forecast_days: '4',
  })
  return `${URL_BASE}?${p}`
}

/** Open-Meteo's answer as hours */
export function parseForecast(json: unknown): WeatherHour[] {
  const h = (json as { hourly?: Record<string, number[]> }).hourly
  if (!h?.time) return []
  return h.time.map((t, i) => ({
    time: t * 1000,
    cloud: h.cloud_cover?.[i] ?? 0,
    low: h.cloud_cover_low?.[i] ?? 0,
    mid: h.cloud_cover_mid?.[i] ?? 0,
    high: h.cloud_cover_high?.[i] ?? 0,
    humidity: h.relative_humidity_2m?.[i] ?? 0,
    wind: h.wind_speed_10m?.[i] ?? 0,
    windFrom: h.wind_direction_10m?.[i] ?? 0,
  }))
}

const memory = new Map<string, { at: number; hours: WeatherHour[] }>()

/** The forecast for a place, from memory or this browser if fetched in the last half hour */
export async function fetchForecast(
  latitude: number,
  longitude: number,
  fetcher: typeof fetch = fetch,
): Promise<WeatherHour[]> {
  const url = forecastUrl(latitude, longitude)
  const now = Date.now()
  const hit = memory.get(url)
  if (hit && now - hit.at < KEEP_MS) return hit.hours
  try {
    const kept = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as {
      url: string
      at: number
      hours: WeatherHour[]
    } | null
    if (kept?.url === url && now - kept.at < KEEP_MS) {
      memory.set(url, kept)
      return kept.hours
    }
  } catch {
    // storage unavailable or spoilt: ask again
  }
  const res = await fetcher(url)
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
  const hours = parseForecast(await res.json())
  memory.set(url, { at: now, hours })
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ url, at: now, hours }))
  } catch {
    // storage unavailable: kept in memory only
  }
  return hours
}

/** The weather at a moment, between the hours either side (cloud cover read between them); none
 *  outside the forecast */
export function weatherAt(hours: WeatherHour[], utc: number): WeatherHour | null {
  if (!hours.length || utc < hours[0].time || utc > hours[hours.length - 1].time) return null
  const i = Math.min(hours.length - 2, Math.max(0, hours.findIndex((h) => h.time > utc) - 1))
  const [a, b] = [hours[i], hours[i + 1] ?? hours[i]]
  const f = b.time > a.time ? (utc - a.time) / (b.time - a.time) : 0
  const mix = (k: 'cloud' | 'low' | 'mid' | 'high' | 'humidity' | 'wind') => a[k] + (b[k] - a[k]) * f
  return {
    ...a,
    time: utc,
    cloud: mix('cloud'),
    low: mix('low'),
    mid: mix('mid'),
    high: mix('high'),
    humidity: mix('humidity'),
    wind: mix('wind'),
  }
}
