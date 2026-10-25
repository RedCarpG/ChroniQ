// @vitest-environment happy-dom
import './dom'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DEFAULT_ZIWEI_SCHOOLS } from '../../lib/ziweiSchools'
import { ZiweiView } from '../ZiweiView'

const input = { year: 1990, month: 5, day: 15, hour: 10, minute: 30, gender: 1 } as const

/** The 运限 rows (大限, 流年, 流月, 流日, 流时), the 叠加 buttons and the layers on the board */
function setUp() {
  const { container } = render(
    <ZiweiView input={input} onChange={() => {}} schools={DEFAULT_ZIWEI_SCHOOLS} onSchoolsChange={() => {}} />,
  )
  const card = container.querySelector<HTMLElement>('#ziwei-fortune')!
  const rows = [...card.querySelectorAll<HTMLElement>('.fortune-group')]
  const [decade, year, month, day, hour] = rows
  const row = {
    isOpen: (r: HTMLElement) => r.classList.contains('open'),
    picked: (r: HTMLElement) => r.querySelector<HTMLElement>('.fortune.selected'),
    chips: (r: HTMLElement) => [...r.querySelectorAll<HTMLElement>('.fortune')],
  }
  const depth = () => card.querySelector('.seg .on')!.textContent
  const openRows = () => rows.filter(row.isOpen).length
  // The board's legend names each 运限 layer laid on it
  const layers = () => [...container.querySelectorAll('#ziwei-board .zc-legend [class*="lm-"]')].map((e) => e.textContent)
  return { rows, decade, year, month, day, hour, row, depth, openRows, layers }
}

describe('ZiweiView 运限 picks', () => {
  it('starts at 本命 with only the 大限 row open', () => {
    const { rows, decade, row, depth, openRows, layers } = setUp()
    expect(rows).toHaveLength(5)
    expect(depth()).toBe('本命')
    expect(openRows()).toBe(1)
    expect(row.isOpen(decade)).toBe(true)
    expect(rows.some((r) => row.picked(r))).toBe(false)
    expect(layers()).toEqual([])
  })

  it('opens the next row as each level is picked, and lays it on the board', () => {
    const { decade, year, month, row, depth, layers } = setUp()
    fireEvent.click(row.chips(decade)[1])
    expect(depth()).toBe('大限')
    expect(row.picked(decade)).toBe(row.chips(decade)[1])
    expect(row.isOpen(year)).toBe(true)
    expect(row.isOpen(month)).toBe(false)

    fireEvent.click(row.chips(year)[2])
    expect(depth()).toBe('流年')
    expect(row.isOpen(month)).toBe(true)
    expect(layers()).toEqual(['大限', '流年'])
  })

  it('peels back to the level above when the picked chip is clicked again, shutting the finer rows', () => {
    const { decade, year, month, day, hour, row, depth, layers } = setUp()
    fireEvent.click(row.chips(decade)[1])
    fireEvent.click(row.chips(year)[2])
    fireEvent.click(row.chips(month)[3])
    expect(depth()).toBe('流月')
    expect(row.isOpen(day)).toBe(true)

    fireEvent.click(row.picked(year)!)
    expect(depth()).toBe('大限')
    expect(row.picked(year)).toBeNull()
    expect(row.picked(month)).toBeNull()
    expect([month, day, hour].some(row.isOpen)).toBe(false)
    expect(layers()).toEqual(['大限'])

    fireEvent.click(row.picked(decade)!)
    expect(depth()).toBe('本命')
    expect(row.picked(decade)).toBeNull()
    expect(row.isOpen(year)).toBe(false)
    expect(layers()).toEqual([])
  })

  it('picking another chip of a shown level moves the pick without dropping the level', () => {
    const { decade, year, row, depth } = setUp()
    fireEvent.click(row.chips(decade)[1])
    fireEvent.click(row.chips(year)[2])
    fireEvent.click(row.chips(year)[4])
    expect(depth()).toBe('流年')
    expect(row.picked(year)).toBe(row.chips(year)[4])
  })
})
