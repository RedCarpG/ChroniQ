import { describe, expect, it } from 'vitest'
import type { BaziInput } from '../bazi'
import { chartsBackup, mergeCharts, readBackup, type SavedChart } from '../savedCharts'

const a: BaziInput = { year: 1990, month: 5, day: 15, hour: 22, minute: 30, gender: 1 }
const b: BaziInput = { year: 1988, month: 2, day: 29, hour: 8, minute: 5, gender: 0 }
const saved: SavedChart[] = [{ id: 'x', name: 'Me', input: a }]

describe('backing up the saved charts', () => {
  it('reads back what it writes', () => {
    const back = readBackup(chartsBackup([...saved, { id: 'y', name: 'Mum', input: b }]))
    expect(back).toEqual([
      { name: 'Me', input: a },
      { name: 'Mum', input: b },
    ])
  })

  it('leaves out what is not a chart, and refuses what is not a backup', () => {
    const text = JSON.stringify({ kind: 'chroniq-charts', charts: [{ name: 'Ok', input: a }, { name: 'Bad', input: { ...a, month: 13 } }, { name: '', input: b }] })
    expect(readBackup(text)).toEqual([{ name: 'Ok', input: a }])
    expect(readBackup('not json')).toBeNull()
    expect(readBackup(JSON.stringify({ hello: 1 }))).toBeNull()
  })

  it('adds new charts, skips ones already saved, and never replaces a saved one', () => {
    const { charts, added, skipped } = mergeCharts(saved, [
      { name: 'Me again', input: a },
      { name: 'Me', input: b },
    ])
    expect(added).toBe(1)
    expect(skipped).toBe(1)
    expect(charts.map((c) => c.name)).toEqual(['Me', 'Me (2)'])
    expect(charts[0].input).toEqual(a)
    expect(charts[1].input).toEqual(b)
  })
})
