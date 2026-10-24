// English for the 紫微斗数 page. Star, palace and 四化 names stay Chinese (term());
// so do the hover explanations in lib/ziweiInfo.ts for now.
export const ZIWEI: Record<string, string> = {
  // Section nav and toolbars
  盘面: 'Chart',
  宫位显示: 'Palace view',
  叠加到: 'Overlay up to',

  // Centre panel
  阳历: 'Gregorian',
  真太阳时: 'True solar time',
  '生肖 · 星座': 'Animal · Sign',
  '悬停或点按宫位，这里会列出它的{sanfang}': 'Hover or tap a palace to list its {sanfang} here',
  '空宫，借对宫 {stars}': 'Empty; borrows {stars} from 对宫',
  '悬停或点按宫位，这里会列出它的宫干四化飞入哪一宫': "Hover or tap a palace to list where its stem's 四化 fly",
  '{palace} {stem}干{sihua}': '{palace} {stem}-stem {sihua}',
  '入{palace}': 'into {palace}',
  '冲{palace}': 'clashes {palace}',

  // Western sun signs, as iztro names them (chart.sign)
  白羊座: 'Aries',
  金牛座: 'Taurus',
  双子座: 'Gemini',
  巨蟹座: 'Cancer',
  狮子座: 'Leo',
  处女座: 'Virgo',
  天秤座: 'Libra',
  天蝎座: 'Scorpio',
  射手座: 'Sagittarius',
  摩羯座: 'Capricorn',
  水瓶座: 'Aquarius',
  双鱼座: 'Pisces',

  // Palace cells (narrow: keep short)
  '{palace}，{ganzhi}': '{palace}, {ganzhi}',
  '{stem}干飞出': '{stem} flies out',
  '{mutagens}入': '{mutagens} in',

  // Legends and notes
  '运限四化、流耀与宫名': '运限 四化, 流耀 and palace names',
  生年四化: 'Birth-year 四化',
  主星: 'Major',
  吉星: 'Auspicious',
  煞星: 'Malefic',
  '星曜配色（可在设置中切换）': 'Star colours (change in Settings)',
  '宫干自化（离心）': 'Palace stem 自化 (outward)',
  '悬停或点按宫位，看它的宫干把禄权科忌飞入哪一宫': 'Hover or tap a palace to see where its stem flies 禄权科忌',
  '悬停或点按宫位看{tip}，悬停或点按星曜看解释': 'Hover or tap a palace for its {tip}, or a star for its meaning',
  '命盘由 {iztro} 排出（中州派安星法）· 仅供参考': 'Chart cast by {iztro} (中州派 star placement) · for reference only',
  '命盘由 {iztro} 排出（通行版安星法）· 仅供参考': 'Chart cast by {iztro} (standard star placement) · for reference only',

  // 运限
  '{from}–{to}岁': 'Age {from}–{to}',
  '{age}岁': 'Age {age}',
  '流年按{start}换年（可在流派设置中切换）；流月按 iztro 的斗君起月；流日、流时以农历日和时辰为准（子时取当日早子时）。':
    "Each 流年 begins at {start} (change in school settings); 流月 are counted from iztro's 斗君; 流日 and 流时 follow the lunar day and 时辰 (子时 is the early 子时 of the same day).",

  // Star hover bubbles (the explanations themselves stay Chinese)
  类别: 'Group',
  星性: 'Nature',
  亮度: 'Brightness',
  '五行属{element}': 'element {element}',
  '传统说法，仅供参考': 'Traditional reading, for reference only',
  '悬停或点按任一宫位，即可在盘上看到它的{sanfang}。': 'Hover or tap any palace to see its {sanfang} on the board.',
}
