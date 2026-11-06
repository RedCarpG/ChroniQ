// The full-screen pages (观月, 太阳系; 天象 is laid out the same way in SkyView): what the page is
// about drawn over the whole screen behind it (the backdrop, put into <body> so the page's zoom does
// not scale it), and the page's controls laid over it. A bar of controls at the top left, a panel of
// details on the right that folds away, and a strip along the bottom. On a phone the panel is a
// sheet at the bottom: one line and the bottom strip when folded, half the screen or all of it when
// pulled up. The backdrop is told the room left free between them (the window), to centre itself in.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../settingsContext'

/** The room the controls leave free, in CSS pixels of the screen */
export interface Frame {
  left: number
  top: number
  width: number
  height: number
}

/** The phone layout (the page's controls as a sheet at the bottom) */
const NARROW = '(max-width: 860px)'
export function useNarrow() {
  const [narrow, setNarrow] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(NARROW).matches)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(NARROW)
    const on = () => setNarrow(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return narrow
}

type Sheet = 'peek' | 'half' | 'full'
const UP: Record<Sheet, Sheet> = { peek: 'half', half: 'full', full: 'full' }
const DOWN: Record<Sheet, Sheet> = { peek: 'peek', half: 'peek', full: 'half' }

interface Props {
  /** The page's own class, beside imm-page */
  name: string
  /** Drawn over the whole screen behind the page, centred in the frame left free */
  backdrop: (frame: Frame) => ReactNode
  /** The bar at the top left: the moment, and the like */
  toolbar: ReactNode
  /** Laid over the free room (a title, zoom buttons); only its buttons take the pointer */
  overlay?: ReactNode
  /** The details: a panel on the right, or the sheet on a phone */
  panelTitle: string
  panel: ReactNode
  /** One line said on the folded sheet (phone) */
  summary?: ReactNode
  /** Along the bottom; on a phone, under the folded sheet's line */
  bottom?: ReactNode
}

export function Immersive({ name, backdrop, toolbar, overlay, panelTitle, panel, summary, bottom }: Props) {
  const t = useT()
  const narrow = useNarrow()
  const [open, setOpen] = useState(true)
  const [sheet, setSheet] = useState<Sheet>('peek')

  // The free room, measured off the empty window in the layout
  const windowRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState<Frame>(() => ({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }))
  useLayoutEffect(() => {
    const el = windowRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) return
      setFrame((f) =>
        Math.abs(f.left - r.left) < 0.5 && Math.abs(f.top - r.top) < 0.5 && Math.abs(f.width - r.width) < 0.5 && Math.abs(f.height - r.height) < 0.5
          ? f
          : { left: r.left, top: r.top, width: r.width, height: r.height },
      )
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [narrow])

  // The folded sheet's height, which the layout leaves room for under the window
  const peekRef = useRef<HTMLDivElement>(null)
  const [peek, setPeek] = useState(0)
  useLayoutEffect(() => {
    const el = peekRef.current
    if (!narrow || !el) return
    const set = () => setPeek(el.offsetHeight)
    set()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [narrow])

  // The sheet's handle: a tap steps it up (and from the top back down), a drag up or down moves it a step
  const drag = useRef<{ y: number; moved: boolean } | null>(null)
  const handle = {
    onPointerDown: (e: React.PointerEvent) => {
      drag.current = { y: e.clientY, moved: false }
      try {
        ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      } catch {
        // not a live pointer
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (drag.current && Math.abs(e.clientY - drag.current.y) > 8) drag.current.moved = true
    },
    onPointerUp: (e: React.PointerEvent) => {
      const d = drag.current
      if (!d?.moved) return
      const dy = e.clientY - d.y
      setSheet((s) => (dy < -160 ? 'full' : dy < 0 ? UP[s] : dy > 160 ? 'peek' : DOWN[s]))
    },
    onClick: () => {
      if (drag.current?.moved) {
        drag.current = null
        return
      }
      drag.current = null
      setSheet((s) => (s === 'full' ? 'peek' : UP[s]))
    },
  }

  return (
    <div className={`imm-page ${name}`}>
      {createPortal(<div className={`imm-backdrop ${name}-backdrop`}>{backdrop(frame)}</div>, document.body)}
      <div className="imm-stage" style={narrow ? ({ '--imm-peek': `${peek}px` } as React.CSSProperties) : undefined}>
        <div className="imm-toolbar">{toolbar}</div>
        <div className="imm-window" ref={windowRef}>
          {overlay && <div className="imm-overlay">{overlay}</div>}
        </div>
        {!narrow && bottom && <div className="imm-bottom">{bottom}</div>}
        {narrow ? (
          <section className={`imm-sheet ${sheet}`} aria-label={panelTitle}>
            <div className="imm-sheet-top" ref={peekRef}>
              <button
                type="button"
                className="imm-sheet-handle"
                aria-expanded={sheet !== 'peek'}
                title={sheet === 'full' ? t('收起') : t('展开')}
                {...handle}
              >
                <span className="imm-grip" aria-hidden="true" />
                <span className="imm-sheet-summary">{summary ?? panelTitle}</span>
                <span className="imm-sheet-mark" aria-hidden="true">
                  {sheet === 'full' ? '⌄' : '⌃'}
                </span>
              </button>
              {bottom && <div className="imm-sheet-bottom">{bottom}</div>}
            </div>
            <div className="imm-sheet-body" hidden={sheet === 'peek'}>
              {panel}
            </div>
          </section>
        ) : (
          <aside className={`imm-panel${open ? '' : ' closed'}`} aria-label={panelTitle}>
            {open ? (
              <div className="imm-panel-head">
                <h3>{panelTitle}</h3>
                <button type="button" className="ghost" aria-expanded onClick={() => setOpen(false)}>
                  {t('收起')} ›
                </button>
              </div>
            ) : (
              <button type="button" className="imm-panel-tab" aria-expanded={false} onClick={() => setOpen(true)}>
                ‹ {panelTitle}
              </button>
            )}
            <div className="imm-panel-body" hidden={!open}>
              {panel}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
