// Shared set-up for component tests, which run in jsdom (each test file opts in
// with a `// @vitest-environment jsdom` comment). jsdom has no layout, media
// queries or animation, so this stands in for the bits the components touch.
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

// A wide screen that asks for reduced motion: the 岁运盘 starts with 合参原局
// on, and view transitions / column slides are skipped, so updates are plain.
window.matchMedia = (query: string) =>
  ({
    matches: /prefers-reduced-motion: reduce|min-width/.test(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Element.prototype.scrollIntoView ??= () => {}

beforeEach(() => localStorage.clear())
afterEach(cleanup)
