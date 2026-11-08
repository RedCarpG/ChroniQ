import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SolarDay } from 'tyme4ts'
import { chartYear, type ChartDay, type ChartItem } from '../lib/chartDays'
import { buildIcs, downloadIcs, type IcsEntry } from '../lib/ics'
import { enDate } from '../lib/calendar'
import type { SavedChart } from '../lib/savedCharts'
import { loadSchools } from '../lib/schools'
import { formatAzimuth } from '../lib/azimuth'
import type { SkyEvent } from '../lib/skyEvents'
import { peekSkyEvents, skyEventsAsync } from '../lib/skyEventsClient'
import type { StarPlace } from '../lib/starPrefs'
import { useSettings, useT, useTerm, useZhOut } from '../settingsContext'
import { FeedSubscribe } from './FeedSubscribe'
import { PlacePicker } from './PlacePicker'
import type { SkyMoment } from './SkyView'
import { useDismiss } from './useDismiss'
import { useLocate } from './useLocate'

const DAY = 86400_000
const pad = (n: number) => String(n).padStart(2, '0')
/** A calendar day as an event's date */
export const dayKey = (d: SolarDay) => `${d.getYear()}-${pad(d.getMonth())}-${pad(d.getDay())}`

/**
 * The events of the given years seen from a place, each year worked out (in a worker) as it is
 * first asked for. Nothing is worked out while off.
 */
export function useSkyEvents(place: StarPlace, on: boolean, years: number[]) {
  const [version, setVersion] = useState(0)
  const [failed, setFailed] = useState(false)
  const wanted = [...new Set(years)].sort((a, b) => a - b)
  const wantedKey = wanted.join()
  useEffect(() => {
    if (!on || failed) return
    let active = true
    for (const year of wanted) {
      if (peekSkyEvents(year, place)) continue
      skyEventsAsync(year, place).then(
        () => active && setVersion((v) => v + 1),
        () => active && setFailed(true),
      )
    }
    return () => {
      active = false
    }
  }, [on, failed, place, wantedKey])
  // Looked up per day cell, so indexed by date
  const { byDate, loading } = useMemo(() => {
    const index = new Map<string, SkyEvent[]>()
    let missing = false
    if (on) {
      for (const year of wanted) {
        const events = peekSkyEvents(year, place)
        if (!events) missing = true
        for (const e of events ?? []) index.set(e.date, [...(index.get(e.date) ?? []), e])
      }
    }
    return { byDate: index, loading: missing }
  }, [on, place, wantedKey, version])
  return {
    of: (d: SolarDay) => byDate.get(dayKey(d)) ?? [],
    all: useMemo(() => [...byDate.values()].flat().sort((a, b) => a.time - b.time), [byDate]),
    loading: loading && !failed,
    failed,
    retry: () => setFailed(false),
  }
}

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

/** The constellation each shower seems to come from (the Quadrantids' own is no longer one: it lies in Boötes) */
const SHOWER_FIGURE: Record<string, string> = { QUA: 'Boo', LYR: 'Lyr', ETA: 'Aqr', PER: 'Per', ORI: 'Ori', LEO: 'Leo', GEM: 'Gem' }

/** Opening the sky at an event: when to look, with what it is about picked out */
export function skyMomentOf(event: SkyEvent): SkyMoment {
  const moment = { event, time: event.time }
  if (event.kind === 'solarEclipse') return { ...moment, chosen: 'sun', zoom: 6 }
  if (event.kind === 'lunarEclipse') return { ...moment, chosen: 'moon', zoom: 6 }
  if (event.kind === 'supermoon') return { ...moment, chosen: 'moon' }
  if (event.kind === 'meteors') return { ...moment, chosen: `fig${SHOWER_FIGURE[event.shower]}`, figures: 'west' }
  if (event.kind === 'conjunction') return { ...moment, chosen: event.body.toLowerCase(), also: event.other.toLowerCase(), zoom: 8 }
  return { ...moment, chosen: event.body.toLowerCase() }
}

