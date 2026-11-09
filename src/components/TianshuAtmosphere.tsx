// 天书: the night the 命理 pages are drawn in, laid over the stars behind the page (starfield.ts, or
// the sky of the birth, BirthSky): the east's warm ink-mist for 八字 and 紫微, the west's indigo and
// violet for 星盘; drifting motes of light and a fine grain, as on old paper or a rubbing. On 八字 the
// mist all but lifts: the sky of the birth behind it is the scene there (tianshu.css .ts-page-bazi).
import { useMemo } from 'react'

const W = 1200
const H = 900

/** Motes of light, the same every time */
function motes(seed: number, colours: string[], n: number) {
  let x = seed
  const r = () => (x = (x * 16807) % 2147483647) / 2147483647
  return Array.from({ length: n }, (_, i) => ({ key: i, cx: r() * W, cy: r() * H, r: 0.4 + r() ** 5 * 2, fill: colours[Math.floor(r() * colours.length)], opacity: 0.15 + r() * 0.6, delay: r() * 9 }))
}

export function TianshuAtmosphere({ realm, page }: { realm: 'east' | 'west'; page: string }) {
  const dots = useMemo(() => (realm === 'east' ? motes(7, ['#f2d6a8', '#e0503a', '#ebe3cf'], 110) : motes(13, ['#ffffff', '#c8d6ff', '#ffe2bd'], 150)), [realm])
  return (
    <div className={`ts-atmos ts-${realm} ts-page-${page}`} aria-hidden="true">
      <div className="ts-mist" />
      <svg className="ts-motes" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        {dots.map((d) => (
          <circle key={d.key} cx={d.cx} cy={d.cy} r={d.r} fill={d.fill} opacity={d.opacity} style={{ animationDelay: `${-d.delay}s` }} />
        ))}
      </svg>
      <svg className="ts-grain">
        <filter id="ts-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#ts-grain)" />
      </svg>
    </div>
  )
}
