// 日历's 当日星象: the selected day by the Western reckoning (lib/westernToday). Loaded apart from the
// calendar, as it needs astronomy-engine, which the first screen does without.
import { useMemo, type ReactNode } from 'react'
import { loadStarSettings } from '../lib/starPrefs'
import { westernToday } from '../lib/westernToday'
import { useT } from '../settingsContext'
import { WesternDayList } from './WesternDay'

/** `at`: the moment the day is reckoned at (now for today, noon for another day); `children`: rows to go first */
export default function CalendarStars({ at, isToday, children }: { at: number; isToday: boolean; children?: ReactNode }) {
  const t = useT()
  const settings = useMemo(loadStarSettings, [])
  const western = useMemo(() => westernToday(new Date(at), settings), [at, settings])
  return (
    <WesternDayList western={western} noRetro={isToday ? t('今天没有行星逆行') : t('这天没有行星逆行')}>
      {children}
    </WesternDayList>
  )
}
