// 生辰星空: the sky over the birthplace at the moment of birth, behind the 八字 page, and the
// 五星 under the 五行 they are named for. Loaded only with the 八字 page (it brings the star
// catalogue and astronomy-engine).
import * as A from 'astronomy-engine'
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { ElementName } from '../lib/bazi'
import { FIVE_STARS } from '../lib/fiveStars'
import { mansionOf } from '../lib/mansions'
import { litPath } from '../lib/moon'
import { constellationsAt, milkyWayAt, skyAt, type Sky, type SkyBody } from '../lib/sky'
import { XINGGUAN } from '../lib/xingguan'
import { useT, useTerm } from '../settingsContext'

/** The moment and place of birth (clock time at the birthplace: the sky as it was, not 真太阳时) */
export interface BirthMoment {
  utc: Date
  latitude: number
  longitude: number
}

const ELEMENT_COLOUR: Record<ElementName, string> = {
  木: 'var(--wood)',
  火: 'var(--fire)',
  土: 'var(--earth)',
  金: 'var(--metal)',
  水: 'var(--water)',
}
const MANSION_FIGURES = XINGGUAN.filter((c) => c.rank === 1)
const RAD = Math.PI / 180

/** One sky for the backdrop and the 五星 row, worked out once a moment */
let last: { key: string; sky: Sky } | null = null
const keyOf = (m: BirthMoment) => `${m.utc.getTime()} ${m.latitude} ${m.longitude}`
function skyOf(m: BirthMoment): Sky {
  const key = keyOf(m)
  if (last?.key !== key) last = { key, sky: skyAt(m.utc, m.latitude, m.longitude) }
  return last.sky
}

/** Star colour from its B−V index, as on the 天象 map */
const starColour = (bv: number) =>
  bv < 0
    ? '#a9bfff'
    : bv < 0.3
      ? '#d4dfff'
      : bv < 0.6
        ? '#f8f7ff'
        : bv < 1
          ? '#fff1dc'
          : bv < 1.4
            ? '#ffd6a8'
            : '#ffb98a'
const starRadius = (mag: number) => Math.max(0.7, 2.8 - 0.45 * mag)

function useViewport() {
  const read = () => ({ w: window.innerWidth, h: window.innerHeight })
  const [size, setSize] = useState(read)
  useEffect(() => {
    let raf = 0
    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() =>
        setSize((s) => {
          const n = read()
          // A phone's address bar coming and going: not worth a new sky
          return n.w === s.w && Math.abs(n.h - s.h) < 120 ? s : n
        }),
      )
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])
  return size
}

const DPR_MAX = 1.5

/** The theme's colours for the sky (styles.css --bs-*), read each time it is drawn */
function palette() {
  const css = getComputedStyle(document.documentElement)
  const get = (name: string) => css.getPropertyValue(name).trim()
  return {
    /** Empty in the dark: the stars keep their own colours */
    star: get('--bs-star'),
    starAlpha: Number(get('--bs-star-alpha') || 0.9),
    milkyAlpha: Number(get('--bs-milky-alpha') || 0.6),
    mw: { haze: get('--bs-mw-haze'), body: get('--bs-mw-body'), core: get('--bs-mw-core') },
    grain: get('--bs-mw-grain'),
    figure: get('--bs-figure'),
    label: get('--bs-label'),
  }
}

/** A number that changes with the colour mode (setting or system), to draw the sky again */
function useThemeVersion() {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1)
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    const watch = new MutationObserver(bump)
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    dark.addEventListener('change', bump)
    return () => {
      watch.disconnect()
      dark.removeEventListener('change', bump)
    }
  }, [])
  return version
}

/**
 * The backdrop: the dome of the sky as one lies looking up (the zenith in the middle of the
 * screen, north up, east to the left), reaching the horizon at the screen's corners. The stars,
 * the Milky Way and the 二十八宿 are drawn once to a canvas, so the page scrolls over them at no
 * cost; the Sun, Moon and 五星, in the colours of their 五行, are a few elements over it. A new
 * chart's sky turns and fades into place (浮现), after the chart itself has changed.
 */
