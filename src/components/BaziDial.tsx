// 天书's 八字: the chart as a dial, south up as on a 罗盘. Outside, the twelve 地支, those of the four
// pillars lit; inside them, the seasons with their 五行 (寅卯辰 spring wood … 亥子丑 winter water,
// a mark on each 土 month), the month of birth (月令) aglow; between the branches, the 刑冲合会 of the
// chart drawn as light (合 and 会 arcs, 冲 straight across, 刑 害 破 a faint dashed line); the 日主 at
// the heart. Everything it shows is in the chart; nothing is there for show.
import type { ElementName, Pillar } from '../lib/bazi'
import type { Relation } from '../lib/relations'
import { useTerm } from '../settingsContext'

/** From the top, clockwise: 午 south, 酉 west, 子 north, 卯 east */
const RING = '午未申酉戌亥子丑寅卯辰巳'
const SEASONS: { branches: string; element: ElementName }[] = [
  { branches: '巳午未', element: '火' },
  { branches: '申酉戌', element: '金' },
  { branches: '亥子丑', element: '水' },
  { branches: '寅卯辰', element: '木' },
]
const EL_VAR: Record<ElementName, string> = { 木: 'var(--wood)', 火: 'var(--fire)', 土: 'var(--earth)', 金: 'var(--metal)', 水: 'var(--water)' }
const C = 265
const R_BRANCH = 222
const R_SEASON = 178
const R_LINK = 150

const angle = (i: number) => (i / 12) * 2 * Math.PI - Math.PI / 2
const at = (i: number, r: number): [number, number] => [C + Math.cos(angle(i)) * r, C + Math.sin(angle(i)) * r]
/** An arc along the ring over the slots i0..i1 (inclusive), clockwise */
function arc(i0: number, i1: number, r: number) {
  const a0 = angle(i0 - 0.5)
  const a1 = angle(i1 + 0.5)
  return `M${C + Math.cos(a0) * r} ${C + Math.sin(a0) * r} A${r} ${r} 0 0 1 ${C + Math.cos(a1) * r} ${C + Math.sin(a1) * r}`
}
const elementOf = (text: string): ElementName | null => {
  const m = text.match(/[木火土金水](?=[局方]?$)/)
  return (m?.[0] as ElementName) ?? null
}

