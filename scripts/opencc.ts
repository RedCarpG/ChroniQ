import * as OpenCC from 'opencc-js'
import { TRAD_OVERRIDES, TRAD_TERMS } from '../src/lib/tradOverrides'

const convert = OpenCC.Converter({ from: 'cn', to: 't' })

/** OpenCC (cn → t) alone, as 繁體中文 converts the interface */
export const convertTrad = (text: string) => convert(text)

/** OpenCC (cn → t) plus this project's overrides: the expected 繁體 form of a term. */
export function expectedTrad(term: string): string {
  if (TRAD_TERMS[term]) return TRAD_TERMS[term]
  const src = [...term]
  return [...convert(term)].map((c, i) => TRAD_OVERRIDES[src[i]] ?? c).join('')
}
