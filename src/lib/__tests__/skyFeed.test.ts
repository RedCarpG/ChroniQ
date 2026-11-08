import { describe, expect, it } from 'vitest'
import { feedPath, feedUrls } from '../feedPath'
import { feedEvents, feedIcs, feedSpan } from '../skyFeed'

const year = (y: number) => feedEvents(Date.UTC(y, 0, 1), Date.UTC(y + 1, 0, 1))

describe('the subscribed calendar', () => {
  const events = year(2026)

  it('holds the 24 solar terms, at their moments', () => {
    const terms = events.filter((e) => e.uid.startsWith('feed-term-'))
    expect(terms).toHaveLength(24)
    const lichun = terms.find((e) => e.title.zh === '立春')!
    // 立春 2026: 4 February 04:02 Beijing time, to within a minute or two
    expect(Math.abs(lichun.start - Date.UTC(2026, 1, 3, 20, 2))).toBeLessThan(2 * 60_000)
    expect(lichun.title.en).toBe('立春 · Start of Spring')
  })

  it('holds the Moon’s phases, the showers’ peaks, the lunar eclipses and the oppositions', () => {
    const count = (prefix: string) => events.filter((e) => e.uid.startsWith(prefix)).length
    expect(count('feed-moon-')).toBeGreaterThanOrEqual(49)
    expect(count('feed-meteors-')).toBe(7)
    // 2026: the total eclipse of 3 March and the partial of 28 August
    const eclipses = events.filter((e) => e.uid.startsWith('feed-lunar-eclipse-'))
    expect(eclipses.map((e) => [e.uid, e.title.zh])).toEqual([
      ['feed-lunar-eclipse-2026-03-03', '月全食'],
      ['feed-lunar-eclipse-2026-08-28', '月偏食'],
    ])
    // Jupiter in January, Saturn in October; no Mars opposition in 2026
    expect(events.filter((e) => e.uid.startsWith('feed-opposition-')).map((e) => e.uid)).toEqual(['feed-opposition-Jupiter-2026-01-10', 'feed-opposition-Saturn-2026-10-04'])
  })

  it('keeps every id once, and the same from one build to the next', () => {
    const uids = events.map((e) => e.uid)
    expect(new Set(uids).size).toBe(uids.length)
    expect(year(2026).map((e) => e.uid)).toEqual(uids)
  })

  it('writes a file for each language that a phone refreshes daily', () => {
    const [from, to] = feedSpan(Date.UTC(2026, 10, 8))
    expect([new Date(from).getUTCFullYear(), new Date(to).getUTCFullYear()]).toEqual([2025, 2029])
    const some = events.slice(0, 40)
    const unfold = (s: string) => s.replace(/\r\n /g, '')
    const zh = unfold(feedIcs('zh-Hans', some, 0))
    expect(zh).toContain('X-WR-CALNAME:星曆 · 节气与天象')
    expect(zh).toContain('REFRESH-INTERVAL;VALUE=DURATION:P1D')
    expect(unfold(feedIcs('zh-Hant', some, 0, (s) => s.replace('节', '節')))).toContain('X-WR-CALNAME:星曆 · 節气与天象')
    expect(unfold(feedIcs('en', some, 0))).toContain('SUMMARY:🌕 Full Moon')
  })

  it('is found beside the page, as https and as webcal', () => {
    expect(feedPath('en')).toBe('calendar/chroniq-en.ics')
    expect(feedUrls('zh-Hans', 'https://redcarpg.github.io/ChroniQ/')).toEqual({
      https: 'https://redcarpg.github.io/ChroniQ/calendar/chroniq-zh-Hans.ics',
      webcal: 'webcal://redcarpg.github.io/ChroniQ/calendar/chroniq-zh-Hans.ics',
    })
  })
})
