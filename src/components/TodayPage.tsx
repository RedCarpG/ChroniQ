import { useEffect, useMemo, useState } from 'react'
import { HeavenStem, SolarDay } from 'tyme4ts'
import { buildDayDetail, enDate, todaySolar } from '../lib/calendar'
import { TEN_STAR_NOTE } from '../lib/baziReading'
import { baziOf, taiSui } from '../lib/chartDays'
import { moonOf } from '../lib/moon'
import { loadSchools } from '../lib/schools'
import { formatAzimuth } from '../lib/sky'
import { loadSkyPlace, saveSkyPlace, type StarPlace } from '../lib/starPrefs'
import { computeTonight, type TonightBody } from '../lib/tonight'
import { useSettings, useT, useTerm } from '../settingsContext'
import { MoonGlyph } from './MoonGlyph'
import { PlacePicker } from './PlacePicker'
import { dayKey, skyMomentOf, useSkyEventText, useSkyEvents } from './SkyForecast'
import type { SkyMoment } from './SkyView'
import { useChartDayText, useChartDays } from './useChartDays'
import { useLocate } from './useLocate'
import { AiAnalysis } from './AiAnalysis'
import { dayPrompt } from '../lib/ai/prompts'

const BODY_NAME: Record<string, string> = { moon: '月亮', mercury: '水星', venus: '金星', mars: '火星', jupiter: '木星', saturn: '土星' }

/**
 * 今日: one screen for the day. The almanac and the Moon, what can be seen tonight from the 天象 page's
 * place, and how today meets the chart chosen in the 命盘 drawer.
 */
