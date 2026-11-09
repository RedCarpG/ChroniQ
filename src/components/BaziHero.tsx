// 天书's 八字, the top of the chart. 简洁 is a scene, laid out as an old star plate is: the gold 罗盘
// (BaziDial) in the middle; the 日主 written down the right in columns (who it is, its image and the
// month it was born in, what the five elements come to); down the left, who was born and the moment of
// it (MomentNote); the four pillars at the foot on the left, the 刑冲合会 on the right. Only in 简洁:
// 详细 is the full table, without the scene.
// 起盘 (useCasting): a chart newly shown comes in a layer at a time — the 日主 alone (written stroke by
// stroke), then the month it was born in, then the four pillars, then the 刑冲合会 between them — a line
// under the dial saying each. On the dial, where today stands in the year (此刻).
import { useMemo, type ReactNode } from 'react'
// 站酷小薇, the scene's lettering (tianshu.css): slender and sharp, as 瘦金 is; only for 天书's 八字,
// and, cut by character ranges, only the characters shown are fetched
import '@fontsource/zcool-xiaowei/400.css'
import { SolarDay } from 'tyme4ts'
import type { BaziChart, ElementName } from '../lib/bazi'
import { baziReading, DAY_MASTER_IMAGE } from '../lib/baziReading'
import { monthBuildOf } from '../lib/dipper'
import { hanNumber } from '../lib/hanNumber'
import { useSettings, useT, useTerm } from '../settingsContext'
import { BaziDial } from './BaziDial'
import { CastLine } from './CastLine'
import { useCasting } from './useCasting'

const EL_VAR: Record<ElementName, string> = { 木: 'var(--wood)', 火: 'var(--fire)', 土: 'var(--earth)', 金: 'var(--metal)', 水: 'var(--water)' }

/** Where today stands in the year, for the dial: the 节 month's branch and how far into it, and the 节气 */
function today() {
  const now = new Date()
  const day = SolarDay.fromYmd(now.getFullYear(), now.getMonth() + 1, now.getDate())
  const month = monthBuildOf(day)
  const span = month.to.day.subtract(month.from.day)
  return { branch: month.name, into: span > 0 ? day.subtract(month.from.day) / span : 0, term: day.getTermDay().getSolarTerm().getName() }
}

export function BaziHero({ chart, moment, place }: { chart: BaziChart; moment?: ReactNode; place: string }) {
  const t = useT()
  const term = useTerm()
  const { language } = useSettings()
  const en = language === 'en'
  // Set down the page in columns, numbers are written out (an Arabic one would lie on its side)
  const num = (n: number) => (en ? String(n) : hanNumber(n))
  const gap = en ? ' · ' : '　'
  const reading = useMemo(() => baziReading(chart, new Date().getFullYear()), [chart])
  const dm = chart.dayMaster
  const month = chart.pillars[1].branch.char
  const tendency = { strong: t('日主偏旺'), weak: t('日主偏弱'), balanced: t('比较平衡') }[reading.tendency]
  const list = (items: string[]) => items.join(t('、'))
  const now = useMemo(today, [])
  const cast = useCasting(chart.pillars.map((p) => p.stem.char + p.branch.char).join('') + chart.gender, 4)
  const linked = chart.relations.length
  const captions = [
    t('第一重 · 日主 {stem}{element}', { stem: dm.char, element: t(dm.element) }),
    t('第二重 · 生于{branch}月，{element}当令', { branch: term(month), element: t(chart.pillars[1].branch.element) }),
    t('第三重 · 四柱 {pillars}', { pillars: chart.pillars.map((p) => p.stem.char + p.branch.char).join(' ') }),
    linked ? t('第四重 · 刑冲合会 {count} 道', { count: linked }) : t('第四重 · 原局没有刑冲合会'),
  ]
  const dial = (
    <div className="bazi-hero-dial">
      <BaziDial pillars={chart.pillars} relations={chart.relations} today={now} />
    </div>
  )
  const most =
    t('{elements}最多{count}', { elements: list(reading.most.map((m) => t(m.element))), count: num(reading.most[0].count) }) +
    gap +
    (reading.missing.length ? t('无{elements}', { elements: list(reading.missing.map((e) => t(e))) }) : t('五行俱全'))

  return (
    <div className="bazi-hero bazi-scene" data-stage={cast.stageAttr}>
      {/* Down the right: the 日主, its image and month, what the elements come to; the birth, small */}
      <div className="bz-verse">
        <b className="cast-l1">{t('{stem}{element}日主', { stem: dm.char, element: t(dm.element) })}</b>
        <span className="cast-l2">
          {t(DAY_MASTER_IMAGE[dm.char]).split(/[：:]/)[0]}
          {gap}
          {t('生于{branch}月', { branch: term(month) })}
        </span>
        <span className="cast-l4">
          {most}
          {gap}
          {tendency}
        </span>
        <small>
          {term(chart.lunarText)}
          {gap}
          {t(place)}
        </small>
      </div>
      {/* Down the left: who was born, and the moment of it */}
      <div className="bz-margin">
        <span>
          {chart.gender === '男' ? term('乾造') : term('坤造')}
          {gap}
          {t('属{zodiac}', { zodiac: term(chart.zodiac) })}
        </span>
        {moment}
      </div>
      {dial}
      <CastLine cast={cast} captions={captions} />
      <div className="bz-pillars cast-l3" aria-label={t('四柱')}>
        {chart.pillars.map((p, i) => (
          <div key={p.label} className={i === 2 ? 'dm' : undefined}>
            <small>{term(p.label)}</small>
            <b style={{ color: EL_VAR[p.stem.element] }}>{p.stem.char}</b>
            <b style={{ color: EL_VAR[p.branch.element] }}>{p.branch.char}</b>
          </div>
        ))}
      </div>
      <div className="bz-links cast-l4">
        <span>{linked ? t('刑冲合会{count}道', { count: num(linked) }) : t('原局没有刑冲合会')}</span>
        {linked > 0 && <span>{chart.relations.map((r) => term(r.text)).join(' · ')}</span>}
      </div>
    </div>
  )
}
