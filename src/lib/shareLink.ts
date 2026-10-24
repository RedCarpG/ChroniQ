// Share links: the birth data (and the page, and the 星盘 birthplace) in the
// URL hash, so a link opens the same chart on any device. The hash never
// reaches the server, and nothing else about the visitor goes in.
import type { BaziInput } from './bazi'
import { toBaziInput } from './savedCharts'
import type { StarPlace } from './starPrefs'

export type ChartTab = 'bazi' | 'ziwei' | 'star'
const TABS: ChartTab[] = ['bazi', 'ziwei', 'star']

export interface SharedChart {
  tab: ChartTab
  input: BaziInput
  /** 星盘 links only */
  place?: StarPlace
}

const pad = (n: number) => String(n).padStart(2, '0')
const round = (n: number) => String(Math.round(n * 100) / 100)

/** Hash part of a share link, e.g. #t=ziwei&d=1997-11-02T10:30&g=m */
export function shareHash({ tab, input, place }: SharedChart): string {
  const q = new URLSearchParams({
    t: tab,
    d: `${input.year}-${pad(input.month)}-${pad(input.day)}T${pad(input.hour)}:${pad(input.minute)}`,
    g: input.gender === 1 ? 'm' : 'f',
  })
  if (input.longitude !== undefined) q.set('lng', round(input.longitude))
  if (place) {
    q.set('pn', place.name)
    q.set('lat', round(place.latitude))
    q.set('lon', round(place.longitude))
    q.set('tz', place.timeZone)
  }
  return `#${q}`
}

const validZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Reads a share link's hash; anything malformed gives null, so a bad link just opens the app as usual. */
export function parseShareHash(hash: string): SharedChart | null {
  const q = new URLSearchParams(hash.replace(/^#/, ''))
  const tab = q.get('t') as ChartTab
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(q.get('d') ?? '')
  const g = q.get('g')
  if (!TABS.includes(tab) || !m || (g !== 'm' && g !== 'f')) return null
  const [year, month, day, hour, minute] = m.slice(1).map(Number)
  const lng = q.get('lng')
  const input = toBaziInput({
    year,
    month,
    day,
    hour,
    minute,
    gender: g === 'm' ? 1 : 0,
    longitude: lng && Number(lng),
  })
  if (!input) return null
  const shared: SharedChart = { tab, input }
  const [lat, lon, tz] = [Number(q.get('lat')), Number(q.get('lon')), q.get('tz') ?? '']
  if (q.has('lat') && Math.abs(lat) <= 90 && q.has('lon') && Math.abs(lon) <= 180 && validZone(tz))
    shared.place = {
      name: (q.get('pn') ?? '').slice(0, 40) || '自定义地点',
      latitude: lat,
      longitude: lon,
      timeZone: tz,
    }
  return shared
}

/** Full share URL for the current page */
export const shareUrl = (chart: SharedChart): string => `${location.origin}${location.pathname}${shareHash(chart)}`
