// English for the interface, keyed by the Chinese source text. One file per
// part of the app, so they can be edited apart; a key may appear in more than
// one only with the same English (the i18n test checks).
import { AI } from './ai'
import { BAZI } from './bazi'
import { CALENDAR } from './calendar'
import { COMMON } from './common'
import { MOON } from './moon'
import { PLACES } from './places'
import { QIZHENG } from './qizheng'
import { SCHOOLS } from './schools'
import { SKY } from './sky'
import { STAR } from './star'
import { ZIWEI } from './ziwei'

export const EN_PARTS = { COMMON, CALENDAR, BAZI, SCHOOLS, PLACES, ZIWEI, QIZHENG, STAR, SKY, MOON, AI }
export const EN: Record<string, string> = Object.assign({}, ...Object.values(EN_PARTS))
