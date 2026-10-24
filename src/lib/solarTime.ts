// 真太阳时 = 世界时 + 经度 × 4 分钟 + 均时差. For a birth recorded in 北京时间 that
// is 北京时间 + (经度 − 120°) × 4 分钟 + 均时差; the time zone's own offset (and
// daylight saving, e.g. China 1986–91) comes from Intl.
import { toUtc } from './timeZone'

export interface City {
  name: string
  longitude: number
  /** North latitude, for 星盘 houses */
  latitude: number
  /** IANA zone birth times there are recorded in (default Asia/Shanghai, i.e. 北京时间) */
  timeZone?: string
}

export const CITIES: City[] = [
  { name: '北京', longitude: 116.41, latitude: 39.9 },
  { name: '上海', longitude: 121.47, latitude: 31.23 },
  { name: '天津', longitude: 117.2, latitude: 39.13 },
  { name: '重庆', longitude: 106.55, latitude: 29.56 },
  { name: '哈尔滨', longitude: 126.53, latitude: 45.8 },
  { name: '长春', longitude: 125.32, latitude: 43.82 },
  { name: '沈阳', longitude: 123.43, latitude: 41.8 },
  { name: '呼和浩特', longitude: 111.75, latitude: 40.84 },
  { name: '石家庄', longitude: 114.51, latitude: 38.04 },
  { name: '太原', longitude: 112.55, latitude: 37.87 },
  { name: '济南', longitude: 117.0, latitude: 36.65 },
  { name: '郑州', longitude: 113.62, latitude: 34.75 },
  { name: '西安', longitude: 108.94, latitude: 34.34 },
  { name: '兰州', longitude: 103.83, latitude: 36.06 },
  { name: '银川', longitude: 106.23, latitude: 38.49 },
  { name: '西宁', longitude: 101.78, latitude: 36.62 },
  { name: '乌鲁木齐', longitude: 87.62, latitude: 43.83 },
  { name: '拉萨', longitude: 91.13, latitude: 29.65 },
  { name: '成都', longitude: 104.07, latitude: 30.57 },
  { name: '贵阳', longitude: 106.63, latitude: 26.65 },
  { name: '昆明', longitude: 102.83, latitude: 25.04 },
  { name: '南宁', longitude: 108.37, latitude: 22.82 },
  { name: '武汉', longitude: 114.31, latitude: 30.59 },
  { name: '长沙', longitude: 112.94, latitude: 28.23 },
  { name: '南昌', longitude: 115.86, latitude: 28.68 },
  { name: '合肥', longitude: 117.23, latitude: 31.82 },
  { name: '南京', longitude: 118.8, latitude: 32.06 },
  { name: '杭州', longitude: 120.16, latitude: 30.27 },
  { name: '福州', longitude: 119.3, latitude: 26.07 },
  { name: '广州', longitude: 113.26, latitude: 23.13 },
  { name: '深圳', longitude: 114.06, latitude: 22.54 },
  { name: '海口', longitude: 110.35, latitude: 20.04 },
  { name: '香港', longitude: 114.17, latitude: 22.32, timeZone: 'Asia/Hong_Kong' },
  { name: '澳门', longitude: 113.54, latitude: 22.2, timeZone: 'Asia/Macau' },
  { name: '台北', longitude: 121.56, latitude: 25.03, timeZone: 'Asia/Taipei' },
]

export interface WallTime {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

/** Equation of time in minutes (approximation accurate to about ±1 min). */
export function equationOfTime(year: number, month: number, day: number): number {
  const dayOfYear = (Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86_400_000
  const b = (2 * Math.PI * (dayOfYear - 81)) / 364
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)
}

/**
 * Clock time recorded in timeZone (北京时间 by default) at the given east
 * longitude → apparent solar time there. offsetMinutes is the whole shift.
 */
export function toTrueSolarTime(
  t: WallTime,
  longitude: number,
  timeZone = 'Asia/Shanghai',
): { time: WallTime; offsetMinutes: number } {
  const zone = toUtc(t, timeZone).offsetMinutes
  const offsetMinutes = longitude * 4 - zone + equationOfTime(t.year, t.month, t.day)
  // Work in UTC so the host time zone never interferes.
  const d = new Date(Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute) + Math.round(offsetMinutes) * 60_000)
  return {
    time: {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
    },
    offsetMinutes,
  }
}
