// English for the 七政四余 page. The names of the mansions, the 十二次, the bodies and the palaces go
// through term() and stay Chinese, as the 八字 and 紫微 names do; the sentences round them are here.
export const QIZHENG: Record<string, string> = {
  // The page menu
  七政四余: 'Seven Governors & Four Remainders',
  七政: 'Seven Governors',
  '日月五星与罗计孛炁，落在真实的二十八宿': 'Sun, Moon, five planets and the four shadow points, placed in the real 28 mansions',
  七政四余命盘: 'Seven Governors chart',
  // The scene's verse and margins
  '日躔{m}宿': 'Sun in {m}',
  '月离{m}宿': 'Moon in {m}',
  '岁星在{m}': 'Jupiter in {m}',
  '镇星在{m}': 'Saturn in {m}',
  '{zone}之宿': 'a mansion of the {zone}',
  '{ci}之次': 'station {ci}',
  '命宫{ci}': 'Life palace {ci}',
  '命度{m}宿': 'Ascendant in {m}',
  '{bodies}守命': '{bodies} guard the Life palace',
  '第一重 · 日躔{m}宿': 'Layer 1 · Sun in {m}',
  '第二重 · 月离{m}宿': 'Layer 2 · Moon in {m}',
  '第三重 · 五星各就其宿': 'Layer 3 · The five planets take their mansions',
  '第四重 · 四余': 'Layer 4 · The four remainders',
  依流派推算: 'reckoned by school',
  '罗睺、计都是月亮轨道的两个交点，月孛是月亮的远地点，都由天文算出；紫炁没有对应的天体，各流派推法不同。':
    "Rahu and Ketu are the Moon's two nodes and Yuebei its apogee, all computed from the sky; Ziqi has no body in the sky, and schools reckon it differently.",
  初度: 'start',
  // 详细: the table and the notes
  星曜: 'Body',
  入宿度: 'Into mansion',
  赤经: 'RA',
  黄经: 'Longitude',
  次: 'Station',
  '七政的位置由 astronomy-engine 按出生时刻算出（地心视位置），按赤经（J2000）归入二十八宿；入宿度是从该宿距星起算的古度（周天 365¼ 度）。':
    "The Seven Governors are computed by astronomy-engine for the moment of birth (geocentric apparent positions) and placed in the 28 mansions by right ascension (J2000); the degree into a mansion is counted from its determinative star in old degrees (365¼ to the circle).",
  '十二次按黄道从春分点起每 30° 一次（清代《时宪历》的分法）；命宫取上升点所在的次，在{ci}，其余各宫顺黄道往东排。':
    'The twelve stations are 30° of the ecliptic each from the spring equinox (as the Qing Shixian calendar divides them); the Life palace is the station of the Ascendant, here {ci}, and the other palaces follow eastward along the ecliptic.',
  '月孛取月亮的平远地点。': "Yuebei is the Moon's mean apogee.",
  // 流派设置
  罗睺计都: 'Rahu and Ketu',
  '罗睺、计都是月亮轨道与黄道的两个交点，哪个叫罗睺、哪个叫计都，前后说法相反。':
    "Rahu and Ketu are the two points where the Moon's orbit crosses the ecliptic; which is called which has been given both ways.",
  '罗睺为升交点（北交）': 'Rahu is the ascending (north) node',
  '与印度 Rāhu 同，清代《时宪历》以来的通行说法': 'As the Indian Rāhu; the usual reading since the Qing Shixian calendar',
  '罗睺为降交点（南交）': 'Rahu is the descending (south) node',
  '明代及以前的部分中国星命书的用法，与印度相反': 'As in some Chinese astrology books of the Ming and before, the reverse of the Indian',
  '罗睺、计都用月交点的真实位置还是平均位置，两者最多相差约 1.5°。':
    "Whether Rahu and Ketu use the nodes' true or mean positions; the two differ by up to about 1.5°.",
  真交点: 'True node',
  '按月球瞬时轨道计算': "From the Moon's instantaneous orbit",
  平交点: 'Mean node',
  '按平均运动计算，古法推步即用平行': 'From the mean motion, as the old calendar reckonings used',
  紫炁: 'Ziqi',
  '紫炁在天上没有对应的天体，只能依流派推算；各家起点不同，位置可能相差很多。':
    'Ziqi has no body in the sky and can only be reckoned by a school; schools start it from different points, so its place can differ a great deal.',
  二十八年一周天: 'Once round in 28 years',
  '按「紫炁二十八年行一周天」匀速顺行推算；起点取 2000 年初在星纪初度（冬至点），是本应用的约定':
    "Moving steadily eastward, once round the sky in 28 years; starting from the winter solstice point at the start of 2000, which is this app's own convention",
  不排紫炁: 'Leave Ziqi out',
  '只排有天文对应的罗睺、计都、月孛': 'Only Rahu, Ketu and Yuebei, which have counterparts in the sky',
  // 白话解读
  '（{branch}宫），命度在{m}宿': '({branch} palace), the Ascendant in {m}',
  '{bodies}守命，命宫的性情多从这几颗星看': "{bodies} guard the Life palace; the chart's nature is read mostly from them",
  '命宫无星守，传统上看命宫之主和对宫': 'No body guards the Life palace; traditionally its ruler and the opposite palace are read',
  '七政有 {n} 颗在{zone}': '{n} of the Seven Governors are in the {zone}',
  '，': ', ',
  '应春，主生发': 'answering to spring: growth',
  '应夏，主繁盛': 'answering to summer: flourishing',
  '应秋，主收敛': 'answering to autumn: gathering in',
  '应冬，主收藏': 'answering to winter: storing away',
  // 运限 (QizhengFortunes)
  '洞微大限：从命宫起逆行十二宫；命宫的年数按太阳入次的度数，每 3 度一年，再加 10 年（{years} 年），其余各宫年数固定。':
    'The Dongwei limits run from the 命宫 backward round the twelve palaces. The 命宫 lasts 10 years plus a year for every 3° the Sun has gone into its 次 ({years} years here); every other palace has fixed years.',
  '{from}–{to} 年（{a}–{b}岁）': '{from}–{to} (age {a}–{b})',
  '宫内：{bodies}': 'In it: {bodies}',
  宫内无星: 'No bodies in it',
  '{date}的星空': 'the sky of {date}',
  落本命: 'Natal palace',
  入命: 'in the 命宫',
  入大限: 'in the limit',
  '流年看所选那一年今天这个日子（今年就是今天）天上的七政四余，落在本命盘的哪一宫；太阳、月亮和水金火走得快，木星、土星和罗计一年里变化不大。':
    'The year’s sky is taken on today’s month and day in the year picked (today itself this year): where the Seven Governors and Four Remainders stand then, in the natal palaces. The Sun, Moon, Mercury, Venus and Mars move fast; Jupiter, Saturn and the nodes change little in a year.',
}
