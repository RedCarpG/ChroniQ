// The 黄历's words with what they mean (lib/almanacInfo): a 宜 or 忌 list whose title opens a line on
// each item under it, and a single word (建除, 值神, 星宿) explained on hover or tap.
import { useState, type ReactNode } from 'react'
import type { AlmanacNote } from '../lib/almanacInfo'
import { useSettings, useT, useTerm } from '../settingsContext'
import { InfoTip } from './InfoTip'

/**
 * A list of the almanac's words under its title (宜, 忌, 吉神…). With `info`, the title is a button
 * that opens what each item means, under the list; the items are given as the almanac names them
 * (简体), and shown in the reader's script.
 */
export function AlmanacTags({ title, kind, items, info }: { title: string; kind: string; items: string[]; info?: Record<string, AlmanacNote> }) {
  const t = useT()
  const term = useTerm()
  const en = useSettings().language === 'en'
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  const explained = info ? items.filter((i) => info[i]) : []
  return (
    <div className="tag-block">
      {explained.length > 0 ? (
        <button
          type="button"
          className={`tag-title ${kind} almanac-toggle`}
          aria-expanded={open}
          title={open ? t('收起释义') : t('看每一项的意思')}
          onClick={() => setOpen((o) => !o)}
        >
          {title}
        </button>
      ) : (
        <span className={`tag-title ${kind}`}>{title}</span>
      )}
      <div className="almanac-items">
        <p>{items.map(term).join(' ')}</p>
        {open && (
          <dl className="almanac-notes">
            {explained.map((i) => (
              <div key={i}>
                <dt>{term(i)}</dt>
                <dd>{en ? info![i].en : term(info![i].zh)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  )
}

/** One word of the almanac, explained on hover or tap; `children` is how it reads on the page */
export function AlmanacTip({ title, note, children }: { title: string; note: AlmanacNote | string | undefined; children: ReactNode }) {
  const term = useTerm()
  const en = useSettings().language === 'en'
  if (!note) return <>{children}</>
  return (
    <InfoTip label={children} title={title}>
      <span>{typeof note === 'string' ? note : en ? note.en : term(note.zh)}</span>
    </InfoTip>
  )
}
