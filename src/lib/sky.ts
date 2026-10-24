// 此刻天空: where the Sun, Moon, planets and bright stars stand in the sky
// above a place at a moment, as azimuth / altitude, from astronomy-engine.
// Stars come from brightStars.ts (J2000) and are carried to the date
// (precession, nutation) by the same EQJ→HOR rotation; refraction is included.
// Only the 星盘 tab imports this module.
import * as A from 'astronomy-engine'
import { BODY_INFO, type BodyKey } from './astrology'
import { BRIGHT_STARS, STAR_FIELDS } from './brightStars'

export interface SkyBody {
  key: BodyKey
  name: string
  glyph: string
  /** Azimuth, degrees from north through east, 0–360 */
  az: number
  /** Altitude above the horizon, degrees (refraction included) */
  alt: number
  /** Apparent magnitude */
  mag: number
  /** Lit fraction of the disc, 0–1 (the Moon's phase) */
  lit: number
}

export interface SkyStar {
  hip: number
  /** Common Chinese name, for the brightest few */
  name?: string
  az: number
  alt: number
  mag: number
  /** B−V colour index (blue < 0.3 < white … red > 1.4) */
  bv: number
}

export interface Sky {
  bodies: SkyBody[]
  /** Stars above the horizon */
  stars: SkyStar[]
  /** The Sun's altitude, which says how dark the sky is */
  sunAlt: number
  light: 'day' | 'twilight' | 'night'
}

// The bodies on the map: everything in the 星盘 but Pluto (far too faint to see)
// and the lunar nodes (points, not bodies).
const SKY_BODIES: [BodyKey, A.Body][] = [
  ['sun', A.Body.Sun],
  ['moon', A.Body.Moon],
  ['mercury', A.Body.Mercury],
  ['venus', A.Body.Venus],
  ['mars', A.Body.Mars],
  ['jupiter', A.Body.Jupiter],
  ['saturn', A.Body.Saturn],
  ['uranus', A.Body.Uranus],
  ['neptune', A.Body.Neptune],
]

/** Common Chinese names of the brightest stars, by Hipparcos number */
export const STAR_NAMES: Record<number, string> = {
  32349: '天狼星',
  30438: '老人星',
  71683: '南门二',
  69673: '大角星',
  91262: '织女星',
  24608: '五车二',
  24436: '参宿七',
  37279: '南河三',
  7588: '水委一',
  27989: '参宿四',
  68702: '马腹一',
  97649: '牛郎星',
  60718: '十字架二',
  21421: '毕宿五',
  80763: '心宿二',
  65474: '角宿一',
  37826: '北河三',
  113368: '北落师门',
  102098: '天津四',
  62434: '十字架三',
  49669: '轩辕十四',
  11767: '北极星',
  36850: '北河二',
  54061: '天枢',
  67301: '摇光',
}

export function skyAt(utc: Date, latitude: number, longitude: number): Sky {
  const time = A.MakeTime(utc)
  const observer = new A.Observer(latitude, longitude, 0)

  const bodies = SKY_BODIES.map(([key, body]): SkyBody => {
    const eq = A.Equator(body, time, observer, true, true)
    const hor = A.Horizon(time, observer, eq.ra, eq.dec, 'normal')
    const illum = A.Illumination(body, time)
    return {
      key,
      ...BODY_INFO[key],
      az: hor.azimuth,
      alt: hor.altitude,
      mag: illum.mag,
      lit: illum.phase_fraction,
    }
  })

  const toHorizon = A.Rotation_EQJ_HOR(time, observer)
  const stars: SkyStar[] = []
  for (let i = 0; i < BRIGHT_STARS.length; i += STAR_FIELDS) {
    const [hip, ra, dec, mag, bv] = BRIGHT_STARS.slice(i, i + STAR_FIELDS)
    const j2000 = A.VectorFromSphere(new A.Spherical(dec, ra, 1), time)
    const hor = A.HorizonFromVector(A.RotateVector(toHorizon, j2000), 'normal')
    if (hor.lat < 0) continue
    stars.push({ hip, name: STAR_NAMES[hip], az: hor.lon, alt: hor.lat, mag, bv })
  }

  const sunAlt = bodies[0].alt
  return { bodies, stars, sunAlt, light: sunAlt > -0.833 ? 'day' : sunAlt > -12 ? 'twilight' : 'night' }
}

const COMPASS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']

/** 方位 in words and degrees, e.g. 东南 135° */
export function formatAzimuth(az: number): string {
  return `${COMPASS[Math.round(az / 45) % 8]} ${Math.round(az)}°`
}
