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

describe('SkyView dragged through time', () => {
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
