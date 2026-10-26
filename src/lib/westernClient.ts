// Keep astronomy-engine and its computation off the UI thread. One worker is
// shared across calendar renders; only completed results enter the bounded cache.
import type { ChartDay } from './chartDays'
import type { SavedChart } from './savedCharts'
import { LruCache } from './lruCache'

type Days = Map<string, ChartDay[]>
const cache = new LruCache<string, Days>(24)
const keyOf = (chart: SavedChart, year: number) => JSON.stringify([chart.id, chart.name, chart.input, year])
export const peekWesternYear = (chart: SavedChart, year: number) => cache.get(keyOf(chart, year))

let worker: Worker | undefined
let sequence = 0
const pending = new Map<number, { resolve: (days: Days) => void; reject: (error: Error) => void }>()
const aborted = () => new DOMException('Calculation cancelled', 'AbortError')

function getWorker() {
  if (worker) return worker
  const current = new Worker(new URL('./chartWestern.worker.ts', import.meta.url), { type: 'module' })
  worker = current
  current.onmessage = (event: MessageEvent<{ id: number; days: Days; error?: boolean }>) => {
    const task = pending.get(event.data.id)
    if (!task) return
    pending.delete(event.data.id)
    if (event.data.error) task.reject(new Error('Calculation failed'))
    else task.resolve(event.data.days)
  }
  current.onerror = (event) => {
    event.preventDefault()
    for (const task of pending.values()) task.reject(new Error('Worker failed'))
    pending.clear()
    current.terminate()
    if (worker === current) worker = undefined
  }
  return current
}

export function westernYearAsync(chart: SavedChart, year: number, signal: AbortSignal): Promise<Days> {
  if (signal.aborted) return Promise.reject(aborted())
  const key = keyOf(chart, year)
  const cached = cache.get(key)
  if (cached) return Promise.resolve(cached)
  return new Promise<Days>((resolve, reject) => {
    const id = ++sequence
    const cancel = () => {
      pending.delete(id)
      reject(aborted())
      // No consumer remains: stop obsolete CPU work instead of just ignoring it.
      if (pending.size === 0) { worker?.terminate(); worker = undefined }
    }
    const finish = (error?: Error, days?: Days) => {
      signal.removeEventListener('abort', cancel)
      if (error) reject(error)
      else { cache.set(key, days!); resolve(days!) }
    }
    signal.addEventListener('abort', cancel, { once: true })
    pending.set(id, { resolve: (days) => finish(undefined, days), reject: (error) => finish(error) })
    try { getWorker().postMessage({ id, chart, year }) }
    catch (error) { pending.delete(id); finish(error instanceof Error ? error : new Error('Worker unavailable')) }
  })
}
