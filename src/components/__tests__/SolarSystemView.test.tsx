// @vitest-environment happy-dom
import './dom'
import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SolarSystemView } from '../SolarSystemView'

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.useFakeTimers({ toFake: ['Date'] })
  // Venus going backwards, a few days before it turns direct again
  vi.setSystemTime(new Date('2026-11-06T06:47:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const setUp = () => {
  const { container } = render(<SolarSystemView />)
  // The map is drawn behind the page, put into <body>
  const map = () => document.querySelector<SVGSVGElement>('svg.orrery')!
  const grid = () => [...map().querySelectorAll('.orrery-au')].map((t) => t.textContent)
  const month = () => container.querySelector<HTMLSelectElement>('.date-parts select')!.value
  return { container, map, grid, month }
}

describe('太阳系', () => {
  it('zooms from the inner planets out past Jupiter', () => {
    const { container, grid } = setUp()
    expect(grid()).toContain('1 AU')
    expect(grid()).not.toContain('5 AU')
    const [, zoomOut] = [...container.querySelectorAll<HTMLButtonElement>('.imm-zoom button')]
    for (let i = 0; i < 5; i++) fireEvent.click(zoomOut)
    expect(grid()).toContain('5 AU')
    expect(document.querySelector('.orrery-planet.pl-jupiter')).not.toBeNull()
  })

  it('picks a planet: its card says it is going backwards, and until when', () => {
    const { container } = setUp()
    fireEvent.click(document.querySelector('.orrery-planet.pl-venus')!)
    // On a wide screen the card lies beside the planet on the map (behind the page, in <body>)
    const card = document.querySelector('.solar-card')!
    expect(card.querySelector('strong')!.textContent).toBe('金星')
    expect(card.textContent).toContain('逆行中')
    expect(card.textContent).toMatch(/转顺行/)
    // Its times of going backwards this year are marked along the bottom
    expect(container.querySelectorAll('.solar-retro').length).toBeGreaterThan(0)
  })

  it('moves the date when the map is dragged across, without letting go of the planet', () => {
    const { map, month } = setUp()
    fireEvent.click(document.querySelector('.orrery-planet.pl-venus')!)
    expect(month()).toBe('11')
    fireEvent.pointerDown(map(), { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(map(), { pointerId: 1, clientX: 160, clientY: 100 })
    fireEvent.pointerUp(map(), { pointerId: 1, clientX: 160, clientY: 100 })
    fireEvent.click(map())
    expect(month()).not.toBe('11')
    expect(document.querySelector('.solar-card strong')!.textContent).toBe('金星')
  })

  it('zooms with two fingers without moving the date, also when one finger lifts first', () => {
    const { map, grid, month } = setUp()
    const touch = (id: number, x: number) => ({ pointerId: id, pointerType: 'touch', clientX: x, clientY: 300 })
    fireEvent.pointerDown(map(), touch(1, 200))
    fireEvent.pointerMove(map(), touch(1, 196))
    fireEvent.pointerDown(map(), touch(2, 260))
    // Pinching in: the fingers closer, the map reaching further out
    fireEvent.pointerMove(map(), touch(2, 215))
    expect(grid()).toContain('5 AU')
    fireEvent.pointerUp(map(), touch(2, 215))
    // The finger left behind moves on: still not a drag through time
    fireEvent.pointerMove(map(), touch(1, 120))
    fireEvent.pointerMove(map(), touch(1, 40))
    fireEvent.pointerUp(map(), touch(1, 40))
    expect(month()).toBe('11')
  })

  it('opens with a planet picked (from 今日)', () => {
    render(<SolarSystemView planet="venus" />)
    expect(document.querySelector('.solar-card strong')!.textContent).toBe('金星')
  })
})
