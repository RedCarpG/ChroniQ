// @vitest-environment happy-dom
import './dom'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLACE } from '../../lib/place'
import { SkyView } from '../SkyView'

// Mouse events stand in for pointer and wheel events, so they carry the pointer's place
{
  class PointerEventStub extends MouseEvent {
    pointerId: number
    pointerType: string
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.pointerType = init.pointerType ?? 'mouse'
    }
  }
  // And for the wheel: happy-dom's WheelEvent leaves the pointer's place (clientX, clientY) unset
  class WheelEventStub extends MouseEvent {
    deltaX: number
    deltaY: number
    deltaZ: number
    deltaMode: number
    constructor(type: string, init: WheelEventInit = {}) {
      super(type, init)
      this.deltaX = init.deltaX ?? 0
      this.deltaY = init.deltaY ?? 0
      this.deltaZ = init.deltaZ ?? 0
      this.deltaMode = init.deltaMode ?? 0
    }
  }
  // On the global, and on the window the DOM's events are made from (Testing Library takes them from there)
  for (const target of [globalThis, document.defaultView ?? globalThis])
    Object.assign(target, { PointerEvent: PointerEventStub, WheelEvent: WheelEventStub })
}

// Beijing, 02:57 on 25 October 2026: Jupiter, Saturn and Sirius are up, the Sun is not
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-24T18:57:00Z'))
})
afterEach(() => vi.useRealTimers())

