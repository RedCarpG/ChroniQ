// @vitest-environment happy-dom
import './dom'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BirthForm } from '../BirthForm'
import { StarChartView } from '../StarChartView'
import { DEFAULT_STAR_SETTINGS } from '../../lib/starPrefs'
import { DEFAULT_PLACE } from '../../lib/place'
import { DEFAULT_SETTINGS } from '../../lib/settings'
import { SettingsContext } from '../../settingsContext'

const input = { year: 1990, month: 5, day: 15, hour: 10, minute: 30, gender: 1 as const }

describe('birth input boundaries', () => {
  it('keeps the valid model when a time control is cleared, and accepts midnight', () => {
    const change = vi.fn()
    const view = render(<BirthForm input={input} onChange={change} schoolsPanel={null} />)
    const time = view.container.querySelector('input[type=time]')!
    fireEvent.change(time, { target: { value: '' } })
    expect(change).not.toHaveBeenCalled()
    fireEvent.change(time, { target: { value: '00:00' } })
    expect(change).toHaveBeenLastCalledWith({ ...input, hour: 0, minute: 0 })
  })

  it('rejects a DST gap with an explanation', () => {
    const change = vi.fn()
    const ny = { ...DEFAULT_PLACE, timeZone: 'America/New_York' }
    const view = render(<BirthForm input={{ ...input, year: 2024, month: 3, day: 10, hour: 1, place: ny }} onChange={change} schoolsPanel={null} />)
    fireEvent.change(view.container.querySelector('input[type=time]')!, { target: { value: '02:30' } })
    expect(change).not.toHaveBeenCalled()
    expect(view.getByRole('alert').textContent).toContain('不存在')
  })

  it('explains the choice for repeated local times', () => {
    const view = render(<BirthForm input={{ ...input, year: 2024, month: 11, day: 3, hour: 1, place: { ...DEFAULT_PLACE, timeZone: 'America/New_York' } }} onChange={() => {}} schoolsPanel={null} />)
    expect(view.getByRole('status').textContent).toContain('较早')
  })
})

describe('partner storage', () => {
  it.each([
    { ...DEFAULT_PLACE, timeZone: 'Not/AZone' },
    { ...DEFAULT_PLACE, latitude: 100 },
  ])('ignores invalid partner places and keeps synastry usable', (place) => {
    localStorage.setItem('chroniq-star-partner', JSON.stringify({ name: 'bad', wall: input, place }))
    const view = render(<SettingsContext.Provider value={{ ...DEFAULT_SETTINGS, birthSky: 'hide' }}><StarChartView input={input} onChange={() => {}} settings={DEFAULT_STAR_SETTINGS} onSettingsChange={() => {}} /></SettingsContext.Provider>)
    fireEvent.click(view.getByRole('button', { name: /^合盘$/ }))
    expect(view.container.querySelector('.partner-form')).not.toBeNull()
    const time = view.container.querySelector('.partner-form input[type=time]')!
    fireEvent.change(time, { target: { value: '' } })
    expect(localStorage.getItem('chroniq-star-partner')).toContain('bad') // no invalid write
  })
})
