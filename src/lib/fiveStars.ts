// 五星: the five planets the eye can see, each named in old China for one of the 五行.
import type { ElementName } from './bazi'
import type { BodyKey } from './astrology'

export const FIVE_STARS: { key: BodyKey; name: string; west: string; element: ElementName }[] = [
  { key: 'jupiter', name: '岁星', west: '木星', element: '木' },
  { key: 'mars', name: '荧惑', west: '火星', element: '火' },
  { key: 'saturn', name: '镇星', west: '土星', element: '土' },
  { key: 'venus', name: '太白', west: '金星', element: '金' },
  { key: 'mercury', name: '辰星', west: '水星', element: '水' },
]
