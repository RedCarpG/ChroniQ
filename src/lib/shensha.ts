// 四柱神煞. Rules follow the common 《三命通会》/《渊海子平》 tables used by most
// 排盘 software. Where schools differ the choice comes from SchoolSettings and
// the resulting star carries that setting's key, so the UI can flag it.
import { DEFAULT_SCHOOLS, type SchoolKey, type SchoolSettings } from './schools'

export interface PillarGanzhi {
  stem: string
  branch: string
}

export interface ShenSha {
  name: string
  /** The 流派 setting this result depends on, if any */
  school?: SchoolKey
}

const STEMS = '甲乙丙丁戊己庚辛壬癸'
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'

const bi = (b: string) => BRANCHES.indexOf(b)
const branchAt = (i: number) => BRANCHES[((i % 12) + 12) % 12]

/** Map indexed by 天干 order 甲…癸; each entry lists target branches. */
type StemTable = string[]
const byStem = (table: StemTable, stem: string) => table[STEMS.indexOf(stem)] ?? ''

// 甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，六辛逢马虎
const TIAN_YI: StemTable = ['丑未', '子申', '亥酉', '亥酉', '丑未', '子申', '丑未', '寅午', '卯巳', '卯巳']
// 甲戊兼牛羊 … 庚辛逢马虎
const TIAN_YI_GENG_TIGER_HORSE: StemTable = TIAN_YI.map((t, i) => (i === 6 ? '寅午' : t))
const TAI_JI: StemTable = ['子午', '子午', '卯酉', '卯酉', '辰戌丑未', '辰戌丑未', '寅亥', '寅亥', '巳申', '巳申']
const WEN_CHANG: StemTable = ['巳', '午', '申', '酉', '申', '酉', '亥', '子', '寅', '卯']
const GUO_YIN: StemTable = ['戌', '亥', '丑', '寅', '丑', '寅', '辰', '巳', '未', '申']
const LU: StemTable = ['寅', '卯', '巳', '午', '巳', '午', '申', '酉', '亥', '子']
// 阳干羊刃取禄前一位；阴干三说: 顺排(禄后一位)、逆排(禄前一位)、无刃
const YANG_REN: Record<SchoolSettings['yangRen'], StemTable> = {
  forward: ['卯', '辰', '午', '未', '午', '未', '酉', '戌', '子', '丑'],
  backward: ['卯', '寅', '午', '巳', '午', '巳', '酉', '申', '子', '亥'],
  yangOnly: ['卯', '', '午', '', '午', '', '酉', '', '子', ''],
}
const HONG_YAN: StemTable = ['午', '午', '寅', '未', '辰', '辰', '戌', '酉', '子', '申']
const JIN_YU: StemTable = ['辰', '巳', '未', '申', '未', '申', '戌', '亥', '丑', '寅']

// 三合局 keyed by any member branch → [将星, 驿马, 桃花, 华盖, 劫煞, 亡神, 灾煞]
const SAN_HE: Record<string, string> = {
  申: '水', 子: '水', 辰: '水',
  寅: '火', 午: '火', 戌: '火',
  巳: '金', 酉: '金', 丑: '金',
  亥: '木', 卯: '木', 未: '木',
}
const SAN_HE_STARS: Record<string, Record<string, string>> = {
  水: { 将星: '子', 驿马: '寅', 桃花: '酉', 华盖: '辰', 劫煞: '巳', 亡神: '亥', 灾煞: '午' },
  火: { 将星: '午', 驿马: '申', 桃花: '卯', 华盖: '戌', 劫煞: '亥', 亡神: '巳', 灾煞: '子' },
  金: { 将星: '酉', 驿马: '亥', 桃花: '午', 华盖: '丑', 劫煞: '寅', 亡神: '申', 灾煞: '卯' },
  木: { 将星: '卯', 驿马: '巳', 桃花: '子', 华盖: '未', 劫煞: '申', 亡神: '寅', 灾煞: '酉' },
}

// 天德 by 月支 (寅…丑 order handled via lookup)
const TIAN_DE: Record<string, string> = {
  寅: '丁', 卯: '申', 辰: '壬', 巳: '辛', 午: '亥', 未: '甲',
  申: '癸', 酉: '寅', 戌: '丙', 亥: '乙', 子: '巳', 丑: '庚',
}
const YUE_DE: Record<string, string> = { 水: '壬', 火: '丙', 金: '庚', 木: '甲' }

