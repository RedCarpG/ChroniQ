// What AI 解读 asks: the chart as ChroniQ cast it (lib/chartText), written out in full so the model
// reads it rather than casting it again (which models get wrong), and what to write about it. One
// system prompt for every page; each page's chart and request go in the first message.

import { baziReading } from '../baziReading'
import type { BaziChart } from '../bazi'
import { almanacText, baziText, ziweiText } from '../chartText'
import type { ZiweiChart } from '../ziwei'
import type { ZiweiPattern } from '../ziweiPatterns'

export type AiLang = 'zh' | 'en'

export function systemPrompt(lang: AiLang): string {
  return [
    '你是一位精通子平八字、紫微斗数和传统黄历的命理研究者，替使用 ChroniQ（星曆）的人解读他们排好的盘。',
    '盘已经由程序按所选流派排好，数据以给你的为准：不要自己重新排盘，不要改动干支、星曜、四化、大运的年份，引用时照抄。',
    '解读要具体，指出依据（哪一柱、哪个十神、哪颗星在哪一宫、哪个格局），把术语用一句话讲明白；好的和需要留意的都说，语气温和、给出能做的建议。',
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
): string {
  const lines = [`这是 ${year}年${month}月${day}日 的黄历：`, '', almanacText(year, month, day)]
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
