// @vitest-environment happy-dom
import './dom'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { directionsAt } from '../../lib/sky'
import { useSkyBackdrop } from '../useSkyBackdrop'

vi.mock('../../lib/faintStars', () => ({ FAINT_STARS: [1, 10, 20, 5.5, 0.6] }))
vi.mock('../../lib/sky', async (original) => {
  const actual = await original<typeof import('../../lib/sky')>()
  return {
    ...actual,
    milkyWayCloud: () => ({ v: new Float64Array([1, 0, 0, 0, 1, 0]), weight: new Float32Array([1, 0.5]), warm: new Uint8Array([0, 1]), bright: 1, cells: { v: new Float64Array([1, 0, 0]), light: new Float32Array([1]), warm: new Uint8Array([0]) } }),
    fieldStars: () => ({ v: new Float64Array([0, 0, 1]), weight: new Float32Array([1]) }),
    directionsAt: vi.fn((v: Float64Array, _utc: Date, _lat: number, _lon: number, count = v.length / 3) => ({ az: new Float32Array(count), alt: new Float32Array(count) })),
  }
})
const utc = new Date('2026-10-24T18:57:00Z')
const initial = { zoom: 1.6, smooth: false, dragging: false, below: false, longitude: 116.41 }

describe('independent sky layers', () => {
  it('rotates only the star cloud at its detail threshold, retaining other layers', async () => {
    const { result, rerender } = renderHook((p) => useSkyBackdrop(utc, 39.9, p.longitude, p.below, p.zoom, p.smooth, p.dragging), { initialProps: initial })
    await waitFor(() => expect(result.current.deepSky).not.toBeNull())
    const first = result.current.deepSky!
    vi.mocked(directionsAt).mockClear()
    rerender({ ...initial, zoom: 2.1 })
    expect(directionsAt).toHaveBeenCalledTimes(1)
    expect(result.current.deepSky!.faint).toBe(first.faint)
    expect(result.current.deepSky!.field).toBe(first.field)
    expect(result.current.deepSky!.cloud!.cells).toBeNull()
    expect(result.current.deepSky!.cloud!.az.length).toBe(2)

    vi.mocked(directionsAt).mockClear()
    rerender({ ...initial, zoom: 2.2, below: true })
    expect(directionsAt).not.toHaveBeenCalled()
    rerender({ ...initial, zoom: 2.2, below: true, longitude: 121.47 })
    expect(directionsAt).toHaveBeenCalledTimes(3)
  })

  it('omits the deep field during a drag without recalculating the remaining layers', async () => {
    const { result, rerender } = renderHook((p) => useSkyBackdrop(utc, 39.9, 116.41, false, p.zoom, false, p.dragging), { initialProps: initial })
    await waitFor(() => expect(result.current.deepSky).not.toBeNull())
    const first = result.current.deepSky!
    vi.mocked(directionsAt).mockClear()
    rerender({ ...initial, dragging: true })
    expect(directionsAt).not.toHaveBeenCalled()
    expect(result.current.deepSky!.field).toBeNull()
    expect(result.current.deepSky!.faint).toBe(first.faint)
    expect(result.current.deepSky!.cloud).toBe(first.cloud)
  })
})
