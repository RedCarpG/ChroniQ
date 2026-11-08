// 生辰月相海报: the Moon at the moment of birth, seen from the birthplace, as a poster (MoonPoster), from
// the chart pages' export menu beside 生辰星空海报. Default export, loaded only when asked for.
import { useMemo } from 'react'
import { SolarDay } from 'tyme4ts'
import type { BaziInput } from '../lib/bazi'
import { enDate } from '../lib/calendar'
import { moonView } from '../lib/moonView'
import { DEFAULT_PLACE } from '../lib/place'
import { moonPhaseName } from '../lib/sky'
import { toUtc } from '../lib/timeZone'
import { useSettings, useT, useTerm } from '../settingsContext'
import MoonPoster from './MoonPoster'

const pad = (n: number) => String(n).padStart(2, '0')

export default function BirthMoonPoster({ input, onClose, onViewMoon }: { input: BaziInput; onClose: () => void; onViewMoon?: () => void }) {
  const t = useT()
  const term = useTerm()
  const en = useSettings().language === 'en'
  const place = input.place ?? DEFAULT_PLACE
  const { year, month, day, hour, minute } = input
  const moon = useMemo(
    () => moonView(toUtc({ year, month, day, hour, minute }, place.timeZone).date, place.latitude, place.longitude),
    [year, month, day, hour, minute, place],
  )
  const lunar = SolarDay.fromYmd(year, month, day).getLunarDay()
  return (
    <MoonPoster
      moon={moon}
      date={en ? enDate(year, month, day, { day: 'numeric', month: 'long', year: 'numeric' }) : `${year}年${month}月${day}日`}
      time={`${pad(hour)}:${pad(minute)}`}
      phase={`${t(moonPhaseName(moon.phase))} · ${term(`${lunar.getLunarMonth().getName()}${lunar.getName()}`)} · ${t('照亮 {pct}%', { pct: Math.round(moon.lit * 100) })}`}
      place={t(place.name)}
      title={t('生辰月相海报')}
      defaultTitle={t('生辰月相')}
      action={onViewMoon && { label: t('在观月中查看 →'), onClick: onViewMoon }}
      onClose={onClose}
    />
  )
}
