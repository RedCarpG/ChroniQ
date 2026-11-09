// App-wide display settings, kept per viewer in localStorage.

export interface Settings {
  /** 界面语言: 简体, 繁體 or English (proper nouns stay Chinese) */
  language: 'zh' | 'zh-Hant' | 'en'
  theme: 'system' | 'light' | 'dark'
  /** 专有名词字形, in English only: in Chinese they follow the language */
  script: 'trad' | 'simp'
  weekStart: 'mon' | 'sun'
  /** 日历格子里显示日干支 */
  dayGanzhi: 'show' | 'hide'
  /** 日历格子里显示月相 */
  moonPhase: 'show' | 'hide'
  /** 日历标题旁显示斗柄指月 */
  dipper: 'show' | 'hide'
  /** 日历上显示天象预告 */
  skyEvents: 'show' | 'hide'
  /** 八字 and 星盘 pages' backdrop: the sky at the moment of birth (BirthSky), or the plain starfield */
  birthSky: 'show' | 'hide'
  /** 紫微星曜配色 */
  ziweiColor: 'element' | 'luck'
  /** 显示大小: auto grows the page on large screens */
  uiScale: 'auto' | '100' | '115' | '130'
  /** 音效: the little interface sounds (sound.ts) */
  sound: 'on' | 'off'
  /** 界面风格: the 天书 look (a preview, for the 命理 pages so far) or the classic one */
  uiStyle: 'classic' | 'tianshu'
}

export const DEFAULT_SETTINGS: Settings = { language: 'zh', theme: 'system', script: 'trad', weekStart: 'mon', dayGanzhi: 'show', moonPhase: 'show', dipper: 'show', skyEvents: 'show', birthSky: 'show', ziweiColor: 'element', uiScale: 'auto', sound: 'off', uiStyle: 'tianshu' }

export const SETTING_OPTIONS: { [K in keyof Settings]: { title: string; options: { value: Settings[K]; label: string }[] } } = {
  language: {
    title: '语言',
    options: [
      { value: 'zh', label: '简体中文' },
      { value: 'zh-Hant', label: '繁體中文' },
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
  skyEvents: {
    title: '日历显示天象预告',
    options: [
      { value: 'show', label: '显示' },
      { value: 'hide', label: '隐藏' },
    ],
  },
  birthSky: {
    title: '命盘背景',
    options: [
      { value: 'show', label: '生辰星空' },
      { value: 'hide', label: '普通星空' },
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
  uiStyle: {
    title: '界面风格',
    options: [
      { value: 'tianshu', label: '天书' },
      { value: 'classic', label: '经典' },
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
/** Set once the sounds' default turned to off: settings saved before then had them on by default, not by choice */
const SOUND_OFF_SINCE = 'chroniq-sound-default-off'
/** Set once 天书 became the default style: settings saved before then had 经典 by default, not by choice */
const TIANSHU_SINCE = 'chroniq-tianshu-default'

export function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Settings>
    const merged = { ...DEFAULT_SETTINGS }
    for (const key of Object.keys(SETTING_OPTIONS) as (keyof Settings)[]) {
      const value = saved[key]
      if (SETTING_OPTIONS[key].options.some((o) => o.value === value)) (merged as Record<string, unknown>)[key] = value
    }
    // The sounds are off by default now; a choice made since is kept
    if (!localStorage.getItem(SOUND_OFF_SINCE)) {
      merged.sound = 'off'
      localStorage.setItem(SOUND_OFF_SINCE, '1')
    }
    // 天书 is the default now: everyone moves to it once, and a choice of 经典 made since is kept
    if (!localStorage.getItem(TIANSHU_SINCE)) {
      merged.uiStyle = 'tianshu'
      localStorage.setItem(TIANSHU_SINCE, '1')
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

/** The pages the 天书 look covers, and which night each is drawn in: the east's for 八字 and 紫微, the west's for 星盘 */
export const TIANSHU_REALM: Partial<Record<string, 'east' | 'west'>> = { bazi: 'east', ziwei: 'east', star: 'west', timeline: 'east' }

/**
 * Apply the 界面风格 to <html> for the page shown: data-style names its night (east or west), and the
 * colour mode is then always dark, as the look is drawn by night. Elsewhere, the chosen colour mode.
 */
export function applyStyle(style: Settings['uiStyle'], page: string, theme: Settings['theme']): void {
  const root = document.documentElement
  const realm = style === 'tianshu' ? TIANSHU_REALM[page] : undefined
  if (realm) root.dataset.style = realm
  else delete root.dataset.style
  applyTheme(realm ? 'dark' : theme)
}

/** Apply the colour mode to <html>; "system" leaves it to prefers-color-scheme. */
export function applyTheme(theme: Settings['theme']): void {
  const root = document.documentElement
  if (theme === 'system') delete root.dataset.theme
  else root.dataset.theme = theme
}
