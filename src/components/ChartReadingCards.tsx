import { useMemo } from 'react'
import { ASPECT_INFO, HOUSE_INFO, PLANET_INFO, SIGN_INFO } from '../lib/astroInfo'
import { ELEMENT_NAME, SIGNS, type Element, type StarChart } from '../lib/astrology'
import { starReading, ziweiReading } from '../lib/chartReadings'
import type { ZiweiChart } from '../lib/ziwei'
import { ZONES, type MansionZone } from '../lib/mansions'
import { CI, QIZHENG_INFO, SEVEN, type QizhengChart } from '../lib/qizheng'
import { MUTAGEN_INFO, STAR_INFO } from '../lib/ziweiInfo'
import { useT, useTerm } from '../settingsContext'
import { InfoTip } from './InfoTip'

function ReadingTitle({ id }: { id: string }) {
  const t = useT()
  return (
    <h3 className="section-title" id={`${id}-title`}>
      <InfoTip label={t('白话解读')} title={t('白话解读')}>
        <span>{t('按固定规则从命盘生成，是常见的传统说法，不是预测，仅供参考。')}</span>
      </InfoTip>
    </h3>
  )
}

/** 白话解读 for 紫微: the 命宫 and its stars, the 生年四化 and the 大限 now running */
export function ZiweiReadingCard({ chart }: { chart: ZiweiChart }) {
  const t = useT()
  const term = useTerm()
  const year = new Date().getFullYear()
  const r = useMemo(() => ziweiReading(chart, year), [chart, year])
  return (
    <section className="card chart-reading" id="ziwei-reading">
      <ReadingTitle id="ziwei-reading" />
      <dl className="reading-list">
        <dt>{term('命宫')}</dt>
        <dd>
          {r.soulStars.length === 0 && t('十二宫中没有主星。')}
          {r.borrowed && r.soulStars.length > 0 && (
            <InfoTip label={t('命宫无主星，借对宫的星来看')} title={term('命宫')}>
              <span>{t('命宫没有主星时，传统上借对宫的主星来看，力量相对弱一些。')}</span>
            </InfoTip>
          )}
          {r.soulStars.map((s) => (
            <span key={s.name} className="reading-line">
              <strong>{term(s.name)}</strong>
              {s.brightness && <span className="muted"> {term(s.brightness)}</span>} {STAR_INFO[s.name]?.nature}
            </span>
          ))}
        </dd>
        <dt>{term('五行局')}</dt>
        <dd>
          <InfoTip label={term(r.fiveElementsClass)} title={term('五行局')}>
            <span>{t('由命宫干支定出，决定起大限的岁数和紫微星的位置。')}</span>
          </InfoTip>
          {r.bodyPalace && <span className="muted"> · {t('身宫在{palace}', { palace: term(r.bodyPalace) })}</span>}
        </dd>
        {r.mutagens.length > 0 && (
          <>
            <dt>{term('四化')}</dt>
            <dd>
              {r.mutagens.map((m) => (
                <span key={m.mutagen} className="reading-line">
                  <InfoTip label={<strong>{term(`化${m.mutagen}`)}</strong>} title={term(`化${m.mutagen}`)} className="plain">
                    <span>{MUTAGEN_INFO[m.mutagen]}</span>
                  </InfoTip>{' '}
                  {t('{star}，在{palace}', { star: term(m.star), palace: term(m.palace) })}
                </span>
              ))}
            </dd>
          </>
        )}
        {r.decade && (
          <>
            <dt>{term('大限')}</dt>
            <dd>
              <strong>{term(r.decade.palace)}</strong> <span className="muted">{term(r.decade.ganzhi)} · {t('{from}–{to}', { from: r.decade.from, to: r.decade.to })}</span>
              {r.decade.stars.length > 0 && <span className="reading-line">{t('这十年看的宫里有{stars}。', { stars: r.decade.stars.map(term).join(t('、')) })}</span>}
            </dd>
          </>
        )}
      </dl>
    </section>
  )
}

