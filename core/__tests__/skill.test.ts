// The chart script of the skill mingli-chart-reading (core/skill): what it prints for what it is asked
// (run.ts, from the source), and the bundled scripts/chart.mjs the skill ships, run with node alone the
// way Claude runs it. Births here are made up.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { run, UsageError } from '../skill/mingli-chart-reading/scripts/run'

const NOW = new Date('2026-11-10T12:00:00+08:00')
const BIRTH = ['--date', '1990-05-17', '--time', '10:30', '--gender', '男', '--place', '北京']
const chart = (...argv: string[]) => run(argv, NOW)
const fails = (argv: string[], message: RegExp) => {
  expect(() => run(argv, NOW)).toThrow(UsageError)
  expect(() => run(argv, NOW)).toThrow(message)
}

describe('the chart script', () => {
  it('casts a 八字 by 真太阳时 at the birthplace, with this year’s 岁运', () => {
    const text = chart('bazi', ...BIRTH)
    expect(text).toMatch(/^【八字】\n排盘依据：公历 1990-05-17 10:30 · 男 · 出生地 北京（39\.90°N 116\.41°E，Asia\/Shanghai）；八字、紫微按真太阳时排$/m)
    expect(text).toMatch(/^流派：晚子时日柱取日柱算当天；/m)
    // May 1990 was summer time in China (UTC+9): 真太阳时 takes it off
    expect(text).toContain('出生时北京实行夏令时（UTC+9）：真太阳时从世界时算起，已扣除夏令时。')
    expect(text).toContain('按真太阳时：1990年5月17日 09:19')
    expect(text).toContain('日主：壬水')
    expect(text).toMatch(/^受流派影响的结果：.+（三合类神煞查法）/m)
    expect(text).toContain('岁运（2026年）：')
    expect(text).toContain('流月（以节为界）：')
  })

  it('takes a 农历 birth, the clock time, several years and a day', () => {
    const text = chart('bazi', '--date', '1990-04-23', '--lunar', '--time', '10:30', '--gender', 'female', '--place', '北京', '--clock', '--year', '2026-2027', '--on', '2026-11-10')
    expect(text).toContain('排盘依据：公历 1990-05-17（农历 1990 年4月23日） 10:30 · 女')
    expect(text).toContain('八字、紫微按钟表时间排（--clock）')
    expect(text).toContain('本盘按钟表时间排，没有扣除夏令时的一小时')
    expect(text).not.toContain('按真太阳时：')
    expect(text.match(/^岁运（/gm)).toHaveLength(3)
    expect(text).toContain('岁运（2026年11月10日）：')
  })

  it('casts three pillars when the hour is unknown, and says what that leaves out', () => {
    const text = chart('bazi', '--date', '1990-05-06', '--time', 'unknown', '--gender', '女')
    expect(text).toContain('排盘依据：公历 1990-05-06 时辰不详 · 女 · 没有给出生地')
    expect(text).toContain('时辰不详：只排年、月、日三柱')
    expect(text).toMatch(/交立夏：出生在交节之前为 月柱庚辰，之后为 月柱辛巳/)
    expect(text).not.toMatch(/^ {2}时柱/m)
    expect(text).toContain('命宫 （缺时辰，不排）')
    expect(text).toMatch(/^五行个数：(\S\d ){4}\S\d$/m)
    // Three pillars, six characters
    const counts = /^五行个数：(.+)$/m.exec(text)![1].match(/\d/g)!.map(Number)
    expect(counts.reduce((a, b) => a + b)).toBe(6)
  })

  it('sets the year and month against the 节 by the actual moment, unless asked otherwise', () => {
    const born = ['--date', '1995-02-04', '--time', '06:15', '--gender', 'male', '--place', '多伦多']
    const instant = chart('bazi', ...born)
    expect(instant).toMatch(/交节对照取按实际时刻$/m)
    expect(instant).toMatch(/^ {2}年柱 乙亥：/m)
    expect(instant).toContain('若把真太阳时 1995年2月4日 05:43 直接和北京时间的交节时刻比（ChroniQ 默认的做法）')
    const local = chart('bazi', ...born, '--school', 'bazi.jie=local')
    expect(local).toMatch(/交节对照取按排盘时间（非默认）$/m)
    expect(local).toMatch(/^ {2}年柱 甲戌：/m)
  })

  it('refuses a time daylight saving skipped, and notes one that came twice', () => {
    fails(['bazi', '--date', '1988-04-17', '--time', '02:30', '--gender', '男', '--place', '上海'], /上海当地没有 1988年4月17日 02:30 这个时刻/)
    expect(chart('bazi', '--date', '1988-09-11', '--time', '01:30', '--gender', '男', '--place', '上海')).toContain('在上海出现过两次')
  })

  it('casts 紫微 with this year’s 大限 and 流年, and a day’s 流月 and 流日', () => {
    const text = chart('ziwei', ...BIRTH)
    expect(text).toMatch(/^【紫微斗数】/)
    expect(text).toMatch(/^流派：安星法取通行版；/m)
    expect(text.split('\n').filter((l) => /^ {2}\S+（[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]）/.test(l))).toHaveLength(12)
    expect(text).toMatch(/^ {2}大限 \S\S，\d+–\d+岁：大限命宫在本命/m)
    expect(text).toMatch(/^ {2}流年 丙午：流年命宫在本命\S+（午）/m)
    const day = chart('ziwei', ...BIRTH, '--on', '2026-11-10')
    expect(day).toMatch(/^ {2}流月 己亥：/m)
    expect(day).toMatch(/^ {2}流日 戊子：/m)
    const zhongzhou = chart('ziwei', ...BIRTH, '--school', 'ziwei.algorithm=中州派')
    expect(zhongzhou).toContain('安星法取中州派（非默认）')
    fails(['ziwei', '--date', '1990-05-17', '--time', 'unknown', '--gender', '男'], /紫微斗数要有出生时辰/)
  })

  it('casts a 星盘 with a 行运, a 推运 or a 合盘 over it', () => {
    const transit = chart('star', '--date', '1990-05-17', '--time', '10:30', '--place', '北京', '--transit', '2026-11-10')
    expect(transit).toContain('出生：1990年5月17日 10:30（当地时间，UTC+9，夏令时）· 北京')
    expect(transit).toMatch(/^行运（2026-11-10，36\.5 岁）/m)
    expect(chart('star', '--date', '1990-05-17', '--time', '10:30', '--place', '北京', '--progress', '2026-11-10')).toMatch(/^次限推运（2026-11-10/m)
    const pair = chart('star', '--date', '1990-05-17', '--time', '10:30', '--place', '北京', '--partner-date', '1992-03-08', '--partner-time', '08:15', '--partner-place', '广州')
    expect(pair).toContain('对方：公历 1992-03-08 08:15 · 出生地 广州')
    expect(pair).toMatch(/^合盘：对方的行星落在这张盘的哪一宫/m)
    expect(chart('star', '--date', '1990-05-17', '--time', '10:30', '--place', '北京', '--school', 'star.houses=whole')).toContain('宫位制：整宫制')
    fails(['star', '--date', '1990-05-17', '--time', '10:30'], /星盘要出生地/)
    fails(['star', ...BIRTH, '--transit', '2026-11-10', '--progress', '2026-11-10'], /一次只排一种/)
  })

  it('takes a place by name or by coordinates and zone', () => {
    const text = chart('star', '--date', '1990-05-17', '--time', '10:30', '--place', 'Vancouver,49.28,-123.12,America/Vancouver')
    expect(text).toContain('出生：1990年5月17日 10:30（当地时间，UTC−7，夏令时）· Vancouver（49.28°N 123.12°W）')
    fails(['star', '--date', '1990-05-17', '--time', '10:30', '--place', '不存在的地方'], /不认识地点「不存在的地方」/)
    fails(['star', '--date', '1990-05-17', '--time', '10:30', '--place', 'X,49,-123,Mars/Base'], /时区「Mars\/Base」不认识/)
  })

  it('casts 七政四余, a day’s 黄历 (with a chart against it) and the sky', () => {
    expect(chart('qizheng', ...BIRTH)).toMatch(/【七政四余】[\s\S]+^命宫：鹑首之次（未宫）/m)
    const day = chart('almanac', '--on', '2026-11-10', ...BIRTH)
    expect(day).toMatch(/^2026年11月10日 星期二 · 农历十月初二 · 丙午年己亥月戊子日/m)
    expect(day).toContain('【这一天与这张八字】')
    expect(day).toMatch(/^ {2}流日 戊子：/m)
    expect(chart('almanac')).toMatch(/^【黄历】\n2026年11月10日/)
    expect(chart('sky', '--on', '2026-11-10', '--days', '45', '--place', '东京')).toMatch(/^12\/1[345] \d\d:\d\d · 双子座流星雨/m)
  })

  it('lists the 流派 and cities, and says what was wrong with what it was asked', () => {
    expect(chart('schools')).toMatch(/^ {4}\* sameDay：日柱算当天。/m)
    expect(chart('cities')).toMatch(/^中国：北京、上海/m)
    expect(chart('--help')).toMatch(/^用法：node chart\.mjs <盘> \[选项\]/)
    expect(chart('--version')).toBe('chroniq-core dev')
    fails(['tarot'], /不认识的盘「tarot」/)
    fails(['bazi', '--date', '1990-05-17', '--time', '10:30'], /要给性别/)
    fails(['bazi', '--date', '1990-02-30', '--time', '10:30', '--gender', '男'], /不是存在的日期/)
    fails(['bazi', ...BIRTH, '--school', 'bazi.ziHour=midnight'], /没有「midnight」，可选：sameDay/)
    fails(['bazi', ...BIRTH, '--school', 'bazi.nope=1'], /没有流派「bazi\.nope」/)
    fails(['bazi', ...BIRTH, '--colour', 'red'], /不认识的选项 --colour/)
  })
})

