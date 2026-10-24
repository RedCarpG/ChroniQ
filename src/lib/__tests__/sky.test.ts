import { describe, expect, it } from 'vitest'
import { WESTERN } from '../constellations'
import { constellationsAt, formatAzimuth, galacticToEquatorial, historyTrack, milkyWayAt, skyAt, tracksAt } from '../sky'
import { XINGGUAN } from '../xingguan'

const BEIJING = [39.9, 116.4] as const

describe('skyAt', () => {
  it('puts Polaris at about the latitude, due north', () => {
    const sky = skyAt(new Date('2026-01-15T14:00:00Z'), ...BEIJING)
    const polaris = sky.stars.find((s) => s.name === '北极星')!
    expect(polaris.alt).toBeGreaterThan(BEIJING[0] - 1.5)
    expect(polaris.alt).toBeLessThan(BEIJING[0] + 1.5)
    expect(Math.min(polaris.az, 360 - polaris.az)).toBeLessThan(2)
  })

  it('has the midsummer noon Sun high in the south', () => {
    // Solar noon in Beijing is about 04:14 UT
    const sky = skyAt(new Date('2024-06-21T04:14:00Z'), ...BEIJING)
    const sun = sky.bodies.find((b) => b.key === 'sun')!
    expect(sun.alt).toBeCloseTo(90 - BEIJING[0] + 23.44, 0)
    expect(Math.abs(sun.az - 180)).toBeLessThan(3)
    expect(sky.light).toBe('day')
  })

  it('keeps only stars above the horizon, and night is dark', () => {
    const sky = skyAt(new Date('2026-01-15T14:00:00Z'), ...BEIJING) // 22:00 local
    expect(sky.light).toBe('night')
    expect(sky.stars.length).toBeGreaterThan(500)
    expect(sky.stars.every((s) => s.alt >= 0)).toBe(true)
    // Sirius is up in the south-east on a winter evening
    const sirius = sky.stars.find((s) => s.name === '天狼星')!
    expect(sirius.alt).toBeGreaterThan(15)
    expect(sirius.az).toBeGreaterThan(130)
    expect(sirius.az).toBeLessThan(200)
  })

  it('gives the Moon its phase', () => {
    // Full moon 2026-03-03 11:38 UT
    const moon = skyAt(new Date('2026-03-03T12:00:00Z'), ...BEIJING).bodies.find((b) => b.key === 'moon')!
    expect(moon.lit).toBeGreaterThan(0.98)
  })
})

describe('tracksAt', () => {
  const hours = (from: string, n: number) =>
    Array.from({ length: n }, (_, i) => new Date(new Date(from).getTime() + i * 3600_000))

  it('gives every path body a position for every moment', () => {
    const times = hours('2026-01-15T00:00:00Z', 24)
    const tracks = tracksAt(times, ...BEIJING)
    expect(Object.keys(tracks).sort()).toEqual(['jupiter', 'mars', 'mercury', 'moon', 'saturn', 'sun', 'venus'])
    expect(Object.values(tracks).every((track) => track.length === 24)).toBe(true)
  })

  it('has the Sun rise, peak due south around solar noon, and set over a day', () => {
    // 2024-06-20 16:00 UT is local midnight in Beijing; solar noon is about 04:14 UT
    const times = hours('2024-06-20T16:00:00Z', 24)
    const sun = tracksAt(times, ...BEIJING).sun
    const top = sun.reduce((best, p, i) => (p.alt > sun[best].alt ? i : best), 0)
    expect(times[top].getUTCHours()).toBe(4)
    expect(Math.abs(sun[top].az - 180)).toBeLessThan(20)
    expect(sun.some((p) => p.alt < 0)).toBe(true)
    // above the horizon for about 15 hours at midsummer
    expect(sun.filter((p) => p.alt > 0).length).toBeGreaterThanOrEqual(14)
  })
})

describe('the sky below the horizon', () => {
  const winterEvening = new Date('2026-01-15T14:00:00Z') // 22:00 in Beijing

  it('lists only stars under the horizon, among them Canopus, which never rises in Beijing', () => {
    const below = skyAt(winterEvening, ...BEIJING, true)
    expect(below.stars.every((s) => s.alt < 0)).toBe(true)
    expect(below.stars.some((s) => s.name === '老人星')).toBe(true)
    expect(below.stars.some((s) => s.name === '北极星')).toBe(false)
    // above and below together are the whole catalogue
    expect(below.stars.length + skyAt(winterEvening, ...BEIJING).stars.length).toBe(1627)
  })

  it('keeps the figures under the horizon, e.g. Scorpius on a winter evening', () => {
    const below = constellationsAt(WESTERN, winterEvening, ...BEIJING, true)
    expect(below.find((c) => c.name === '天蝎座')).toBeDefined()
    expect(below.find((c) => c.name === '小熊座')).toBeUndefined() // circumpolar: always up in Beijing
  })
})

