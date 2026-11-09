// 天书's 八字, the top of the chart: the dial (BaziDial) as the scene, the 日主 and the month it was
// born in as its title, then (简洁) the four pillars in large glowing characters and the 五行 counted in
// dots, as the 河图 counts; a line of what it comes to. 详细 keeps the full table under it instead.
// 起盘 (useCasting): a chart newly shown comes in a layer at a time — the 日主 alone, then the month it
// was born in, then the four pillars, then the 刑冲合会 between them — a line under the dial saying each.
import { useMemo } from 'react'
import { ELEMENTS, type BaziChart, type ElementName } from '../lib/bazi'
import { baziReading } from '../lib/baziReading'
import { useT, useTerm } from '../settingsContext'
import { BaziDial } from './BaziDial'
import { CastLine } from './CastLine'
import { useCasting } from './useCasting'

const EL_VAR: Record<ElementName, string> = { 木: 'var(--wood)', 火: 'var(--fire)', 土: 'var(--earth)', 金: 'var(--metal)', 水: 'var(--water)' }

export function BaziHero({ chart, full }: { chart: BaziChart; full: boolean }) {
  const t = useT()
  const term = useTerm()
  const reading = useMemo(() => baziReading(chart, new Date().getFullYear()), [chart])
  const dm = chart.dayMaster
  const month = chart.pillars[1].branch.char
  const tendency = { strong: t('日主偏旺'), weak: t('日主偏弱'), balanced: t('比较平衡') }[reading.tendency]
  const counted = [...ELEMENTS].sort((a, b) => chart.elementCount[b] - chart.elementCount[a])
  const list = (items: string[]) => items.join(t('、'))
  const cast = useCasting(chart.pillars.map((p) => p.stem.char + p.branch.char).join('') + chart.gender, 4)
  const linked = chart.relations.length
  const captions = [
    t('第一重 · 日主 {stem}{element}', { stem: dm.char, element: t(dm.element) }),
    t('第二重 · 生于{branch}月，{element}当令', { branch: term(month), element: t(chart.pillars[1].branch.element) }),
    t('第三重 · 四柱 {pillars}', { pillars: chart.pillars.map((p) => p.stem.char + p.branch.char).join(' ') }),
    linked ? t('第四重 · 刑冲合会 {count} 道', { count: linked }) : t('第四重 · 原局没有刑冲合会'),
  ]
  return (
    <div className="bazi-hero" data-stage={cast.stageAttr}>
      <div className="bazi-hero-dial">
        <BaziDial pillars={chart.pillars} relations={chart.relations} />
      </div>
      <div className="bazi-hero-title">
        <span className="ts-kicker" aria-hidden="true">
          Day Master
        </span>
        <h3>{t('{stem}{element} · 生于{branch}月', { stem: dm.char, element: t(dm.element), branch: term(month) })}</h3>
        <CastLine cast={cast} captions={captions} />
      </div>
      {!full && (
        <>
          <div className="bazi-hero-pillars cast-l3">
            {chart.pillars.map((p, i) => (
              <div key={p.label} className={i === 2 ? 'dm' : undefined}>
                <small>{i === 2 ? term('日主') : term(p.label)}</small>
                <span className="ten">{i === 2 ? `${dm.char}${t(dm.element)}` : term(p.stem.tenStar ?? '')}</span>
                <b style={{ color: EL_VAR[p.stem.element] }}>{p.stem.char}</b>
                <b style={{ color: EL_VAR[p.branch.element] }}>{p.branch.char}</b>
                <span className="hid">
                  {p.hidden.map((h) => (
                    <span key={h.char}>
                      {h.char} {term(h.tenStar ?? '')}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <div className="bazi-hero-wuxing cast-l4" aria-label={t('五行')}>
            {counted.map((e) => (
              <div key={e} className={chart.elementCount[e] ? undefined : 'none'} style={{ color: EL_VAR[e] }}>
                <b>{e}</b>
                <i aria-label={String(chart.elementCount[e])}>{chart.elementCount[e] ? '●'.repeat(chart.elementCount[e]) : '○'}</i>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="bazi-hero-lede cast-l4">
        {reading.most.length > 1
          ? t('{elements}最多（各 {count} 个）', { elements: list(reading.most.map((m) => t(m.element))), count: reading.most[0].count })
          : t('{element}最多（{count} 个）', { element: t(reading.most[0].element), count: reading.most[0].count })}
        {reading.missing.length > 0 ? t('，没有{elements}', { elements: list(reading.missing.map((e) => t(e))) }) : t('，五行都有')}
        {t('；')}
        <b>{tendency}</b>
      </p>
      {!full && <p className="bazi-hero-more">{t('纳音、星运、自坐、空亡、神煞、五星和胎元命宫在「详细」里')}</p>}
    </div>
  )
}
