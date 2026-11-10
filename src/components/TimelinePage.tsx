import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
// 马善政, the brush hand for the scene's faint ink and marginal note (tianshu.css); only the characters shown are fetched
import '@fontsource/ma-shan-zheng/400.css'
import { buildBazi, type BaziInput } from '../lib/bazi'
import { buildLifeTimeline, yearOf, type PlanetEventKind, type TimelineSystem } from '../lib/lifeTimeline'
import { DEFAULT_PLACE } from '../lib/place'
import type { SchoolSettings } from '../lib/schools'
import type { ZiweiSchoolSettings } from '../lib/ziweiSchools'
import { useSettings, useT, useTerm } from '../settingsContext'
import { BirthChip } from './BirthForm'
import { ChartViewSwitch, useChartFull } from './ChartViewSwitch'
import type { Page } from './PageMenu'
import { smoothUpdate } from './smoothUpdate'
import { TimelineScene } from './TimelineScene'

/** A year's width on the line (px): wider on a touch screen, so a finger can pick one */
const YEAR_W = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches ? 24 : 15

const PLANET_EVENT: Record<PlanetEventKind, string> = {
  saturnReturn: '土星回归',
  saturnOpposition: '土星对冲',
  uranusOpposition: '天王星对冲',
  jupiterReturn: '木星回归',
}
const PLANET_NOTE: Record<PlanetEventKind, string> = {
  saturnReturn: '约每 29 年一次，传统上看作责任与成熟的关口',
  saturnOpposition: '土星走到与出生时相对的位置，约在两次回归之间',
  uranusOpposition: '约 40 岁前后，一生一次，常说的「中年转变」',
  jupiterReturn: '约每 12 年一次，传统上看作扩展的新周期',
}
const SYSTEM: Record<TimelineSystem, string> = { bazi: '八字', ziwei: '紫微', planets: '星盘' }

/**
 * 人生时间轴: the chart on screen's 大运, 大限 and slow-planet turning points on one line, with the
 * years where several meet picked out. The line scrolls sideways, starting at this year. In 天书, 简洁
 * is a scene of its own (TimelineScene), the life as one scroll; 详细 is the board and its tables.
 */
