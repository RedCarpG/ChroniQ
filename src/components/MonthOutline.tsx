import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Rounds a closed polygon's corners: each corner becomes a quadratic curve
 * from `r` before the vertex to `r` after it (less on short edges).
 */
function roundedPath(points: [number, number][], r: number): string {
  // Drop repeated points and points on a straight line
  const pts = points.filter((p, i) => {
    const prev = points[(i - 1 + points.length) % points.length]
    const next = points[(i + 1) % points.length]
    if (p[0] === prev[0] && p[1] === prev[1]) return false
    return !((prev[0] === p[0] && p[0] === next[0]) || (prev[1] === p[1] && p[1] === next[1]))
  })
  const n = pts.length
  if (n < 3) return ''
  const toward = (a: [number, number], b: [number, number], d: number): [number, number] => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const k = Math.min(d, len / 2) / len
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
  }
  let d = ''
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const a = toward(p, pts[(i - 1 + n) % n], r)
    const b = toward(p, pts[(i + 1) % n], r)
    d += `${i ? 'L' : 'M'}${a[0].toFixed(1)} ${a[1].toFixed(1)}Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`
  }
  return d + 'Z'
}

/**
 * The outline around the current month's days in the month grid: one line
 * round the whole block (whose first and last rows may be partial), on a
 * faint plate, drawn behind the day cells. Put it inside the grid: it
 * measures its sibling cells, so it follows the grid's real size and gaps.
 * (It finds the grid as its own parent: the grid's ref is not set yet when
 * a child's layout effect first runs.)
 */
export function MonthOutline({ layoutKey }: { layoutKey: string }) {
  const svg = useRef<SVGSVGElement>(null)
  const [shape, setShape] = useState<{ d: string; w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const el = svg.current?.parentElement
    if (!el) return
    const measure = () => {
      const cells = [...el.querySelectorAll<HTMLElement>('.day')]
      const inMonth = cells.filter((c) => !c.classList.contains('out'))
      if (inMonth.length === 0 || cells.length < 7) return setShape(null)
      const box = el.getBoundingClientRect()
      // Measured sizes include the page's CSS zoom (显示大小); the SVG draws in unzoomed px
      const k = box.width ? el.offsetWidth / box.width : 1
      const rect = (c: HTMLElement) => {
        const r = c.getBoundingClientRect()
        return { l: (r.left - box.left) * k, t: (r.top - box.top) * k, r: (r.right - box.left) * k, b: (r.bottom - box.top) * k }
      }
      const a = rect(inMonth[0])
      const z = rect(inMonth[inMonth.length - 1])
      const left = rect(cells[0]).l
      const right = rect(cells[6]).r
      // Half the gap between cells, so the line runs down the middle of the gutter
      const p = Math.max(1.5, (rect(cells[1]).l - rect(cells[0]).r) / 2)
      const d = roundedPath(
        [
          [a.l - p, a.t - p],
          [right + p, a.t - p],
          [right + p, z.t - p],
          [z.r + p, z.t - p],
          [z.r + p, z.b + p],
          [left - p, z.b + p],
          [left - p, a.b + p],
          [a.l - p, a.b + p],
        ],
        12,
      )
      setShape({ d, w: el.offsetWidth, h: el.offsetHeight })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [layoutKey])
  return (
    <svg
      ref={svg}
      className="month-outline"
      width={shape?.w ?? 0}
      height={shape?.h ?? 0}
      viewBox={shape ? `0 0 ${shape.w} ${shape.h}` : undefined}
      aria-hidden="true"
    >
      {shape && <path d={shape.d} />}
    </svg>
  )
}
