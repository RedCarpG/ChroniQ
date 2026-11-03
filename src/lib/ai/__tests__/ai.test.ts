// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildBazi } from '../../bazi'
import { buildZiwei } from '../../ziwei'
import { DEFAULT_ZIWEI_SCHOOLS } from '../../ziweiSchools'
import { findPatterns } from '../../ziweiPatterns'
import { baziPrompt, dayPrompt, promptForPasting, systemPrompt, ziweiPrompt } from '../prompts'
import { aiLabel, aiReady, DEFAULT_AI, loadAi, saveAi } from '../settings'
import { AiError, readChatStream, streamAnswer } from '../stream'

const INPUT = { year: 1990, month: 5, day: 17, hour: 10, minute: 30, gender: 1 as const }

// The Anthropic SDK, as far as stream.ts uses it: what it was built with and asked, and a stream
const sdk = vi.hoisted(() => ({
  options: [] as unknown[],
  requests: [] as unknown[],
  stop: 'end_turn',
  text: ['你好', '，世界'],
}))
vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {}
  class AuthenticationError extends APIError {}
  class Anthropic {
    static APIError = APIError
    static AuthenticationError = AuthenticationError
    static PermissionDeniedError = class extends APIError {}
    static RateLimitError = class extends APIError {}
    static BadRequestError = class extends APIError {}
    static NotFoundError = class extends APIError {}
    static APIConnectionError = class extends APIError {}
    beta = {
      messages: {
        stream: (body: { model: string }) => {
          sdk.requests.push(body)
          if (body.model === 'bad-key') throw new AuthenticationError('invalid x-api-key')
          let onText = (_t: string) => {}
          return {
            on: (_e: string, f: (t: string) => void) => (onText = f),
            finalMessage: async () => {
              sdk.text.forEach((t) => onText(t))
              return { stop_reason: sdk.stop, stop_details: null, content: [{ type: 'text', text: sdk.text.join('') }] }
            },
          }
        },
      },
    }
    constructor(options: unknown) {
      sdk.options.push(options)
    }
  }
  return { default: Anthropic }
})

const sse = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (const s of chunks) c.enqueue(new TextEncoder().encode(s))
      c.close()
    },
  })

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('AI settings', () => {
  it('start on Claude Opus 5.5 with no key, and keep what is saved', () => {
    expect(loadAi()).toEqual(DEFAULT_AI)
    expect(DEFAULT_AI.anthropic.model).toBe('claude-opus-5-5')
    expect(aiReady(DEFAULT_AI)).toBe(false)
    const mine = { ...DEFAULT_AI, anthropic: { apiKey: 'sk-ant-x', model: 'claude-sonnet-5-5' } }
    saveAi(mine)
    expect(loadAi()).toEqual(mine)
    expect(aiReady(mine)).toBe(true)
    expect(aiLabel(mine)).toBe('Claude Sonnet 5.5')
    // A local model may need no key, only where it is and its name
    const local = {
      ...DEFAULT_AI,
      provider: 'openai' as const,
      openai: { baseUrl: 'http://localhost:11434/v1', apiKey: '', model: 'qwen3' },
    }
    expect(aiReady(local)).toBe(true)
    expect(aiLabel(local)).toBe('qwen3')
  })

  it('read spoilt storage as the defaults', () => {
    localStorage.setItem('chroniq-ai', '{"provider":"x","anthropic":5}')
    expect(loadAi().provider).toBe('anthropic')
    localStorage.setItem('chroniq-ai', 'not json')
    expect(loadAi()).toEqual(DEFAULT_AI)
  })
})

