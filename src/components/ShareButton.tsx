import { useEffect, useState } from 'react'
import { shareUrl, type SharedChart } from '../lib/shareLink'
import { useT, useTerm } from '../settingsContext'

/**
 * Top-bar button that shares a link to the chart on screen: the system share
 * sheet where there is one (phones), else the link is copied.
 */
export function ShareButton({ chart }: { chart: SharedChart }) {
  const term = useTerm()
  const t = useT()
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => {
    if (!note) return
    const id = setTimeout(() => setNote(null), 2200)
    return () => clearTimeout(id)
  }, [note])

  const share = async () => {
    const url = shareUrl(chart)
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: t('星曆 ChroniQ 命盘'), url })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setNote(t('链接已复制，打开即是这张命盘'))
    } catch {
      // No clipboard access (plain http, old browsers): show the link to copy by hand.
      window.prompt(t('复制这个链接分享命盘：'), url)
    }
  }

  return (
    <div className="share">
      <button type="button" className="icon-btn" aria-label={t('分享命盘链接')} title={t('分享命盘链接')} onClick={share}>
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"
          />
        </svg>
      </button>
      {note && (
        <div className="share-note" role="status">
          {term(note)}
        </div>
      )}
    </div>
  )
}
