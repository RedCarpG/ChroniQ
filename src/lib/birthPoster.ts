// 生辰星空海报: the sky over the birthplace at the moment of birth as a picture to keep or share. The
// sky is worked out here and drawn to a canvas, so the picture is the same whatever the screen.
import { WESTERN } from './constellations'
import { constellationsAt, directionsAt, fieldStars, litPart, milkyWayAt, skyAt, towards, type SkyBody } from './sky'
import { XINGGUAN } from './xingguan'

export const POSTER_W = 1080
export const POSTER_H = 1620
const CX = POSTER_W / 2
const CY = 640
const RIM = 450
const RAD = Math.PI / 180

export type PosterFigures = 'west' | 'mansions' | 'none'

/** Where a place in the sky falls on the poster: the zenith in the middle, north up, east to the left */
export function posterPoint(az: number, alt: number): [number, number] {
  const r = (RIM * (90 - alt)) / 90
  return [CX - r * Math.sin(az * RAD), CY - r * Math.cos(az * RAD)]
}

/** What there is to draw for a moment and place: only what is above the horizon, but for the figures, clipped when drawn */
export function posterScene(utc: Date, latitude: number, longitude: number, figures: PosterFigures) {
  const sky = skyAt(utc, latitude, longitude)
  const field = fieldStars()
  const faint = directionsAt(field.v, utc, latitude, longitude)
  const milky = milkyWayAt(utc, latitude, longitude)
  const set = figures === 'west' ? WESTERN : figures === 'mansions' ? XINGGUAN.filter((c) => c.rank === 1) : []
  return {
    daytime: sky.sunAlt > -6,
    moonPhase: sky.bodies.find((b) => b.key === 'moon')?.phase,
    moonLit: sky.bodies.find((b) => b.key === 'moon')?.lit ?? 0,
    stars: sky.stars.filter((s) => s.alt > 0),
    faint: { az: faint.az, alt: faint.alt, weight: field.weight },
    milky,
    figures: constellationsAt(set, utc, latitude, longitude),
    // The Sun, the Moon and the planets one can see
    bodies: sky.bodies.filter((b) => b.alt > 0 && ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'].includes(b.key)),
    sun: sky.bodies.find((b) => b.key === 'sun')!,
  }
}
export type PosterScene = ReturnType<typeof posterScene>

export interface PosterText {
  title: string
  /** Lines under the title, each dropped if empty */
  lines: string[]
  /** A small note at the foot of the words */
  note?: string
  compass: [string, string, string, string]
  /** A body's name, a figure's name (or nothing, for one too minor to name) */
  bodyName: (b: SkyBody) => string
  figureName: (c: PosterScene['figures'][number]) => string
}

const COLOURS: Record<string, string> = { sun: '#ffcf4a', moon: '#ece6d6', mercury: '#c9bfb1', venus: '#fff3c9', mars: '#ff8a62', jupiter: '#f4d7a8', saturn: '#ead28f' }
const GOLD = '#d8bf8c'
const FONT = '"Cormorant Garamond", "Noto Serif SC", "Songti SC", "STSong", serif'
/** For words with figures: the Chinese face first, as Cormorant's figures are old-style and a canvas cannot ask for others */
const FIGURES_FONT = '"Noto Serif SC", "Songti SC", "STSong", serif'
const starColour = (bv: number) => (bv < 0 ? '#a9bfff' : bv < 0.3 ? '#d4dfff' : bv < 0.6 ? '#f8f7ff' : bv < 1 ? '#fff1dc' : bv < 1.4 ? '#ffd6a8' : '#ffb98a')

/** The fonts the poster's words want, fetched before it is drawn (a canvas does not wait for them) */
export async function loadPosterFonts(text: string) {
  await Promise.allSettled([document.fonts.load(`600 40px "Noto Serif SC"`, text), document.fonts.load(`600 40px "Cormorant Garamond"`, text)])
}

function drawMilkyWay(ctx: CanvasRenderingContext2D, scene: PosterScene) {
  const layers = [
    { blur: 34, width: 3.2, colour: '150 170 225', alpha: (a: number) => Math.min(0.12, 0.03 + 0.06 * a) },
    { blur: 16, width: 1.6, colour: '190 200 235', alpha: (a: number) => Math.min(0.18, 0.03 + 0.1 * a) },
    { blur: 7, width: 0.7, colour: '240 232 214', alpha: (a: number) => (a > 0.55 ? Math.min(0.2, 0.22 * (a - 0.55)) : 0) },
  ]
  const deg = RIM / 90
  const spine = scene.milky.spine
  for (const layer of layers) {
    // Strokes of about the same opacity and width share a path, or they would pile up where they overlap
    const groups = new Map<string, { path: Path2D; alpha: number; width: number }>()
    spine.forEach((p, i) => {
      const q = spine[(i + 1) % spine.length]
      if (Math.max(p.alt, q.alt) < -10) return
      const alpha = Math.round(layer.alpha((p.weight + q.weight) / 2) * 50) / 50
      if (alpha <= 0) return
      const width = Math.round((((p.size ?? 4) + (q.size ?? 4)) / 2) * deg * layer.width)
      const key = `${alpha} ${width}`
      let group = groups.get(key)
      if (!group) groups.set(key, (group = { path: new Path2D(), alpha, width }))
      const [x1, y1] = posterPoint(p.az, p.alt)
      const [x2, y2] = posterPoint(q.az, q.alt)
      group.path.moveTo(x1, y1)
      group.path.lineTo(x2, y2)
    })
    ctx.save()
    ctx.filter = `blur(${layer.blur}px)`
    ctx.lineCap = 'round'
    for (const g of groups.values()) {
      ctx.strokeStyle = `rgb(${layer.colour} / ${g.alpha})`
      ctx.lineWidth = g.width
      ctx.stroke(g.path)
    }
    ctx.restore()
  }
}

function drawBody(ctx: CanvasRenderingContext2D, b: SkyBody, scene: PosterScene, name: string) {
  const [x, y] = posterPoint(b.az, b.alt)
  const r = b.key === 'sun' ? 15 : b.key === 'moon' ? 14 : Math.min(9, Math.max(5, 7 - 0.6 * b.mag))
  ctx.save()
  const glow = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 3.4)
  glow.addColorStop(0, `${COLOURS[b.key]}66`)
  glow.addColorStop(1, `${COLOURS[b.key]}00`)
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, y, r * 3.4, 0, Math.PI * 2)
  ctx.fill()
  if (b.key === 'moon') {
    // The Moon as it looked: its lit part turned towards the Sun
    const step = towards(b, scene.sun, 0.5)
    const [x1, y1] = posterPoint(step.az, step.alt)
    ctx.translate(x, y)
    ctx.fillStyle = '#2b2f3f'
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.rotate(Math.atan2(y1 - y, x1 - x))
    ctx.fillStyle = COLOURS.moon
    ctx.fill(new Path2D(litPart(b.lit, r)))
  } else {
    ctx.fillStyle = COLOURS[b.key]
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
  ctx.font = `600 24px ${FONT}`
  ctx.fillStyle = COLOURS[b.key]
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, x + r + 8, y)
}