const STEM_COMBINE: Record<string, string> = { 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' }
const BRANCH_COMBINE: Record<string, string> = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' }
const combineOf = (x: string) => STEM_COMBINE[x] ?? BRANCH_COMBINE[x]

// 孤辰寡宿 by 年支 所在三会方
const GU_GUA: Record<string, [string, string]> = {
  亥: ['寅', '戌'], 子: ['寅', '戌'], 丑: ['寅', '戌'],
  寅: ['巳', '丑'], 卯: ['巳', '丑'], 辰: ['巳', '丑'],
  巳: ['申', '辰'], 午: ['申', '辰'], 未: ['申', '辰'],
  申: ['亥', '未'], 酉: ['亥', '未'], 戌: ['亥', '未'],
}

// 日柱专属
const DAY_PILLAR_STARS: Record<string, string[]> = {
  魁罡: ['庚辰', '庚戌', '壬辰', '戊戌'],
  阴差阳错: ['丙子', '丁丑', '戊寅', '辛卯', '壬辰', '癸巳', '丙午', '丁未', '戊申', '辛酉', '壬戌', '癸亥'],
  十恶大败: ['甲辰', '乙巳', '丙申', '丁亥', '戊戌', '己丑', '庚辰', '辛巳', '壬申', '癸亥'],
  孤鸾煞: ['乙巳', '丁巳', '辛亥', '戊申', '甲寅', '壬子', '丙午', '戊午'],
  十灵日: ['甲辰', '乙亥', '丙辰', '丁酉', '戊午', '庚戌', '庚寅', '辛亥', '壬寅', '癸未'],
}
const JIN_SHEN = ['乙丑', '己巳', '癸酉']
// 天赦: 春戊寅 夏甲午 秋戊申 冬甲子 (by 月支)
const TIAN_SHE: Record<string, string> = {
  寅: '戊寅', 卯: '戊寅', 辰: '戊寅', 巳: '甲午', 午: '甲午', 未: '甲午',
  申: '戊申', 酉: '戊申', 戌: '戊申', 亥: '甲子', 子: '甲子', 丑: '甲子',
}

/**
 * 神煞 for each of the four pillars (年月日时 order).
 * Branch-referenced stars (驿马, 桃花 …) skip the reference pillar itself, so
 * e.g. a 子 year never marks itself 将星.
 */
export function computeShenSha(
  pillars: PillarGanzhi[],
  schools: SchoolSettings = DEFAULT_SCHOOLS,
  /** Extra pillars (大运, 流年 …) checked against the natal chart; results follow the natal ones. */
  extras: PillarGanzhi[] = [],
): ShenSha[][] {
  const [year, month, day] = pillars
  // Indices 0–3 are the natal pillars; 4+ are extras, which never match the
  // 日柱/时柱-only rules or the reference-pillar skip.
  const all = [...pillars, ...extras]
  const result = all.map(() => new Map<string, ShenSha>())
  const tianYi = schools.tianYi === 'gengTigerHorse' ? TIAN_YI_GENG_TIGER_HORSE : TIAN_YI
  const stemRefs = schools.stemRef === 'dayOnly' ? [day.stem] : [day.stem, year.stem]
  const branchRefs = (
    [
      [0, year.branch],
      [2, day.branch],
    ] as const
  ).filter(([i]) => schools.branchRef === 'yearAndDay' || (schools.branchRef === 'yearOnly' ? i === 0 : i === 2))

  all.forEach((p, i) => {
    const add = (name: string, school?: SchoolKey) => {
      // Keep the most specific school note when two rules yield the same star.
      if (!result[i].get(name)?.school) result[i].set(name, { name, school })
    }
    const has = (targets: string, x = p.branch) => targets.includes(x)

    // 以日干（及年干）查地支
    stemRefs.forEach((ref, refIndex) => {
      // Stars found via 年干 depend on the 查法 setting; via 日干 they always apply.
      const via: SchoolKey | undefined = refIndex === 1 ? 'stemRef' : undefined
      if (has(byStem(tianYi, ref))) add('天乙贵人', ref === '庚' ? 'tianYi' : via)
      if (has(byStem(TAI_JI, ref))) add('太极贵人', via)
      if (has(byStem(WEN_CHANG, ref))) add('文昌贵人', via)
      if (has(byStem(GUO_YIN, ref))) add('国印贵人', via)
    })
    // 以日干查地支
    if (has(byStem(LU, day.stem))) add('禄神')
    const yinStem = STEMS.indexOf(day.stem) % 2 === 1
    if (has(byStem(YANG_REN[schools.yangRen], day.stem))) add('羊刃', yinStem ? 'yangRen' : undefined)
    if (has(byStem(HONG_YAN, day.stem))) add('红艳煞')
    if (has(byStem(JIN_YU, day.stem))) add('金舆')

    // 以月支查天德、月德及其合
    const tianDe = TIAN_DE[month.branch]
    const yueDe = YUE_DE[SAN_HE[month.branch]]
    if (p.stem === tianDe || p.branch === tianDe) add('天德贵人')
    if (p.stem === combineOf(tianDe) || p.branch === combineOf(tianDe)) add('天德合')
    if (p.stem === yueDe) add('月德贵人')
    if (p.stem === STEM_COMBINE[yueDe]) add('月德合')
    // 天医: 月支前一位
    if (i !== 1 && p.branch === branchAt(bi(month.branch) - 1)) add('天医')

    // 以年支、日支查三合系神煞
    for (const [refIndex, ref] of branchRefs) {
      if (refIndex === i) continue
      const stars = SAN_HE_STARS[SAN_HE[ref]]
      for (const [name, target] of Object.entries(stars)) if (p.branch === target) add(name, 'branchRef')
    }

    // 以年支查
    if (i !== 0) {
      const [gu, gua] = GU_GUA[year.branch]
      if (p.branch === gu) add('孤辰')
      if (p.branch === gua) add('寡宿')
      const hongLuan = branchAt(3 - bi(year.branch))
      if (p.branch === hongLuan) add('红鸾')
      if (p.branch === branchAt(bi(hongLuan) + 6)) add('天喜')
      if (p.branch === branchAt(bi(year.branch) + 2)) add('丧门')
      if (p.branch === branchAt(bi(year.branch) - 2)) add('吊客')
    }

    const gz = p.stem + p.branch
    if (i === 2) {
      for (const [name, list] of Object.entries(DAY_PILLAR_STARS)) if (list.includes(gz)) add(name)
      if (TIAN_SHE[month.branch] === gz) add('天赦')
    }
    // 时柱 is index 3 only when the chart has one (a birth with its hour unknown has three pillars)
    if ((i === 2 || (i === 3 && i < pillars.length)) && JIN_SHEN.includes(gz)) add('金神')
  })

  return result.map((m) => [...m.values()])
}
