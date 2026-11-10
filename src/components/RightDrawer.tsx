import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../settingsContext'

/**
 * A panel at the right edge, out of the page's way: a small tab opens it over the page (pushing
 * nothing), and the tab, its ✕ or Escape folds it again. What it holds stays mounted while
 * folded, so a running answer carries on. It is put at the end of the page's body, outside .app, as
 * the 命盘 drawer is: it takes the 显示大小 zoom itself, which inside .app it would take twice.
 */
export function RightDrawer({ label, children }: { label: string; children: ReactNode }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  return createPortal(
    <div className={`right-drawer${open ? ' open' : ''}`}>
      <button type="button" className="right-drawer-handle" aria-expanded={open} data-sound={open ? 'unpick' : 'pick'} onClick={() => setOpen(!open)}>
        <span className="drawer-handle-text">{label}</span>
      </button>
      <div className="right-drawer-panel" inert={!open}>
        <button type="button" className="ghost right-drawer-close" aria-label={t('关闭')} title={t('关闭')} onClick={() => setOpen(false)}>
          ✕
        </button>
        {children}
      </div>
    </div>,
    document.body,
  )
}
