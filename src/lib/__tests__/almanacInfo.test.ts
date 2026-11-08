import { SolarDay } from 'tyme4ts'
import { describe, expect, it } from 'vitest'
import { ACTIVITY_INFO, DAY_GOD_INFO, DUTY_INFO } from '../almanacInfo'

describe('the almanac’s words explained', () => {
  it('has a line, in Chinese and English, for everything the almanac names over sixty years', () => {
    const activities = new Set<string>()
    const duties = new Set<string>()
    const gods = new Set<string>()
    for (let d = SolarDay.fromYmd(1990, 1, 1), i = 0; i < 365 * 60; i += 7, d = d.next(7)) {
      const day = d.getSixtyCycleDay()
      for (const x of [...day.getRecommends(), ...day.getAvoids()]) activities.add(x.getName())
      duties.add(day.getDuty().getName())
      gods.add(day.getTwelveStar().getName())
    }
    const missing = (names: Set<string>, info: Record<string, { zh: string; en: string }>) =>
      [...names].filter((n) => !info[n]?.zh || !info[n]?.en)
    expect(missing(activities, ACTIVITY_INFO)).toEqual([])
    expect(missing(duties, DUTY_INFO)).toEqual([])
    expect(missing(gods, DAY_GOD_INFO)).toEqual([])
    expect(duties.size).toBe(12)
    expect(gods.size).toBe(12)
  })
})
