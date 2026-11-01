// 白话解读: a 八字 read out in plain words, by fixed rules from the chart itself. Structured, so the page
// words it in either language. It says what the chart shows in the common traditional terms and
// makes no forecast. Schools differ on most of this, 身强身弱 above all, and the page says so.
import type { BaziChart, ElementName, Glyph } from './bazi'

/** The ten 日主, each with its common image */
export const DAY_MASTER_IMAGE: Record<string, string> = {
  甲: '如参天大树：挺直、有主见，向上生长',
  乙: '如花草藤蔓：柔韧、善于适应和迂回',
  丙: '如太阳：热情、外放，照亮身边的人',
  丁: '如烛火：细腻、内敛，专注而持久',
  戊: '如高山厚土：稳重、可靠，能包容',
  己: '如田园之土：务实、细致，善于滋养他人',
  庚: '如刀剑顽铁：果断、讲原则，经得起锤炼',
  辛: '如珠玉：精致、敏锐，重品质与体面',
  壬: '如江河大海：开阔、灵活，闲不住',
  癸: '如雨露：安静、敏感，善于体察',
}

/** What a day's or a decade's 十神 is about (the same words on 今日) */
export const TEN_STAR_NOTE: Record<string, string> = {
  比肩: '同辈与自主：适合独立做事、与朋友同行',
  劫财: '竞争与花费：留意开销，合作先说清楚',
  食神: '表达与享受：适合创作、聚餐、放松',
  伤官: '才华与锋芒：灵感多，说话留些余地',
  偏财: '机会与人脉：适合社交、捕捉意外之喜',
  正财: '踏实与收入：适合理财、处理实务',
  七杀: '压力与挑战：适合攻坚，也要照顾好自己',
  正官: '规则与责任：适合正式事务、面对上级',
  偏印: '思考与独处：适合钻研，不必急着决定',
  正印: '学习与支持：适合读书、向长辈请教',
}

export type TenStarGroup = '比劫' | '食伤' | '财星' | '官杀' | '印星'
const GROUP_OF: Record<string, TenStarGroup> = {
  比肩: '比劫',
  劫财: '比劫',
  食神: '食伤',
  伤官: '食伤',
  偏财: '财星',
  正财: '财星',
  七杀: '官杀',
  正官: '官杀',
  偏印: '印星',
  正印: '印星',
}
/** What a chart with much of a group is said to lean towards */
export const GROUP_NOTE: Record<TenStarGroup, string> = {
  比劫: '自我与同伴的分量重：重独立，也重朋友',
  食伤: '表达与创造的分量重：想法多，爱把想法说出来、做出来',
  财星: '现实与经营的分量重：看重成果，也善于打理资源',
  官杀: '规则与压力的分量重：责任心强，也容易对自己要求高',
  印星: '学习与思考的分量重：爱琢磨，也需要被理解和支持',
}

const GENERATES: Record<ElementName, ElementName> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }

export type Tendency = 'strong' | 'weak' | 'balanced'

/** Where the 日主 has a root: a 藏干 of its own element in a 地支 */
export interface BaziRoot {
  pillar: string
  stem: string
  qi: '本气' | '中气' | '余气'
}
const QI: BaziRoot['qi'][] = ['本气', '中气', '余气']
/** What a root adds to the count. A 本气 root is already there, as its 地支 counts by its 本气 */
const ROOT_WEIGHT: Record<BaziRoot['qi'], number> = { 本气: 0, 中气: 1, 余气: 0.5 }

export interface BaziReading {
  dayMaster: Glyph
  /** Elements by count, most first, and those with none among the eight characters */
  most: { element: ElementName; count: number }[]
  missing: ElementName[]
  /** Whether the month, the season of birth, helps the 日主 */
  inSeason: boolean
  monthElement: ElementName
  roots: BaziRoot[]
  /** Helping and draining weights, and which way they lean */
  support: number
  drain: number
  tendency: Tendency
  /** The 十神 groups with the most weight, heaviest first */
  groups: { group: TenStarGroup; count: number }[]
  /** The 大运 running in the given year, with the 十神 of its 天干 */
  decade?: { ganzhi: string; tenStar?: string; from: number; to: number }
}

/** The 日主's own element and the one that generates it */
const helps = (me: ElementName, other: ElementName) => other === me || GENERATES[other] === me

export function baziReading(chart: BaziChart, year: number): BaziReading {
  const me = chart.dayMaster.element
  const counts = Object.entries(chart.elementCount) as [ElementName, number][]
  const top = Math.max(...counts.map(([, n]) => n))
  const monthElement = chart.pillars[1].branch.element

  // A rough count of the usual kind: the other seven characters, with the month's 地支 counting
  // three times over as the season, and the 日主's roots in the 中气 and 余气 added. 地支 by their
  // 本气 (the first 藏干), for its 十神.
  let support = 0
  let drain = 0
  const count = (element: ElementName, weight: number) => {
    if (helps(me, element)) support += weight
    else drain += weight
  }
  const groups = new Map<TenStarGroup, number>()
  const addStar = (star?: string) => {
    const group = star && GROUP_OF[star]
    if (group) groups.set(group, (groups.get(group) ?? 0) + 1)
  }
  chart.pillars.forEach((p, i) => {
    if (i !== 2) {
      count(p.stem.element, 1)
      addStar(p.stem.tenStar)
    }
    count(p.branch.element, i === 1 ? 3 : 1)
    addStar(p.hidden[0]?.tenStar)
  })

  const roots: BaziRoot[] = chart.pillars.flatMap((p) =>
    p.hidden.flatMap((h, i) => (h.element === me ? [{ pillar: p.label, stem: h.char, qi: QI[i] ?? '余气' }] : [])),
  )
  for (const root of roots) support += ROOT_WEIGHT[root.qi]

  const decade = chart.decades.find((d) => d.startYear <= year && year <= d.endYear)
  const lead = support - drain
  return {
    dayMaster: chart.dayMaster,
    most: counts.filter(([, n]) => n === top).map(([element, n]) => ({ element, count: n })),
    missing: counts.filter(([, n]) => n === 0).map(([element]) => element),
    inSeason: helps(me, monthElement),
    monthElement,
    roots,
    support,
    drain,
    tendency: lead >= 2 ? 'strong' : lead <= -2 ? 'weak' : 'balanced',
    groups: [...groups].map(([group, n]) => ({ group, count: n })).sort((a, b) => b.count - a.count).slice(0, 2),
    decade: decade && { ganzhi: decade.ganzhi, tenStar: decade.stem.tenStar, from: decade.startYear, to: decade.endYear },
  }
}
