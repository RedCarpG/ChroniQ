import { useState } from 'react'
import type { StarPlace } from '../lib/starPrefs'

/** Asks the browser where the viewer is, for a place to look up from */
export function useLocate(onPlace: (place: StarPlace) => void) {
  const [locating, setLocating] = useState<'idle' | 'busy' | 'failed'>('idle')
  const locate = () => {
    if (!navigator.geolocation) return setLocating('failed')
    setLocating('busy')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating('idle')
        onPlace({
          name: '我的位置',
          latitude: Math.round(coords.latitude * 100) / 100,
          longitude: Math.round(coords.longitude * 100) / 100,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      },
      () => setLocating('failed'),
      { maximumAge: 600_000, timeout: 15_000 },
    )
  }
  return { locating, locate }
}
