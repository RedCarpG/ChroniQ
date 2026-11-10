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
import { AlmanacTags } from './AlmanacTags'
import { ACTIVITY_INFO } from '../lib/almanacInfo'
import { MoonGlyph } from './MoonGlyph'
import { TodayScene } from './TodayScene'
import { BODY_COLOUR } from './bodyColours'
import type { SkyEvent } from '../lib/skyEvents'
import type { CSSProperties } from 'react'
import { PlacePicker } from './PlacePicker'
import { dayKey, skyMomentOf, useSkyEventText, useSkyEvents } from './SkyForecast'
import type { SkyMoment } from './SkyView'
import { useChartDayText, useChartDays } from './useChartDays'
import { useLocate } from './useLocate'
import { useStoredFlag } from './useStoredFlag'
import { AiAnalysis } from './AiAnalysis'
import { RightDrawer } from './RightDrawer'
import { dayPrompt } from '../lib/ai/prompts'
import { SIGNS, type Aspect } from '../lib/astrology'
import { loadStarSettings } from '../lib/starPrefs'
import { transitsToday, westernToday } from '../lib/westernToday'
import { AspectLine, WesternDayList } from './WesternDay'

/** Each kind of event's mark and colour, so the list can be told apart at a glance */
const EVENT_LOOK: Record<SkyEvent['kind'], { glyph: string; colour: (e: SkyEvent) => string }> = {
  solarEclipse: { glyph: '◐', colour: () => BODY_COLOUR.sun },
  lunarEclipse: { glyph: '◑', colour: () => '#d0704a' },
  supermoon: { glyph: '◯', colour: () => BODY_COLOUR.moon },
  meteors: { glyph: '☄', colour: () => '#9cc0ff' },
  opposition: { glyph: '☍', colour: (e) => ('body' in e ? BODY_COLOUR[e.body.toLowerCase()] : BODY_COLOUR.mars) },
  elongation: { glyph: '∠', colour: (e) => ('body' in e ? BODY_COLOUR[e.body.toLowerCase()] : BODY_COLOUR.venus) },
  conjunction: { glyph: '☌', colour: (e) => ('body' in e ? BODY_COLOUR[e.body.toLowerCase()] : BODY_COLOUR.jupiter) },
}

const BODY_NAME: Record<string, string> = { moon: '月亮', mercury: '水星', venus: '金星', mars: '火星', jupiter: '木星', saturn: '土星' }

/**
 * 今日: one screen for the day. The almanac and the Moon, what can be seen tonight from the 天象 page's
 * place, and how today meets the chart chosen in the 命盘 drawer.
 */
const TONIGHT_DETAIL_KEY = 'chroniq-today-tonight-detail'

