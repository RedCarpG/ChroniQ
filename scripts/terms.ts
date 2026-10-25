// Collects every proper noun the UI can display, so the 繁體 character map
// (src/lib/tradChars.ts) can be generated from — and tested against — OpenCC.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  Constellation,
  Duty,
  God,
  HeavenStem,
  SolarDay,
  Sound,
  Taboo,
  Terrain,
  TwelveStar,
  TwentyEightStar,
  Zodiac,
} from 'tyme4ts'
import { buildBazi } from '../src/lib/bazi'
import { buildDayDetail, buildMonthGrid } from '../src/lib/calendar'
import { computeRelations } from '../src/lib/relations'
import { DEFAULT_SCHOOLS } from '../src/lib/schools'
import { CONCEPTS } from '../src/lib/glossary'
import { SHENSHA_INFO } from '../src/lib/shenshaInfo'
import { buildZiwei } from '../src/lib/ziwei'
import { DEFAULT_ZIWEI_SCHOOLS } from '../src/lib/ziweiSchools'
import { FIVE_STARS } from '../src/lib/fiveStars'

const STEMS = '甲乙丙丁戊己庚辛壬癸'
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'

/** String literals passed to term('…') in the UI source. */
function literalTerms(): string[] {
  const dirs = ['src', 'src/components']
  const out: string[] = []
  for (const dir of dirs) {
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.tsx'))) {
      const src = readFileSync(join(dir, f), 'utf8')
      for (const m of src.matchAll(/\bterm\(\s*'([^']+)'\s*\)/g)) out.push(m[1])
    }
  }
  return out
}

/**
 * @param years Year span for date-dependent names (festivals, solar terms,
 *   lunar month/day names). The generator uses a wide span; tests a short one.
 * @param ziweiCharts How many sample 紫微 charts to collect star/palace names from.
 */
export function collectTerms(years: [number, number] = [1990, 2035], ziweiCharts = 300): string[] {
  const terms = new Set<string>(literalTerms())
  const add = (s: string | undefined) => s && terms.add(s)

  // Complete name tables
  const tables: { fromIndex(i: number): { getName(): string } }[] = [
    Taboo, God, Duty, TwelveStar, TwentyEightStar, Zodiac, Constellation, Sound, Terrain,
  ]
  for (const table of tables) for (let i = 0; i < 400; i++) add(table.fromIndex(i).getName())

  // Month grids: lunar day/month names, festivals, solar terms
  for (let y = years[0]; y <= years[1]; y++)
    for (let m = 1; m <= 12; m++) for (const c of buildMonthGrid(y, m)) add(c.sub)

  // Day details: how names are combined on screen (农历日期, 干支, 节气 …)
  let d = SolarDay.fromYmd(years[0], 1, 1)
  const end = SolarDay.fromYmd(Math.min(years[1], years[0] + 1), 12, 31)
  while (!d.isAfter(end)) {
    const x = buildDayDetail(d)
    ;[x.lunarText, x.ganzhi, x.zodiac, x.constellation, x.duty, x.twelveStar, x.twentyEightStar].forEach(add)
    add(x.term.replace(/第\d+天$/, ''))
    ;[...x.festivals, ...x.recommends, ...x.avoids, ...x.goodGods, ...x.badGods].forEach(add)
    d = d.next(1)
  }

  // Bazi vocabulary
  for (const a of STEMS) for (const b of STEMS) add(HeavenStem.fromName(a).getTenStar(HeavenStem.fromName(b)).getName())
  Object.keys(SHENSHA_INFO).forEach(add)
  Object.keys(CONCEPTS).forEach(add)
  for (let i = 0; i < 365 * 3; i += 7) {
    const day = SolarDay.fromYmd(2020, 1, 1).next(i)
    const chart = buildBazi({ year: day.getYear(), month: day.getMonth(), day: day.getDay(), hour: (i * 5) % 24, minute: 0, gender: 1 })
    add(chart.lunarText.split(' ')[0].replace(/^.{2}年/, ''))
    add(chart.lunarText.split(' ')[1])
    add(chart.zodiac)
    chart.pillars.forEach((p) => add(p.label))
  }
  // 紫微斗数: palaces, stars, 亮度, 四化, 长生十二神, 五行局, 命主身主 from sample charts
  for (let n = 0; n < ziweiCharts; n++) {
    const i = n * 5
    const day = SolarDay.fromYmd(1990, 1, 1).next(i)
    const z = buildZiwei(
      { year: day.getYear(), month: day.getMonth(), day: day.getDay(), hour: (i * 7) % 24, minute: 0, gender: (i % 2) as 0 | 1 },
      DEFAULT_ZIWEI_SCHOOLS,
    )
    ;[z.fiveElementsClass, z.soul, z.body, z.zodiac, z.lunarText, z.time].forEach(add)
    for (const p of Object.values(z.palaces)) {
      ;[p.name, p.changsheng].forEach(add)
      for (const s of [...p.major, ...p.minor, ...p.adjective]) [s.name, s.brightness, s.mutagen].forEach(add)
    }
  }

  // Pillar tags in 刑冲合会 (年月日时 + 运/岁)
  add('年月日时运岁')
  add('大运流年流月流日')
  // 五星 (the 八字 page's sky)
  for (const s of FIVE_STARS) add(s.name)

  // 刑冲合会: every pair, plus full trios, under both 午未 settings
  for (const wuWei of ['土', '火'] as const) {
    const schools = { ...DEFAULT_SCHOOLS, wuWei }
    for (const s1 of STEMS) for (const s2 of STEMS) for (const b1 of BRANCHES) for (const b2 of BRANCHES) {
      if (s1 > s2) continue
      for (const r of computeRelations([{ label: 'a', stem: s1, branch: b1 }, { label: 'b', stem: s2, branch: b2 }], undefined, schools)) add(r.text)
    }
  }
  for (const b1 of BRANCHES) for (const b2 of BRANCHES) for (const b3 of BRANCHES)
    for (const r of computeRelations([{ label: 'a', stem: '甲', branch: b1 }, { label: 'b', stem: '甲', branch: b2 }, { label: 'c', stem: '甲', branch: b3 }])) add(r.text)

  return [...terms].sort()
}