/** Draws the poster, at POSTER_W by POSTER_H */
export function drawBirthPoster(canvas: HTMLCanvasElement, scene: PosterScene, text: PosterText) {
  canvas.width = POSTER_W
  canvas.height = POSTER_H
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const page = ctx.createLinearGradient(0, 0, 0, POSTER_H)
  page.addColorStop(0, '#070a16')
  page.addColorStop(0.55, '#0b1024')
  page.addColorStop(1, '#070a16')
  ctx.fillStyle = page
  ctx.fillRect(0, 0, POSTER_W, POSTER_H)

  // The sky, always as by night: a birth by day has its stars shown too
  ctx.save()
  ctx.beginPath()
  ctx.arc(CX, CY, RIM, 0, Math.PI * 2)
  ctx.clip()
  const dome = ctx.createRadialGradient(CX, CY, 0, CX, CY, RIM)
  dome.addColorStop(0, '#16204a')
  dome.addColorStop(0.75, '#0e1533')
  dome.addColorStop(1, '#0a0f26')
  ctx.fillStyle = dome
  ctx.fillRect(CX - RIM, CY - RIM, RIM * 2, RIM * 2)
  drawMilkyWay(ctx, scene)
  const { az, alt, weight } = scene.faint
  for (let i = 0; i < az.length; i++) {
    if (alt[i] <= 0) continue
    const [x, y] = posterPoint(az[i], alt[i])
    ctx.fillStyle = `rgb(220 228 255 / ${0.12 + 0.28 * weight[i]})`
    ctx.fillRect(x, y, 1.4, 1.4)
  }
  ctx.strokeStyle = 'rgb(216 191 140 / 0.42)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (const f of scene.figures) {
    for (const line of f.lines) {
      line.forEach((p, i) => {
        const [x, y] = posterPoint(p.az, p.alt)
        if (i) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      })
    }
  }
  ctx.stroke()
  for (const s of scene.stars) {
    const [x, y] = posterPoint(s.az, s.alt)
    const r = Math.max(0.9, 4.4 - 0.72 * s.mag)
    ctx.fillStyle = starColour(s.bv)
    ctx.globalAlpha = Math.min(1, 0.55 + (6 - s.mag) * 0.1)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.font = `600 19px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgb(216 191 140 / 0.72)'
  for (const f of scene.figures) {
    const name = f.label.alt > 4 ? text.figureName(f) : ''
    if (!name) continue
    const [x, y] = posterPoint(f.label.az, f.label.alt)
    ctx.fillText(name, x, y)
  }
  for (const b of scene.bodies) drawBody(ctx, b, scene, text.bodyName(b))
  ctx.restore()

  // The horizon: two fine gold rings, with the degrees and the four directions
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(CX, CY, RIM, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.5
  ctx.beginPath()
  ctx.arc(CX, CY, RIM + 26, 0, Math.PI * 2)
  ctx.stroke()
  for (let d = 0; d < 360; d += 5) {
    const long = d % 30 === 0
    const [s, c] = [Math.sin(d * RAD), Math.cos(d * RAD)]
    ctx.beginPath()
    ctx.moveTo(CX - s * (RIM + 26), CY - c * (RIM + 26))
    ctx.lineTo(CX - s * (RIM + (long ? 12 : 20)), CY - c * (RIM + (long ? 12 : 20)))
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = GOLD
  ctx.font = `600 30px ${FONT}`
  text.compass.forEach((label, i) => {
    const d = i * 90
    ctx.fillText(label, CX - Math.sin(d * RAD) * (RIM + 54), CY - Math.cos(d * RAD) * (RIM + 54))
  })

  // The words
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#f1ead9'
  ctx.font = `600 60px ${FONT}`
  ctx.fillText(text.title, CX, 1250)
  ctx.fillStyle = GOLD
  ctx.fillRect(CX - 60, 1282, 120, 1.5)
  ctx.font = `600 30px ${FIGURES_FONT}`
  ctx.fillStyle = '#e9e5da'
  let y = 1336
  for (const line of text.lines.filter(Boolean)) {
    ctx.fillText(line, CX, y)
    y += 46
  }
  if (text.note) {
    ctx.font = `600 21px ${FIGURES_FONT}`
    ctx.fillStyle = 'rgb(233 229 218 / 0.6)'
    ctx.fillText(text.note, CX, y + 2)
  }
  ctx.font = `600 21px ${FIGURES_FONT}`
  ctx.fillStyle = 'rgb(216 191 140 / 0.75)'
  ctx.fillText('星曆 ChroniQ · redcarpg.github.io/ChroniQ', CX, POSTER_H - 44)
}
