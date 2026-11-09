// 天书's 星盘, 简洁: the chart as a scene, laid out as 八字's is (BaziHero), but in the west's manner, read
// across: the wheel (StarWheel) in the middle, as large as the screen allows; the chart's name at the top
// left (the Sun's heart, the Ascendant's face); the four elements at the top right; the big three (Sun,
// Moon, Ascendant) at the foot on the left, as 八字's four pillars stand; the chart's closest aspects at
// the foot on the right. 详细 is the full chart without the scene: the comparison charts, the tables and
// the houses.
// 起盘 (useCasting, five layers): the Sun, the Moon, the Ascendant with the houses, the other planets
// (and so the elements), then the aspects, each part of the scene coming in with its layer.
import type { ReactNode } from 'react'
import { SIGN_ELEMENT, SIGN_GLYPHS, SIGNS, type Aspect, type ChartPoint, type StarChart } from '../lib/astrology'
import { useT } from '../settingsContext'
import { CastLine } from './CastLine'
import type { useCasting } from './useCasting'

/** How many aspects the scene names: the closest, those of the Sun and Moon first */
const SHOWN_ASPECTS = 3
const ANGLES = ['asc', 'mc']

/** The aspects a newcomer reads first: between planets (not the angles), the Sun's and the Moon's
 * before the others', each group the closest first */
export function keyAspects(aspects: Aspect[], count = SHOWN_ASPECTS) {
  const lights = (a: Aspect) => [a.a.key, a.b.key].some((k) => k === 'sun' || k === 'moon')
  return aspects
    .filter((a) => !ANGLES.includes(a.a.key) && !ANGLES.includes(a.b.key))
    .sort((x, y) => Number(lights(y)) - Number(lights(x)) || x.orb - y.orb)
    .slice(0, count)
}

interface Props {
  chart: StarChart
  /** The birthplace's name */
  place: string
  /** The wheel, drawn by the page (it is the 详细 chart's too) */
  wheel: ReactNode
  /** The four elements (SignBalance) */
  balance: ReactNode
  cast: ReturnType<typeof useCasting>
  captions: string[]
  /** Pointing at a body, a house or an aspect lights it in the wheel, as the tables do in 详细 */
  pointAt: {
    planet: (key: string) => Record<string, unknown>
    house: (n: number) => Record<string, unknown>
    aspect: (a: Aspect) => Record<string, unknown>
  }
  /** Whether an aspect is lit */
  lit: (a: Aspect) => boolean
}

export function StarHero({ chart, place, wheel, balance, cast, captions, pointAt, lit }: Props) {
  const t = useT()
  const byKey = (k: ChartPoint['key']) => chart.points.find((p) => p.key === k)!
  const sun = byKey('sun')
  const moon = byKey('moon')
  const asc = byKey('asc')
  const sign = (n: number) => t('{sign}座', { sign: t(SIGNS[n]) })
  // Above the horizon the Sun is in houses 7 to 12
  const daytime = sun.house >= 7
  const between = chart.aspects.filter((a) => !ANGLES.includes(a.a.key) && !ANGLES.includes(a.b.key))
  const tones = (tone: string) => between.filter((a) => a.type.tone === tone).length
  const shown = keyAspects(chart.aspects)

  return (
    <div className="star-hero star-scene" data-stage={cast.stageAttr}>
      {/* At the top left, the chart's name: the Sun's heart and the Ascendant's face */}
      <div className="st-title">
        <span className="ts-kicker" aria-hidden="true">
          Natal Chart
        </span>
        <h3>
          <span className="cast-l1">{t('{sign}之心', { sign: t(SIGNS[sun.sign]) })}</span>
          <span className="cast-l3">{t('{sign}之貌', { sign: t(SIGNS[asc.sign]) })}</span>
        </h3>
        <p>
          {t(place)} · {daytime ? t('昼生') : t('夜生')}
        </p>
      </div>
      {/* At the top right, the four elements */}
      <div className="st-elements cast-l4">{balance}</div>
      <div className="st-wheel">{wheel}</div>
      <CastLine cast={cast} captions={captions} />
      {/* At the foot on the left, the big three, standing as 八字's pillars do */}
      <div className="st-three" aria-label={t('太阳、月亮、上升')}>
        {(
          [
            [sun, t('太阳'), 'SOL', t('核心的你'), 'cast-l1', pointAt.planet('sun')],
            [moon, t('月亮'), 'LUNA', t('内心的你'), 'cast-l2', pointAt.planet('moon')],
            [asc, t('上升'), 'ORIENS', t('外在的你'), 'cast-l3', pointAt.house(1)],
          ] as const
        ).map(([p, label, latin, who, layer, point]) => (
          <div key={latin} className={`st-light ${layer}`} {...point}>
            <i aria-hidden="true">{latin}</i>
            <b aria-hidden="true" className={`el-${SIGN_ELEMENT[p.sign]}`}>
              {SIGN_GLYPHS[p.sign]}
            </b>
            <strong>{sign(p.sign)}</strong>
            {/* 太阳 · 核心的你 on one line; in English, Sun over Who you are */}
            <span>
              <em>{label}</em>
              <span className="st-sep"> · </span>
              {who}
            </span>
          </div>
        ))}
      </div>
      {/* At the foot on the right, the closest aspects */}
      <div className="st-aspects cast-l5">
        <span>{between.length ? t('相位 {count} 条', { count: between.length }) : t('没有主要相位')}</span>
        {between.length > 0 && (
          <small>
            {t('和谐 {n}', { n: tones('soft') })} · {t('紧张 {n}', { n: tones('hard') })} · {t('合相 {n}', { n: tones('major') })}
          </small>
        )}
        <ul>
          {shown.map((a) => (
            <li key={a.a.key + a.b.key} className={`tone-${a.type.tone}${lit(a) ? ' on' : ''}`} {...pointAt.aspect(a)}>
              {t(a.a.name)} <b>{t('{glyph}{name}', { glyph: a.type.glyph, name: t(a.type.name) })}</b> {t(a.b.name)}
              <small>{a.orb.toFixed(1)}°</small>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
