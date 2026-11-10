// 天书's 时间轴, 简洁: one life as a long scroll across the page, laid out as 八字's scene is (BaziHero). The
// line runs from birth ninety years on, the 大运 written above it and the 大限 below, the slow planets'
// turning points and the 本命年 as marks on it; a needle stands at this year, and the 大运 and 大限 it falls
// in are lit. Down the right in columns, where this year stands (the 大运, the 大限, the year and the age);
// down the left, who was born; at the foot, what comes next and where the turning points meet.
// 起盘 (useCasting): the line and this year, then the 大运, the 大限, and last the planets and meetings.
import { useEffect, useMemo, useRef } from 'react'
// 站酷小薇, the scene's lettering, as on 八字 (tianshu.css); only the characters shown are fetched
import '@fontsource/zcool-xiaowei/400.css'
import type { BaziChart } from '../lib/bazi'
import { hanDigits, hanNumber } from '../lib/hanNumber'
import { yearOf, type LifeTimeline, type PlanetEventKind } from '../lib/lifeTimeline'
import { useSettings, useT, useTerm } from '../settingsContext'
import { CastLine } from './CastLine'
import { useCasting } from './useCasting'

const PLANET: Record<PlanetEventKind, string> = {
  saturnReturn: '土星回归',
  saturnOpposition: '土星对冲',
  uranusOpposition: '天王星对冲',
  jupiterReturn: '木星回归',
}

/** 《论语·为政》, a life's ages: the line for an age (decoration, brushed faintly in the margin) */
const AGES: [number, string][] = [
  [70, '七十而从心所欲'],
  [60, '六十而耳顺'],
  [50, '五十而知天命'],
  [40, '四十而不惑'],
  [30, '三十而立'],
  [15, '吾十有五而志于学'],
]

// The scroll's drawing, in its own units: the line from X0 to X1 at Y
const W = 1000
const H = 262
const X0 = 46
const X1 = 986
const Y = 142

