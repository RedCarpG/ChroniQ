import { computeWesternYear } from './chartWestern'
import type { SavedChart } from './savedCharts'

self.onmessage = (event: MessageEvent<{ id: number; chart: SavedChart; year: number }>) => {
  const { id, chart, year } = event.data
  try {
    self.postMessage({ id, days: computeWesternYear(chart, year) })
  } catch {
    self.postMessage({ id, error: true })
  }
}
