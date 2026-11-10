// 七政四余: Chinese astrology of the real sky. 天书's 简洁 is a scene, laid out as 八字's and 紫微's are
// (.bazi-scene, .bz-*): in the middle a round chart of the sky (QizhengWheel), the 28 mansions at their
// true widths, lit in their quarter's colour where a body is, the 十二次 faint on the rim, the 七政 as
// lights with threads to the heart and the 四余 dashed; down the right, the verse (日躔X宿, 月离Y宿);
// down the left, who was born; the 七政 at the foot on the left, standing as 八字's pillars do; the 四余 at
// the foot on the right. 详细 (and the classic look) is the table of every body, with the school notes.
// 起盘 (useCasting, four layers): the Sun, the Moon, the five planets, the 四余. The depth (useParallax)
// moves the dial by its .bazi-hero-dial, as on 八字.
import '@fontsource/zcool-xiaowei/400.css'
import { Suspense, lazy, useMemo } from 'react'
import type { BaziInput } from '../lib/bazi'
import { hanNumber } from '../lib/hanNumber'
import { ZONES } from '../lib/mansions'
import { DEFAULT_PLACE } from '../lib/place'
import { buildQizheng, CI, FOUR, mansionArcs, PALACES, QIZHENG_INFO, SEVEN, type QizhengBody, type QizhengChart, type QizhengKey } from '../lib/qizheng'
import { QIZHENG_SCHOOLS, type QizhengSchoolSettings } from '../lib/qizhengSchools'
import { qizhengPrompt } from '../lib/ai/prompts'
import { useSettings, useT, useTerm } from '../settingsContext'
import { BirthChip, BirthForm } from './BirthForm'
import { AiAnalysis } from './AiAnalysis'
import { CastLine } from './CastLine'
import { ChartViewSwitch, useChartFull } from './ChartViewSwitch'
import { QizhengReadingCard } from './ChartReadingCards'
import { TitleMark } from './Logo'
import { RightDrawer } from './RightDrawer'
import { DrawerBirth } from './SavedCharts'
import { SchoolSettingsPanel } from './Schools'
import { SchoolsMenu } from './SchoolsMenu'
import { SectionNav } from './SectionNav'
import { smoothUpdate } from './smoothUpdate'
import { useCasting } from './useCasting'

// 生辰星空, shared with the 八字 page: loaded apart, as it brings the star catalogue
const BirthSky = lazy(() => import('./BirthSky').then((m) => ({ default: m.BirthSky })))

/** Each body's colour: the Sun gold, the Moon silver, the planets their element's, the 四余 violet */
export const BODY_COLOUR: Record<QizhengKey, string> = {
  sun: 'var(--qz-sun)',
  moon: 'var(--qz-moon)',
  mercury: 'var(--water)',
  venus: 'var(--metal)',
  mars: 'var(--fire)',
  jupiter: 'var(--wood)',
  saturn: 'var(--earth)',
  rahu: 'var(--qz-four)',
  ketu: 'var(--qz-four)',
  yuebei: 'var(--qz-four)',
  ziqi: 'var(--qz-four)',
}

/** The cast layer each body comes in with */
const layerOf = (key: QizhengKey) => (key === 'sun' ? 'cast-l1' : key === 'moon' ? 'cast-l2' : QIZHENG_INFO[key].four ? 'cast-l4' : 'cast-l3')

const C = 300
const R_RIM = 292
const R_CI = 268
const R_OUT = 250
const R_IN = 212
const R_HEART = 78
const at = (r: number, deg: number) => [C + r * Math.sin((deg * Math.PI) / 180), C - r * Math.cos((deg * Math.PI) / 180)] as const
const f = (n: number) => n.toFixed(1)
const norm = (d: number) => ((d % 360) + 360) % 360
const arc = (r1: number, r2: number, a1: number, a2: number) => {
  const large = norm(a2 - a1) > 180 ? 1 : 0
  const [x1, y1] = at(r2, a1)
  const [x2, y2] = at(r2, a2)
  const [x3, y3] = at(r1, a2)
  const [x4, y4] = at(r1, a1)
  return `M${f(x1)} ${f(y1)}A${r2} ${r2} 0 ${large} 1 ${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}A${r1} ${r1} 0 ${large} 0 ${f(x4)} ${f(y4)}Z`
}