export function TodayPage({ fallbackPlace, onViewSky }: { fallbackPlace: StarPlace; onViewSky: (moment: SkyMoment) => void }) {
  const t = useT()
  const term = useTerm()
  const { language } = useSettings()
  const en = language === 'en'

  // A page left open past midnight, or the night turned to morning: read again on coming back to it
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const refresh = () => !document.hidden && setNow(new Date())
    document.addEventListener('visibilitychange', refresh)
    const id = setInterval(refresh, 600_000)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      clearInterval(id)
    }
  }, [])
  const today = todaySolar()
  const todayKey = dayKey(today)
  const detail = useMemo(() => buildDayDetail(today), [todayKey])
  const moon = moonOf(today)
  const ganzhi = detail.pillars[2].stem.char + detail.pillars[2].branch.char

  const [place, setPlaceState] = useState<StarPlace>(() => loadSkyPlace(fallbackPlace))
  const setPlace = (next: StarPlace) => {
    setPlaceState(next)
    saveSkyPlace(next)
  }
  const { locating, locate } = useLocate(setPlace)
  const tonight = useMemo(() => computeTonight(now, place), [Math.floor(now.getTime() / 600_000), place])
  const clock = useMemo(
    () => new Intl.DateTimeFormat('en-GB', { timeZone: place.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
    [place.timeZone],
  )
  const time = (ms: number) => clock.format(ms)
  const range = (b: TonightBody) =>
    tonight && b.from - tonight.sunset < 3600_000 && tonight.sunrise - b.to < 3600_000 ? t('整夜') : t('{from}–{to}', { from: time(b.from), to: time(b.to) })
  const where = (b: TonightBody) => t('{time} 最佳，{direction} · 高 {altitude}°', { time: time(b.best), direction: formatAzimuth(b.azimuth, language), altitude: Math.round(b.altitude) })

  const year = today.getYear()
  const sky = useSkyEvents(place, true, [year, year + 1])
  const skyText = useSkyEventText(place)
  const nowMs = now.getTime()
  const coming = sky.all.filter((e) => e.time >= nowMs - 6 * 3600_000).slice(0, 3)
  const dateText = (date: string) => {
    const [y, m, d] = date.split('-').map(Number)
    return en ? enDate(y, m, d, { day: 'numeric', month: 'short' }) : `${m}月${d}日`
  }

  // 命盘: the chart chosen in the drawer
  const chartDays = useChartDays()
  const chartText = useChartDayText()
  const chart = chartDays.shown[0]
  const schools = useMemo(loadSchools, [])
  const bazi = chart ? baziOf(chart, schools) : null
  const dayStar = bazi ? HeavenStem.fromName(bazi.pillars[2].stem.char).getTenStar(HeavenStem.fromName(detail.pillars[2].stem.char)).getName() : null
  const decade = bazi?.decades.filter((d) => d.startYear <= year).at(-1)
  const yearSign = chart ? taiSui(chart, detail.pillars[0].branch.char, schools) : null
  const todayDays = chartDays.daysOf(today, ganzhi)
  const dayName = (d: SolarDay) => (en ? enDate(d.getYear(), d.getMonth(), d.getDay(), { day: 'numeric', month: 'short' }) : `${d.getMonth()}月${d.getDay()}日`)
  const nextDays: { day: SolarDay; text: string }[] = []
  if (chart) {
    for (let i = 1; i <= 90 && nextDays.length < 3; i++) {
      const day = today.next(i)
      const sc = day.getSixtyCycleDay().getSixtyCycle().getName()
      for (const d of chartDays.daysOf(day, sc)) {
        if (d.kind !== 'pillar' && nextDays.length < 3) nextDays.push({ day, text: chartText(d) })
      }
    }
  }

  // AI 解读 of the day: its 黄历, and the chosen chart with what ChroniQ works out between them
  const aiNotes = [
    ...(bazi && dayStar ? [`今天的日干${detail.pillars[2].stem.char}对日主${bazi.dayMaster.char}是${dayStar}`] : []),
    ...(yearSign ? [`今年是这张盘的${yearSign}`] : []),
    ...(decade ? [`现在走${decade.ganzhi}大运（${decade.startYear}–${decade.endYear}）`] : []),
    ...todayDays.map((d) => chartText(d)),
  ]
  const aiPrompt = dayPrompt(today.getYear(), today.getMonth(), today.getDay(), chart && bazi ? { name: chart.name, bazi, notes: aiNotes } : undefined)

  return (
    <div className="today-page">
      <section className="card today-day">
        <div className="detail-hero">
          <div className="big">{today.getDay()}</div>
          <div>
            <div>{en ? enDate(today.getYear(), today.getMonth(), today.getDay(), { day: 'numeric', month: 'long', year: 'numeric' }) : detail.solarText}</div>
            <div className="muted">
              {en ? enDate(today.getYear(), today.getMonth(), today.getDay(), { weekday: 'long' }) : detail.weekText} · {t(detail.constellation)}
            </div>
          </div>
        </div>
        <div className="lunar-line">
          {term('农历')}
          {term(detail.lunarText)}
          <span className="muted"> · {detail.ganzhi}</span>
        </div>
        {detail.festivals.length > 0 && (
          <div className="tags">
            {detail.festivals.map((f) => (
              <span key={f} className="tag festival">
                {term(f)}
              </span>
            ))}
          </div>
        )}
        <dl className="kv">
          <dt>{term('节气')}</dt>
          <dd>{t('{term}第{n}天', { term: term(detail.termName), n: detail.termDay })}</dd>
          <dt>{t('月相')}</dt>
          <dd className="moon-line">
            <MoonGlyph moon={moon} />
            {t(moon.name)} · {t('照亮 {pct}%', { pct: Math.round(moon.lit * 100) })}
          </dd>
        </dl>
        <div className="tag-block">
          <span className="tag-title good">{term('宜')}</span>
          <p>{detail.recommends.slice(0, 8).map(term).join(' ') || '—'}</p>
        </div>
        <div className="tag-block">
          <span className="tag-title bad">{term('忌')}</span>
          <p>{detail.avoids.slice(0, 8).map(term).join(' ') || '—'}</p>
        </div>
      </section>

      <section className="card today-sky">
        <h3 className="section-title">{t('今晚的天空')}</h3>
        <details className="sky-forecast-place">
          <summary>{t('{place} · 更换观测地', { place: t(place.name) })}</summary>
          <div className="sky-forecast-place-body">
            <PlacePicker label={t('观测地')} place={place} onChange={setPlace} />
            <button type="button" className="ghost" onClick={locate} disabled={locating === 'busy'}>
              {locating === 'busy' ? t('定位中…') : t('📍 用我的位置')}
            </button>
            {locating === 'failed' && <small className="muted">{t('无法取得位置（可能未授权），请从列表中选择城市。')}</small>}
          </div>
        </details>
        {tonight ? (
          <>
            <p className="muted today-note">{t('日落 {sunset} · 日出 {sunrise}', { sunset: time(tonight.sunset), sunrise: time(tonight.sunrise) })}</p>
            <ul className="today-bodies">
              {[...(tonight.moon ? [tonight.moon] : []), ...tonight.planets].map((b) => (
                <li key={b.key}>
                  <button type="button" data-sound="gong" title={t('在天象中查看')} onClick={() => onViewSky({ time: b.best, chosen: b.key })}>
                    <strong>{t(BODY_NAME[b.key])}</strong>
                    <span className="sky-when">{range(b)}</span>
                    <span className="muted">
                      {where(b)}
                      {b.key === 'moon' && ` · ${t('照亮 {pct}%', { pct: Math.round(tonight.moonLit * 100) })}`}
                    </span>
                  </button>
                </li>
              ))}
              {!tonight.moon && tonight.planets.length === 0 && <li className="muted">{t('今晚这里看不到月亮和行星。')}</li>}
            </ul>
          </>
        ) : (
          <p className="muted">{t('这里这几天没有日落或日出。')}</p>
        )}
        <h4 className="section-title today-sub">{t('接下来的天象')}</h4>
        {sky.failed && (
          <p role="alert">
            {t('天象预告计算失败，请重试。')} <button onClick={sky.retry}>{t('重试')}</button>
          </p>
        )}
        <ul className="today-bodies">
          {coming.map((e) => (
            <li key={e.id}>
              <button type="button" data-sound="gong" title={t('在天象中查看')} onClick={() => onViewSky(skyMomentOf(e))}>
                <strong>{skyText.title(e)}</strong>
                <span className="sky-when">
                  {dateText(e.date)} · {skyText.when(e)}
                </span>
                <span className="muted">{skyText.note(e)}</span>
              </button>
            </li>
          ))}
          {sky.loading && coming.length === 0 && <li className="muted">{t('计算中…')}</li>}
          {!sky.loading && !sky.failed && coming.length === 0 && <li className="muted">{t('未来一年此地没有可见的天象')}</li>}
        </ul>
      </section>

      <section className="card today-chart">
        <h3 className="section-title">{t('今日与命盘')}</h3>
        {chart && bazi && dayStar ? (
          <>
            <p className="today-chart-name">
              <strong>{chart.name}</strong>
              <span className="muted">{t('可在左侧「命盘」里换一张')}</span>
            </p>
            <dl className="kv">
              <dt>{t('今日十神')}</dt>
              <dd>
                <strong>{term(dayStar)}</strong>
                <span className="muted today-star-note">{t(TEN_STAR_NOTE[dayStar])}</span>
              </dd>
              {decade && (
                <>
                  <dt>{term('大运')}</dt>
                  <dd>
                    {term(decade.ganzhi)}
                  </dd>
                </>
              )}
              <dt>{term('流年')}</dt>
              <dd>
                {term(detail.pillars[0].stem.char + detail.pillars[0].branch.char)}
                {yearSign && ` · ${term(yearSign)}`}
              </dd>
            </dl>
            {todayDays.length > 0 && (
              <div className="mine-days">
                <span className="tag-title neutral">{t('今天')}</span>
                <ul>
                  {todayDays.map((d, i) => (
                    <li key={i} className={`mine-${d.kind}`}>
                      {chartText(d)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {nextDays.length > 0 && (
              <div className="mine-days">
                <span className="tag-title neutral">{t('接下来')}</span>
                <ul>
                  {nextDays.map((d, i) => (
                    <li key={i}>
                      <span className="muted">{dayName(d.day)}</span> {d.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {chartDays.westernLoading && <p className="muted today-note">{t('星盘日期计算中…')}</p>}
            {chartDays.westernError && (
              <p role="alert">
                {t('星盘日期计算失败，请重试。')} <button onClick={chartDays.retryWestern}>{t('重试')}</button>
              </p>
            )}
            <small className="muted">{t('命理内容是传统文化的说法，仅供参考。')}</small>
          </>
        ) : (
          <p className="muted">
            {chartDays.charts.length === 0
              ? t('在左侧「命盘」里保存一张命盘，这里会显示今天与它的关系。')
              : t('在左侧「命盘」里选一张命盘，这里会显示今天与它的关系。')}
          </p>
        )}
      </section>

      <AiAnalysis id="today-ai" prompt={aiPrompt} />
    </div>
  )
}
