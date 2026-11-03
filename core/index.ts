// chroniq-core: ChroniQ's reckoning without its pages, for other programs (Node or a browser) —
// the 黄历 of a day, 八字 and 紫微 charts, the sky's events, and all of it as plain Chinese text
// to hand to an AI. The same code the app runs (src/lib), so both always agree.

// 黄历
export { buildDayDetail, type DayDetail } from '../src/lib/calendar'
export { moonOf, type MoonDay } from '../src/lib/moon'

// 八字
export {
  buildBazi,
  flowMonths,
  flowDays,
  ELEMENTS,
  type BaziChart,
  type BaziInput,
  type Pillar,
  type Glyph,
  type ElementName,
  type DecadeInfo,
} from '../src/lib/bazi'
export { baziReading, type BaziReading } from '../src/lib/baziReading'
export { DEFAULT_SCHOOLS, SCHOOLS, type SchoolSettings } from '../src/lib/schools'

// 紫微
export { buildZiwei, buildHoroscope, type ZiweiChart, type ZiweiPalace, type ZiweiStar } from '../src/lib/ziwei'
export { findPatterns, type ZiweiPattern } from '../src/lib/ziweiPatterns'
export { DEFAULT_ZIWEI_SCHOOLS, ZIWEI_SCHOOLS, type ZiweiSchoolSettings } from '../src/lib/ziweiSchools'

// Places (for 真太阳时 and the sky)
export { CITIES, type City } from '../src/lib/solarTime'
export { DEFAULT_PLACE, cityPlace, type Place } from '../src/lib/place'

// 天象
export { computeSkyEvents, type SkyEvent, type SkyEventKind, type SkyPlaceLike } from '../src/lib/skyEvents'
export { computeTonight, type Tonight } from '../src/lib/tonight'

// In words
export { almanac, almanacText, baziText, ziweiText, skyEventTitle, skyEventText, upcomingSkyEvents } from '../src/lib/chartText'
