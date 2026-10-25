// 天象: a few words on what is chosen on the map, in Chinese and English, shown under its details
// (SkyView): the Sun, Moon and planets, the named bright stars, the 88 Western constellations, the
// 二十八宿, the 三垣 and the best known of the other 星官. Not every 星官 has one: of the three
// hundred, most are small figures with little told of them.

export interface Intro {
  zh: string
  en: string
}

/** The Sun, the Moon and the planets, by the sky’s body key */
export const BODY_INTRO: Record<string, Intro> = {
  sun: {
    zh: '太阳系的中心恒星，一颗 G 型主序星，质量约占整个太阳系的 99.86%，表面温度约 5500 °C。它每年沿黄道在星空中走一圈，二十四节气就是按它在黄道上的位置划分的。',
    en: 'The star at the centre of the solar system, a G-type main-sequence star with about 99.86% of its mass, its surface near 5,500 °C. It goes round the ecliptic once a year, and the 24 solar terms mark its places along it.',
  },
  moon: {
    zh: '地球唯一的天然卫星，平均距离约 38.4 万公里。它相对恒星 27.3 天绕地球一周，从朔到朔约 29.5 天，总以同一面朝向地球，借天平动一共能看到约 59% 的月面。农历的月份就以朔望为准。',
    en: 'Earth’s only natural satellite, about 384,000 km away. It goes round Earth in 27.3 days against the stars and from new Moon to new Moon in 29.5, always with one face to us, though libration shows about 59% of its surface in time. The months of the 农历 follow its phases.',
  },
  mercury: {
    zh: '离太阳最近的行星，88 天绕日一周。它离太阳总不超过约 28°，只在黄昏或黎明时低低地短暂露面，古称“辰星”。',
    en: 'The planet nearest the Sun, going round it in 88 days. It never strays more than about 28° from the Sun, so it shows only briefly, low in the twilight; of old it was 辰星.',
  },
  venus: {
    zh: '除日月外天空中最亮的天体，最亮时约 −4.6 等，古称“太白”。黄昏现于西方时叫“长庚”，黎明现于东方时叫“启明”。厚厚的二氧化碳大气下，地表温度约 460 °C。',
    en: 'The brightest thing in the sky after the Sun and Moon, up to magnitude −4.6; of old 太白. In the evening west it was 长庚, in the morning east 启明. Under its thick carbon-dioxide air the ground is about 460 °C.',
  },
  mars: {
    zh: '红色的行星，红色来自地表的氧化铁，古称“荧惑”。约每 26 个月与地球相距最近一次（冲日），那时最亮，并在星空中逆行。',
    en: 'The red planet, red from iron oxide in its soil; of old 荧惑. Every 26 months or so it comes closest (opposition), shining brightest then and moving backwards across the stars.',
  },
  jupiter: {
    zh: '太阳系最大的行星，约 11.86 年绕日一周，每年大约走过十二次中的一次，古人用它纪年，故称“岁星”。小望远镜里就能看到它的四颗伽利略卫星。',
    en: 'The largest planet, going round the Sun in 11.86 years — about one of the twelve 次 a year, so it was used to count the years: 岁星, the year star. A small telescope shows its four Galilean moons.',
  },
  saturn: {
    zh: '以光环闻名，约 29.5 年绕日一周，大约每年“镇”住一宿，故古称“镇星”（填星）。它是肉眼可见的五大行星中最远的一颗。',
    en: 'Known for its rings, it goes round the Sun in 29.5 years, “settling” in about one 宿 a year: 镇星 of old. It is the farthest of the five planets seen with the naked eye.',
  },
  uranus: {
    zh: '1781 年由威廉·赫歇尔发现，是第一颗用望远镜发现的行星，自转轴几乎躺倒在公转面上。亮度约 5.7 等，只有在极暗的夜空中才勉强可见。',
    en: 'Found by William Herschel in 1781, the first planet discovered with a telescope; its axis lies almost in the plane of its orbit. At about magnitude 5.7 it is barely seen by eye under a very dark sky.',
  },
  neptune: {
    zh: '1846 年在根据天王星轨道的偏差推算出的位置上被发现，是太阳系最远的行星，绕日一周约 165 年。亮度约 7.8 等，要用望远镜才能看到。',
    en: 'Found in 1846 where calculations from Uranus’s wandering orbit placed it; the farthest planet, taking about 165 years to go round the Sun. At magnitude 7.8 it needs a telescope.',
  },
}