export function BaziDial({ pillars, relations }: { pillars: Pillar[]; relations: Relation[] }) {
  const term = useTerm()
  const month = pillars[1].branch.char
  // Which pillars stand on each branch
  const on = new Map<string, string[]>()
  pillars.forEach((p) => on.set(p.branch.char, [...(on.get(p.branch.char) ?? []), term(p.label.slice(0, 1))]))
  // One light for each relation between branches (亥卯 半合 twice, with two 亥, is drawn once)
  const links = relations.filter((r, i, all) => r.on === 'branch' && all.findIndex((o) => o.on === 'branch' && o.text === r.text) === i)
  const dayMaster = pillars[2].stem
  return (
    <svg className="bazi-dial" viewBox="0 0 530 530" role="img" aria-label={pillars.map((p) => p.stem.char + p.branch.char).join(' ')}>
      <defs>
        <radialGradient id="bd-core">
          <stop offset="0" stopColor="var(--ts-vermilion)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--ts-vermilion)" stopOpacity="0" />
        </radialGradient>
        <filter id="bd-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      {/* The night under the dial, so the sky behind the page does not read through it */}
      <circle cx={C} cy={C} r="252" className="bd-ground" />
      <circle cx={C} cy={C} r="150" fill="url(#bd-core)" />
      {/* The rings, the outer one turning slowly */}
      <g className="bd-turn">
        <circle cx={C} cy={C} r="246" className="bd-ring strong" />
        {Array.from({ length: 180 }, (_, k) => {
          const a = (k / 180) * 2 * Math.PI
          const l = k % 15 === 0 ? 10 : k % 5 ? 3 : 6
          return <line key={k} x1={C + Math.cos(a) * 246} y1={C + Math.sin(a) * 246} x2={C + Math.cos(a) * (246 - l)} y2={C + Math.sin(a) * (246 - l)} className="bd-tick" />
        })}
      </g>
      <circle cx={C} cy={C} r="196" className="bd-ring" />
      <circle cx={C} cy={C} r="160" className="bd-ring" />
      <circle cx={C} cy={C} r="104" className="bd-ring faint" />
      {/* The seasons, the month of birth lit */}
      {SEASONS.map((s) => {
        const i0 = RING.indexOf(s.branches[0])
        return <path key={s.element} d={arc(i0, i0 + 2, R_SEASON)} className="bd-season" style={{ stroke: EL_VAR[s.element] }} />
      })}
      {(() => {
        const i = RING.indexOf(month)
        const season = SEASONS.find((s) => s.branches.includes(month))!
        // beside the lit month, not on the branch (where its links end)
        const [x, y] = at(i + 0.62, R_SEASON - 26)
        return (
          <g className="bd-month">
            <path d={arc(i, i, R_SEASON)} className="bd-month-glow" style={{ stroke: EL_VAR[season.element] }} filter="url(#bd-blur)" />
            <path d={arc(i, i, R_SEASON)} className="bd-month-line" />
            <text x={x} y={y + 4} className="bd-note">
              {term('月令')}
            </text>
          </g>
        )
      })()}
      {[...'辰戌丑未'].map((b) => {
        const [x, y] = at(RING.indexOf(b), R_SEASON)
        return <circle key={b} cx={x} cy={y} r="2.6" className="bd-earth" />
      })}
      {/* The branches, upright; the chart's own lit, with their pillars under them */}
      {[...RING].map((b, i) => {
        const [x, y] = at(i, R_BRANCH)
        const mine = on.get(b)
        const own = pillars.find((p) => p.branch.char === b)
        return (
          <g key={b} className={mine ? 'bd-branch mine' : 'bd-branch'}>
            <text x={x} y={y + 7} style={own ? { fill: EL_VAR[own.branch.element], color: EL_VAR[own.branch.element] } : undefined}>
              {b}
            </text>
            {mine && (
              <text x={x} y={y + 24} className="bd-who">
                {mine.join('·')}
              </text>
            )}
          </g>
        )
      })}
      {/* The 日主 */}
      <circle cx={C} cy={C} r="50" className="bd-heart-halo" />
      <circle cx={C} cy={C} r="44" className="bd-heart" />
      <text x={C} y={C + 18} className="bd-day-master" style={{ fill: EL_VAR[dayMaster.element], color: EL_VAR[dayMaster.element] }}>
        {dayMaster.char}
      </text>
      {/* 刑冲合会 as light between the branches */}
      {links.map((r, k) => {
        const branches = r.text.slice(0, r.members.length)
        const name = r.text.slice(r.members.length)
        const idx = [...branches].map((b) => RING.indexOf(b))
        const pts = idx.map((i) => at(i, R_LINK))
        const el = elementOf(r.text)
        const colour = r.kind === '冲' ? 'var(--ts-vermilion)' : el ? EL_VAR[el] : 'var(--accent)'
        if (idx.every((i) => i === idx[0])) {
          // the same branch twice (自刑): two lights side by side
          const [x, y] = pts[0]
          return (
            <g key={k} className="bd-link self" style={{ color: colour }}>
              <circle cx={x - 6} cy={y} r="3.6" />
              <circle cx={x + 6} cy={y} r="3.6" />
              <text x={C + (x - C) * 0.8} y={C + (y - C) * 0.8 + 4} className="bd-note">
                {name}
              </text>
            </g>
          )
        }
        // A two-branch link bows towards the heart; its label sits on the curve's middle
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
            ? [C, C - 70]
            : [0.25 * pts[0][0] + 0.5 * ctrl[0] + 0.25 * pts[1][0], 0.25 * pts[0][1] + 0.5 * ctrl[1] + 0.25 * pts[1][1]]
        return (
          <g key={k} className={`bd-link${soft ? ' soft' : ''}`} style={{ color: colour }}>
            {!soft && <path d={d} className="bd-link-glow" filter="url(#bd-blur)" />}
            <path d={d} className="bd-link-line" />
            {pts.map(([x, y], j) => (
              <circle key={j} cx={x} cy={y} r="3.6" />
            ))}
            <text x={mid[0]} y={mid[1] - 7} className="bd-note">
              {name}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
