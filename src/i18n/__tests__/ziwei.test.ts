import { describe, expect, it } from 'vitest'
import { SIGNS } from '../../lib/astrology'
import { EN } from '../en'

describe('紫微斗数 English', () => {
  // ZiweiView shows iztro's chart.sign (白羊座 …) through t(), so the i18n test
  // can't see these keys as literals.
  it('covers every sun sign iztro names', () => {
    const signs = SIGNS.map((s) => `${s}座`)
    expect(signs.filter((s) => EN[s] === undefined)).toEqual([])
  })
})