function setUp() {
  // The left drawer's slots, where the page puts its 显示 (App renders the drawer)
  for (const id of ['drawer-rail-slot', 'drawer-page-panel'])
    if (!document.getElementById(id)) document.body.appendChild(Object.assign(document.createElement('div'), { id }))
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

  it('keeps the sky itself in a layer of its own under the map, and the Milky Way and the plain stars on a canvas between', () => {
    const { map } = setUp()
    const canvas = map.previousElementSibling!
    expect(canvas.classList.contains('sky-canvas')).toBe(true)
    const back = canvas.previousElementSibling!
    expect(back.classList.contains('sky-map-back')).toBe(true)
    expect(back.querySelector('.sky-disc')).not.toBeNull()
    // On the map only what can be pointed at: the named stars, each a point of light in its colour
    const stars = map.querySelectorAll('.sky-star')
    expect(stars.length).toBeGreaterThan(5)
    expect(map.querySelectorAll('.sky-stars > :not(.sky-star)')).toHaveLength(0)
    expect(stars[0].querySelector('.disc')!.getAttribute('fill')).toMatch(/^url\(#.+-star-\d\)$/)
  })
})

describe('SkyView panels', () => {
  it('puts the moment and the place in a bar above the sky, 地点 opening the place’s details', () => {
    const { container } = setUp()
    const bar = container.querySelector('.sky-toolbar .sky-timebar')!
    expect(bar.querySelector('input[type=time]')).not.toBeNull()
    const place = bar.querySelector<HTMLButtonElement>('.sky-place-button')!
    expect(place.textContent).toContain('地点')
    expect(place.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(place)
    expect(place.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('.sky-place-pop')!.textContent).toContain('上空')
    // A press elsewhere shuts it
    fireEvent.pointerDown(document.body)
    expect(container.querySelector('.sky-place-pop')).toBeNull()
  })

  it('has 显示 in the drawer on the left, and the bodies on the right with no card', () => {
    const { container } = setUp()
    const handle = document.querySelector('#drawer-rail-slot .drawer-handle')!
    expect(handle.textContent).toBe('显示')
    const options = document.querySelector('#drawer-page-panel .sky-drawer-options')!
    expect(options.textContent).toContain('视角')
    expect(options.querySelector('[role=switch]')!.getAttribute('aria-checked')).toBe('true')
    const bodies = container.querySelector('.sky-bodies')!
    expect(bodies.querySelector('.sky-table')).not.toBeNull()
    expect(bodies.classList.contains('card')).toBe(false)
  })

  it('draws the sky sharp, or smooth without the twinkling, as chosen and remembered', () => {
    localStorage.removeItem('chroniq-sky-quality')
    setUp()
    const twinkles = () => document.querySelectorAll('.sky-twinkles i').length
    const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('[aria-label=画质] button')].find((b) => b.textContent === label)!
    expect(button('清晰').getAttribute('aria-pressed')).toBe('true')
    expect(twinkles()).toBeGreaterThan(0)
    fireEvent.click(button('流畅'))
    expect(button('流畅').getAttribute('aria-pressed')).toBe('true')
    expect(twinkles()).toBe(0)
    expect(localStorage.getItem('chroniq-sky-quality')).toBe('smooth')
    cleanup()
    setUp()
    expect(twinkles()).toBe(0)
    localStorage.removeItem('chroniq-sky-quality')
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
    // Nothing on the map is moved or scaled as a whole
    expect(map.querySelector('[style*="scale"]')).toBeNull()

    // Picked again on the map, it lets go
    fireEvent.click(map.querySelector('.sky-jupiter')!)
    expect(info()).toBeNull()
    expect(ringed()).toBe(false)
    expect(map.classList.contains('has-chosen')).toBe(false)
  })

  it('tells of the chosen one in place of the table, and goes back to the table', () => {
    const { container, row, info } = setUp()
    fireEvent.click(row('木星'))
    expect(container.querySelector('.sky-table')).toBeNull()
    expect(info()).toMatch(/古称[岁歲]星，五行属木/)
    const facts = Object.fromEntries(
      [...container.querySelectorAll('.sky-facts dt')].map((dt) => [dt.textContent, dt.nextElementSibling!.textContent]),
    )
    // Beijing, 02:57: Jupiter, up, rose at 00:53 and sets in the afternoon; it is in 星宿, some 5.6 AU off
    expect(facts['升起']).toBe('00:53')
    expect(facts['落下']).toMatch(/^1\d:\d\d$/)
    expect(facts['宿']).toBe('星宿')
    expect(facts['距离']).toMatch(/^5\.\d\d AU · 光行 /)
    fireEvent.click(container.querySelector('.sky-back')!)
    expect(info()).toBeNull()
    expect(container.querySelector('.sky-table')).not.toBeNull()
  })

  it('tells of a star its colour and whether it ever sets', () => {
    const { map, container } = setUp()
    fireEvent.click([...map.querySelectorAll('.sky-star')].find((g) => g.getAttribute('data-tip')!.startsWith('北极星'))!)
    const text = container.querySelector('.sky-facts')!.textContent
    expect(text).toContain('终年不落（拱极）')
    expect(text).toMatch(/黄 · 表面约 [\d,]+ K/)
  })

  it('picks a named star on the map, and lets go on the empty sky or Esc', () => {
    const { map, info, ringed } = setUp()
    const sirius = () => [...map.querySelectorAll('.sky-star')].find((g) => g.getAttribute('data-tip')!.startsWith('天狼星'))!

    fireEvent.click(sirius())
    expect(info()).toContain('天狼星')
    expect(ringed()).toBe(true)
    fireEvent.click(map)
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
  it('offers the paths in the chosen one’s details, as a switch', () => {
    localStorage.setItem('chroniq-sky-paths', 'off')
    const { map, row, container } = setUp()
    fireEvent.click(row('月亮'))
    expect(map.querySelectorAll('.sky-path')).toHaveLength(0)
    const paths = [...container.querySelectorAll('.sky-detail [role=switch]')].find((b) => b.textContent === '今日轨迹')!
    expect(paths.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(paths)
    expect(map.querySelector('.sky-path.on')).not.toBeNull()
    expect(paths.getAttribute('aria-checked')).toBe('true')
  })
})

describe('SkyView past track', () => {
  it('is switched on in a body’s details, and follows the body chosen', () => {
    const { map, row, container } = setUp()
    fireEvent.click(row('土星'))
    expect(map.querySelector('.sky-history')).toBeNull()
    const history = () => [...container.querySelectorAll('.sky-detail [role=switch]')].find((b) => b.textContent === '历史轨迹')!
    fireEvent.click(history())
    expect(history().getAttribute('aria-checked')).toBe('true')
    // The path in the Sun's colour (a DOM may keep it as written or as rgb())
    expect(map.querySelector('.sky-history')!.getAttribute('style')).toMatch(/#ead28f|rgb\(234, 210, 143\)/)
    // Three months by default, with a date mark every half month
    expect(map.querySelectorAll('.sky-history .tick').length).toBe(6)
    fireEvent.click([...container.querySelectorAll('.sky-detail .seg button')].find((b) => b.textContent === '1 年')!)
    expect(map.querySelectorAll('.sky-history .tick').length).toBe(12)
    // Another body chosen: its track; none chosen: none
    fireEvent.click(map.querySelector('.sky-jupiter')!)
    expect(map.querySelector('.sky-history')!.getAttribute('style')).toMatch(/#f4d7a8|rgb\(244, 215, 168\)/)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(map.querySelector('.sky-history')).toBeNull()
  })

  it('is not offered for a star, which keeps its place among the others', () => {
    const { map, container } = setUp()
    fireEvent.click([...map.querySelectorAll('.sky-star')].find((g) => g.getAttribute('data-tip')!.startsWith('天狼星'))!)
    expect([...container.querySelectorAll('.sky-detail [role=switch]')].map((b) => b.textContent)).toEqual(['今日轨迹'])
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

  it('zooms with the wheel by moving the map as drawn, and draws it anew once the wheel rests', async () => {
    const { map } = setUp()
    const zoomer = document.querySelector<HTMLElement>('.sky-zoomer')!
    const scale = () => Number(/scale\(([\d.]+)\)/.exec(map.querySelector('g')!.getAttribute('transform')!)![1])
    const full = scale()
    fireEvent.wheel(map, { deltaY: -100, clientX: 200, clientY: 200 })
    fireEvent.wheel(map, { deltaY: -100, clientX: 200, clientY: 200 })
    // On screen at once, by one transform; the map itself is not drawn again yet
    expect(zoomer.style.transform).toMatch(/scale\(1\.3\d*\)/)
    expect(scale()).toBe(full)
    expect(map.classList.contains('zoomed')).toBe(false)
    await act(() => new Promise((rest) => setTimeout(rest, 250)))
    // At rest: drawn at the new zoom, and the transform gone
    expect(scale()).toBeCloseTo(full * Math.exp(0.3))
    expect(zoomer.style.transform).toBe('')
    expect(map.classList.contains('zoomed')).toBe(true)
  })

  it('draws the map past the screen, and draws it anew mid-drag once a drag goes past that', async () => {
    // A window for the sky as on a screen (the test DOM lays nothing out), so that zoomed in it can be panned
    // (set on HTMLElement and taken off again after, as a spy on the method inherited from Element
    // may not be in every DOM)
    const box = { left: 0, top: 0, width: 700, height: 700, right: 700, bottom: 700, x: 0, y: 0, toJSON() {} }
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', { value: () => box, configurable: true, writable: true })
    try {
    const { map } = setUp()
    const zoomer = document.querySelector<HTMLElement>('.sky-zoomer')!
    // The layers reach past the screen: 15% of its larger side
    expect(zoomer.style.getPropertyValue('--over')).toBe(`${Math.round(1024 * 0.15)}px`)
    const drawn = () => map.querySelector('g')!.getAttribute('transform')
    fireEvent.wheel(map, { deltaY: -600, clientX: 200, clientY: 200 })
    await act(() => new Promise((rest) => setTimeout(rest, 250)))
    map.setPointerCapture = () => {}
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb))
    const flush = () => act(() => frames.splice(0).forEach((cb) => cb(0)))
    const before = drawn()
    fireEvent.pointerDown(map, { pointerId: 4, pointerType: 'mouse', button: 0, clientX: 300, clientY: 300 })
    // A short drag, within what is drawn: the drawn map is moved, not drawn again
    fireEvent.pointerMove(map, { pointerId: 4, pointerType: 'mouse', clientX: 400, clientY: 300 })
    flush()
    await act(() => new Promise((rest) => setTimeout(rest, 100)))
    expect(zoomer.style.transform).toMatch(/translate\(100px, 0px\)/)
    expect(drawn()).toBe(before)
    // On past it: drawn anew while the drag goes on, without waiting for it to rest
    fireEvent.pointerMove(map, { pointerId: 4, pointerType: 'mouse', clientX: 700, clientY: 300 })
    flush()
    await act(() => new Promise((rest) => setTimeout(rest, 100)))
    expect(drawn()).not.toBe(before)
    fireEvent.pointerUp(map, { pointerId: 4, pointerType: 'mouse', clientX: 700, clientY: 300 })
    } finally {
      delete (HTMLElement.prototype as { getBoundingClientRect?: unknown }).getBoundingClientRect
    }
  })
})

describe('SkyView hovered while one is chosen', () => {
  it('lights the hovered one up and keeps the path of the chosen one picked out beside its own', () => {
    const { map, row } = setUp()
    fireEvent.click(row('土星'))
    const lit = () => map.querySelectorAll('.sky-path.on').length
    expect(lit()).toBe(1)
    const neptune = map.querySelector('.sky-neptune')!
    fireEvent.pointerEnter(neptune, { pointerType: 'mouse' })
    expect(neptune.classList.contains('hover')).toBe(true)
    expect(map.querySelector('.sky-saturn')!.classList.contains('on')).toBe(true)
    // Saturn's path stays; Neptune's (not among the usual ones) is added and picked out too
    expect(lit()).toBe(2)
    fireEvent.pointerLeave(neptune, { pointerType: 'mouse' })
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
    // No layout in the test DOM: the map counts as 400 px square
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
    fireEvent.click(map)
    flush()
    flush()
    expect(info()).toContain('木星')
    expect(document.querySelector('.sky-drag-chip')).toBeNull()
  })
})
