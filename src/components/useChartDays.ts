import { useEffect, useMemo, useState } from 'react'
import type { SolarDay } from 'tyme4ts'
import { CHART_ITEMS, chartYear, pillarDays, taiSui, type ChartDay, type ChartItem } from '../lib/chartDays'
import { loadSchools } from '../lib/schools'
import { useT, useTerm } from '../settingsContext'
import { useCalendarHidden, useSavedCharts } from './chartStore'

type Western = typeof import('../lib/chartWestern')

const ITEMS_KEY = 'chroniq-calendar-chart-items'

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

  /** The shown charts' dates on a day (its 干支 gives the day's branch) */
  const daysOf = (solar: SolarDay, ganzhi: string): ChartDay[] => {
    if (shown.length === 0 || items.length === 0) return []
    const y = solar.getYear()
    const key = `${solar.getMonth()}-${solar.getDay()}`
    return shown.flatMap((c) => [
      ...(chartYear(c, y, items, schools).get(key) ?? []),
      ...(western && items.includes('western') ? (western.westernYear(c, y).get(key) ?? []) : []),
      ...(items.includes('clash') ? pillarDays(c, ganzhi[1], schools) : []),
    ])
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
