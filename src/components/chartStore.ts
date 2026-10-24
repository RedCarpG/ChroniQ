// The saved charts, shared by the 命盘 drawer and the calendar (which shows the
// charts' dates), and which of them the calendar leaves out. Both are kept in
// this browser; components read them through these hooks so every view stays
// in step when the drawer adds, removes or un-ticks a chart.
import { useSyncExternalStore } from 'react'
import { loadCharts, saveCharts, type SavedChart } from '../lib/savedCharts'

const HIDDEN_KEY = 'chroniq-calendar-hidden-charts'

let charts: SavedChart[] = loadCharts()
let hidden: string[] = (() => {
  try {
    const v = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
})()

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

function setCharts(next: SavedChart[]) {
  charts = next
  saveCharts(next)
  emit()
}

function toggleHidden(id: string) {
  hidden = hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id]
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden))
  } catch {
    // storage unavailable: lasts for this visit
  }
  emit()
}

/** The saved charts, and a way to replace them (saving to storage) */
export function useSavedCharts(): [SavedChart[], (next: SavedChart[]) => void] {
  return [useSyncExternalStore(subscribe, () => charts), setCharts]
}

/** The ids of the charts the calendar leaves out, and a toggle; every chart shows unless left out */
export function useCalendarHidden(): [string[], (id: string) => void] {
  return [useSyncExternalStore(subscribe, () => hidden), toggleHidden]
}
