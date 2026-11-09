// 天书: 流派设置 as a small menu by a chart's switches, rather than in the 命盘 drawer, which is for the birth
import { useRef, useState, type ReactNode } from 'react'
import { useT } from '../settingsContext'
import { useDismiss } from './useDismiss'

export function SchoolsMenu({ panel }: { panel: ReactNode }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, open, () => setOpen(false))
  return (
    <div className="schools-menu" ref={ref}>
      <button type="button" className={`ghost${open ? ' on' : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {t('流派设置')}
      </button>
      {open && <div className="schools-menu-panel">{panel}</div>}
    </div>
  )
}