/** The named bright stars, by Hipparcos number */
export const STAR_INTRO: Record<number, Intro> = {
  32349: {
    zh: '大犬座 α，夜空中最亮的恒星（−1.46 等），距离约 8.6 光年。古人视之为主侵掠的“天狼”，东南方弧矢星官的箭正对着它。',
    en: 'α Canis Majoris, the brightest star of the night sky (−1.46), 8.6 light-years away. In China it was the Wolf, a star of raids, and the arrow of the Bow (弧矢) to its south-east is aimed at it.',
  },
  30438: {
    zh: '船底座 α，全天第二亮星（−0.74 等），距离约 310 光年。在中国只在南方低空可见，古称“南极老人星”，象征长寿。',
    en: 'α Carinae, the second brightest star (−0.74), about 310 light-years away. Seen only low in the south from China, it was the Old Man of the South Pole, a sign of long life.',
  },
  71683: {
    zh: '半人马座 α，全天第三亮星，是离太阳最近的恒星系统，约 4.37 光年；其中的比邻星是离我们最近的单颗恒星。',
    en: 'α Centauri, the third brightest star and the nearest star system, 4.37 light-years away; its Proxima is the nearest single star.',
  },
  69673: {
    zh: '牧夫座 α，北天最亮的恒星，一颗橙色巨星，距离约 37 光年。中国称“大角”，即东方苍龙的角。',
    en: 'α Boötis, the brightest star of the northern sky, an orange giant 37 light-years away. In China, 大角, the Great Horn of the Azure Dragon.',
  },
  91262: {
    zh: '天琴座 α，0.03 等，距离约 25 光年，夏季大三角之一，与银河对岸的牛郎星组成七夕的传说。约一万二千年后它将成为北极星。',
    en: 'α Lyrae, magnitude 0.03, 25 light-years away, a corner of the Summer Triangle; with Altair across the Milky Way it is the Weaver Girl of the Qixi tale. In about 12,000 years it will be the pole star.',
  },
  24608: {
    zh: '御夫座 α，全天第六亮星，金黄色，其实是两对双星组成的四合星，距离约 43 光年。',
    en: 'α Aurigae, the sixth brightest star, golden yellow; in fact four stars in two pairs, 43 light-years away.',
  },
  24436: {
    zh: '猎户座 β，蓝白色超巨星，距离约 860 光年，发光是太阳的十几万倍。在中国属参宿。',
    en: 'β Orionis, a blue-white supergiant about 860 light-years away, giving over 100,000 times the Sun’s light. In China, a star of 参宿.',
  },
  37279: {
    zh: '小犬座 α，距离约 11.5 光年，冬季大三角之一，有一颗白矮星伴星。',
    en: 'α Canis Minoris, 11.5 light-years away, a corner of the Winter Triangle, with a white dwarf companion.',
  },
  7588: {
    zh: '波江座 α，在“天河”波江的南端。它自转极快，被甩成明显的扁球形，距离约 140 光年。',
    en: 'α Eridani, at the southern end of the river Eridanus; it spins so fast it is flattened into a clear oblate shape. About 140 light-years away.',
  },
  27989: {
    zh: '猎户座 α，红超巨星，直径是太阳的数百倍，距离约 550 光年。它的亮度会变化，2019—2020 年间曾明显变暗。',
    en: 'α Orionis, a red supergiant hundreds of times the Sun’s width, about 550 light-years away; its light varies, and it dimmed markedly in 2019–20.',
  },
  68702: {
    zh: '半人马座 β，蓝白色巨星，距离约 390 光年，与南门二一起指向南十字座。',
    en: 'β Centauri, a blue-white giant about 390 light-years away; with α Centauri it points to the Southern Cross.',
  },
  97649: {
    zh: '天鹰座 α，中国称“河鼓二”，距离约 17 光年，夏季大三角之一，与织女星隔银河相望。',
    en: 'α Aquilae, 河鼓二 in China, 17 light-years away; a corner of the Summer Triangle, facing Vega across the Milky Way.',
  },
  60718: {
    zh: '南十字座 α，南十字中最亮的一颗，距离约 320 光年，在中国只有南方低纬度地区才能看到。',
    en: 'α Crucis, the brightest of the Southern Cross, about 320 light-years away; seen from China only in the far south.',
  },
  21421: {
    zh: '金牛座 α，橙色巨星，像金牛的眼睛，距离约 65 光年。在中国属毕宿。',
    en: 'α Tauri, an orange giant, the Bull’s eye, 65 light-years away. A star of 毕宿.',
  },
  80763: {
    zh: '天蝎座 α，红超巨星，颜色可与火星相比，古称“大火”。《诗经》“七月流火”说的就是它在黄昏时向西沉落。',
    en: 'α Scorpii, a red supergiant whose colour rivals Mars; in China it was 大火, the Great Fire, and the “七月流火” of the Book of Songs is its sinking in the evening west.',
  },
  65474: {
    zh: '室女座 α，蓝白色，距离约 250 光年，是二十八宿之首角宿的距星，东方苍龙的龙角。',
    en: 'α Virginis, blue-white, about 250 light-years away; the guide star of 角宿, first of the 28 mansions, the Azure Dragon’s horn.',
  },
  37826: {
    zh: '双子座 β，橙色巨星，距离约 34 光年，已知有一颗行星绕它运行。',
    en: 'β Geminorum, an orange giant 34 light-years away, with a known planet.',
  },
  113368: {
    zh: '南鱼座 α，秋季南天唯一的亮星，距离约 25 光年，周围环绕着尘埃盘。',
    en: 'α Piscis Austrini, the one bright star of the autumn southern sky, 25 light-years away, ringed by a disc of dust.',
  },
  102098: {
    zh: '天鹅座 α，白色超巨星，远在一千多光年外，是肉眼可见的最远的亮星之一，夏季大三角之一。中国属天津星官，横跨银河的渡口。',
    en: 'α Cygni, a white supergiant more than a thousand light-years away, among the farthest stars the eye can see; a corner of the Summer Triangle. In China, part of 天津, the Ford across the Milky Way.',
  },
  62434: {
    zh: '南十字座 β，蓝白色巨星，距离约 280 光年。',
    en: 'β Crucis, a blue-white giant about 280 light-years away.',
  },
  49669: {
    zh: '狮子座 α，距离约 79 光年，几乎正在黄道上，常被月亮掩食。中国属轩辕星官。',
    en: 'α Leonis, 79 light-years away and almost on the ecliptic, so the Moon often hides it. In China, a star of 轩辕.',
  },
  11767: {
    zh: '小熊座 α，离北天极不到 1°，整夜几乎不动，它的高度约等于观测地的纬度，历来用来辨认北方。中国称“勾陈一”。',
    en: 'α Ursae Minoris, less than 1° from the north celestial pole; it hardly moves all night, its height is about the observer’s latitude, and it has long told north. In China, 勾陈一.',
  },
  36850: {
    zh: '双子座 α，看上去是一颗星，其实是六颗星组成的系统，距离约 51 光年。',
    en: 'α Geminorum: one star to the eye, six in fact, about 51 light-years away.',
  },
  54061: {
    zh: '大熊座 α，北斗七星的第一颗。把天璇到天枢的连线延长约五倍，就能找到北极星。',
    en: 'α Ursae Majoris, first of the seven stars of the Northern Dipper; carry the line from 天璇 through it about five times further and you reach Polaris.',
  },
  67301: {
    zh: '大熊座 η，北斗斗柄的末端。斗柄所指随季节转动，古人用来定四时：“斗柄东指，天下皆春。”',
    en: 'η Ursae Majoris, the end of the Dipper’s handle. Where the handle points turns with the seasons, and told them: “when the handle points east, it is spring everywhere.”',
  },
}

