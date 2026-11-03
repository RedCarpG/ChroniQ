// @vitest-environment happy-dom
import './dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiAnalysis } from '../AiAnalysis'
import { blocks } from '../AiText'
import { DEFAULT_AI, saveAi } from '../../lib/ai/settings'

const sse = (...texts: string[]) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        for (const t of texts)
          c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`))
        c.close()
      },
    }),
  )

const useService = () =>
  saveAi({
    ...DEFAULT_AI,
    provider: 'openai',
    openai: { baseUrl: 'https://api.example.com/v1', apiKey: 'k', model: 'test-model' },
  })

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('AiText', () => {
  it('reads headings, lists and paragraphs, and never makes HTML of an answer', () => {
    expect(blocks('## 总论\n日主偏弱，\n喜印比。\n\n- 一\n- 二\n1. 甲\n---')).toEqual([
      { kind: 'h', level: 2, text: '总论' },
      { kind: 'p', text: '日主偏弱， 喜印比。' },
      { kind: 'ul', items: ['一', '二'] },
      { kind: 'ol', items: ['甲'] },
      { kind: 'hr' },
    ])
  })
})

describe('AiAnalysis', () => {
  it('without a key: says how to add one, and offers the prompt to paste elsewhere', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    render(<AiAnalysis id="x" prompt="这是一张八字命盘" />)
    expect(screen.queryByText('生成解读')).toBeNull()
    expect(screen.getByText(/填上自己的 API key/)).toBeTruthy()
    fireEvent.click(screen.getByText('复制提示词'))
    await waitFor(() => expect(screen.getByText('已复制')).toBeTruthy())
    const pasted = (writeText.mock.calls[0] as unknown as [string])[0]
    expect(pasted).toContain('不要自己重新排盘')
    expect(pasted.endsWith('这是一张八字命盘')).toBe(true)
    expect(screen.getByText('打开 Claude').getAttribute('href')).toBe('https://claude.ai/new')
  })

  it('saves the service chosen in its settings, in this browser', () => {
    render(<AiAnalysis id="x" prompt="盘" />)
    fireEvent.click(screen.getByText('设置'))
    fireEvent.click(screen.getByText('兼容 OpenAI 的接口'))
    fireEvent.change(screen.getByPlaceholderText('deepseek-chat'), { target: { value: 'qwen3' } })
    fireEvent.click(screen.getByText('保存'))
    expect(JSON.parse(localStorage.getItem('chroniq-ai')!)).toMatchObject({
      provider: 'openai',
      openai: { model: 'qwen3' },
    })
    expect(screen.getByText('qwen3')).toBeTruthy()
    expect(screen.getByText('生成解读')).toBeTruthy()
  })

  it('writes a reading as it streams in, then takes follow-up questions with the conversation so far', async () => {
    useService()
    const bodies: { messages: { role: string; content: string }[] }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(init.body as string))
        return bodies.length === 1 ? sse('## 总论\n', '日主**偏弱**。') : sse('适合。')
      }),
    )
    render(<AiAnalysis id="x" prompt="盘" />)
    fireEvent.click(screen.getByText('生成解读'))
    await waitFor(() => expect(screen.getByText('总论')).toBeTruthy())
    expect(screen.getByText('偏弱').tagName).toBe('STRONG')
    // The chart itself is not shown back; the answer is
    expect(screen.queryByText('盘')).toBeNull()

    const box = screen.getByLabelText('接着问')
    fireEvent.change(box, { target: { value: '今年适合换工作吗？' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    await waitFor(() => expect(screen.getByText('适合。')).toBeTruthy())
    expect(screen.getByText('今年适合换工作吗？')).toBeTruthy()
    expect(bodies[1].messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user'])
    expect(bodies[1].messages[2].content).toBe('## 总论\n日主**偏弱**。')
    expect(screen.getByText('重新解读')).toBeTruthy()
  })

  it('says what went wrong, and gives a failed question back to ask again', async () => {
    useService()
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => (++calls === 1 ? sse('好。') : new Response('{"error":{"message":"quota"}}', { status: 429 }))),
    )
    render(<AiAnalysis id="x" prompt="盘" />)
    fireEvent.click(screen.getByText('生成解读'))
    await waitFor(() => expect(screen.getByText('好。')).toBeTruthy())
    const box = screen.getByLabelText('接着问') as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: '再说说' } })
    fireEvent.click(screen.getByText('发送'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('额度用完了'))
    expect((screen.getByLabelText('接着问') as HTMLTextAreaElement).value).toBe('再说说')
    expect(screen.queryByText('再说说', { selector: '.ai-question' })).toBeNull()
  })

  it('starts afresh for another chart', async () => {
    useService()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sse('第一张。')),
    )
    const { rerender } = render(<AiAnalysis id="x" prompt="盘一" />)
    fireEvent.click(screen.getByText('生成解读'))
    await waitFor(() => expect(screen.getByText('第一张。')).toBeTruthy())
    await act(async () => rerender(<AiAnalysis id="x" prompt="盘二" />))
    expect(screen.queryByText('第一张。')).toBeNull()
  })
})
