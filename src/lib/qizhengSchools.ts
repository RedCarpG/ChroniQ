// 七政四余 流派设置: where the traditions disagree on the 四余, with each option's source. Kept apart
// from qizheng.ts so the app shell can load them without astronomy-engine. See docs/schools.md.

export interface QizhengSchoolSettings {
  /** 罗睺 / 计都: which of the Moon's nodes is which */
  rahu: 'ascending' | 'descending'
  /** 月交点: true or mean */
  node: 'true' | 'mean'
  /** 紫炁: shown by the 28-year reckoning, or left out */
  ziqi: 'cycle28' | 'hidden'
}

export const DEFAULT_QIZHENG_SCHOOLS: QizhengSchoolSettings = { rahu: 'ascending', node: 'true', ziqi: 'cycle28' }

export const QIZHENG_SCHOOLS: {
  [K in keyof QizhengSchoolSettings]: { title: string; summary: string; options: { value: QizhengSchoolSettings[K]; label: string; source: string }[] }
} = {
  rahu: {
    title: '罗睺计都',
    summary: '罗睺、计都是月亮轨道与黄道的两个交点，哪个叫罗睺、哪个叫计都，前后说法相反。',
    options: [
      { value: 'ascending', label: '罗睺为升交点（北交）', source: '与印度 Rāhu 同，清代《时宪历》以来的通行说法' },
      { value: 'descending', label: '罗睺为降交点（南交）', source: '明代及以前的部分中国星命书的用法，与印度相反' },
    ],
  },
  node: {
    title: '月交点',
    summary: '罗睺、计都用月交点的真实位置还是平均位置，两者最多相差约 1.5°。',
    options: [
      { value: 'true', label: '真交点', source: '按月球瞬时轨道计算' },
      { value: 'mean', label: '平交点', source: '按平均运动计算，古法推步即用平行' },
    ],
  },
  ziqi: {
    title: '紫炁',
    summary: '紫炁在天上没有对应的天体，只能依流派推算；各家起点不同，位置可能相差很多。',
    options: [
      { value: 'cycle28', label: '二十八年一周天', source: '按「紫炁二十八年行一周天」匀速顺行推算；起点取 2000 年初在星纪初度（冬至点），是本应用的约定' },
      { value: 'hidden', label: '不排紫炁', source: '只排有天文对应的罗睺、计都、月孛' },
    ],
  },
}

const KEY = 'chroniq-qizheng-schools'

export function loadQizhengSchools(): QizhengSchoolSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<QizhengSchoolSettings>
    const merged = { ...DEFAULT_QIZHENG_SCHOOLS }
    for (const key of Object.keys(QIZHENG_SCHOOLS) as (keyof QizhengSchoolSettings)[]) {
      if (QIZHENG_SCHOOLS[key].options.some((o) => o.value === saved[key])) (merged as Record<string, unknown>)[key] = saved[key]
    }
    return merged
  } catch {
    return DEFAULT_QIZHENG_SCHOOLS
  }
}

export function saveQizhengSchools(settings: QizhengSchoolSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // Storage unavailable: settings last for this visit only.
  }
}
