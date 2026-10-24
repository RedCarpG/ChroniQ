// Little interface sounds, made on the spot with the Web Audio API: no files to fetch, and
// nothing running between sounds. A soft tap for buttons, a rising or falling pair for switches,
// a paper flick for paging the calendar, a whoosh and a bell for changing page, a chime for
// choosing a star or body (lower for letting go), a sparkle for a constellation, clockwork ticks
// while the sky is turned through time, and a sweep for zooming. Off in the settings (音效).

export type Sound = 'tap' | 'on' | 'off' | 'flip' | 'page' | 'pick' | 'unpick' | 'sparkle' | 'tick' | 'zoomIn' | 'zoomOut'

let enabled = true
let context: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null

export function setSoundEnabled(on: boolean) {
  enabled = on
}

/** The audio context, made at the first sound (browsers allow it only after a click or key) */
function audio() {
  if (!context) {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Context) return null
    context = new Context()
    master = context.createGain()
    master.gain.value = 0.5
    const limit = context.createDynamicsCompressor()
    master.connect(limit)
    limit.connect(context.destination)
  }
  if (context.state === 'suspended') void context.resume()
  return context
}

/** A note: a quick rise, then an exponential fall (and a glide to `to`, if given) */
function tone(c: AudioContext, n: { freq: number; to?: number; type?: OscillatorType; at?: number; decay: number; gain: number }) {
  const start = c.currentTime + (n.at ?? 0)
  const osc = c.createOscillator()
  osc.type = n.type ?? 'sine'
  osc.frequency.setValueAtTime(n.freq, start)
  if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, start + n.decay)
  const env = c.createGain()
  env.gain.setValueAtTime(0.0001, start)
  env.gain.exponentialRampToValueAtTime(n.gain, start + 0.005)
  env.gain.exponentialRampToValueAtTime(0.0001, start + 0.005 + n.decay)
  osc.connect(env)
  env.connect(master!)
  osc.start(start)
  osc.stop(start + n.decay + 0.06)
}

/** A breath of filtered noise, its band sweeping from `from` to `to` (Hz) */
function hiss(c: AudioContext, n: { from: number; to: number; dur: number; gain: number; q?: number; at?: number }) {
  if (!noise) {
    noise = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  const start = c.currentTime + (n.at ?? 0)
  const src = c.createBufferSource()
  src.buffer = noise
  const band = c.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.value = n.q ?? 0.8
  band.frequency.setValueAtTime(n.from, start)
  band.frequency.exponentialRampToValueAtTime(n.to, start + n.dur)
  const env = c.createGain()
  env.gain.setValueAtTime(0.0001, start)
  env.gain.exponentialRampToValueAtTime(n.gain, start + n.dur * 0.3)
  env.gain.exponentialRampToValueAtTime(0.0001, start + n.dur)
  src.connect(band)
  band.connect(env)
  env.connect(master!)
  src.start(start)
  src.stop(start + n.dur + 0.05)
}

/** A small bell: a tone with two fainter, faster-fading overtones */
function bell(c: AudioContext, freq: number, at: number, gain: number, decay: number) {
  tone(c, { freq, at, gain, decay })
  tone(c, { freq: freq * 2.01, at, gain: gain * 0.4, decay: decay * 0.6 })
  tone(c, { freq: freq * 3.98, at, gain: gain * 0.15, decay: decay * 0.35 })
}

export function play(sound: Sound) {
  if (!enabled) return
  const c = audio()
  if (!c) return
  switch (sound) {
    case 'tap':
      return tone(c, { freq: 1250, to: 900, type: 'triangle', decay: 0.06, gain: 0.05 })
    case 'on':
      tone(c, { freq: 660, decay: 0.07, gain: 0.06 })
      return tone(c, { freq: 990, at: 0.06, decay: 0.1, gain: 0.06 })
    case 'off':
      tone(c, { freq: 990, decay: 0.07, gain: 0.05 })
      return tone(c, { freq: 660, at: 0.06, decay: 0.1, gain: 0.05 })
    case 'flip':
      return hiss(c, { from: 2400, to: 5200, dur: 0.1, gain: 0.08, q: 0.6 })
    case 'page':
      hiss(c, { from: 450, to: 2200, dur: 0.3, gain: 0.05 })
      return bell(c, 1568, 0.12, 0.025, 0.6)
    case 'pick':
      return bell(c, 1046.5, 0, 0.07, 1.1)
    case 'unpick':
      return bell(c, 784, 0, 0.04, 0.45)
    case 'sparkle':
      return [1318.5, 1568, 1975.5, 2637].forEach((f, i) => bell(c, f, i * 0.07, 0.035, 0.7))
    case 'tick':
      return tone(c, { freq: 2400, type: 'square', decay: 0.012, gain: 0.012 })
    case 'zoomIn':
      return tone(c, { freq: 420, to: 760, decay: 0.16, gain: 0.05 })
    case 'zoomOut':
      return tone(c, { freq: 760, to: 420, decay: 0.16, gain: 0.05 })
  }
}

const CLICKABLE = 'button, [role="button"], [role="menuitemradio"], select, summary, a[href]'

/**
 * One listener for the page, so components need not play sounds themselves: a click plays the
 * sound named by data-sound on the thing clicked, or by data-sounds on a group round the button
 * clicked ("none" for silence); else a switch (class toggle, with aria-pressed) sounds on or off,
 * and anything else clickable taps. It listens before anything else (capture), so a switch's state
 * is still the one being left.
 */
export function startClickSounds(sound: (s: Sound) => void = play) {
  const onClick = (e: MouseEvent) => {
    if (!enabled || !(e.target instanceof Element)) return
    const el = e.target.closest(`[data-sound], ${CLICKABLE}`)
    if (!el || (el as HTMLButtonElement).disabled) return
    const named = el.getAttribute('data-sound') ?? el.parentElement?.closest('[data-sounds]')?.getAttribute('data-sounds')
    if (named === 'none') return
    if (named) return sound(named as Sound)
    const pressed = el.getAttribute('aria-pressed')
    if (el.classList.contains('toggle') && pressed !== null) return sound(pressed === 'true' ? 'off' : 'on')
    sound('tap')
  }
  document.addEventListener('click', onClick, true)
  return () => document.removeEventListener('click', onClick, true)
}
