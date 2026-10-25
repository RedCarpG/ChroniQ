// The bright stars along the ecliptic: the real stars behind the signs, for the 星盘's zodiac ring
// and the 太阳系's. Ecliptic longitude and latitude from the catalogue's J2000 right ascension and
// declination, moved on by precession to the equinox of the chart's date (as its longitudes are).
import { BRIGHT_STARS, STAR_FIELDS } from './brightStars'

export interface EclipticStar {
  hip: number
  /** Ecliptic longitude, degrees, of the equinox of date */
  lon: number
  /** Ecliptic latitude, degrees */
  lat: number
  mag: number
  /** B−V colour index */
  bv: number
}

const RAD = Math.PI / 180
/** Mean obliquity of the ecliptic at J2000 */
const EPSILON = 23.4392911 * RAD
/** General precession in longitude, degrees a year */
const PRECESSION = 50.29 / 3600

let j2000: EclipticStar[] | null = null

/** All the catalogue's stars in J2000 ecliptic coordinates, worked out once */
function all(): EclipticStar[] {
  if (j2000) return j2000
  j2000 = []
  for (let i = 0; i < BRIGHT_STARS.length; i += STAR_FIELDS) {
    const [hip, ra, dec, mag, bv] = [0, 1, 2, 3, 4].map((k) => BRIGHT_STARS[i + k])
    const a = ra * RAD
    const d = dec * RAD
    const lat = Math.asin(Math.sin(d) * Math.cos(EPSILON) - Math.cos(d) * Math.sin(EPSILON) * Math.sin(a))
    const lon = Math.atan2(Math.sin(a) * Math.cos(EPSILON) + Math.tan(d) * Math.sin(EPSILON), Math.cos(a))
    j2000.push({ hip, lon: (((lon / RAD) % 360) + 360) % 360, lat: lat / RAD, mag, bv })
  }
  return j2000
}

/** The stars within `band` degrees of the ecliptic, to magnitude `maxMag`, for a year's equinox */
export function zodiacStars(year: number, band = 10, maxMag = 4.6): EclipticStar[] {
  const shift = (year - 2000) * PRECESSION
  return all()
    .filter((s) => Math.abs(s.lat) <= band && s.mag <= maxMag)
    .map((s) => ({ ...s, lon: (s.lon + shift + 360) % 360 }))
}
