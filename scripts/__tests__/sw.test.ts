import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

function worker(version: string, stores: Map<string, Map<string, Response>>) {
  type Event = { request?: { url: string; method: string; mode: string }; waitUntil: (p: Promise<unknown>) => void; respondWith: (p: Promise<Response>) => void }
  const handlers: Record<string, (event: Event) => void> = {}
  const skipWaiting = vi.fn()
  const fetch = vi.fn(async () => new Response('new HTML or missing old module', { status: 404 }))
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (key: string) => stores.delete(key),
    open: async (key: string) => {
      if (!stores.has(key)) stores.set(key, new Map())
      const data = stores.get(key)!
      return { addAll: async () => {}, match: async (url: string) => data.get(url)?.clone(), put: async (url: string, response: Response) => { data.set(url, response) } }
    },
    match: async (request: { url: string }) => {
      for (const data of stores.values()) if (data.has(request.url)) return data.get(request.url)!.clone()
      return undefined
    },
  }
  const self = { addEventListener: (type: string, handler: (e: Event) => void) => { handlers[type] = handler }, skipWaiting, clients: { claim: async () => {} }, location: { origin: 'https://example.test' } }
  const source = readFileSync('scripts/sw-template.js', 'utf8').replace('__CACHE__', version).replace('__PRECACHE__', '[]')
  runInNewContext(source, { self, caches, fetch, Response, URL, setTimeout, clearTimeout })
  return {
    skipWaiting, fetch,
    lifecycle: async (type: string) => {
      let promise: Promise<unknown> | undefined
      handlers[type]({ waitUntil: (p) => { promise = p }, respondWith: () => {} })
      await promise
    },
    request: async (url: string, mode: string) => {
      let response: Promise<Response> | undefined
      handlers.fetch({ request: { url, mode, method: 'GET' }, respondWith: (p) => { response = p }, waitUntil: () => {} })
      return response!
    },
  }
}

describe('build-consistent service worker updates', () => {
  it('keeps old lazy modules available while a new build is waiting', async () => {
    const url = 'https://example.test/assets/ziwei-old.js'
    const stores = new Map([['chroniq-old', new Map([[url, new Response('old module')], ['./', new Response('old HTML')]])]])
    const old = worker('chroniq-old', stores)
    const next = worker('chroniq-new', stores)
    await next.lifecycle('install')
    expect(next.skipWaiting).not.toHaveBeenCalled()
    expect(stores.has('chroniq-old')).toBe(true)
    expect(await (await old.request(url, 'cors')).text()).toBe('old module')
    expect(await (await old.request('https://example.test/', 'navigate')).text()).toBe('old HTML')
    expect(old.fetch).not.toHaveBeenCalled()
  })
  it('cleans old caches once activation is safe', async () => {
    const stores = new Map([['chroniq-old', new Map()], ['chroniq-new', new Map()], ['other-app', new Map()]])
    await worker('chroniq-new', stores).lifecycle('activate')
    expect([...stores.keys()]).toEqual(['chroniq-new', 'other-app'])
  })
})
