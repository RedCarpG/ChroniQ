// 今日星象 / 当日星象: the day by the Western reckoning (lib/westernToday), as 今日 and the 日历's
// day panel show it. Where the Sun and Moon are, when the Moon next changes sign, which planets are
// retrograde and the tightest aspects among them.
import { useState, type ReactNode } from 'react'
import { ASPECT_INFO, SIGN_INFO } from '../lib/astroInfo'
import { SIGNS, SIGN_GLYPHS, type Aspect } from '../lib/astrology'
import type { WesternToday } from '../lib/westernToday'
import { useSettings, useT } from '../settingsContext'
import { InfoTip } from './InfoTip'

/** One aspect as a line: the two planets, its mark, its name with a note, and how far off exact */
export function AspectLine({ aspect: a, transit }: { aspect: Aspect; transit: boolean }) {
  const t = useT()
  return (
    <>
      {transit ? t('行运{name}', { name: t(a.a.name) }) : t(a.a.name)} <span className="today-aspect-glyph">{a.type.glyph}</span>{' '}
      {transit ? t('本命{name}', { name: t(a.b.name) }) : t(a.b.name)}{' '}
      <InfoTip label={t(a.type.name)} title={t(a.type.name)}>
        <span>{ASPECT_INFO[a.type.key]}</span>
      </InfoTip>
      <span className="muted"> {t('差 {orb}°', { orb: a.orb.toFixed(1) })}</span>
    </>
  )
}

/** The day's stars as a list; `noRetro` is what to say when no planet is retrograde, `children` rows to go first */
/**
 * The day's sky in the zodiac. With `fold`, only the Sun and the Moon until asked: the retrogrades and
 * aspects are for those who read them.
 */
export function WesternDayList({ western, noRetro, fold, children }: { western: WesternToday; noRetro: string; fold?: boolean; children?: ReactNode }) {
  const t = useT()
  const en = useSettings().language === 'en'
  const [open, setOpen] = useState(!fold)
  const signName = (sign: number) => t('{sign}座', { sign: t(SIGNS[sign]) })
  const degrees = (lon: number) => `${Math.floor(lon % 30)}°`
  const moonClock = (ms: number) =>
    new Date(ms).toLocaleString(en ? 'en-GB' : 'zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
  return (
    <>
      <dl className="kv western-day">
        {children}
        <dt>{t('太阳')}</dt>
        <dd>
          <InfoTip label={`${SIGN_GLYPHS[western.sun.sign]} ${signName(western.sun.sign)} ${degrees(western.sun.lon)}`} title={signName(western.sun.sign)}>
            <span>{SIGN_INFO[western.sun.sign]}</span>
          </InfoTip>
        </dd>
        <dt>{t('月亮')}</dt>
        <dd>
          <InfoTip label={`${SIGN_GLYPHS[western.moon.sign]} ${signName(western.moon.sign)} ${degrees(western.moon.lon)}`} title={signName(western.moon.sign)}>
            <span>{SIGN_INFO[western.moon.sign]}</span>
          </InfoTip>
          {western.moonNext && (
            <span className="muted today-star-note">
              {t('{time} 进入{sign}', { time: moonClock(western.moonNext.at), sign: signName(western.moonNext.sign) })}
            </span>
          )}
        </dd>
        {open && (
          <>
            <dt>{t('逆行')}</dt>
            <dd>{western.retrograde.length > 0 ? western.retrograde.map((p) => `${t(p.name)} ℞`).join(t('、')) : <span className="muted">{noRetro}</span>}</dd>
            {western.aspects.length > 0 && (
              <>
                <dt>{t('相位')}</dt>
                <dd>
                  {western.aspects.map((a) => (
                    <span key={`${a.a.key}-${a.b.key}`} className="today-star-note today-aspect">
                      <AspectLine aspect={a} transit={false} />
                    </span>
                  ))}
                </dd>
              </>
            )}
          </>
        )}
      </dl>
      {fold && (
        <button type="button" className="ghost fold-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? t('收起') : t('逆行与相位 ›')}
        </button>
      )}
    </>
  )
}
