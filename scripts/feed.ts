// Vite plugin: writes the 订阅日历 (src/lib/skyFeed.ts) into the build, one file per language, so a
// phone can subscribe to a fixed address on the site. It holds the year before the build to two
// years on; each deploy (and the monthly rebuild in .github/workflows/pages.yml) moves it on.
import type { Plugin } from 'vite'
import { FEED_LANGUAGES, feedPath } from '../src/lib/feedPath'
import { feedEvents, feedIcs, feedSpan } from '../src/lib/skyFeed'
import { convertTrad } from './opencc'

export function calendarFeed(): Plugin {
  return {
    name: 'chroniq-calendar-feed',
    apply: 'build',
    generateBundle() {
      const now = Date.now()
      const events = feedEvents(...feedSpan(now))
      for (const lang of FEED_LANGUAGES) this.emitFile({ type: 'asset', fileName: feedPath(lang), source: feedIcs(lang, events, now, convertTrad) })
    },
  }
}
