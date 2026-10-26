import { useEffect, useMemo, useRef, useState } from 'react'
import type { SolarDay } from 'tyme4ts'
import { CHART_ITEMS, chartYear, pillarDays, taiSui, type ChartDay, type ChartItem } from '../lib/chartDays'
import { loadSchools } from '../lib/schools'
import { useT, useTerm } from '../settingsContext'
import { useCalendarChart, useSavedCharts } from './chartStore'

type Western = typeof import('../lib/westernClient')

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
 * The saved charts' dates for the calendar: which chart shows (the one chosen
 * in the 命盘 drawer, if any), which kinds of date (chosen in the day panel,
 * kept in this browser), the dates on a day, and their wording. The 星盘 dates
 * need astronomy-engine, loaded only once they are asked for.
 */
export function useChartDays() {
  const [charts] = useSavedCharts()
  const [chosen] = useCalendarChart()
  const shown = useMemo(() => charts.filter((c) => c.id === chosen), [charts, chosen])
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
  const [westernError, setWesternError] = useState(false)
  useEffect(() => {
    if (!wantWestern || western || westernError) return
    let active = true
    import('../lib/westernClient').then((m) => { if (active) setWestern(() => m) }).catch(() => { if (active) setWesternError(true) })
    return () => { active = false }
  }, [wantWestern, western, westernError])

  const requests = useRef(new Map<string, { chart: (typeof shown)[number]; year: number }>())
  requests.current.clear()
  const tasks = useRef(new Map<string, AbortController>())
  const failed = useRef(new Set<string>())
  const [westernVersion, setWesternVersion] = useState(0)
  const [calculating, setCalculating] = useState(false)
  const westernOf = (chart: (typeof shown)[number], year: number) => {
    if (!western) return undefined
    const result = western.peekWesternYear(chart, year)
    if (!result) requests.current.set(JSON.stringify([chart.id, chart.name, chart.input, year]), { chart, year })
    return result
  }
  // Schedule after commit, never during render. A chart/filter change or leaving
  // the calendar cancels obsolete work, including the worker when no jobs remain.
  useEffect(() => {
    const running = tasks.current
    setCalculating(false)
    return () => {
      for (const controller of running.values()) controller.abort()
      running.clear()
    }
  }, [shown, items])
  useEffect(() => {
    if (!western || !wantWestern) return
    for (const [key, { chart, year }] of requests.current) {
      if (tasks.current.has(key) || failed.current.has(key)) continue
      const controller = new AbortController()
      tasks.current.set(key, controller)
      setCalculating(true)
      western.westernYearAsync(chart, year, controller.signal).then(() => {
        if (!controller.signal.aborted) setWesternVersion((v) => v + 1)
      }).catch(() => {
        if (!controller.signal.aborted) { failed.current.add(key); setWesternError(true) }
      }).finally(() => {
        if (!controller.signal.aborted) {
          tasks.current.delete(key)
          setCalculating(tasks.current.size > 0)
        }
      })
    }
  })
  const retryWestern = () => {
    failed.current.clear()
    setWesternError(false)
    setWesternVersion((v) => v + 1)
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

  return { charts, shown, items, toggleItem, daysOf, taiSuiOf, westernError, retryWestern, westernLoading: wantWestern && (!western || calculating) }
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
