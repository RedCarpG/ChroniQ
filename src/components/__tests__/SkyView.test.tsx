// @vitest-environment jsdom
import './dom'
import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLACE } from '../../lib/place'
import { SkyView } from '../SkyView'

// jsdom has no PointerEvent: a mouse event with a pointer id stands in, so pointer events carry their coordinates
if (!('PointerEvent' in globalThis)) {
  class PointerEventStub extends MouseEvent {
    pointerId: number
    pointerType: string
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.pointerType = init.pointerType ?? 'mouse'
    }
  }
  Object.assign(globalThis, { PointerEvent: PointerEventStub })
}

// Beijing, 02:57 on 25 October 2026: Jupiter, Saturn and Sirius are up, the Sun is not
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-24T18:57:00Z'))
})
afterEach(() => vi.useRealTimers())

function setUp() {
  const { container } = render(<SkyView place={DEFAULT_PLACE} />)
  // The map is the page's backdrop, rendered into <body> rather than in the page
  const map = document.querySelector<SVGSVGElement>('.sky-backdrop .sky-map')!
  return {
    container,
    map,
    row: (name: string) => [...container.querySelectorAll<HTMLElement>('.sky-table tbody tr')].find((r) => r.textContent!.includes(name))!,
    info: () => container.querySelector('.sky-chosen-info')?.textContent ?? null,
    ringed: () => map.querySelector('.sky-chosen') !== null,
    time: () => container.querySelector<HTMLInputElement>('.sky-controls input[type=time]')!.value,
  }
}

describe('SkyView as the backdrop', () => {
  it('draws the map behind the page, beside an empty window for it in the page', () => {
    const { container, map } = setUp()
    expect(map).not.toBeNull()
    expect(container.contains(map)).toBe(false)
    expect(container.querySelector('.sky-window')).not.toBeNull()
  })
})

describe('SkyView choosing a body or star', () => {
  it('rings a body picked from the table and pops it, without zooming the map; picking it again lets go', () => {
    const { map, row, info, ringed } = setUp()
    expect(info()).toBeNull()

    fireEvent.click(row('木星'))
    expect(info()).toContain('木星')
    expect(ringed()).toBe(true)
    expect(map.classList.contains('has-chosen')).toBe(true)
    expect(map.querySelector('.sky-jupiter')!.classList.contains('on')).toBe(true)
    expect(row('木星').classList.contains('chosen')).toBe(true)
    // Nothing on the map is moved or scaled as a whole
    expect(map.querySelector('[style*="scale"]')).toBeNull()

    fireEvent.click(row('木星'))
    expect(info()).toBeNull()
    expect(ringed()).toBe(false)
    expect(map.classList.contains('has-chosen')).toBe(false)
  })

  it('picks a named star on the map, and lets go on the empty sky or Esc', () => {
    const { map, info, ringed } = setUp()
    const sirius = () => [...map.querySelectorAll('.sky-star')].find((g) => g.getAttribute('data-tip')!.startsWith('天狼星'))!

    fireEvent.click(sirius())
    expect(info()).toContain('天狼星')
    expect(ringed()).toBe(true)
    fireEvent.click(map.querySelector('.sky-disc')!)
    expect(info()).toBeNull()

    fireEvent.click(sirius())
    expect(info()).toContain('天狼星')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(info()).toBeNull()
  })

  it('shows a body below the horizon in the panel without ringing it on the map', () => {
    const { map, row, info, ringed } = setUp()
    fireEvent.click(row('太阳'))
    expect(info()).toContain('太阳')
    expect(ringed()).toBe(false)
    expect(map.classList.contains('has-chosen')).toBe(false)
  })

  it('can be chosen from the keyboard', () => {
    const { map, info } = setUp()
    fireEvent.keyDown(map.querySelector('.sky-saturn')!, { key: 'Enter' })
    expect(info()).toContain('土星')
  })
})

