// 天书's 八字: the chart as a 罗盘 drawn in fine lines of gold light over a see-through plate, south up.
// Outermost the 六十甲子, laid out as a 罗盘's 透地六十龙: each 地支's sector holds the five 甲子 of that
// branch (the 午 sector 甲午 丙午 戊午 庚午 壬午), so each pillar glows where it stands among the sixty,
// its name outside the rim, a line running from it to the heart; the day pillar, whose stem is the 日主,
// in the 日主's gold and joined to it by a solid line, the others in vermilion and dashed. Inside, the
// twelve 地支 between the spokes, those the pillars stand on lit; the month of birth (月令) marked on its
// ring; the chart's 刑冲合会 between the branches (合 and 会 arcs, 冲 straight across, 刑 害 破 dashed); the
// 日主 at the heart; and on the rim, where today stands in the year (此刻). What the chart does not use
// (the other 甲子 and 地支) is faint, so its own stand out. Everything it shows is in the chart; nothing
// is there for show.
// Each part is marked with the layer it comes in on when the chart is cast (BaziHero): cast-l1 the 日主
// and its own pillar, cast-l2 the month, cast-l3 the other pillars, cast-l4 the 刑冲合会 and 此刻.
import type { ElementName, Pillar } from '../lib/bazi'
import type { Relation } from '../lib/relations'
import { useT, useTerm } from '../settingsContext'

/** From the top, clockwise: 午 south, 酉 west, 子 north, 卯 east */
const RING = '午未申酉戌亥子丑寅卯辰巳'
const YANG_STEMS = '甲丙戊庚壬'
const YIN_STEMS = '乙丁己辛癸'
/** The yang branches take the yang stems, the yin the yin: the five 甲子 of a branch, in order */
const stemsOf = (branch: string) => ('子寅辰午申戌'.includes(branch) ? YANG_STEMS : YIN_STEMS)

const C = 300
/** The rim and its ticks */
const R_RIM = 292
/** The 六十甲子's band */
const R_JIAZI_OUT = 282
const R_JIAZI_IN = 234
/** The 地支's band */
const R_BAND_IN = 192
const R_BRANCH = (R_JIAZI_IN + R_BAND_IN) / 2
/** The ring the month is marked on, the ring the 刑冲合会 end on, the inner ring, the heart */
const R_MONTH = 172
const R_LINK = 152
const R_INNER = 108
const R_HEART = 70

/** Angle (radians, from the top, clockwise) of a place on the ring, counted in branch slots */
const angle = (i: number) => (i / 12) * 2 * Math.PI - Math.PI / 2
const at = (i: number, r: number): [number, number] => [C + Math.cos(angle(i)) * r, C + Math.sin(angle(i)) * r]
const deg = (i: number) => i * 30
/** An arc along a ring over the slots i0..i1 (inclusive), clockwise */
function arc(i0: number, i1: number, r: number) {
  const [x0, y0] = at(i0 - 0.5, r)
  const [x1, y1] = at(i1 + 0.5, r)
  return `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`
}
/** A cell of a band between two places on the ring */
function cell(i0: number, i1: number, rOut: number, rIn: number) {
  const [a, b] = [at(i0, rOut), at(i1, rOut)]
  const [c, d] = [at(i1, rIn), at(i0, rIn)]
  return `M${a[0]} ${a[1]} A${rOut} ${rOut} 0 0 1 ${b[0]} ${b[1]} L${c[0]} ${c[1]} A${rIn} ${rIn} 0 0 0 ${d[0]} ${d[1]}Z`
}
/** Where a 甲子 sits on the ring, in branch slots: its branch's sector, its stem's fifth of it */
const jiaziAt = (stem: string, branch: string) => RING.indexOf(branch) - 0.5 + (stemsOf(branch).indexOf(stem) + 0.5) / 5
const elementOf = (text: string): ElementName | null => {
  const m = text.match(/[木火土金水](?=[局方]?$)/)
  return (m?.[0] as ElementName) ?? null
}
const EL_VAR: Record<ElementName, string> = { 木: 'var(--wood)', 火: 'var(--fire)', 土: 'var(--earth)', 金: 'var(--metal)', 水: 'var(--water)' }

