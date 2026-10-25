// @vitest-environment jsdom
import './dom'
import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLACE } from '../../lib/place'
import { MoonPage } from '../MoonPage'

// jsdom has no WebGL: the Moon is drawn flat
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.useFakeTimers({ toFake: ['Date'] })
  // The full Moon of 3 March 2026, 19:38 in 北京
  vi.setSystemTime(new Date('2026-03-03T11:38:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const setUp = () => {
  const { container } = render(<MoonPage fallbackPlace={DEFAULT_PLACE} />)
  const fact = (name: string) => {
    const dts = [...container.querySelectorAll('.moon-facts dt')]
    return dts.find((d) => d.textContent === name)?.nextElementSibling?.textContent
  }
  const time = () => container.querySelector<HTMLInputElement>('.moon-page input[type=time]')!.value
  return { container, fact, time }
}

describe('观月', () => {
  it('shows the Moon of the moment: its phase, 农历 day, age and times', () => {
    const { container, fact } = setUp()
    expect(container.querySelector('.moon-name')!.textContent).toBe('满月正月十五')
    expect(fact('月龄')).toBe('14.0 天')
    expect(fact('照亮')).toBe('100%')
    expect(fact('月出')).toMatch(/^1[78]:\d\d$/)
    expect(fact('宿')).toMatch(/^月离.宿$/)
    // Flat, without WebGL: the lit part turned towards the Sun
    expect(container.querySelector('.moon-globe svg .moon-globe-lit')).not.toBeNull()
  })

  it('moves the time along the heights with the arrow keys', () => {
    const { container, time } = setUp()
    const slider = container.querySelector<SVGElement>('.moon-heights svg')!
    expect(time()).toBe('19:38')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(time()).toBe('19:53')
    fireEvent.keyDown(slider, { key: 'ArrowLeft', shiftKey: true })
    expect(time()).toBe('18:53')
  })

  it('lists the lunation’s quarters and goes to a day of it', () => {
    const { container, fact } = setUp()
    expect([...container.querySelectorAll('.moon-quarters b')].map((b) => b.textContent)).toEqual(['朔', '上弦', '望', '下弦', '朔'])
    const days = [...container.querySelectorAll<HTMLButtonElement>('.moon-day')]
    expect(days.find((d) => d.classList.contains('on'))!.textContent).toContain('3/3')
    fireEvent.click(days.find((d) => d.textContent!.includes('3/10'))!)
    expect(container.querySelector('.moon-name')!.textContent).toMatch(/正月廿二$/)
    expect(Number(fact('月龄')!.split(' ')[0])).toBeCloseTo(21, 0)
  })
})