/** The 88 Western constellations, by their IAU abbreviation */
export const WESTERN_INTRO: Record<string, Intro> = {
  And: { zh: '希腊神话中被锁在海边献给海怪的公主安德罗墨达。座中的仙女座星系（M31）距离约 250 万光年，是肉眼可见最远的天体之一。', en: 'Andromeda, the princess chained by the sea for the monster in Greek myth. Its Andromeda Galaxy (M31), 2.5 million light-years away, is among the farthest things the eye can see.' },
  Ant: { zh: '18 世纪拉卡伊设立的南天小星座，代表气泵，星都很暗。', en: 'A faint southern constellation set by Lacaille in the 18th century, the air pump.' },
  Aps: { zh: '16 世纪末荷兰航海家设立的南天星座，代表天堂鸟，靠近南天极。', en: 'The bird of paradise, a southern constellation of the late-16th-century Dutch navigators, near the south pole of the sky.' },
  Aqr: { zh: '黄道星座之一，象征一个倒水的人，星都不太亮。', en: 'A zodiac constellation, the water-bearer, its stars faint.' },
  Aql: { zh: '宙斯的鹰。最亮星牛郎星（河鼓二）是夏季大三角之一，位于银河之中。', en: 'Zeus’s eagle. Its brightest star, Altair, is a corner of the Summer Triangle, on the Milky Way.' },
  Ara: { zh: '托勒密 48 星座之一，诸神立誓的祭坛，在南天银河里。', en: 'One of Ptolemy’s 48, the altar where the gods swore their oath, in the southern Milky Way.' },
  Ari: { zh: '黄道星座之一，金羊毛的公羊。两千多年前春分点在这里，所以春分点至今被称作“白羊宫第一点”。', en: 'A zodiac constellation, the ram of the Golden Fleece. Two thousand years ago the March equinox lay here, and it is still called the First Point of Aries.' },
  Aur: { zh: '驾车人，冬季北天的五边形，最亮星五车二是全天第六亮星。中国称“五车”。', en: 'The charioteer, a pentagon of the northern winter sky; its Capella is the sixth brightest star. In China, the Five Chariots (五车).' },
  Boo: { zh: '赶着大熊的牧人，形如风筝，最亮星大角星是北天最亮的恒星。', en: 'The herdsman driving the bears, shaped like a kite; its Arcturus is the brightest star of the northern sky.' },
  Cae: { zh: '拉卡伊设立的小星座，代表雕刻刀，非常暗。', en: 'Lacaille’s engraver’s chisel, small and very faint.' },
  Cam: { zh: '17 世纪设立的北天大星座，代表长颈鹿，星都很暗，在北极星附近。', en: 'The giraffe, a large faint northern constellation of the 17th century, near Polaris.' },
  Cnc: { zh: '黄道星座之一，被赫拉克勒斯踩死的螃蟹。座中的鬼星团（M44）肉眼可见，中国称“积尸气”，在鬼宿之中。', en: 'A zodiac constellation, the crab crushed by Heracles. Its Beehive Cluster (M44), seen by eye, was the 积尸气 in the middle of 鬼宿.' },
  CVn: { zh: '牧夫牵着的两只猎犬，座中有著名的涡状星系（M51）。', en: 'The hunting dogs led by the herdsman; home of the Whirlpool Galaxy (M51).' },
  CMa: { zh: '猎户的大猎犬，最亮星天狼星是夜空中最亮的恒星。', en: 'Orion’s great dog; its Sirius is the brightest star of the night.' },
  CMi: { zh: '猎户的小猎犬，几乎只有南河三和南河二两颗亮星。', en: 'Orion’s little dog, little more than two stars, Procyon and Gomeisa.' },
  Cap: { zh: '黄道星座之一，羊头鱼尾的神兽。两千年前冬至点在这里，南回归线因此又叫“摩羯座回归线”。', en: 'A zodiac constellation, the sea-goat. Two thousand years ago the December solstice lay here, hence the Tropic of Capricorn.' },
  Car: { zh: '原南船座的龙骨，有全天第二亮星老人星和壮丽的船底座星云。', en: 'The keel of the old ship Argo, with Canopus, the second brightest star, and the great Carina Nebula.' },
  Cas: { zh: '埃塞俄比亚王后卡西奥佩娅，五颗亮星排成 W 形，与北斗分居北极星两侧，也可用来找北极星。', en: 'Queen Cassiopeia, five bright stars in a W across the pole from the Dipper; it too leads to Polaris.' },
  Cen: { zh: '半人半马的喀戎，南天大星座，有离太阳最近的恒星系统南门二，和全天最大的球状星团半人马 ω。', en: 'The centaur Chiron, a large southern constellation with α Centauri, the nearest star system, and ω Centauri, the largest globular cluster.' },
  Cep: { zh: '埃塞俄比亚国王刻甫斯，仙后的丈夫。造父变星就得名于座中的造父一（仙王座 δ）。', en: 'King Cepheus, Cassiopeia’s husband; the Cepheid variables are named after its δ Cephei.' },
  Cet: { zh: '要吞食安德罗墨达的海怪。座中的米拉（蒭藁增二）是最早发现的变星之一。', en: 'The sea monster sent for Andromeda; its Mira was among the first variable stars known.' },
  Cha: { zh: '荷兰航海家设立的南天小星座，代表变色龙，靠近南天极。', en: 'The chameleon, a small southern constellation of the Dutch navigators, near the south pole.' },
  Cir: { zh: '拉卡伊设立的南天小星座，代表圆规。', en: 'Lacaille’s drawing compass, a small southern constellation.' },
  Col: { zh: '诺亚放出的鸽子，在大犬座的西南方。', en: 'Noah’s dove, south-west of the Great Dog.' },
  Com: { zh: '埃及王后贝勒尼基献给神的头发，座中有后发星团和大批星系。', en: 'The hair Queen Berenice gave to the gods, with the Coma Star Cluster and a host of galaxies.' },
  CrA: { zh: '人马座脚下的一圈暗星，托勒密 48 星座之一。', en: 'A ring of faint stars at the Archer’s feet, one of Ptolemy’s 48.' },
  CrB: { zh: '阿里阿德涅的王冠，七颗星排成半圆。中国称“贯索”。', en: 'Ariadne’s crown, seven stars in a half circle. In China, 贯索, the String of Coins.' },
  Crv: { zh: '乌鸦，四颗星组成的小四边形，中国属轸宿。', en: 'The crow, a small quadrilateral of four stars; in China, 轸宿.' },
  Crt: { zh: '阿波罗的酒杯，星都较暗，在长蛇座的背上。', en: 'Apollo’s cup, faint, on the back of the Sea Serpent.' },
  Cru: { zh: '全天最小的星座，四颗亮星组成十字，长臂指向南天极，是南半球的导航标志。', en: 'The smallest constellation, four bright stars in a cross whose long bar points to the south pole; a guide in the southern hemisphere.' },
  Cyg: { zh: '沿银河展翅飞翔的天鹅，又称北十字，最亮星天津四是夏季大三角之一。', en: 'The swan flying down the Milky Way, also the Northern Cross; its Deneb is a corner of the Summer Triangle.' },
  Del: { zh: '小而好认的菱形，在天鹰座的东北。', en: 'The dolphin, small but easy to find, a diamond north-east of the Eagle.' },
  Dor: { zh: '荷兰航海家设立的剑鱼，大麦哲伦云的大部分都在其中。', en: 'The dolphinfish of the Dutch navigators; most of the Large Magellanic Cloud lies in it.' },
  Dra: { zh: '绕在北天极周围的长龙。约 4700 年前的北极星右枢就在其中。', en: 'The dragon coiled round the north pole; its Thuban was the pole star some 4,700 years ago.' },
  Equ: { zh: '小马，全天第二小的星座，在飞马座旁边。', en: 'The little horse, the second smallest constellation, beside Pegasus.' },
  Eri: { zh: '一条从猎户座脚下蜿蜒流向南天的长河，终点是亮星水委一。', en: 'The river winding from Orion’s feet far into the south, ending in bright Achernar.' },
  For: { zh: '拉卡伊设立的化学炉，座中有天炉座星系团。', en: 'Lacaille’s chemical furnace, with the Fornax galaxy cluster.' },
  Gem: { zh: '孪生兄弟卡斯托尔和波吕克斯，冬季的黄道星座，北河二、北河三两颗亮星并肩。每年 12 月的双子座流星雨是最壮观的流星雨之一。', en: 'The twins Castor and Pollux, a winter zodiac constellation, its two bright stars side by side. The Geminids each December are among the finest meteor showers.' },
  Gru: { zh: '荷兰航海家设立的南天星座，代表鹤。', en: 'The crane, a southern constellation of the Dutch navigators.' },
  Her: { zh: '大力士赫拉克勒斯，座中的 M13 是北天最亮的球状星团之一。', en: 'Heracles the hero; its M13 is one of the finest globular clusters of the northern sky.' },
  Hor: { zh: '拉卡伊设立的摆钟，星都很暗。', en: 'Lacaille’s pendulum clock, faint.' },
  Hya: { zh: '全天最大的星座，被赫拉克勒斯杀死的九头蛇，从巨蟹座一直延伸到天秤座附近。', en: 'The largest constellation, the Hydra slain by Heracles, stretching from Cancer to near Libra.' },
  Hyi: { zh: '荷兰航海家设立的小水蛇，在大、小麦哲伦云之间。', en: 'The little water snake of the Dutch navigators, between the two Magellanic Clouds.' },
  Ind: { zh: '荷兰航海家设立，代表印第安人。', en: 'The Indian, set by the Dutch navigators.' },
  Lac: { zh: '赫维留设立的蜥蜴，在仙王座和飞马座之间的银河里。', en: 'Hevelius’s lizard, in the Milky Way between Cepheus and Pegasus.' },
  Leo: { zh: '被赫拉克勒斯杀死的涅墨亚狮子，黄道星座之一。狮头像一个反写的问号，末端是轩辕十四。11 月有狮子座流星雨。', en: 'The Nemean lion slain by Heracles, a zodiac constellation; its head is a backward question mark ending in Regulus. The Leonid meteors come in November.' },
  LMi: { zh: '赫维留设立的小狮子，在狮子座和大熊座之间，很暗。', en: 'Hevelius’s little lion, faint, between Leo and the Great Bear.' },
  Lep: { zh: '猎户脚下的野兔，被猎人和他的猎犬追逐。', en: 'The hare at Orion’s feet, chased by the hunter and his dogs.' },
  Lib: { zh: '黄道星座之一，正义女神的天平，古时秋分点在这里。它的星原本是天蝎座的一对钳子。', en: 'A zodiac constellation, the scales of justice; the September equinox once lay here. Its stars were once the Scorpion’s claws.' },
  Lup: { zh: '半人马座旁的狼，在南天银河边。', en: 'The wolf beside the Centaur, on the edge of the southern Milky Way.' },
  Lyn: { zh: '赫维留设立。据说要有猞猁一样的眼睛才看得见它。', en: 'Hevelius’s lynx, so faint, it is said, that you need a lynx’s eyes to see it.' },
  Lyr: { zh: '俄耳甫斯的竖琴，小而明亮，最亮星织女星是夏季大三角之一，座中还有环状星云（M57）。', en: 'Orpheus’s lyre, small and bright; its Vega is a corner of the Summer Triangle, and the Ring Nebula (M57) is here.' },
  Men: { zh: '拉卡伊以开普敦的桌山命名，是全天最暗的星座，有大麦哲伦云的一部分。', en: 'Lacaille’s Table Mountain at the Cape, the faintest constellation, holding part of the Large Magellanic Cloud.' },
  Mic: { zh: '拉卡伊设立的显微镜，很暗。', en: 'Lacaille’s microscope, faint.' },
  Mon: { zh: '独角兽，在冬季大三角当中的银河里，星都较暗。', en: 'The unicorn, faint, in the Milky Way inside the Winter Triangle.' },
  Mus: { zh: '荷兰航海家设立的苍蝇，在南十字座南边。', en: 'The fly of the Dutch navigators, south of the Southern Cross.' },
  Nor: { zh: '拉卡伊设立的木匠矩尺，在南天银河里。', en: 'Lacaille’s carpenter’s square, in the southern Milky Way.' },
  Oct: { zh: '拉卡伊设立的八分仪，南天极就在其中，但附近没有像北极星那样的亮星。', en: 'Lacaille’s octant, holding the south celestial pole, which has no bright star like Polaris.' },
  Oph: { zh: '手握巨蛇的医神阿斯克勒庇俄斯。太阳每年 11 月底到 12 月中旬会经过这里，虽然它不在黄道十二宫之中。', en: 'Asclepius the healer, holding the serpent. The Sun passes through it from late November to mid-December, though it is not one of the twelve signs.' },
  Ori: { zh: '猎人俄里翁，冬夜最壮丽的星座：参宿四、参宿七两颗亮星和腰带三星，腰带下方的猎户座大星云（M42）肉眼可见。中国属参宿。', en: 'Orion the hunter, the grandest constellation of winter nights: Betelgeuse, Rigel and the three stars of his belt, with the Orion Nebula (M42) below it, seen by eye. In China, 参宿.' },
  Pav: { zh: '荷兰航海家设立的南天星座，代表孔雀。', en: 'The peacock, a southern constellation of the Dutch navigators.' },
  Peg: { zh: '美杜莎的血中诞生的飞马，四颗星组成的“秋季四边形”很好认。中国属室宿和壁宿。', en: 'The winged horse born of Medusa’s blood; its Great Square marks the autumn sky. In China, 室宿 and 壁宿.' },
  Per: { zh: '斩杀美杜莎、救出安德罗墨达的英雄珀尔修斯。座中的大陵五是著名的食变星，8 月有英仙座流星雨。', en: 'Perseus, who slew Medusa and saved Andromeda; its Algol is a famous eclipsing star, and the Perseid meteors come in August.' },
  Phe: { zh: '荷兰航海家设立的南天星座，浴火重生的凤凰。', en: 'The phoenix reborn from fire, a southern constellation of the Dutch navigators.' },
  Pic: { zh: '拉卡伊设立的画家画架。', en: 'Lacaille’s painter’s easel.' },
  Psc: { zh: '黄道星座之一，用丝带连在一起的两条鱼。现在的春分点就在这里。', en: 'A zodiac constellation, two fish tied by a ribbon; the March equinox lies here now.' },
  PsA: { zh: '喝着宝瓶座倒出的水的鱼，最亮星北落师门是秋季南天唯一的亮星。', en: 'The fish drinking the water poured by Aquarius; its Fomalhaut is the one bright star of the autumn southern sky.' },
  Pup: { zh: '原南船座的船尾，在南天银河里，有许多星团。', en: 'The stern of the old ship Argo, in the southern Milky Way, rich in clusters.' },
  Pyx: { zh: '拉卡伊设立的航海罗盘，在船尾座旁。', en: 'Lacaille’s mariner’s compass, beside the Stern.' },
  Ret: { zh: '拉卡伊设立，代表望远镜目镜里的十字丝。', en: 'Lacaille’s reticle, the crosshairs in a telescope’s eyepiece.' },
  Sge: { zh: '一支小箭，全天第三小的星座，在天鹰座北边。', en: 'The arrow, the third smallest constellation, north of the Eagle.' },
  Sgr: { zh: '弯弓射箭的半人马，黄道星座之一。银河系中心就在这个方向，这里的银河最亮。座中的南斗六星即中国的斗宿。', en: 'The archer, a centaur with drawn bow, a zodiac constellation. The centre of our galaxy lies this way, where the Milky Way is brightest; its six stars of the Southern Dipper are China’s 斗宿.' },
  Sco: { zh: '刺死猎户的蝎子，与猎户座此升彼落，红色的心宿二是它的心脏。中国属房宿、心宿、尾宿，是东方苍龙的身子。', en: 'The scorpion that killed Orion, rising as he sets; red Antares is its heart. In China, 房宿, 心宿 and 尾宿, the body of the Azure Dragon.' },
  Scl: { zh: '拉卡伊设立的雕刻家工作室，银河系的南极就在其中。', en: 'Lacaille’s sculptor’s studio; the south pole of the galaxy lies in it.' },
  Sct: { zh: '赫维留设立的盾牌，在一段明亮的银河里，即盾牌座恒星云。', en: 'Hevelius’s shield, on a bright stretch of the Milky Way, the Scutum Star Cloud.' },
  Ser: { zh: '蛇夫手中的巨蛇，是唯一分成两块的星座：蛇头和蛇尾分在蛇夫座两侧。', en: 'The serpent in Ophiuchus’s hands, the only constellation in two parts, head and tail on either side of him.' },
  Sex: { zh: '赫维留设立，纪念他观测用的六分仪，在狮子座南边，很暗。', en: 'Hevelius’s sextant, faint, south of Leo.' },
  Tau: { zh: '宙斯化身的公牛，黄道星座之一，有昴星团（七姐妹）和毕星团，红色的毕宿五像牛眼。中国属昴宿、毕宿。', en: 'The bull Zeus became, a zodiac constellation, with the Pleiades, the Hyades and red Aldebaran for its eye. In China, 昴宿 and 毕宿.' },
  Tel: { zh: '拉卡伊设立的望远镜，很暗。', en: 'Lacaille’s telescope, faint.' },
  Tri: { zh: '三颗星组成的细长三角形，座中有三角座星系（M33）。', en: 'A long thin triangle of three stars, with the Triangulum Galaxy (M33).' },
  TrA: { zh: '荷兰航海家设立的南天三角形，三颗星比北边的三角座亮。', en: 'The southern triangle of the Dutch navigators, brighter than its northern namesake.' },
  Tuc: { zh: '荷兰航海家设立的巨嘴鸟，座中有小麦哲伦云和球状星团杜鹃座 47。', en: 'The toucan of the Dutch navigators, with the Small Magellanic Cloud and the globular cluster 47 Tucanae.' },
  UMa: { zh: '宙斯所爱的卡利斯托化成的大熊，其中七颗亮星就是北斗七星，天璇、天枢的连线指向北极星。', en: 'The great bear, Callisto whom Zeus loved; seven of its stars are the Northern Dipper, whose pointers lead to Polaris.' },
  UMi: { zh: '小熊，尾巴尖上就是北极星，七颗星组成“小北斗”。', en: 'The little bear, Polaris at the tip of its tail; its seven stars make the Little Dipper.' },
  Vel: { zh: '原南船座的船帆，在南天银河里，有船帆座超新星遗迹。', en: 'The sails of the old ship Argo, in the southern Milky Way, with the Vela supernova remnant.' },
  Vir: { zh: '黄道星座之一，手持麦穗的女神，最亮星角宿一。现在的秋分点就在这里，座中还有室女座星系团。', en: 'A zodiac constellation, the maiden holding an ear of wheat, with Spica; the September equinox lies here now, and so does the Virgo galaxy cluster.' },
  Vol: { zh: '荷兰航海家设立的飞鱼，在船底座南边。', en: 'The flying fish of the Dutch navigators, south of the Keel.' },
  Vul: { zh: '赫维留设立的小狐狸，在天鹅座南边的银河里，有哑铃星云（M27）。', en: 'Hevelius’s little fox, in the Milky Way south of the Swan, with the Dumbbell Nebula (M27).' },
}

