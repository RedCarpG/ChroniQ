// @vitest-environment happy-dom
import './dom'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePick } from '../usePick'

function Things() {
  const pick = usePick<string>()
  return (
    <div className="page">
      <p className="lit">{pick.active ?? '-'}</p>
      {['a', 'b'].map((k) => (
        <span key={k} className={k} {...pick.props(k)}>
          {k}
        </span>
      ))}
      <button>a control</button>
    </div>
  )
}

describe('usePick', () => {
  it('lights up what is hovered, keeps what is clicked, and lets go on a click on empty space', () => {
    const { container } = render(<Things />)
    const [a, b] = [container.querySelector('.a')!, container.querySelector('.b')!]
    const lit = () => container.querySelector('.lit')!.textContent
    fireEvent.pointerEnter(a, { pointerType: 'mouse' })
    expect(lit()).toBe('a')
    fireEvent.pointerLeave(a, { pointerType: 'mouse' })
    expect(lit()).toBe('-')
    // A click keeps it, after the pointer has gone
    fireEvent.click(a)
    expect(a.hasAttribute('data-picked')).toBe(true)
    expect(lit()).toBe('a')
    // Hovering another shows that one meanwhile, then back to the chosen one
    fireEvent.pointerEnter(b, { pointerType: 'mouse' })
    expect(lit()).toBe('b')
    fireEvent.pointerLeave(b, { pointerType: 'mouse' })
    expect(lit()).toBe('a')
    // The page's own controls leave it alone; empty space lets go
    fireEvent.click(container.querySelector('button')!)
    expect(lit()).toBe('a')
    fireEvent.click(container.querySelector('.page')!)
    expect(lit()).toBe('-')
    // Clicking the chosen one again lets go too, and so does Esc
    fireEvent.click(b)
    fireEvent.click(b)
    expect(lit()).toBe('-')
    fireEvent.click(b)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(lit()).toBe('-')
  })
})
