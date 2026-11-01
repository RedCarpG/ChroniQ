import { computeSkyEvents, type SkyPlaceLike } from './skyEvents'

self.onmessage = (event: MessageEvent<{ id: number; year: number; place: SkyPlaceLike }>) => {
  const { id, year, place } = event.data
  try {
    self.postMessage({ id, events: computeSkyEvents(year, place) })
  } catch {
    self.postMessage({ id, error: true })
  }
}