describe('SkyView constellations and paths', () => {
  it('picks out a constellation: its lines drawn in, the rest faded, its name and set in the panel', () => {
    const { map, info } = setUp()
    const figure = map.querySelector<SVGGElement>('.sky-figure')!
    const name = figure.getAttribute('data-tip')!
    fireEvent.click(figure)
    expect(figure.classList.contains('on')).toBe(true)
    expect(map.querySelector('.sky-figures')!.classList.contains('has-chosen')).toBe(true)
    expect(map.querySelector('.sky-figure-name.chosen')!.textContent).toBe(name)
    expect(info()).toContain(name)
    expect(info()).toContain('西方星座')
    // A figure has no ring and dims no stars
    expect(map.querySelector('.sky-chosen')).toBeNull()
    expect(map.classList.contains('has-chosen')).toBe(false)
    fireEvent.click(figure)
    expect(info()).toBeNull()
  })

  it('draws the path of a chosen star alongside the usual ones, picked out with its hours', () => {
    const { map } = setUp()
    const usual = map.querySelectorAll('.sky-path').length
    fireEvent.click([...map.querySelectorAll('.sky-star')].find((g) => g.getAttribute('data-tip')!.startsWith('天狼星'))!)
    expect(map.querySelectorAll('.sky-path')).toHaveLength(usual + 1)
    expect(map.querySelector('.sky-paths')!.classList.contains('has-focus')).toBe(true)
    expect(map.querySelectorAll('.sky-path.on')).toHaveLength(1)
    expect(map.querySelectorAll('.sky-hour-labels text').length).toBeGreaterThan(0)
  })
})

describe('SkyView with the paths off', () => {
  it('offers the chosen one’s path in its line in the panel', () => {
    localStorage.setItem('chroniq-sky-paths', 'off')
    const { map, row, container } = setUp()
    fireEvent.click(row('月亮'))
    expect(map.querySelectorAll('.sky-path')).toHaveLength(0)
    fireEvent.click(container.querySelector('.sky-show-path')!)
    expect(map.querySelector('.sky-path.on')).not.toBeNull()
    expect(container.querySelector('.sky-show-path')).toBeNull()
    localStorage.removeItem('chroniq-sky-paths')
  })
})

describe('SkyView zoomed', () => {
  it('zooms the map alone with its buttons, within limits, and comes back to full size', () => {
    const { map } = setUp()
    const zoomIn = document.querySelector<HTMLButtonElement>('.sky-zoom-buttons [aria-label="放大"]')!
    const reset = document.querySelector<HTMLButtonElement>('.sky-zoom-buttons [aria-label="复原"]')!
    const scale = () => Number(/scale\(([\d.]+)\)/.exec(map.querySelector('g')!.getAttribute('transform')!)![1])
    expect(map.classList.contains('zoomed')).toBe(false)
    expect(reset.disabled).toBe(true)
    const full = scale()
    fireEvent.click(zoomIn)
    expect(map.classList.contains('zoomed')).toBe(true)
    expect(scale()).toBeCloseTo(full * 1.6)
    // Never past eight times
    for (let i = 0; i < 10; i++) fireEvent.click(zoomIn)
    expect(scale()).toBeCloseTo(full * 8)
    expect(zoomIn.disabled).toBe(true)
    fireEvent.click(reset)
    expect(scale()).toBeCloseTo(full)
    expect(map.classList.contains('zoomed')).toBe(false)
  })
})

describe('SkyView hovered while one is chosen', () => {
  it('lights the hovered one up and keeps the path of the chosen one picked out beside its own', () => {
    const { map, row } = setUp()
    fireEvent.click(row('土星'))
    const lit = () => map.querySelectorAll('.sky-path.on').length
    expect(lit()).toBe(1)
    fireEvent.pointerEnter(row('海王星'), { pointerType: 'mouse' })
    expect(map.querySelector('.sky-neptune')!.classList.contains('hover')).toBe(true)
    expect(map.querySelector('.sky-saturn')!.classList.contains('on')).toBe(true)
    // Saturn's path stays; Neptune's (not among the usual ones) is added and picked out too
    expect(lit()).toBe(2)
    fireEvent.pointerLeave(row('海王星'), { pointerType: 'mouse' })
    expect(lit()).toBe(1)
  })
})

