// English for the 流派设置 panel (all three registries: 八字, 紫微, 星盘) and
// the "!" marks that point to it. Book titles 《…》, verses 「…」 and
// proper nouns stay Chinese.
export const SCHOOLS: Record<string, string> = {
  // Panel and marks
  流派设置: 'School settings',
  '出处：{source}': 'Source: {source}',
  '流派差异：{title}': 'Varies by school: {title}',
  '当前：{option}（可在「流派设置」中更改）': 'Current: {option} (change it in School settings)',

  // 八字 (lib/schools.ts)
  晚子时日柱: 'Day pillar in the late 子 hour',
  '23:00–24:00 出生时，日柱算当天还是算次日，各家做法不同。':
    'For births 23:00–24:00, schools differ on whether the day pillar is that day or the next.',
  日柱算当天: 'Same day',
  '区分早晚子时的做法（tyme4ts LunarSect2EightCharProvider）':
    'Splits the 子 hour into early and late (tyme4ts LunarSect2EightCharProvider)',
  日柱算次日: 'Next day',
  '子时一到即换日（tyme4ts 默认 DefaultEightCharProvider）':
    'The day changes as the 子 hour begins (tyme4ts default, DefaultEightCharProvider)',
  起运算法: 'Start of the 大运',
  '都按「三天折一年」换算，但精度和取整方式不同，起运日期可能相差几天到几个月。':
    'All count three days as one year, but precision and rounding differ, so the start date can vary by days or months.',
  精确到分钟: 'To the minute',
  'tyme4ts DefaultChildLimitProvider：按出生到节气的秒数折算':
    'tyme4ts DefaultChildLimitProvider: converts the seconds from birth to the 节气',
  按天数和时辰差: 'By days and 时辰',
  'tyme4ts LunarSect1ChildLimitProvider（lunar 流派1）': 'tyme4ts LunarSect1ChildLimitProvider (lunar school 1)',
  按分钟数取整: 'In whole minutes',
  'tyme4ts LunarSect2ChildLimitProvider（lunar 流派2）': 'tyme4ts LunarSect2ChildLimitProvider (lunar school 2)',
  元亨利贞: '元亨利贞',
  'tyme4ts China95ChildLimitProvider：流派2 的算法，只精确到天':
    'tyme4ts China95ChildLimitProvider: the school 2 method, to the day only',
  天乙贵人: '天乙贵人',
  '口诀有两个版本，区别在庚日：取丑未，还是和辛日一样取寅午。':
    'The verse has two versions that differ on 庚 days: 丑 and 未, or 寅 and 午 as for 辛.',
  '甲戊庚牛羊，六辛逢马虎': '庚 takes 丑 未 (甲戊庚牛羊)',
  '常见于《渊海子平》系的口诀，多数排盘软件采用': 'The verse of the 《渊海子平》 line; used by most charting software',
  '甲戊兼牛羊，庚辛逢马虎': '庚 takes 寅 午 (庚辛逢马虎)',
  '常见于《三命通会》系的引述（另见「阴贵神歌」）': 'As quoted in the 《三命通会》 line (see also 「阴贵神歌」)',
  阴干羊刃: '羊刃 of yin stems',
  '阳干的羊刃都取禄前一位，没有争议；阴干有没有刃、刃在哪里，说法不一。':
    "A yang stem's 羊刃 is the branch just past its 禄, undisputed; whether a yin stem has one, and where, is debated.",
  '顺排（乙辰 丁未 己未 辛戌 癸丑）': 'Forward (乙辰 丁未 己未 辛戌 癸丑)',
  '禄后一位，多数现代排盘软件采用': 'The branch after the 禄; used by most modern charting software',
  '逆排（乙寅 丁巳 己巳 辛申 癸亥）': 'Backward (乙寅 丁巳 己巳 辛申 癸亥)',
  '阴干逆行，取禄前一位': 'Yin stems run backward: the branch before the 禄',
  阴干无刃: 'None for yin stems',
  '《三命通会》只论阳刃（阳干之刃）': '《三命通会》 only counts 阳刃 (the 刃 of yang stems)',
  贵人查法: 'Looking up 贵人',
  '天乙、太极、文昌、国印这类贵人，有的以日干和年干一起查，有的只以日干查。':
    '贵人 such as 天乙, 太极, 文昌 and 国印 are looked up from the day and year stems together, or from the day stem only.',
  '日干 + 年干': 'Day + year stem',
  '古法以年干为主，今法以日干为主，两者并查':
    'The old method centres on the year stem, the modern one on the day stem; both are checked',
  仅日干: 'Day stem only',
  '子平今法，以日主为中心': 'Modern 子平 method, centred on the 日主',
  三合类神煞查法: 'Looking up 三合 神煞',
  '驿马、桃花、华盖等以三合局起法，有的看年支，有的看日支，也有两者并看。':
    '驿马, 桃花, 华盖 and the like come from the 三合 groups, read from the year branch, the day branch, or both.',
  '年支 + 日支': 'Year + day branch',
  '两者并查，多数排盘软件采用': 'Both are checked; used by most charting software',
  仅年支: 'Year branch only',
  '古法（唐宋以年为主）': 'Old method (centred on the year in the Tang and Song)',
  仅日支: 'Day branch only',
  子平今法: 'Modern 子平 method',
  午未合化: 'What 午未 combine into',
  '午未六合，有人说化土，有人说化火，也有人认为不化。':
    '午 and 未 form a 六合: some say it becomes 土, some 火, and some that it does not transform.',
  化土: 'Becomes 土',
  '六合歌诀「午未合土」，最常见': 'The 六合 verse 「午未合土」; the most common',
  化火: 'Becomes 火',
  以午未同属南方火地立论: 'Argued from 午 and 未 both lying in the south, the 火 quarter',

  // 紫微 (lib/ziweiSchools.ts)
  安星法: 'Star placement',
  '通行版与中州派在命主、部分杂曜和个别安星规则上不同，主星位置相同。':
    'The standard method and the 中州派 differ on the 命主, some minor stars and a few placement rules; the major stars are placed the same.',
  通行版: 'Standard',
  '《紫微斗数全书》系，多数排盘软件采用': 'The 《紫微斗数全书》 line; used by most charting software',
  中州派: '中州派',
  '王亭之所传中州派：命主按年支，部分杂曜安法不同':
    'The 中州派 as taught by 王亭之: 命主 by year branch, some minor stars placed differently',
  命盘年份分界: 'Birth year boundary',
  '出生在正月初一与立春之间时，生年干支按哪一天换年。':
    'For births between 正月初一 and 立春: which day starts the new year for the birth-year 干支.',
  正月初一: 'Lunar New Year',
  '紫微斗数传统按农历年，iztro 默认': 'The lunar year, as 紫微斗数 traditionally counts; iztro default',
  立春: '立春',
  '与八字一致，以立春换年': 'As in 八字: the year changes at 立春',
  运限年份分界: '运限 year boundary',
  '流年、小限等运限在正月初一还是立春换年。': 'Whether 流年, 小限 and other 运限 change year at 正月初一 or at 立春.',
  '按农历年，iztro 默认': 'By lunar year; iztro default',
  以立春换年: 'The year changes at 立春',
  小限分界: '小限 boundary',
  '小限按年份交替，还是按每年生日交替。': 'Whether the 小限 changes with the year or on each birthday.',
  按年份: 'By year',
  '以年份交替，iztro 默认': 'Changes with the year; iztro default',
  按生日: 'By birthday',
  以每年生日交替: 'Changes on each birthday',
  晚子时: 'Late 子 hour',
  '23:00–24:00 出生时，日期算当天还是次日。': 'For births 23:00–24:00, whether the date is that day or the next.',
  算当天: 'Same day',
  '区分早晚子时，与本站八字默认一致': 'Splits the 子 hour into early and late, like the 八字 default here',
  算次日: 'Next day',
  '子时一到即换日，iztro 默认': 'The day changes as the 子 hour begins; iztro default',
  天马: '天马',
  '天马按生年地支还是按农历生月安。口诀相同：寅午戌马在申，申子辰马在寅，巳酉丑马在亥，亥卯未马在巳。':
    'Whether 天马 is placed by the birth-year branch or by the lunar birth month. The verse is the same: 寅午戌马在申，申子辰马在寅，巳酉丑马在亥，亥卯未马在巳.',
  '按生年支（年马）': 'By year branch (年马)',
  '《紫微斗数全书》「寅午戌人马居申」，中州派、天纪同，iztro 默认':
    '《紫微斗数全书》 「寅午戌人马居申」; the same in 中州派 and 天纪; iztro default',
  '按生月（月马）': 'By birth month (月马)',
  '部分门派及「安月系诸星诀」：以农历月份为准，不论节气；文墨天机等软件可选':
    'Some schools and 「安月系诸星诀」: by lunar month, whatever the 节气; an option in software such as 文墨天机',
  庚年四化: '四化 of 庚 years',
  '庚干四化是最有争议的一组，主要分歧在化科、化忌落在哪颗星。':
    'The 庚 四化 are the most disputed, mainly over which stars take 化科 and 化忌.',
  '阳武阴同（太阴科、天同忌）': '阳武阴同 (太阴科, 天同忌)',
  '《紫微斗数全书》通行，iztro 默认': 'Standard in 《紫微斗数全书》; iztro default',
  '阳武同阴（天同科、太阴忌）': '阳武同阴 (天同科, 太阴忌)',
  '一说，如中州派': 'An alternative, e.g. 中州派',
  '阳武府同（天府科、天同忌）': '阳武府同 (天府科, 天同忌)',
  一说: 'An alternative',
  戊年四化: '四化 of 戊 years',
  '戊干化科有右弼与太阳两说。': 'For 戊, 化科 goes to either 右弼 or 太阳.',
  '贪阴弼机（右弼科）': '贪阴弼机 (右弼科)',
  '贪阴阳机（太阳科）': '贪阴阳机 (太阳科)',
  壬年四化: '四化 of 壬 years',
  '壬干化科有左辅与天府两说。': 'For 壬, 化科 goes to either 左辅 or 天府.',
  '梁紫左武（左辅科）': '梁紫左武 (左辅科)',
  '梁紫府武（天府科）': '梁紫府武 (天府科)',

  // 星盘 (lib/starPrefs.ts)
  宫位制: 'House system',
  '如何把天空分成十二宫。行星的星座不变，所落的宫位可能不同。':
    'How the sky is divided into twelve houses. Planets keep their signs but may fall in different houses.',
  '普拉西度（Placidus）': 'Placidus',
  '17 世纪 Placidus de Titis，现代西方占星最常用，多数网站与软件默认':
    'Placidus de Titis, 17th century; the most used in modern Western astrology and the default on most sites and software',
  '整宫制（Whole Sign）': 'Whole Sign',
  '希腊化时期古典占星：上升所在星座整个为第一宫': 'Hellenistic astrology: the whole rising sign is the first house',
  '等宫制（Equal）': 'Equal',
  '从上升点起每 30° 一宫，古典与现代均有使用':
    'A house every 30° from the Ascendant; used in classical and modern astrology alike',
  月交点: 'Lunar node',
  '北交点（龙头）用真实位置还是平均位置，两者最多相差约 1.5°。':
    'Whether the North Node takes its true or its mean position; the two differ by up to about 1.5°.',
  '真交点（True Node）': 'True Node',
  '按月球瞬时轨道计算，多数现代软件默认': "From the Moon's instantaneous orbit; the default in most modern software",
  '平交点（Mean Node）': 'Mean Node',
  '按平均运动计算，较早的星历与部分流派使用': 'From the mean motion; used by older ephemerides and some schools',
  推运天顶: 'Progressed angles',
  '二次推运中，上升与天顶怎样随年龄推进。行星的推运位置不受影响。':
    'How the Ascendant and Midheaven advance with age in secondary progressions. Progressed planets are not affected.',
  '太阳弧（Solar Arc）': 'Solar Arc',
  '天顶前进的度数等于推运太阳走过的弧度，较常用':
    'The Midheaven advances by the arc the progressed Sun has moved; the more common',
  'Naibod 平均弧': 'Naibod (mean arc)',
  '每年按太阳平均日行 0°59′08″ 推进': "Advances by the Sun's mean daily motion, 0°59′08″, each year",
  组合盘: 'Composite chart',
  '把两个人的星盘合成一张「关系本身」的盘。两种做法的行星位置与宫位都会不同。':
    'Combines two charts into one for the relationship itself. The two methods give different planet positions and houses.',
  '中点组合盘（Composite）': 'Midpoint composite',
  '每对行星取两人位置的较近中点；天顶取中点，上升与宫位由组合天顶在两地平均纬度推出。Robert Hand《Planets in Composite》（1975）推广，最常用':
    "Each planet at the nearer midpoint of the two positions; the Midheaven at its midpoint, with the Ascendant and houses worked out from it at the mean latitude of the two places. Popularised by Robert Hand's Planets in Composite (1975); the most common",
  '时空中点盘（Davison）': 'Davison',
  '取两人出生时刻与出生地的中点，按那一刻那个地点的真实天象起盘。Ronald Davison《Synastry》（1977）提出':
    "Cast for the real sky at the midpoint in time and place of the two births. Introduced in Ronald Davison's Synastry (1977)",
}
