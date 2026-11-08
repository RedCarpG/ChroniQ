import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MoonView } from '../lib/moonView'
import { litPart } from '../lib/sky'
import { useT, useZhOut } from '../settingsContext'
import { renderMoon } from './MoonGlobe'
import { useDismiss } from './useDismiss'

const W = 1080
const H = 1620
const GOLD = '#d8bf8c'
const FONT = '"Cormorant Garamond", "Noto Serif SC", "Songti SC", "STSong", serif'
/** For words with figures: the Chinese face first (Cormorant's figures are old-style) */
const FIGURES_FONT = '"Noto Serif SC", "Songti SC", "STSong", serif'

interface Words {
  title: string
  lines: string[]
}

/**
 * 月相海报: the Moon of a moment as 观月 shows it, on a field of stars, with its date, phase and
 * place: a picture to keep or share, made in the browser. Default export, loaded only when asked for.
 */
export default function MoonPoster({
  moon,
  date,
  time,
  phase,
  place,
  defaultTitle,
  title: heading,
  action,
  onClose,
}: {
  moon: MoonView
  /** The date and the time as they read on the page */
  date: string
  time: string
  /** Phase, 农历 day and how much is lit, one line */
  phase: string
  place: string
  /** The title when none is typed (else the date's Moon) */
  defaultTitle?: string
  /** The dialog's own name (else 月相海报) */
  title?: string
  /** A further step beside saving, e.g. to look at this Moon in 观月 */
  action?: { label: string; onClick: () => void }
  onClose: () => void
}) {
  const t = useT()
  // Drawn on a canvas, out of the page converter's reach
  const zh = useZhOut()
  const [title, setTitle] = useState('')
  const [withTime, setWithTime] = useState(true)
  const [withPlace, setWithPlace] = useState(true)
  const [note, setNote] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const close = useCallback(() => onClose(), [onClose])
  useDismiss(panel, true, close)

  // The Moon itself, drawn once with the larger map
  const [disc, setDisc] = useState<HTMLCanvasElement | null | 'none'>(null)
  useEffect(() => {
    let active = true
    renderMoon(moon.frame, moon.lit, 760).then((c) => active && setDisc(c ?? 'none'))
    return () => {
      active = false
    }
  }, [moon])

  const words: Words = useMemo(
    () => ({
      title: zh(title.trim() || defaultTitle || t('{date}的月亮', { date })),
      lines: [withTime ? `${date} ${time}` : date, phase, withPlace ? place : ''].filter(Boolean).map(zh),
    }),
    [title, defaultTitle, date, time, phase, place, withTime, withPlace, zh],
  )

  useEffect(() => {
    let active = true
    const draw = () => {
      if (active && canvas.current) drawMoonPoster(canvas.current, disc === 'none' ? null : disc, moon, words)
    }
    draw()
    // Drawn again once its fonts are in (where the browser can say when)
    if (document.fonts?.load)
      Promise.allSettled([document.fonts.load(`600 40px "Noto Serif SC"`, words.title + words.lines.join('') + '星曆'), document.fonts.load(`600 40px "Cormorant Garamond"`, 'ChroniQ')]).then(draw)
    return () => {
      active = false
    }
  }, [disc, moon, words])

  useEffect(() => {
    if (!note) return
    const id = setTimeout(() => setNote(null), 2200)
    return () => clearTimeout(id)
  }, [note])

  const filename = `星曆-月相-${date.replace(/[^\d]+/g, '-').replace(/^-|-$/g, '')}.png`
  const toFile = () =>
    new Promise<File>((resolve, reject) =>
      canvas.current?.toBlob((blob) => (blob ? resolve(new File([blob], filename, { type: 'image/png' })) : reject(new Error('No image'))), 'image/png'),
    )
  const save = async () => {
    setSaving(true)
    try {
      const url = URL.createObjectURL(await toFile())
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      setNote(t('图片已保存'))
    } catch {
      setNote(t('图片保存失败，请重试'))
    } finally {
      setSaving(false)
    }
  }
  const canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([], filename, { type: 'image/png' })] })
  const share = async () => {
    try {
      await navigator.share({ files: [await toFile()], title: words.title })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setNote(t('分享失败，可以先保存图片'))
    }
  }

  return createPortal(
    <div className="poster-veil">
      <div className="poster-panel" role="dialog" aria-modal="true" aria-label={heading ?? t('月相海报')} ref={panel}>
        <canvas ref={canvas} className="poster-canvas" width={W} height={H} role="img" aria-label={t('月相海报预览')} />
        <div className="poster-options">
          <h3>{heading ?? t('月相海报')}</h3>
          <button type="button" className="ghost poster-close" aria-label={t('关闭')} title={t('关闭')} onClick={onClose}>
            ✕
          </button>
          <label className="poster-title">
            {t('标题')}
            <input type="text" maxLength={16} value={title} placeholder={defaultTitle || t('{date}的月亮', { date })} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            <input type="checkbox" checked={withTime} onChange={() => setWithTime(!withTime)} />
            {t('显示时刻')}
          </label>
          <label>
            <input type="checkbox" checked={withPlace} onChange={() => setWithPlace(!withPlace)} />
            {t('显示观测地')}
          </label>
          <small className="muted">{t('海报只在本机生成：月亮按此时此地所见画出，天顶在上。')}</small>
          <div className="poster-actions">
            <button type="button" className="primary" disabled={saving} onClick={save}>
              {saving ? t('生成中…') : t('保存图片')}
            </button>
            {canShare && (
              <button type="button" className="ghost" onClick={share}>
                {t('分享')}
              </button>
            )}
          </div>
          {action && (
            <button type="button" className="ghost poster-more" onClick={action.onClick}>
              {action.label}
            </button>
          )}
          {note && <small role="status">{note}</small>}
        </div>
      </div>
    </div>,
    document.querySelector('.app') ?? document.body,
  )
}

