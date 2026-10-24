// @vitest-environment jsdom
import './dom'
import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLACE } from '../../lib/place'
import { SkyView } from '../SkyView'

// Beijing, 02:57 on 25 October 2026: Jupiter, Saturn and Sirius are up, the Sun is not
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-24T18:57:00Z'))
})
afterEach(() => vi.useRealTimers())

function setUp() {
  const { container } = render(<SkyView place={DEFAULT_PLACE} />)
  const map = container.querySelector<SVGSVGElement>('.sky-map')!
  return {
    map,
    row: (name: string) => [...container.querySelectorAll<HTMLElement>('.sky-table tbody tr')].find((r) => r.textContent!.includes(name))!,
    info: () => container.querySelector('.sky-chosen-info')?.textContent ?? null,
    zoomed: () => container.querySelector('.sky-zoom')!.getAttribute('style')?.includes('scale(1.5)') ?? false,
    ringed: () => container.querySelector('.sky-chosen') !== null,
  }
}

describe('SkyView choosing a body or star', () => {
  it('rings a body picked from the table and zooms in on it; picking it again lets go', () => {
    const { map, row, info, zoomed, ringed } = setUp()
    expect(info()).toBeNull()
    expect(zoomed()).toBe(false)

    fireEvent.click(row('木星'))
    expect(info()).toContain('木星')
    expect(zoomed()).toBe(true)
    expect(ringed()).toBe(true)
    expect(map.classList.contains('has-chosen')).toBe(true)
    expect(map.querySelector('.sky-jupiter')!.classList.contains('on')).toBe(true)
    expect(row('木星').classList.contains('chosen')).toBe(true)

    fireEvent.click(row('木星'))
    expect(info()).toBeNull()
    expect(zoomed()).toBe(false)
    expect(map.classList.contains('has-chosen')).toBe(false)
  })

  it('picks a named star on the map, and lets go on the empty sky or Esc', () => {
    const { map, info, zoomed } = setUp()
    const sirius = () => [...map.querySelectorAll('.sky-star')].find((g) => g.querySelector('title')!.textContent!.startsWith('天狼星'))!

    fireEvent.click(sirius())
    expect(info()).toContain('天狼星')
    expect(zoomed()).toBe(true)
    fireEvent.click(map.querySelector('.sky-disc')!)
    expect(info()).toBeNull()

    fireEvent.click(sirius())
    expect(info()).toContain('天狼星')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(info()).toBeNull()
    expect(zoomed()).toBe(false)
  })

  it('shows a body below the horizon in the panel without zooming the map', () => {
    const { map, row, info, zoomed, ringed } = setUp()
    fireEvent.click(row('太阳'))
    expect(info()).toContain('太阳')
    expect(zoomed()).toBe(false)
    expect(ringed()).toBe(false)
    expect(map.classList.contains('has-chosen')).toBe(false)
  })

  it('can be chosen from the keyboard', () => {
    const { map, info } = setUp()
    fireEvent.keyDown(map.querySelector('.sky-saturn')!, { key: 'Enter' })
    expect(info()).toContain('土星')
  })
})
