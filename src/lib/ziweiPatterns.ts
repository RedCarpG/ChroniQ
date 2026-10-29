// 紫微斗数格局: the classic patterns a chart's 命宫 forms with its 三方四正 and the
// palaces either side of it (夹宫), by the common definitions of 《紫微斗数全书》 and
// 《骨髓赋》. Each pattern says what makes it in this chart, what strengthens it and
// what breaks it (破格), from what the board shows: the stars in the palaces, their
// 庙旺 and the 生年四化. The list of patterns and the idea of the three tiers follow
// Renhuai123/ziwei-doushu (lib/ziwei/patterns.ts, MIT); the definitions are checked
// against the classics and the wording is our own. A short orientation, not a reading.
import type { ZiweiChart, ZiweiPalace } from './ziwei'

export interface ZiweiPattern {
  name: string
  /** good 吉格, bad 凶格, or neutral: a structure to know rather than a fortune */
  kind: 'good' | 'bad' | 'neutral'
  /** What makes it, as met in this chart */
  rule: string
  /** What the classics say of it */
  verse?: string
  /** What it is taken to mean */
  meaning: string
  /** What strengthens it in this chart */
  plus: string[]
  /** What breaks or weakens it in this chart (破格) */
  minus: string[]
  /** 地支 of the palaces it is made of, to pick out on the board */
  palaces: string[]
}

const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'
const step = (b: string, n: number) => BRANCHES[(BRANCHES.indexOf(b) + n + 120) % 12]
const SHA = ['擎羊', '陀罗', '火星', '铃星']
const KONGJIE = ['地空', '地劫']
const BRIGHT = '庙旺得'
const DIM = '陷不'

/** The stars that count for patterns: 主星 and 辅星 (the 杂曜 do not) */
const starsOf = (p: ZiweiPalace) => [...p.major, ...p.minor]
const has = (p: ZiweiPalace, name: string) => starsOf(p).some((s) => s.name === name)
const starIn = (p: ZiweiPalace, name: string) => starsOf(p).find((s) => s.name === name)
/** A star of the palace with this 生年四化 (禄 权 科 忌), if any */
const mutated = (p: ZiweiPalace, m: string) => starsOf(p).find((s) => s.mutagen === m)
const isBright = (p: ZiweiPalace, name: string) => BRIGHT.includes(starIn(p, name)?.brightness ?? '-')
const isDim = (p: ZiweiPalace, name: string) => DIM.includes(starIn(p, name)?.brightness ?? '-')
const names = (list: ZiweiPalace[]) => [...new Set(list.map((p) => p.name))].join('、')

