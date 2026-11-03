import { describe, expect, it, vi } from 'vitest'
import { isStaleBuild, watchForUpdate } from '../pwa'

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

describe('isStaleBuild', () => {
  it('knows a lazy part of an old build failing to load, as each browser words it', () => {
    expect(isStaleBuild(new TypeError('Failed to fetch dynamically imported module: https://x/assets/index-B.js'))).toBe(true)
    expect(isStaleBuild(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isStaleBuild(new TypeError('error loading dynamically imported module: https://x/a.js'))).toBe(true)
    expect(isStaleBuild(new Error('Network down'))).toBe(false)
    expect(isStaleBuild('text')).toBe(false)
  })
})
