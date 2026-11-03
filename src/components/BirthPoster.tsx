import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BaziInput } from '../lib/bazi'
import { POSTER_H, POSTER_W, drawBirthPoster, loadPosterFonts, posterScene, type PosterFigures, type PosterText } from '../lib/birthPoster'
import { enDate } from '../lib/calendar'
import { DEFAULT_PLACE } from '../lib/place'
import { moonPhaseName } from '../lib/sky'
import { toUtc } from '../lib/timeZone'
import { useSettings, useT, useTerm, useZhOut } from '../settingsContext'
import { useDismiss } from './useDismiss'

const pad = (n: number) => String(n).padStart(2, '0')
const degrees = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`

/**
 * 生辰星空海报: the poster of the sky at the moment of birth, with a preview to choose what it says.
 * The birth time and place can be left off, as a picture is often shared further than a chart.
 * Everything is made in the browser. Default export, loaded only when asked for.
 */
export default function BirthPoster({ input, onClose }: { input: BaziInput; onClose: () => void }) {
  const t = useT()
  const term = useTerm()
  // Drawn on a canvas, out of the page converter's reach
  const zh = useZhOut()
  const { language, script } = useSettings()
  const en = language === 'en'
  const place = input.place ?? DEFAULT_PLACE
  const [title, setTitle] = useState('')
  const [withTime, setWithTime] = useState(true)
  const [withPlace, setWithPlace] = useState(true)
  const [figures, setFigures] = useState<PosterFigures>('west')
  const [note, setNote] = useState<string | null>(null)
  // A picture this size takes a moment to encode
  const [saving, setSaving] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const close = useCallback(() => onClose(), [onClose])
  useDismiss(panel, true, close)

  const scene = useMemo(() => {
    const { year, month, day, hour, minute } = input
    return posterScene(toUtc({ year, month, day, hour, minute }, place.timeZone).date, place.latitude, place.longitude, figures)
  }, [input, place, figures])

  const text: PosterText = useMemo(() => {
    const { year, month, day, hour, minute } = input
    const date = en ? enDate(year, month, day, { day: 'numeric', month: 'long', year: 'numeric' }) : `${year}年${month}月${day}日`
    const phase = scene.moonPhase === undefined ? '' : t('{phase} · 照亮 {pct}%', { phase: t(moonPhaseName(scene.moonPhase)), pct: Math.round(scene.moonLit * 100) })
    const words: PosterText = {
      title: title.trim() || t('出生时的星空'),
      lines: [
        withTime ? `${date} ${pad(hour)}:${pad(minute)}` : date,
        withPlace ? `${t(place.name)} · ${degrees(place.latitude, 'N', 'S')} ${degrees(place.longitude, 'E', 'W')}` : '',
        phase,
      ],
      note: scene.daytime ? t('那时天色尚亮，星星是图中示意的位置') : undefined,
      compass: en ? ['N', 'E', 'S', 'W'] : ['北', '东', '南', '西'],
      bodyName: (b) => t(b.name),
      figureName: (c) => (figures === 'west' && c.rank > 2 ? '' : figures === 'west' && en ? c.en : script === 'trad' ? c.trad : c.name),
    }
    return {
      ...words,
      title: zh(words.title),
      lines: words.lines.map(zh),
      note: words.note && zh(words.note),
      compass: words.compass.map(zh) as PosterText['compass'],
      bodyName: (b) => zh(words.bodyName(b)),
      figureName: (c) => zh(words.figureName(c)),
    }
  }, [input, title, withTime, withPlace, figures, scene, en, script, place, language, zh])

  // Drawn once its fonts are in, and again on each change
  useEffect(() => {
    let active = true
    const words = [text.title, ...text.lines, text.note ?? '', ...text.compass, ...scene.bodies.map(text.bodyName), ...scene.figures.map(text.figureName), '星曆 ChroniQ'].join('')
    const draw = () => {
      if (active && canvas.current) drawBirthPoster(canvas.current, scene, text)
    }
    draw()
    loadPosterFonts(words).then(draw)
    return () => {
      active = false
    }
  }, [scene, text])

  useEffect(() => {
    if (!note) return
    const id = setTimeout(() => setNote(null), 2200)
    return () => clearTimeout(id)
  }, [note])

  const filename = `星曆-生辰星空-${input.year}-${pad(input.month)}-${pad(input.day)}.png`
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
      await navigator.share({ files: [await toFile()], title: text.title })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setNote(t('分享失败，可以先保存图片'))
    }
  }

  return createPortal(
    <div className="poster-veil">
      <div className="poster-panel" role="dialog" aria-modal="true" aria-label={t('生辰星空海报')} ref={panel}>
        <canvas ref={canvas} className="poster-canvas" width={POSTER_W} height={POSTER_H} role="img" aria-label={t('生辰星空海报预览')} />
        <div className="poster-options">
          <h3>{t('生辰星空海报')}</h3>
          <button type="button" className="ghost poster-close" aria-label={t('关闭')} title={t('关闭')} onClick={onClose}>
            ✕
          </button>
          <label className="poster-title">
            {t('标题')}
            <input type="text" maxLength={16} value={title} placeholder={t('出生时的星空')} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <div className="seg small" role="group" aria-label={t('连线')}>
            {(
              [
                ['west', t('西方星座')],
                ['mansions', term('二十八宿')],
                ['none', t('不显示')],
              ] as const
            ).map(([v, label]) => (
              <button key={v} type="button" className={figures === v ? 'on' : undefined} aria-pressed={figures === v} onClick={() => setFigures(v)}>
                {label}
              </button>
            ))}
          </div>
          <label>
            <input type="checkbox" checked={withTime} onChange={() => setWithTime(!withTime)} />
            {t('显示出生时刻')}
          </label>
          <label>
            <input type="checkbox" checked={withPlace} onChange={() => setWithPlace(!withPlace)} />
            {t('显示出生地')}
          </label>
          <small className="muted">{t('海报只在本机生成。出生日期、时刻和地点属于个人信息，分享前可以隐藏时刻和地点。')}</small>
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
          {note && <small role="status">{note}</small>}
        </div>
      </div>
    </div>,
    document.querySelector('.app') ?? document.body,
  )
}
