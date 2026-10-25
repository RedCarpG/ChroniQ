// App-wide display settings, kept per viewer in localStorage.

export interface Settings {
  /** 界面语言 (proper nouns stay Chinese) */
  language: 'zh' | 'en'
  theme: 'system' | 'light' | 'dark'
  /** 专有名词字形 */
  script: 'trad' | 'simp'
  weekStart: 'mon' | 'sun'
  /** 日历格子里显示日干支 */
  dayGanzhi: 'show' | 'hide'
  /** 日历格子里显示月相 */
  moonPhase: 'show' | 'hide'
  /** 日历标题旁显示斗柄指月 */
  dipper: 'show' | 'hide'
  /** 紫微星曜配色 */
  ziweiColor: 'element' | 'luck'
  /** 显示大小: auto grows the page on large screens */
  uiScale: 'auto' | '100' | '115' | '130'
  /** 音效: the little interface sounds (sound.ts) */
  sound: 'on' | 'off'
}

export const DEFAULT_SETTINGS: Settings = { language: 'zh', theme: 'system', script: 'trad', weekStart: 'mon', dayGanzhi: 'show', moonPhase: 'show', dipper: 'show', ziweiColor: 'element', uiScale: 'auto', sound: 'on' }

export const SETTING_OPTIONS: { [K in keyof Settings]: { title: string; options: { value: Settings[K]; label: string }[] } } = {
  language: {
    title: '语言',
    options: [
      { value: 'zh', label: '中文' },
      { value: 'en', label: 'English' },
    ],
  },
  theme: {
    title: '颜色模式',
    options: [
      { value: 'system', label: '跟随系统' },
      { value: 'light', label: '浅色' },
      { value: 'dark', label: '深色' },
    ],
  },
  script: {
    title: '专有名词',
    options: [
      { value: 'trad', label: '繁體' },
      { value: 'simp', label: '简体' },
    ],
  },
  weekStart: {
    title: '每周起始',
    options: [
      { value: 'mon', label: '周一' },
      { value: 'sun', label: '周日' },
    ],
  },
  dayGanzhi: {
    title: '日历显示日干支',
    options: [
      { value: 'show', label: '显示' },
      { value: 'hide', label: '隐藏' },
    ],
  },
  moonPhase: {
    title: '日历显示月相',
    options: [
      { value: 'show', label: '显示' },
      { value: 'hide', label: '隐藏' },
    ],
  },
  dipper: {
    title: '日历显示斗柄指月',
    options: [
      { value: 'show', label: '显示' },
      { value: 'hide', label: '隐藏' },
    ],
  },
  ziweiColor: {
    title: '紫微星曜配色',
    options: [
      { value: 'element', label: '按五行' },
      { value: 'luck', label: '按吉凶' },
    ],
  },
  uiScale: {
    title: '显示大小',
    options: [
      { value: 'auto', label: '自动' },
      { value: '100', label: '标准' },
      { value: '115', label: '大' },
      { value: '130', label: '特大' },
    ],
  },
  sound: {
    title: '音效',
    options: [
      { value: 'on', label: '开' },
      { value: 'off', label: '关' },
    ],
  },
}

const STORAGE_KEY = 'chroniq-settings'

export function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Settings>
    const merged = { ...DEFAULT_SETTINGS }
    for (const key of Object.keys(SETTING_OPTIONS) as (keyof Settings)[]) {
      const value = saved[key]
      if (SETTING_OPTIONS[key].options.some((o) => o.value === value)) (merged as Record<string, unknown>)[key] = value
    }
    return merged
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage unavailable (private mode): settings last for this visit only.
  }
}

/** Apply the 显示大小 to <html>; "auto" leaves it to the screen-width rules in styles.css. */
export function applyScale(scale: Settings['uiScale']): void {
  const root = document.documentElement
  if (scale === 'auto') delete root.dataset.scale
  else root.dataset.scale = scale
}

/** Apply the colour mode to <html>; "system" leaves it to prefers-color-scheme. */
export function applyTheme(theme: Settings['theme']): void {
  const root = document.documentElement
  if (theme === 'system') delete root.dataset.theme
  else root.dataset.theme = theme
}
