// 七政四余: Chinese astrology of the real sky. The 七政 (Sun, Moon and the five planets) are where
// astronomy-engine puts them at the moment of birth; each is placed in its 宿 by right ascension
// (mansions.ts, J2000, as the 距星 are). The 四余 are points, not bodies: 罗睺 and 计都 the Moon's two
// nodes, 月孛 its mean apogee, and 紫炁, which has no counterpart in the sky, by a school's reckoning.
// The 十二次 are the twelve 30° divisions of the ecliptic from the equinox, as the 时宪历 drew them; the
// 命宫 is the 次 the Ascendant is in, and the other palaces follow it eastward along the ecliptic.
import * as A from 'astronomy-engine'
import { buildStarChart, nodeLon } from './astrology'
import type { BaziInput } from './bazi'
import { MANSIONS, mansionOf, toGuDu, type Mansion } from './mansions'
import { DEFAULT_PLACE, type Place } from './place'
import type { QizhengSchoolSettings } from './qizhengSchools'
import { DEFAULT_STAR_SETTINGS } from './starPrefs'

const norm = (d: number) => ((d % 360) + 360) % 360

/** 十二次, from 白羊 0° (the spring equinox) eastward, with their 地支 */
export const CI: { name: string; branch: string }[] = [
  { name: '降娄', branch: '戌' },
  { name: '大梁', branch: '酉' },
  { name: '实沈', branch: '申' },
  { name: '鹑首', branch: '未' },
  { name: '鹑火', branch: '午' },
  { name: '鹑尾', branch: '巳' },
  { name: '寿星', branch: '辰' },
  { name: '大火', branch: '卯' },
  { name: '析木', branch: '寅' },
  { name: '星纪', branch: '丑' },
  { name: '玄枵', branch: '子' },
  { name: '娵訾', branch: '亥' },
]

/** The twelve palaces, from the 命宫 on */
export const PALACES = ['命宫', '财帛', '兄弟', '田宅', '男女', '奴仆', '夫妻', '疾厄', '迁移', '官禄', '福德', '相貌']

export type QizhengKey = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'rahu' | 'ketu' | 'yuebei' | 'ziqi'

/** The bodies: their names, the one character the books use, the old name of each planet, its element */
export const QIZHENG_INFO: Record<QizhengKey, { name: string; char: string; old: string; element: string; four: boolean }> = {
  sun: { name: '太阳', char: '日', old: '太阳', element: '火', four: false },
  moon: { name: '太阴', char: '月', old: '太阴', element: '水', four: false },
  mercury: { name: '水星', char: '水', old: '辰星', element: '水', four: false },
  venus: { name: '金星', char: '金', old: '太白', element: '金', four: false },
  mars: { name: '火星', char: '火', old: '荧惑', element: '火', four: false },
  jupiter: { name: '木星', char: '木', old: '岁星', element: '木', four: false },
  saturn: { name: '土星', char: '土', old: '镇星', element: '土', four: false },
  rahu: { name: '罗睺', char: '罗', old: '罗睺', element: '火', four: true },
  ketu: { name: '计都', char: '计', old: '计都', element: '土', four: true },
  yuebei: { name: '月孛', char: '孛', old: '月孛', element: '水', four: true },
  ziqi: { name: '紫炁', char: '炁', old: '紫炁', element: '木', four: true },
}

