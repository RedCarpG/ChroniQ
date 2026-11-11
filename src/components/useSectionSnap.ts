// 天书: the 命理 pages' sections settle into place when the page comes to rest near the top of one (原局,
// 解读, 岁运 …), or near the top of the page; in the middle of a long one the page stays where it is. The
// browser's own scroll snap jumps there; this glides, eased, and lets go the moment the reader scrolls,
// drags or presses a key again. Not on a phone or a touch screen: there the page is one long column of
// long sections, scrolled by flicks, and being drawn on after a flick came to rest read as the page jumping.
import { useEffect, useState } from 'react'

/** Where the sections settle: a wide screen worked with a mouse */
const SNAP_MEDIA = '(min-width: 861px) and (hover: hover) and (pointer: fine)'

function useSnapScreen() {
  const [fits, setFits] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(SNAP_MEDIA).matches)
  useEffect(() => {
    const m = window.matchMedia?.(SNAP_MEDIA)
    if (!m) return
    const on = () => setFits(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return fits
}

/** How near the top of a section the page must stop to be drawn to it, as a share of the window's height */
const REACH = 0.22
/** The gap left over a section settled into place, px (as scroll-margin-top) */
const MARGIN = 12
const DURATION = 520
const ease = (t: number) => 1 - (1 - t) ** 3

/** Where the page could settle: its top, and the top of each section */
function stops() {
  const list = [0]
  document.querySelectorAll<HTMLElement>('main section.card[id]').forEach((s) => {
    // not hidden, and not in a drawer over the page (the AI 解读 is a section too)
    if (s.offsetParent === null || s.closest('.right-drawer, .drawer')) return
    list.push(Math.round(s.getBoundingClientRect().top + window.scrollY - MARGIN))
  })
  return list
}

export function useSectionSnap(wanted: boolean) {
  const on = useSnapScreen() && wanted
  useEffect(() => {
    if (!on) return
    let frame = 0
    let gliding = false
    let idle = 0
    const stop = () => {
      cancelAnimationFrame(frame)
      frame = 0
      gliding = false
    }
    const glide = (to: number) => {
      const from = window.scrollY
      if (Math.abs(to - from) < 2) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return window.scrollTo(0, to)
      const start = performance.now()
      gliding = true
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION)
        window.scrollTo(0, from + (to - from) * ease(t))
        frame = t < 1 ? requestAnimationFrame(step) : 0
        if (t >= 1) gliding = false
      }
      frame = requestAnimationFrame(step)
    }
    // Come to rest: the nearest place within reach, if any
    const settle = () => {
      if (gliding) return
      const y = window.scrollY
      const reach = window.innerHeight * REACH
      const near = stops().reduce<number | null>((best, s) => (Math.abs(s - y) <= reach && (best === null || Math.abs(s - y) < Math.abs(best - y)) ? s : best), null)
      if (near !== null) glide(near)
    }
    // The page has come to rest: scrollend where the browser has it, else a pause in the scrolling
    const onScroll = () => {
      if (gliding) return
      clearTimeout(idle)
      idle = window.setTimeout(settle, 160)
    }
    const onEnd = () => {
      clearTimeout(idle)
      settle()
    }
    const hasEnd = 'onscrollend' in window
    window.addEventListener(hasEnd ? 'scrollend' : 'scroll', hasEnd ? onEnd : onScroll, { passive: true })
    // The reader takes the page again: let go
    const takeOver = () => gliding && stop()
    for (const e of ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const) window.addEventListener(e, takeOver, { passive: true })
    return () => {
      stop()
      clearTimeout(idle)
      window.removeEventListener(hasEnd ? 'scrollend' : 'scroll', hasEnd ? onEnd : onScroll)
      for (const e of ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const) window.removeEventListener(e, takeOver)
    }
  }, [on])
}
