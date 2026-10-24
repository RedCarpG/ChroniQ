import { useLayoutEffect, useRef, type ReactNode } from 'react'

/**
 * Lets its content's height change smoothly: when something is added or
 * removed inside, the box grows or shrinks over a moment instead of jumping
 * (styles.css .smooth-height). Height is measured, so any content works.
 */
export function SmoothHeight({ className, children }: { className?: string; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    let height = i.offsetHeight
    o.style.height = `${height}px`
    const ro = new ResizeObserver(() => {
      if (i.offsetHeight === height) return
      height = i.offsetHeight
      o.style.height = `${height}px`
    })
    ro.observe(i)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={outer} className="smooth-height">
      <div ref={inner} className={className}>
        {children}
      </div>
    </div>
  )
}
