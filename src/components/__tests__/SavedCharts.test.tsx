// @vitest-environment happy-dom
import './dom'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { BaziInput } from '../../lib/bazi'
import { chartsBackup } from '../../lib/savedCharts'
import { SavedChartsDrawer } from '../SavedCharts'

const a: BaziInput = { year: 1990, month: 5, day: 15, hour: 22, minute: 30, gender: 1 }
const b: BaziInput = { year: 1988, month: 2, day: 29, hour: 8, minute: 5, gender: 0 }

describe('the charts drawer’s backup', () => {
  it('imports a backup file: new charts added, saved ones skipped', async () => {
    const { container } = render(<SavedChartsDrawer input={a} onLoad={() => {}} />)
    // Save the current chart first
    fireEvent.change(container.querySelector('.saved-form input')!, { target: { value: 'Me' } })
    fireEvent.submit(container.querySelector('.saved-form')!)
    const text = chartsBackup([
      { id: '1', name: 'Me', input: a },
      { id: '2', name: 'Mum', input: b },
    ])
    const input = container.querySelector<HTMLInputElement>('.saved-backup input[type=file]')!
    const file = new File([text], 'backup.json', { type: 'application/json' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    await act(async () => {
      fireEvent.change(input)
    })
    await waitFor(() => expect(container.querySelector('.saved-backup-note')!.textContent).toBe('导入 1 张，跳过 1 张已有的'))
    expect([...container.querySelectorAll('.saved-name')].map((n) => n.textContent)).toEqual(['Me', 'Mum'])
  })

  it('says so when the file is not a backup', async () => {
    const { container } = render(<SavedChartsDrawer input={a} onLoad={() => {}} />)
    const input = container.querySelector<HTMLInputElement>('.saved-backup input[type=file]')!
    Object.defineProperty(input, 'files', { value: [new File(['{"x":1}'], 'x.json')], configurable: true })
    await act(async () => {
      fireEvent.change(input)
    })
    await waitFor(() => expect(container.querySelector('.saved-backup-note')!.textContent).toBe('这不是星曆的命盘备份文件'))
  })
})