/** 十二度, 初度: the 古度 into a mansion, in Chinese numerals; in English, 12° */
function useDu() {
  const { language } = useSettings()
  const t = useT()
  return (b: QizhengBody) => (language === 'en' ? `${Math.floor(b.du)}°` : b.du < 1 ? t('初度') : `${hanNumber(Math.floor(b.du))}度`)
}

/** The round chart: the sky turned so the Sun is at the top, right ascension running counterclockwise */
export function QizhengWheel({ chart }: { chart: QizhengChart }) {
  const t = useT()
  const term = useTerm()
  const sun = chart.bodies.find((b) => b.key === 'sun')!
  // Clockwise from the top: the sky as seen looking up at the south, east to the left
  const angle = (ra: number) => norm(sun.ra - ra)
  const occupied = new Set(chart.bodies.map((b) => b.mansionIndex))
  // The bodies, nearest the rim first; one close to the last steps inward so neither hides the other
  const placed = [...chart.bodies]
    .sort((a, b) => angle(a.ra) - angle(b.ra))
    .reduce<{ body: QizhengBody; r: number }[]>((out, body) => {
      const prev = out[out.length - 1]
      const close = prev && Math.abs(angle(body.ra) - angle(prev.body.ra)) < 9
      out.push({ body, r: close ? prev.r - 30 : 182 })
      return out
    }, [])
  return (
    <svg className="qz-wheel" viewBox="-24 -24 648 648" role="img" aria-label={t('七政四余命盘')}>
      <circle className="qz-plate" cx={C} cy={C} r={R_RIM + 6} />
      <circle className="qz-ring strong" cx={C} cy={C} r={R_RIM} />
      <circle className="qz-ring" cx={C} cy={C} r={R_OUT} />
      <circle className="qz-ring" cx={C} cy={C} r={R_IN} />
      <circle className="qz-ring faint" cx={C} cy={C} r={150} />
      {/* The 十二次, faint on the rim: from each one's start to the next's */}
      <g className="qz-ci">
        {CI.map((ci, k) => {
          const a1 = angle(chart.ciRa[k])
          const a2 = angle(chart.ciRa[(k + 1) % 12])
          // RA runs counterclockwise: the 次 spans from a2 to a1, clockwise
          const mid = a2 + norm(a1 - a2) / 2
          const [x1, y1] = at(R_RIM, a1)
          const [x2, y2] = at(R_OUT, a1)
          const [nx, ny] = at(R_CI + 2, mid)
          const turn = mid > 90 && mid < 270 ? mid - 180 : mid
          return (
            <g key={ci.name} className={k === chart.mingCi ? 'ming' : undefined}>
              <line x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} />
              <text x={f(nx)} y={f(ny)} textAnchor="middle" dominantBaseline="central" transform={`rotate(${f(turn)} ${f(nx)} ${f(ny)})`}>
                {term(ci.name)}
                {k === chart.mingCi ? ` · ${term('命')}` : ''}
              </text>
            </g>
          )
        })}
      </g>
      {/* The 28 mansions at their true widths, lit in their quarter's colour where a body is */}
      <g className="qz-mansions">
        {mansionArcs().map(({ mansion, index, start, width }) => {
          const a1 = angle(start)
          const a2 = norm(a1 - width)
          const mid = norm(a1 - width / 2)
          const [x1, y1] = at(R_OUT, a1)
          const [x2, y2] = at(R_IN, a1)
          const [nx, ny] = at((R_OUT + R_IN) / 2, mid)
          const lit = occupied.has(index)
          return (
            <g key={mansion.char} className={`qz-mansion z-${mansion.zone}${lit ? ' lit' : ''}`}>
              <path d={arc(R_IN, R_OUT, a2, a1)} />
              <line x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} />
              <text x={f(nx)} y={f(ny)} textAnchor="middle" dominantBaseline="central">
                {term(mansion.char)}
              </text>
            </g>
          )
        })}
      </g>
      {/* The bodies: a light on the mansions' inner edge, a thread to the heart, the name within */}
      {placed.map(({ body, r }) => {
        const a = angle(body.ra)
        const [dx, dy] = at(R_IN - 4, a)
        const [hx, hy] = at(R_HEART + 4, a)
        const [cx, cy] = at(r, a)
        const info = QIZHENG_INFO[body.key]
        return (
          <g key={body.key} className={`qz-body${info.four ? ' four' : ''}${body.reckoned ? ' reckoned' : ''} ${layerOf(body.key)}`} style={{ color: BODY_COLOUR[body.key] }}>
            <title>{`${term(info.name)} · ${term(body.mansion.name)}`}</title>
            <line className="qz-thread" x1={f(dx)} y1={f(dy)} x2={f(hx)} y2={f(hy)} />
            <circle className="qz-dot" cx={f(dx)} cy={f(dy)} r={3.6} />
            <text className="qz-char" x={f(cx)} y={f(cy)} textAnchor="middle" dominantBaseline="central">
              {term(info.char)}
            </text>
            {body.retro && (
              <text className="qz-retro" x={f(cx + 15)} y={f(cy - 12)} textAnchor="middle">
                {term('逆')}
              </text>
            )}
          </g>
        )
      })}
      <circle className="qz-heart" cx={C} cy={C} r={R_HEART} />
      <text className="qz-heart-name" x={C} y={C - 8} textAnchor="middle">
        {term('七政')}
      </text>
      <text className="qz-heart-name" x={C} y={C + 30} textAnchor="middle">
        {term('四余')}
      </text>
    </svg>
  )
}

