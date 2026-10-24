import { describe, expect, it } from 'vitest'
import { Constellation, SolarDay } from 'tyme4ts'
import { PAGE_GROUPS } from '../../components/PageMenu'
import { buildDayDetail, enDate, enMonth, weekTitles } from '../../lib/calendar'
import { EN } from '../en'

// Text the 日历 page and the page menu put through t() from data, not from literal t('…') calls
describe('日历 English', () => {
  it('names the pages and their groups', () => {
    const texts = PAGE_GROUPS.flatMap((g) => [g.title, ...g.pages.flatMap((p) => [p.name, p.desc])])
    expect(texts.filter((text) => EN[text] === undefined)).toEqual([])
  })

  it('has the day detail’s pillar labels, sign and holiday marks', () => {
    const detail = buildDayDetail(SolarDay.fromYmd(2026, 10, 24))
    const signs = Array.from({ length: 12 }, (_, i) => `${Constellation.fromIndex(i).getName()}座`)
    const texts = [...detail.pillars.map((p) => p.label), ...signs, '休', '班']
    expect(texts.filter((text) => EN[text] === undefined)).toEqual([])
  })

  it('splits the 节气 day without changing the Chinese', () => {
    const detail = buildDayDetail(SolarDay.fromYmd(2026, 10, 24))
    expect(`${detail.termName}第${detail.termDay}天`).toBe(detail.term)
  })

  it('writes dates in English from the date alone', () => {
    expect(enDate(2026, 10, 24, { day: 'numeric', month: 'long', year: 'numeric' })).toBe('24 October 2026')
    expect(enDate(1900, 1, 1, { weekday: 'long' })).toBe('Monday')
    expect(enMonth(3, 'short')).toBe('Mar')
    expect(weekTitles('sun').map((w) => w.index)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })
})
