// Seas and craters named on 观月's Moon: where they are (selenographic latitude and longitude, east +,
// degrees), how wide (km), and a line about each, in Chinese and English. Sizes and positions from the
// IAU Gazetteer of Planetary Nomenclature; the missions from NASA's and CNSA's records.

export interface MoonFeature {
  zh: string
  en: string
  lat: number
  lon: number
  /** A sea (月海), or a crater */
  sea: boolean
  /** Across, km */
  km: number
  note: { zh: string; en: string }
}

export const MOON_FEATURES: MoonFeature[] = [
  {
    zh: '静海', en: 'Mare Tranquillitatis', lat: 8.5, lon: 31.4, sea: true, km: 873,
    note: { zh: '1969 年阿波罗 11 号在这里降落，人类第一次踏上月球。', en: 'Apollo 11 landed here in 1969: the first people on the Moon.' },
  },
  {
    zh: '澄海', en: 'Mare Serenitatis', lat: 28, lon: 17.5, sea: true, km: 674,
    note: { zh: '东南边缘是阿波罗 17 号的着陆地（1972 年），至今最后一次载人登月。', en: 'Apollo 17, the last crewed landing so far (1972), came down on its south-east edge.' },
  },
  {
    zh: '危海', en: 'Mare Crisium', lat: 17, lon: 59.1, sea: true, km: 556,
    note: { zh: '孤立在东缘的圆形月海；1976 年苏联月球 24 号在这里取回月壤。', en: 'A round sea standing alone near the east limb; the Soviet Luna 24 brought back soil from it in 1976.' },
  },
  {
    zh: '丰富海', en: 'Mare Fecunditatis', lat: -7.8, lon: 51.3, sea: true, km: 909,
    note: { zh: '1970 年月球 16 号在这里采样返回，是第一次无人采回月壤。', en: 'Luna 16 took samples here in 1970: the first robotic sample return.' },
  },
  {
    zh: '酒海', en: 'Mare Nectaris', lat: -15.2, lon: 35.5, sea: true, km: 333,
    note: { zh: '酒海盆地的年代划出了月球地质史上的「酒海纪」。', en: 'The age of its basin marks a period of the Moon’s history, the Nectarian.' },
  },
  {
    zh: '雨海', en: 'Mare Imbrium', lat: 32.8, lon: -15.6, sea: true, km: 1146,
    note: { zh: '月面最大的撞击盆地之一；2013 年嫦娥三号和玉兔号在它北部降落。', en: 'One of the largest impact basins; Chang’e 3 and its rover Yutu landed in its north in 2013.' },
  },
  {
    zh: '风暴洋', en: 'Oceanus Procellarum', lat: 18.4, lon: -57.4, sea: true, km: 2568,
    note: { zh: '唯一叫「洋」的月海，也是最大的；2020 年嫦娥五号在这里采样返回。', en: 'The largest of the seas and the only “ocean”; Chang’e 5 brought back samples from it in 2020.' },
  },
  {
    zh: '云海', en: 'Mare Nubium', lat: -21.3, lon: -16.6, sea: true, km: 715,
    note: { zh: '里面有「直壁」，一道长约 110 公里的断崖，上弦后一两天看得最清楚。', en: 'It holds the Straight Wall, a fault some 110 km long, best seen a day or two after first quarter.' },
  },
  {
    zh: '湿海', en: 'Mare Humorum', lat: -24.4, lon: -38.6, sea: true, km: 389,
    note: { zh: '圆形的撞击盆地，北缘有伽桑狄环形山。', en: 'A round impact basin, with the crater Gassendi on its north edge.' },
  },
  {
    zh: '冷海', en: 'Mare Frigoris', lat: 56, lon: 1.4, sea: true, km: 1596,
    note: { zh: '狭长的月海，横在月面北部。', en: 'A long narrow sea lying across the Moon’s north.' },
  },
  {
    zh: '第谷', en: 'Tycho', lat: -43.3, lon: -11.4, sea: false, km: 85,
    note: { zh: '约 1 亿年前形成的年轻环形山，明亮的辐射纹延伸大半个月面，满月时最醒目。', en: 'A young crater, about 100 million years old, whose bright rays reach across much of the Moon; striking at full Moon.' },
  },
  {
    zh: '哥白尼', en: 'Copernicus', lat: 9.6, lon: -20.1, sea: false, km: 93,
    note: { zh: '约 8 亿年前形成，有阶梯状的坑壁、中央峰和明亮的辐射纹。', en: 'About 800 million years old, with terraced walls, central peaks and bright rays.' },
  },
  {
    zh: '开普勒', en: 'Kepler', lat: 8.1, lon: -38, sea: false, km: 31,
    note: { zh: '风暴洋里的小环形山，周围有明亮的辐射纹。', en: 'A small crater in Oceanus Procellarum, ringed by bright rays.' },
  },
  {
    zh: '阿里斯塔克', en: 'Aristarchus', lat: 23.7, lon: -47.4, sea: false, km: 40,
    note: { zh: '月面最亮的地形之一，即使在暗面借着地照也常能看到它的亮点。', en: 'One of the brightest places on the Moon, often seen even on the dark side by earthshine.' },
  },
  {
    zh: '柏拉图', en: 'Plato', lat: 51.6, lon: -9.4, sea: false, km: 101,
    note: { zh: '底部平坦、被熔岩填满的环形山，看上去像一块暗色的椭圆。', en: 'A crater flooded with lava, its flat floor a dark oval.' },
  },
]
