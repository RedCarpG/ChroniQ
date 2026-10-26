// Share links: the birth data (with the birthplace and the page) in the URL
// hash, so a link opens the same chart on any device. The hash never reaches
// the server, and nothing else about the visitor goes in.
import type { BaziInput } from './bazi'
import { placeFromLongitude, toPlace } from './place'
import { toBaziInput } from './savedCharts'

export type ChartTab = 'bazi' | 'ziwei' | 'star'
const TABS: ChartTab[] = ['bazi', 'ziwei', 'star']

export interface SharedChart {
  tab: ChartTab
  input: BaziInput
}

const pad = (n: number) => String(n).padStart(2, '0')
const round = (n: number) => String(Math.round(n * 100) / 100)

/** Hash part of a share link, e.g. #t=ziwei&d=1997-11-02T10:30&g=m&pn=上海&lat=31.23&lon=121.47&tz=Asia/Shanghai&ts=1 */
export function shareHash({ tab, input }: SharedChart): string {
  const q = new URLSearchParams({
    t: tab,
    d: `${input.year}-${pad(input.month)}-${pad(input.day)}T${pad(input.hour)}:${pad(input.minute)}`,
    g: input.gender === 1 ? 'm' : 'f',
  })
  const { place } = input
  if (place) {
    q.set('pn', place.name)
    q.set('lat', round(place.latitude))
    q.set('lon', round(place.longitude))
    q.set('tz', place.timeZone)
  }
  if (input.trueSolar) q.set('ts', '1')
  return `#${q}`
}

/**
 * Reads a share link's hash; anything malformed gives null, so a bad link just
 * opens the app as usual. Older links carried a 真太阳时 longitude (lng) and,
 * for 星盘, the place separately; both still open.
 */
export function parseShareHash(hash: string): SharedChart | null {
  const q = new URLSearchParams(hash.replace(/^#/, ''))
  const tab = q.get('t') as ChartTab
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(q.get('d') ?? '')
  const g = q.get('g')
  if (!TABS.includes(tab) || !m || (g !== 'm' && g !== 'f')) return null
  const [year, month, day, hour, minute] = m.slice(1).map(Number)
  // Validate once the link's birthplace has been read, not in the default zone.
  const input: BaziInput = { year, month, day, hour, minute, gender: g === 'm' ? 1 : 0 }
  const place =
    q.has('lat') && q.has('lon')
      ? toPlace({
          name: q.get('pn') || '自定义地点',
          latitude: Number(q.get('lat')),
          longitude: Number(q.get('lon')),
          timeZone: q.get('tz') ?? '',
        })
      : null
  const lng = q.has('lng') ? Number(q.get('lng')) : NaN
  if (place) input.place = place
  else if (Math.abs(lng) <= 180) input.place = placeFromLongitude(lng)
  if (q.get('ts') === '1' || Math.abs(lng) <= 180) input.trueSolar = true
  const validated = toBaziInput(input)
  return validated ? { tab, input: validated } : null
}

/** Full share URL for the current page */
export const shareUrl = (chart: SharedChart): string => `${location.origin}${location.pathname}${shareHash(chart)}`
