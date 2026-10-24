import { describe, expect, it } from 'vitest'
import { ASPECTS, BODY_INFO, ELEMENT_NAME, SIGNS } from '../../lib/astrology'
import { STAR_SCHOOLS } from '../../lib/starPrefs'
import { EN } from '../en'

// The 星盘 page translates these names at display with t(variable), so the
// literal-text check in i18n.test.ts can't see them.
describe('English dictionary for 星盘', () => {
  it('names every planet, point, sign, element, aspect and house', () => {
    const texts = [
      ...Object.values(BODY_INFO).map((b) => b.name),
      '上升',
      '天顶',
      ...SIGNS,
      ...Object.values(ELEMENT_NAME),
      ...ASPECTS.flatMap((a) => [a.name, `${a.name}相`]),
      ...Array.from({ length: 12 }, (_, i) => `第${i + 1}宫`),
      ...STAR_SCHOOLS.houses.options.map((o) => o.label),
    ]
    expect(texts.filter((t) => EN[t] === undefined)).toEqual([])
  })

  it('uses English ordinals for the houses', () => {
    expect([1, 2, 3, 4, 11, 12].map((n) => EN[`第${n}宫`])).toEqual([
      '1st house',
      '2nd house',
      '3rd house',
      '4th house',
      '11th house',
      '12th house',
    ])
  })
})