/** Words an event in the UI language, its times in the place's zone */
export function useSkyEventText(place: StarPlace) {
  const t = useT()
  const { language } = useSettings()
  const clock = useMemo(
    () => new Intl.DateTimeFormat('en-GB', { timeZone: place.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
    [place.timeZone],
  )
  const time = (ms: number) => clock.format(ms)
  const title = (e: SkyEvent): string => {
    switch (e.kind) {
      case 'solarEclipse':
        return t(SOLAR[e.type])
      case 'lunarEclipse':
        return t(LUNAR[e.type])
      case 'opposition':
        return t('{planet}冲日', { planet: t(PLANET[e.body]) })
      case 'elongation':
        return e.side === 'evening' ? t('{planet}东大距', { planet: t(PLANET[e.body]) }) : t('{planet}西大距', { planet: t(PLANET[e.body]) })
      case 'conjunction':
        return t('{a}合{b}', { a: t(PLANET[e.body]), b: t(PLANET[e.other]) })
      case 'meteors':
        return t(SHOWER[e.shower])
      case 'supermoon':
        return t('超级月亮')
    }
  }
  const note = (e: SkyEvent): string => {
    switch (e.kind) {
      case 'solarEclipse':
        return t('{start}–{end}，太阳被遮去 {pct}%。切勿直视太阳，须用专用日食眼镜。', {
          start: time(e.start),
          end: time(e.end),
          pct: Math.round(e.obscuration * 100),
        })
      case 'lunarEclipse':
        return e.type === 'penumbral'
          ? t('{start}–{end}，月面只是略微变暗，肉眼不易察觉。', { start: time(e.start), end: time(e.end) })
          : e.whole
            ? t('{start}–{end}，全程可见，肉眼即可观看。', { start: time(e.start), end: time(e.end) })
            : t('{start}–{end}，此地只能看到月亮在地平线上的一段。', { start: time(e.start), end: time(e.end) })
      case 'opposition':
        return t('整夜可见，是这颗行星最亮的时候。')
      case 'elongation':
        return e.side === 'evening'
          ? t('日落后的低空，离太阳最远（{degrees}°），最容易看到。', { degrees: Math.round(e.degrees) })
          : t('日出前的低空，离太阳最远（{degrees}°），最容易看到。', { degrees: Math.round(e.degrees) })
      case 'conjunction':
        return t('两颗行星在天上相距约 {degrees}°，肉眼可见。', { degrees: e.degrees.toFixed(1) })
      case 'meteors':
        return e.moonLit > 0.5
          ? t('理想条件下每小时约 {zhr} 颗；月光（{pct}%）会掩去较暗的流星。', { zhr: e.zhr, pct: Math.round(e.moonLit * 100) })
          : t('理想条件下每小时约 {zhr} 颗；月光干扰小。', { zhr: e.zhr })
      case 'supermoon':
        return t('满月离地球约 {km} 公里，比平常略大略亮。', { km: e.km.toLocaleString(language === 'en' ? 'en' : 'zh') })
    }
  }
  /** The moment to look and where */
  const when = (e: SkyEvent) => t('{time} · {direction} · 高 {altitude}°', { time: time(e.time), direction: formatAzimuth(e.azimuth, language), altitude: Math.round(e.altitude) })
  return { title, note, when }
}

/** The events on the picked day, in the day panel */
export function SkyDayEvents({
  events,
  place,
  onViewSky,
  onViewMoon,
}: {
  events: SkyEvent[]
  place: StarPlace
  onViewSky: (moment: SkyMoment) => void
  /** A lunar eclipse can also be watched in 观月, at its greatest */
  onViewMoon?: (time: number) => void
}) {
  const t = useT()
  const text = useSkyEventText(place)
  if (events.length === 0) return null
  return (
    <div className="sky-days">
      <span className="tag-title neutral">{t('天象')}</span>
      <ul>
        {events.map((e) => (
          <li key={e.id}>
            <strong>{text.title(e)}</strong>
            <span className="sky-when">{text.when(e)}</span>
            <span className="muted">{text.note(e)}</span>
            <button type="button" className="ghost" data-sound="gong" onClick={() => onViewSky(skyMomentOf(e))}>
              {t('在天象中查看 →')}
            </button>
            {e.kind === 'lunarEclipse' && onViewMoon && (
              <button type="button" className="ghost" data-sound="gong" onClick={() => onViewMoon(e.time)}>
                {t('观月 →')}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The chart's dates worth a place in a calendar: not the 冲 / 合 / 刑, which come every few days */
const FILE_ITEMS: ChartItem[] = ['birthday', 'fortune', 'western']

/**
 * The line under the calendar with what comes next in the sky, opening the list of the coming year
 * from here, with the place it is reckoned for and the calendar file.
 */
export function SkyForecast({
  place,
  onPlace,
  events,
  loading,
  failed,
  onRetry,
  onPickDay,
  onViewSky,
  chart,
  chartItems,
  chartText,
}: {
  place: StarPlace
  onPlace: (place: StarPlace) => void
  /** All the events known, of this year and the next */
  events: SkyEvent[]
  loading: boolean
  failed: boolean
  onRetry: () => void
  onPickDay: (day: SolarDay) => void
  onViewSky: (moment: SkyMoment) => void
  /** The chart shown on the calendar, for its dates in the file */
  chart?: SavedChart
  chartItems: ChartItem[]
  chartText: (d: ChartDay) => string
}) {
  const t = useT()
  const term = useTerm()
  const { language } = useSettings()
  const en = language === 'en'
  const text = useSkyEventText(place)
  const zh = useZhOut()
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const close = useMemo(() => () => setOpen(false), [])
  useDismiss(panel, open, close)
  const { locating, locate } = useLocate(onPlace)
  const now = Date.now()
  const coming = useMemo(() => events.filter((e) => e.time >= now - 6 * 3600_000 && e.time <= now + 365 * DAY), [events, Math.floor(now / DAY)])
  const next = coming[0]
  const dateText = (date: string) => {
    const [y, m, d] = date.split('-').map(Number)
    return en ? enDate(y, m, d, { day: 'numeric', month: 'short' }) : `${m}月${d}日`
  }
  const daysAway = (e: SkyEvent) => Math.round((Date.parse(`${e.date}T00:00:00Z`) - Date.parse(`${new Date(now - new Date(now).getTimezoneOffset() * 60000).toISOString().slice(0, 10)}T00:00:00Z`)) / DAY)
  const away = (e: SkyEvent) => {
    const n = daysAway(e)
    return n <= 0 ? t('今天') : n === 1 ? t('明天') : t('{n} 天后', { n })
  }
  const pick = (e: SkyEvent) => {
    const [y, m, d] = e.date.split('-').map(Number)
    onPickDay(SolarDay.fromYmd(y, m, d))
    setOpen(false)
  }

  // The calendar file: what goes in it, chosen here
  const [withSky, setWithSky] = useState(true)
  const [withTerms, setWithTerms] = useState(false)
  const [withChart, setWithChart] = useState(false)
  const [saving, setSaving] = useState<'idle' | 'busy' | 'failed'>('idle')
  const items = FILE_ITEMS.filter((i) => chartItems.includes(i))
  const canChart = !!chart && items.length > 0
  const entriesOfChart = async (from: string, to: string): Promise<IcsEntry[]> => {
    if (!chart) return []
    const schools = loadSchools()
    const years = [Number(from.slice(0, 4)), Number(to.slice(0, 4))]
    const western = items.includes('western') ? await import('../lib/westernClient') : null
    const out: IcsEntry[] = []
    for (const year of new Set(years)) {
      const maps = [chartYear(chart, year, items, schools)]
      if (western) maps.push(await western.westernYearAsync(chart, year, new AbortController().signal))
      for (const days of maps) {
        for (const [key, list] of days) {
          const [m, d] = key.split('-').map(Number)
          const date = `${year}-${pad(m)}-${pad(d)}`
          if (date < from || date > to) continue
          list.forEach((day, i) => out.push({ uid: `chart-${chart.id}-${day.kind}-${date}-${i}`, title: chartText(day), date }))
        }
      }
    }
    return out
  }
  const save = async () => {
    setSaving('busy')
    try {
      const entries: IcsEntry[] = []
      const today = new Date(now - new Date(now).getTimezoneOffset() * 60000).toISOString().slice(0, 10)
      const end = new Date(Date.parse(`${today}T00:00:00Z`) + 365 * DAY).toISOString().slice(0, 10)
      if (withSky) {
        for (const e of coming) {
          const eclipse = e.kind === 'solarEclipse' || e.kind === 'lunarEclipse'
          entries.push({
            uid: e.id,
            title: text.title(e),
            description: `${text.when(e)}\n${text.note(e)}`,
            location: t(place.name),
            start: eclipse ? e.start : e.time,
            end: eclipse ? e.end : e.time + e.minutes * 60_000,
            alarm: 60,
          })
        }
      }
      if (withTerms) {
        const first = SolarDay.fromYmd(Number(today.slice(0, 4)), Number(today.slice(5, 7)), Number(today.slice(8)))
        for (let i = 0; i <= 365; i++) {
          const day = first.next(i)
          const termDay = day.getTermDay()
          if (termDay.getDayIndex() === 0) entries.push({ uid: `term-${dayKey(day)}`, title: term(termDay.getSolarTerm().getName()), date: dayKey(day) })
        }
      }
      if (withChart && canChart) entries.push(...(await entriesOfChart(today, end)))
      // A file for another program, out of the page converter's reach
      const words = (e: IcsEntry): IcsEntry => ({ ...e, title: zh(e.title), description: e.description && zh(e.description), location: e.location && zh(e.location) })
      downloadIcs('chroniq.ics', buildIcs(zh(t('星曆 ChroniQ')), entries.map(words)))
      setSaving('idle')
    } catch {
      setSaving('failed')
    }
  }

  return (
    <div className="sky-forecast">
      <button type="button" className="sky-forecast-bar" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <span className="sky-forecast-label">{t('天象预告')}</span>
        {next ? (
          <span className="sky-forecast-next">
            {dateText(next.date)} {text.title(next)}
            <span className="muted"> · {away(next)}</span>
          </span>
        ) : (
          <span className="muted">{failed ? t('计算失败') : loading ? t('计算中…') : t('未来一年此地没有可见的天象')}</span>
        )}
        <span className="muted sky-forecast-more">{t('全部 ›')}</span>
      </button>
      {open &&
        createPortal(
          <div className="sky-forecast-veil">
            <div className="sky-forecast-panel" role="dialog" aria-modal="true" aria-label={t('天象预告')} ref={panel}>
              <header>
                <h3>{t('天象预告')}</h3>
                <span className="muted">{t('未来一年，{place}能看到的', { place: t(place.name) })}</span>
                <button type="button" className="ghost sky-forecast-close" aria-label={t('关闭')} title={t('关闭')} onClick={() => setOpen(false)}>
                  ✕
                </button>
              </header>
              <details className="sky-forecast-place">
                <summary>{t('更换观测地')}</summary>
                <div className="sky-forecast-place-body">
                  <PlacePicker label={t('观测地')} place={place} onChange={onPlace} />
                  <button type="button" className="ghost" onClick={locate} disabled={locating === 'busy'}>
                    {locating === 'busy' ? t('定位中…') : t('📍 用我的位置')}
                  </button>
                  {locating === 'failed' && <small className="muted">{t('无法取得位置（可能未授权），请从列表中选择城市。')}</small>}
                </div>
              </details>
              {failed && (
                <p role="alert">
                  {t('天象预告计算失败，请重试。')} <button onClick={onRetry}>{t('重试')}</button>
                </p>
              )}
              <ul className="sky-forecast-list">
                {coming.map((e) => (
                  <li key={e.id}>
                    <button type="button" className="sky-forecast-item" data-sound="shang" onClick={() => pick(e)}>
                      <span className="sky-forecast-date">
                        {dateText(e.date)}
                        <small className="muted">{away(e)}</small>
                      </span>
                      <span className="sky-forecast-what">
                        <strong>{text.title(e)}</strong>
                        <span className="sky-when">{text.when(e)}</span>
                        <span className="muted">{text.note(e)}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="ghost sky-forecast-go"
                      data-sound="gong"
                      aria-label={t('在天象中查看：{name}', { name: text.title(e) })}
                      title={t('在天象中查看')}
                      onClick={() => onViewSky(skyMomentOf(e))}
                    >
                      ✦
                    </button>
                  </li>
                ))}
                {!loading && !failed && coming.length === 0 && <li className="muted">{t('未来一年此地没有可见的天象')}</li>}
              </ul>
              {/* Under the list, not at its end, so it is seen without scrolling */}
              <FeedSubscribe />
              <section className="sky-forecast-file">
                <h4>{t('下载日历文件')}</h4>
                <div className="sky-forecast-choices">
                  <label>
                    <input type="checkbox" checked={withSky} onChange={() => setWithSky(!withSky)} />
                    {t('天象（提前 1 小时提醒）')}
                  </label>
                  <label>
                    <input type="checkbox" checked={withTerms} onChange={() => setWithTerms(!withTerms)} />
                    {term('节气')}
                  </label>
                  <label className={canChart ? undefined : 'muted'}>
                    <input type="checkbox" disabled={!canChart} checked={withChart && canChart} onChange={() => setWithChart(!withChart)} />
                    {chart ? t('「{name}」的日子', { name: chart.name }) : t('命盘的日子')}
                  </label>
                </div>
                <button
                  type="button"
                  className="primary"
                  disabled={saving === 'busy' || loading || (!withSky && !withTerms && !(withChart && canChart))}
                  onClick={save}
                >
                  {saving === 'busy' ? t('生成中…') : t('下载日历文件（.ics）')}
                </button>
                {saving === 'failed' && <small role="alert">{t('生成失败，请重试。')}</small>}
                <details className="muted">
                  <summary>{t('如何导入')}</summary>
                  <small>{t('用手机或电脑的日历打开文件即可导入。文件含未来一年，不会自动更新，隔段时间重新导入即可；内容只在本机生成。部分日历（如 Google 日历）导入时可能忽略提醒。')}</small>
                </details>
              </section>
            </div>
          </div>,
          document.querySelector('.app') ?? document.body,
        )}
    </div>
  )
}
