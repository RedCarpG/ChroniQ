// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setSoundEnabled, startClickSounds, type Sound } from '../../sound'

let heard: Sound[]
let stop: () => void
beforeEach(() => {
  heard = []
  setSoundEnabled(true)
  stop = startClickSounds((s) => heard.push(s))
  document.body.innerHTML = `
    <button id="plain">OK</button>
    <button id="off-switch" class="ghost toggle" aria-pressed="false">轨迹</button>
    <button id="on-switch" class="ghost toggle" aria-pressed="true">轨迹</button>
    <div class="seg"><button id="seg" aria-pressed="false">头顶</button></div>
    <div class="cal-nav" data-sounds="flip"><button id="next">›</button></div>
    <svg><g id="star" role="button" data-sound="pick"><circle id="dot" r="2" /></g><circle id="sky" r="9" /></svg>
    <button id="quiet" data-sound="none">x</button>
    <button id="disabled" disabled>+</button>
    <p id="text">words</p>`
})
afterEach(() => stop())

const click = (id: string) => document.getElementById(id)!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

describe('click sounds', () => {
  it('taps for a button, and turns a switch on or off by the state it leaves', () => {
    click('plain')
    click('off-switch')
    click('on-switch')
    // A segmented choice is not a switch: it taps
    click('seg')
    expect(heard).toEqual(['tap', 'on', 'off', 'tap'])
  })

  it('plays what an element or its group names, and nothing where asked or where there is nothing to click', () => {
    click('next')
    click('dot')
    click('sky')
    click('quiet')
    click('disabled')
    click('text')
    expect(heard).toEqual(['flip', 'pick'])
  })

  it('is silent when the sounds are off', () => {
    setSoundEnabled(false)
    click('plain')
    expect(heard).toEqual([])
  })

  it('does nothing in a browser without Web Audio', async () => {
    const { play } = await import('../../sound')
    vi.stubGlobal('AudioContext', undefined)
    expect(() => play('pick')).not.toThrow()
    vi.unstubAllGlobals()
  })
})