describe('AI prompts', () => {
  it('hand over the chart in full, as cast, and say not to cast it again', () => {
    expect(systemPrompt('zh')).toContain('不要自己重新排盘')
    expect(systemPrompt('en')).toContain('Write in English')
    const bazi = baziPrompt(buildBazi(INPUT), 2026)
    expect(bazi).toContain('日主：壬水')
    expect(bazi).toContain('2026 年流年')
    const chart = buildZiwei(INPUT, DEFAULT_ZIWEI_SCHOOLS)
    expect(ziweiPrompt(chart, findPatterns(chart), 2026)).toMatch(/命宫（戊子）/)
  })

  it('read a day alone, or with a chart and what ChroniQ found between them', () => {
    const alone = dayPrompt(2026, 11, 3)
    expect(alone).toContain('农历九月廿五')
    expect(alone).not.toContain('八字')
    const withChart = dayPrompt(2026, 11, 3, {
      name: '我',
      bazi: buildBazi(INPUT),
      notes: ['今天的日干辛对日主壬是正印'],
    })
    expect(withChart).toContain('「我」的八字')
    expect(withChart).toContain('- 今天的日干辛对日主壬是正印')
    expect(promptForPasting('系统', '问题')).toBe('系统\n\n---\n\n问题')
  })
})

describe('asking Claude', () => {
  const claude = { ...DEFAULT_AI, anthropic: { apiKey: ' sk-ant-x ', model: 'claude-opus-5-5' } }

  it('from the browser with the reader’s key, streaming, falling back on a declined request', async () => {
    const seen: string[] = []
    const r = await streamAnswer(claude, '系统', [{ role: 'user', content: '问' }], (d) => seen.push(d))
    expect(r).toEqual({ text: '你好，世界', cut: false })
    expect(seen).toEqual(['你好', '，世界'])
    expect(sdk.options.at(-1)).toEqual({ apiKey: 'sk-ant-x', dangerouslyAllowBrowser: true })
    expect(sdk.requests.at(-1)).toMatchObject({
      model: 'claude-opus-5-5',
      system: '系统',
      fallbacks: 'default',
      betas: ['server-side-fallback-2026-07-01'],
    })
    // Haiku has no fallback
    await streamAnswer({ ...claude, anthropic: { apiKey: 'k', model: 'claude-haiku-5-5' } }, 's', [], () => {})
    expect(sdk.requests.at(-1)).not.toHaveProperty('fallbacks')
  })

  it('says why it failed: a bad key, a refusal, an answer cut short', async () => {
    await expect(
      streamAnswer({ ...claude, anthropic: { apiKey: 'k', model: 'bad-key' } }, 's', [], () => {}),
    ).rejects.toMatchObject({ kind: 'key' })
    sdk.stop = 'refusal'
    await expect(streamAnswer(claude, 's', [], () => {})).rejects.toBeInstanceOf(AiError)
    sdk.stop = 'max_tokens'
    expect((await streamAnswer(claude, 's', [], () => {})).cut).toBe(true)
    sdk.stop = 'end_turn'
  })
})

describe('asking an OpenAI-compatible service', () => {
  const openai = {
    ...DEFAULT_AI,
    provider: 'openai' as const,
    openai: { baseUrl: 'https://api.example.com/v1/', apiKey: 'k', model: 'm' },
  }

  it('reads its stream, events split anywhere across chunks', async () => {
    const seen: string[] = []
    const r = await readChatStream(
      sse([
        'data: {"choices":[{"delta":{"content":"你"}}]}\n\nda',
        'ta: {"choices":[{"delta":{"content":"好"}}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n',
      ]),
      (d) => seen.push(d),
    )
    expect(r).toEqual({ text: '你好', cut: true })
    expect(seen).toEqual(['你', '好'])
  })

  it('posts the system prompt and the turns to /chat/completions with the key', async () => {
    const fetch = vi.fn(async () => new Response(sse(['data: {"choices":[{"delta":{"content":"好"}}]}\n\n'])))
    vi.stubGlobal('fetch', fetch)
    expect((await streamAnswer(openai, '系统', [{ role: 'user', content: '问' }], () => {})).text).toBe('好')
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.example.com/v1/chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k')
    expect(JSON.parse(init.body as string)).toEqual({
      model: 'm',
      stream: true,
      messages: [
        { role: 'system', content: '系统' },
        { role: 'user', content: '问' },
      ],
    })
  })

  it('says why it failed', async () => {
    vi.stubGlobal('fetch', async () => new Response('{"error":{"message":"bad key"}}', { status: 401 }))
    await expect(streamAnswer(openai, 's', [], () => {})).rejects.toMatchObject({ kind: 'key', message: '401 bad key' })
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(streamAnswer(openai, 's', [], () => {})).rejects.toMatchObject({ kind: 'network' })
  })
})