export function BaziDial({
  pillars,
  relations,
  today,
}: {
  pillars: Pillar[]
  relations: Relation[]
  /** Where today stands in the year: the 节 month's branch, how far into it (0–1), and the 节气 */
  today?: { branch: string; into: number; term: string }
}) {
  const t = useT()
  const term = useTerm()
  const month = pillars[1].branch.char
  /** The layer a pillar comes in on: the day's with the 日主, the month's next, the year's and hour's after */
  const layer = (k: number) => (k === 2 ? 'cast-l1' : k === 1 ? 'cast-l2' : 'cast-l3')
  // The pillars on each 甲子 (two pillars may be the same one) and on each branch
  const onJiazi = new Map<string, number[]>()
  pillars.forEach((p, k) => onJiazi.set(p.stem.char + p.branch.char, [...(onJiazi.get(p.stem.char + p.branch.char) ?? []), k]))
  const onBranch = new Map<string, number[]>()
  pillars.forEach((p, k) => onBranch.set(p.branch.char, [...(onBranch.get(p.branch.char) ?? []), k]))
  // One line for each relation between branches (亥卯 半合 twice, with two 亥, is drawn once)
  const links = relations.filter((r, i, all) => r.on === 'branch' && all.findIndex((o) => o.on === 'branch' && o.text === r.text) === i)
  const dayMaster = pillars[2].stem
  return (
    <svg className="bazi-dial" viewBox="-24 -24 648 648" role="img" aria-label={pillars.map((p) => p.stem.char + p.branch.char).join(' ')}>
      <circle cx={C} cy={C} r={R_RIM} className="bd-plate" />
      {/* The rim's ticks, a degree apart, turning slowly */}
      <g className="bd-turn">
        {Array.from({ length: 360 }, (_, k) => {
          const a = (k / 360) * 2 * Math.PI
          const l = k % 30 === 0 ? 9 : k % 5 === 0 ? 6 : 3
          return <line key={k} x1={C + Math.cos(a) * R_RIM} y1={C + Math.sin(a) * R_RIM} x2={C + Math.cos(a) * (R_RIM - l)} y2={C + Math.sin(a) * (R_RIM - l)} className={k % 5 ? 'bd-tick' : 'bd-tick major'} />
        })}
      </g>
      <g className="bd-lines">
        {/* The 六十甲子: a sector of five for each branch, the dark and the light sectors in turn */}
        {[...RING].map((b, i) => (
          <path key={b} d={cell(i - 0.5, i + 0.5, R_JIAZI_OUT, R_JIAZI_IN)} className={`bd-sector${i % 2 ? ' alt' : ''}`} />
        ))}
        {[...RING].flatMap((b) =>
          [...stemsOf(b)].map((s) => {
            const i = jiaziAt(s, b)
            const [x1, y1] = at(i + 0.1, R_JIAZI_OUT)
            const [x2, y2] = at(i + 0.1, R_JIAZI_IN)
            return <line key={s + b} x1={x1} y1={y1} x2={x2} y2={y2} className="bd-cell-line" />
          }),
        )}
        <circle cx={C} cy={C} r={R_RIM} className="bd-ring strong" />
        <circle cx={C} cy={C} r={R_JIAZI_OUT} className="bd-ring strong" />
        <circle cx={C} cy={C} r={R_JIAZI_IN} className="bd-ring strong" />
        <circle cx={C} cy={C} r={R_BAND_IN} className="bd-ring" />
        <circle cx={C} cy={C} r={R_MONTH} className="bd-ring faint dotted" />
        <circle cx={C} cy={C} r={R_INNER} className="bd-ring" />
        {/* The spokes between the branches, from the inner ring to the rim */}
        {[...RING].map((_, i) => {
          const [x1, y1] = at(i - 0.5, R_INNER)
          const [x2, y2] = at(i - 0.5, R_JIAZI_OUT)
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="bd-spoke" />
        })}
        {/* The sixty, each facing the heart, the stem outside its branch, as a 罗盘's rings are read */}
        {[...RING].flatMap((b) =>
          [...stemsOf(b)].map((s) => {
            const i = jiaziAt(s, b)
            const [x, y] = at(i, 0)
            const mine = onJiazi.get(s + b)
            return (
              <g
                key={s + b}
                className={`bd-jiazi${mine ? ` mine ${layer(Math.min(...mine))}${mine.includes(2) ? ' day' : ''}` : ''}`}
                transform={`rotate(${deg(i).toFixed(2)} ${x} ${y})`}
              >
                {mine && <path d={cell(-0.1, 0.1, R_JIAZI_OUT - 2, R_JIAZI_IN + 2)} />}
                <text x={C} y={C - 263}>
                  {s}
                </text>
                <text x={C} y={C - 245}>
                  {b}
                </text>
              </g>
            )
          }),
        )}
      </g>
      {/* The pillars' names outside the rim, by their 甲子 */}
      {[...onJiazi].map(([gz, ks]) => {
        const i = jiaziAt(gz[0], gz[1])
        const [x, y] = at(i, R_RIM + 14)
        return (
          <text key={gz} x={x} y={y + 4} className={`bd-pillar-name ${layer(Math.min(...ks))}${ks.includes(2) ? ' day' : ''}`}>
            {t('{pillars}柱', { pillars: ks.map((k) => term(pillars[k].label.slice(0, 1))).join('·') })}
          </text>
        )
      })}
      {/* The month of birth, marked on its ring */}
      {(() => {
        const i = RING.indexOf(month)
        const [x, y] = at(i + 0.3, R_MONTH - 15)
        return (
          <g className="bd-month cast-l2">
            <path d={arc(i, i, R_MONTH)} className="bd-month-line" />
            <text x={x} y={y + 4} className="bd-note">
              {term('月令')}
            </text>
          </g>
        )
      })()}
      {/* From each pillar's 甲子, a dashed line to the heart */}
      {pillars.map((p, k) => {
        const i = jiaziAt(p.stem.char, p.branch.char)
        const [x1, y1] = at(i, R_JIAZI_IN - 2)
        const [x2, y2] = at(i, R_HEART + 4)
        return <line key={p.label} x1={x1} y1={y1} x2={x2} y2={y2} className={`bd-thread ${layer(k)}${k === 2 ? ' day' : ''}`} />
      })}
      {/* The 地支 in their boxes, upright; those the pillars stand on edged in vermilion */}
      {[...RING].map((b, i) => {
        const [x, y] = at(i, R_BRANCH)
        const mine = onBranch.get(b)
        return (
          <g key={b} className={`bd-branch${mine ? ` mine ${layer(Math.min(...mine))}` : ''}`}>
            <rect x={x - 14} y={y - 14} width="28" height="28" rx="2" />
            <text x={x} y={y + 6.5}>
              {b}
            </text>
          </g>
        )
      })}
      {/* 此刻: where today stands in the year, a light on the rim, among the months */}
      {today &&
        (() => {
          const i = RING.indexOf(today.branch) - 0.5 + today.into
          const [x, y] = at(i, R_RIM)
          const [lx, ly] = at(i, R_RIM + 14)
          return (
            <g className="bd-now cast-l4">
              <circle cx={x} cy={y} r="2.8" />
              <text x={lx} y={ly + 4} className="bd-note">
                {t('此刻')} · {term(today.term)}
              </text>
            </g>
          )
        })()}
      {/* 刑冲合会 between the branches */}
      {links.map((r, k) => {
        const branches = r.text.slice(0, r.members.length)
        const name = r.text.slice(r.members.length)
        const idx = [...branches].map((b) => RING.indexOf(b))
        const pts = idx.map((i) => at(i, R_LINK))
        const el = elementOf(r.text)
        const colour = r.kind === '冲' ? 'var(--ts-vermilion)' : el ? EL_VAR[el] : 'var(--accent)'
        if (idx.every((i) => i === idx[0])) {
          // the same branch twice (自刑): two marks side by side
          const [x, y] = pts[0]
          return (
            <g key={k} className="bd-link self cast-l4" style={{ color: colour }}>
              <circle cx={x - 6} cy={y} r="3" />
              <circle cx={x + 6} cy={y} r="3" />
              <text x={C + (x - C) * 0.82} y={C + (y - C) * 0.82 + 4} className="bd-note">
                {name}
              </text>
            </g>
          )
        }
        // A two-branch link bows towards the heart; its name sits on the curve's middle
        const ctrl: [number, number] = pts.length === 2 ? [((pts[0][0] + pts[1][0]) / 2) * 0.4 + C * 0.6, ((pts[0][1] + pts[1][1]) / 2) * 0.4 + C * 0.6] : [C, C]
        const d =
          r.kind === '冲'
            ? `M${pts[0][0]} ${pts[0][1]} L${pts[1][0]} ${pts[1][1]}`
            : pts.length === 3
              ? `M${pts[0][0]} ${pts[0][1]} Q${C} ${C} ${pts[1][0]} ${pts[1][1]} Q${C} ${C} ${pts[2][0]} ${pts[2][1]}`
              : `M${pts[0][0]} ${pts[0][1]} Q${ctrl[0]} ${ctrl[1]} ${pts[1][0]} ${pts[1][1]}`
        const soft = r.kind === '刑' || r.kind === '害' || r.kind === '破'
        const mid =
          r.kind === '冲' || pts.length !== 2
            ? [C, C - 86]
            : [0.25 * pts[0][0] + 0.5 * ctrl[0] + 0.25 * pts[1][0], 0.25 * pts[0][1] + 0.5 * ctrl[1] + 0.25 * pts[1][1]]
        return (
          <g key={k} className={`bd-link cast-l4${soft ? ' soft' : ''}`} style={{ color: colour }}>
            <path d={d} className="bd-link-line" />
            {pts.map(([x, y], j) => (
              <circle key={j} cx={x} cy={y} r="3" />
            ))}
            <text x={mid[0]} y={mid[1] - 7} className="bd-note">
              {name}
            </text>
          </g>
        )
      })}
      {/* The 日主 at the heart */}
      <g className="cast-l1">
        <circle cx={C} cy={C} r={R_HEART} className="bd-heart" />
        <circle cx={C} cy={C} r={R_HEART - 6} className="bd-heart-line" />
        <text x={C} y={C + 27} className="bd-day-master">
          {dayMaster.char}
        </text>
      </g>
    </svg>
  )
}
