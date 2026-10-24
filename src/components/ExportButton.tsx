import { useCallback, useEffect, useRef, useState } from 'react'
import type { SharedChart } from '../lib/shareLink'
import { useT } from '../settingsContext'
import { useDismiss } from './useDismiss'

/** The card each chart page saves as its image */
const TARGET = { bazi: 'bazi-natal', ziwei: 'ziwei-board', star: 'star-natal' } as const
/** Controls inside those cards, which mean nothing in a picture */
const CONTROLS = '.no-export, .zw-toolbar, .overlay-bar, .partner-form'
const PAGE_NAME = { bazi: '八字', ziwei: '紫微', star: '星盘' } as const

const FOOTER_HEIGHT = 28
const pad = (n: number) => String(n).padStart(2, '0')

/** Height the left-out controls take in the card, margins included (they stack, so they add up) */
function controlsHeight(card: HTMLElement) {
  let h = 0
  for (const el of card.querySelectorAll<HTMLElement>(CONTROLS)) {
    if (el.parentElement?.closest(CONTROLS)) continue
    const s = getComputedStyle(el)
    h += el.offsetHeight + parseFloat(s.marginTop) + parseFloat(s.marginBottom)
  }
  return h
}

/**
 * Top-bar button for keeping a chart off-screen: save the page's chart card
 * as a PNG (with a small 星曆 ChroniQ footer), or print the page (styles.css
 * @media print leaves out the controls and prints in the light palette).
 * The image library loads only when an image is first saved.
 */
export function ExportButton({ chart }: { chart: SharedChart }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  useEffect(() => {
    if (!note) return
    const id = setTimeout(() => setNote(null), 2200)
    return () => clearTimeout(id)
  }, [note])

  const saveImage = async () => {
    close()
    const card = document.getElementById(TARGET[chart.tab])
    if (!card || busy) return
    setBusy(true)
    try {
      const { domToPng } = await import('modern-screenshot')
      const style = getComputedStyle(card)
      const muted = getComputedStyle(document.documentElement).getPropertyValue('--muted')
      const url = await domToPng(card, {
        scale: 2,
        backgroundColor: style.backgroundColor,
        // The card's own size, less the controls left out, plus room for the footer added below
        width: card.offsetWidth,
        height: card.offsetHeight - controlsHeight(card) + FOOTER_HEIGHT,
        filter: (node) => !(node instanceof Element && node.matches(CONTROLS)),
        // Sign the copy, not the page
        onCloneNode: (clone) => {
          const footer = document.createElement('div')
          footer.textContent = '星曆 ChroniQ · redcarpg.github.io/ChroniQ'
          footer.setAttribute(
            'style',
            `height:${FOOTER_HEIGHT}px;line-height:${FOOTER_HEIGHT}px;font-size:11px;text-align:right;color:${muted}`,
          )
          clone.appendChild(footer)
        },
      })
      const { year, month, day } = chart.input
      const link = document.createElement('a')
      link.href = url
      link.download = `星曆-${PAGE_NAME[chart.tab]}-${year}-${pad(month)}-${pad(day)}.png`
      link.click()
      setNote(t('图片已保存'))
    } catch {
      setNote(t('图片保存失败，请改用打印'))
    } finally {
      setBusy(false)
    }
  }

  const print = () => {
    close()
    // Let the menu close before the print preview captures the page
    requestAnimationFrame(() => window.print())
  }

  return (
    <div className="share export" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-label={t('导出命盘')}
        title={t('导出命盘：保存为图片或打印')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-busy={busy}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14"
          />
        </svg>
      </button>
      {open && (
        <div className="export-menu" role="menu">
          <button type="button" role="menuitem" onClick={saveImage}>
            {t('保存为图片')}
          </button>
          <button type="button" role="menuitem" onClick={print}>
            {t('打印')}
          </button>
        </div>
      )}
      {note && (
        <div className="share-note" role="status">
          {note}
        </div>
      )}
    </div>
  )
}
