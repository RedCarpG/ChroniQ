import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useT, useTerm } from '../settingsContext'
import { useDismiss } from './useDismiss'

export type Page = 'today' | 'calendar' | 'bazi' | 'ziwei' | 'qizheng' | 'star' | 'sky' | 'moon' | 'solar' | 'timeline'

/** The pages, grouped as the menu lists them (shown through t(): src/i18n/__tests__/calendar.test.ts checks the English) */
export const PAGE_GROUPS: { title: string; pages: { page: Page; name: string; /** In the navigation, where the full name is long */ short?: string; desc: string }[] }[] = [
  {
    title: '历法',
    pages: [
      { page: 'today', name: '今日', desc: '今天的黄历、今晚的天空、今日与命盘' },
      { page: 'calendar', name: '日历', desc: '公历、农历、节气、干支' },
      { page: 'sky', name: '天象', desc: '此刻天空、星座与星官' },
      { page: 'moon', name: '观月', desc: '月相、月出月落、天平动' },
      { page: 'solar', name: '太阳系', desc: '行星的轨道、距离与顺逆行' },
    ],
  },
  {
    title: '命理',
    pages: [
      { page: 'bazi', name: '八字排盘', short: '八字', desc: '四柱、十神、神煞、大运流年' },
      { page: 'ziwei', name: '紫微斗数', short: '紫微', desc: '十二宫、四化飞星、运限' },
      { page: 'qizheng', name: '七政四余', short: '七政', desc: '日月五星与罗计孛炁，落在真实的二十八宿' },
      { page: 'star', name: '星盘', desc: '本命、行运推运、合盘、组合盘' },
      { page: 'timeline', name: '人生时间轴', short: '时间轴', desc: '大运、大限与行星回归，放在同一条线上' },
    ],
  },
]
/**
 * The pages, in their groups, always in sight: the current page's group lies open and the others are
 * one button each. Pressing one opens it instead, to look or to go there; clicking anywhere else or
 * Escape returns to the current page's group. A new group needs only an entry in PAGE_GROUPS.
 */
export function PageNav({ page, onPick, className }: { page: Page; onPick: (page: Page) => void; className?: string }) {
  const term = useTerm()
  const t = useT()
  // Page names and notes are interface text; term() still turns the 干支 etc. in them to 繁體
  const tr = (text: string) => term(t(text))
  /** The group opened by hand, for now */
  const [peek, setPeek] = useState<string | null>(null)
  const ref = useRef<HTMLElement>(null)
  const close = useCallback(() => setPeek(null), [])
  useDismiss(ref, peek !== null, close)
  const home = PAGE_GROUPS.find((g) => g.pages.some((p) => p.page === page))?.title
  const open = peek ?? home
  // 天书's ◆ by the current page: one mark that glides from page to page (tianshu.css .page-nav-mark), set
  // where the current page's name is, again while a group opens or folds (its width slides) and on resize
  const mark = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const nav = ref.current
    const m = mark.current
    if (!nav || !m) return
    const place = () => {
      const on = nav.querySelector<HTMLElement>('.page-nav-item.on')
      const shown = on && on.closest('.page-nav-group.open')
      m.classList.toggle('shown', !!shown)
      if (!on || !shown) return
      const a = nav.getBoundingClientRect()
      const b = on.getBoundingClientRect()
      const zoom = a.width / (nav.offsetWidth || a.width) || 1
      m.style.translate = `${((b.left - a.left) / zoom).toFixed(1)}px ${((b.top + b.height / 2 - a.top) / zoom).toFixed(1)}px`
    }
    place()
    // The groups' widths slide as one opens and another folds, and not always when expected (a page
    // change can hold the slide back): follow their sizes as they change, until they settle. Without
    // ResizeObserver, a few tries over the slide's 0.28 s.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place)
    nav.querySelectorAll('.page-nav-pages').forEach((g) => observer?.observe(g))
    const timers = observer ? [] : [80, 160, 300].map((ms) => window.setTimeout(place, ms))
    window.addEventListener('resize', place)
    return () => {
      observer?.disconnect()
      timers.forEach(clearTimeout)
      window.removeEventListener('resize', place)
    }
  }, [page, open])
  return (
    <nav
      ref={ref}
      className={`page-nav${className ? ` ${className}` : ''}`}
      aria-label={t('页面')}
      data-sounds="page"
      // Tabbing out of it counts as going elsewhere
      onBlur={(e) => {
        if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) close()
      }}
    >
      <span ref={mark} className="page-nav-mark" aria-hidden="true" />
      {PAGE_GROUPS.map((g) => {
        const isOpen = g.title === open
        return (
          <div key={g.title} className={`page-nav-group${isOpen ? ' open' : ''}${g.title === home ? ' home' : ''}`} role="group" aria-label={tr(g.title)}>
            <button
              type="button"
              className="page-nav-group-btn"
              aria-expanded={isOpen}
              title={g.pages.map((p) => tr(p.short ?? p.name)).join(' · ')}
              // Pressed again, or the current page's own: back to the current page's group
              onClick={() => setPeek(g.title === home || g.title === peek ? null : g.title)}
            >
              {tr(g.title)}
            </button>
            {/* Always there, so opening and folding can slide (styles.css .page-nav-pages) */}
            <div className="page-nav-pages" inert={!isOpen}>
              <div>
                {g.pages.map((p) => (
                  <button
                    key={p.page}
                    type="button"
                    className={`page-nav-item${p.page === page ? ' on' : ''}`}
                    aria-current={p.page === page ? 'page' : undefined}
                    title={tr(p.desc)}
                    onClick={() => {
                      close()
                      onPick(p.page)
                    }}
                  >
                    {tr(p.short ?? p.name)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </nav>
  )
}
