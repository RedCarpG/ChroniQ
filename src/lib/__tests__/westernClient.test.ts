import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { SavedChart } from '../savedCharts'

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage?: (event: { data: unknown }) => void
  onerror?: (event: { preventDefault: () => void }) => void
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() { FakeWorker.instances.push(this) }
}
const chart: SavedChart = { id: 'a', name: 'a', input: { year: 1990, month: 5, day: 15, hour: 10, minute: 30, gender: 1 } }
beforeEach(() => { vi.resetModules(); FakeWorker.instances = []; vi.stubGlobal('Worker', FakeWorker) })
afterEach(() => vi.unstubAllGlobals())
it('delegates work, returns structured results, and reuses completed years', async () => {
  const client = await import('../westernClient')
  const result = client.westernYearAsync(chart, 2026, new AbortController().signal)
  const worker = FakeWorker.instances[0]
  const request = worker.postMessage.mock.calls[0][0]
  expect(request).toMatchObject({ chart, year: 2026 })
  const days = new Map([['1-22', [{ chartId: 'a', name: 'a', kind: 'solarReturn' as const }]]])
  worker.onmessage!({ data: { id: request.id, days } })
  expect(await result).toEqual(days)
  expect(await client.westernYearAsync(chart, 2026, new AbortController().signal)).toEqual(days)
  expect(worker.postMessage).toHaveBeenCalledTimes(1)
})
it('cancels CPU work when no consumers remain and permits a fresh request', async () => {
  const client = await import('../westernClient')
  const controller = new AbortController()
  const result = client.westernYearAsync(chart, 2026, controller.signal)
  const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' })
  controller.abort()
  await rejected
  expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce()
  const nextController = new AbortController()
  const next = client.westernYearAsync(chart, 2026, nextController.signal)
  expect(FakeWorker.instances).toHaveLength(2)
  const nextRejected = expect(next).rejects.toMatchObject({ name: 'AbortError' })
  nextController.abort()
  await nextRejected
})
it('cleans up errors so a later request can retry', async () => {
  const client = await import('../westernClient')
  const result = client.westernYearAsync(chart, 2026, new AbortController().signal)
  const rejected = expect(result).rejects.toThrow('Worker failed')
  FakeWorker.instances[0].onerror!({ preventDefault: () => {} })
  await rejected
  const controller = new AbortController()
  const next = client.westernYearAsync(chart, 2026, controller.signal)
  expect(FakeWorker.instances).toHaveLength(2)
  const nextRejected = expect(next).rejects.toMatchObject({ name: 'AbortError' })
  controller.abort()
  await nextRejected
})
