// @vitest-environment happy-dom
import './dom'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SCHOOLS } from '../../lib/schools'
import { DEFAULT_SETTINGS, type Settings } from '../../lib/settings'
import { DEFAULT_ZIWEI_SCHOOLS } from '../../lib/ziweiSchools'
import { SettingsContext } from '../../settingsContext'
import { TimelinePage } from '../TimelinePage'

const input = { year: 1997, month: 11, day: 2, hour: 10, minute: 30, gender: 1 } as const

function setUp(settings: Partial<Settings> = {}) {
  return render(
    <SettingsContext.Provider value={{ ...DEFAULT_SETTINGS, ...settings }}>
      <TimelinePage input={input} schools={DEFAULT_SCHOOLS} ziweiSchools={DEFAULT_ZIWEI_SCHOOLS} onOpen={() => {}} />
    </SettingsContext.Provider>,
  )
}

describe('TimelinePage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 5, 1))
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('in 天书\'s 简洁 is the scene, with this year\'s 大运 and 大限 lit and no board', () => {
    const { container } = setUp()
    expect(container.querySelector('.tl-scene')).not.toBeNull()
    expect(container.querySelector('.tl-board')).toBeNull()
    expect(container.querySelector('.bz-verse b')!.textContent).toBe('丁未大运')
    expect(container.querySelector('.tl-s-yun .on text')!.textContent).toBe('丁未')
    expect(container.querySelector('.tl-s-xian .on text')!.textContent).toBe('夫妻')
    // what comes next: the Saturn return, then the next 大限, then the next 大运
    expect([...container.querySelectorAll('.tl-soon span')].map((s) => s.textContent)).toEqual([
      '将至',
      '2027　土星回归',
      '2028　入子女限',
      '2036　交丙午运',
    ])
  })

  it('switches to 详细, the board and its tables, without the scene', () => {
    const { container, getByText } = setUp()
    fireEvent.click(getByText('详细'))
    expect(container.querySelector('.tl-scene')).toBeNull()
    expect(container.querySelector('.tl-board')).not.toBeNull()
    expect(container.querySelector('.tl-year-card')).not.toBeNull()
  })

  it('in 经典 is the board, as before, without the switch', () => {
    const { container } = setUp({ uiStyle: 'classic' })
    expect(container.querySelector('.tl-scene')).toBeNull()
    expect(container.querySelector('.tl-board')).not.toBeNull()
    expect(container.querySelector('.chart-view')).toBeNull()
  })
})
