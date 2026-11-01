import { describe, expect, it } from 'vitest'
import { buildIcs } from '../ics'

const STAMP = Date.UTC(2026, 0, 2, 3, 4, 5)
const unfold = (text: string) => text.replace(/\r\n /g, '')

describe('buildIcs', () => {
  it('writes a timed event in UTC with its reminder', () => {
    const text = buildIcs('星曆', [{ uid: 'a', title: '月全食', start: Date.UTC(2026, 2, 3, 11, 0), end: Date.UTC(2026, 2, 3, 12, 30), alarm: 60 }], STAMP)
    expect(text).toContain('BEGIN:VCALENDAR\r\n')
    expect(text).toContain('UID:a@chroniq\r\n')
    expect(text).toContain('DTSTAMP:20260102T030405Z\r\n')
    expect(text).toContain('DTSTART:20260303T110000Z\r\n')
    expect(text).toContain('DTEND:20260303T123000Z\r\n')
    expect(text).toContain('TRIGGER:-PT60M\r\n')
    expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('writes an all-day event ending the next day, across a month end', () => {
    const text = buildIcs('星曆', [{ uid: 'b', title: '立春', date: '2026-01-31' }], STAMP)
    expect(text).toContain('DTSTART;VALUE=DATE:20260131\r\n')
    expect(text).toContain('DTEND;VALUE=DATE:20260201\r\n')
    expect(text).not.toContain('VALARM')
  })

  it('escapes what the format reserves', () => {
    const text = buildIcs('星曆', [{ uid: 'c', title: 'a,b;c\\d', description: 'one\ntwo', date: '2026-01-01' }], STAMP)
    expect(text).toContain('SUMMARY:a\\,b\\;c\\\\d\r\n')
    expect(text).toContain('DESCRIPTION:one\\ntwo\r\n')
  })

  it('folds at 75 bytes without splitting a character', () => {
    const title = '流星雨'.repeat(40)
    const text = buildIcs('星曆', [{ uid: 'd', title, date: '2026-01-01' }], STAMP)
    const encoder = new TextEncoder()
    for (const line of text.split('\r\n')) expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    expect(text).not.toContain('�')
    expect(unfold(text)).toContain(`SUMMARY:${title}\r\n`)
  })
})
