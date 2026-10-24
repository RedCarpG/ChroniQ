// 干支刑冲合会: 天干五合/相冲，地支六合、三合（含半合）、三会、六冲、相刑、六害、相破.
import { DEFAULT_SCHOOLS, type SchoolKey, type SchoolSettings } from './schools'

export interface RelationMember {
  label: string
  stem: string
  branch: string
}

export interface Relation {
  kind: '合' | '冲' | '刑' | '害' | '破' | '会'
  text: string
  /** Labels of the pillars involved, e.g. ['年', '日'] */
  members: string[]
  /** Whether the relation is between 天干 or 地支 */
  on: 'stem' | 'branch'
  /** The 流派 setting this result depends on, if any */
  school?: SchoolKey
}

const STEM_COMBINE: [string, string][] = [['甲己', '土'], ['乙庚', '金'], ['丙辛', '水'], ['丁壬', '木'], ['戊癸', '火']]
const STEM_CLASH = ['甲庚', '乙辛', '丙壬', '丁癸']
export const SIX_COMBINE: [string, string][] = [['子丑', '土'], ['寅亥', '木'], ['卯戌', '火'], ['辰酉', '金'], ['巳申', '水']]
const THREE_COMBINE: [string, string][] = [['申子辰', '水'], ['亥卯未', '木'], ['寅午戌', '火'], ['巳酉丑', '金']]
const THREE_MEET: [string, string][] = [['寅卯辰', '木'], ['巳午未', '火'], ['申酉戌', '金'], ['亥子丑', '水']]
export const SIX_CLASH = ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥']
const SIX_HARM = ['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌']
const BREAK = ['子酉', '卯午', '辰丑', '未戌', '寅亥', '巳申']
export const PUNISH: [string, string][] = [['寅巳', '无恩之刑'], ['巳申', '无恩之刑'], ['寅申', '无恩之刑'], ['丑戌', '恃势之刑'], ['戌未', '恃势之刑'], ['丑未', '恃势之刑'], ['子卯', '无礼之刑']]
export const SELF_PUNISH = '辰午酉亥'

export const isPair = (pair: string, a: string, b: string) => (pair[0] === a && pair[1] === b) || (pair[0] === b && pair[1] === a)

/**
 * All relations among the given pillars. When `focus` is given, only relations
 * that involve at least one of those labels are returned (用于岁运与原局的作用).
 */
export function computeRelations(
  members: RelationMember[],
  focus?: string[],
  schools: SchoolSettings = DEFAULT_SCHOOLS,
): Relation[] {
  const out: Relation[] = []
  const push = (r: Relation) => {
    if (!focus || r.members.some((m) => focus.includes(m))) out.push(r)
  }

  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i]
      const b = members[j]
      const labels = [a.label, b.label]
      const stems = `${a.stem}${b.stem}`
      const branches = `${a.branch}${b.branch}`

      for (const [pair, el] of STEM_COMBINE) if (isPair(pair, a.stem, b.stem)) push({ on: 'stem', kind: '合', text: `${stems}合${el}`, members: labels })
      for (const pair of STEM_CLASH) if (isPair(pair, a.stem, b.stem)) push({ on: 'stem', kind: '冲', text: `${stems}相冲`, members: labels })

      for (const [pair, el] of SIX_COMBINE) if (isPair(pair, a.branch, b.branch)) push({ on: 'branch', kind: '合', text: `${branches}六合${el}`, members: labels })
      if (isPair('午未', a.branch, b.branch)) push({ on: 'branch', kind: '合', text: `${branches}六合${schools.wuWei}`, members: labels, school: 'wuWei' })
      for (const pair of SIX_CLASH) if (isPair(pair, a.branch, b.branch)) push({ on: 'branch', kind: '冲', text: `${branches}相冲`, members: labels })
      for (const pair of SIX_HARM) if (isPair(pair, a.branch, b.branch)) push({ on: 'branch', kind: '害', text: `${branches}相害`, members: labels })
      for (const pair of BREAK) if (isPair(pair, a.branch, b.branch)) push({ on: 'branch', kind: '破', text: `${branches}相破`, members: labels })
      for (const [pair, name] of PUNISH) if (isPair(pair, a.branch, b.branch)) push({ on: 'branch', kind: '刑', text: `${branches}${name}`, members: labels })
      if (a.branch === b.branch && SELF_PUNISH.includes(a.branch)) push({ on: 'branch', kind: '刑', text: `${branches}自刑`, members: labels })

      // 半合: 两支且其一为中神（子午卯酉）
      for (const [trio, el] of THREE_COMBINE) {
        const mid = trio[1]
        if (a.branch !== b.branch && trio.includes(a.branch) && trio.includes(b.branch) && (a.branch === mid || b.branch === mid)) {
          push({ on: 'branch', kind: '合', text: `${branches}半合${el}局`, members: labels })
        }
      }
    }
  }

  // 三合局、三会方: 三支俱全
  for (const [list, kind, suffix] of [[THREE_COMBINE, '合', '三合'], [THREE_MEET, '会', '三会']] as const) {
    for (const [trio, el] of list) {
      const picked = [...trio].map((br) => members.find((m) => m.branch === br))
      if (picked.every(Boolean)) {
        push({ on: 'branch', kind, text: `${trio}${suffix}${el}${kind === '会' ? '方' : '局'}`, members: picked.map((m) => m!.label) })
      }
    }
  }
  return out
}
