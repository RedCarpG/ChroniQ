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

describe('古筝 notes', () => {
  /** The pitch of a stretch of samples, by autocorrelation with a parabola through the best lag */
  const pitch = (data: Float32Array, rate: number, near: number) => {
    const from = Math.floor(rate * 0.3)
    const len = Math.floor(rate * 0.25)
    const corr = (lag: number) => {
      let sum = 0
      for (let i = from; i < from + len; i++) sum += data[i] * data[i + lag]
      return sum
    }
    const guess = rate / near
    let best = 0
    let bestLag = 0
    for (let lag = Math.floor(guess * 0.85); lag <= Math.ceil(guess * 1.15); lag++) {
      const c = corr(lag)
      if (c > best) [best, bestLag] = [c, lag]
    }
    const [a, b, c] = [corr(bestLag - 1), best, corr(bestLag + 1)]
    return rate / (bestLag + (0.5 * (a - c)) / (a - 2 * b + c))
  }
  const cents = (f: number, ref: number) => 1200 * Math.log2(f / ref)

  it('plucks each of 宫商角徵羽 in tune, within a few cents', async () => {
    const { NOTES, pluck } = await import('../../sound')
    for (const [name, freq] of Object.entries(NOTES)) {
      const data = pluck(freq, 48000)
      expect(Math.abs(cents(pitch(data, 48000, freq), freq)), name).toBeLessThan(4)
    }
  })

  it('rings down: loud at the pluck, much quieter a second later', async () => {
    const { pluck } = await import('../../sound')
    const data = pluck(440, 48000)
    const rms = (from: number) => {
      let sum = 0
      for (let i = from; i < from + 4800; i++) sum += data[i] ** 2
      return Math.sqrt(sum / 4800)
    }
    expect(Math.max(...data.slice(0, 4800).map(Math.abs))).toBeCloseTo(1, 5)
    expect(rms(48000) / rms(0)).toBeLessThan(0.3)
  })

  it('a chosen 岁运 let go sounds 宫 an octave down; a new one its row’s note', () => {
    document.body.innerHTML = `
      <div class="fortune-row" data-sounds="shang">
        <button id="year-new" class="fortune">2026</button>
        <button id="year-chosen" class="fortune selected">2025</button>
      </div>`
    click('year-new')
    click('year-chosen')
    expect(heard).toEqual(['shang', 'gongLow'])
  })
})
