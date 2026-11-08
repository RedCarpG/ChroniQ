import { useState } from 'react'

/**
 * An on/off choice kept in this browser (a fold opened, a fuller view chosen), so the page opens as it
 * was left. Without storage it lasts for the visit.
 */
export function useStoredFlag(key: string, initial: boolean): [boolean, () => void] {
  const [on, setOn] = useState(() => {
    try {
      const v = localStorage.getItem(key)
      return v === null ? initial : v === 'on'
    } catch {
      return initial
    }
  })
  const toggle = () => {
    setOn(!on)
    try {
      localStorage.setItem(key, on ? 'off' : 'on')
    } catch {
      // storage unavailable: lasts for this visit
    }
  }
  return [on, toggle]
}
