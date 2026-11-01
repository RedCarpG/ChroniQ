import { describe, expect, it, vi } from 'vitest'
import { watchForUpdate } from '../pwa'

type Listener = () => void
const worker = (state = 'installing') => {
  const listeners: Listener[] = []
  return {
    state,
    addEventListener: (_: string, l: Listener) => listeners.push(l),
    become(next: string) {
      this.state = next
      listeners.forEach((l) => l())
    },
  }
}
const registration = (waiting: unknown = null) => {
  const listeners: Listener[] = []
  return {
    waiting,
    installing: null as unknown,
    addEventListener: (_: string, l: Listener) => listeners.push(l),
    found(w: unknown) {
      this.installing = w
      listeners.forEach((l) => l())
    },
  }
}
const CONTROLLED = { controller: {} as ServiceWorker }
const FIRST_VISIT = { controller: null }

describe('watchForUpdate', () => {
  it('offers a worker already waiting when the page loads', () => {
    const onReady = vi.fn()
    const old = worker('installed')
    watchForUpdate(registration(old) as unknown as ServiceWorkerRegistration, CONTROLLED, onReady)
    expect(onReady).toHaveBeenCalledWith(old)
  })

  it('offers a new worker once installed, not before', () => {
    const onReady = vi.fn()
    const reg = registration()
    watchForUpdate(reg as unknown as ServiceWorkerRegistration, CONTROLLED, onReady)
    const w = worker()
    reg.found(w)
    expect(onReady).not.toHaveBeenCalled()
    w.become('installed')
    expect(onReady).toHaveBeenCalledWith(w)
  })

  it('offers nothing on a first visit', () => {
    const onReady = vi.fn()
    const reg = registration()
    watchForUpdate(reg as unknown as ServiceWorkerRegistration, FIRST_VISIT, onReady)
    const w = worker()
    reg.found(w)
    w.become('installed')
    expect(onReady).not.toHaveBeenCalled()
  })
})
