// How another program sees chroniq-core's types: checked as a Node project would (NodeNext) against
// the built declarations, after npm run build:core (npm run check:core). Each line expected to be
// an error below stops being one, failing the check, if what it reads came through as any.
import {
  almanac,
  birthNotes,
  buildBazi,
  buildQizheng,
  DEFAULT_PLACE,
  DEFAULT_QIZHENG_SCHOOLS,
  fortuneText,
  qizhengText,
  upcomingSkyEvents,
  type BirthNote,
} from 'chroniq-core'

const events = upcomingSkyEvents(new Date('2026-11-03T00:00:00Z'), 20, DEFAULT_PLACE)
const first = events[0]
export const time: number = first.time
// @ts-expect-error SkyEvent has no such field
first.notAField
const day = almanac(2026, 11, 3)
// @ts-expect-error recommends is a list of words
export const wrong: number = day.recommends
export const dayMaster: string = buildBazi({ year: 1990, month: 5, day: 17, hour: 10, minute: 30, gender: 1 }).dayMaster
  .char
const qizheng = buildQizheng({ year: 1990, month: 5, day: 17, hour: 10, minute: 30, gender: 1, place: DEFAULT_PLACE }, DEFAULT_QIZHENG_SCHOOLS)
export const mansion: string = qizheng.bodies[0].mansion.name
export const qizhengWords: string = qizhengText(qizheng, DEFAULT_QIZHENG_SCHOOLS)
// @ts-expect-error a body's palace is a number (an index into PALACES)
export const palace: string = qizheng.bodies[0].palace
const birth = { year: 1990, month: 5, day: 17, hour: 10, minute: 30, gender: 1 as const }
export const fortune: string = fortuneText(buildBazi(birth), { year: 2026 })
const notes = birthNotes({ ...birth, place: DEFAULT_PLACE, trueSolar: true })
export const noteKind: BirthNote['kind'] = notes[0].kind
// @ts-expect-error a note's text is words
export const noteNumber: number = notes[0].text
