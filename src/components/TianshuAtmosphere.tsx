// 天书: the night the 命理 pages are drawn in, laid over the stars behind the page (starfield.ts, or
// the sky of the birth, BirthSky): the east's warm ink-mist for 八字 and 紫微, the west's indigo and
// violet for 星盘; drifting motes of light and a fine grain, as on old paper or a rubbing. On 八字 the
// mist all but lifts: the sky of the birth behind it is the scene there (tianshu.css .ts-page-bazi),
// with a thin fog drifting over it, as smoke over an old plate.
import { useEffect, useMemo, useState } from 'react'
import { useParallax } from './useParallax'

const W = 1200
const H = 900

/** Motes of light, the same every time */
function motes(seed: number, colours: string[], n: number) {
  let x = seed
  const r = () => (x = (x * 16807) % 2147483647) / 2147483647
  return Array.from({ length: n }, (_, i) => ({ key: i, cx: r() * W, cy: r() * H, r: 0.4 + r() ** 5 * 2, fill: colours[Math.floor(r() * colours.length)], opacity: 0.15 + r() * 0.6, delay: r() * 9 }))
}

export function TianshuAtmosphere({ realm, page }: { realm: 'east' | 'west'; page: string }) {
  // The page's layers moving against one another with the pointer: depth (useParallax)
  useParallax(true)
  const dots = useMemo(() => (realm === 'east' ? motes(7, ['#f2d6a8', '#e0503a', '#ebe3cf'], 110) : motes(13, ['#ffffff', '#c8d6ff', '#ffe2bd'], 150)), [realm])
  const meteor = useMeteors()
  return (
    <>
    <div className={`ts-atmos ts-${realm} ts-page-${page}`} aria-hidden="true">
      <div className="ts-mist" />
      {/* 八字, 紫微 and the 历法 pages (今日, 日历): a thin fog, in drifts, moving slowly across */}
      {(page === 'bazi' || page === 'ziwei' || page === 'today' || page === 'calendar') && (
        <svg className="ts-fog">
          <filter id="ts-fog" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.0032 0.0055" numOctaves="4" seed="11" />
            {/* warm grey, there only where the noise is thick */}
            <feColorMatrix values="0 0 0 0 0.66  0 0 0 0 0.6  0 0 0 0 0.5  1.6 0 0 0 -0.62" />
          </filter>
          <rect width="100%" height="100%" filter="url(#ts-fog)" />
        </svg>
      )}
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
    {/* over the night, under the page */}
    {/* ⑧ a soft light under the pointer, as a candle over the page (moved by useParallax) */}
    <div className="ts-glow" aria-hidden="true" />
    {/* ⑨ now and then, a shooting star */}
    {meteor && (
      <i
        key={meteor.id}
        className="ts-meteor"
        aria-hidden="true"
        style={{ left: `${meteor.x}%`, top: `${meteor.y}%` }}
      />
    )}
    </>
  )
}

/** ⑨ A shooting star every 30 to 60 seconds, somewhere in the upper sky: none while the tab is hidden or
 * with 减少动态效果. Each is an element with a CSS animation, there only while it flies */
function useMeteors() {
  const [meteor, setMeteor] = useState<{ id: number; x: number; y: number } | null>(null)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let timer = 0
    let id = 0
    const next = (first = false) => {
      timer = window.setTimeout(() => {
        if (!document.hidden) setMeteor({ id: ++id, x: 8 + Math.random() * 60, y: 3 + Math.random() * 30 })
        window.setTimeout(() => setMeteor(null), 1400)
        next()
      }, first ? 6000 + Math.random() * 6000 : 30000 + Math.random() * 30000)
    }
    next(true)
    return () => clearTimeout(timer)
  }, [])
  return meteor
}