export function BirthSky({ moment: now, focus }: { moment: BirthMoment; focus: string | null }) {
  const term = useTerm()
  const moment = useDeferredValue(now)
  const { w, h } = useViewport()
  const theme = useThemeVersion()
  const key = keyOf(moment)
  const sky = skyOf(moment)
  const R = Math.hypot(w, h) / 2
  const at = (az: number, alt: number): [number, number] => {
    const r = (R * (90 - alt)) / 90
    return [-r * Math.sin(az * RAD), -r * Math.cos(az * RAD)]
  }

  // Everything but the Sun, Moon and planets: made again only for a new moment or screen size
  const still = useMemo(() => {
    const dots = new Map<string, Map<number, string>>()
    for (const st of sky.stars) {
      const [x, y] = at(st.az, st.alt)
      if (Math.abs(x) > w / 2 + 4 || Math.abs(y) > h / 2 + 4) continue
      const colour = starColour(st.bv)
      const width = Math.round(starRadius(st.mag) * 40) / 20
      let sizes = dots.get(colour)
      if (!sizes) dots.set(colour, (sizes = new Map()))
      sizes.set(width, (sizes.get(width) ?? '') + `M${x.toFixed(1)} ${y.toFixed(1)}h.01`)
    }
    // The Milky Way as on the 天象 map: short strokes along the band's centre line, each as wide and
    // as bright as the band is there, in three blurred layers that run together (haze, body and a
    // brighter core), with its grain of faint stars over them
    const milky = milkyWayAt(moment.utc, moment.latitude, moment.longitude)
    const grain = ['', '', '']
    for (let i = 0; i < milky.grain.az.length; i++) {
      if (milky.grain.alt[i] < 0) continue
      const [x, y] = at(milky.grain.az[i], milky.grain.alt[i])
      grain[milky.grain.weight[i]] += `M${x.toFixed(0)} ${y.toFixed(0)}h.01`
    }
    const deg = R / 90
    const band: { d: string; w: number; a: number }[] = []
    milky.spine.forEach((p, i) => {
      const q = milky.spine[(i + 1) % milky.spine.length]
      if (Math.max(p.alt, q.alt) < -10) return
      const [x1, y1] = at(p.az, p.alt)
      const [x2, y2] = at(q.az, q.alt)
      band.push({
        d: `M${x1.toFixed(0)} ${y1.toFixed(0)}L${x2.toFixed(0)} ${y2.toFixed(0)}`,
        w: (((p.size ?? 4) + (q.size ?? 4)) / 2) * deg,
        a: (p.weight + q.weight) / 2,
      })
    })
    // Strokes of about the same opacity and width share a path
    const layer = (width: number, opacity: (a: number) => number) => {
      const groups = new Map<string, { d: string; w: number; o: number }>()
      for (const b of band) {
        const o = Math.round(opacity(b.a) * 50) / 50
        if (o <= 0) continue
        const w = Math.round(b.w * width)
        const g = groups.get(`${o} ${w}`)
        if (g) g.d += b.d
        else groups.set(`${o} ${w}`, { d: b.d, w, o })
      }
      return [...groups.values()]
    }
    const bands = [
      { kind: 'haze', blur: 22, groups: layer(3.4, (a) => Math.min(0.32, 0.09 + 0.14 * a)) },
      { kind: 'body', blur: 10, groups: layer(1.7, (a) => Math.min(0.55, 0.1 + 0.28 * a)) },
      { kind: 'core', blur: 5, groups: layer(0.75, (a) => (a > 0.55 ? Math.min(0.6, 0.5 * (a - 0.55)) : 0)) },
    ] as const
    const figures = constellationsAt(MANSION_FIGURES, moment.utc, moment.latitude, moment.longitude)
    const twinkles = sky.stars
      .filter((st) => st.mag < 1.6 && st.alt > 5)
      .map((st) => ({ hip: st.hip, at: at(st.az, st.alt), colour: starColour(st.bv), size: 7 + (1.6 - st.mag) * 3 }))
      .filter(({ at: [x, y] }) => Math.abs(x) < w / 2 && Math.abs(y) < h / 2)
      .slice(0, 14)
    return {
      dots: [...dots].flatMap(([colour, sizes]) => [...sizes].map(([width, d]) => ({ colour, width, d }))),
      grain,
      bands,
      figures: figures
        .map((f) =>
          f.lines
            .map(
              (l) =>
                `M${l
                  .map((p) =>
                    at(p.az, p.alt)
                      .map((v) => v.toFixed(1))
                      .join(' '),
                  )
                  .join('L')}`,
            )
            .join(''),
        )
        .join(''),
      labels: figures
        .filter((f) => f.label.alt > 2)
        .map((f) => ({ id: f.id, name: f.name, at: at(f.label.az, f.label.alt) })),
      twinkles,
    }
    // at follows R, w and h
  }, [key, w, h])

  // Drawn to the canvas when the sky, the screen size or the colour mode changes
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Two small canvases for the Milky Way's blur, kept from one drawing to the next
  const scratch = useRef<[HTMLCanvasElement, HTMLCanvasElement] | null>(null)
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(DPR_MAX, window.devicePixelRatio || 1)
    // A new size makes a new bitmap: only when the size changes, else the old one is cleared
    const [cw, ch] = [Math.round(w * dpr), Math.round(h * dpr)]
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw
      canvas.height = ch
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, cw, ch)
    }
    const c = palette()
    ctx.setTransform(dpr, 0, 0, dpr, (w / 2) * dpr, (h / 2) * dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    // The Milky Way is all soft light: each band is drawn at a quarter of the size, blurred there
    // once (where the browser can filter, Safari only since 18; elsewhere by the image's shadow,
    // cast from far off), and laid over the sky scaled up
    const Q = 4
    const [glow, band] = (scratch.current ??= [document.createElement('canvas'), document.createElement('canvas')])
    for (const el of [glow, band]) {
      if (el.width !== Math.ceil(w / Q) || el.height !== Math.ceil(h / Q)) {
        el.width = Math.ceil(w / Q)
        el.height = Math.ceil(h / Q)
      }
    }
    const glowCtx = glow.getContext('2d')!
    const bandCtx = band.getContext('2d')!
    glowCtx.clearRect(0, 0, glow.width, glow.height)
    const canFilter: boolean = 'filter' in glowCtx
    for (const b of still.bands) {
      bandCtx.setTransform(1, 0, 0, 1, 0, 0)
      bandCtx.clearRect(0, 0, band.width, band.height)
      bandCtx.setTransform(1 / Q, 0, 0, 1 / Q, w / 2 / Q, h / 2 / Q)
      bandCtx.strokeStyle = c.mw[b.kind]
      for (const g of b.groups) {
        bandCtx.globalAlpha = g.o
        bandCtx.lineWidth = g.w
        bandCtx.stroke(new Path2D(g.d))
      }
      if (canFilter) {
        glowCtx.filter = `blur(${b.blur / Q}px)`
        glowCtx.drawImage(band, 0, 0)
        glowCtx.filter = 'none'
      } else {
        const off = band.width + 50
        glowCtx.shadowColor = c.mw[b.kind]
        glowCtx.shadowBlur = (2 * b.blur) / Q
        glowCtx.shadowOffsetX = off
        glowCtx.drawImage(band, -off, 0)
        glowCtx.shadowColor = 'transparent'
      }
    }
    ctx.globalAlpha = c.milkyAlpha
    ctx.drawImage(glow, -w / 2, -h / 2, glow.width * Q, glow.height * Q)
    ctx.lineCap = 'round'
    ctx.strokeStyle = c.grain
    still.grain.forEach((d, i) => {
      if (!d) return
      ctx.globalAlpha = c.milkyAlpha * [0.22, 0.34, 0.48][i]
      ctx.lineWidth = [1.1, 1.3, 1.5][i]
      ctx.stroke(new Path2D(d))
    })
    ctx.globalAlpha = 1
    ctx.strokeStyle = c.figure
    ctx.lineWidth = 1
    ctx.stroke(new Path2D(still.figures))
    ctx.globalAlpha = c.starAlpha
    for (const g of still.dots) {
      ctx.strokeStyle = c.star || g.colour
      ctx.lineWidth = g.width
      ctx.stroke(new Path2D(g.d))
    }
    ctx.globalAlpha = 1
    // The 宿 names, but not on a phone, where the chart covers nearly all the sky
    if (w > 640) {
      ctx.fillStyle = c.label
      ctx.font = `13px ${getComputedStyle(canvas).fontFamily}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const l of still.labels) ctx.fillText(term(l.name.slice(0, 1)), l.at[0], l.at[1])
    }
  }, [still, theme, term])

  const sun = sky.bodies.find((b) => b.key === 'sun')!
  const moon = sky.bodies.find((b) => b.key === 'moon')!
  const onScreen = (b: SkyBody) => {
    const [x, y] = at(b.az, b.alt)
    return b.alt > -1 && Math.abs(x) < w / 2 + 20 && Math.abs(y) < h / 2 + 20
  }
  const place = (b: SkyBody): CSSProperties => {
    const [x, y] = at(b.az, b.alt)
    return { left: `calc(50% + ${x.toFixed(1)}px)`, top: `calc(50% + ${y.toFixed(1)}px)` }
  }
  // The Moon lit on the side toward the Sun
  const moonAt = at(moon.az, moon.alt)
  const sunAt = at(sun.az, sun.alt)
  const elongation = A.MoonPhase(moment.utc)
  const moonTurn = (Math.atan2(sunAt[1] - moonAt[1], sunAt[0] - moonAt[0]) / RAD + (elongation < 180 ? 0 : 180)) % 360

  // 浮现: each new sky turns a little and fades into place. Played on the element that stays (a new
  // one would mean a new canvas), and only backwards-filled: an animation left in effect keeps the
  // whole sky a layer with an effect of its own, composited again on every frame the page scrolls
  const rootRef = useRef<HTMLDivElement>(null)
  const lastChange = useRef(-Infinity)
  useLayoutEffect(() => {
    // Stepping quickly through dates, the sky just changes: it comes in again only after a pause
    const now = performance.now()
    const quick = now - lastChange.current < 1500
    lastChange.current = now
    if (quick || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    rootRef.current?.animate?.(
      [
        { opacity: 0, transform: 'scale(1.05) rotate(-4deg)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 2600, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'backwards' },
    )
  }, [key])

  return createPortal(
    <div
      ref={rootRef}
      className={`birth-sky ${sky.light}`}
      style={
        {
          '--sun-x': `calc(50% + ${sunAt[0].toFixed(0)}px)`,
          '--sun-y': `calc(50% + ${sunAt[1].toFixed(0)}px)`,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <canvas ref={canvasRef} />
      {/* 日 and 月, then the 五星, each in the colour of its 五行 */}
      {onScreen(sun) && (
        <span className={`bs-body sun${focus === 'sun' ? ' on' : ''}`} style={place(sun)}>
          <i className="glow" />
          <i className="disc" />
        </span>
      )}
      {onScreen(moon) && (
        <span className={`bs-body moon${focus === 'moon' ? ' on' : ''}`} style={place(moon)}>
          <i className="glow" style={{ opacity: 0.2 + 0.4 * moon.lit }} />
          <svg viewBox="-7 -7 14 14">
            <circle className="shade" r="6" />
            <path className="lit" d={litPath(elongation, 6)} transform={`rotate(${moonTurn.toFixed(0)})`} />
          </svg>
        </span>
      )}
      {FIVE_STARS.map((f) => {
        const b = sky.bodies.find((x) => x.key === f.key)!
        return (
          onScreen(b) && (
            <span
              key={f.key}
              className={`bs-body planet${focus === f.key ? ' on' : ''}`}
              style={{ ...place(b), color: ELEMENT_COLOUR[f.element] }}
            >
              <i className="glow" />
              <i className="ring" />
              <i
                className="disc"
                style={{ '--d': `${Math.min(7, Math.max(4, 5.6 - 0.6 * b.mag)).toFixed(1)}px` } as CSSProperties}
              />
              <b>{term(f.name)}</b>
            </span>
          )
        )
      })}
      <div className="bs-twinkles">
        {still.twinkles.map((tw) => (
          <i
            key={tw.hip}
            style={
              {
                left: `calc(50% + ${tw.at[0].toFixed(1)}px)`,
                top: `calc(50% + ${tw.at[1].toFixed(1)}px)`,
                '--c': tw.colour,
                '--s': `${tw.size.toFixed(1)}px`,
                animationDuration: `${2.8 + (tw.hip % 7) * 0.5}s`,
                animationDelay: `${-((tw.hip % 13) * 0.41)}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>,
    document.body,
  )
}

