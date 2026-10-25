// 月相: the Moon's phase on each day of the calendar, from tyme4ts, whose 朔望弦 instants are
// worked out in 北京时间 as the 农历 is (初一 is the day of the 朔). A day's phase is taken at
// its noon, between the 朔, 上弦, 望 and 下弦 either side; on the day of one of those it is
// that phase exactly, as the calendar names it.
import { Phase, SolarDay } from 'tyme4ts'

export interface MoonDay {
  /** The Moon's elongation from the Sun, 0–360°: 0 新月, 90 上弦, 180 满月, 270 下弦 */
  angle: number
  /** How much of the disc is lit, 0–1 */
  lit: number
  /** tyme4ts's name for the day's phase: 新月, 蛾眉月, 上弦月, 盈凸月, 满月, 亏凸月, 下弦月, 残月 */
  name: string
  /** On the day of a 朔, 上弦, 望 or 下弦: when it falls (北京时间), e.g. 23:50 */
  time?: string
}

/** tyme4ts's phase names, in order from 新月 */
const NAMES = Phase.NAMES

const moons = new Map<string, MoonDay>()

/** The Moon on a day. Worked out a month at a time (with the days a six-week grid shows either side) */
export function moonOf(solar: SolarDay): MoonDay {
  let moon = moons.get(solar.toString())
  if (!moon) {
    if (moons.size > 2000) moons.clear()
    const first = SolarDay.fromYmd(solar.getYear(), solar.getMonth(), 1)
    monthOfMoons(first.next(-7), 7 + 31 + 14)
    moon = moons.get(solar.toString())!
  }
  return moon
}

/** Noon (北京时间) of a day, as a Julian day */
const noonOf = (d: SolarDay) => d.getJulianDay().getDay() + 0.5

/** A 朔, 上弦, 望 or 下弦: which, when (as a Julian day), on what day, and at what time */
function quarterOf(p: Phase) {
  const t = p.getSolarTime()
  return {
    index: p.getIndex(),
    jd: t.getJulianDay().getDay(),
    day: t.getSolarDay().toString(),
    time: `${pad(t.getHour())}:${pad(t.getMinute())}`,
  }
}

function monthOfMoons(start: SolarDay, count: number) {
  // The 朔 / 上弦 / 望 / 下弦 (tyme4ts phases 0, 2, 4, 6) from the one before the first noon to the
  // one after the last: finding them is the costly part, so it is done a handful of times a month
  const firstNoon = noonOf(start)
  const lastNoon = firstNoon + count - 1
  let p = start.getPhase()
  if (p.getIndex() % 2) p = p.next(-1)
  let q = quarterOf(p)
  while (q.jd > firstNoon) q = quarterOf((p = p.next(-2)))
  const quarters = [q]
  while (q.jd <= lastNoon) quarters.push((q = quarterOf((p = p.next(2)))))
  let k = 0
  for (let i = 0, d = start; i < count; i++, d = d.next(1)) {
    const key = d.toString()
    const noon = firstNoon + i
    while (quarters[k + 1].jd <= noon) k++
    const [from, to] = [quarters[k], quarters[k + 1]]
    const exact = from.day === key ? from : to.day === key ? to : null
    if (exact) {
      const angle = exact.index * 45
      moons.set(key, { angle, lit: litOf(angle), name: NAMES[exact.index], time: exact.time })
    } else {
      const angle = (from.index * 45 + (90 * (noon - from.jd)) / (to.jd - from.jd)) % 360
      moons.set(key, { angle, lit: litOf(angle), name: NAMES[from.index + 1] })
    }
  }
}

const litOf = (angle: number) => (1 - Math.cos((angle * Math.PI) / 180)) / 2
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * The lit part of a disc of radius r centred on 0,0 as seen from the northern hemisphere (lit
 * on the right while waxing, on the left while waning): the limb's half circle, and back along
 * the terminator, a half ellipse. Empty at new moon.
 */
export function litPath(angle: number, r: number): string {
  const a = ((angle % 360) + 360) % 360
  if (a < 1 || a > 359) return ''
  const k = Math.cos((a * Math.PI) / 180)
  const waxing = a < 180
  const rx = (r * Math.abs(k)).toFixed(2)
  // The terminator bulges toward the lit side for a crescent, away from it for a gibbous moon
  const sweep = waxing === k > 0 ? 0 : 1
  return `M0 ${-r}A${r} ${r} 0 0 ${waxing ? 1 : 0} 0 ${r}A${rx} ${r} 0 0 ${sweep} 0 ${-r}Z`
}
