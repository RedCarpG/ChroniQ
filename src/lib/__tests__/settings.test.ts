// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { loadSettings } from '../settings'

describe('天书 as the default style', () => {
  beforeEach(() => localStorage.clear())

  it('is the default for someone new', () => {
    expect(loadSettings().uiStyle).toBe('tianshu')
  })

  it('moves settings saved before it (经典 by default then) to 天书, once', () => {
    localStorage.setItem('chroniq-settings', JSON.stringify({ uiStyle: 'classic', language: 'en' }))
    const moved = loadSettings()
    expect(moved.uiStyle).toBe('tianshu')
    expect(moved.language).toBe('en')
  })

  it('keeps 经典 chosen after that', () => {
    loadSettings()
    localStorage.setItem('chroniq-settings', JSON.stringify({ uiStyle: 'classic' }))
    expect(loadSettings().uiStyle).toBe('classic')
  })
})
