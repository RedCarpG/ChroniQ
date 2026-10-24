import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../settingsContext'
import { DRAWER_RAIL_SLOT } from './SavedCharts'

const scrollToY = (top: number) => window.scrollTo({ top, behavior: 'smooth' })

/**
 * Jump links to a page's sections, as tabs on the left edge under the 命盘
 * tab, between ↑ (to the top) and ↓ (to the bottom). The section in view is
 * marked by a thumb that slides between them.
 */
export function SectionNav({ items }: { items: [id: string, label: string][] }) {
  const t = useT()
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  // The drawer renders after the page, so look for its slot once mounted.
  useEffect(() => setSlot(document.getElementById(DRAWER_RAIL_SLOT)), [])

  const ids = items.map(([id]) => id).join('|')
  const [active, setActive] = useState(0)
  useEffect(() => {
    const els = ids.split('|').map((id) => document.getElementById(id))
    // The last section whose top has passed the upper third of the screen, or
    // the last one once at the bottom (a short last section never gets there).
    const onScroll = () => {
      const line = window.innerHeight / 3
      let i = 0
      els.forEach((el, k) => {
        if (el && el.getBoundingClientRect().top <= line) i = k
      })
      const root = document.documentElement
      if (window.scrollY > 0 && window.scrollY + window.innerHeight >= root.scrollHeight - 2) i = els.length - 1
      setActive(i)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [ids])

  if (!slot) return null
  return createPortal(
    <nav className="section-nav" aria-label={t('页面导航')}>
      <button type="button" className="section-nav-end" title={t('回到顶端')} aria-label={t('回到顶端')} onClick={() => scrollToY(0)}>
        ↑
      </button>
      <div className="section-nav-tabs" style={{ '--active': active } as CSSProperties}>
        <span className="section-nav-thumb" aria-hidden />
        {items.map(([id, label], i) => (
          <button
            key={id}
            type="button"
            className={i === active ? 'on' : undefined}
            aria-current={i === active || undefined}
            onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            <span className="section-nav-text">{label}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="section-nav-end"
        title={t('到达底端')}
        aria-label={t('到达底端')}
        onClick={() => scrollToY(document.documentElement.scrollHeight)}
      >
        ↓
      </button>
    </nav>,
    slot,
  )
}