/** The scene: the wheel, and what is set round it */
function QizhengScene({ chart, input, cast }: { chart: QizhengChart; input: BaziInput; cast: ReturnType<typeof useCasting> }) {
  const t = useT()
  const term = useTerm()
  const du = useDu()
  const { language } = useSettings()
  const en = language === 'en'
  const gap = en ? ' · ' : '　'
  const by = (k: QizhengKey) => chart.bodies.find((b) => b.key === k)
  const sun = by('sun')!
  const moon = by('moon')!
  const jupiter = by('jupiter')!
  const saturn = by('saturn')!
  const ming = CI[chart.mingCi]
  const inMing = chart.bodies.filter((b) => b.palace === 0).map((b) => term(QIZHENG_INFO[b.key].name))
  const place = input.place ?? DEFAULT_PLACE
  return (
    <div className="bazi-hero bazi-scene qz-scene">
      {/* Down the right, the verse */}
      <div className="bz-verse">
        <b className="cast-l1">{t('日躔{m}宿', { m: term(sun.mansion.char) })}</b>
        <span className="cast-l2">{t('月离{m}宿', { m: term(moon.mansion.char) })}</span>
        <span className="cast-l3">
          {t('岁星在{m}', { m: term(jupiter.mansion.char) })}
          {gap}
          {t('镇星在{m}', { m: term(saturn.mansion.char) })}
        </span>
        <small>
          {t('{zone}之宿', { zone: term(ZONES[sun.mansion.zone].name) })}
          {gap}
          {t('{ci}之次', { ci: term(CI[sun.ci].name) })}
        </small>
      </div>
      {/* Down the left, who was born, and the 命宫 */}
      <div className="bz-margin">
        <span>
          {input.gender === 1 ? term('乾造') : term('坤造')}
          {gap}
          {t(place.name)}
        </span>
        <span>{t('{y}年{m}月{d}日', { y: input.year, m: input.month, d: input.day })} {`${String(input.hour).padStart(2, '0')}:${String(input.minute).padStart(2, '0')}`}</span>
        <span>
          {t('命宫{ci}', { ci: term(ming.name) })}
          {gap}
          {t('命度{m}宿', { m: term(chart.ascMansion.char) })}
        </span>
        {inMing.length > 0 && <span>{t('{bodies}守命', { bodies: inMing.join(en ? ', ' : '、') })}</span>}
      </div>
      <div className="bazi-hero-dial qz-dial">
        <QizhengWheel chart={chart} />
      </div>
      <CastLine
        cast={cast}
        captions={[
          t('第一重 · 日躔{m}宿', { m: term(sun.mansion.char) }),
          t('第二重 · 月离{m}宿', { m: term(moon.mansion.char) }),
          t('第三重 · 五星各就其宿'),
          t('第四重 · 四余'),
        ]}
      />
      {/* At the foot on the left, the 七政, standing as 八字's pillars do */}
      <div className="bz-pillars qz-seven" aria-label={term('七政')}>
        {SEVEN.map((k) => {
          const b = by(k)!
          const info = QIZHENG_INFO[k]
          return (
            <div key={k} className={layerOf(k)}>
              <small>{term(info.old)}</small>
              <b style={{ color: BODY_COLOUR[k] }}>{term(info.char)}</b>
              <em>
                {term(b.mansion.char)}
                {du(b)}
                {b.retro ? ` ${term('逆')}` : ''}
              </em>
            </div>
          )
        })}
      </div>
      {/* At the foot on the right, the 四余 */}
      <div className="bz-links qz-four cast-l4">
        <span>{term('四余')}</span>
        {FOUR.map((k) => {
          const b = by(k)
          if (!b) return null
          return (
            <span key={k} className="qz-four-row">
              <b>{term(QIZHENG_INFO[k].name)}</b>
              {b.reckoned ? t('依流派推算') : `${term(b.mansion.name)}${du(b)}`}
            </span>
          )
        })}
        <small>{t('罗睺、计都是月亮轨道的两个交点，月孛是月亮的远地点，都由天文算出；紫炁没有对应的天体，各流派推法不同。')}</small>
      </div>
    </div>
  )
}

