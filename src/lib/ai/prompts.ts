// What AI 解读 asks: the chart as ChroniQ cast it (lib/chartText), written out in full so the model
// reads it rather than casting it again (which models get wrong), and what to write about it. One
// system prompt for every page; each page's chart and request go in the first message.

import { baziReading } from '../baziReading'
import type { BaziChart } from '../bazi'
import type { Overlay, StarChart } from '../astrology'
import { almanacText, baziText, qizhengText, starChartText, ziweiText } from '../chartText'
import type { QizhengChart } from '../qizheng'
import type { QizhengSchoolSettings } from '../qizhengSchools'
import type { StarSettings } from '../starPrefs'
import type { ZiweiChart } from '../ziwei'
import type { ZiweiPattern } from '../ziweiPatterns'

export type AiLang = 'zh' | 'en'

export function systemPrompt(lang: AiLang): string {
  return [
    '你是一位精通子平八字、紫微斗数、七政四余、传统黄历和西洋占星的命理研究者，替使用 ChroniQ（星曆）的人解读他们排好的盘。',
    '盘已经由程序按所选流派排好，数据以给你的为准：不要自己重新排盘，不要改动干支、星曜、四化、大运的年份、行星的星座度数和宫位、七政四余所在的宿和度数，引用时照抄。',
    '解读要具体，指出依据（哪一柱、哪个十神、哪颗星在哪一宫、哪个格局或相位），把术语用一句话讲明白；好的和需要留意的都说，语气温和、给出能做的建议。',
    '不渲染宿命和灾祸，不预言具体的生死、疾病、官司；健康和钱财的事只说倾向，提醒以现实为准。命理是传统文化的参考，不是定论。',
    '用 Markdown：小标题（##）分段，要点用短列表，不要表格。',
    lang === 'en'
      ? 'Write in English. Keep the Chinese terms (干支, 十神, 星曜, 宫位, 格局 names) in Chinese, each with a short English gloss the first time.'
      : '用简体中文回答。',
  ].join('\n')
}

/** The first message for a 八字 chart: the chart in full, its reading, and what to write */
export function baziPrompt(chart: BaziChart, year = new Date().getFullYear()): string {
  return [
    '这是一张八字命盘：',
    '',
    baziText(chart, baziReading(chart, year)),
    '',
    `请解读这张盘：先总论日主强弱、格局和喜用神的取法（说明理由），再分性格、事业、财运、感情、健康几方面；` +
      `最后看当前大运和 ${year} 年流年（${year} 年的干支对日主是什么十神、和原局有什么刑冲合害），给出这几年的建议。`,
  ].join('\n')
}

/** The first message for a 紫微 chart */
export function ziweiPrompt(chart: ZiweiChart, patterns: ZiweiPattern[], year = new Date().getFullYear()): string {
  return [
    '这是一张紫微斗数命盘：',
    '',
    ziweiText(chart, patterns),
    '',
    `请解读这张盘：先看命宫、身宫和三方四正的主星组合，说性格和格局（盘里列出的格局要逐个说成不成、强不强）；` +
      `再看财帛、官禄、夫妻、迁移、疾厄几宫；生年四化和宫干飞化里值得注意的说一说；最后看现在所在的大限和 ${year} 年，给出建议。`,
  ].join('\n')
}

/** The first message for a day: its 黄历, and the reader's 八字 when one is chosen */
export function dayPrompt(
  year: number,
  month: number,
  day: number,
  chart?: { name: string; bazi: BaziChart; notes: string[] },
  /** The day by the Western reckoning (程序算的): signs, retrogrades, aspects */
  western: string[] = [],
): string {
  const lines = [`这是 ${year}年${month}月${day}日 的黄历：`, '', almanacText(year, month, day)]
  if (western.length) lines.push('', '这一天的西方星象（程序算的）：', ...western.map((w) => `- ${w}`))
  if (chart) {
    lines.push('', `这是「${chart.name}」的八字：`, '', baziText(chart.bazi))
    if (chart.notes.length) lines.push('', '这一天和这张盘的关系（程序算的）：', ...chart.notes.map((n) => `- ${n}`))
    lines.push(
      '',
      '请结合当天的干支、宜忌、值神、星宿，和这张八字（当天日柱、流月流年对日主是什么十神，有什么刑冲合害），' +
        '说说这一天对他来说整体怎么样、适合做什么、要留意什么，最后给两三条具体的建议。不用重复列出整份黄历。',
    )
  } else {
    lines.push(
      '',
      '请用平实的话讲讲这一天：干支和节气的意思，宜忌里挑最值得说的几样解释为什么宜、为什么忌，值神和星宿的寓意，最后给两三条这一天的建议。不用重复列出整份黄历。',
    )
  }
  return lines.join('\n')
}

/** Everything in one piece, to paste into a chat with an AI that has no API here (a subscription) */
export function promptForPasting(system: string, first: string): string {
  return `${system}\n\n---\n\n${first}`
}

/** The first message for a 星盘, with the 行运, 推运 or 合盘 shown over it if any */
export function starPrompt(chart: StarChart, settings: StarSettings, overlay?: Overlay | null): string {
  const ask = !overlay
    ? '请解读这张本命盘：先说太阳、月亮、上升三要素和整体的元素、模式分布；再看行星落的星座和宫位、最紧的几个相位，' +
      '分性格、事业、感情、人际、成长课题几方面；有逆行、合相集中的宫位、四宫或空宫的特点也说一说。'
    : overlay.kind === 'synastry'
      ? '请解读这两个人的合盘：对方的行星落在这张盘的哪些宫、形成的主要相位，说两人在哪些方面合得来、哪些地方容易摩擦，给相处的建议。'
      : `请结合本命盘解读这段${overlay.kind === 'transit' ? '行运' : '推运'}：最紧的几个相位和落宫说明这段时间的主题是什么，哪些方面顺、哪些要留意，给几条建议。本命盘只简要带过。`
  return ['这是一张西洋占星的星盘（回归黄道）：', '', starChartText(chart, settings, overlay), '', ask].join('\n')
}

/** The first message for a 七政四余 chart */
export function qizhengPrompt(chart: QizhengChart, schools: QizhengSchoolSettings, now = new Date()): string {
  return [
    '这是一张七政四余命盘（按出生时刻的真实星空排，二十八宿用赤道宿度）：',
    '',
    qizhengText(chart, schools, now),
    '',
    '请解读这张盘：先看命宫所在的次、命度所在的宿和守命的星曜，说性格和整体格局；再看日躔、月离（太阳、太阴所在的宿），' +
      '五星各自所在的宿和次与它本身五行的生克（入庙、得地还是受克），有逆行的说一说；四余落在哪些宫、和七政同宫或对照的关系；' +
      '然后分财帛、官禄、夫妻、迁移、疾厄几宫看；最后看当前大限所在的宫和宫内的星，以及流年（现在天上的七政四余）落在命宫、大限宫的情况，给出这几年的建议。' +
      '盘里没有列出的（命主、度主、神煞等）如果要用，说明是按哪一家的古法推的；' +
      '依流派推算的（如紫炁）只作参考。',
  ].join('\n')
}
