// 七政四余's 运限 (lib/qizhengFortune): the twelve 洞微大限 as chips, the one running marked; under the
// one picked, its years; and for the year picked, the 流年: where the 七政 and 四余 are in the sky then
// (on today's month and day, or today itself this year), each in its natal palace, those come into
// the 命宫 or the 大限's palace marked.
import { useMemo, useState } from 'react'
import { CI, PALACES, QIZHENG_INFO, type QizhengChart } from '../lib/qizheng'
import { limitAt, qizhengLimits, qizhengTransit } from '../lib/qizhengFortune'
import type { QizhengSchoolSettings } from '../lib/qizhengSchools'
import { useT, useTerm } from '../settingsContext'
import { TitleMark } from './Logo'
import { BODY_COLOUR } from './QizhengView'

/** The moment of a year's 流年: today's month and day in that year, at noon there (today itself this year) */
export function flowMoment(year: number, today = new Date()): Date {
  if (year === today.getFullYear()) return new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)
  const d = new Date(year, today.getMonth(), today.getDate(), 12)
  // 29 February in a year without one: the 28th
  return d.getMonth() === today.getMonth() ? d : new Date(year, today.getMonth() + 1, 0, 12)
}

interface Props {
  chart: QizhengChart
  schools: QizhengSchoolSettings
  /** The 流年's year */
  year: number
  onYear: (year: number) => void
}

export function QizhengFortunes({ chart, schools, year, onYear }: Props) {
  const t = useT()
  const term = useTerm()
  const born = chart.utc.getFullYear()
  const sui = (y: number) => y - born + 1
  const limits = useMemo(() => qizhengLimits(chart), [chart])
  const moment = flowMoment(year)
  const running = limitAt(limits, moment)
  const thisYear = new Date().getFullYear()
  const nowLimit = limitAt(limits, new Date())
  const [picked, setPicked] = useState<number | null>(null)
  const shown = limits[picked ?? (running ? limits.indexOf(running) : 0)]
  const flow = useMemo(() => qizhengTransit(chart, schools, moment), [chart, schools, moment.getTime()])
  const years = Array.from({ length: shown.to.getFullYear() - shown.from.getFullYear() + 1 }, (_, i) => shown.from.getFullYear() + i)
  const palace = (k: number) => term(PALACES[k])
  const name = (key: keyof typeof QIZHENG_INFO) => term(QIZHENG_INFO[key].name)
  return (
    <section className="card qz-fortunes" id="qizheng-fortune">
      <h3 className="section-title">
        <TitleMark />
        {term('运限')}
      </h3>
      <p className="muted row-note">
        {t('洞微大限：从命宫起逆行十二宫；命宫的年数按太阳入次的度数，每 3 度一年，再加 10 年（{years} 年），其余各宫年数固定。', {
          years: (limits[0].toAge - limits[0].fromAge).toFixed(1),
        })}
      </p>
      <div className="fortune-row qz-limits" data-sounds="gong">
        {limits.map((l, i) => (
          <button
            key={l.palace}
            className={['fortune', l === shown && 'selected', l === nowLimit && 'current'].filter(Boolean).join(' ')}
            aria-pressed={l === shown}
            onClick={() => {
              setPicked(i)
              // the 流年 follows into the limit picked, if it is not there
              if (!(moment >= l.from && moment < l.to)) onYear(Math.max(l.from.getFullYear(), Math.min(l.to.getFullYear(), thisYear)))
            }}
          >
            <small>{t('{age}岁', { age: sui(l.from.getFullYear()) })}</small>
            <small className="muted">{l.from.getFullYear()}</small>
            <strong>{palace(l.palace)}</strong>
            <small className="muted">{term(CI[l.ci].name)}</small>
          </button>
        ))}
      </div>
      <p className="qz-limit-line">
        <strong>{palace(shown.palace)}</strong>
        {' · '}
        {t('{from}–{to} 年（{a}–{b}岁）', { from: shown.from.getFullYear(), to: shown.to.getFullYear(), a: sui(shown.from.getFullYear()), b: sui(shown.to.getFullYear()) })}
        {' · '}
        {shown.bodies.length ? t('宫内：{bodies}', { bodies: shown.bodies.map((b) => name(b.key)).join(t('、')) }) : t('宫内无星')}
      </p>
      <h4 className="qz-flow-title">
        {term('流年')} · {t('{date}的星空', { date: `${moment.getFullYear()}.${moment.getMonth() + 1}.${moment.getDate()}` })}
      </h4>
      <div className="fortune-row qz-years" data-sounds="shang">
        {years.map((y) => (
          <button key={y} className={['fortune', y === year && 'selected', y === thisYear && 'current'].filter(Boolean).join(' ')} aria-pressed={y === year} onClick={() => onYear(y)}>
            <small>{y}</small>
            <small className="muted">{t('{age}岁', { age: sui(y) })}</small>
          </button>
        ))}
      </div>
      <div className="table-scroll">
        <table className="qz-table qz-flow">
          <thead>
            <tr>
              <th>{t('星曜')}</th>
              <th>{t('宿')}</th>
              <th>{t('次')}</th>
              <th>{t('落本命')}</th>
            </tr>
          </thead>
          <tbody>
            {flow.bodies.map((b) => {
              const mark = b.palace === 0 ? t('入命') : running && b.palace === running.palace ? t('入大限') : ''
              return (
                <tr key={b.key} className={mark ? 'hit' : undefined}>
                  <th scope="row">
                    <span className="qz-table-char" style={{ color: BODY_COLOUR[b.key] }}>
                      {term(QIZHENG_INFO[b.key].char)}
                    </span>{' '}
                    {name(b.key)}
                    {b.retro && <small className="muted"> · {t('逆行')}</small>}
                  </th>
                  <td>{term(b.mansion.name)}</td>
                  <td>{term(CI[b.ci].name)}</td>
                  <td>
                    {palace(b.palace)}
                    {mark && <small className="qz-hit"> {mark}</small>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="muted row-note">
        {t('流年看所选那一年今天这个日子（今年就是今天）天上的七政四余，落在本命盘的哪一宫；太阳、月亮和水金火走得快，木星、土星和罗计一年里变化不大。')}
      </p>
    </section>
  )
}
