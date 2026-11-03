// 深空天体: the Messier catalogue (messierData.ts) on the 天象 map — galaxies, star clusters and
// nebulae, each with its Chinese name where it has a common one, its kind, and where it stands in
// the sky at a moment. A few of the best known have a line or two about them, and a distance.
import * as A from 'astronomy-engine'
import { MESSIER_ROWS, type MessierKind } from './messierData'
import { horizonOf } from './sky'

export type { MessierKind }

export interface Messier {
  /** Its number: M31 is 31 */
  n: number
  ra: number
  dec: number
  kind: MessierKind
  mag: number
  /** Size, arcminutes: long and short axes */
  size: [number, number]
  /** NGC number or the like */
  desig: string
  /** Its common name: Chinese, English (either may be empty) */
  zh: string
  en: string
  /** Which way its long axis lies: degrees from north through east, if known */
  pa: number | null
}

/** Common Chinese names */
const ZH: Record<number, string> = {
  1: '蟹状星云',
  6: '蝴蝶星团',
  7: '托勒密星团',
  8: '礁湖星云',
  11: '野鸭星团',
  13: '武仙座大球状星团',
  16: '鹰状星云',
  17: 'ω 星云',
  20: '三叶星云',
  22: '人马座球状星团',
  24: '人马座小恒星云',
  27: '哑铃星云',
  31: '仙女座大星系',
  32: '仙女座伴星系 M32',
  33: '三角座星系',
  42: '猎户座大星云',
  44: '鬼星团（蜂巢星团）',
  45: '昴星团',
  51: '涡状星系',
  57: '环状星云',
  63: '向日葵星系',
  64: '黑眼星系',
  76: '小哑铃星云',
  77: '鲸鱼座 A',
  81: '波德星系',
  82: '雪茄星系',
  83: '南风车星系',
  87: '室女座 A',
  94: '猫眼星系',
  97: '夜枭星云',
  101: '风车星系',
  102: '纺锤星系',
  104: '草帽星系',
  110: '仙女座伴星系 M110',
}

export const MESSIER: Messier[] = MESSIER_ROWS.map(([n, ra, dec, kind, mag, a, b, desig, en, pa]) => ({
  n,
  ra,
  dec,
  kind,
  mag,
  size: [a, b],
  desig,
  zh: ZH[n] ?? '',
  en,
  pa,
}))

/** What each kind is called */
export const KIND_NAME: Record<MessierKind, string> = {
  galaxy: '星系',
  gc: '球状星团',
  oc: '疏散星团',
  nebula: '弥漫星云',
  pn: '行星状星云',
  snr: '超新星遗迹',
  asterism: '星群',
}

/** Its name to show: the common one if it has one, else "M n" */
export const messierName = (m: Messier, en: boolean) => (en ? m.en || `M${m.n}` : m.zh || `M${m.n}`)

/** The constellation it lies in (IAU boundaries), as its three-letter abbreviation */
export const messierConstellation = (m: Messier) => A.Constellation(m.ra / 15, m.dec).symbol

