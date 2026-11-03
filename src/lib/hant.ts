// 繁體中文: the interface is written in 简体; in 繁體 it is converted by OpenCC (cn → t), word by
// word rather than character by character, so 发展 and 头发 come out 發展 and 頭髮. OpenCC's
// dictionaries are large (about 1 MB), so they load only when 繁體 is chosen.
import { HANT_FIXES } from './hantFixes'

/**
 * Characters this app always uses in one sense, whatever OpenCC guesses: 丑 is the 地支 (not 醜),
 * 斗 the Dipper (not 鬥), and 冲 the 命理 clash, 沖, but for the words where it means to rush or
 * a planet's opposition, which take 衝
 */
const CHAR_FIXES: [RegExp, string][] = [
  [/醜/g, '丑'],
  [/鬥/g, '斗'],
  [/衝/g, '沖'],
  [/沖(突|勁|動|擊)/g, '衝$1'],
  [/脈沖/g, '脈衝'],
  [/沖日/g, '衝日'],
]

let converter: ((text: string) => string) | null = null
let loading: Promise<void> | null = null
const cache = new Map<string, string>()

/** Loads OpenCC once; resolves when hant() converts */
export function loadHant(): Promise<void> {
  loading ??= import('opencc-js/cn2t').then((OpenCC) => {
    converter = OpenCC.Converter({ from: 'cn', to: 't' })
  })
  return loading
}

export const hantReady = () => converter !== null

/**
 * Text in 繁體 (as it is until OpenCC has loaded). Proper nouns already in this project's 繁體
 * (useTerm) keep their forms: where OpenCC would turn them differently, HANT_FIXES turns them back.
 */
export function hant(text: string): string {
  if (!converter || !/[㐀-鿿]/.test(text)) return text
  let out = cache.get(text)
  if (out === undefined) {
    out = converter(text)
    for (const [pattern, right] of CHAR_FIXES) out = out.replace(pattern, right)
    for (const [wrong, right] of HANT_FIXES) if (out.includes(wrong)) out = out.split(wrong).join(right)
    if (cache.size > 5000) cache.clear()
    cache.set(text, out)
  }
  return out
}
