// The page's background: a night sky behind everything, built to cost next to nothing.
// - The far stars, the Milky Way and a faint astrolabe are drawn once to a canvas, and again
//   only when the window's size or the colour mode changes.
// - The brighter stars sit on a second canvas. Near the mouse pointer they light up and link
//   into constellation lines, drawn only while the pointer moves or the lines fade in or out,
//   and only over the patch that changed. Nothing runs while the mouse is still; touch
//   screens, which have no pointer to follow, skip it.
// - The far canvas drifts a few pixels against the pointer, and a few stars twinkle: both are
//   CSS transforms and opacity, which the compositor runs off the main thread.
// Colours come from the theme's CSS variables (--sf-*), read at each full redraw.

/** Canvas resolution is capped: soft dots do not need more, and it keeps the memory down */
const DPR_MAX = 1.5
/** How much bigger than the window the far canvas is on each side, for the drift */
const PAD = 16
/** How far the far stars drift against the pointer, at the window's edge */
const DRIFT = 10
/** How close to the pointer a bright star lights up */
const LIGHT_RADIUS = 220
/** The longest line between two lit stars */
const LINK_LENGTH = 170
/** Lines from the pointer to the nearest lit stars */
const POINTER_LINKS = 3
/** The faint light around the pointer */
const GLOW_RADIUS = 140
/** One bright star in about this many square pixels */
const NODE_AREA = 95 * 95
const TWINKLES = 10

interface Node {
  x: number
  y: number
  r: number
  /** How lit it is, 0–1, easing toward what the pointer's distance asks */
  lit: number
}
interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** A small seeded random generator (mulberry32), so a window size always gets the same sky */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
/** Roughly normal, mean 0, spread 1 */
const gauss = (rand: () => number) => (rand() + rand() + rand() + rand() - 2) * 1.7

function colours() {
  const css = getComputedStyle(document.documentElement)
  const get = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    star: get('--sf-star', '#e8ecff'),
    warm: get('--sf-star-warm', '#ffe3b0'),
    cool: get('--sf-star-cool', '#a9c4ff'),
    haze: get('--sf-haze', '#8fa3e8'),
    line: get('--sf-line', '#d6bd8a'),
    starAlpha: Number(get('--sf-star-alpha', '1')),
    hazeAlpha: Number(get('--sf-haze-alpha', '0.07')),
    lineAlpha: Number(get('--sf-line-alpha', '0.1')),
  }
}

