// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { startHantDom } from '../../hantDom'
import { loadHant } from '../../lib/hant'

beforeAll(() => loadHant())
let stop: (() => void) | null = null
afterEach(() => {
  stop?.()
  stop = null
  document.body.innerHTML = ''
})
const settle = () => new Promise((r) => setTimeout(r, 0))

describe('startHantDom', () => {
  it('converts what is on the page, and the attributes people read', () => {
    document.body.innerHTML = '<p>历法</p><button title="设置" aria-label="设置">选择</button>'
    stop = startHantDom()
    expect(document.querySelector('p')!.textContent).toBe('曆法')
    expect(document.querySelector('button')!.getAttribute('title')).toBe('設置')
    expect(document.querySelector('button')!.textContent).toBe('選擇')
  })

  it('converts what is added or changed later', async () => {
    stop = startHantDom()
    const p = document.createElement('p')
    p.textContent = '发展'
    document.body.append(p)
    await settle()
    expect(p.textContent).toBe('發展')
    p.firstChild!.nodeValue = '头发'
    await settle()
    expect(p.textContent).toBe('頭髮')
  })

  it('leaves what people type alone', async () => {
    document.body.innerHTML = '<textarea>简体</textarea><span data-no-hant>简体</span>'
    stop = startHantDom()
    await settle()
    expect(document.querySelector('textarea')!.textContent).toBe('简体')
    expect(document.querySelector('span')!.textContent).toBe('简体')
  })

  it('stops', async () => {
    stop = startHantDom()
    stop()
    stop = null
    const p = document.createElement('p')
    p.textContent = '发展'
    document.body.append(p)
    await settle()
    expect(p.textContent).toBe('发展')
  })
})
