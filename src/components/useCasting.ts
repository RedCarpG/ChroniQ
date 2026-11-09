// 起盘 (天书): a chart newly shown comes in a layer at a time, as one would read it, each layer standing
// alone a moment before the next comes in; the parts of a layer not yet reached wait in the dark
// (tianshu.css: [data-stage] and .cast-l1 … .cast-l5). Not for a new chart soon after the last (dates
// being stepped through), nor with 减少动态效果; it can be skipped, and cast again.
import { useEffect, useRef, useState } from 'react'

/** How long each layer stands alone before the next comes in, ms */
const LAYER_MS = 1100

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The layer the cast of the chart named by `key` has reached, 1 to `layers`, or `layers + 1` once all
 * are in (`done`). With `on` false (another 界面风格) the chart is always shown whole.
 */
export function useCasting(key: string, layers: number, on = true) {
  const done = layers + 1
  const [stage, setStage] = useState(() => (on && !reducedMotion() ? 1 : done))
  const [round, setRound] = useState(0)
  const last = useRef({ key: '', at: -Infinity })
  useEffect(() => {
    const now = performance.now()
    // A new chart soon after the last (stepping through dates): it is just shown
    const quick = last.current.key !== key && now - last.current.at < 1500
    last.current = { key, at: now }
    if (!on || quick || reducedMotion()) return setStage(done)
    setStage(1)
    const timers = Array.from({ length: layers }, (_, i) => window.setTimeout(() => setStage(i + 2), (i + 1) * LAYER_MS))
    return () => timers.forEach(clearTimeout)
  }, [key, round, on, layers, done])
  return {
    stage,
    casting: stage < done,
    /** For the element whose layers are cast: data-stage while casting, nothing once done */
    stageAttr: stage < done ? stage : undefined,
    skip: () => setStage(done),
    again: () => setRound((r) => r + 1),
  }
}
