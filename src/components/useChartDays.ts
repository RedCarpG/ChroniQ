import { useEffect, useMemo, useRef, useState } from 'react'
import type { SolarDay } from 'tyme4ts'
import { CHART_ITEMS, chartYear, pillarDays, taiSui, type ChartDay, type ChartItem } from '../lib/chartDays'
import { loadSchools } from '../lib/schools'
import { useT, useTerm } from '../settingsContext'
import { useCalendarHidden, useSavedCharts } from './chartStore'

type Western = typeof import('../lib/chartWestern')

const ITEMS_KEY = 'chroniq-calendar-chart-items'
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'

function loadItems(): ChartItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(ITEMS_KEY) ?? 'null')
    return Array.isArray(v) ? CHART_ITEMS.filter((i) => v.includes(i)) : CHART_ITEMS
  } catch {
    return CHART_ITEMS
  }
}

// Names for the 星盘 dates' parts; their English is in the 星盘 dictionary
const PLANET: Record<string, string> = { jupiter: '木星', saturn: '土星', uranus: '天王星', neptune: '海王星', pluto: '冥王星' }
const ASPECT: Record<string, string> = { conjunction: '合', square: '刑', trine: '拱', opposition: '冲' }
const POINT: Record<string, string> = { sun: '太阳', moon: '月亮', asc: '上升' }

/**
 * The saved charts' dates for the calendar: which charts show (all but those
 * un-ticked in the 命盘 drawer), which kinds of date (chosen in the day panel,
 * kept in this browser), the dates on a day, and their wording. The 星盘 dates
 * need astronomy-engine, loaded only once they are asked for.
 */
export function useChartDays() {
  const [charts] = useSavedCharts()
  const [hidden] = useCalendarHidden()
  const shown = useMemo(() => charts.filter((c) => !hidden.includes(c.id)), [charts, hidden])
  const [items, setItems] = useState<ChartItem[]>(loadItems)
  const toggleItem = (item: ChartItem) => {
    const next = items.includes(item) ? items.filter((i) => i !== item) : CHART_ITEMS.filter((i) => i === item || items.includes(i))
    setItems(next)
    try {
      localStorage.setItem(ITEMS_KEY, JSON.stringify(next))
    } catch {
      // storage unavailable: lasts for this visit
    }
  }
  const schools = useMemo(loadSchools, [])
  const [western, setWestern] = useState<Western | null>(null)
  const wantWestern = items.includes('western') && shown.length > 0
  useEffect(() => {
    if (wantWestern && !western) import('../lib/chartWestern').then((m) => setWestern(() => m))
  }, [wantWestern, western])

  // A year of 星盘 dates takes a while to work out (daily planet positions), so it is done
  // just after the year is first shown, when the page is idle, not while the calendar moves
  const westernDone = useRef(new Map<string, Map<string, ChartDay[]>>())
  const westernQueued = useRef(new Set<string>())
  const [westernVersion, setWesternVersion] = useState(0)
  const westernOf = (c: (typeof shown)[number], year: number) => {
    if (!western) return undefined
    const key = JSON.stringify([c.id, c.name, c.input, year])
    const done = westernDone.current.get(key)
    if (done || westernQueued.current.has(key)) return done
    westernQueued.current.add(key)
    const run = () => {
      westernDone.current.set(key, western.westernYear(c, year))
      setWesternVersion((v) => v + 1)
    }
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1500 })
    else setTimeout(run, 50)
    return undefined
  }

  // Looked up per day cell, so built once: each year's dates for all shown charts (as each
  // year is first needed), and the 冲 / 合 / 刑 for each of the twelve day branches
  const index = useMemo(() => {
    const years = new Map<number, Map<string, ChartDay[]>>()
    const byBranch = new Map<string, ChartDay[]>()
    if (items.includes('clash')) for (const b of BRANCHES) byBranch.set(b, shown.flatMap((c) => pillarDays(c, b, schools)))
    const yearDays = (year: number) => {
      let days = years.get(year)
      if (!days) {
        days = new Map()
        const add = (from: Map<string, ChartDay[]>) => {
          for (const [k, v] of from) days!.set(k, [...(days!.get(k) ?? []), ...v])
        }
        for (const c of shown) {
          add(chartYear(c, year, items, schools))
          const west = items.includes('western') ? westernOf(c, year) : undefined
          if (west) add(west)
        }
        years.set(year, days)
      }
      return days
    }
    return { yearDays, byBranch }
    // westernOf reads refs; westernVersion re-runs this once a 星盘 year is ready
  }, [shown, items, schools, western, westernVersion])

  /** The shown charts' dates on a day (its 干支 gives the day's branch) */
  const daysOf = (solar: SolarDay, ganzhi: string): ChartDay[] => {
    if (shown.length === 0 || items.length === 0) return []
    const dated = index.yearDays(solar.getYear()).get(`${solar.getMonth()}-${solar.getDay()}`) ?? []
    const branch = index.byBranch.get(ganzhi[1]) ?? []
    return branch.length ? [...dated, ...branch] : dated
  }
  /** 本命年 / 冲太岁 of the shown charts in a 干支 year (by its branch) */
  const taiSuiOf = (yearBranch: string) =>
    items.includes('fortune')
      ? shown.flatMap((c) => {
          const which = taiSui(c, yearBranch, schools)
          return which ? [{ name: c.name, which }] : []
        })
      : []

  return { charts, shown, items, toggleItem, daysOf, taiSuiOf, westernLoading: wantWestern && !western }
}

/** Words a chart date in the UI language */
export function useChartDayText() {
  const t = useT()
  const term = useTerm()
  return (d: ChartDay): string => {
    const name = d.name
    switch (d.kind) {
      case 'birthday':
        return t('{name}生日（{age} 岁）', { name, age: d.age })
      case 'lunarBirthday':
        return t('{name}农历生日', { name })
      case 'pillar':
        return d.pillar === '日柱'
          ? d.relation === '冲'
            ? t('冲{name}日柱', { name })
            : d.relation === '合'
              ? t('合{name}日柱', { name })
              : t('刑{name}日柱', { name })
          : d.relation === '冲'
            ? t('冲{name}年柱', { name })
            : d.relation === '合'
              ? t('合{name}年柱', { name })
              : t('刑{name}年柱', { name })
      case 'decade':
        return t('{name}交大运（{ganzhi}运）', { name, ganzhi: term(d.ganzhi) })
      case 'solarReturn':
        return t('{name}太阳回归', { name })
      case 'transit':
        return t('{planet}{aspect}{name}的{point}', {
          planet: t(PLANET[d.planet]),
          aspect: t(ASPECT[d.aspect]),
          name,
          point: t(POINT[d.point]),
        })
    }
  }
}