export function startStarfield(): () => void {
  const root = document.createElement('div')
  root.className = 'starfield'
  root.setAttribute('aria-hidden', 'true')
  const far = document.createElement('canvas')
  far.className = 'starfield-far'
  const near = document.createElement('canvas')
  near.className = 'starfield-near'
  const twinkles = document.createElement('div')
  twinkles.className = 'starfield-twinkles'
  root.append(far, near, twinkles)
  document.body.prepend(root)
  const farCtx = far.getContext('2d')!
  const nearCtx = near.getContext('2d')!

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let w = 0
  let h = 0
  let dpr = 1
  let nodes: Node[] = []
  let c = colours()

  // ---- The far sky, drawn once ----
  function drawFar() {
    const W = w + 2 * PAD
    const H = h + 2 * PAD
    far.width = Math.round(W * dpr)
    far.height = Math.round(H * dpr)
    const ctx = farCtx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    const rand = random(Math.round(W) * 7919 + Math.round(H))

    // The Milky Way: a soft band from lower left to upper right, a few brighter clouds along it,
    // and many faint stars crowded about its middle
    const angle = -Math.atan2(H * 0.75, W)
    const band = Math.max(W, H) * 0.16
    const long = Math.hypot(W, H)
    ctx.save()
    ctx.translate(W * 0.5, H * 0.55)
    ctx.rotate(angle)
    const g = ctx.createLinearGradient(0, -band, 0, band)
    g.addColorStop(0, 'transparent')
    g.addColorStop(0.5, c.haze)
    g.addColorStop(1, 'transparent')
    ctx.globalAlpha = c.hazeAlpha
    ctx.fillStyle = g
    ctx.fillRect(-long / 2, -band, long, band * 2)
    for (let i = 0; i < 7; i++) {
      const x = (rand() - 0.5) * long * 0.9
      const y = gauss(rand) * band * 0.15
      const r = band * (0.4 + rand() * 0.6)
      const cloud = ctx.createRadialGradient(x, y, 0, x, y, r)
      cloud.addColorStop(0, c.haze)
      cloud.addColorStop(1, 'transparent')
      ctx.globalAlpha = c.hazeAlpha * (0.6 + rand() * 0.6)
      ctx.fillStyle = cloud
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
    ctx.fillStyle = c.star
    const dust = Math.round((W * H) / 3200)
    for (let i = 0; i < dust; i++) {
      const x = (rand() - 0.5) * long
      const y = gauss(rand) * band * 0.32
      const s = 0.5 + rand() * 0.6
      ctx.globalAlpha = c.starAlpha * (0.15 + rand() * 0.35)
      ctx.fillRect(x, y, s, s)
    }
    ctx.restore()

    // A faint astrolabe in the upper right, and orbits rising from the lower left
    ctx.strokeStyle = c.line
    ctx.lineWidth = 1
    ctx.globalAlpha = c.lineAlpha
    const R = Math.max(W, H) * 0.3
    const ax = W * 0.86
    const ay = H * 0.16
    const ring = (r: number, dash: number[] = []) => {
      ctx.setLineDash(dash)
      ctx.beginPath()
      ctx.arc(ax, ay, r, 0, Math.PI * 2)
      ctx.stroke()
    }
    ring(R)
    ring(R * 0.93)
    ring(R * 0.78, [2, 6])
    ring(R * 0.58)
    ring(R * 0.16)
    ctx.setLineDash([])
    ctx.beginPath()
    for (let i = 0; i < 72; i++) {
      const a = (i * Math.PI) / 36
      const len = i % 6 === 0 ? R * 0.07 : R * 0.035
      ctx.moveTo(ax + Math.cos(a) * R * 0.93, ay + Math.sin(a) * R * 0.93)
      ctx.lineTo(ax + Math.cos(a) * (R * 0.93 - len), ay + Math.sin(a) * (R * 0.93 - len))
    }
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6 + Math.PI / 12
      ctx.moveTo(ax + Math.cos(a) * R * 0.16, ay + Math.sin(a) * R * 0.16)
      ctx.lineTo(ax + Math.cos(a) * R * 0.58, ay + Math.sin(a) * R * 0.58)
    }
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(ax, ay, R * 1.18, R * 0.4, -0.45, 0, Math.PI * 2)
    ctx.stroke()
    const pa = 2.3
    const [ex, ey] = [Math.cos(pa) * R * 1.18, Math.sin(pa) * R * 0.4]
    ctx.beginPath()
    ctx.arc(ax + ex * Math.cos(-0.45) - ey * Math.sin(-0.45), ay + ex * Math.sin(-0.45) + ey * Math.cos(-0.45), 3.5, 0, Math.PI * 2)
    ctx.stroke()
    const bx = -W * 0.04
    const by = H * 1.06
    for (const [r, dash] of [
      [H * 0.42, []],
      [H * 0.5, [3, 7]],
      [H * 0.62, []],
    ] as const) {
      ctx.setLineDash(dash)
      ctx.beginPath()
      ctx.arc(bx, by, r, -Math.PI / 2, 0)
      ctx.stroke()
    }
    ctx.setLineDash([])

    // The stars: most faint and small, a few bright ones with a soft glow and four points
    const count = Math.round((W * H) / 2600)
    for (let i = 0; i < count; i++) {
      const x = rand() * W
      const y = rand() * H
      const m = rand() ** 3
      const r = 0.35 + m * 1.2
      const tint = rand()
      const colour = tint < 0.12 ? c.warm : tint < 0.3 ? c.cool : c.star
      ctx.fillStyle = colour
      ctx.globalAlpha = c.starAlpha * Math.min(1, 0.25 + m * 0.7 + rand() * 0.1)
      if (r < 0.75) ctx.fillRect(x - r, y - r, r * 2, r * 2)
      else {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      if (m > 0.85) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 6)
        glow.addColorStop(0, colour)
        glow.addColorStop(1, 'transparent')
        ctx.globalAlpha = c.starAlpha * 0.3
        ctx.fillStyle = glow
        ctx.fillRect(x - r * 6, y - r * 6, r * 12, r * 12)
        ctx.strokeStyle = colour
        ctx.globalAlpha = c.starAlpha * 0.45
        ctx.lineWidth = 0.6
        ctx.beginPath()
        ctx.moveTo(x - r * 5, y)
        ctx.lineTo(x + r * 5, y)
        ctx.moveTo(x, y - r * 5)
        ctx.lineTo(x, y + r * 5)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
  }

  // ---- The bright stars, lit near the pointer ----
  function placeNodes() {
    const rand = random(Math.round(w) * 31 + Math.round(h) * 17 + 5)
    const cell = Math.sqrt(NODE_AREA)
    nodes = []
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        if (rand() > 0.66) continue
        nodes.push({ x: x + 8 + rand() * (cell - 16), y: y + 8 + rand() * (cell - 16), r: 0.8 + rand() * 0.8, lit: 0 })
      }
    }
    // A few of them twinkle
    twinkles.replaceChildren(
      ...Array.from({ length: Math.min(TWINKLES, nodes.length) }, () => {
        const n = nodes[Math.floor(rand() * nodes.length)]
        const s = document.createElement('i')
        s.style.left = `${n.x}px`
        s.style.top = `${n.y}px`
        s.style.animationDuration = `${4 + rand() * 4}s`
        s.style.animationDelay = `${-rand() * 8}s`
        return s
      }),
    )
  }

  let pointer: { x: number; y: number } | null = null
  let shown: Box | null = null
  let raf = 0
  let last = 0

  /** Draws whatever of the bright stars and lines falls in the box (all of them with none) */
  function drawNear(box: Box | null) {
    const ctx = nearCtx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.save()
    if (box) {
      ctx.beginPath()
      ctx.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0)
      ctx.clip()
      ctx.clearRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0)
    } else ctx.clearRect(0, 0, w, h)
    const inBox = (n: Node, m: number) => !box || (n.x + m > box.x0 && n.x - m < box.x1 && n.y + m > box.y0 && n.y - m < box.y1)

    ctx.fillStyle = c.star
    for (const n of nodes) {
      if (!inBox(n, 4)) continue
      ctx.globalAlpha = c.starAlpha * 0.75
      ctx.beginPath()
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
      ctx.fill()
    }

    // A faint light around the pointer
    if (pointer) {
      const glow = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, GLOW_RADIUS)
      glow.addColorStop(0, c.line)
      glow.addColorStop(1, 'transparent')
      ctx.globalAlpha = 0.1
      ctx.fillStyle = glow
      ctx.fillRect(pointer.x - GLOW_RADIUS, pointer.y - GLOW_RADIUS, GLOW_RADIUS * 2, GLOW_RADIUS * 2)
    }

    const lit = nodes.filter((n) => n.lit > 0.01)
    if (lit.length) {
      ctx.strokeStyle = c.line
      ctx.lineWidth = 0.9
      // Lines between lit stars near each other, fading with length
      for (let i = 0; i < lit.length; i++) {
        for (let j = i + 1; j < lit.length; j++) {
          const a = lit[i]
          const b = lit[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d > LINK_LENGTH) continue
          ctx.globalAlpha = Math.min(a.lit, b.lit) * (1 - d / LINK_LENGTH) * 0.9
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }
      // And from the pointer to the nearest few
      if (pointer) {
        const p = pointer
        const nearest = lit
          .filter((n) => n.lit > 0.25)
          .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))
          .slice(0, POINTER_LINKS)
        ctx.setLineDash([2, 4])
        for (const n of nearest) {
          ctx.globalAlpha = n.lit * 0.6
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(n.x, n.y)
          ctx.stroke()
        }
        ctx.setLineDash([])
      }
      // The lit stars: brighter, with a ring and four short points
      for (const n of lit) {
        ctx.globalAlpha = n.lit
        ctx.fillStyle = c.line
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r + n.lit * 0.9, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = n.lit * 0.55
        ctx.lineWidth = 0.7
        ctx.beginPath()
        ctx.arc(n.x, n.y, 3 + n.lit * 4, 0, Math.PI * 2)
        const s = 2 + n.lit * 6
        ctx.moveTo(n.x - s, n.y)
        ctx.lineTo(n.x + s, n.y)
        ctx.moveTo(n.x, n.y - s)
        ctx.lineTo(n.x, n.y + s)
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  function frame(now: number) {
    raf = 0
    const dt = last ? Math.min(64, now - last) : 16.7
    last = now
    const k = reduceMotion.matches ? 1 : 1 - Math.pow(0.8, dt / 16.7)
    let moving = false
    let box: Box | null = pointer
      ? { x0: pointer.x - GLOW_RADIUS, y0: pointer.y - GLOW_RADIUS, x1: pointer.x + GLOW_RADIUS, y1: pointer.y + GLOW_RADIUS }
      : null
    for (const n of nodes) {
      const d = pointer ? Math.hypot(n.x - pointer.x, n.y - pointer.y) : Infinity
      const target = d < LIGHT_RADIUS ? 1 - (d / LIGHT_RADIUS) ** 2 : 0
      const next = n.lit + (target - n.lit) * k
      n.lit = Math.abs(target - next) < 0.004 ? target : next
      if (n.lit !== target) moving = true
      if (n.lit > 0.01) {
        box ??= { x0: n.x, y0: n.y, x1: n.x, y1: n.y }
        box.x0 = Math.min(box.x0, n.x)
        box.y0 = Math.min(box.y0, n.y)
        box.x1 = Math.max(box.x1, n.x)
        box.y1 = Math.max(box.y1, n.y)
      }
    }
    if (box) box = { x0: box.x0 - 14, y0: box.y0 - 14, x1: box.x1 + 14, y1: box.y1 + 14 }
    // Clear and redraw what was drawn last time and what is drawn now
    const both = shown && box ? { x0: Math.min(shown.x0, box.x0), y0: Math.min(shown.y0, box.y0), x1: Math.max(shown.x1, box.x1), y1: Math.max(shown.y1, box.y1) } : (shown ?? box)
    if (both) drawNear(both)
    shown = box
    if (moving) raf = requestAnimationFrame(frame)
    else last = 0
  }
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(frame)
  }

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    pointer = { x: e.clientX, y: e.clientY }
    if (!reduceMotion.matches) {
      far.style.transform = `translate(${(-(e.clientX / w - 0.5) * 2 * DRIFT).toFixed(1)}px, ${(-(e.clientY / h - 0.5) * 2 * DRIFT).toFixed(1)}px)`
    }
    kick()
  }
  const onLeave = () => {
    pointer = null
    kick()
  }
  const onOut = (e: MouseEvent) => {
    if (!e.relatedTarget) onLeave()
  }

  // ---- Size and colour ----
  function redraw() {
    w = root.clientWidth
    h = root.clientHeight
    dpr = Math.min(DPR_MAX, window.devicePixelRatio || 1)
    c = colours()
    drawFar()
    near.width = Math.round(w * dpr)
    near.height = Math.round(h * dpr)
    placeNodes()
    for (const n of nodes) n.lit = 0
    shown = null
    drawNear(null)
    if (pointer) kick()
  }
  // Only the colours changed: keep the stars where they are
  function recolour() {
    c = colours()
    drawFar()
    drawNear(null)
  }
  let resizeTimer = 0
  const onResize = () => {
    clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => {
      // A phone's address bar coming and going changes the height a little: not worth a new sky
      if (root.clientWidth === w && Math.abs(root.clientHeight - h) < 120) return
      redraw()
    }, 150)
  }
  const dark = window.matchMedia('(prefers-color-scheme: dark)')
  const themeWatch = new MutationObserver(recolour)

  redraw()
  window.addEventListener('pointermove', onMove, { passive: true })
  document.addEventListener('mouseout', onOut)
  window.addEventListener('blur', onLeave)
  window.addEventListener('resize', onResize)
  dark.addEventListener('change', recolour)
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  return () => {
    cancelAnimationFrame(raf)
    clearTimeout(resizeTimer)
    window.removeEventListener('pointermove', onMove)
    document.removeEventListener('mouseout', onOut)
    window.removeEventListener('blur', onLeave)
    window.removeEventListener('resize', onResize)
    dark.removeEventListener('change', recolour)
    themeWatch.disconnect()
    root.remove()
  }
}
