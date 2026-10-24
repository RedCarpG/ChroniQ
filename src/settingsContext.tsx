import { createContext, useContext } from 'react'
import { DEFAULT_SETTINGS, type Settings } from './lib/settings'
import { toTrad } from './lib/trad'
import { translate, type Vars } from './i18n'

export const SettingsContext = createContext<Settings>(DEFAULT_SETTINGS)

export const useSettings = () => useContext(SettingsContext)

/**
 * Returns term(s): a proper noun (干支, 神煞, 十神, 节气 …) in the chosen script.
 * Proper nouns stay Chinese whatever the UI language; explanatory text does
 * not go through term(). Literal term('…') calls are picked up by
 * scripts/terms.ts, so keep each on one line.
 */
export function useTerm(): (term: string) => string {
  const { script } = useSettings()
  return script === 'trad' ? toTrad : (s) => s
}

/**
 * Returns t(text, vars): interface text (written in Chinese) in the chosen
 * language; see src/i18n. Keep literal t('…') calls on one line.
 */
export function useT(): (text: string, vars?: Vars) => string {
  const { language } = useSettings()
  return (text, vars) => translate(language, text, vars)
}
