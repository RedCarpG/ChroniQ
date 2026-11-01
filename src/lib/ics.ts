// A calendar file (RFC 5545) for phones' and computers' own calendars, which can remind where this
// site, having no server, cannot. Importing it again updates the events, as their ids stay the same.

export type IcsEntry = {
  uid: string
  title: string
  description?: string
  location?: string
} & (
  | { start: number; end: number; /** A reminder, minutes before */ alarm?: number }
  /** All day, YYYY-MM-DD */
  | { date: string }
)

/** Text as a property value wants it */
const escapeText = (text: string) => text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

const utcStamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
const dateValue = (date: string) => date.replace(/-/g, '')
const nextDate = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86400_000).toISOString().slice(0, 10)

/** A long line folded at 75 bytes, never inside a character (continuation lines start with a space) */
function fold(line: string): string {
  const encoder = new TextEncoder()
  const out: string[] = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const size = encoder.encode(ch).length
    if (bytes + size > 75) {
      out.push(current)
      current = ' '
      bytes = 1
    }
    current += ch
    bytes += size
  }
  out.push(current)
  return out.join('\r\n')
}

export function buildIcs(calendarName: string, entries: IcsEntry[], stamp: number = Date.now()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ChroniQ//Sky and calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ]
  for (const e of entries) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@chroniq`, `DTSTAMP:${utcStamp(stamp)}`)
    if ('date' in e) {
      lines.push(`DTSTART;VALUE=DATE:${dateValue(e.date)}`, `DTEND;VALUE=DATE:${dateValue(nextDate(e.date))}`, 'TRANSP:TRANSPARENT')
    } else {
      lines.push(`DTSTART:${utcStamp(e.start)}`, `DTEND:${utcStamp(e.end)}`)
    }
    lines.push(`SUMMARY:${escapeText(e.title)}`)
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`)
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`)
    if ('start' in e && e.alarm) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(e.title)}`, `TRIGGER:-PT${e.alarm}M`, 'END:VALARM')
    }
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** Saves a calendar file through the browser */
export function downloadIcs(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
