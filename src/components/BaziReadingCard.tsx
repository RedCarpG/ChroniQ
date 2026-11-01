import { useMemo } from 'react'
import type { BaziChart } from '../lib/bazi'
import { DAY_MASTER_IMAGE, GROUP_NOTE, TEN_STAR_NOTE, baziReading } from '../lib/baziReading'
import { useT, useTerm } from '../settingsContext'

/** 白话解读: the chart read out in plain words, under the chart */
export function BaziReadingCard({ chart }: { chart: BaziChart }) {
  const t = useT()
  const term = useTerm()
  const year = new Date().getFullYear()
  const r = useMemo(() => baziReading(chart, year), [chart, year])
  const list = (items: string[]) => items.join(t('、'))
  const tendency = {
    strong: t('助力较多，日主偏旺'),
    weak: t('消耗较多，日主偏弱'),
    balanced: t('助力和消耗接近，比较平衡'),
  }[r.tendency]
  return (
    <section className="card bazi-reading" id="bazi-reading">
      <h3 className="section-title">{t('白话解读')}</h3>
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
          {r.most.length > 1
            ? t('八个字里{elements}最多（各 {count} 个）', { elements: list(r.most.map((m) => t(m.element))), count: r.most[0].count })
            : t('八个字里{element}最多（{count} 个）', { element: t(r.most[0].element), count: r.most[0].count })}
          {r.missing.length > 0
            ? t('，没有{elements}。这只是看得见的八个字，藏干里可能有，「缺」不等于不好。', { elements: list(r.missing.map((e) => t(e))) })
            : t('，五行都有。')}
        </dd>
        <dt>{t('强弱')}</dt>
        <dd>
          {r.inSeason ? t('生在{element}月，得时令之助。', { element: t(r.monthElement) }) : t('生在{element}月，不得时令。', { element: t(r.monthElement) })}
          {t('粗略数下来，助力 {support}、消耗 {drain}：', { support: r.support, drain: r.drain })}
          {tendency}
          {t('。这是简化的算法，各派判断不一。')}
        </dd>
        {r.groups.length > 0 && (
          <>
            <dt>{term('十神')}</dt>
            <dd>
              {r.groups.map((g) => (
                <span key={g.group} className="reading-line">
                  <strong>{term(g.group)}</strong> {t(GROUP_NOTE[g.group])}
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
      <small className="muted">{t('按固定规则从命盘生成，是常见的传统说法，不是预测，仅供参考。')}</small>
    </section>
  )
}
