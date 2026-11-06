// 方位 in words, apart from lib/sky so that the calendar (its 天象 list) can write a direction without
// loading the sky's catalogue and astronomy along with the first page.

const COMPASS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
const COMPASS_EN = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

/** 方位 in words and degrees, e.g. 东南 135° (or SE 135° in English) */
export function formatAzimuth(az: number, lang: string = 'zh'): string {
  return `${(lang === 'en' ? COMPASS_EN : COMPASS)[Math.round(az / 45) % 8]} ${Math.round(az)}°`
}
