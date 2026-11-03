// 今晚观星: the night around the moment shown, hour by hour, as a strip from sunset to sunrise: each
// hour as good for the stars as the sky is dark, the Moon low or set and (once the forecast is on)
// the sky clear; the best run of hours written out. A click on an hour shows the sky then.
import { useMemo } from 'react'
import { GOOD, nightPlan } from '../lib/stargazing'
import type { WeatherHour } from '../lib/weather'
import { useT } from '../settingsContext'

interface Props {
  utc: Date
  latitude: number
  longitude: number
  /** The forecast, if switched on (empty while it comes, or offline) */
  weather: WeatherHour[]
  weatherOn: boolean
  weatherFailed: boolean
  onWeather: () => void
  /** Local "HH:MM" of a moment, and showing the sky at a moment */
  clock: (ms: number) => string
  onPick: (ms: number) => void
}

export function SkyNight({
  utc,
  latitude,
  longitude,
  weather,
  weatherOn,
  weatherFailed,
  onWeather,
  clock,
  onPick,
}: Props) {
  const t = useT()
  // Worked out again only when the hour, the place or the forecast changes
  const hour = Math.floor(utc.getTime() / 3600_000)
  const plan = useMemo(
    () => nightPlan(new Date(hour * 3600_000), latitude, longitude, weather),
    [hour, latitude, longitude, weather],
  )
  if (!plan) return null
  const now = utc.getTime()
  const best = plan.best
  const summary = best
    ? t('最佳 {from}–{to}', { from: clock(best.from), to: clock(best.to) }) +
      (best.cloud !== null ? ' · ' + (best.cloud < 20 ? t('晴') : best.cloud < 50 ? t('少云') : t('多云')) : '') +
      (best.moonUp ? ' · ' + t('有月光') : ' · ' + t('无月光'))
    : plan.hours.some((h) => h.cloud !== null && h.cloud >= 70)
      ? t('今晚多云，不宜观星')
      : t('今晚天不够黑，或月光太亮')
  return (
    <div className="sky-night">
      <div className="sky-night-head">
        <strong>{t('今晚观星')}</strong>
        <span className="muted">{summary}</span>
      </div>
      <div className="sky-night-strip" role="group" aria-label={t('今晚观星')}>
        {plan.hours.map((h) => {
          const on = now >= h.time && now < h.time + 3600_000
          const tip =
            t('{time} · 观星指数 {n}', { time: clock(h.time), n: Math.round(h.score * 10) }) +
            (h.cloud !== null ? ' · ' + t('云量 {n}%', { n: h.cloud }) : '') +
            (h.moon > 0.05 ? ' · ' + t('月光') : '')
          return (
            <button
              key={h.time}
              type="button"
              className={`sky-night-hour${h.score >= GOOD ? ' good' : ''}${on ? ' on' : ''}`}
              style={
                { '--score': h.score.toFixed(2), '--cloud': ((h.cloud ?? 0) / 100).toFixed(2) } as React.CSSProperties
              }
              title={tip}
              aria-label={tip}
              aria-pressed={on}
              data-sound="tick"
              onClick={() => onPick(h.time + 30 * 60_000)}
            >
              <span className="sky-night-bar" />
              <small>{new Date(h.time).getUTCMinutes() === 0 && clock(h.time).slice(0, 2)}</small>
            </button>
          )
        })}
      </div>
      {weatherOn ? (
        weatherFailed ? (
          <p className="muted row-note">{t('没能取到天气预报（离线或网络受限），只按天色和月光估计。')}</p>
        ) : weather.length ? (
          <p className="muted row-note">{t('云量预报来自 Open-Meteo。')}</p>
        ) : (
          <p className="muted row-note">{t('正在取天气预报……')}</p>
        )
      ) : (
        <button type="button" className="ghost sky-night-weather" data-sound="on" onClick={onWeather}>
          {t('联网查看云量')}
          <small className="muted">{t('（会把观测地的经纬度发给 Open-Meteo）')}</small>
        </button>
      )}
    </div>
  )
}
