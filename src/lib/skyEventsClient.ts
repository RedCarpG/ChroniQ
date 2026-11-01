// 天象预告 off the UI thread (the calendar is the first page, and this pulls in astronomy-engine). One
// worker, kept for the visit; only finished years enter the bounded cache.
import { LruCache } from './lruCache'
import type { SkyEvent, SkyPlaceLike } from './skyEvents'

const cache = new LruCache<string, SkyEvent[]>(12)
const keyOf = (year: number, place: SkyPlaceLike) => JSON.stringify([year, place.latitude, place.longitude, place.timeZone])
export const peekSkyEvents = (year: number, place: SkyPlaceLike) => cache.get(keyOf(year, place))

let worker: Worker | undefined
let sequence = 0
const pending = new Map<number, { resolve: (events: SkyEvent[]) => void; reject: (error: Error) => void }>()
const running = new Map<string, Promise<SkyEvent[]>>()

function getWorker() {
  if (worker) return worker
  const current = new Worker(new URL('./skyEvents.worker.ts', import.meta.url), { type: 'module' })
  worker = current
  current.onmessage = (event: MessageEvent<{ id: number; events?: SkyEvent[]; error?: boolean }>) => {
    const task = pending.get(event.data.id)
    if (!task) return
    pending.delete(event.data.id)
    if (event.data.events) task.resolve(event.data.events)
    else task.reject(new Error('Calculation failed'))
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

/** A year's events from a place; asking again while it runs joins the same run */
export function skyEventsAsync(year: number, place: SkyPlaceLike): Promise<SkyEvent[]> {
  const key = keyOf(year, place)
  const cached = cache.get(key)
  if (cached) return Promise.resolve(cached)
  const joined = running.get(key)
  if (joined) return joined
  const run = new Promise<SkyEvent[]>((resolve, reject) => {
    const id = ++sequence
    pending.set(id, { resolve, reject })
    try {
      const { latitude, longitude, timeZone } = place
      getWorker().postMessage({ id, year, place: { latitude, longitude, timeZone } })
    } catch (error) {
      pending.delete(id)
      reject(error instanceof Error ? error : new Error('Worker unavailable'))
    }
  })
    .then((events) => {
      cache.set(key, events)
      return events
    })
    .finally(() => running.delete(key))
  running.set(key, run)
  return run
}
