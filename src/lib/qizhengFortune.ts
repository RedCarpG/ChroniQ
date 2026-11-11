// 七政四余's 运限: the 洞微大限, and the 流年 by the real sky.
//
// 洞微大限: the limits run from the 命宫 backward round the palaces (命宫, 相貌, 福德, 官禄, 迁移, 疾厄,
// 夫妻, 奴仆, 男女, 田宅, 兄弟, 财帛), each palace keeping its fixed years (相貌 10, 福德 11, 官禄 15,
// 迁移 8, 疾厄 7, 夫妻 11, 奴仆, 男女, 田宅 4½ each, 兄弟, 财帛 5 each). The 命宫's years are not fixed:
// the Sun's degrees into its 次, a year for each 3°, and 10 more (so 10 to 20). The books also give it
// as the days back from the birth to the Sun's last 中气, three days a year, and 10 more: the 次 begin at
// the 中气 and the Sun goes about a degree a day, so the two agree.
//
// 流年: where the 七政 and 四余 are in the sky at a given moment (the year's, by default now), placed in
// the natal palaces: which come into the 命宫, and into the palace of the 大限 then running.
import { PALACES, qizhengBodiesAt, type QizhengBody, type QizhengChart } from './qizheng'
import type { QizhengSchoolSettings } from './qizhengSchools'

const YEAR_MS = 365.2422 * 86400_000

/** The palaces in the order the limits pass through them (PALACES indices), and each one's years */
export const LIMIT_ORDER: number[] = [0, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
export const LIMIT_YEARS: Record<number, number> = { 11: 10, 10: 11, 9: 15, 8: 8, 7: 7, 6: 11, 5: 4.5, 4: 4.5, 3: 4.5, 2: 5, 1: 5 }

export interface QizhengLimit {
  /** PALACES index */
  palace: number
  /** Its 十二次 (CI index) */
  ci: number
  /** Years after the birth it runs from and to */
  fromAge: number
  toAge: number
  from: Date
  to: Date
  /** The natal bodies in that palace */
  bodies: QizhengBody[]
}

/** The 命宫's years: 10, and a year for each 3° the Sun has gone into its 次 */
export function mingYears(chart: QizhengChart): number {
  const sun = chart.bodies.find((b) => b.key === 'sun')!
  return 10 + (((sun.lon % 30) + 30) % 30) / 3
}

/** The twelve 大限, from the 命宫 on */
export function qizhengLimits(chart: QizhengChart): QizhengLimit[] {
  const born = chart.utc.getTime()
  let age = 0
  return LIMIT_ORDER.map((palace) => {
    const years = palace === 0 ? mingYears(chart) : LIMIT_YEARS[palace]
    const fromAge = age
    age += years
    return {
      palace,
      ci: (chart.mingCi + palace) % 12,
      fromAge,
      toAge: age,
      from: new Date(born + fromAge * YEAR_MS),
      to: new Date(born + age * YEAR_MS),
      bodies: chart.bodies.filter((b) => b.palace === palace),
    }
  })
}

/** The 大限 running at a moment, if within them */
export const limitAt = (limits: QizhengLimit[], at: Date) => limits.find((l) => at >= l.from && at < l.to)

export interface QizhengTransit {
  at: Date
  /** The bodies in the sky then, each in its natal palace */
  bodies: QizhengBody[]
  limit?: QizhengLimit
}

/** 流年: the 七政 and 四余 at a moment, over the natal palaces */
export function qizhengTransit(chart: QizhengChart, schools: QizhengSchoolSettings, at: Date): QizhengTransit {
  return { at, bodies: qizhengBodiesAt(at, schools, chart.mingCi), limit: limitAt(qizhengLimits(chart), at) }
}

export const palaceName = (k: number) => (k === 0 ? PALACES[0] : `${PALACES[k]}宫`)
