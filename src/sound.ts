// Little interface sounds, made on the spot with the Web Audio API: no files to fetch, and
// nothing running between sounds. A soft tap for buttons, a rising or falling pair for switches,
// a paper flick for paging the calendar, a whoosh and a bell for changing page, a chime for
// choosing a star or body (lower for letting go), a sparkle for a constellation, clockwork ticks
// while the sky is turned through time, and a sweep for zooming. What belongs to Chinese culture
// (the 岁运 and 运限, the 星官 and 二十八宿, the days of the 农历) sounds a single note of the
// pentatonic 宫商角徵羽 on a plucked 古筝 string instead. Off in the settings (音效).

/** 宫商角徵羽 in D, the 古筝's usual tuning (D E F♯ A B), and 宫 an octave down for letting go */
export const NOTES = { gong: 293.66, shang: 329.63, jue: 369.99, zhi: 440, yu: 493.88, gongLow: 146.83 } as const
export type Note = keyof typeof NOTES

export type Sound = 'tap' | 'on' | 'off' | 'flip' | 'page' | 'pick' | 'unpick' | 'sparkle' | 'tick' | 'zoomIn' | 'zoomOut' | Note

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

/**
 * A plucked string by Karplus–Strong: a burst of noise, as the nail leaves the string, runs round a
 * delay one period long and is smoothed a little on each pass, so the high partials die first and
 * the note rings down to its fundamental. The burst is shaped as for a pluck near the bridge
 * (bright, with a notch at the seventh partial) and the loss is set so the note fades by 60 dB in
 * `ring` seconds. Returns samples peaking at 1.
 */
export function pluck(freq: number, sampleRate: number, seconds = 2.2, ring = 1.8, seed = 7): Float32Array {
  const n = Math.floor(sampleRate * seconds)
  const out = new Float32Array(n)
  // The averaging filter adds half a sample of delay; a fractional rest is read by interpolation
  const delay = sampleRate / freq - 0.5
  const loss = Math.pow(10, -3 / (ring * freq))
  // Seeded noise, so every pluck of a note is the same
  let x = seed
  const rand = () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1
  const burst = Math.ceil(delay)
  const excite = new Float32Array(burst + 1)
  let lp = 0
  for (let i = 0; i < burst; i++) {
    lp += 0.65 * (rand() - lp)
    excite[i] = lp
  }
  // Plucking position: a seventh of the way along
  const at = Math.round(burst / 7)
  for (let i = burst - 1; i >= at; i--) excite[i] -= excite[i - at]
  const read = (pos: number) => {
    if (pos < 1) return 0
    const i = Math.floor(pos)
    const f = pos - i
    return out[i] * (1 - f) + out[i + 1 < n ? i + 1 : i] * f
  }
  let peak = 0
  for (let i = 0; i < n; i++) {
    const back = i - delay
    out[i] = (i < burst ? excite[i] : 0) + loss * 0.5 * (read(back) + read(back - 1))
    peak = Math.max(peak, Math.abs(out[i]))
  }
  // Fade the last tenth of a second, then scale to a peak of 1
  const fade = Math.floor(sampleRate * 0.1)
  for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade
  for (let i = 0; i < n; i++) out[i] /= peak || 1
  return out
}

const plucks = new Map<number, AudioBuffer>()
const ringing: AudioBufferSourceNode[] = []

/**
 * A 古筝 note: the plucked string through a little body resonance, and after a moment a slow,
 * slight waver of pitch, as the left hand presses the string behind the bridge (揉弦).
 */
function zheng(c: AudioContext, freq: number, gain: number) {
  let buffer = plucks.get(freq)
  if (!buffer) {
    const data = pluck(freq, c.sampleRate, freq < 200 ? 2.8 : 2.2, freq < 200 ? 2.4 : 1.8)
    buffer = c.createBuffer(1, data.length, c.sampleRate)
    buffer.getChannelData(0).set(data)
    plucks.set(freq, buffer)
  }
  const start = c.currentTime
  const src = c.createBufferSource()
  src.buffer = buffer
  // 揉弦: from a quarter of a second, a waver of about ±7 cents, five times a second
  const lfo = c.createOscillator()
  lfo.frequency.value = 5
  const depth = c.createGain()
  depth.gain.setValueAtTime(0, start)
  depth.gain.linearRampToValueAtTime(0, start + 0.25)
  depth.gain.linearRampToValueAtTime(0.004, start + 0.7)
  lfo.connect(depth)
  depth.connect(src.playbackRate)
  // The soundbox: a little warmth low down, the top softened
  const body = c.createBiquadFilter()
  body.type = 'peaking'
  body.frequency.value = 260
  body.Q.value = 1.2
  body.gain.value = 4
  const top = c.createBiquadFilter()
  top.type = 'lowpass'
  top.frequency.value = 5200
  const env = c.createGain()
  env.gain.value = gain
  src.connect(body)
  body.connect(top)
  top.connect(env)
  env.connect(master!)
  src.start(start)
  lfo.start(start)
  lfo.stop(start + buffer.duration)
  // Quick plucks on many things should not pile up: let the oldest ringing notes go
  ringing.push(src)
  src.onended = () => {
    const i = ringing.indexOf(src)
    if (i >= 0) ringing.splice(i, 1)
  }
  while (ringing.length > 4) {
    const old = ringing.shift()!
    old.onended = null
    old.stop(c.currentTime + 0.05)
  }
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
    default:
      return zheng(c, NOTES[sound], sound === 'gongLow' ? 0.14 : 0.11)
  }
}

const CLICKABLE = 'button, [role="button"], [role="menuitemradio"], select, summary, a[href]'

/**
 * One listener for the page, so components need not play sounds themselves: a click plays the
 * sound named by data-sound on the thing clicked, or by data-sounds on a group round the button
 * clicked ("none" for silence); else a switch (class toggle, with aria-pressed) sounds on or off,
 * and anything else clickable taps. In a group that names a note (a row of 岁运 or 运限), clicking
 * the one already chosen lets it go, so it sounds 宫 an octave down instead. It listens before
 * anything else (capture), so a switch's or a choice's state is still the one being left.
 */
export function startClickSounds(sound: (s: Sound) => void = play) {
  const onClick = (e: MouseEvent) => {
    if (!enabled || !(e.target instanceof Element)) return
    const el = e.target.closest(`[data-sound], ${CLICKABLE}`)
    if (!el || (el as HTMLButtonElement).disabled) return
    const own = el.getAttribute('data-sound')
    const named = own ?? el.parentElement?.closest('[data-sounds]')?.getAttribute('data-sounds')
    if (named === 'none') return
    if (named && !own && named in NOTES && el.classList.contains('selected')) return sound('gongLow')
    if (named) return sound(named as Sound)
    const pressed = el.getAttribute('aria-pressed')
    if (el.classList.contains('toggle') && pressed !== null) return sound(pressed === 'true' ? 'off' : 'on')
    sound('tap')
  }
  document.addEventListener('click', onClick, true)
  return () => document.removeEventListener('click', onClick, true)
}
