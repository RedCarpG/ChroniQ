// 搜索: find a body, a named star, a deep-sky object or a constellation by any of its names (Chinese,
// 繁體, English, M31, NGC 224…) and go to it on the map. A box that lists the best matches as one
// types; arrow keys move through them, Enter goes, Esc closes.
import { useId, useMemo, useRef, useState } from 'react'
import { useT } from '../settingsContext'
import { useDismiss } from './useDismiss'

export interface SearchItem {
  key: string
  label: string
  /** What it is, shown after it */
  sub: string
  /** Every name it goes by */
  names: string[]
  /** Its colour mark */
  colour: string
}

const fold = (s: string) => s.toLowerCase().replace(/[\s·.'’-]+/g, '')

/** The items matching what is typed: names starting with it first, then names holding it */
export function searchSky(items: SearchItem[], text: string, limit = 8) {
  const q = fold(text)
  if (!q) return []
  const scored: [number, SearchItem][] = []
  for (const item of items) {
    let best = -1
    for (const name of item.names) {
      const n = fold(name)
      const score = n === q ? 3 : n.startsWith(q) ? 2 : n.includes(q) ? 1 : -1
      if (score > best) best = score
    }
    if (best >= 0) scored.push([best, item])
  }
  return scored
    .sort((a, b) => b[0] - a[0])
    .slice(0, limit)
    .map(([, item]) => item)
}

export function SkySearch({ items, onPick }: { items: SearchItem[]; onPick: (key: string) => void }) {
  const t = useT()
  const id = useId()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  useDismiss(box, open, () => setOpen(false))
  const found = useMemo(() => searchSky(items, text), [items, text])
  const go = (item: SearchItem) => {
    onPick(item.key)
    setText('')
    setOpen(false)
  }
  return (
    <div className="sky-search" ref={box}>
      <input
        type="search"
        role="combobox"
        aria-label={t('搜索天体')}
        aria-expanded={open && found.length > 0}
        aria-controls={`${id}-list`}
        aria-activedescendant={open && found[at] ? `${id}-${at}` : undefined}
        placeholder={t('搜索：星、行星、M31、星座…')}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setAt(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (found.length) setAt((i) => (i + (e.key === 'ArrowDown' ? 1 : found.length - 1)) % found.length)
          } else if (e.key === 'Enter' && found[at]) {
            e.preventDefault()
            go(found[at])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {open && text && (
        <ul className="card sky-search-list" id={`${id}-list`} role="listbox" aria-label={t('搜索结果')}>
          {found.length ? (
            found.map((item, i) => (
              <li
                key={item.key}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === at}
                className={i === at ? 'on' : undefined}
                data-sound="pick"
                onPointerEnter={() => setAt(i)}
                onClick={() => go(item)}
              >
                <span className="sky-dot" style={{ background: item.colour }} />
                <span>{item.label}</span>
                <small className="muted">{item.sub}</small>
              </li>
            ))
          ) : (
            <li className="muted sky-search-none">{t('没有找到')}</li>
          )}
        </ul>
      )}
    </div>
  )
}
