import { useMemo } from 'react'
import type { BaziChart } from '../lib/bazi'
import { DAY_MASTER_IMAGE, GROUP_NOTE, TEN_STAR_NOTE, baziReading } from '../lib/baziReading'
import { useT, useTerm } from '../settingsContext'
import { InfoTip } from './InfoTip'

/** 白话解读: the chart read out in plain words, under the chart, how each was reached in its tip */
export function BaziReadingCard({ chart }: { chart: BaziChart }) {
  const t = useT()
  const term = useTerm()
  const year = new Date().getFullYear()
  const r = useMemo(() => baziReading(chart, year), [chart, year])
  const list = (items: string[]) => items.join(t('、'))
  const tendency = {
    strong: t('日主偏旺'),
    weak: t('日主偏弱'),
    balanced: t('比较平衡'),
  }[r.tendency]
  return (
    <section className="card bazi-reading" id="bazi-reading">
      <h3 className="section-title">
        <InfoTip label={t('白话解读')} title={t('白话解读')}>
          <span>{t('按固定规则从命盘生成，是常见的传统说法，不是预测，仅供参考。')}</span>
        </InfoTip>
      </h3>
      <dl className="reading-list">
        <dt>{term('日主')}</dt>
        <dd>
          <strong>
            {r.dayMaster.char}
            {t(r.dayMaster.element)}
          </strong>{' '}
          {t(DAY_MASTER_IMAGE[r.dayMaster.char])}
        </dd>
        <dt>{t('五行')}</dt>
        <dd>
          <InfoTip
            label={
              <>
                {r.most.length > 1
                  ? t('{elements}最多（各 {count} 个）', { elements: list(r.most.map((m) => t(m.element))), count: r.most[0].count })
                  : t('{element}最多（{count} 个）', { element: t(r.most[0].element), count: r.most[0].count })}
                {r.missing.length > 0 ? t('，没有{elements}', { elements: list(r.missing.map((e) => t(e))) }) : t('，五行都有')}
              </>
            }
            title={t('五行')}
          >
            <span>{t('只数四柱的八个字，不算藏干。藏干里可能有这些五行，「缺」不等于不好。')}</span>
          </InfoTip>
        </dd>
        <dt>{term('根气')}</dt>
        <dd>
          <InfoTip
            label={
              r.roots.length > 0
                ? list(r.roots.map((root) => t('{pillar}{stem}（{qi}）', { pillar: term(root.pillar), stem: root.stem, qi: term(root.qi) })))
                : t('地支藏干里没有同类，日主无根')
            }
            title={term('根气')}
          >
            <span>{t('日主在地支藏干里的同类五行。本气的根最深，中气次之，余气最浅。')}</span>
          </InfoTip>
        </dd>
        <dt>{t('强弱')}</dt>
        <dd>
          <InfoTip
            label={
              <>
                {r.inSeason ? t('生在{element}月，得时令', { element: t(r.monthElement) }) : t('生在{element}月，不得时令', { element: t(r.monthElement) })}
                {t('；')}
                {tendency}
              </>
            }
            title={t('强弱')}
          >
            <span>{t('助力 {support}、消耗 {drain}，相差 2 以上才算偏旺或偏弱。', { support: r.support, drain: r.drain })}</span>
            <span className="muted">
              {t('算法：其余七个字各算 1 份，月支算 3 份，生助日主的算助力，其余算消耗；再加上中气的根 1 份、余气的根 0.5 份。这是简化的算法，没有考虑合化、调候等，各派判断不一。')}
            </span>
          </InfoTip>
        </dd>
        {r.groups.length > 0 && (
          <>
            <dt>{term('十神')}</dt>
            <dd>
              {r.groups.map((g) => (
                <span key={g.group} className="reading-line">
                  <InfoTip label={<strong>{term(g.group)}</strong>} title={term(g.group)} className="plain">
                    <span>{t('在其余三个天干和四个地支的本气里出现 {count} 次，是分量最重的类别之一。', { count: g.count })}</span>
                  </InfoTip>{' '}
                  {t(GROUP_NOTE[g.group])}
                </span>
              ))}
            </dd>
          </>
        )}
        {r.decade && (
          <>
            <dt>{term('大运')}</dt>
            <dd>
              <strong>{term(r.decade.ganzhi)}</strong> <span className="muted">{t('{from}–{to}', { from: r.decade.from, to: r.decade.to })}</span>
              {r.decade.tenStar && (
                <span className="reading-line">
                  {t('天干是{star}。', { star: term(r.decade.tenStar) })}
                  {t(TEN_STAR_NOTE[r.decade.tenStar])}
                </span>
              )}
            </dd>
          </>
        )}
      </dl>
    </section>
  )
}
