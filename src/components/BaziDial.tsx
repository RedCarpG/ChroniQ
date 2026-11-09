// 天书's 八字: the chart as a gold 罗盘, south up, carved as the old star plates were. Round the rim the
// twelve 地支, each in its box between the spokes; those the four pillars stand on are stamped in
// vermilion, their pillars named under them, and a dashed line runs from each to the heart. Inside, the
// month of birth (月令) is marked on the ring; between the branches, the chart's 刑冲合会 (合 and 会 arcs,
// 冲 straight across, 刑 害 破 dashed); the 日主 at the heart; and on the rim, where today stands in the
// year (此刻). Everything it shows is in the chart; nothing is there for show.
// Each part is marked with the layer it comes in on when the chart is cast (BaziHero): cast-l1 the 日主,
// cast-l2 the month, cast-l3 the other pillars, cast-l4 the 刑冲合会 and 此刻; the plate is there throughout.
import type { ElementName, Pillar } from '../lib/bazi'
import type { Relation } from '../lib/relations'
import { useT, useTerm } from '../settingsContext'

/** From the top, clockwise: 午 south, 酉 west, 子 north, 卯 east */
const RING = '午未申酉戌亥子丑寅卯辰巳'
const C = 265
/** The rim's ticks, outside the branches' band */
const R_RIM = 252
/** The branches' band, its outer and inner edge, and the boxes in it */
const R_BAND_OUT = 244
const R_BAND_IN = 206
const R_BRANCH = (R_BAND_OUT + R_BAND_IN) / 2
/** The ring the month is marked on, the ring the 刑冲合会 end on, the heart */
const R_MONTH = 168
const R_LINK = 150
const R_INNER = 104
const R_HEART = 66

const angle = (i: number) => (i / 12) * 2 * Math.PI - Math.PI / 2
const at = (i: number, r: number): [number, number] => [C + Math.cos(angle(i)) * r, C + Math.sin(angle(i)) * r]
/** An arc along a ring over the slots i0..i1 (inclusive), clockwise */
function arc(i0: number, i1: number, r: number) {
  const a0 = angle(i0 - 0.5)
  const a1 = angle(i1 + 0.5)
  return `M${C + Math.cos(a0) * r} ${C + Math.sin(a0) * r} A${r} ${r} 0 0 1 ${C + Math.cos(a1) * r} ${C + Math.sin(a1) * r}`
}
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
  // Which pillars stand on each branch, and the layer each branch comes in on (the earliest of its pillars)
  const on = new Map<string, string[]>()
  pillars.forEach((p) => on.set(p.branch.char, [...(on.get(p.branch.char) ?? []), term(p.label.slice(0, 1))]))
  const layerOf = (b: string) => (b === pillars[2].branch.char ? 'cast-l1' : b === month ? 'cast-l2' : 'cast-l3')
  // One line for each relation between branches (亥卯 半合 twice, with two 亥, is drawn once)
  const links = relations.filter((r, i, all) => r.on === 'branch' && all.findIndex((o) => o.on === 'branch' && o.text === r.text) === i)
  const dayMaster = pillars[2].stem
  return (
    <svg className="bazi-dial" viewBox="0 0 530 530" role="img" aria-label={pillars.map((p) => p.stem.char + p.branch.char).join(' ')}>
      {/* The plate: a faint night under it, so the sky behind does not read through the words */}
      <circle cx={C} cy={C} r={R_BAND_OUT} className="bd-ground" />
      {/* The rim's ticks, turning slowly */}
      <g className="bd-turn">
        {Array.from({ length: 120 }, (_, k) => {
          const a = (k / 120) * 2 * Math.PI
          const l = k % 10 === 0 ? 8 : k % 5 ? 3 : 5
          return <line key={k} x1={C + Math.cos(a) * R_RIM} y1={C + Math.sin(a) * R_RIM} x2={C + Math.cos(a) * (R_RIM - l)} y2={C + Math.sin(a) * (R_RIM - l)} className="bd-tick" />
        })}
      </g>
      <circle cx={C} cy={C} r={R_RIM} className="bd-ring strong" />
      <circle cx={C} cy={C} r={R_BAND_OUT} className="bd-ring strong" />
      <circle cx={C} cy={C} r={R_BAND_IN} className="bd-ring" />
      <circle cx={C} cy={C} r={R_MONTH} className="bd-ring faint dotted" />
      <circle cx={C} cy={C} r={R_INNER} className="bd-ring" />
      {/* The spokes between the branches, from the inner ring to the rim */}
      {[...RING].map((_, i) => {
        const [x1, y1] = at(i - 0.5, R_INNER)
        const [x2, y2] = at(i - 0.5, R_BAND_OUT)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="bd-spoke" />
      })}
      {/* The month of birth, marked on its ring */}
      {(() => {
        const i = RING.indexOf(month)
        const [x, y] = at(i + 0.32, R_MONTH - 16)
        return (
          <g className="bd-month cast-l2">
            <path d={arc(i, i, R_MONTH)} className="bd-month-line" />
            <text x={x} y={y + 4} className="bd-note">
              {term('月令')}
            </text>
          </g>
        )
      })()}
      {/* From each branch a pillar stands on, a dashed line to the heart */}
      {[...on.keys()].map((b) => {
        const i = RING.indexOf(b)
        const [x1, y1] = at(i, R_BAND_IN - 22)
        const [x2, y2] = at(i, R_HEART + 4)
        return <line key={b} x1={x1} y1={y1} x2={x2} y2={y2} className={`bd-thread ${layerOf(b)}`} />
      })}
      {/* The branches in their boxes, upright; the chart's own stamped in vermilion, their pillars named under them */}
      {[...RING].map((b, i) => {
        const [x, y] = at(i, R_BRANCH)
        const mine = on.get(b)
        const [wx, wy] = at(i, R_BAND_IN - 12)
        return (
          <g key={b} className={['bd-branch', mine ? `mine ${layerOf(b)}` : ''].join(' ')}>
            <rect x={x - 13} y={y - 13} width="26" height="26" rx="2" />
            <text x={x} y={y + 6}>
              {b}
            </text>
            {mine && (
              <text x={wx} y={wy + 4} className="bd-who">
                {t('{pillars}柱', { pillars: mine.join('·') })}
              </text>
            )}
          </g>
        )
      })}
      {/* 此刻: where today stands in the year, a light on the rim, among the months */}
      {today &&
        (() => {
          const i = RING.indexOf(today.branch) - 0.5 + today.into
          const [x, y] = at(i, R_RIM)
          const [lx, ly] = at(i, R_RIM + 16)
          return (
            <g className="bd-now cast-l4">
              <circle cx={x} cy={y} r="2.6" />
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
            ? [C, C - 84]
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
        <text x={C} y={C + 26} className="bd-day-master">
          {dayMaster.char}
        </text>
      </g>
    </svg>
  )
}
