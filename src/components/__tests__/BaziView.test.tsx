// @vitest-environment jsdom
import './dom'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SCHOOLS } from '../../lib/schools'
import { BaziView } from '../BaziView'

const input = { year: 1990, month: 5, day: 15, hour: 10, minute: 30, gender: 1 } as const

/** The 岁运 panel's rows (大运, 流年, 流月, 流日) and the 岁运盘's columns */
function setUp() {
  const { container } = render(
    <BaziView input={input} onChange={() => {}} schools={DEFAULT_SCHOOLS} onSchoolsChange={() => {}} />,
  )
  const rows = [...container.querySelectorAll<HTMLElement>('.fortune-side .fortune-group')]
  const [decade, year, month, day] = rows
  const row = {
    isOpen: (r: HTMLElement) => r.classList.contains('open'),
    picked: (r: HTMLElement) => r.querySelector<HTMLElement>('.fortune.selected'),
    chips: (r: HTMLElement) => [...r.querySelectorAll<HTMLElement>('.fortune')],
    summary: (r: HTMLElement) => r.querySelector('.fortune-summary')!.textContent,
  }
  // 岁运 columns come before the natal 年柱…时柱
  const columns = () =>
    [...container.querySelectorAll('.fortune-main .pillars thead th')]
      .map((th) => th.textContent!.trim())
      .filter((t) => t && !t.endsWith('柱'))
  const note = () => container.querySelector('.fortune-main .row-note')!.textContent
  return { rows, decade, year, month, day, row, columns, note }
}

describe('BaziView 岁运 picks', () => {
  it('starts with every level picked and in the 岁运盘', () => {
    const { rows, row, columns } = setUp()
    expect(rows).toHaveLength(4)
    expect(rows.every((r) => row.isOpen(r) && row.picked(r))).toBe(true)
    expect(columns()).toEqual(['流日', '流月', '流年', '大運'])
  })

  it('drops 流日 from the 岁运盘 when its picked chip is clicked again, and brings it back', () => {
    const { day, row, columns } = setUp()
    fireEvent.click(row.picked(day)!)
    expect(row.picked(day)).toBeNull()
    expect(row.summary(day)).toContain('未选')
    expect(columns()).toEqual(['流月', '流年', '大運'])

    fireEvent.click(row.chips(day)[3])
    expect(row.picked(day)).toBe(row.chips(day)[3])
    expect(columns()).toEqual(['流日', '流月', '流年', '大運'])
  })

  it('takes 流月 and 流日 with 流年, and opens 流月 when 流年 comes back', () => {
    const { year, month, day, row, columns } = setUp()
    fireEvent.click(row.picked(year)!)
    expect(columns()).toEqual(['大運'])
    expect([year, month, day].map((r) => row.picked(r))).toEqual([null, null, null])
    expect(row.isOpen(month)).toBe(false)
    expect(row.isOpen(day)).toBe(false)

    fireEvent.click(row.chips(year)[2])
    expect(row.picked(year)).toBe(row.chips(year)[2])
    expect(row.isOpen(month)).toBe(true)
    // 流月 and 流日 stay out until picked
    expect(row.picked(month)).toBeNull()
    expect(columns()).toEqual(['流年', '大運'])
  })

  it('takes 流日 with 流月, and opens 流日 when 流月 comes back', () => {
    const { month, day, row, columns } = setUp()
    fireEvent.click(row.picked(month)!)
    expect(row.picked(day)).toBeNull()
    expect(row.isOpen(day)).toBe(false)
    expect(columns()).toEqual(['流年', '大運'])

    fireEvent.click(row.chips(month)[0])
    expect(row.isOpen(day)).toBe(true)
    expect(row.picked(day)).toBeNull()
    expect(columns()).toEqual(['流月', '流年', '大運'])
  })

  it('keeps the 大运 picked when its chip is clicked again', () => {
    const { decade, row, columns } = setUp()
    const picked = row.picked(decade)!
    fireEvent.click(picked)
    expect(row.picked(decade)).toBe(picked)
    expect(columns()).toContain('大運')
  })

  it('switching 大运 resets the finer picks but keeps their levels in', () => {
    const { decade, year, row, columns } = setUp()
    const other = row.chips(decade).find((c) => c !== row.picked(decade))!
    fireEvent.click(other)
    expect(row.picked(decade)).toBe(other)
    expect(row.picked(year)).not.toBeNull()
    expect(columns()).toEqual(['流日', '流月', '流年', '大運'])
  })

  it('lists only what is picked in the 岁运盘 note', () => {
    const { year, row, note } = setUp()
    fireEvent.click(row.picked(year)!)
    // Only the 大运 is left, e.g. 甲申運，合参命主原局 (運: proper nouns default to 繁體)
    expect(note()).toMatch(/^\p{Script=Han}{2}運，合参命主原局$/u)
  })
})