export function TimelineScene({ line, chart, place }: { line: LifeTimeline; chart: BaziChart; place: string }) {
  const t = useT()
  const term = useTerm()
  const { language } = useSettings()
  const en = language === 'en'
  // Set down the page in columns, numbers are written out (an Arabic one would lie on its side)
  const num = (n: number) => (en ? String(n) : hanNumber(n))
  const yr = (y: number) => (en ? String(y) : hanDigits(y))
  const gap = en ? ' · ' : '　'

  const first = line.birthYear
  const thisYear = Math.min(line.lastYear, Math.max(first, new Date().getFullYear()))
  const now = yearOf(line, thisYear)
  const px = (X1 - X0) / (line.lastYear + 1 - first)
  const x = (year: number) => X0 + (year - first) * px
  const childTo = (line.bazi[0]?.from ?? line.lastYear + 1) - 1
  const decades = useMemo(() => Array.from({ length: Math.floor((line.lastYear - first) / 10) + 1 }, (_, i) => first + i * 10), [first, line.lastYear])

  // What comes next: the next 大运 and 大限, and the slow planets' turning points, the nearest three
  const soon = useMemo(() => {
    const next: { year: number; text: string }[] = []
    const yun = line.bazi.find((s) => s.from > thisYear)
    if (yun) next.push({ year: yun.from, text: t('交{ganzhi}运', { ganzhi: term(yun.label) }) })
    const xian = line.ziwei.find((s) => s.from > thisYear)
    if (xian) next.push({ year: xian.from, text: t('入{palace}限', { palace: term(xian.label) }) })
    for (const p of line.planets) if (!p.minor && p.year > thisYear) next.push({ year: p.year, text: t(PLANET[p.kind]) })
    return next.sort((a, b) => a.year - b.year).slice(0, 3)
  }, [line, thisYear, t, term])
  const meets = line.convergences.filter((c) => c.to >= thisYear).slice(0, 2)
  const SYSTEM = { bazi: t('八字'), ziwei: t('紫微'), planets: t('星盘') }
  // The nearest of the slow planets' turning points, if close, is named by its mark on the line
  const close = line.planets.find((p) => !p.minor && p.year > thisYear && p.year - thisYear <= 3)
  const motto = AGES.find(([age]) => now.age >= age)?.[1]

  const cast = useCasting(line.bazi.map((s) => s.label).join('') + line.ziwei.map((s) => s.label).join('') + first, 4)
  const captions = [
    t('第一重 · 一生 {from}–{to}', { from: first, to: line.lastYear }),
    now.bazi
      ? t('第二重 · 大运 {ganzhi}，{from}–{to}', { ganzhi: term(now.bazi.label), from: now.bazi.from, to: now.bazi.to })
      : t('第二重 · 童限，{year}年起运', { year: childTo + 1 }),
    now.ziwei
      ? t('第三重 · 大限 {palace}，{from}–{to}', { palace: term(now.ziwei.label), from: now.ziwei.from, to: now.ziwei.to })
      : t('第三重 · 大限'),
    t('第四重 · 行星回归与转折重合'),
  ]

  // On a phone the scroll keeps its size and slides sideways, starting at this year
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scroller.current
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (x(thisYear) / W) * el.scrollWidth - el.clientWidth / 2
  }, [first])

  const nx = x(thisYear) + px / 2
  return (
    <div className="tl-scene" data-stage={cast.stageAttr}>
      {/* Down the right: where this year stands */}
      <div className="bz-verse">
        <b className="cast-l2">{now.bazi ? t('{ganzhi}大运', { ganzhi: term(now.bazi.label) }) : term('童限')}</b>
        <span className="cast-l2">
          {now.bazi
            ? (now.baziStarts ? t('今年交运') + gap : '') + t('至{year}', { year: yr(now.bazi.to) })
            : t('{year}年起运', { year: yr(childTo + 1) })}
        </span>
        {now.ziwei && (
          <span className="cast-l3">
            {t('大限{palace}', { palace: term(now.ziwei.label) })}
            {now.ziwei.ganzhi && gap + term(now.ziwei.ganzhi)}
          </span>
        )}
        <small>
          {yr(thisYear)}
          {gap}
          {t('{ganzhi}年', { ganzhi: term(now.ganzhi) })}
          {gap}
          {t('{age}岁', { age: num(now.age) })}
        </small>
      </div>
      {/* Down the left: who was born */}
      <div className="bz-margin">
        <span>
          {chart.gender === '男' ? term('乾造') : term('坤造')}
          {gap}
          {t('属{zodiac}', { zodiac: term(chart.zodiac) })}
        </span>
        <span>{t('{stem}{element}日主', { stem: chart.dayMaster.char, element: t(chart.dayMaster.element) })}</span>
        <span>
          {t('{year}年生', { year: yr(first) })}
          {gap}
          {t(place)}
        </span>
      </div>
      {/* The 大运 now, brushed large and faint over the page, as ink soaked into the paper */}
      {now.bazi && (
        <span className="tl-ink" aria-hidden="true">
          {term(now.bazi.label)}
        </span>
      )}
      {/* In the margin, what 《论语》 says of this age (decoration: faint, and not on a phone) */}
      {!en && motto && (
        <p className="bz-note tl-note" aria-hidden="true">
          <span>子曰</span>
          <span>{motto}</span>
        </p>
      )}

      <div className="tl-scroll-scene" ref={scroller}>
        <svg className="tl-scroll-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('人生时间轴')}>
          <defs>
            <linearGradient id="tl-fade" x1="0" x2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.15" />
              <stop offset={(nx - X0) / (X1 - X0)} stopColor="currentColor" stopOpacity="0.8" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0.15" />
            </linearGradient>
            <radialGradient id="tl-halo">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Where the turning points meet: faint gold bands across the rows */}
          <g className="tl-s-meets cast-l4">
            {line.convergences.map((c) => (
              <rect key={c.from} x={x(c.from)} y={Y - 92} width={(c.to - c.from + 1) * px} height={170} />
            ))}
          </g>
          <ellipse className="tl-s-halo" cx={nx} cy={Y} rx={190} ry={120} fill="url(#tl-halo)" />
          {/* The line, its years and the ages every ten */}
          <g className="tl-s-axis">
            <line className="rule" x1={X0} x2={X1} y1={Y} y2={Y} stroke="url(#tl-fade)" />
            {Array.from({ length: line.lastYear - first + 1 }, (_, i) => {
              const major = i % 10 === 0
              return <line key={i} className={major ? 'major' : undefined} x1={x(first + i)} x2={x(first + i)} y1={Y - (major ? 6 : 2)} y2={Y + (major ? 6 : 2)} />
            })}
            {decades.map((y) => (
              <g key={y} className="tl-s-decade">
                <text x={x(y)} y={Y + 96}>
                  {y}
                </text>
                <text className="age" x={x(y)} y={Y + 112}>
                  {t('{age}岁', { age: y - first + 1 })}
                </text>
              </g>
            ))}
          </g>
          {/* 大运, over the line: 童限 first, faint */}
          <g className="tl-s-yun cast-l2">
            <text className="tl-s-name" x={X0 - 14} y={Y - 36}>
              {term('大运')}
            </text>
            {childTo >= first && (
              <g className="child">
                <path d={`M${x(first) + 2} ${Y - 34} V${Y - 42} H${x(childTo + 1) - 2} V${Y - 34}`} />
                {childTo - first >= 4 && (
                  <text x={(x(first) + x(childTo + 1)) / 2} y={Y - 52}>
                    {term('童限')}
                  </text>
                )}
              </g>
            )}
            {line.bazi.map((s) => {
              const on = s === now.bazi
              return (
                <g key={s.from} className={on ? 'on' : undefined}>
                  {on && <rect x={x(s.from) + 2} y={Y - 42} width={x(s.to + 1) - x(s.from) - 4} height={8} />}
                  <path d={`M${x(s.from) + 2} ${Y - 34} V${Y - 42} H${x(s.to + 1) - 2} V${Y - 34}`} />
                  {s.to - s.from >= 4 && (
                    <text x={(x(s.from) + x(s.to + 1)) / 2} y={Y - (on ? 56 : 52)}>
                      {term(s.label)}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
          {/* 大限, under it */}
          <g className="tl-s-xian cast-l3">
            <text className="tl-s-name" x={X0 - 14} y={Y + 44}>
              {term('大限')}
            </text>
            {line.ziwei.map((s) => {
              const on = s === now.ziwei
              return (
                <g key={s.from} className={on ? 'on' : undefined}>
                  {on && <rect x={x(s.from) + 2} y={Y + 32} width={x(s.to + 1) - x(s.from) - 4} height={8} />}
                  <path d={`M${x(s.from) + 2} ${Y + 32} V${Y + 40} H${x(s.to + 1) - 2} V${Y + 32}`} />
                  {s.to - s.from >= 4 && (
                    <text x={(x(s.from) + x(s.to + 1)) / 2} y={Y + (on ? 64 : 60)}>
                      {term(s.label)}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
          {/* The slow planets on the line, and the 本命年 under the 大限 */}
          <g className="tl-s-planets cast-l4">
            {line.planets.map((p) => (
              <circle key={p.kind + p.year} className={p.kind} cx={x(p.year) + px / 2} cy={Y} r={p.minor ? 2.4 : 3.8}>
                <title>{`${p.year} ${t(PLANET[p.kind])}`}</title>
              </circle>
            ))}
            {line.ownYears.map((y) => (
              <circle key={y} className="own" cx={x(y) + px / 2} cy={Y + 76} r={1.6}>
                <title>{`${y} ${term('本命年')}`}</title>
              </circle>
            ))}
            {close && (
              <text className="tl-s-close" x={x(close.year) + px / 2 + 9} y={Y - 10}>
                {`${close.year} ${t(PLANET[close.kind])}`}
              </text>
            )}
          </g>
          {/* This year: a needle of light */}
          <g className="tl-s-now">
            <line className="glow" x1={nx} x2={nx} y1={Y - 116} y2={Y + 80} />
            <line x1={nx} x2={nx} y1={Y - 116} y2={Y + 80} />
            <rect x={nx - 4} y={Y - 4} width={8} height={8} transform={`rotate(45 ${nx} ${Y})`} />
            <text x={nx} y={Y - 124}>
              {t('此刻')}
            </text>
          </g>
        </svg>
      </div>
      <CastLine cast={cast} captions={captions} />

      {/* At the foot: what comes next, and where the turning points meet */}
      {soon.length > 0 && (
        <div className="tl-soon cast-l4">
          <span>{t('将至')}</span>
          {soon.map((s) => (
            <span key={s.year + s.text}>
              {s.year}
              {gap}
              {s.text}
            </span>
          ))}
        </div>
      )}
      <div className="bz-links tl-meets cast-l4">
        <span>{meets.length ? t('转折重合') : t('此后没有转折重合')}</span>
        {meets.map((c) => (
          <span key={c.from}>
            {c.from === c.to ? c.from : t('{from}–{to}', { from: c.from, to: c.to })}
            {gap}
            {c.systems.map((s) => SYSTEM[s]).join(' · ')}
          </span>
        ))}
      </div>
    </div>
  )
}