/**
 * 五星 under the 五行 bars, one under each: the 宿 it stood in at birth and whether it was above
 * the horizon; then where the Sun and Moon were (日躔, 月离) and whether it was day or night.
 * Pointing at one picks it out in the backdrop.
 */
export function FiveStars({
  moment,
  focus,
  pick,
}: {
  moment: BirthMoment
  focus: string | null
  /** Props that light up a body (usePick's) */
  pick: (key: string) => Record<string, unknown>
}) {
  const t = useT()
  const term = useTerm()
  const sky = skyOf(moment)
  const body = (key: string) => sky.bodies.find((b) => b.key === key)!
  const where = (b: SkyBody) => term(mansionOf(b.ra).mansion.name)
  const height = (b: SkyBody) => (b.alt > 0 ? t('地平上 {alt}°', { alt: Math.round(b.alt) }) : t('地平下'))
  const point = pick
  const sun = body('sun')
  const moon = body('moon')
  return (
    <div className="five-stars-block">
      <div className="five-stars">
        {FIVE_STARS.map((f) => {
          const b = body(f.key)
          return (
            <div
              key={f.key}
              className={`five-star${b.alt > 0 ? ' up' : ''}${focus === f.key ? ' on' : ''}`}
              style={{ '--el': ELEMENT_COLOUR[f.element] } as CSSProperties}
              tabIndex={0}
              title={t('{name}（{west}）· {mansion} · {height}', {
                name: term(f.name),
                west: t(f.west),
                mansion: where(b),
                height: height(b),
              })}
              {...point(f.key)}
            >
              <span className="fs-name">
                <i aria-hidden="true">{b.alt > 0 ? '✦' : '✧'}</i>
                {term(f.name)}
              </span>
              <span className="fs-where">
                {where(b)} · {height(b)}
              </span>
            </div>
          )
        })}
      </div>
      <p className="five-stars-note muted">
        <span tabIndex={0} {...point('sun')}>
          {t('日躔{mansion}', { mansion: where(sun) })}
        </span>
        {' · '}
        <span tabIndex={0} {...point('moon')}>
          {t('月离{mansion}', { mansion: where(moon) })}
        </span>
        {' · '}
        {sun.alt > -0.8 ? t('昼生') : t('夜生')}
      </p>
    </div>
  )
}
