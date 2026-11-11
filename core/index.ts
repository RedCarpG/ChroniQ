// chroniq-core: ChroniQ's reckoning without its pages, for other programs (Node or a browser) —
// the 黄历 of a day, 八字, 紫微, 星盘 and 七政四余 charts, the sky's events, and all of it as plain Chinese text
// to hand to an AI. The same code the app runs (src/lib), so both always agree.

// 黄历
export { buildDayDetail, type DayDetail } from '../src/lib/calendar'
export { moonOf, type MoonDay } from '../src/lib/moon'

// 八字
export {
  buildBazi,
  flowMonths,
  flowDays,
  fortunePillars,
  fortuneRelations,
  ELEMENTS,
  type BaziChart,
  type BaziInput,
  type Pillar,
  type Glyph,
  type ElementName,
  type DecadeInfo,
  type FortuneColumn,
} from '../src/lib/bazi'
export { type Relation } from '../src/lib/relations'
export { baziReading, type BaziReading } from '../src/lib/baziReading'
export { DEFAULT_SCHOOLS, SCHOOLS, JIE_SCHOOL, DEFAULT_JIE, type SchoolSettings } from '../src/lib/schools'

// 紫微
export {
  buildZiwei,
  buildHoroscope,
  type ZiweiChart,
  type ZiweiPalace,
  type ZiweiStar,
  type ZiweiLayer,
  type LayerKind,
} from '../src/lib/ziwei'
export { findPatterns, type ZiweiPattern } from '../src/lib/ziweiPatterns'
export { DEFAULT_ZIWEI_SCHOOLS, ZIWEI_SCHOOLS, type ZiweiSchoolSettings } from '../src/lib/ziweiSchools'

// 星盘 (Western astrology, tropical)
export {
  buildStarChart,
  transits,
  progressions,
  synastry,
  type StarChart,
  type ChartPoint,
  type Aspect,
  type Overlay,
} from '../src/lib/astrology'
export { DEFAULT_STAR_SETTINGS, STAR_SCHOOLS, type StarSettings, type StarPlace } from '../src/lib/starPrefs'

// 七政四余 (the real sky at birth, placed in the 28 mansions)
export {
  buildQizheng,
  qizhengBodiesAt,
  CI,
  PALACES,
  QIZHENG_INFO,
  SEVEN,
  FOUR,
  type QizhengChart,
  type QizhengBody,
  type QizhengKey,
} from '../src/lib/qizheng'
export { MANSIONS, ZONES, type Mansion, type MansionZone } from '../src/lib/mansions'
export { DEFAULT_QIZHENG_SCHOOLS, QIZHENG_SCHOOLS, type QizhengSchoolSettings } from '../src/lib/qizhengSchools'
export {
  qizhengLimits,
  qizhengTransit,
  limitAt,
  mingYears,
  LIMIT_ORDER,
  LIMIT_YEARS,
  type QizhengLimit,
  type QizhengTransit,
} from '../src/lib/qizhengFortune'

// Places (for 真太阳时, 星盘 houses and the sky), and a birth as people say it
export { CITIES, type City } from '../src/lib/solarTime'
export { DEFAULT_PLACE, cityPlace, type Place } from '../src/lib/place'
export { findCity, lunarToSolar, solarToLunar, birthNotes, type BirthNote } from '../src/lib/birth'
export { WORLD_CITIES } from '../src/lib/worldCities'
export { toUtc, type ZonedTime } from '../src/lib/timeZone'

// 天象
export { computeSkyEvents, type SkyEvent, type SkyEventKind, type SkyPlaceLike } from '../src/lib/skyEvents'
export { computeTonight, type Tonight } from '../src/lib/tonight'

// In words
export {
  almanac,
  almanacText,
  baziText,
  fortuneText,
  ziweiText,
  ziweiHoroscopeText,
  starChartText,
  qizhengText,
  skyEventTitle,
  skyEventText,
  upcomingSkyEvents,
} from '../src/lib/chartText'
