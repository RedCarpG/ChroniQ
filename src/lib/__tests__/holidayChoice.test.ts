// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { chosenDays, loadHolidayChoice, offTags, saveHolidayChoice } from '../regionHolidays'

beforeEach(() => localStorage.clear())

describe('the calendar holiday choice', () => {
  it('shows China only, by default', () => {
    expect(loadHolidayChoice()).toEqual({ china: true, regions: [] })
  })

  it('keeps what was chosen', () => {
    saveHolidayChoice({ china: false, regions: ['fr'] })
    expect(loadHolidayChoice()).toEqual({ china: false, regions: ['fr'] })
  })

  it('carries over a country picked on the calendar page or in the settings before', () => {
    localStorage.setItem('chroniq-calendar-region', 'fr')
    expect(loadHolidayChoice()).toEqual({ china: true, regions: ['fr'] })
    localStorage.clear()
    localStorage.setItem('chroniq-settings', JSON.stringify({ region: 'fr' }))
    expect(loadHolidayChoice()).toEqual({ china: true, regions: ['fr'] })
  })

  it('ignores countries it does not know', () => {
    localStorage.setItem('chroniq-calendar-holidays', JSON.stringify({ china: true, regions: ['fr', 'xx'] }))
    expect(loadHolidayChoice().regions).toEqual(['fr'])
  })
})

describe('tags on a day', () => {
  it('tags a nationwide day off, a partial one more lightly, and nothing for a notable day', () => {
    expect(offTags(chosenDays(['fr'], 2026, 7, 14))).toEqual([{ tag: 'FR', partial: false }])
    expect(offTags(chosenDays(['fr'], 2026, 12, 26))).toEqual([{ tag: 'FR', partial: true }])
    expect(offTags(chosenDays(['fr'], 2026, 2, 14))).toEqual([])
    expect(chosenDays([], 2026, 7, 14)).toEqual([])
  })
})