/** 白话解读 for 星盘: the Sun, Moon and Ascendant, the balance of the planets and the tightest aspects */
export function StarReadingCard({ chart }: { chart: StarChart }) {
  const t = useT()
  const r = useMemo(() => starReading(chart), [chart])
  const signName = (sign: number) => t('{sign}座', { sign: t(SIGNS[sign]) })
  const list = (items: string[]) => items.join(t('、'))
  const line = (label: string, tip: string, sign: number) => (
    <>
      <dt>
        <InfoTip label={label} title={label}>
          <span>{tip}</span>
        </InfoTip>
      </dt>
      <dd>
        <strong>{signName(sign)}</strong> {SIGN_INFO[sign]}
      </dd>
    </>
  )
  return (
    <section className="card chart-reading" id="star-reading">
      <ReadingTitle id="star-reading" />
      <dl className="reading-list">
        {line(t('太阳'), PLANET_INFO.sun, r.sun.sign)}
        {line(t('月亮'), PLANET_INFO.moon, r.moon.sign)}
        {line(t('上升'), PLANET_INFO.asc, r.ascSign)}
        <dt>{t('元素')}</dt>
        <dd>
          <InfoTip
            label={t('{elements}最多（{count} 颗）', { elements: list(r.elements.map((e) => t(ELEMENT_NAME[e.key as Element]))), count: r.elements[0].count })}
            title={t('元素')}
          >
            <span>{t('按太阳到冥王星十颗星计，不含交点、上升和天顶')}</span>
          </InfoTip>
          {t('；')}
          {list(r.modalities.map((m) => t('{modality}星座', { modality: t(m.key) })))} {t('{count} 颗', { count: r.modalities[0].count })}
        </dd>
        {r.crowded.length > 0 && (
          <>
            <dt>{t('宫位')}</dt>
            <dd>
              {r.crowded.map((c) => (
                <span key={c.house} className="reading-line">
                  <strong>{t('第{n}宫', { n: c.house })}</strong> {HOUSE_INFO[c.house - 1]}
                  <span className="muted"> · {list(c.planets.map((p) => t(p.name)))}</span>
                </span>
              ))}
            </dd>
          </>
        )}
        {r.aspects.length > 0 && (
          <>
            <dt>{t('相位')}</dt>
            <dd>
              {r.aspects.map((a) => (
                <span key={`${a.a.key}-${a.b.key}`} className="reading-line">
                  {t(a.a.name)} {a.type.glyph} {t(a.b.name)}{' '}
                  <InfoTip label={t(a.type.name)} title={t(a.type.name)}>
                    <span>{ASPECT_INFO[a.type.key]}</span>
                  </InfoTip>
                  <span className="muted"> {t('差 {orb}°', { orb: a.orb.toFixed(1) })}</span>
                </span>
              ))}
            </dd>
          </>
        )}
      </dl>
    </section>
  )
}

/** What each 四象 stands for, in the common telling */
const ZONE_NOTE: Record<MansionZone, string> = {
  east: '应春，主生发',
  south: '应夏，主繁盛',
  west: '应秋，主收敛',
  north: '应冬，主收藏',
}

/** 白话解读 for 七政四余: the 命宫, where the Sun and Moon are, and which quarter of the sky the 七政 gather in */
export function QizhengReadingCard({ chart }: { chart: QizhengChart }) {
  const t = useT()
  const term = useTerm()
  const by = (key: string) => chart.bodies.find((b) => b.key === key)!
  const ming = CI[chart.mingCi]
  const inMing = chart.bodies.filter((b) => b.palace === 0)
  const counts = (['east', 'north', 'west', 'south'] as MansionZone[])
    .map((zone) => ({ zone, n: SEVEN.filter((k) => by(k).mansion.zone === zone).length }))
    .sort((a, b) => b.n - a.n)
  const light = (label: string, key: 'sun' | 'moon') => {
    const b = by(key)
    return (
      <>
        <dt>{label}</dt>
        <dd>
          <strong>{term(b.mansion.name)}</strong> {term(b.mansion.animal)} · {term(ZONES[b.mansion.zone].name)}，{t(ZONE_NOTE[b.mansion.zone])}
        </dd>
      </>
    )
  }
  return (
    <section className="card chart-reading" id="qizheng-reading">
      <ReadingTitle id="qizheng-reading" />
      <dl className="reading-list">
        <dt>{term('命宫')}</dt>
        <dd>
          <strong>{t('{ci}之次', { ci: term(ming.name) })}</strong> {t('（{branch}宫），命度在{m}宿', { branch: term(ming.branch), m: term(chart.ascMansion.char) })}
          {t('；')}
          {inMing.length
            ? t('{bodies}守命，命宫的性情多从这几颗星看', { bodies: inMing.map((b) => term(QIZHENG_INFO[b.key].name)).join(t('、')) })
            : t('命宫无星守，传统上看命宫之主和对宫')}
        </dd>
        {light(term('日躔'), 'sun')}
        {light(term('月离'), 'moon')}
        <dt>{term('七政')}</dt>
        <dd>
          {t('七政有 {n} 颗在{zone}', { n: counts[0].n, zone: term(ZONES[counts[0].zone].name) })}
          {t('，')}
          {t(ZONE_NOTE[counts[0].zone])}
        </dd>
      </dl>
    </section>
  )
}
