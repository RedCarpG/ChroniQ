// UI language. Interface text is written in Chinese in the source and passed
// through t('…'); in English it is looked up in the en/*.ts dictionaries, keyed
// by that Chinese text. Proper nouns (干支, 十神, 神煞, 星曜 …) do not go through
// t(): they go through term() and stay Chinese in every language.
//
// - Keep each literal t('…') call on one line: src/i18n/__tests__ finds them
//   and checks every one has an English entry with the same {slots}.
// - Fill slots with t('{n} 颗亮星', { n }): words around a number or name move
//   with the language instead of being glued together in JSX.
// - Text with no entry yet falls back to the Chinese.
import { EN } from './en'

export type Lang = 'zh' | 'en'
export type Vars = Record<string, string | number>

export function translate(lang: Lang, text: string, vars?: Vars): string {
  const s = lang === 'en' ? (EN[text] ?? text) : text
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s
}
