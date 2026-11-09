// The bright stars along the ecliptic: the real stars behind the signs, for the 星盘's zodiac ring
// and the 太阳系's. Ecliptic longitude and latitude from the catalogue's J2000 right ascension and
// declination, moved on by precession to the equinox of the chart's date (as its longitudes are).
import { BRIGHT_STARS, STAR_FIELDS } from './brightStars'
import { WESTERN } from './constellations'

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

/** J2000 right ascension and declination (degrees) → J2000 ecliptic longitude and latitude (degrees) */
function ecliptic(ra: number, dec: number): { lon: number; lat: number } {
  const a = ra * RAD
  const d = dec * RAD
  const lat = Math.asin(Math.sin(d) * Math.cos(EPSILON) - Math.cos(d) * Math.sin(EPSILON) * Math.sin(a))
  const lon = Math.atan2(Math.sin(a) * Math.cos(EPSILON) + Math.tan(d) * Math.sin(EPSILON), Math.cos(a))
  return { lon: (((lon / RAD) % 360) + 360) % 360, lat: lat / RAD }
}

/** All the catalogue's stars in J2000 ecliptic coordinates, worked out once */
function all(): EclipticStar[] {
  if (j2000) return j2000
  j2000 = []
  for (let i = 0; i < BRIGHT_STARS.length; i += STAR_FIELDS) {
    const [hip, ra, dec, mag, bv] = [0, 1, 2, 3, 4].map((k) => BRIGHT_STARS[i + k])
    j2000.push({ hip, ...ecliptic(ra, dec), mag, bv })
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

/** The constellations the ecliptic runs through: the twelve of the zodiac, and 蛇夫座 between 天蝎 and 人马 */
const ZODIAC_IDS = ['Ari', 'Tau', 'Gem', 'Cnc', 'Leo', 'Vir', 'Lib', 'Sco', 'Oph', 'Sgr', 'Cap', 'Aqr', 'Psc']

export interface EclipticFigure {
  id: string
  name: string
  en: string
  /** Where its name goes: ecliptic longitude and latitude, degrees, of the equinox of date */
  label: { lon: number; lat: number }
  /** The stick figure, polylines of ecliptic longitude and latitude */
  lines: { lon: number; lat: number }[][]
}

/** The stick figures of the constellations along the ecliptic, for a year's equinox (as zodiacStars) */
export function zodiacFigures(year: number): EclipticFigure[] {
  const shift = (year - 2000) * PRECESSION
  const move = (ra: number, dec: number) => {
    const e = ecliptic(ra, dec)
    return { lon: (e.lon + shift + 360) % 360, lat: e.lat }
  }
  return WESTERN.filter((c) => ZODIAC_IDS.includes(c.id)).map((c) => ({
    id: c.id,
    name: c.name,
    en: c.en,
    label: move(...c.label),
    lines: c.lines.map((l) => Array.from({ length: l.length / 2 }, (_, i) => move(l[2 * i], l[2 * i + 1]))),
  }))
}
