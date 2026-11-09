import { describe, expect, it } from 'vitest'
import { hanNumber } from '../hanNumber'

describe('hanNumber', () => {
  it('writes small numbers as they are read', () => {
    expect([0, 4, 10, 12, 20, 23].map(hanNumber)).toEqual(['〇', '四', '十', '十二', '二十', '二十三'])
  })
})
