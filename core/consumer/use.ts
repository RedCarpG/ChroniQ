// How another program sees chroniq-core's types: checked as a Node project would (NodeNext) against
// the built declarations, after npm run build:core (npm run check:core). Each line expected to be
// an error below stops being one, failing the check, if what it reads came through as any.
import { almanac, buildBazi, DEFAULT_PLACE, upcomingSkyEvents } from 'chroniq-core'

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
