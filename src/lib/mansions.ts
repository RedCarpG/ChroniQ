// 二十八宿: the 28 lunar mansions, in order eastward from 角. Each begins at
// the hour circle of its 距星 (determinative star) and runs to the next one's,
// so its 宿度 (width) is the difference of the two stars' right ascensions.
// Positions are J2000, as the star catalogue and the 星官 figures are; the
// figures themselves are the rank-1 entries of xingguan.ts.

export type MansionZone = 'east' | 'north' | 'west' | 'south'

export interface Mansion {
  /** One character: 角 */
  char: string
  /** 角宿, as in the 星官 data */
  name: string
  /** 七曜 and animal: 角木蛟 */
  animal: string
  zone: MansionZone
  /** 距星: its Chinese name, its Western designation (Chinese and English), RA / Dec in degrees (J2000) */
  star: string
  starWest: string
  starWestEn: string
  ra: number
  dec: number
}

/** 四象: the quarter of the sky each group of seven belongs to */
export const ZONES: Record<MansionZone, { name: string; en: string }> = {
  east: { name: '东方苍龙', en: 'Azure Dragon of the East' },
  north: { name: '北方玄武', en: 'Black Tortoise of the North' },
  west: { name: '西方白虎', en: 'White Tiger of the West' },
  south: { name: '南方朱雀', en: 'Vermilion Bird of the South' },
}

const m = (
  char: string,
  animal: string,
  zone: MansionZone,
  star: string,
  starWest: string,
  starWestEn: string,
  ra: number,
  dec: number,
): Mansion => ({ char, name: `${char}宿`, animal, zone, star, starWest, starWestEn, ra, dec })

export const MANSIONS: Mansion[] = [
  m('角', '角木蛟', 'east', '角宿一', '室女座α', 'α Vir', 201.3, -11.16),
  m('亢', '亢金龙', 'east', '亢宿一', '室女座κ', 'κ Vir', 213.22, -10.27),
  m('氐', '氐土貉', 'east', '氐宿一', '天秤座α²', 'α² Lib', 222.72, -16.04),
  m('房', '房日兔', 'east', '房宿一', '天蝎座π', 'π Sco', 239.71, -26.11),
  m('心', '心月狐', 'east', '心宿一', '天蝎座σ', 'σ Sco', 245.3, -25.59),
  m('尾', '尾火虎', 'east', '尾宿一', '天蝎座μ¹', 'μ¹ Sco', 252.97, -38.05),
  m('箕', '箕水豹', 'east', '箕宿一', '人马座γ²', 'γ² Sgr', 271.45, -30.42),
  m('斗', '斗木獬', 'north', '斗宿一', '人马座φ', 'φ Sgr', 281.41, -26.99),
  m('牛', '牛金牛', 'north', '牛宿一', '摩羯座β', 'β Cap', 305.25, -14.78),
  m('女', '女土蝠', 'north', '女宿一', '宝瓶座ε', 'ε Aqr', 311.92, -9.5),
  m('虚', '虚日鼠', 'north', '虚宿一', '宝瓶座β', 'β Aqr', 322.89, -5.57),
  m('危', '危月燕', 'north', '危宿一', '宝瓶座α', 'α Aqr', 331.45, -0.32),
  m('室', '室火猪', 'north', '室宿一', '飞马座α', 'α Peg', 346.19, 15.21),
  m('壁', '壁水貐', 'north', '壁宿一', '飞马座γ', 'γ Peg', 3.31, 15.18),
  m('奎', '奎木狼', 'west', '奎宿二', '仙女座ζ', 'ζ And', 11.83, 24.27),
  m('娄', '娄金狗', 'west', '娄宿一', '白羊座β', 'β Ari', 28.66, 20.81),
  m('胃', '胃土雉', 'west', '胃宿一', '白羊座35', '35 Ari', 40.86, 27.71),
  m('昴', '昴日鸡', 'west', '昴宿一', '金牛座17', '17 Tau', 56.22, 24.11),
  m('毕', '毕月乌', 'west', '毕宿一', '金牛座ε', 'ε Tau', 67.15, 19.18),
  m('觜', '觜火猴', 'west', '觜宿一', '猎户座λ', 'λ Ori', 83.78, 9.93),
  m('参', '参水猿', 'west', '参宿一', '猎户座ζ', 'ζ Ori', 85.19, -1.94),
  m('井', '井木犴', 'south', '井宿一', '双子座μ', 'μ Gem', 95.74, 22.51),
  m('鬼', '鬼金羊', 'south', '鬼宿一', '巨蟹座θ', 'θ Cnc', 127.9, 18.09),
  m('柳', '柳土獐', 'south', '柳宿一', '长蛇座δ', 'δ Hya', 129.41, 5.7),
  m('星', '星日马', 'south', '星宿一', '长蛇座α', 'α Hya', 141.9, -8.66),
  m('张', '张月鹿', 'south', '张宿一', '长蛇座υ¹', 'υ¹ Hya', 147.87, -14.85),
  m('翼', '翼火蛇', 'south', '翼宿一', '巨爵座α', 'α Crt', 164.94, -18.3),
  m('轸', '轸水蚓', 'south', '轸宿一', '乌鸦座γ', 'γ Crv', 183.95, -17.54),
]

const norm = (d: number) => ((d % 360) + 360) % 360

/** A mansion's 宿度 in degrees of right ascension: from its 距星 to the next one's */
export function mansionWidth(i: number): number {
  return norm(MANSIONS[(i + 1) % MANSIONS.length].ra - MANSIONS[i].ra)
}

/** The mansion a J2000 right ascension (degrees) falls in, and how far into it */
export function mansionOf(ra: number): { mansion: Mansion; index: number; into: number } {
  let index = 0
  let into = Infinity
  MANSIONS.forEach((x, i) => {
    const d = norm(ra - x.ra)
    if (d < into) {
      into = d
      index = i
    }
  })
  return { mansion: MANSIONS[index], index, into }
}

/** 古度: a circle of 365¼ 度, as the mansions' widths were traditionally given */
export const toGuDu = (degrees: number) => (degrees * 365.25) / 360