describe('constellationsAt', () => {
  const winterEvening = new Date('2026-01-15T14:00:00Z') // 22:00 in Beijing

  it('has the 88 Western constellations and the 星官 with the 28 宿', () => {
    expect(new Set(WESTERN.map((c) => c.name)).size).toBe(88)
    expect(XINGGUAN.length).toBeGreaterThan(300)
    expect(XINGGUAN.filter((c) => c.rank === 1).map((c) => c.name)).toHaveLength(28)
    expect(XINGGUAN.find((c) => c.name === '参宿')!.rank).toBe(1)
  })

  it('puts Orion and 参宿 up on a winter evening, and leaves out what is below the horizon', () => {
    const west = constellationsAt(WESTERN, winterEvening, ...BEIJING)
    expect(west.find((c) => c.name === '猎户座')!.label.alt).toBeGreaterThan(20)
    expect(west.find((c) => c.name === '天蝎座')).toBeUndefined() // a summer constellation, under the horizon
    const cn = constellationsAt(XINGGUAN, winterEvening, ...BEIJING)
    expect(cn.find((c) => c.name === '参宿')!.label.alt).toBeGreaterThan(20)
    expect(west.every((c) => c.lines.some((l) => l.some((p) => p.alt > 0)))).toBe(true)
  })
})

describe('historyTrack', () => {
  const unit = ({ az, alt }: { az: number; alt: number }) => {
    const [a, h] = [(az * Math.PI) / 180, (alt * Math.PI) / 180]
    return [Math.cos(h) * Math.sin(a), Math.cos(h) * Math.cos(a), Math.sin(h)]
  }
  const dot = (u: number[], v: number[]) => u.reduce((s, x, i) => s + x * v[i], 0)

  it('ends at the body where it is now', () => {
    const at = new Date('2026-01-15T14:00:00Z')
    const track = historyTrack('jupiter', at, ...BEIJING, 30)
    const now = skyAt(at, ...BEIJING).bodies.find((b) => b.key === 'jupiter')!
    expect(track.at(-1)!.utc.getTime()).toBe(at.getTime())
    expect(Math.acos(Math.min(1, dot(unit(track.at(-1)!), unit(now)))) * (180 / Math.PI)).toBeLessThan(0.5)
  })

  it("shows Mars turning back during its retrograde (Dec 2024 – Feb 2025)", () => {
    const track = historyTrack('mars', new Date('2025-02-20T14:00:00Z'), ...BEIJING, 120, 120)
    const step = (i: number) => unit(track[i + 1]).map((x, k) => x - unit(track[i])[k])
    // Early on it moves one way; later it moves back the other way
    const first = step(0)
    expect(Math.min(...track.slice(0, -1).map((_, i) => dot(first, step(i))))).toBeLessThan(0)
  })
})

describe('formatAzimuth', () => {
  it('names the nearest of eight directions', () => {
    expect(formatAzimuth(0)).toBe('北 0°')
    expect(formatAzimuth(134)).toBe('东南 134°')
    expect(formatAzimuth(359)).toBe('北 359°')
  })
})

describe('the Milky Way', () => {
  it('finds the galactic centre in Sagittarius and the pole in Coma Berenices', () => {
    const [ra, dec] = galacticToEquatorial(0, 0)
    expect(ra).toBeCloseTo(266.4, 0)
    expect(dec).toBeCloseTo(-28.9, 0)
    const [pra, pdec] = galacticToEquatorial(0, 90)
    expect(pra).toBeCloseTo(192.86, 1)
    expect(pdec).toBeCloseTo(27.13, 1)
  })

  it('runs the band all round the sky, brightest towards the centre', () => {
    const { band, rift } = milkyWayAt(new Date('2026-08-15T14:00:00Z'), ...BEIJING)
    expect(band).toHaveLength(73)
    expect(band[0].bright).toBe(1)
    expect(band[36].bright).toBeLessThan(0.4) // the anticentre, l = 180°
    expect(rift.length).toBeGreaterThan(10)
  })
})