describe('SkyView dragged through time', () => {
  it('keeps the chosen one’s path while the others wait for the drag to end', () => {
    const { map, row } = setUp()
    fireEvent.click(row('土星'))
    map.setPointerCapture = () => {}
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb))
    const flush = () => act(() => frames.splice(0).forEach((cb) => cb(0)))
    fireEvent.pointerDown(map, { pointerId: 3, pointerType: 'mouse', button: 0, clientX: 100, clientY: 200 })
    fireEvent.pointerMove(map, { pointerId: 3, pointerType: 'mouse', clientX: 160, clientY: 200 })
    flush()
    // Mid-drag: only Saturn's path, still picked out
    expect(map.querySelectorAll('.sky-path')).toHaveLength(1)
    expect(map.querySelectorAll('.sky-path.on')).toHaveLength(1)
    // Let go: all the paths come back, at the time the drag left
    fireEvent.pointerUp(map, { pointerId: 3, pointerType: 'mouse', clientX: 160, clientY: 200 })
    flush()
    flush()
    expect(map.querySelectorAll('.sky-path')).toHaveLength(7)
    expect(map.querySelectorAll('.sky-path.on')).toHaveLength(1)
  })

  it('does not draw a chosen figure in again as the time moves on', () => {
    const { map, container } = setUp()
    // One near the pole, up all night, late in the list: figures before it rise and set, and its place shifts
    const ursaMinor = [...map.querySelectorAll('.sky-figure')].find((g) => g.getAttribute('data-tip') === '小熊座')!
    fireEvent.click(ursaMinor)
    const chosen = map.querySelector('.sky-figure.on')
    expect(chosen).toBe(ursaMinor)
    const input = container.querySelector<HTMLInputElement>('.sky-controls input[type=time]')!
    for (const time of ['06:00', '09:00', '12:00']) {
      fireEvent.change(input, { target: { value: time } })
      // The same element: its draw-in animation does not start over
      expect(map.querySelector('.sky-figure.on')).toBe(chosen)
    }
  })

  it('turns the time with the middle button also when zoomed in, where the left button moves the map', () => {
    const { map, time } = setUp()
    fireEvent.click(document.querySelector('.sky-zoom-buttons [aria-label="放大"]')!)
    map.setPointerCapture = () => {}
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb))
    const flush = () => act(() => frames.splice(0).forEach((cb) => cb(0)))
    const transform = () => map.querySelector('g')!.getAttribute('transform')
    const before = transform()
    fireEvent.pointerDown(map, { pointerId: 2, pointerType: 'mouse', button: 1, clientX: 100, clientY: 200 })
    fireEvent.pointerMove(map, { pointerId: 2, pointerType: 'mouse', clientX: 372, clientY: 200 })
    flush()
    // 272 px at 1.6 times is 170 map units: three hours, and the map has not moved
    expect(time()).toBe('05:57')
    expect(transform()).toBe(before)
    fireEvent.pointerUp(map, { pointerId: 2, pointerType: 'mouse', clientX: 372, clientY: 200 })
  })

  it('turns the time as the sky is dragged sideways, and a drag is not a click on the empty sky', () => {
    const { map, row, info, time } = setUp()
    fireEvent.click(row('木星'))
    // jsdom has no layout: the map counts as 400 px square
    map.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON() {} })
    map.setPointerCapture = () => {}
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb))
    const flush = () => act(() => frames.splice(0).forEach((cb) => cb(0)))

    expect(time()).toBe('02:57')
    fireEvent.pointerDown(map, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 100, clientY: 200 })
    fireEvent.pointerMove(map, { pointerId: 1, pointerType: 'touch', clientX: 270, clientY: 200 })
    flush()
    // 170 units is half the disc across: three hours later
    expect(time()).toBe('05:57')
    expect(document.querySelector('.sky-drag-chip')!.textContent).toContain('+3 小时')
    fireEvent.pointerUp(map, { pointerId: 1, pointerType: 'touch', clientX: 270, clientY: 200 })
    fireEvent.click(map.querySelector('.sky-disc')!)
    flush()
    flush()
    expect(info()).toContain('木星')
    expect(document.querySelector('.sky-drag-chip')).toBeNull()
  })
})
