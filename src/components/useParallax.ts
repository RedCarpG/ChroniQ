// 天书: depth. As the pointer moves (or a phone tilts), the layers of a 命理 page move a little against one
// another: the sky of the birth, farthest, most and against the pointer; the mist and fog less; the
// chart, nearest, a little with it. Moved by the CSS translate property alone, so nothing is drawn again
// and the layers' own transforms (the sky coming in, the fog's drift) are left alone; eased, so it
// follows gently; not with 减少动态效果.
import { useEffect } from 'react'

/** The layers and how far each goes, as a share of REACH: below 0 against the pointer, above 0 with it */
const LAYERS: [string, number][] = [
  ['.birth-sky', -1],
  ['.ts-atmos', -0.45],
  // the 紫微 board by its scrolling wrapper, which moving the board inside would give a scrollbar
  ['.bazi-hero-dial, .ziwei-scroll, .star-wheel', 0.22],
]
/** How far the farthest layer goes, px, with the pointer at the screen's edge */
const REACH = 16
/** How much of the way to the pointer each frame goes */
const EASE = 0.08

const clamp = (n: number) => Math.max(-1, Math.min(1, n))

export function useParallax(on: boolean) {
  useEffect(() => {
    if (!on || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let [x, y, toX, toY] = [0, 0, 0, 0]
    let frame = 0
    const step = () => {
      x += (toX - x) * EASE
      y += (toY - y) * EASE
      for (const [selector, depth] of LAYERS)
        document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
          el.style.translate = `${(x * depth * REACH).toFixed(2)}px ${(y * depth * REACH).toFixed(2)}px`
        })
      frame = Math.abs(toX - x) + Math.abs(toY - y) > 0.002 ? requestAnimationFrame(step) : 0
    }
    const aim = (nx: number, ny: number) => {
      ;[toX, toY] = [clamp(nx), clamp(ny)]
      if (!frame) frame = requestAnimationFrame(step)
    }
    // The mouse: where it is on the screen, from -1 to 1 each way
    const onMove = (e: PointerEvent) => e.pointerType === 'mouse' && aim((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
    // A phone: its tilt, side to side, and forward and back from how it was first held
    let level: number | null = null
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return
      level ??= e.beta
      aim(e.gamma / 30, (e.beta - level) / 30)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('deviceorientation', onTilt)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('deviceorientation', onTilt)
      cancelAnimationFrame(frame)
      for (const [selector] of LAYERS) document.querySelectorAll<HTMLElement>(selector).forEach((el) => (el.style.translate = ''))
    }
  }, [on])
}
