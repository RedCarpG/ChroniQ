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

  // 五星 under the 五行 bars (BirthSky): where each stood at birth
  '{name}（{west}）· {mansion} · {height}': '{name} ({west}) · {mansion} · {height}',
  '地平上 {alt}°': '{alt}° up',
  地平下: 'below the horizon',
  '日躔{mansion}': 'Sun in {mansion}',
  '月离{mansion}': 'Moon in {mansion}',
  昼生: 'born by day',
  夜生: 'born by night',
  // 白话解读: the chart in plain words
  白话解读: 'In plain words',
  解读: 'Reading',
  '、': ', ',
  '如参天大树：挺直、有主见，向上生长': 'Like a tall tree: upright, with a mind of its own, growing upward',
  '如花草藤蔓：柔韧、善于适应和迂回': 'Like grass and vines: supple, good at adapting and finding a way round',
  '如太阳：热情、外放，照亮身边的人': 'Like the Sun: warm and outgoing, lighting up those around',
  '如烛火：细腻、内敛，专注而持久': 'Like a candle flame: delicate and inward, focused and lasting',
  '如高山厚土：稳重、可靠，能包容': 'Like a mountain: steady and reliable, with room for others',
  '如田园之土：务实、细致，善于滋养他人': 'Like garden soil: practical and careful, good at nurturing others',
  '如刀剑顽铁：果断、讲原则，经得起锤炼': 'Like raw iron or a blade: decisive and principled, able to take the forge',
  '如珠玉：精致、敏锐，重品质与体面': 'Like jewels: refined and keen, caring for quality and dignity',
  '如江河大海：开阔、灵活，闲不住': 'Like a great river: broad-minded and flexible, never still',
  '如雨露：安静、敏感，善于体察': 'Like rain and dew: quiet and sensitive, quick to notice',
  强弱: 'Strength',
  '自我与同伴的分量重：重独立，也重朋友': 'Self and peers weigh heavily: independence matters, and so do friends',
  '表达与创造的分量重：想法多，爱把想法说出来、做出来': 'Expression and making weigh heavily: many ideas, and a liking to voice and build them',
  '现实与经营的分量重：看重成果，也善于打理资源': 'Practical matters weigh heavily: results count, with a knack for managing resources',
  '规则与压力的分量重：责任心强，也容易对自己要求高': 'Rules and pressure weigh heavily: a strong sense of duty, and high demands on oneself',
  '学习与思考的分量重：爱琢磨，也需要被理解和支持': 'Learning and thought weigh heavily: fond of pondering, and in need of understanding and support',
  '天干是{star}。': 'Its stem is {star}. ',
  '按固定规则从命盘生成，是常见的传统说法，不是预测，仅供参考。': 'Generated from the chart by fixed rules, in common traditional terms. Not a forecast, for reference only.',
  '{element}最多（{count} 个）': '{element} comes most ({count})',
  '{elements}最多（各 {count} 个）': '{elements} come most ({count} each)',
  '，没有{elements}': ', with no {elements}',
  '，五行都有': ', and all five elements are there',
  '只数四柱的八个字，不算藏干。藏干里可能有这些五行，「缺」不等于不好。': 'This counts only the eight characters of the four pillars, not the hidden stems, which may hold these elements. “Missing” does not mean bad.',
  根气: '根气',
  '{pillar}{stem}（{qi}）': '{pillar} {stem} ({qi})',
  '地支藏干里没有同类，日主无根': 'No hidden stem of its own element: the day master has no root',
  '日主在地支藏干里的同类五行。本气的根最深，中气次之，余气最浅。': 'Hidden stems in the branches of the day master’s own element. A root in the 本气 is deepest, then the 中气, then the 余气.',
  日主偏旺: 'the day master leans strong',
  日主偏弱: 'the day master leans weak',
  比较平衡: 'fairly balanced',
  '生在{element}月，得时令': 'Born in a {element} month, so the season helps',
  '生在{element}月，不得时令': 'Born in a {element} month, so the season does not help',
  '；': '; ',
  '助力 {support}、消耗 {drain}，相差 2 以上才算偏旺或偏弱。': '{support} helping and {drain} draining. A gap of 2 or more counts as leaning strong or weak.',
  '算法：其余七个字各算 1 份，月支算 3 份，生助日主的算助力，其余算消耗；再加上中气的根 1 份、余气的根 0.5 份。这是简化的算法，没有考虑合化、调候等，各派判断不一。': 'The method: the other seven characters count 1 each and the month branch 3, as helping if they support the day master and otherwise as draining, plus 1 for a root in a 中气 and 0.5 for one in a 余气. This is simplified, leaving out combinations, 调候 and more, and schools judge it differently.',
  '在其余三个天干和四个地支的本气里出现 {count} 次，是分量最重的类别之一。': 'Comes {count} times among the other three stems and the main hidden stems of the four branches: among the heaviest groups.',
}
