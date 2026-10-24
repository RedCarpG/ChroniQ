import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SETTING_OPTIONS } from '../../lib/settings'
import { CITIES } from '../../lib/solarTime'
import { WORLD_CITIES } from '../../lib/worldCities'
import { EN, EN_PARTS } from '../en'
import { translate } from '..'

const SLOT = /\{(\w+)\}/g
const slots = (s: string) => [...s.matchAll(SLOT)].map((m) => m[1]).sort()

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

/** Every literal t('…') in the source, with where it is */
function literalTexts(): [string, string][] {
  const out: [string, string][] = []
  for (const file of sourceFiles('src')) {
    // Comments may show t('…') as an example; leave them out
    const src = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    for (const m of src.matchAll(/(?<![\w.])t\(\s*'((?:[^'\\]|\\.)+)'/g)) out.push([m[1].replace(/\\'/g, "'"), file])
  }
  return out
}

describe('English dictionary', () => {
  it('has every literal t() text, with the same {slots}', () => {
    const missing = literalTexts().filter(([text]) => EN[text] === undefined)
    expect(missing.map(([text, file]) => `${file}: ${text}`)).toEqual([])
    const badSlots = literalTexts().filter(([text]) => slots(EN[text]).join() !== slots(text).join())
    expect(badSlots.map(([text]) => `${text} → ${EN[text]}`)).toEqual([])
  })

  it('gives a key the same English in every part', () => {
    const seen = new Map<string, string>()
    const clashes: string[] = []
    for (const part of Object.values(EN_PARTS)) {
      for (const [k, v] of Object.entries(part)) {
        if (seen.has(k) && seen.get(k) !== v) clashes.push(`${k}: ${seen.get(k)} / ${v}`)
        seen.set(k, v)
      }
    }
    expect(clashes).toEqual([])
  })

  it('has no empty or untranslated entries', () => {
    expect(Object.entries(EN).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([])
  })

  it('names every city in the place pickers', () => {
    const names = [...CITIES, ...WORLD_CITIES.flatMap((r) => r.cities)].map((c) => c.name)
    expect(names.filter((n) => EN[n] === undefined)).toEqual([])
  })

  it('covers the settings menu', () => {
    const texts = Object.values(SETTING_OPTIONS).flatMap((o) => [o.title, ...o.options.map((x) => x.label)])
    expect(texts.filter((t) => EN[t] === undefined)).toEqual([])
  })
})

describe('translate', () => {
  it('fills slots and falls back to the Chinese', () => {
    expect(translate('zh', '{n} 颗', { n: 3 })).toBe('3 颗')
    expect(translate('en', '没有这条翻译的文字')).toBe('没有这条翻译的文字')
    expect(translate('en', '设置')).toBe('Settings')
  })
})
