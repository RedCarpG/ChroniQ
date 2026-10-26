import { expect, it } from 'vitest'
import { LruCache } from '../lruCache'
it('evicts the least recently read entry and bounds replacements', () => {
  const cache = new LruCache<string, number>(2)
  cache.set('a', 1).set('b', 2)
  expect(cache.get('a')).toBe(1)
  cache.set('c', 3)
  expect(cache.has('b')).toBe(false)
  cache.set('a', 4).set('d', 5)
  expect([...cache.entries()]).toEqual([['a', 4], ['d', 5]])
})