describe('the skill as it ships', () => {
  const build = fileURLToPath(new URL('../skill/build.mjs', import.meta.url))
  const version = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')).version
  let dir: string
  let script: string
  const node = (...argv: string[]) => spawnSync(process.execPath, [script, ...argv], { encoding: 'utf8' })

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'mingli-skill-'))
    const built = spawnSync(process.execPath, [build, dir], { encoding: 'utf8' })
    if (built.status !== 0) throw new Error(built.stderr)
    script = join(dir, 'mingli-chart-reading', 'scripts', 'chart.mjs')
  }, 120_000)
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('is SKILL.md, its references and one bundled script, without the sources', () => {
    const skill = join(dir, 'mingli-chart-reading')
    expect(readdirSync(skill).sort()).toEqual(['SKILL.md', 'references', 'scripts'])
    expect(readdirSync(join(skill, 'scripts'))).toEqual(['chart.mjs'])
    expect(readdirSync(join(skill, 'references')).sort()).toEqual(['glossary-en.md', 'schools.md'])
    expect(readFileSync(join(skill, 'SKILL.md'), 'utf8')).toMatch(/^---\nname: mingli-chart-reading\ndescription: .+\n---\n/)
    // Every library inside: nothing left for node to find in node_modules
    expect(readFileSync(script, 'utf8')).not.toMatch(/from ["'](tyme4ts|iztro|astronomy-engine)["']/)
  })

  it('runs with node alone and prints the chart', () => {
    expect(node('--version').stdout.trim()).toBe(`chroniq-core ${version}`)
    const out = node('bazi', ...BIRTH, '--year', '2026')
    expect(out.status).toBe(0)
    expect(out.stdout).toContain('日主：壬水')
    expect(out.stdout).toMatch(/^ {2}流年 丙午/m)
    const ziwei = node('ziwei', ...BIRTH)
    expect(ziwei.status).toBe(0)
    expect(ziwei.stdout).toContain('【紫微斗数】')
  })

  it('exits 2 with the reason when what it is asked is wrong', () => {
    const out = node('bazi', '--date', '1990-05-17')
    expect(out.status).toBe(2)
    expect(out.stdout).toBe('')
    expect(out.stderr).toMatch(/^错误：要给出生时间/)
  })
})