export function TimelinePage({
  input,
  schools,
  ziweiSchools,
  onOpen,
}: {
  input: BaziInput
  schools: SchoolSettings
  ziweiSchools: ZiweiSchoolSettings
  onOpen: (page: Page) => void
}) {
  const t = useT()
  const term = useTerm()
  const line = useMemo(() => buildLifeTimeline(input, schools, ziweiSchools), [input, schools, ziweiSchools])
  // 简洁 / 详细, one choice with the charts'; 天书's 简洁 is the scene, without the board
  const tianshu = useSettings().uiStyle === 'tianshu'
  const [fullChart, toggleFullChart] = useChartFull()
  const scene = tianshu && !fullChart
  const chart = useMemo(() => (scene ? buildBazi(input, schools) : null), [scene, input, schools])
  const thisYear = new Date().getFullYear()
  const first = line.birthYear
  const clamp = (y: number) => Math.min(line.lastYear, Math.max(first, y))
  const [picked, setPicked] = useState(() => clamp(thisYear))
  // Another chart: its own line, from this year
  useEffect(() => setPicked(clamp(thisYear)), [first])
  const info = yearOf(line, clamp(picked))
  const x = (year: number) => (year - first) * YEAR_W
  const width = (from: number, to: number) => (to - from + 1) * YEAR_W
  const years = useMemo(() => Array.from({ length: line.lastYear - first + 1 }, (_, i) => first + i), [first, line.lastYear])

  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = Math.max(0, x(clamp(thisYear)) - el.clientWidth / 2)
    // the board is there again on coming back from the scene
  }, [first, scene])

  const spanButton = (s: { from: number; to: number; label: string; ganzhi?: string }, kind: string, text: string) => (
    <button
      key={s.from}
      type="button"
      className={`tl-span ${kind}${s.from <= info.year && info.year <= s.to ? ' on' : ''}`}
      style={{ left: x(s.from), width: width(s.from, s.to) }}
      title={t('{from}–{to}', { from: s.from, to: s.to })}
      data-sound="shang"
      onClick={() => setPicked(s.from)}
    >
      {text}
    </button>
  )

  const viewSwitch = tianshu && (
    <>
      {/* 天书: the birth, opening the 命盘 drawer, by the switch */}
      <BirthChip input={input} />
      <ChartViewSwitch full={fullChart} onToggle={() => smoothUpdate('chart-view', toggleFullChart)} className="natal-view" />
    </>
  )

  if (scene && chart)
    return (
      <div className="timeline-page">
        <section className="card scene" aria-label={t('人生时间轴')}>
          <header className="tl-head">{viewSwitch}</header>
          <TimelineScene line={line} chart={chart} place={(input.place ?? DEFAULT_PLACE).name} />
        </section>
      </div>
    )

  return (
    <div className="timeline-page">
      <section className="card">
        <header className="tl-head">
          <h2 className="section-title">{t('人生时间轴')}</h2>
          {!tianshu && (
            <span className="muted">
              {t('{y}年{m}月{d}日出生 · 可在左侧「命盘」里换一张', { y: input.year, m: input.month, d: input.day })}
            </span>
          )}
          {viewSwitch}
        </header>
        <div className="tl-board">
          <div className="tl-names" aria-hidden="true">
            <span className="tl-name-axis" />
            <span>{term('大运')}</span>
            <span>{term('大限')}</span>
            <span>{t('行星')}</span>
            <span>{term('本命年')}</span>
          </div>
          <div className="tl-scroll" ref={scroller} tabIndex={0} aria-label={t('人生时间轴')}>
            <div className="tl-lines" style={{ '--tl-w': `${width(first, line.lastYear)}px` } as CSSProperties}>
              {line.convergences.map((c) => (
                <button
                  key={c.from}
                  type="button"
                  className={`tl-band${c.from <= info.year && info.year <= c.to ? ' on' : ''}`}
                  style={{ left: x(c.from), width: width(c.from, c.to) }}
                  aria-label={t('转折重合 {from}–{to}', { from: c.from, to: c.to })}
                  onClick={() => setPicked(c.from)}
                />
              ))}
              {thisYear >= first && thisYear <= line.lastYear && <span className="tl-now" style={{ left: x(thisYear) + YEAR_W / 2 }} aria-hidden="true" />}
              <span className="tl-picked" style={{ left: x(info.year) }} aria-hidden="true" />
              <div className="tl-row tl-axis">
                {years.map((y) => (
                  <button key={y} type="button" className={`tl-year${(y - first) % 10 === 0 ? ' major' : ''}`} style={{ left: x(y) }} aria-label={t('{y}年', { y })} onClick={() => setPicked(y)}>
                    {(y - first) % 10 === 0 && (
                      <span>
                        {y}
                        <small>{t('{age}岁', { age: y - first + 1 })}</small>
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="tl-row">{line.bazi.map((s) => spanButton(s, 'bazi', term(s.label)))}</div>
              <div className="tl-row">{line.ziwei.map((s) => spanButton(s, 'ziwei', term(s.label)))}</div>
              <div className="tl-row">
                {line.planets.map((p) => (
                  <button
                    key={p.kind + p.year}
                    type="button"
                    className={`tl-mark ${p.kind}${p.year === info.year ? ' on' : ''}`}
                    style={{ left: x(p.year) + YEAR_W / 2 }}
                    title={`${p.year} ${t(PLANET_EVENT[p.kind])}`}
                    aria-label={`${p.year} ${t(PLANET_EVENT[p.kind])}`}
                    data-sound="shang"
                    onClick={() => setPicked(p.year)}
                  />
                ))}
              </div>
              <div className="tl-row">
                {line.ownYears.map((y) => (
                  <button key={y} type="button" className={`tl-own${y === info.year ? ' on' : ''}`} style={{ left: x(y) + YEAR_W / 2 }} aria-label={`${y} ${term('本命年')}`} onClick={() => setPicked(y)} />
                ))}
              </div>
            </div>
          </div>
        </div>
        <ul className="cal-legend tl-legend" aria-label={t('图例')}>
          <li>
            <i className="tl-key-band" />
            {t('转折重合')}
          </li>
          <li>
            <i className="tl-key-major" />
            {t('土星、天王星')}
          </li>
          <li>
            <i className="tl-key-minor" />
            {t('木星回归')}
          </li>
          <li>
            <i className="tl-key-now" />
            {t('今年')}
          </li>
        </ul>
      </section>

      <div className="tl-below">
        <section className="card tl-year-card">
          <h3 className="section-title">
            {t('{y}年', { y: info.year })} <span className="muted">{term(info.ganzhi)} · {t('{age}岁', { age: info.age })}</span>
          </h3>
          <dl className="kv">
            {info.bazi && (
              <>
                <dt>{term('大运')}</dt>
                <dd>
                  {term(info.bazi.label)}
                  <span className="muted"> {t('{from}–{to}', { from: info.bazi.from, to: info.bazi.to })}</span>
                  {info.baziStarts && <b className="tl-starts">{t('今年交运')}</b>}
                </dd>
              </>
            )}
            {info.ziwei && (
              <>
                <dt>{term('大限')}</dt>
                <dd>
                  {term(info.ziwei.label)}
                  {info.ziwei.ganzhi && ` · ${term(info.ziwei.ganzhi)}`}
                  <span className="muted"> {t('{from}–{to}', { from: info.ziwei.from, to: info.ziwei.to })}</span>
                  {info.ziweiStarts && <b className="tl-starts">{t('今年交运')}</b>}
                </dd>
              </>
            )}
          </dl>
          {info.own && <p className="tl-note">{term('本命年')}</p>}
          {info.planets.map((p) => (
            <p key={p.kind} className="tl-note">
              <strong>{t(PLANET_EVENT[p.kind])}</strong>
              <span className="muted"> {t(PLANET_NOTE[p.kind])}</span>
            </p>
          ))}
          <div className="tl-links">
            <button type="button" className="ghost" onClick={() => onOpen('bazi')}>
              {t('看八字 →')}
            </button>
            <button type="button" className="ghost" onClick={() => onOpen('ziwei')}>
              {t('看紫微 →')}
            </button>
            <button type="button" className="ghost" onClick={() => onOpen('star')}>
              {t('看星盘 →')}
            </button>
          </div>
        </section>

        <section className="card tl-meet-card">
          <h3 className="section-title">{t('转折重合的年份')}</h3>
          <ul>
            {line.convergences
              .filter((c) => c.to >= thisYear)
              .slice(0, 8)
              .map((c) => (
                <li key={c.from}>
                  <button type="button" data-sound="shang" className={c.from <= info.year && info.year <= c.to ? 'on' : undefined} onClick={() => setPicked(c.from)}>
                    <strong>{c.from === c.to ? c.from : `${c.from}–${c.to}`}</strong>
                    <span className="muted">{c.systems.map((s) => t(SYSTEM[s])).join(' · ')}</span>
                  </button>
                </li>
              ))}
          </ul>
          <small className="muted">
            {t('大运和大限都是十年一换，步调可能一直相近，所以重合未必特别；这些都是传统的说法，仅供参考。')}
          </small>
        </section>
      </div>
    </div>
  )
}