/** A few words on the best known, with how far off they are */
export const MESSIER_INTRO: Record<number, { zh: string; en: string }> = {
  1: {
    zh: '1054 年超新星爆发留下的残骸，《宋会要》记下了那颗「天关客星」，白天可见二十多天。中心是一颗每秒转 30 圈的脉冲星。距离约 6500 光年。',
    en: 'What is left of the supernova of 1054, which Song astronomers recorded as a "guest star" by 天关, visible by day for over three weeks. At its heart is a pulsar spinning 30 times a second. About 6,500 light years away.',
  },
  8: {
    zh: '人马座里肉眼可见的一团亮星云，正在形成新的恒星。距离约 4000 光年，夏夜南方银河最亮的一段里。',
    en: 'A bright nebula in Sagittarius, visible to the eye, where new stars are forming. About 4,000 light years away, in the brightest stretch of the summer Milky Way.',
  },
  13: {
    zh: '北天最亮的球状星团，几十万颗年老的恒星挤在直径约 150 光年的球里。双筒望远镜里是一团模糊的光斑。距离约 22000 光年。',
    en: 'The brightest globular cluster in the northern sky: a few hundred thousand old stars packed into a ball some 150 light years across. A fuzzy patch in binoculars. About 22,000 light years away.',
  },
  16: {
    zh: '鹰状星云，哈勃拍下的「创生之柱」就在其中：冷气体和尘埃的柱子里正诞生恒星。距离约 7000 光年。',
    en: 'The Eagle Nebula, home of Hubble’s "Pillars of Creation": columns of cold gas and dust where stars are being born. About 7,000 light years away.',
  },
  27: {
    zh: '一颗类似太阳的恒星死去时抛出的气体壳层，小望远镜里像个哑铃。距离约 1360 光年。',
    en: 'The shell of gas a Sun-like star threw off as it died; in a small telescope it looks like a dumbbell. About 1,360 light years away.',
  },
  31: {
    zh: '离我们最近的大星系，比银河系还大，有约一万亿颗恒星。秋夜在暗处肉眼可见，是肉眼能看到的最远的东西之一：看到的光是 250 万年前发出的。约 45 亿年后它会和银河系相撞。',
    en: 'The nearest large galaxy, bigger than the Milky Way, with about a trillion stars. Visible to the eye on dark autumn nights, it is one of the farthest things one can see unaided: its light left 2.5 million years ago. It will meet the Milky Way in about 4.5 billion years.',
  },
  33: {
    zh: '本星系群第三大的星系，正面朝向我们的旋涡。极好的暗夜里勉强肉眼可见。距离约 270 万光年。',
    en: 'The third largest galaxy of the Local Group, a spiral seen face-on. Just visible to the eye under an excellent dark sky. About 2.7 million light years away.',
  },
  42: {
    zh: '猎户座腰带下「宝剑」中间那团雾，肉眼可见。离我们最近的大片恒星诞生区，中心有四颗年轻亮星组成的「猎户四边形」。距离约 1340 光年。',
    en: 'The haze in the middle of Orion’s sword, below his belt, visible to the eye. The nearest large stellar nursery, lit by four young stars at its heart, the Trapezium. About 1,340 light years away.',
  },
  44: {
    zh: '巨蟹座中心的疏散星团，中国古称「积尸气」，属鬼宿。暗夜里肉眼看是一团微光，双筒望远镜里是几十颗星。距离约 580 光年。',
    en: 'The open cluster at the heart of Cancer, called 积尸气 in old China, in the mansion 鬼宿. A faint glow to the eye on a dark night, dozens of stars in binoculars. About 580 light years away.',
  },
  45: {
    zh: '昴星团，昴宿，俗称「七姐妹星团」。肉眼可见六七颗，实有上千颗年轻的蓝白色恒星，周围还有反射星光的尘埃。距离约 440 光年。',
    en: 'The Pleiades, the mansion 昴宿, the "Seven Sisters". Six or seven stars to the eye, but over a thousand young blue-white stars, in dust that reflects their light. About 440 light years away.',
  },
  51: {
    zh: '第一个被看出旋涡结构的星系（1845 年），正和身边的小星系互相拉扯。距离约 2300 万光年。',
    en: 'The first galaxy seen to be a spiral (in 1845), pulling at the small galaxy beside it. About 23 million light years away.',
  },
  57: {
    zh: '天琴座里一个发光的气体环，是垂死恒星抛出的外层。小望远镜里像一个烟圈。距离约 2600 光年。',
    en: 'A glowing ring of gas in Lyra, the outer layers a dying star threw off. A smoke ring in a small telescope. About 2,600 light years away.',
  },
  81: {
    zh: '大熊座里明亮的旋涡星系，和近旁的 M82 一起在双筒望远镜里可见。距离约 1200 万光年。',
    en: 'A bright spiral galaxy in Ursa Major, visible in binoculars with M82 beside it. About 12 million light years away.',
  },
  82: {
    zh: '侧对我们的星暴星系：与 M81 擦肩而过后，正以银河系十倍的速度形成恒星。距离约 1200 万光年。',
    en: 'A starburst galaxy seen edge-on: after a close pass by M81 it is forming stars ten times as fast as the Milky Way. About 12 million light years away.',
  },
  87: {
    zh: '室女座星系团中心的巨椭圆星系，2019 年人类拍下的第一张黑洞照片就是它中心的黑洞，质量是太阳的 65 亿倍。距离约 5500 万光年。',
    en: 'The giant elliptical galaxy at the heart of the Virgo Cluster. Its central black hole, 6.5 billion times the Sun’s mass, was the first ever imaged, in 2019. About 55 million light years away.',
  },
  101: {
    zh: '大熊座里正面朝向我们的大旋涡星系，比银河系大近一倍。距离约 2100 万光年。',
    en: 'A great face-on spiral in Ursa Major, nearly twice the size of the Milky Way. About 21 million light years away.',
  },
  104: {
    zh: '几乎侧对我们的星系，一道暗尘带横穿明亮的核球，像一顶宽边草帽。距离约 3000 万光年。',
    en: 'A galaxy seen almost edge-on, a dark lane of dust across its bright bulge like the brim of a hat. About 30 million light years away.',
  },
}

export interface MessierView {
  m: Messier
  az: number
  alt: number
  /** A point half a degree along its long axis, to turn its mark that way on the map */
  axis: { az: number; alt: number } | null
}

/** Where each object stands in the sky at a moment, on the half of the sky shown */
export function messierAt(utc: Date, latitude: number, longitude: number, below = false): MessierView[] {
  const toHorizon = horizonOf(utc, latitude, longitude)
  const out: MessierView[] = []
  for (const m of MESSIER) {
    const p = toHorizon(m.ra, m.dec)
    if (p.alt < 0 !== below) continue
    let axis = null
    if (m.pa !== null) {
      const pa = (m.pa * Math.PI) / 180
      axis = toHorizon(
        m.ra + (0.5 * Math.sin(pa)) / Math.max(0.05, Math.cos((m.dec * Math.PI) / 180)),
        m.dec + 0.5 * Math.cos(pa),
      )
    }
    out.push({ m, ...p, axis })
  }
  return out
}