/** Finds the patterns of a chart, 吉格 first, then 凶格, then the structures */
export function findPatterns(chart: ZiweiChart): ZiweiPattern[] {
  const palace = (b: string) => chart.palaces[b]
  const ming = Object.values(chart.palaces).find((p) => p.isSoul)!
  const m = ming.branch
  const opposite = palace(step(m, 6))
  const trines = [palace(step(m, 4)), palace(step(m, 8))]
  /** 命宫's 三方四正: itself, the two 三合 palaces and the one opposite */
  const sf = [ming, ...trines, opposite]
  /** The palaces either side of 命宫 */
  const jia = [palace(step(m, -1)), palace(step(m, 1))]
  const where = (name: string) => Object.values(chart.palaces).find((p) => has(p, name))
  const inSf = (name: string) => sf.find((p) => has(p, name))
  const mutatedSf = (mu: string) => sf.find((p) => mutated(p, mu))
  /** Two stars, one in each palace either side of 命宫 */
  const flanked = (a: string, b: string) => (has(jia[0], a) && has(jia[1], b)) || (has(jia[0], b) && has(jia[1], a))
  const majors = ming.major.map((s) => s.name)
  const sits = (name: string) => majors.includes(name)

  /** What spoils a good pattern in its palaces: a 化忌, 地空地劫, two or more of the 四煞 */
  const spoilers = (ps: ZiweiPalace[]) => {
    const out: string[] = []
    const ji = ps.map((p) => mutated(p, '忌')).find(Boolean)
    if (ji) out.push(`${ji.name}化忌`)
    const kj = KONGJIE.filter((n) => ps.some((p) => has(p, n)))
    if (kj.length) out.push(`逢${kj.join('、')}`)
    const sha = SHA.filter((n) => ps.some((p) => has(p, n)))
    if (sha.length >= 2) out.push(`会${sha.join('、')}`)
    return out
  }
  /** The good stars that add to a pattern when they meet 命宫's 三方四正 */
  const helpers = (pairs: [string, string, string][]) =>
    pairs.flatMap(([a, b, label]) => (inSf(a) || inSf(b) ? [`会${label}`] : []))

  const found: ZiweiPattern[] = []
  const add = (p: Omit<ZiweiPattern, 'palaces'> & { palaces: (ZiweiPalace | undefined)[] }) =>
    found.push({ ...p, palaces: [...new Set(p.palaces.filter((x): x is ZiweiPalace => !!x).map((x) => x.branch))] })

  // ---- 吉格 ----
  if (sits('紫微') && sits('天府')) {
    add({
      name: '紫府同宫',
      kind: 'good',
      rule: `紫微、天府同坐命宫（${m}）`,
      verse: '紫府同宫，终身福厚',
      meaning: '帝星与库星同守命宫，主稳重有度量，一生衣食丰足；喜左辅右弼、天魁天钺来会。',
      plus: helpers([
        ['左辅', '右弼', '左辅右弼'],
        ['天魁', '天钺', '魁钺'],
        ['禄存', '禄存', '禄存'],
      ]),
      minus: spoilers([ming]),
      palaces: [ming],
    })
  }
  if (sits('紫微') && ((inSf('左辅') && inSf('右弼')) || flanked('左辅', '右弼'))) {
    add({
      name: '君臣庆会',
      kind: 'good',
      rule: `紫微坐命，左辅、右弼${flanked('左辅', '右弼') ? '夹命' : '会入三方四正'}`,
      verse: '君臣庆会，才擅经邦',
      meaning: '紫微为君、辅弼为臣，君臣相得：主有统筹领导之才，又得人辅助。紫微无辅弼则成孤君。',
      plus: [
        ...helpers([
          ['文昌', '文曲', '昌曲'],
          ['天魁', '天钺', '魁钺'],
        ]),
        ...(['权', '科'].includes(starIn(ming, '紫微')?.mutagen ?? '')
          ? [`紫微化${starIn(ming, '紫微')!.mutagen}`]
          : []),
      ],
      minus: spoilers([ming]),
      palaces: [ming, where('左辅'), where('右弼')],
    })
  }
  const fu = where('天府')
  const xiang = where('天相')
  if (fu && xiang && fu !== xiang && trines.includes(fu) && trines.includes(xiang)) {
    add({
      name: '府相朝垣',
      kind: 'good',
      rule: `天府、天相分居命宫的三合宫（${fu.name}、${xiang.name}）来朝`,
      verse: '府相朝垣，千钟食禄',
      meaning: '财库与印星从两个三合宫来朝命宫，主衣食丰足、处事稳当，宜在机构中担当要职。',
      plus: helpers([
        ['禄存', '禄存', '禄存'],
        ['左辅', '右弼', '辅弼'],
      ]).concat(mutatedSf('禄') ? ['会化禄'] : []),
      minus: [...spoilers([ming]), ...(KONGJIE.some((n) => has(fu, n)) ? ['天府逢空劫（空库）'] : [])],
      palaces: [ming, fu, xiang],
    })
  }
  const jiyue = ['天机', '太阴', '天同', '天梁']
  if (jiyue.every(inSf)) {
    add({
      name: '机月同梁',
      kind: 'good',
      rule: '天机、太阴、天同、天梁四星齐会命宫三方四正',
      verse: '机月同梁作吏人',
      meaning: '四星齐会，性情温和、心思细密，宜在机关、学校、医疗等稳定的机构中凭专业与资历累积，不宜大起大落的投机。',
      plus: helpers([['文昌', '文曲', '昌曲']]).concat(mutatedSf('科') ? ['会化科'] : []),
      minus: spoilers(sf).filter((s) => !s.startsWith('逢')),
      palaces: sf.filter((p) => jiyue.some((n) => has(p, n))),
    })
  }
  const lu = inSf('禄存') ?? mutatedSf('禄')
  if (inSf('太阳') && inSf('天梁') && inSf('文昌') && lu) {
    const sun = inSf('太阳')!
    add({
      name: '阳梁昌禄',
      kind: 'good',
      rule: `太阳、天梁、文昌与${inSf('禄存') ? '禄存' : '化禄'}齐会命宫三方四正`,
      verse: '阳梁昌禄，胪传第一名',
      meaning: '主读书考试运佳，利功名、学术与专业资格，宜走考试与学问之路。',
      plus: [...(isBright(sun, '太阳') ? ['太阳庙旺'] : []), ...(mutatedSf('科') ? ['会化科'] : [])],
      minus: [...(isDim(sun, '太阳') ? ['太阳落陷，阳梁失辉'] : []), ...spoilers([ming])],
      palaces: [sun, inSf('天梁'), inSf('文昌'), lu],
    })
  }
  const sunMoonAt = (name: string, branch: string, title: string, verse: string | undefined, meaning: string) => {
    if (m !== branch || !sits(name)) return
    const mu = starIn(ming, name)!.mutagen
    add({
      name: title,
      kind: 'good',
      rule: `${name}在${branch}宫坐命`,
      verse,
      meaning,
      plus: mu && mu !== '忌' ? [`${name}化${mu}`] : [],
      minus: spoilers([ming]),
      palaces: [ming],
    })
  }
  sunMoonAt('太阳', '卯', '日照雷门', '日照雷门，富贵荣华', '太阳在卯，旭日东升，主光明磊落、积极进取，名声早显。')
  sunMoonAt(
    '太阳',
    '午',
    '日丽中天',
    '太阳居午，谓之日丽中天，有专权之贵',
    '太阳在午，日正当中、光辉最盛，主有魄力与名望，宜任公众与管理之职；也须防锋芒太露。',
  )
  sunMoonAt('太阴', '亥', '月朗天门', '月朗天门，进爵封侯', '太阴在亥，月入天门，主温和清秀、心思细腻，利财富与田宅。')
  sunMoonAt('太阴', '子', '月生沧海', undefined, '太阴在子，月映沧海，主清雅聪慧、富于才情。')
  if (sits('太阳') && sits('太阴')) {
    add({
      name: '日月同宫',
      kind: 'neutral',
      rule: `太阳、太阴同坐命宫（${m}）`,
      verse: '日月守命，不如照合并明',
      meaning: '日月同守命宫，阴阳兼备，但在丑未一明一暗，力量不如日月从三方照合；主性情多面、一生起伏。',
      plus: [],
      minus: spoilers([ming]),
      palaces: [ming],
    })
  }
  if (flanked('太阳', '太阴')) {
    const sun = jia.find((p) => has(p, '太阳'))!
    const moon = jia.find((p) => has(p, '太阴'))!
    add({
      name: '日月夹命',
      kind: 'good',
      rule: '太阳、太阴分居命宫两侧来夹',
      verse: '日月夹命，不权则富',
      meaning: '日月分居命宫两侧，得光明照耀，主得贵人提携；日月庙旺才是真夹。',
      plus: [...(isBright(sun, '太阳') ? ['太阳庙旺'] : []), ...(isBright(moon, '太阴') ? ['太阴庙旺'] : [])],
      minus: [
        ...(isDim(sun, '太阳') ? ['太阳落陷'] : []),
        ...(isDim(moon, '太阴') ? ['太阴落陷'] : []),
        ...spoilers([ming]),
      ],
      palaces: [ming, sun, moon],
    })
  }
  if (m === '未' && !majors.length && has(palace('卯'), '太阳') && has(palace('亥'), '太阴')) {
    add({
      name: '明珠出海',
      kind: 'good',
      rule: '命宫在未、无主星，太阳在卯、太阴在亥从三合拱照',
      verse: '明珠出海，财官双美',
      meaning: '命宫借三方的日月：太阳在卯、太阴在亥皆得地，从两个三合宫拱照，主才华外显、财官双美。',
      plus: helpers([
        ['文昌', '文曲', '昌曲'],
        ['左辅', '右弼', '辅弼'],
      ]),
      minus: spoilers([ming]),
      palaces: [ming, palace('卯'), palace('亥')],
    })
  }
  if ((m === '子' || m === '午') && sits('巨门')) {
    const mu = starIn(ming, '巨门')!.mutagen
    add({
      name: '石中隐玉',
      kind: 'good',
      rule: `巨门在${m}宫坐命`,
      verse: '巨门子午科权禄，石中隐玉福兴隆',
      meaning: '巨门在子午坐命，如玉藏石中：才学深藏，早年未必得志，中年后凭口才与专业显达；喜化禄、化权、化科。',
      plus: mu && mu !== '忌' ? [`巨门化${mu}`] : [],
      minus: [...(mu === '忌' ? ['巨门化忌'] : []), ...spoilers([ming]).filter((s) => s !== '巨门化忌')],
      palaces: [ming],
    })
  }
  if (sits('七杀') && '寅申子午'.includes(m)) {
    const chao = '寅申'.includes(m)
    add({
      name: chao ? '七杀朝斗' : '七杀仰斗',
      kind: 'good',
      rule: `七杀在${m}宫坐命，对宫${names([opposite])}有${opposite.major.map((s) => s.name).join('、')}相照`,
      verse: chao ? '七杀朝斗，爵禄荣昌' : undefined,
      meaning: chao
        ? '七杀坐命寅申，与对宫紫微天府相朝，主有魄力担当，能开创立业、掌握权柄。'
        : '七杀坐命子午，对宫紫微相照，主刚毅果决，奋发而有成。',
      plus: helpers([
        ['左辅', '右弼', '辅弼'],
        ['天魁', '天钺', '魁钺'],
      ]),
      minus: spoilers([ming]),
      palaces: [ming, opposite],
    })
  }
  if (sits('破军') && (m === '子' || m === '午')) {
    add({
      name: '英星入庙',
      kind: 'good',
      rule: `破军在${m}宫入庙坐命`,
      meaning: '破军在子午入庙，主开创力强、敢作敢为，能在变动中建功；忌见煞忌。',
      plus: ['禄', '权'].includes(starIn(ming, '破军')!.mutagen ?? '')
        ? [`破军化${starIn(ming, '破军')!.mutagen}`]
        : [],
      minus: spoilers([ming]),
      palaces: [ming],
    })
  }
  if (sits('武曲') && sits('贪狼')) {
    add({
      name: '武贪同行',
      kind: 'good',
      rule: `武曲、贪狼同坐命宫（${m}）`,
      verse: '武贪不发少年人',
      meaning: '财星武曲与贪狼同守，主经营理财之才，大器晚成，三十岁后方渐发达。',
      plus: [
        ...(['火星', '铃星'].some((n) => has(ming, n)) ? ['再见火铃'] : []),
        ...(['禄', '权'].includes(starIn(ming, '武曲')!.mutagen ?? '')
          ? [`武曲化${starIn(ming, '武曲')!.mutagen}`]
          : []),
      ],
      minus: spoilers([ming]),
      palaces: [ming],
    })
  }
  const tan = where('贪狼')
  for (const [fire, title, verse] of [
    ['火星', '火贪格', '贪狼火星居庙旺，名镇诸邦'],
    ['铃星', '铃贪格', undefined],
  ] as const) {
    if (!tan || !has(tan, fire) || !sf.includes(tan)) continue
    add({
      name: title,
      kind: 'good',
      rule: `贪狼与${fire}同宫（${tan.name}），在命宫三方四正`,
      verse,
      meaning: `贪狼遇${fire}，主突发之机与横财，来得快也去得快，宜见好就收。`,
      plus: [
        ...(isBright(tan, '贪狼') ? ['贪狼庙旺'] : []),
        ...(['禄', '权'].includes(starIn(tan, '贪狼')!.mutagen ?? '') ? [`贪狼化${starIn(tan, '贪狼')!.mutagen}`] : []),
      ],
      minus: [
        ...(['擎羊', '陀罗'].some((n) => has(tan, n)) ? ['又见羊陀'] : []),
        ...(KONGJIE.some((n) => has(tan, n)) ? ['逢空劫，财来财去'] : []),
        ...(starIn(tan, '贪狼')!.mutagen === '忌' ? ['贪狼化忌'] : []),
      ],
      palaces: [ming, tan],
    })
  }
  const ma = where('天马')
  const luWithMa = ma && [ma, palace(step(ma.branch, 6))].find((p) => has(p, '禄存') || mutated(p, '禄'))
  if (ma && luWithMa && (sf.includes(ma) || sf.includes(luWithMa))) {
    const luName = has(luWithMa, '禄存') ? '禄存' : `${mutated(luWithMa, '禄')!.name}化禄`
    add({
      name: '禄马交驰',
      kind: 'good',
      rule: `${luName}与天马${luWithMa === ma ? `同宫（${ma.name}）` : `对拱（${luWithMa.name}、${ma.name}）`}，会入命宫三方四正`,
      verse: '禄马交驰，发财远郡',
      meaning: '禄与天马相逢，主在奔波变动、远行异地中求财得财。',
      plus: [],
      minus: [
        ...(KONGJIE.some((n) => has(ma, n) || has(luWithMa, n)) ? ['逢空劫'] : []),
        ...(mutated(ma, '忌') ? ['天马宫见化忌'] : []),
      ],
      palaces: [ming, ma, luWithMa],
    })
  }
  const luCun = inSf('禄存')
  const huaLu = mutatedSf('禄')
  if (luCun && huaLu) {
    add({
      name: '双禄朝垣',
      kind: 'good',
      rule: `禄存与化禄（${mutated(huaLu, '禄')!.name}）同会命宫三方四正`,
      meaning: '禄存与化禄相会，主财源充足、一生衣禄丰厚。',
      plus: [],
      minus: spoilers([ming]),
      palaces: [ming, luCun, huaLu],
    })
  }
  const qi = (['禄', '权', '科'] as const).map(mutatedSf)
  if (qi.every(Boolean)) {
    add({
      name: '三奇加会',
      kind: 'good',
      rule: `生年化禄、化权、化科都会入命宫三方四正（${qi.map((p, i) => `${mutated(p!, '禄权科'[i])!.name}化${'禄权科'[i]}`).join('、')}）`,
      verse: '科权禄拱，名誉昭彰',
      meaning: '禄、权、科三化齐会，主名利双收，机遇多而能把握。',
      plus: [],
      minus: mutatedSf('忌') ? [`${mutated(mutatedSf('忌')!, '忌')!.name}化忌也在三方四正`] : [],
      palaces: [ming, ...qi],
    })
  }
  const pairs: [string, string, string, string, string | undefined][] = [
    ['左辅', '右弼', '左右夹命', '左辅右弼分居命宫两侧来夹，主一生多得平辈与下属之助。', undefined],
    ['文昌', '文曲', '昌曲夹命', '文昌文曲夹命，主聪明好学、有文采，利考试与文书。', '昌曲夹命最为奇'],
    ['天魁', '天钺', '魁钺夹命', '天魁天钺夹命，主多遇贵人提携。', undefined],
  ]
  for (const [a, b, title, meaning, verse] of pairs) {
    if (!flanked(a, b)) continue
    add({
      name: title,
      kind: 'good',
      rule: `${a}、${b}分居命宫两侧来夹`,
      verse,
      meaning,
      plus: [],
      minus: spoilers([ming]),
      palaces: [ming, ...jia],
    })
  }
  if ((has(ming, '天魁') && has(opposite, '天钺')) || (has(ming, '天钺') && has(opposite, '天魁'))) {
    add({
      name: '坐贵向贵',
      kind: 'good',
      rule: `天魁、天钺一在命宫、一在对宫${opposite.name}`,
      meaning: '天乙贵人一坐一照，主在家出外都有贵人相助。',
      plus: [],
      minus: spoilers([ming]),
      palaces: [ming, opposite],
    })
  }
  if (sits('天相')) {
    const liang = jia.find((p) => has(p, '天梁'))
    const other = jia.find((p) => p !== liang)!
    const luSide = liang && (has(other, '禄存') || mutated(other, '禄'))
    if (luSide) {
      add({
        name: '财荫夹印',
        kind: 'good',
        rule: `天相坐命，一侧天梁（${liang.name}）、一侧${has(other, '禄存') ? '禄存' : '化禄'}（${other.name}）相夹`,
        meaning: '天相为印，左右得天梁之荫与禄星之财相夹，主得庇荫与财助，做事有依靠。',
        plus: [],
        minus: spoilers([ming]),
        palaces: [ming, ...jia],
      })
    }
  }

  // ---- 凶格 ----
  if (
    sits('天相') &&
    ((has(jia[0], '擎羊') && mutated(jia[1], '忌')) || (has(jia[1], '擎羊') && mutated(jia[0], '忌')))
  ) {
    add({
      name: '刑忌夹印',
      kind: 'bad',
      rule: '天相坐命，一侧擎羊、一侧化忌相夹',
      meaning: '天相之印被擎羊之刑与化忌夹制，主受人牵连、多是非与劳碌，宜谨守本分。',
      plus: [],
      minus: [],
      palaces: [ming, ...jia],
    })
  }
  const ji = mutated(ming, '忌')
  if (ji && flanked('擎羊', '陀罗')) {
    add({
      name: '羊陀夹忌',
      kind: 'bad',
      rule: `命宫${ji.name}化忌，擎羊、陀罗前后相夹`,
      verse: '羊陀夹忌为败局',
      meaning: '命宫化忌又被羊陀夹制，主做事多阻、易因小失大，宜稳守、少冒险。',
      plus: [],
      minus: [],
      palaces: [ming, ...jia],
    })
  }
  for (const [a, b, title, meaning] of [
    ['火星', '铃星', '火铃夹命', '火星铃星夹命，主性急易躁、易有突发的波折。'],
    ['地空', '地劫', '空劫夹命', '地空地劫夹命，主想法多变、钱财难聚，宜务实。'],
  ] as const) {
    if (!flanked(a, b)) continue
    add({
      name: title,
      kind: 'bad',
      rule: `${a}、${b}分居命宫两侧来夹`,
      verse: `${title}为败局`,
      meaning,
      plus: [],
      minus: [],
      palaces: [ming, ...jia],
    })
  }

  // ---- 结构 ----
  if (m === '午' && has(ming, '擎羊')) {
    add({
      name: '马头带箭',
      kind: 'neutral',
      rule: '擎羊在午宫坐命',
      verse: '马头带箭，镇卫边疆',
      meaning: '主刚强好胜，宜武职、竞争激烈或需冲劲的事业，能在逆境中立威；也须防刑伤。',
      plus: [],
      minus: [],
      palaces: [ming],
    })
  }
  if (['七杀', '破军', '贪狼'].some(sits)) {
    add({
      name: '杀破狼',
      kind: 'neutral',
      rule: `命宫坐${majors.filter((n) => ['七杀', '破军', '贪狼'].includes(n)).join('、')}，七杀、破军、贪狼会于三方四正`,
      meaning: '七杀、破军、贪狼总在三方相会，命逢其一即为杀破狼格局：一生变动多、敢闯敢拼，宜开创而不宜守成。',
      plus: [],
      minus: [],
      palaces: sf.filter((p) => ['七杀', '破军', '贪狼'].some((n) => has(p, n))),
    })
  }
  if (!majors.length) {
    add({
      name: '命无正曜',
      kind: 'neutral',
      rule: `命宫没有主星，借对宫${opposite.name}的${opposite.major.map((s) => s.name).join('、') || '星曜'}来看`,
      meaning: '命宫空宫，性格多受环境与他人影响，适应力强；看命以对宫主星为主，再参看本宫辅星。',
      plus: [],
      minus: [],
      palaces: [ming, opposite],
    })
  }

  const order = { good: 0, bad: 1, neutral: 2 }
  return found.sort((a, b) => order[a.kind] - order[b.kind])
}
