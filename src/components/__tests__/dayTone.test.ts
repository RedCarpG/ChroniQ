import { describe, expect, it } from 'vitest'
import type { DayCell } from '../../lib/calendar'
import type { ChartDay } from '../../lib/chartDays'
import type { TaggedRegionDay } from '../../lib/regionHolidays'
import { dayTone } from '../CalendarViews'

const day = (o: Partial<DayCell> = {}) => o as DayCell
const fr = (kind: TaggedRegionDay['kind']) => ({ kind, code: 'fr', tag: 'FR' }) as TaggedRegionDay
const mine = (kind: ChartDay['kind']) => ({ kind }) as ChartDay

describe('dayTone', () => {
  it('gives each kind of day its background, strongest first', () => {
    expect(dayTone(day({ holiday: '休', festival: '国庆节' }), [fr('public')], [mine('birthday')])).toBe('tone-off')
    expect(dayTone(day({ holiday: '班' }), [fr('public')], [])).toBe('tone-region')
    expect(dayTone(day({ holiday: '班', festival: '重阳节' }), [], [])).toBe('tone-work')
    expect(dayTone(day({ festival: '重阳节' }), [], [mine('birthday')])).toBe('tone-festival')
    expect(dayTone(day(), [], [mine('birthday')])).toBe('tone-mine')
  })

  it('leaves plain days, notable foreign days and 冲 days without a background', () => {
    expect(dayTone(day(), [fr('observance')], [mine('pillar')])).toBe(false)
  })
})
