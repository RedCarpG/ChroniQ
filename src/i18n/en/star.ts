// English for the 星盘 page. Western astrology has its own English names, so
// planets, signs, aspects, elements and houses are translated here (the 天象
// page uses the same planet names). The bubble explanations stay Chinese for now.
// Shared words defined elsewhere (组合盘, 星盘, the house-system labels in
// schools.ts) are not repeated here.
export const STAR: Record<string, string> = {
  // Planets and points (BODY_INFO names, and the angles)
  太阳: 'Sun',
  月亮: 'Moon',
  水星: 'Mercury',
  金星: 'Venus',
  火星: 'Mars',
  木星: 'Jupiter',
  土星: 'Saturn',
  天王星: 'Uranus',
  海王星: 'Neptune',
  冥王星: 'Pluto',
  北交点: 'North Node',
  南交点: 'South Node',
  上升: 'Ascendant',
  天顶: 'MC',

  // Signs (SIGNS), and 白羊座 → Aries
  白羊: 'Aries',
  金牛: 'Taurus',
  双子: 'Gemini',
  巨蟹: 'Cancer',
  狮子: 'Leo',
  处女: 'Virgo',
  天秤: 'Libra',
  天蝎: 'Scorpio',
  射手: 'Sagittarius',
  摩羯: 'Capricorn',
  水瓶: 'Aquarius',
  双鱼: 'Pisces',
  '{sign}座': '{sign}',

  // Elements (ELEMENT_NAME)
  火象: 'Fire',
  土象: 'Earth',
  风象: 'Air',
  水象: 'Water',

  // Aspects (ASPECTS names, mid-phrase), their titles, and the chip
  合: 'conjunction',
  六合: 'sextile',
  刑: 'square',
  拱: 'trine',
  冲: 'opposition',
  合相: 'Conjunction',
  六合相: 'Sextile',
  刑相: 'Square',
  拱相: 'Trine',
  冲相: 'Opposition',
  '{glyph}{name}': '{glyph} {name}',

  // Houses
  第1宫: '1st house',
  第2宫: '2nd house',
  第3宫: '3rd house',
  第4宫: '4th house',
  第5宫: '5th house',
  第6宫: '6th house',
  第7宫: '7th house',
  第8宫: '8th house',
  第9宫: '9th house',
  第10宫: '10th house',
  第11宫: '11th house',
  第12宫: '12th house',

  // Chart modes and sections
  本命: 'Natal',
  行运: 'Transits',
  推运: 'Progressions',
  合盘: 'Synastry',
  宫位: 'Houses',
  相位: 'Aspects',
  比较盘: 'Compare with',
  日期: 'Date',
  时间: 'Time',
  现在: 'Now',
  '请选择出生之后的日期。': 'Pick a date after the birth.',

  // Under the natal chart
  '{place}（{coords}）· 按出生地时间 {offset}': '{place} ({coords}) · local time {offset}',
  '（当时实行夏令时，已换算）': ' (daylight saving time, allowed for)',
  回归黄道: 'tropical zodiac',
  '（极圈内无法使用普拉西度，已改用等宫制）': ' (Placidus fails inside the polar circles; Equal houses used instead)',
  '容许度：合、冲 8°，刑、拱 7°，六合 5°，涉及日月再加 2°。':
    'Orbs: conjunction and opposition 8°, square and trine 7°, sextile 5°; 2° more when the Sun or Moon is involved. ',
  星体位置由: 'Positions from',
  '计算（误差约 1′）·': '(accurate to about 1′) ·',
  宫位制说明: 'About house systems',
  仅供参考: 'For reference only',

  // Tables and chips
  星体: 'Body',
  位置: 'Position',
  宫: 'House',
  逆行: 'Retrograde',
  '{lon} 逆行': '{lon} retrograde',
  '没有主要相位。': 'No major aspects.',
  '{a}{aspect}{b}（{orb}°）': '{a} {aspect} {b} ({orb}°)',

  // 行运 / 推运 / 合盘 bodies: 行运金星, 本命太阳 …
  对方: 'Partner',
  '行运{name}': 'Transit {name}',
  '推运{name}': 'Progressed {name}',
  '对方{name}': "Partner's {name}",
  '本命{name}': 'natal {name}',
  '我的{name}': 'my {name}',
  '本命{house}': 'natal {house}',
  '落我的{house}': 'in my {house}',

  // 行运 / 推运 / 合盘 card
  '合盘 · {name}': 'Synastry · {name}',
  '对方生于 {date}（{place}）。外圈是对方的星体，看它们落在你的哪一宫、与你的星体形成什么相位；下方也列出你的星体落在对方的哪一宫。容许度：合、冲 6°，刑、拱 5°，六合 3°；天王、海王、冥王彼此之间的相位是同一代人共有的，不列出。':
    'Partner born {date} ({place}). The outer ring shows their planets: which of your houses they fall in and the aspects they make to your planets; below, your planets in their houses. Orbs: conjunction and opposition 6°, square and trine 5°, sextile 3°. Aspects among Uranus, Neptune and Pluto are shared by a whole generation and are left out.',
  '此刻行星在天上的位置（{age} 岁），对照本命盘看它们落在哪一宫、与本命星体形成什么相位。':
    'Where the planets are at this moment (age {age}), read against the natal chart: which houses they fall in and the aspects they make to natal planets. ',
  '二次推运：出生后一天对应人生一年。{age} 岁对应 {date} 的天象，上升、天顶按流派设置推进。':
    'Secondary progressions: each day after birth stands for a year of life. Age {age} corresponds to the sky on {date}; the Ascendant and MC advance as set in School settings. ',
  '容许度 {orb}。': 'Orb {orb}.',
  落我宫: 'My house',
  本命宫: 'Natal house',
  双方相位: 'Aspects between you',
  与本命的相位: 'Aspects to natal',
  '和谐 {n}': 'Harmonious {n}',
  '紧张 {n}': 'Tense {n}',
  '合相 {n}': 'Conjunctions {n}',
  '容许度内没有相位。': 'No aspects within orb.',
  我的星体落在对方的宫位: 'My planets in their houses',

  // 组合盘 card
  '组合盘 · 我 + {name}': 'Composite · me + {name}',
  '时空中点盘：两人出生时刻的中点 {date}（世界时），两地中点 {coords} 上空的真实天象。':
    'Davison chart: the real sky at the midpoint of the two births, {date} (UT), above the midpoint of the two places, {coords}. ',
  '中点组合盘：每颗行星取两人位置的较近中点；天顶取两人天顶的中点，上升与宫位由它在两地平均纬度 {lat}° 推出。':
    'Midpoint composite: each planet at the nearer midpoint of the two positions; the MC at the midpoint of the two MCs, with the Ascendant and houses worked out from it at the average latitude, {lat}°. ',
  '组合盘看的是「这段关系本身」的性格：太阳是关系的核心，月亮是相处的感受，上升是这对组合给外人的样子。可在流派设置中切换做法。':
    'A composite chart describes the relationship itself: the Sun is its core, the Moon how it feels to be in it, the Ascendant how the pair comes across to others. The method can be changed in School settings.',
  组合盘相位: 'Composite aspects',

  // The other person
  手动输入: 'Enter manually',
  '手动输入（没有已保存的命盘）': 'Enter manually (no saved charts)',
  '（当前）': ' (current)',
  对方出生日期: "Partner's birth date",
  对方出生地: "Partner's birthplace",
}