export function TodayPage({
  fallbackPlace,
  onViewSky,
  onViewMoon,
  onViewSolar,
}: {
  fallbackPlace: StarPlace
  onViewSky: (moment: SkyMoment) => void
  /** Open 观月 now, or 太阳系 with a planet picked */
  onViewMoon: () => void
  onViewSolar: (planet: string) => void
}) {
  const t = useT()
  const term = useTerm()
  const { language, uiStyle } = useSettings()
  const en = language === 'en'
  // 天书: the day as a scene (TodayScene), in place of its card
  const tianshu = uiStyle === 'tianshu'

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
  // 今晚的天空 in a line a body, or with when in the night each is up and where to look
  const [tonightDetail, toggleTonightDetail] = useStoredFlag(TONIGHT_DETAIL_KEY, false)
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

  // 今日星象: the day by the Western reckoning, and the transits to the chart if one is chosen
  const starSettings = useMemo(loadStarSettings, [])
  const western = useMemo(() => westernToday(now, starSettings), [Math.floor(now.getTime() / 600_000), starSettings])
  const chartTransits = useMemo(() => (chart ? transitsToday(chart.input, now, starSettings).aspects : []), [chart, Math.floor(now.getTime() / 600_000), starSettings])
  const plainAspect = (a: Aspect, transit: boolean) =>
    `${transit ? `行运${a.a.name}` : a.a.name}${a.type.name}${transit ? `本命${a.b.name}` : a.b.name}（差 ${a.orb.toFixed(1)}°）`

  // AI 解读 of the day: its 黄历, and the chosen chart with what ChroniQ works out between them
  const aiNotes = [
    ...(bazi && dayStar ? [`今天的日干${detail.pillars[2].stem.char}对日主${bazi.dayMaster.char}是${dayStar}`] : []),
    ...(yearSign ? [`今年是这张盘的${yearSign}`] : []),
    ...(decade ? [`现在走${decade.ganzhi}大运（${decade.startYear}–${decade.endYear}）`] : []),
    ...todayDays.map((d) => chartText(d)),
    ...chartTransits.map((a) => `星盘行运：${plainAspect(a, true)}`),
  ]
  // The Western day for the reading too, chart or not
  const aiWestern = [
    `太阳在${SIGNS[western.sun.sign]}座，月亮在${SIGNS[western.moon.sign]}座`,
    western.retrograde.length > 0 ? `逆行中：${western.retrograde.map((p) => p.name).join('、')}` : '没有行星逆行',
    ...western.aspects.map((a) => `天上的相位：${plainAspect(a, false)}`),
  ]
  const aiPrompt = dayPrompt(today.getYear(), today.getMonth(), today.getDay(), chart && bazi ? { name: chart.name, bazi, notes: aiNotes } : undefined, aiWestern)

  const chartHint = chartDays.charts.length === 0
    ? t('在左侧「命盘」里保存一张命盘，这里会显示今天与它的关系。')
    : t('在左侧「命盘」里选一张命盘，这里会显示今天与它的关系。')

  return (
    <div className={`today-page${tianshu ? ' scene' : ''}`}>
      {tianshu && (
        <TodayScene
          date={{ year: today.getYear(), month: today.getMonth(), day: today.getDay() }}
          detail={detail}
          moon={moon}
          onViewMoon={onViewMoon}
          hint={chart && bazi && dayStar ? undefined : chartHint}
          hou={(() => {
            const p = today.getPhenologyDay().getPhenology()
            return { which: p.getThreePhenology().getName(), name: p.getName() }
          })()}
        />
      )}
      <div className="today-col">
      {!tianshu && (
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
            <button type="button" className="ghost view-more" data-sound="gong" onClick={onViewMoon}>
              {t('观月 →')}
            </button>
          </dd>
        </dl>
        <AlmanacTags title={term('宜')} kind="good" items={detail.recommends.slice(0, 8)} info={ACTIVITY_INFO} />
        <AlmanacTags title={term('忌')} kind="bad" items={detail.avoids.slice(0, 8)} info={ACTIVITY_INFO} />
        {/* Without a chart chosen, a line on what one would add (its card shows only with one) */}
        {!(chart && bazi && dayStar) && (
          <p className="muted today-note today-chart-hint">{chartHint}</p>
        )}
      </section>
      )}

      <section className="card today-western">
        <h3 className="section-title">{t('今日星象')}</h3>
        <WesternDayList western={western} noRetro={t('今天没有行星逆行')} fold />
      </section>

      {chart && bazi && dayStar && (
      <section className="card today-chart">
        <h3 className="section-title">{t('今日与命盘')}</h3>
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
            {chartTransits.length > 0 && (
              <div className="mine-days">
                <span className="tag-title neutral">{t('星盘行运')}</span>
                <ul>
                  {chartTransits.map((a) => (
                    <li key={`${a.a.key}-${a.b.key}-${a.type.key}`} className="today-aspect">
                      <AspectLine aspect={a} transit />
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
      </section>
      )}
      </div>

      <section className="card today-sky">
        <div className="today-card-head">
          <h3 className="section-title">{t('今晚的天空')}</h3>
          <button type="button" className="ghost fold-toggle" aria-pressed={tonightDetail} onClick={toggleTonightDetail}>
            {tonightDetail ? t('简要') : t('详细')}
          </button>
        </div>
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
            <ul className="today-bodies tonight-bodies">
              {[...(tonight.moon ? [tonight.moon] : []), ...tonight.planets].map((b) => {
                // Where in the night it is up, as a bar from sunset to sunrise, and its best moment on it
                const night = tonight.sunrise - tonight.sunset
                const at = (ms: number) => `${(((ms - tonight.sunset) / night) * 100).toFixed(1)}%`
                return (
                  <li key={b.key} style={{ '--c': BODY_COLOUR[b.key] } as CSSProperties}>
                    <button type="button" data-sound="gong" title={t('在天象中查看')} onClick={() => onViewSky({ time: b.best, chosen: b.key })}>
                      <span className="tonight-mark" aria-hidden="true">
                        {b.key === 'moon' ? <MoonGlyph moon={moon} /> : <i style={{ width: `${Math.max(7, 13 - b.mag * 1.4)}px`, height: `${Math.max(7, 13 - b.mag * 1.4)}px` }} />}
                      </span>
                      <span className="tonight-what">
                        <strong>{t(BODY_NAME[b.key])}</strong>
                        <span className="sky-when">{tonightDetail ? range(b) : `${range(b)} · ${t('{time} 最佳', { time: time(b.best) })}`}</span>
                        {tonightDetail && (
                          <>
                            <span className="tonight-night" aria-hidden="true">
                              <span className="tonight-up" style={{ left: at(b.from), right: `calc(100% - ${at(b.to)})` }} />
                              <span className="tonight-best" style={{ left: at(b.best) }} />
                            </span>
                            <span className="muted">
                              {where(b)}
                              {b.key === 'moon' && ` · ${t('照亮 {pct}%', { pct: Math.round(tonight.moonLit * 100) })}`}
                            </span>
                          </>
                        )}
                      </span>
                    </button>
                    {/* The Moon up close, or the planet on its orbit */}
                    <button
                      type="button"
                      className="ghost view-more"
                      data-sound="gong"
                      onClick={() => (b.key === 'moon' ? onViewMoon() : onViewSolar(b.key))}
                    >
                      {b.key === 'moon' ? t('观月 →') : t('太阳系 →')}
                    </button>
                  </li>
                )
              })}
              {!tonight.moon && tonight.planets.length === 0 && <li className="muted">{t('今晚这里看不到月亮和行星。')}</li>}
            </ul>
          </>
        ) : (
          <p className="muted">{t('这里这几天没有日落或日出。')}</p>
        )}
      </section>

      <section className="card today-coming">
        <h3 className="section-title">{t('接下来的天象')}</h3>
        {sky.failed && (
          <p role="alert">
            {t('天象预告计算失败，请重试。')} <button onClick={sky.retry}>{t('重试')}</button>
          </p>
        )}
        <ul className="today-bodies coming-events">
          {coming.map((e) => {
            const [, m, d] = e.date.split('-').map(Number)
            const away = Math.round((Date.parse(`${e.date}T00:00:00Z`) - Date.parse(`${dayKey(today)}T00:00:00Z`)) / 86400_000)
            return (
              <li key={e.id} style={{ '--c': EVENT_LOOK[e.kind].colour(e) } as CSSProperties}>
                <button type="button" data-sound="gong" title={t('在天象中查看')} onClick={() => onViewSky(skyMomentOf(e))}>
                  {/* A calendar leaf: the day large, the month over it */}
                  <span className="coming-leaf" aria-hidden="true">
                    <small>{en ? enDate(today.getYear(), m, d, { month: 'short' }) : `${m}月`}</small>
                    <b>{d}</b>
                  </span>
                  <span className="tonight-what">
                    <strong>
                      <span className="coming-glyph" aria-hidden="true">
                        {EVENT_LOOK[e.kind].glyph}
                      </span>
                      {skyText.title(e)}
                      <span className="coming-away">{away <= 0 ? t('今天') : away === 1 ? t('明天') : t('{n} 天后', { n: away })}</span>
                    </strong>
                    <span className="sky-when">{skyText.when(e)}</span>
                    <span className="muted">{skyText.note(e)}</span>
                  </span>
                </button>
              </li>
            )
          })}
          {sky.loading && coming.length === 0 && <li className="muted">{t('计算中…')}</li>}
          {!sky.loading && !sky.failed && coming.length === 0 && <li className="muted">{t('未来一年此地没有可见的天象')}</li>}
        </ul>
      </section>


      {/* At the right edge, opened over the page when wanted */}
      <RightDrawer label={t('解读')}>
        {/* What the reading goes by: the chart chosen in the drawer, or the day alone */}
        <p className={`ai-basis${chart ? '' : ' none'}`}>
          {chart
            ? t('这次解读根据「{name}」的命盘和今天的黄历。想换一张，在左侧「命盘」里选。', { name: chart.name })
            : chartDays.charts.length === 0
              ? t('还没有命盘：现在的解读只看今天的黄历。先在左侧「命盘」里保存一张命盘，解读会结合它。')
              : t('还没选命盘：现在的解读只看今天的黄历。在左侧「命盘」里选一张命盘，解读会结合它。')}
        </p>
        <AiAnalysis id="today-ai" prompt={aiPrompt} />
      </RightDrawer>
    </div>
  )
}
