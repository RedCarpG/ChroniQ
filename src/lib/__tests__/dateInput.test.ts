import { describe, expect, it } from 'vitest'
import { parseTime, validDate } from '../dateInput'
import { toBaziInput } from '../savedCharts'
import { parseShareHash } from '../shareLink'

const input = { year: 2026, month: 2, day: 28, hour: 10, minute: 30, gender: 1 }
describe('external birth dates', () => {
  it.each([[2026, 2, 31], [2026, 2, 29], [2024, 4, 31]])('rejects nonexistent date %i-%i-%i', (year, month, day) => {
    expect(validDate(year, month, day)).toBe(false)
    expect(toBaziInput({ ...input, year, month, day })).toBeNull()
    expect(parseShareHash(`#t=bazi&d=${year}-${String(month).padStart(2, '0')}-${day}T10:30&g=m`)).toBeNull()
  })
  it('accepts leap days and rejects DST gaps after loading a birthplace', () => {
    expect(toBaziInput({ ...input, year: 2024, day: 29 })).not.toBeNull()
    expect(parseShareHash('#t=star&d=2024-03-10T02:30&g=m&lat=40.71&lon=-74&tz=America/New_York')).toBeNull()
  })
  it('parses only complete clock times', () => {
    for (const value of ['', '1:', '12', '24:00', '12:60', '-1:00']) expect(parseTime(value)).toBeNull()
    expect(parseTime('23:59')).toEqual({ hour: 23, minute: 59 })
  })
})

it('validates a shared time in its own birthplace rather than the default zone', () => {
  expect(parseShareHash('#t=star&d=1990-04-15T02:30&g=m&lat=40.71&lon=-74&tz=America/New_York')).not.toBeNull()
})
