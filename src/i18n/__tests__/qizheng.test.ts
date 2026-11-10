import { describe, expect, it } from 'vitest'
import { QIZHENG_SCHOOLS } from '../../lib/qizhengSchools'
import { EN } from '../en'

describe('七政四余 in English', () => {
  it('covers the 流派设置', () => {
    const texts = Object.values(QIZHENG_SCHOOLS).flatMap((s) => [s.title, s.summary, ...s.options.flatMap((o) => [o.label, o.source])])
    expect(texts.filter((t) => EN[t] === undefined)).toEqual([])
  })
})