const ZIWEI = { zh: '紫微垣：环绕北天极的皇宫，天帝的居所，左右两道垣墙把北极环抱在中间，是三垣之首。', en: 'The Purple Forbidden Enclosure round the north pole, the palace of the Emperor of Heaven, its left and right walls holding the pole between them; first of the three enclosures.' }
const TAIWEI = { zh: '太微垣：在北斗之南，狮子座、室女座一带，象征天上的朝廷。', en: 'The Supreme Palace Enclosure, south of the Dipper about Leo and Virgo, the court of heaven.' }
const TIANSHI = { zh: '天市垣：在武仙座、巨蛇座、蛇夫座一带，象征天上的集市。', en: 'The Heavenly Market Enclosure, about Hercules, Serpens and Ophiuchus, the market of heaven.' }

/** The 星官: the 二十八宿, the 三垣's walls and the best known of the rest, by name */
export const CHINA_INTRO: Record<string, Intro> = {
  角宿: { zh: '东方苍龙的龙角，二十八宿之首。早春黄昏角宿从东方升起，古人称“龙抬头”，标志春耕开始。', en: 'The Azure Dragon’s horn, first of the 28. Its rising at dusk in early spring was the “dragon raising its head” that began the farming year.' },
  亢宿: { zh: '苍龙的颈项，“亢”即咽喉。', en: 'The dragon’s neck: 亢 is the throat.' },
  氐宿: { zh: '苍龙的胸，又称“天根”，“氐”意为根本。', en: 'The dragon’s breast, also the Root of Heaven (天根); 氐 means root, foundation.' },
  房宿: { zh: '苍龙的腹部，又称“天驷”，四颗星排成一列。', en: 'The dragon’s belly, also the Four Horses (天驷), four stars in a row.' },
  心宿: { zh: '苍龙的心脏，中间红色的心宿二就是“大火”，古人看它黄昏的位置来定季节。', en: 'The dragon’s heart; red 心宿二 in its middle is the Great Fire, whose place at dusk told the seasons.' },
  尾宿: { zh: '苍龙的尾巴，九颗星弯成天蝎座的尾巴。', en: 'The dragon’s tail, nine stars curling as the Scorpion’s tail.' },
  箕宿: { zh: '形如簸箕，是东方苍龙的最后一宿，古人说“箕星好风”。', en: 'Shaped like a winnowing basket, last of the Azure Dragon; it was said to love the wind.' },
  斗宿: { zh: '北方玄武第一宿，六颗星形如斗勺，称“南斗”，与北斗遥相呼应，民间有“南斗注生，北斗注死”之说。', en: 'First of the Black Tortoise, six stars like a ladle: the Southern Dipper, answering the Northern. “The Southern Dipper keeps the book of births, the Northern of deaths.”' },
  牛宿: { zh: '又称“牵牛”，六颗星，在摩羯座。七夕故事里的牛郎星其实在它北边的河鼓星官。', en: 'Also 牵牛, the Ox-herd, six stars in Capricornus; the Altair of the Qixi tale is in 河鼓, just north of it.' },
  女宿: { zh: '又称“须女”，四颗星，象征织作的女子。', en: 'Also 须女, four stars, a woman at her weaving.' },
  虚宿: { zh: '两颗星，“虚”意为空虚。《尚书·尧典》以“宵中，星虚”定仲秋。', en: 'Two stars; 虚 is emptiness. The Canon of Yao fixes mid-autumn by it: “the night is even, the star is 虚.”' },
  危宿: { zh: '三颗星形如屋脊，“危”意为高处。', en: 'Three stars like a roof-ridge; 危 is a high place.' },
  室宿: { zh: '又称“营室”，两颗星在飞马座四边形的西侧，象征宫室。', en: 'Also 营室, two stars of the Great Square of Pegasus, a house.' },
  壁宿: { zh: '两颗星，在室宿东面，像房屋的墙壁，古称“天下图书之秘府”。', en: 'Two stars east of 室, its wall; it was called the secret library of the realm.' },
  奎宿: { zh: '西方白虎第一宿，十六颗星形如鞋底，在仙女座。奎星主文章，就是读书人供奉的“魁星”。', en: 'First of the White Tiger, sixteen stars like a shoe sole in Andromeda; 奎 rules letters — the 魁星 of scholars.' },
  娄宿: { zh: '三颗星，在白羊座，象征聚养牺牲的地方。', en: 'Three stars in Aries, a pen for sacrificial animals.' },
  胃宿: { zh: '三颗星，在娄宿东边，象征天上的粮仓。', en: 'Three stars east of 娄, the granary of heaven.' },
  昴宿: { zh: '即昴星团（七姐妹星团），白虎的头部，肉眼可见六七颗星。《尧典》“日短，星昴”以它定冬至。', en: 'The Pleiades, the White Tiger’s head, six or seven stars to the eye. The Canon of Yao fixed the winter solstice by it: “the shortest day, the star 昴.”' },
  毕宿: { zh: '八颗星形如捕兔的长柄网，即毕星团，毕宿五最亮。古人说“月离于毕，俾滂沱矣”，月亮走到毕宿就要下雨。', en: 'Eight stars like a long-handled hare net, the Hyades, brightest Aldebaran; “when the Moon is in 毕, the rain will pour.”' },
  觜宿: { zh: '三颗小星，在猎户座头部，白虎的嘴。', en: 'Three small stars at Orion’s head, the Tiger’s beak.' },
  参宿: { zh: '猎户座的腰带三星和四角的亮星，“参”就是“三”。它与心宿（商星）此出彼没，有“参商不相见”之说。', en: 'Orion’s belt and four corners; 参 is “three”. It and 心宿 never share the sky — “like 参 and 商, never meeting.”' },
  井宿: { zh: '南方朱雀第一宿，八颗星形如水井，在双子座，黄道正从这里穿过。', en: 'First of the Vermilion Bird, eight stars like a well in Gemini, on the ecliptic.' },
  鬼宿: { zh: '又称“舆鬼”，四颗星围着鬼星团，也就是“积尸气”。', en: 'Also 舆鬼, four stars round the Beehive Cluster, the 积尸气.' },
  柳宿: { zh: '八颗星弯如柳枝，朱雀的嘴，在长蛇座头部。', en: 'Eight stars bent like a willow twig, the Bird’s beak, at the head of Hydra.' },
  星宿: { zh: '又称“七星”，七颗星，朱雀的颈部，最亮的星宿一是长蛇座 α。', en: 'Also 七星, seven stars, the Bird’s neck; its brightest is α Hydrae.' },
  张宿: { zh: '六颗星，像张开的网，朱雀的嗉囊。', en: 'Six stars like a spread net, the Bird’s crop.' },
  翼宿: { zh: '二十二颗星，朱雀的翅膀，是二十八宿中星数最多的一宿。', en: 'Twenty-two stars, the Bird’s wings, the most of any mansion.' },
  轸宿: { zh: '四颗星组成的四边形（乌鸦座），象征车，是二十八宿之末。', en: 'Four stars in a quadrilateral (Corvus), a chariot; last of the 28.' },
  紫微左垣: ZIWEI,
  紫微右垣: ZIWEI,
  太微左垣: TAIWEI,
  太微右垣: TAIWEI,
  天市左垣: TIANSHI,
  天市右垣: TIANSHI,
  北斗: { zh: '七颗星组成的勺子，在大熊座，是最著名的星官。斗柄随季节转动，古人用它定季节和时辰，又说“斗为帝车”，是天帝的车驾。', en: 'Seven stars in a ladle, in the Great Bear, the best known of all; its handle turns with the seasons and told them and the hours. “The Dipper is the Emperor’s chariot.”' },
  河鼓: { zh: '三颗星，中间最亮的河鼓二就是牛郎星（天鹰座 α），两旁的星被说成牛郎挑着的一双儿女。', en: 'Three stars; the bright middle one, 河鼓二, is Altair, and the two beside it are said to be the children the Cowherd carries.' },
  织女: { zh: '三颗星，最亮的织女一就是织女星（天琴座 α），与河鼓隔着银河，七夕在鹊桥上相会。', en: 'Three stars, the brightest Vega; across the Milky Way from 河鼓, they meet on the bridge of magpies at Qixi.' },
  天津: { zh: '九颗星横跨银河，像一座渡河的桥梁或渡口，在天鹅座，包括天津四。', en: 'Nine stars spanning the Milky Way like a ford or a bridge, in Cygnus, with Deneb.' },
  轩辕: { zh: '十七颗星像一条蜿蜒的黄龙，在狮子座一带，最亮星轩辕十四。轩辕是黄帝的名字。', en: 'Seventeen stars winding like a yellow dragon about Leo, brightest Regulus; 轩辕 is the Yellow Emperor’s name.' },
  五车: { zh: '五颗星组成五边形，象征天帝的五辆兵车，在御夫座，包括五车二。', en: 'Five stars in a pentagon, the Emperor’s five war chariots, in Auriga, with Capella.' },
  天狼: { zh: '就是天狼星（大犬座 α），古人视为主侵掠的凶星，东南方的弧矢星官正张弓射向它。', en: 'Sirius, seen as a star of raids and plunder; the Bow (弧矢) to its south-east draws its arrow at it.' },
  南门: { zh: '两颗星，象征天上的南门，南门二就是半人马座 α，在中国只有南方才能看到。', en: 'Two stars, the southern gate of heaven; 南门二 is α Centauri, seen only from the far south of China.' },
  老人: { zh: '就是老人星（船底座 α），又称寿星、南极仙翁，古人认为它出现预示天下太平、国君长寿。', en: 'Canopus, the Star of Longevity, the Old Man of the South Pole; its appearing foretold peace and a long life for the ruler.' },
  北极: { zh: '五颗星，在小熊座，象征天帝和他的家族。这里的古北极星并不是今天的北极星，今天的北极星属于勾陈。', en: 'Five stars in Ursa Minor, the Emperor and his family. Its old pole star is not today’s Polaris, which belongs to 勾陈.' },
  勾陈: { zh: '六颗星，勾陈一就是今天的北极星（小熊座 α），象征天帝的后宫，一说为统领六军的将军。', en: 'Six stars; 勾陈一 is today’s Polaris. They stood for the Emperor’s consorts — or, some said, the general of his six armies.' },
  华盖: { zh: '十六颗星形如伞盖，覆在北极星官之上，象征天帝的车盖，在仙后座附近。', en: 'Sixteen stars like a canopy over 北极, the Emperor’s parasol, near Cassiopeia.' },
  天船: { zh: '九颗星，像银河中的一条船，在英仙座。', en: 'Nine stars, a boat on the Milky Way, in Perseus.' },
  弧矢: { zh: '九颗星组成一张弓和一支箭，在大犬座和船尾座，箭头正对着天狼星。', en: 'Nine stars in a bow and arrow, in Canis Major and Puppis, the arrow aimed at Sirius.' },
  贯索: { zh: '九颗星串成一个圈（北冕座一带），象征牢狱。', en: 'Nine stars strung in a ring (about Corona Borealis), a prison.' },
  大角: { zh: '就是大角星（牧夫座 α），被视为苍龙的角，也象征天帝的座位。', en: 'Arcturus, the dragon’s horn, and the throne of the Emperor of Heaven.' },
  王良: { zh: '五颗星，在仙后座。王良是春秋时善于驾车的人。', en: 'Five stars in Cassiopeia, named for 王良, a great charioteer of the Spring and Autumn period.' },
  阁道: { zh: '六颗星，在仙后座，像一条跨过银河的天桥，供天帝往来。', en: 'Six stars in Cassiopeia, a covered way across the Milky Way for the Emperor’s comings and goings.' },
  傅说: { zh: '一颗星，在天蝎座尾部。傅说是商王武丁的贤相，相传死后化为此星。', en: 'A single star at the Scorpion’s tail, named for 傅说, the wise minister of King Wuding of Shang, said to have become this star.' },
  文昌: { zh: '六颗星，在大熊座头部，形如半月，掌管文运，后世奉为文昌帝君。', en: 'Six stars at the Great Bear’s head, in a half moon, keeper of scholarship, later worshipped as 文昌帝君.' },
  三台: { zh: '六颗星两两成对，像三级台阶，在大熊座的足部，象征朝中的三公。', en: 'Six stars in three pairs like three steps, at the Great Bear’s feet, the Three Excellencies of the court.' },
  五帝座: { zh: '五颗星，在狮子座尾部（包括五帝座一，即狮子座 β），象征五方天帝。', en: 'Five stars at Leo’s tail (with Denebola), the Five Emperors of the five directions.' },
  北河: { zh: '三颗星，在双子座，包括北河二、北河三，象征北方的河戍。', en: 'Three stars in Gemini, with Castor and Pollux, the northern river border-post.' },
  南河: { zh: '三颗星，在小犬座，包括南河三，与北河隔着黄道相对。', en: 'Three stars in Canis Minor, with Procyon, facing 北河 across the ecliptic.' },
  天大将军: { zh: '十一颗星，在仙女座和三角座，象征统领天兵的大将。', en: 'Eleven stars in Andromeda and Triangulum, the great general of heaven’s armies.' },
}
