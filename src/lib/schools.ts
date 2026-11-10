// 流派设置: every rule where 排盘 traditions disagree is listed here with its
// options and where each option comes from. The UI marks affected results with
// a "!" and links back to these notes. See docs/schools.md for details.

export interface SchoolSettings {
  /** 晚子时 (23:00–24:00) 日柱 */
  ziHour: 'nextDay' | 'sameDay'
  /** 起运时间算法 */
  childLimit: 'default' | 'sect1' | 'sect2' | 'china95'
  /** 天乙贵人: 庚日取丑未 or 寅午 */
  tianYi: 'gengOxGoat' | 'gengTigerHorse'
  /** 阴干羊刃 */
  yangRen: 'forward' | 'backward' | 'yangOnly'
  /** 贵人类神煞 (天乙/太极/文昌/国印) 查法 */
  stemRef: 'dayAndYear' | 'dayOnly'
  /** 三合类神煞 (驿马/桃花/华盖/将星/劫煞/亡神/灾煞) 查法 */
  branchRef: 'yearAndDay' | 'yearOnly' | 'dayOnly'
  /** 午未六合 */
  wuWei: '土' | '火'
}

export type SchoolKey = keyof SchoolSettings

export const DEFAULT_SCHOOLS: SchoolSettings = {
  ziHour: 'sameDay',
  childLimit: 'default',
  tianYi: 'gengOxGoat',
  yangRen: 'forward',
  stemRef: 'dayAndYear',
  branchRef: 'yearAndDay',
  wuWei: '土',
}

export interface SchoolInfo<K extends SchoolKey = SchoolKey> {
  title: string
  /** One-line explanation of the disagreement */
  summary: string
  options: { value: SchoolSettings[K]; label: string; source: string }[]
}

export const SCHOOLS: { [K in SchoolKey]: SchoolInfo<K> } = {
  ziHour: {
    title: '晚子时日柱',
    summary: '23:00–24:00 出生时，日柱算当天还是算次日，各家做法不同。',
    options: [
      { value: 'sameDay', label: '日柱算当天', source: '区分早晚子时的做法（tyme4ts LunarSect2EightCharProvider）' },
      { value: 'nextDay', label: '日柱算次日', source: '子时一到即换日（tyme4ts 默认 DefaultEightCharProvider）' },
    ],
  },
  childLimit: {
    title: '起运算法',
    summary: '都按「三天折一年」换算，但精度和取整方式不同，起运日期可能相差几天到几个月。',
    options: [
      { value: 'default', label: '精确到分钟', source: 'tyme4ts DefaultChildLimitProvider：按出生到节气的秒数折算' },
      { value: 'sect1', label: '按天数和时辰差', source: 'tyme4ts LunarSect1ChildLimitProvider（lunar 流派1）' },
      { value: 'sect2', label: '按分钟数取整', source: 'tyme4ts LunarSect2ChildLimitProvider（lunar 流派2）' },
      { value: 'china95', label: '元亨利贞', source: 'tyme4ts China95ChildLimitProvider：流派2 的算法，只精确到天' },
    ],
  },
  tianYi: {
    title: '天乙贵人',
    summary: '口诀有两个版本，区别在庚日：取丑未，还是和辛日一样取寅午。',
    options: [
      { value: 'gengOxGoat', label: '甲戊庚牛羊，六辛逢马虎', source: '常见于《渊海子平》系的口诀，多数排盘软件采用' },
      { value: 'gengTigerHorse', label: '甲戊兼牛羊，庚辛逢马虎', source: '常见于《三命通会》系的引述（另见「阴贵神歌」）' },
    ],
  },
  yangRen: {
    title: '阴干羊刃',
    summary: '阳干的羊刃都取禄前一位，没有争议；阴干有没有刃、刃在哪里，说法不一。',
    options: [
      { value: 'forward', label: '顺排（乙辰 丁未 己未 辛戌 癸丑）', source: '禄后一位，多数现代排盘软件采用' },
      { value: 'backward', label: '逆排（乙寅 丁巳 己巳 辛申 癸亥）', source: '阴干逆行，取禄前一位' },
      { value: 'yangOnly', label: '阴干无刃', source: '《三命通会》只论阳刃（阳干之刃）' },
    ],
  },
  stemRef: {
    title: '贵人查法',
    summary: '天乙、太极、文昌、国印这类贵人，有的以日干和年干一起查，有的只以日干查。',
    options: [
      { value: 'dayAndYear', label: '日干 + 年干', source: '古法以年干为主，今法以日干为主，两者并查' },
      { value: 'dayOnly', label: '仅日干', source: '子平今法，以日主为中心' },
    ],
  },
  branchRef: {
    title: '三合类神煞查法',
    summary: '驿马、桃花、华盖等以三合局起法，有的看年支，有的看日支，也有两者并看。',
    options: [
      { value: 'yearAndDay', label: '年支 + 日支', source: '两者并查，多数排盘软件采用' },
      { value: 'yearOnly', label: '仅年支', source: '古法（唐宋以年为主）' },
      { value: 'dayOnly', label: '仅日支', source: '子平今法' },
    ],
  },
  wuWei: {
    title: '午未合化',
    summary: '午未六合，有人说化土，有人说化火，也有人认为不化。',
    options: [
      { value: '土', label: '化土', source: '六合歌诀「午未合土」，最常见' },
      { value: '火', label: '化火', source: '以午未同属南方火地立论' },
    ],
  },
}

/**
 * 交节对照: how a birth is set against the 节 that turn the month pillar (and at 立春 the year's).
 * Not one of SCHOOLS, as ChroniQ itself always compares the time it casts by (the clock, or 真太阳时)
 * with the 节 in 北京时间; a program picks the other on BaziInput.jie. The two differ only for a birth
 * within a few hours of a 节 whose time zone or 真太阳时 puts it on the other side.
 */
export const JIE_SCHOOL: { title: string; summary: string; options: { value: 'local' | 'instant'; label: string; source: string }[] } = {
  title: '交节对照',
  summary: '出生离交节只差几小时时，年柱、月柱按哪个时刻和交节时刻比。海外出生、或用真太阳时的，两种比法可能落在交节两边。',
  options: [
    { value: 'instant', label: '按实际时刻', source: '节气是天文时刻：拿出生的实际时刻（世界时）和交节时刻比，与出生地的时区、真太阳时无关' },
    { value: 'local', label: '按排盘时间', source: 'ChroniQ 默认的做法：把排盘用的钟表时间或真太阳时直接和北京时间的交节时刻比' },
  ],
}

const STORAGE_KEY = 'bazi-schools'

export function loadSchools(): SchoolSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SCHOOLS
    const saved = JSON.parse(raw) as Partial<SchoolSettings>
    const merged = { ...DEFAULT_SCHOOLS }
    for (const key of Object.keys(SCHOOLS) as SchoolKey[]) {
      const value = saved[key]
      if (SCHOOLS[key].options.some((o) => o.value === value)) (merged as Record<SchoolKey, unknown>)[key] = value
    }
    return merged
  } catch {
    return DEFAULT_SCHOOLS
  }
}

export function saveSchools(settings: SchoolSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage may be unavailable (private mode); settings then last for the session only.
  }
}

export function optionLabel<K extends SchoolKey>(key: K, settings: SchoolSettings): string {
  return SCHOOLS[key].options.find((o) => o.value === settings[key])?.label ?? ''
}
