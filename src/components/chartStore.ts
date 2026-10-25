// The saved charts, shared by the 命盘 drawer and the calendar (which shows the
// dates of the one chosen), and which one that is. Both are kept in this
// browser; components read them through these hooks so every view stays in
// step when the drawer adds, removes or chooses a chart.
import { useSyncExternalStore } from 'react'
import { loadCharts, saveCharts, type SavedChart } from '../lib/savedCharts'

const CHOSEN_KEY = 'chroniq-calendar-chart'

let charts: SavedChart[] = loadCharts()
let chosen: string | null = (() => {
  try {
    return localStorage.getItem(CHOSEN_KEY)
  } catch {
    return null
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

function choose(id: string | null) {
  chosen = id
  try {
    if (id === null) localStorage.removeItem(CHOSEN_KEY)
    else localStorage.setItem(CHOSEN_KEY, id)
  } catch {
    // storage unavailable: lasts for this visit
  }
  emit()
}

/** The saved charts, and a way to replace them (saving to storage) */
export function useSavedCharts(): [SavedChart[], (next: SavedChart[]) => void] {
  return [useSyncExternalStore(subscribe, () => charts), setCharts]
}

/** The id of the one chart whose dates the calendar shows (none until one is chosen in the drawer), and a way to choose */
export function useCalendarChart(): [string | null, (id: string | null) => void] {
  return [useSyncExternalStore(subscribe, () => chosen), choose]
}