export const SEVEN: QizhengKey[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']
export const FOUR: QizhengKey[] = ['rahu', 'ketu', 'yuebei', 'ziqi']

export interface QizhengBody {
  key: QizhengKey
  /** Right ascension, J2000, degrees */
  ra: number
  /** Ecliptic longitude of date, degrees */
  lon: number
  mansion: Mansion
  /** The mansion's index in MANSIONS */
  mansionIndex: number
  /** How far into the mansion, degrees of RA, and in 古度 */
  into: number
  du: number
  /** 十二次 index (CI) */
  ci: number
  /** Palace index (PALACES), from the 命宫 */
  palace: number
  /** Moving backward (the five planets) */
  retro: boolean
  /** Reckoned by a school, not observed (紫炁) */
  reckoned: boolean
}

export interface QizhengChart {
  utc: Date
  /** The birth's offset from UTC there and then (minutes), and whether that was summer time */
  offsetMinutes: number
  dst: boolean
  place: Place
  gender: '男' | '女'
  bodies: QizhengBody[]
  /** The Ascendant's ecliptic longitude, its 次 (the 命宫) and its 宿 */
  asc: number
  mingCi: number
  ascMansion: Mansion
  /** Where each 次 begins, as a J2000 right ascension, for drawing it beside the mansions */
  ciRa: number[]
}

const BODY: Partial<Record<QizhengKey, A.Body>> = {
  sun: A.Body.Sun,
  moon: A.Body.Moon,
  mercury: A.Body.Mercury,
  venus: A.Body.Venus,
  mars: A.Body.Mars,
  jupiter: A.Body.Jupiter,
  saturn: A.Body.Saturn,
}

/** J2000 RA of a point on the ecliptic of date */
function eclipticRa(lon: number, t: A.AstroTime): number {
  const v = A.VectorFromSphere(new A.Spherical(0, lon, 1), t)
  return A.EquatorFromVector(A.RotateVector(A.Rotation_ECT_EQJ(t), v)).ra * 15
}

/** 月孛: the Moon's mean apogee (Meeus, Astronomical Algorithms ch. 50, the mean perigee + 180°) */
export function meanApogee(t: A.AstroTime): number {
  const T = t.tt / 36525
  return norm(83.3532465 + 4069.0137287 * T - 0.01032 * T * T - (T * T * T) / 80053 + 180)
}

/** 紫炁 by the 28-year reckoning: steadily eastward once round in 28 tropical years, from 星纪初度 at J2000 */
export function ziqiLon(t: A.AstroTime): number {
  return norm(270 + (360 * t.tt) / (28 * 365.24219))
}

const ciOf = (lon: number) => Math.floor(norm(lon) / 30) % 12

export function buildQizheng(input: BaziInput, schools: QizhengSchoolSettings): QizhengChart {
  const place = input.place ?? DEFAULT_PLACE
  const star = buildStarChart(input, place, { ...DEFAULT_STAR_SETTINGS, node: schools.node })
  const t = A.MakeTime(star.utc)
  const mingCi = ciOf(star.asc)
  const make = (key: QizhengKey, ra: number, lon: number, retro = false): QizhengBody => {
    const { mansion, index, into } = mansionOf(ra)
    const ci = ciOf(lon)
    return { key, ra, lon, mansion, mansionIndex: index, into, du: toGuDu(into), ci, palace: (ci - mingCi + 12) % 12, retro, reckoned: key === 'ziqi' }
  }
  const bodies: QizhengBody[] = SEVEN.map((key) => {
    const body = BODY[key]!
    const v = A.GeoVector(body, t, true)
    const ra = A.EquatorFromVector(v).ra * 15
    const lon = A.Ecliptic(v).elon
    const retro = key !== 'sun' && key !== 'moon' && norm(A.Ecliptic(A.GeoVector(body, t.AddDays(1), true)).elon - lon + 180) - 180 < 0
    return make(key, ra, lon, retro)
  })
  const ascending = nodeLon(t, schools.node)
  const [rahu, ketu] = schools.rahu === 'ascending' ? [ascending, ascending + 180] : [ascending + 180, ascending]
  for (const [key, lon] of [
    ['rahu', norm(rahu)],
    ['ketu', norm(ketu)],
    ['yuebei', meanApogee(t)],
    ...(schools.ziqi === 'cycle28' ? [['ziqi', ziqiLon(t)] as const] : []),
  ] as const)
    bodies.push(make(key, eclipticRa(lon, t), lon))
  return {
    utc: star.utc,
    offsetMinutes: star.offsetMinutes,
    dst: star.dst,
    place,
    gender: input.gender === 1 ? '男' : '女',
    bodies,
    asc: star.asc,
    mingCi,
    ascMansion: mansionOf(eclipticRa(star.asc, t)).mansion,
    ciRa: CI.map((_, k) => eclipticRa(k * 30, t)),
  }
}

/** The 古度 into a mansion as the books write it: 十二度, or 初度 under one */
export const duText = (du: number, han: (n: number) => string) => (du < 1 ? '初度' : `${han(Math.floor(du))}度`)

/** All 28 mansions with their start and width (degrees of RA), for drawing */
export const mansionArcs = () => MANSIONS.map((m, i) => ({ mansion: m, index: i, start: m.ra, width: norm(MANSIONS[(i + 1) % 28].ra - m.ra) }))
