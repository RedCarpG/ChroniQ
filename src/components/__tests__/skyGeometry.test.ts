import { describe, expect, it } from 'vitest'
import { C, R, pathData, placeLabels, project, projectSky } from '../skyGeometry'
import { buildMilkyWayBand } from '../skyScene'
import { milkyWayAt } from '../../lib/sky'

describe('all-sky geometry', () => {
  it('keeps north up and east left, reversing east when looking below', () => {
    expect(project(0, 90)).toEqual([C, C])
    expect(project(0, 0)).toEqual([C, C - R])
    expect(project(90, 0)[0]).toBeCloseTo(C - R)
    expect(projectSky(90, 0, true)[0]).toBeCloseTo(C + R)
    expect(projectSky(0, -90, true)).toEqual([C, C])
    expect(pathData([{ az: 0, alt: 90 }, { az: 0, alt: 0 }])).toBe(`M${C.toFixed(1)} ${C.toFixed(1)}L${C.toFixed(1)} ${(C - R).toFixed(1)}`)
  })

  it('moves colliding labels and drops crowded figures while keeping bodies', () => {
    const points = Array.from({ length: 10 }, (_, i) => ({ key: String(i), text: '同一个星座', x: C, y: C, r: 1, kind: 'figure' as const }))
    const labels = placeLabels(points, 1)
    expect(labels.length).toBeGreaterThan(0)
    expect(labels.length).toBeLessThan(points.length)
    expect(new Set(labels.map((l) => `${l.x},${l.y},${l.anchor}`)).size).toBe(labels.length)
    const bodies = points.map((p) => ({ ...p, kind: 'body' as const }))
    expect(placeLabels(bodies, 1)).toHaveLength(points.length)
  })
})

it('projects finite Milky Way strokes on both halves without mutating its model', () => {
  const model = milkyWayAt(new Date('2026-10-24T18:57:00Z'), 39.9, 116.41)
  const original = structuredClone(model)
  const top = buildMilkyWayBand(model, false)
  const bottom = buildMilkyWayBand(model, true)
  for (const band of [top, bottom]) {
    expect(band.haze.length).toBeGreaterThan(0)
    for (const strokes of [band.haze, band.body, band.core, band.rift]) for (const stroke of strokes) {
      expect(stroke.d).not.toMatch(/NaN|Infinity/)
      expect(stroke.w).toBeGreaterThan(0)
      expect(stroke.o).toBeGreaterThan(0)
      expect(stroke.o).toBeLessThanOrEqual(1)
    }
  }
  expect(top).not.toEqual(bottom)
  expect(model).toEqual(original)
})
