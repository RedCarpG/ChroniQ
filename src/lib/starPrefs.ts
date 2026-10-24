// 星盘 preferences: 流派 (house system, node) and the birthplace. Kept apart
// from astrology.ts so the app shell can load them without astronomy-engine.
import { CITIES, type City } from './solarTime'

export interface StarSettings {
  /** 宫位制 */
  houses: 'placidus' | 'whole' | 'equal'
  /** 月交点 */
  node: 'true' | 'mean'
  /** 推运上升 / 天顶的推法 */
  progAngles: 'solarArc' | 'naibod'
  /** 组合盘的做法 */
  composite: 'midpoint' | 'davison'
}

export const DEFAULT_STAR_SETTINGS: StarSettings = { houses: 'placidus', node: 'true', progAngles: 'solarArc', composite: 'midpoint' }

export const STAR_SCHOOLS: {
  [K in keyof StarSettings]: { title: string; summary: string; options: { value: StarSettings[K]; label: string; source: string }[] }
} = {
  houses: {
    title: '宫位制',
    summary: '如何把天空分成十二宫。行星的星座不变，所落的宫位可能不同。',
    options: [
      { value: 'placidus', label: '普拉西度（Placidus）', source: '17 世纪 Placidus de Titis，现代西方占星最常用，多数网站与软件默认' },
      { value: 'whole', label: '整宫制（Whole Sign）', source: '希腊化时期古典占星：上升所在星座整个为第一宫' },
      { value: 'equal', label: '等宫制（Equal）', source: '从上升点起每 30° 一宫，古典与现代均有使用' },
    ],
  },
  node: {
    title: '月交点',
    summary: '北交点（龙头）用真实位置还是平均位置，两者最多相差约 1.5°。',
    options: [
      { value: 'true', label: '真交点（True Node）', source: '按月球瞬时轨道计算，多数现代软件默认' },
      { value: 'mean', label: '平交点（Mean Node）', source: '按平均运动计算，较早的星历与部分流派使用' },
    ],
  },
  progAngles: {
    title: '推运天顶',
    summary: '二次推运中，上升与天顶怎样随年龄推进。行星的推运位置不受影响。',
    options: [
      { value: 'solarArc', label: '太阳弧（Solar Arc）', source: '天顶前进的度数等于推运太阳走过的弧度，较常用' },
      { value: 'naibod', label: 'Naibod 平均弧', source: '每年按太阳平均日行 0°59′08″ 推进' },
    ],
  },
  composite: {
    title: '组合盘',
    summary: '把两个人的星盘合成一张「关系本身」的盘。两种做法的行星位置与宫位都会不同。',
    options: [
      {
        value: 'midpoint',
        label: '中点组合盘（Composite）',
        source: '每对行星取两人位置的较近中点；天顶取中点，上升与宫位由组合天顶在两地平均纬度推出。Robert Hand《Planets in Composite》（1975）推广，最常用',
      },
      {
        value: 'davison',
        label: '时空中点盘（Davison）',
        source: '取两人出生时刻与出生地的中点，按那一刻那个地点的真实天象起盘。Ronald Davison《Synastry》（1977）提出',
      },
    ],
  },
}

const SETTINGS_KEY = 'chroniq-star-settings'

export function loadStarSettings(): StarSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<StarSettings>
    const merged = { ...DEFAULT_STAR_SETTINGS }
    for (const key of Object.keys(STAR_SCHOOLS) as (keyof StarSettings)[]) {
      if (STAR_SCHOOLS[key].options.some((o) => o.value === saved[key])) (merged as Record<string, unknown>)[key] = saved[key]
    }
    return merged
  } catch {
    return DEFAULT_STAR_SETTINGS
  }
}

export function saveStarSettings(settings: StarSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Storage unavailable: settings last for this visit only.
  }
}

export interface StarPlace {
  name: string
  latitude: number
  /** East positive */
  longitude: number
  /** IANA zone the birth time was recorded in */
  timeZone: string
}

const SHANGHAI = 'Asia/Shanghai'

export const cityPlace = (c: City): StarPlace => ({
  name: c.name,
  latitude: c.latitude,
  longitude: c.longitude,
  timeZone: c.timeZone ?? SHANGHAI,
})

const PLACE_KEY = 'chroniq-star-place'

/** A stored place, if it is well-formed. */
function readPlace(key: string): StarPlace | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as StarPlace | null
    if (
      saved &&
      typeof saved.name === 'string' &&
      Number.isFinite(saved.latitude) &&
      Number.isFinite(saved.longitude) &&
      Math.abs(saved.latitude) <= 90 &&
      typeof saved.timeZone === 'string'
    )
      return saved
  } catch {
    // fall through to the default
  }
  return null
}

function writePlace(key: string, place: StarPlace): void {
  try {
    localStorage.setItem(key, JSON.stringify(place))
  } catch {
    // Storage unavailable: the place lasts for this visit only.
  }
}

/** Saved birthplace, else the 八字 真太阳时 city if one is set, else 北京. */
export const loadStarPlace = (longitude?: number): StarPlace =>
  readPlace(PLACE_KEY) ?? cityPlace(CITIES.find((c) => c.longitude === longitude) ?? CITIES[0])
export const saveStarPlace = (place: StarPlace): void => writePlace(PLACE_KEY, place)

const SKY_PLACE_KEY = 'chroniq-sky-place'

/** Where 天象 looks up from: its own saved place, else the 星盘 birthplace. */
export const loadSkyPlace = (fallback: StarPlace): StarPlace => readPlace(SKY_PLACE_KEY) ?? fallback
export const saveSkyPlace = (place: StarPlace): void => writePlace(SKY_PLACE_KEY, place)
