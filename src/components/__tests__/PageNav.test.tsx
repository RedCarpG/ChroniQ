// @vitest-environment happy-dom
import './dom'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PageNav } from '../PageMenu'

const names = (el: HTMLElement) => [...el.querySelectorAll('.page-nav-group.open .page-nav-item')].map((b) => b.textContent)
const openTitle = (el: HTMLElement) => el.querySelector('.page-nav-group.open .page-nav-group-btn')?.textContent
const click = (el: HTMLElement, text: string) => fireEvent.click([...el.querySelectorAll('button')].find((b) => b.textContent === text)!)

describe('PageNav', () => {
  it("opens the current page's group and folds the other", () => {
    const { container } = render(<PageNav page="calendar" onPick={() => {}} />)
    expect(names(container)).toContain('日曆')
    expect(names(container)).not.toContain('星盤')
    expect(openTitle(container)).toBe('曆法')
    expect(container.querySelector('.on')?.textContent).toBe('日曆')
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('日曆')
  })

  it('opens another group in its place, and goes back on a click elsewhere', () => {
    const { container } = render(<PageNav page="calendar" onPick={() => {}} />)
    click(container, '命理')
    expect(names(container)).toContain('星盤')
    expect(names(container)).not.toContain('日曆')
    fireEvent.pointerDown(document.body)
    expect(names(container)).toContain('日曆')
    expect(names(container)).not.toContain('星盤')
  })

  it('goes back on Escape', () => {
    const { container } = render(<PageNav page="calendar" onPick={() => {}} />)
    click(container, '命理')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(names(container)).toContain('日曆')
  })

  it('picks a page from the opened group and lets the group follow the page', () => {
    const onPick = vi.fn()
    const { container, rerender } = render(<PageNav page="calendar" onPick={onPick} />)
    click(container, '命理')
    click(container, '星盤')
    expect(onPick).toHaveBeenCalledWith('star')
    rerender(<PageNav page="star" onPick={onPick} />)
    expect(names(container)).toContain('星盤')
    expect(container.querySelector('.on')?.textContent).toBe('星盤')
  })

  it('marks the open group, and goes back when its name is pressed again', () => {
    const { container } = render(<PageNav page="calendar" onPick={() => {}} />)
    click(container, '命理')
    expect(openTitle(container)).toBe('命理')
    expect(container.querySelector('.page-nav-group.open .page-nav-group-btn')?.getAttribute('aria-expanded')).toBe('true')
    click(container, '命理')
    expect(openTitle(container)).toBe('曆法')
  })
})
