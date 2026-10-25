// 斗柄指月: "斗柄指寅，天下皆春" — at dusk the handle of the Northern Dipper (北斗) points
// round the horizon one 辰 a month, and the month is named for where it points: 建寅 for the
// first, from 立春, 建卯 from 惊蛰, and so on (the 节 months of the 八字's month pillar). The
// classical rule, kept as the calendar keeps it: precession has since turned the real dusk
// sky a little.
import { SolarDay } from 'tyme4ts'

export interface DipperStar {
  name: string
  /** J2000, degrees */
  ra: number
  dec: number
  mag: number
}

/** The seven stars, 斗魁 (天枢 … 天权) then 斗柄 (玉衡 … 摇光), with the 北极 star for the pole */
export const DIPPER: DipperStar[] = [
  { name: '天枢', ra: 165.932, dec: 61.751, mag: 1.79 },
  { name: '天璇', ra: 165.46, dec: 56.382, mag: 2.37 },
  { name: '天玑', ra: 178.458, dec: 53.695, mag: 2.44 },
  { name: '天权', ra: 183.857, dec: 57.033, mag: 3.31 },
  { name: '玉衡', ra: 193.507, dec: 55.96, mag: 1.77 },
  { name: '开阳', ra: 200.981, dec: 54.925, mag: 2.27 },
  { name: '摇光', ra: 206.885, dec: 49.313, mag: 1.86 },
]
export const POLARIS: DipperStar = { name: '勾陈一', ra: 37.954, dec: 89.264, mag: 1.98 }

const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'
const RAD = Math.PI / 180

/**
 * Where a star sits round the pole, facing north (east to the right, the zenith up, the pole
 * at 0,0, y down as on screen), in degrees from the pole: the figure as the sky shows it.
 * The whole sky turns about the pole, so one drawing, turned, serves for any hour or month.
 */
export function aroundPole({ ra, dec }: Pick<DipperStar, 'ra' | 'dec'>): [number, number] {
  const r = 90 - dec
  return [r * Math.sin(ra * RAD), -r * Math.cos(ra * RAD)]
}

/**
 * A 辰's direction, facing north as above: 子 (north) straight down below the pole, 卯 (east) to
 * the right, 午 (south) up, 酉 (west) to the left; on screen, degrees clockwise from up.
 */
export const branchAngle = (branch: number) => (180 - branch * 30 + 360) % 360

/** The handle's direction (天权 → 摇光) in the drawing, on screen, degrees clockwise from up */
export const HANDLE_ANGLE = (() => {
  const [x0, y0] = aroundPole(DIPPER[3])
  const [x1, y1] = aroundPole(DIPPER[6])
  return (Math.atan2(x1 - x0, -(y1 - y0)) / RAD + 360) % 360
})()

export interface MonthBuild {
  /** 月建: the 辰 the handle points to, 子 = 0 */
  branch: number
  name: string
  /** The 节 the month starts with, and the next one, which ends it */
  from: { name: string; day: SolarDay }
  to: { name: string; day: SolarDay }
}

/** The 月建 of a day: the 节 month it falls in (as the 八字's month pillar counts months) */
export function monthBuildOf(day: SolarDay): MonthBuild {
  const branch = BRANCHES.indexOf(day.getSixtyCycleDay().getMonth().getEarthBranch().getName())
  let jie = day.getTerm()
  if (!jie.isJie()) jie = jie.next(-1)
  const next = jie.next(2)
  return {
    branch,
    name: BRANCHES[branch],
    from: { name: jie.getName(), day: jie.getSolarDay() },
    to: { name: next.getName(), day: next.getSolarDay() },
  }
}
