// @vitest-environment happy-dom
import './dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExportButton } from '../ExportButton'

// No WebGL or 2D canvas in the test DOM: the posters still open, their pictures left blank
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

describe('the chart pages’ export menu', () => {
  it('offers the birth Moon poster beside the birth sky, titled for the birth, leading on to 观月', async () => {
    const onViewMoon = vi.fn()
    render(<ExportButton chart={{ tab: 'bazi', input: { year: 1990, month: 5, day: 15, hour: 22, minute: 30, gender: 1 } }} onViewMoon={onViewMoon} />)
    fireEvent.click(screen.getByRole('button', { name: '导出命盘' }))
    const items = screen.getAllByRole('menuitem').map((m) => m.textContent)
    expect(items).toEqual(['保存为图片', '生辰星空海报', '生辰月相海报', '打印'])
    fireEvent.click(screen.getByRole('menuitem', { name: '生辰月相海报' }))
    const dialog = await screen.findByRole('dialog', { name: '生辰月相海报' })
    expect(dialog.querySelector<HTMLInputElement>('.poster-title input')!.placeholder).toBe('生辰月相')
    fireEvent.click(screen.getByRole('button', { name: '在观月中查看 →' }))
    expect(onViewMoon).toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
