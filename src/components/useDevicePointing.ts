import { useEffect, useRef, useState } from 'react'
import { compassAlpha, pointingFrom, smoothAngle } from '../lib/devicePointing'

type Reading = DeviceOrientationEvent & { webkitCompassHeading?: number }
type Permissioned = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }

/** How long to wait for a compass reading before saying there is none */
const NO_COMPASS_MS = 3000
/** The least turn worth showing, in degrees */
const MIN_MOVE = 0.3

export const canPoint = () => 'DeviceOrientationEvent' in window && matchMedia('(pointer: coarse)').matches

/**
 * 对准天空: follows where the phone's back points while on, smoothed, without rendering for each
 * reading: onPoint gets them. iOS asks the viewer's leave, which must come from the tap itself.
 */
export function useDevicePointing(onPoint: (az: number, alt: number) => void) {
  const [state, setState] = useState<'off' | 'on' | 'denied' | 'nocompass'>('off')
  const callback = useRef(onPoint)
  callback.current = onPoint

  const start = async () => {
    const ask = (DeviceOrientationEvent as Permissioned).requestPermission
    if (ask) {
      try {
        if ((await ask()) !== 'granted') return setState('denied')
      } catch {
        return setState('denied')
      }
    }
    setState('on')
  }
  const stop = () => setState('off')

  useEffect(() => {
    if (state !== 'on') return
    let last: { az: number; alt: number } | null = null
    let shown: { az: number; alt: number } | null = null
    const onReading = (event: Event) => {
      const e = event as Reading
      const alpha = compassAlpha(e)
      if (alpha === null || e.beta === null || e.gamma === null) return
      clearTimeout(timer)
      const next = pointingFrom(alpha, e.beta, e.gamma)
      last = last ? { az: smoothAngle(last.az, next.az, 0.25), alt: last.alt + (next.alt - last.alt) * 0.25 } : next
      // A hand is never still: moves too small to see cost a phone its time for nothing
      const gap = shown && Math.max(Math.abs(((last.az - shown.az + 540) % 360) - 180), Math.abs(last.alt - shown.alt))
      if (shown && gap !== null && gap < MIN_MOVE) return
      shown = last
      callback.current(last.az, last.alt)
    }
    const timer = setTimeout(() => setState('nocompass'), NO_COMPASS_MS)
    // Android's compass comes on the absolute event, iOS's on the ordinary one
    window.addEventListener('deviceorientationabsolute', onReading)
    window.addEventListener('deviceorientation', onReading)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('deviceorientationabsolute', onReading)
      window.removeEventListener('deviceorientation', onReading)
    }
  }, [state])

  return { state, start, stop }
}
