import { useEffect, useRef } from 'react'
import { DIPPER, HANDLE_ANGLE, POLARIS, aroundPole, branchAngle, type MonthBuild } from '../lib/dipper'

const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'

// The dipper is some 34° from the pole and 25° across: true to size it would be a speck at the
// ring's edge. It keeps its shape, twice as large (units of the 100-wide drawing per degree),
// drawn nearer the pole, in the same direction from it; and it still turns about the pole.
const SIZE = 2
const NEAR = 12
const STARS = (() => {
  const pts = DIPPER.map(aroundPole)
  const [cx, cy] = pts.reduce(([a, b], [x, y]) => [a + x / pts.length, b + y / pts.length], [0, 0])
  const k = NEAR / Math.hypot(cx, cy)
  return DIPPER.map((s, i) => ({
    ...s,
    xy: [cx * k + (pts[i][0] - cx) * SIZE, cy * k + (pts[i][1] - cy) * SIZE] as const,
  }))
})()
// 斗魁, the bowl, closed; then 斗柄, the handle, from 天权 out to 摇光
const FIGURE =
  `M${[0, 1, 2, 3, 0].map((i) => STARS[i].xy.map((v) => v.toFixed(1)).join(' ')).join('L')}` +
  `M${[3, 4, 5, 6].map((i) => STARS[i].xy.map((v) => v.toFixed(1)).join(' ')).join('L')}`
const POLE = aroundPole(POLARIS)
// The way the handle points: on from 摇光, along 天权 → 摇光
const POINTER = (() => {
  const [[x0, y0], [x1, y1]] = [STARS[3].xy, STARS[6].xy]
  const k = 0.25 + 9 / Math.hypot(x1 - x0, y1 - y0)
  return { x1: x1 + (x1 - x0) * 0.25, y1: y1 + (y1 - y0) * 0.25, x2: x1 + (x1 - x0) * k, y2: y1 + (y1 - y0) * k }
})()
const starRadius = (mag: number) => 3.6 - mag * 0.6
/** A point at a screen angle (degrees clockwise from up) and a distance from the pole */
const toward = (angle: number, r: number) => [
  r * Math.sin((angle * Math.PI) / 180),
  -r * Math.cos((angle * Math.PI) / 180),
]

/**
 * 斗柄指月: the Northern Dipper round the pole as one sees it facing north at dusk, its handle
 * pointing to the month's 辰 on the ring (子 below, for the north, 卯 to the right). The dipper
 * turns the short way round to a new month's 辰.
 */
export function DipperDial({ build, title }: { build: MonthBuild; title: string }) {
  const target = branchAngle(build.branch) - HANDLE_ANGLE
  const was = useRef<number | null>(null)
  const turn = was.current === null ? target : was.current + ((((target - was.current) % 360) + 540) % 360) - 180
  useEffect(() => {
    was.current = turn
  }, [turn])
  const [cx, cy] = toward(branchAngle(build.branch), 47)
  return (
    <span className="dipper-dial" role="img" aria-label={title} title={title}>
      <svg className="dipper-ring" viewBox="-50 -50 100 100" aria-hidden="true">
        <circle className="ring" r="47" />
        {Array.from({ length: 12 }, (_, b) => {
          const [x, y] = toward(branchAngle(b), 47)
          return (
            b !== build.branch && (
              <circle
                key={b}
                className={b % 3 === 0 ? 'tick main' : 'tick'}
                cx={x}
                cy={y}
                r={b % 3 === 0 ? 1.6 : 1.1}
              />
            )
          )
        })}
        <circle className="pole" cx={POLE[0]} cy={POLE[1]} r="1.6" />
        {/* The 辰 the handle points to, set on the ring */}
        <g key={build.branch} className="pointed">
          <circle cx={cx} cy={cy} r="9" />
          <text x={cx} y={cy}>
            {BRANCHES[build.branch]}
          </text>
        </g>
      </svg>
      <svg
        className="dipper-stars"
        viewBox="-50 -50 100 100"
        aria-hidden="true"
        style={{ transform: `rotate(${turn}deg)` }}
      >
        <line className="pointer" {...POINTER} />
        <path className="figure" d={FIGURE} />
        {STARS.map((s) => (
          <circle key={s.name} className="star" cx={s.xy[0]} cy={s.xy[1]} r={starRadius(s.mag)} />
        ))}
      </svg>
    </span>
  )
}
