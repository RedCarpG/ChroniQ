import { SolarDay } from 'tyme4ts'
import { describe, expect, it } from 'vitest'
import { BRIGHT_STARS, STAR_FIELDS } from '../brightStars'
import { DIPPER, HANDLE_ANGLE, POLARIS, aroundPole, branchAngle, monthBuildOf } from '../dipper'

describe('北斗', () => {
  it('has the seven stars and the pole star where the star catalogue has them', () => {
    // Hipparcos numbers: 天枢 … 摇光, then 勾陈一 (Polaris)
    const hips = [54061, 53910, 58001, 59774, 62956, 65378, 67301, 11767]
    ;[...DIPPER, POLARIS].forEach((s, i) => {
      const at = BRIGHT_STARS.findIndex((v, j) => j % STAR_FIELDS === 0 && v === hips[i])
      expect(at, s.name).toBeGreaterThanOrEqual(0)
      expect(s.ra).toBeCloseTo(BRIGHT_STARS[at + 1], 1)
      expect(s.dec).toBeCloseTo(BRIGHT_STARS[at + 2], 1)
    })
  })

  it('places the 辰 round the pole facing north: 子 below, 卯 right, 午 up, 酉 left', () => {
    expect([0, 3, 6, 9].map(branchAngle)).toEqual([180, 90, 0, 270])
  })

  it('turns the handle to point at the month’s 辰', () => {
    const [x0, y0] = aroundPole(DIPPER[3])
    const [x1, y1] = aroundPole(DIPPER[6])
    for (let b = 0; b < 12; b++) {
      const turn = ((branchAngle(b) - HANDLE_ANGLE) * Math.PI) / 180
      // Turned clockwise on screen (y down), as CSS rotate() turns it
      const dx = (x1 - x0) * Math.cos(turn) - (y1 - y0) * Math.sin(turn)
      const dy = (x1 - x0) * Math.sin(turn) + (y1 - y0) * Math.cos(turn)
      const pointing = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
      expect(Math.abs(((pointing - branchAngle(b) + 540) % 360) - 180)).toBeLessThan(1e-9)
    }
  })
})

describe('monthBuildOf', () => {
  it('counts months from the 节, as the month pillar does', () => {
    const at = (y: number, m: number, d: number) => monthBuildOf(SolarDay.fromYmd(y, m, d))
    expect(at(2026, 2, 3).name).toBe('丑')
    expect(at(2026, 2, 4)).toMatchObject({ name: '寅', branch: 2, from: { name: '立春' }, to: { name: '惊蛰' } })
    expect(at(2026, 2, 4).from.day.toString()).toBe(SolarDay.fromYmd(2026, 2, 4).toString())
    expect(at(2026, 10, 25)).toMatchObject({ name: '戌', from: { name: '寒露' }, to: { name: '立冬' } })
    // A 中气 day still belongs to the month its 节 began
    expect(at(2026, 10, 23).name).toBe('戌')
    expect(at(2027, 1, 1)).toMatchObject({ name: '子', from: { name: '大雪' }, to: { name: '小寒' } })
  })
})