/** 详细: every body, its 宿 and degree, its 次 and palace */
function QizhengTable({ chart }: { chart: QizhengChart }) {
  const t = useT()
  const term = useTerm()
  const du = useDu()
  return (
    <div className="table-scroll">
      <table className="qz-table">
        <thead>
          <tr>
            <th>{t('星曜')}</th>
            <th>{t('宿')}</th>
            <th>{t('入宿度')}</th>
            <th>{t('赤经')}</th>
            <th>{t('黄经')}</th>
            <th>{t('次')}</th>
            <th>{t('宫')}</th>
          </tr>
        </thead>
        <tbody>
          {chart.bodies.map((b) => {
            const info = QIZHENG_INFO[b.key]
            return (
              <tr key={b.key} className={info.four ? 'four' : undefined}>
                <th scope="row">
                  <span className="qz-table-char" style={{ color: BODY_COLOUR[b.key] }}>
                    {term(info.char)}
                  </span>{' '}
                  {term(info.name)}
                  {info.old !== info.name && <small className="muted"> {term(info.old)}</small>}
                  {b.retro && <small className="muted"> · {t('逆行')}</small>}
                  {b.reckoned && <small className="muted"> · {t('依流派推算')}</small>}
                </th>
                <td>
                  {term(b.mansion.name)} <small className="muted">{term(b.mansion.animal)}</small>
                </td>
                <td>
                  {du(b)} <small className="muted">({b.into.toFixed(1)}°)</small>
                </td>
                <td>{b.ra.toFixed(2)}°</td>
                <td>{b.lon.toFixed(2)}°</td>
                <td>
                  {term(CI[b.ci].name)} <small className="muted">{term(CI[b.ci].branch)}</small>
                </td>
                <td>{term(PALACES[b.palace])}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** The school notes: what is computed and how, and which way each 流派 choice is set */
function SchoolNotes({ chart, schools }: { chart: QizhengChart; schools: QizhengSchoolSettings }) {
  const t = useT()
  const term = useTerm()
  return (
    <ul className="qz-notes muted">
      <li>{t('七政的位置由 astronomy-engine 按出生时刻算出（地心视位置），按赤经（J2000）归入二十八宿；入宿度是从该宿距星起算的古度（周天 365¼ 度）。')}</li>
      <li>
        {t('十二次按黄道从春分点起每 30° 一次（清代《时宪历》的分法）；命宫取上升点所在的次，在{ci}，其余各宫顺黄道往东排。', { ci: term(CI[chart.mingCi].name) })}
      </li>
      <li>{t('月孛取月亮的平远地点。')}</li>
      {(Object.keys(QIZHENG_SCHOOLS) as (keyof QizhengSchoolSettings)[]).map((key) => {
        const entry = QIZHENG_SCHOOLS[key]
        const option = entry.options.find((o) => o.value === schools[key])!
        return (
          <li key={key}>
            {t(entry.title)}：{t(option.label)}（{t(option.source)}）
          </li>
        )
      })}
    </ul>
  )
}

interface Props {
  input: BaziInput
  onChange: (input: BaziInput) => void
  schools: QizhengSchoolSettings
  onSchoolsChange: (schools: QizhengSchoolSettings) => void
}

export function QizhengView({ input, onChange, schools, onSchoolsChange }: Props) {
  const t = useT()
  const { birthSky, uiStyle } = useSettings()
  const chart = useMemo(() => buildQizheng(input, schools), [input, schools])
  const aiPrompt = useMemo(() => qizhengPrompt(chart, schools), [chart, schools])
  const [fullChart, toggleFullChart] = useChartFull()
  const tianshu = uiStyle === 'tianshu'
  const scene = tianshu && !fullChart
  const cast = useCasting(`${chart.utc.getTime()} ${chart.place.latitude} ${chart.place.longitude}`, 4, scene)
  const moment = useMemo(
    () => ({ utc: chart.utc, latitude: chart.place.latitude, longitude: chart.place.longitude }),
    [chart.utc, chart.place.latitude, chart.place.longitude],
  )
  const schoolsPanel = <SchoolSettingsPanel registry={QIZHENG_SCHOOLS} settings={schools} onChange={onSchoolsChange} />
  const birthForm = (
    <BirthForm folding={!tianshu} input={input} onChange={onChange} trueSolar={false} schoolsPanel={schoolsPanel} withSchools={!tianshu} />
  )
  return (
    <div className="bazi-layout">
      {birthSky === 'show' && (
        <Suspense fallback={null}>
          <BirthSky moment={moment} focus={null} />
        </Suspense>
      )}
      {tianshu ? <DrawerBirth>{birthForm}</DrawerBirth> : birthForm}
      <SectionNav
        items={[
          ['qizheng-chart', t('盘面')],
          ['qizheng-reading', t('解读')],
        ]}
      />
      <section className={`card${scene ? ' scene' : ''}`} id="qizheng-chart" data-stage={cast.stageAttr}>
        <div className="qz-toolbar">
          {tianshu && <BirthChip input={input} trueSolar={false} />}
          {tianshu && <SchoolsMenu panel={schoolsPanel} />}
          <ChartViewSwitch full={fullChart} onToggle={() => (tianshu ? smoothUpdate('chart-view', toggleFullChart) : toggleFullChart())} />
        </div>
        {scene ? (
          <QizhengScene chart={chart} input={input} cast={cast} />
        ) : (
          <>
            {!tianshu && (
              <h3 className="section-title">
                <TitleMark />
                {t('七政四余')}
              </h3>
            )}
            <div className="qz-layout">
              <div className="qz-detail-wheel">
                <QizhengWheel chart={chart} />
              </div>
              <QizhengTable chart={chart} />
            </div>
            {fullChart && <SchoolNotes chart={chart} schools={schools} />}
          </>
        )}
      </section>
      <QizhengReadingCard chart={chart} />

      {/* At the right edge, opened over the page when wanted */}
      <RightDrawer label={t('AI 解读')}>
        <AiAnalysis id="qizheng-ai" prompt={aiPrompt} />
      </RightDrawer>
    </div>
  )
}