/** The poster: a field of stars, the Moon with its glow, and the words under it */
function drawMoonPoster(canvas: HTMLCanvasElement, disc: HTMLCanvasElement | null, moon: MoonView, words: Words) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const bg = ctx.createRadialGradient(W / 2, 640, 0, W / 2, 640, H * 0.8)
  bg.addColorStop(0, '#151d38')
  bg.addColorStop(0.55, '#0a0f20')
  bg.addColorStop(1, '#04060d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  // Stars, the same every time
  let seed = 7
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < 520; i++) {
    const x = rnd() * W
    const y = rnd() * H
    const r = 0.5 + rnd() ** 4 * 2.2
    const near = Math.hypot(x - W / 2, y - 640) < 470
    ctx.globalAlpha = (near ? 0.12 : 0.18) + rnd() ** 2 * (near ? 0.2 : 0.7)
    ctx.fillStyle = rnd() < 0.15 ? '#ffe2bd' : rnd() < 0.3 ? '#c8d6ff' : '#f4efe2'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  // The Moon's light round it, and the Moon
  const size = 760
  const glow = ctx.createRadialGradient(W / 2, 640, size * 0.46, W / 2, 640, size * 0.95)
  glow.addColorStop(0, `rgba(232,236,255,${0.08 + 0.2 * moon.lit})`)
  glow.addColorStop(1, 'rgba(232,236,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  if (disc) ctx.drawImage(disc, W / 2 - size / 2, 640 - size / 2, size, size)
  else {
    // Without WebGL: the phase drawn flat, turned towards the Sun
    const r = size / 2 / 1.02
    ctx.save()
    ctx.translate(W / 2, 640)
    ctx.fillStyle = '#262b3a'
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.rotate(Math.atan2(-moon.frame.sun[1], moon.frame.sun[0]))
    ctx.fillStyle = '#e9e5d8'
    ctx.fill(new Path2D(litPart(moon.lit, r)))
    ctx.restore()
  }
  // The words
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#f3ead2'
  ctx.font = `600 66px ${FIGURES_FONT}`
  ctx.fillText(words.title, W / 2, 1180, W - 120)
  ctx.strokeStyle = GOLD
  ctx.globalAlpha = 0.6
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(W / 2 - 120, 1226)
  ctx.lineTo(W / 2 + 120, 1226)
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.font = `400 34px ${FIGURES_FONT}`
  words.lines.forEach((line, i) => {
    ctx.fillStyle = i === 1 ? GOLD : '#c9c4b8'
    ctx.fillText(line, W / 2, 1300 + i * 58, W - 120)
  })
  ctx.fillStyle = GOLD
  ctx.globalAlpha = 0.85
  ctx.font = `600 30px ${FONT}`
  ctx.fillText('星曆 ChroniQ', W / 2, H - 70)
  ctx.globalAlpha = 1
}
