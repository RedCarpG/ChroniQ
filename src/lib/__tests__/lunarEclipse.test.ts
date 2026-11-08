import { describe, expect, it } from 'vitest'
import { lunarEclipseAt, moonView } from '../moonView'

const BEIJING = [39.9, 116.4] as const

describe('lunar eclipses in 观月', () => {
  it('puts the whole Moon inside the umbra at the total eclipse of 3 March 2026', () => {
    const { shadow } = moonView(new Date('2026-03-03T11:33:00Z'), ...BEIJING).frame
    const off = Math.hypot(shadow.x, shadow.y)
    // The umbra is about 2.7 Moon radii across at the Moon, the penumbra about 4.7
    expect(shadow.umbra).toBeGreaterThan(2.3)
    expect(shadow.umbra).toBeLessThan(3)
    expect(shadow.penumbra).toBeGreaterThan(4.2)
    expect(off + 1).toBeLessThan(shadow.umbra)
  })

  it('keeps the shadow off the disc at an ordinary full Moon', () => {
    // 24 November 2026: full, but the Moon passes well north or south of the shadow
    const { shadow } = moonView(new Date('2026-11-24T14:54:00Z'), ...BEIJING).frame
    expect(Math.hypot(shadow.x, shadow.y)).toBeGreaterThan(shadow.penumbra + 1)
  })

  it('finds the eclipse a moment falls in, and the next one', () => {
    const during = lunarEclipseAt(new Date('2026-03-03T11:33:00Z'))
    expect(during.now).toBe(true)
    expect(during.eclipse.kind).toBe('total')
    expect(during.eclipse.total).not.toBeNull()
    const after = lunarEclipseAt(new Date('2026-03-10T00:00:00Z'))
    expect(after.now).toBe(false)
    expect(after.eclipse.peak.getTime()).toBeGreaterThan(new Date('2026-03-10T00:00:00Z').getTime())
  })
})
