import { litPath, type MoonDay } from '../lib/moon'

const R = 5

/**
 * The Moon as it looks on a day: the dark disc, and its lit part over it. On the day of a
 * 朔, 上弦, 望 or 下弦 it is marked (class quarter) and the full moon glows (styles.css .moon).
 * A picture only, for the eye: title is its hover tip, and the day panel says it in words.
 */
export function MoonGlyph({ moon, className, title }: { moon: MoonDay; className?: string; title?: string }) {
  const d = litPath(moon.angle, R)
  return (
    <svg
      className={['moon', moon.time && 'quarter', moon.time && moon.angle === 180 && 'full', className]
        .filter(Boolean)
        .join(' ')}
      viewBox="-6 -6 12 12"
      aria-hidden="true"
    >
      {title && <title>{title}</title>}
      <circle className="moon-shade" r={R} />
      {d && <path className="moon-lit" d={d} />}
    </svg>
  )
}
