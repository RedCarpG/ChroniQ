import { useEffect, useMemo, useState } from 'react'
import { directionsAt, fieldStars, milkyWayAt, milkyWayCloud, vectorsOfStars } from '../lib/sky'
import { STAR_FIELDS } from '../lib/brightStars'
import { buildMilkyWayBand } from './skyScene'

interface DeepCatalogue {
  faint: readonly number[]
  cloud: ReturnType<typeof milkyWayCloud>
  field: ReturnType<typeof fieldStars>
}

/** Background astronomy stays independent of hover, selection and panel state. */
export function useSkyBackdrop(utc: Date, latitude: number, longitude: number, below: boolean, zoom: number, smooth: boolean, dragging: boolean) {
  const galaxy = useMemo(() => milkyWayAt(utc, latitude, longitude), [utc, latitude, longitude])
  const milkyWay = useMemo(() => buildMilkyWayBand(galaxy, below), [galaxy, below])
  const [deep, setDeep] = useState<DeepCatalogue | null>(null)
  useEffect(() => {
    let gone = false
    let timer = 0
    import('../lib/faintStars').then(({ FAINT_STARS }) => {
      if (!gone) timer = window.setTimeout(() => setDeep({ faint: FAINT_STARS, cloud: milkyWayCloud(), field: fieldStars() }), 0)
    }).catch(() => {
      // Optional detail failed to load: keep the bright sky usable offline.
    })
    return () => { gone = true; clearTimeout(timer) }
  }, [])

  const allCloud = zoom >= 2 && !smooth
  const wantField = zoom > 1.5 && !dragging && !smooth
  // Each catalogue has its own dependencies. Crossing a zoom/quality threshold
  // must not rotate every faint star again when only one layer changed.
  const cells = useMemo(() => deep && !allCloud ? {
    ...directionsAt(deep.cloud.cells.v, utc, latitude, longitude),
    light: deep.cloud.cells.light,
    warm: deep.cloud.cells.warm,
  } : null, [deep, utc, latitude, longitude, allCloud])
  const cloud = useMemo(() => deep ? {
    ...directionsAt(deep.cloud.v, utc, latitude, longitude, allCloud ? undefined : deep.cloud.bright),
    weight: deep.cloud.weight,
    warm: deep.cloud.warm,
    cells,
  } : null, [deep, utc, latitude, longitude, allCloud, cells])
  const faint = useMemo(() => deep ? {
    ...directionsAt(vectorsOfStars(deep.faint), utc, latitude, longitude),
    rows: deep.faint,
    fields: STAR_FIELDS,
  } : null, [deep, utc, latitude, longitude])
  const field = useMemo(() => deep && wantField ? {
    ...directionsAt(deep.field.v, utc, latitude, longitude),
    weight: deep.field.weight,
  } : null, [deep, utc, latitude, longitude, wantField])
  const deepSky = useMemo(() => deep ? { cloud, faint, field } : null, [deep, cloud, faint, field])
  return { milkyWay, deepSky }
}
