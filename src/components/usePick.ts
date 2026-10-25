import { useCallback, useEffect, useState } from 'react'

/** Clicks on these are the page's own controls: they leave a selection alone */
const CONTROLS = 'button, a[href], input, select, textarea, label, summary, [role="button"], [role="menuitemradio"], [role="dialog"]'
const same = (a: unknown, b: unknown) => a !== null && b !== null && JSON.stringify(a) === JSON.stringify(b)

/**
 * Highlight by hover, and keep it by choosing: what is lit is what the pointer (or keyboard focus)
 * is on, else what was chosen. A click chooses a thing, or lets it go if it was the one chosen; a
 * click on empty space, or Esc, lets go. Things are compared by value, so they can be objects.
 *
 * props(thing) goes on each element that lights up its thing: it marks it data-pick (so a click on
 * it is not a click on empty space) and data-picked while it is the chosen one.
 */
export function usePick<T>() {
  const [hover, setHover] = useState<T | null>(null)
  const [picked, setPicked] = useState<T | null>(null)
  useEffect(() => {
    if (picked === null) return
    const onClick = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target : null
      if (!el || el.closest('[data-pick]') || el.closest(CONTROLS)) return
      setPicked(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPicked(null)
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [picked])
  const props = useCallback(
    (thing: T) => ({
      'data-pick': '',
      'data-picked': same(picked, thing) ? '' : undefined,
      onPointerEnter: (e: React.PointerEvent) => e.pointerType === 'mouse' && setHover(thing),
      onPointerLeave: (e: React.PointerEvent) => e.pointerType === 'mouse' && setHover((h) => (same(h, thing) ? null : h)),
      onFocus: () => setHover(thing),
      onBlur: () => setHover((h) => (same(h, thing) ? null : h)),
      onClick: () => setPicked((p) => (same(p, thing) ? null : thing)),
    }),
    [picked],
  )
  return { active: hover ?? picked, hover, picked, props, clear: () => setPicked(null) }
}
