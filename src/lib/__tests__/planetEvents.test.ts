import { describe, expect, it } from 'vitest'
import { planetEvents } from '../solarSystem'

const year = planetEvents(new Date('2026-01-01T00:00:00Z'), new Date('2027-01-01T00:00:00Z'))
const find = (key: string, kind: string) => year.filter((e) => e.key === key && e.kind === kind).map((e) => e.time.toISOString().slice(0, 10))

describe('the planets’ moments with the Sun in 2026', () => {
  it('finds the oppositions of the outer planets', () => {
    expect(find('jupiter', 'opposition')).toEqual([expect.stringMatching(/^2026-01-1[01]/)])
    expect(find('saturn', 'opposition')).toEqual([expect.stringMatching(/^2026-10-0[3-5]/)])
    // Mars is not opposite the Sun in 2026 (its last was January 2025, its next February 2027)
    expect(find('mars', 'opposition')).toEqual([])
  })

  it('finds Venus between us and the Sun in late October, and Mercury’s elongations', () => {
    expect(find('venus', 'inferior')).toEqual([expect.stringMatching(/^2026-10-2[34]/)])
    expect(find('mercury', 'east').length).toBe(3)
    expect(find('mercury', 'west').length).toBe(3)
  })

  it('keeps them in time order', () => {
    const times = year.map((e) => e.time.getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })
})
