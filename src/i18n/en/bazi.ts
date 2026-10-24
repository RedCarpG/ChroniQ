// English for the 八字 page, and the birth form and place picker it shares
// with 紫微 and 星盘. 干支, 十神, 神煞, 纳音 and other proper nouns stay Chinese
// (term()); so do the hover explanations in lib/glossary.ts and
// lib/shenshaInfo.ts for now.
export const BAZI: Record<string, string> = {
  // Birth form
  出生日期: 'Date of birth',
  年: 'Year',
  月: 'Month',
  日: 'Day',
  出生时间: 'Time of birth',
  性别: 'Gender',
  男: 'Male',
  女: 'Female',
  出生地: 'Place of birth',
  真太阳时: 'True solar time',
  '按出生地经度与时区，把钟表时间换算成当地真太阳时再排盘':
    "Cast the chart from local true solar time, worked out from the birthplace's longitude and time zone",

  // Place picker (regions of lib/worldCities.ts; city names stay Chinese)
  中国: 'China',
  亚洲: 'Asia',
  欧洲: 'Europe',
  北美: 'North America',
  南美: 'South America',
  大洋洲: 'Oceania',
  非洲: 'Africa',
  '自定义经纬度…': 'Custom coordinates…',
  '纬度（南为负）': 'Latitude (south negative)',
  '经度（西为负）': 'Longitude (west negative)',
  时区: 'Time zone',

  // Chart header
  '属{zodiac}': 'Year of the {zodiac}',
  '阳历 {date}': 'Gregorian {date}',
  '真太阳时 {time}（{offset}分）': 'True solar time {time} ({offset} min)',

  // 岁运 panel
  收起岁运: 'Hide the 岁运 panel',
  展开岁运: 'Show the 岁运 panel',
  全部收起: 'Collapse all',
  全部展开: 'Expand all',
  收起: 'Hide',
  '{age}岁': 'Age {age}',
  '{from}–{to}岁': 'Age {from}–{to}',
  '出生后{years}年{months}个月{days}天起运（{date}交运），{direction}':
    'Starts {years} yr {months} mo {days} d after birth (on {date}), {direction}',
  顺排: 'counted forward',
  逆排: 'counted backward',
  '{date}起': 'from {date}',
  '未选 · 不入盘': 'Not picked · left out',

  // 岁运盘
  '合参{natal}': 'With {natal}',
  '{year}{ganzhi}年': '{year} {ganzhi}',
  '{picks}，合参命主原局': '{picks}, read with the 原局',
  '未选中{fortune}，在{fortune}中点选大运、流年、流月或流日': 'No {fortune} picked. Pick one in the {fortune} panel.',
  与原局无明显刑冲合会: 'No notable clashes or combinations with the 原局',
  无: 'None',

  // Hover bubbles (the explanations themselves stay Chinese)
  五行: 'Element',
  意象: 'Imagery',
  含义: 'Meaning',
  查法: 'How to find',
  '传统意象，仅供参考': 'Traditional imagery, for reference only',
  '传统说法，仅供参考': 'Traditional reading, for reference only',
  '日主{stem}在{branch}处于「{stage}」。': 'The 日主 {stem} is at {stage} in {branch}.',
  '本柱天干{stem}在{branch}处于「{stage}」。': "This pillar's 天干 {stem} is at {stage} in {branch}.",
  '{ganzhi}属{xun}旬。这一旬的十个天干只能配十个地支，剩下{a}、{b}两支无干可配，所以空亡。':
    '{ganzhi} is in the {xun} 旬. Its ten 天干 pair with only ten 地支, leaving {a} and {b} with no stem: they are 空亡.',
  '其他柱或岁运的地支遇到{a}、{b}，传统认为作用减弱。':
    'A 地支 of another pillar or of the 岁运 that is {a} or {b} is traditionally held to be weakened.',
}
