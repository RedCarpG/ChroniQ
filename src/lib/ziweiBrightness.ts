// 星曜庙旺利陷, by the 《紫微斗数全书》 table: the one the common charting software
// uses by default ("依据斗数全书"). iztro's own table already agrees for the main
// stars, the 六吉 and the 六煞 but for 天梁 in 巳 (iztro 陷, 全书 得); it leaves the
// 左辅 右弼 天魁 天钺 禄存 天马 地空 地劫 and the 杂曜 without one.
//
// From Renhuai123/ziwei-doushu (lib/ziwei/school-tables.generated.ts, SB_QS;
// MIT, Copyright (c) 2026 紫微研究), which checked it palace by palace against
// charts cast by that software. Cross-checked here against the classic rules
// (太阴庙于亥子丑、陷于卯辰巳午; 擎羊庙于辰戌丑未、陷于子午卯酉; 文昌庙于巳酉丑、
// 陷于寅午戌; 天马寅申旺 …).
//
// One character a palace, from 子: 庙 旺 得 利 平 不 陷, or · where the table
// gives none (a palace the star never falls in, or one left blank).
export const QUANSHU_BRIGHTNESS: Record<string, string> = {
  // 十四主星
  紫微: '平庙旺旺得旺庙庙旺旺得旺',
  天机: '庙陷得旺利平庙陷得旺利平',
  太阳: '陷不旺庙旺旺旺得得平不陷',
  武曲: '旺庙得利庙平旺庙得利庙平',
  天同: '旺不利平平庙陷不旺平平庙',
  廉贞: '平利庙平利陷平利庙平利陷',
  天府: '庙庙庙得庙得旺庙得旺庙得',
  太阴: '庙庙旺陷陷陷不不利旺旺庙',
  贪狼: '旺庙平利庙陷旺庙平利庙陷',
  巨门: '旺不庙庙陷旺旺不庙庙陷旺',
  天相: '庙庙庙陷得得庙得庙陷得得',
  天梁: '庙旺庙庙庙得庙旺陷得庙陷',
  七杀: '旺庙庙旺庙平旺庙庙旺庙平',
  破军: '庙旺得陷旺平庙旺得陷旺平',
  // 六吉、禄马
  文昌: '得庙陷利得庙陷利得庙陷利',
  文曲: '得庙平旺得庙陷旺得庙陷旺',
  左辅: '旺庙庙陷庙平旺庙平陷庙不',
  右弼: '庙庙旺陷庙平旺庙不陷庙平',
  天魁: '旺旺·庙··庙····旺',
  天钺: '··旺··旺·旺庙庙··',
  禄存: '庙·庙庙·庙庙·庙庙·庙',
  天马: '··旺··平··旺··平',
  // 六煞
  火星: '陷得庙利陷得庙利陷得庙利',
  铃星: '陷得庙利陷得庙利陷得庙利',
  擎羊: '陷庙·陷庙·陷庙·陷庙·',
  陀罗: '·庙陷·庙陷·庙陷·庙陷',
  地空: '平陷陷平陷庙庙平庙庙陷陷',
  地劫: '陷陷平平陷不庙平庙平平陷',
  // 杂曜（截路、空亡同用截空一行，旬空用副旬一行）
  天福: '平·旺平·旺平·庙庙·庙',
  天官: '··平旺旺旺庙庙·平平旺',
  天刑: '平陷庙庙平陷平陷陷庙庙陷',
  八座: '陷庙庙平旺庙旺平庙庙平庙',
  三台: '平庙平陷庙平旺庙旺庙旺平',
  天才: '旺平庙旺陷庙旺平庙旺陷庙',
  天空: '陷平陷平庙庙庙陷旺旺陷平',
  天姚: '陷平旺庙陷平平旺陷庙庙陷',
  天哭: '平庙平庙平不陷平庙不平平',
  天喜: '旺陷庙旺陷庙庙陷旺庙陷旺',
  天虚: '陷庙旺庙陷旺平陷庙旺陷平',
  天贵: '庙旺平旺旺平庙旺陷庙旺平',
  天寿: '平庙旺陷庙平平旺旺平庙旺',
  天德: '庙庙平平庙旺旺庙平不庙平',
  孤辰: '··平··陷··平··陷',
  红鸾: '庙陷旺庙庙旺旺陷庙旺陷庙',
  恩光: '平庙平庙庙平庙旺平陷庙不',
  破碎: '·陷···陷···平··',
  华盖: '·陷··庙··陷··平·',
  解神: '庙平庙庙庙旺庙平不旺庙平',
  寡宿: '·平··陷··不··陷·',
  凤阁: '庙平庙旺陷庙平陷不庙庙旺',
  龙池: '旺平平庙庙陷不庙平庙陷旺',
  大耗: '旺平陷不平陷旺平陷不平陷',
  天使: '陷陷平平陷平平平平陷陷旺',
  天伤: '陷平平陷平平陷陷平平平旺',
  截路: '陷不陷平陷庙庙庙庙庙··',
  空亡: '陷不陷平陷庙庙庙庙庙··',
  旬空: '陷平陷平陷庙庙陷庙庙陷平',
  年解: '庙得庙庙庙旺庙得利旺庙得',
  咸池: '陷··平··陷··平··',
}

const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'

/** A star's 庙旺 in the palace on a 地支 by the 《全书》 table, if it gives one */
export function quanshuBrightness(star: string, branch: string): string | undefined {
  const c = QUANSHU_BRIGHTNESS[star]?.[BRANCHES.indexOf(branch)]
  return c && c !== '·' ? c : undefined
}
