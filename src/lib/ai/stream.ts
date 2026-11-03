// Asking the chosen service, straight from the browser with the reader's own key (there is no server
// in between), the answer streamed in as it is written. Claude through Anthropic's SDK, loaded only
// when first asked; an OpenAI-compatible service through its chat completions API.

import type { AiSettings } from './settings'

export interface AiTurn {
  role: 'user' | 'assistant'
  content: string
}

/** What went wrong, in a kind the panel can say something useful about */
export type AiErrorKind = 'key' | 'rate' | 'network' | 'refused' | 'request' | 'server'

export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    message: string,
  ) {
    super(message)
  }
}

export interface AiResult {
  text: string
  /** Stopped at the length limit, part-way through */
  cut: boolean
}

/** Claude models that can hand a declined request on to another model by themselves */
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5'])

export async function streamAnswer(
  settings: AiSettings,
  system: string,
  turns: AiTurn[],
  onText: (delta: string) => void,
  signal?: AbortSignal,
): Promise<AiResult> {
  return settings.provider === 'openai'
    ? streamOpenAi(settings.openai, system, turns, onText, signal)
    : streamClaude(settings.anthropic, system, turns, onText, signal)
}

async function streamClaude(
  { apiKey, model }: AiSettings['anthropic'],
  system: string,
  turns: AiTurn[],
  onText: (delta: string) => void,
  signal?: AbortSignal,
): Promise<AiResult> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  // The key is the reader's own and stays in their browser: there is no server here to hide it in
  const client = new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true })
  try {
    const stream = client.beta.messages.stream(
      {
        model,
        max_tokens: 32000,
        system,
        messages: turns,
        // A request a safety check declines goes on to another model rather than ending there
        ...(FALLBACK_MODELS.has(model)
          ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
          : {}),
      },
      { signal },
    )
    stream.on('text', onText)
    const message = await stream.finalMessage()
    if (message.stop_reason === 'refusal') throw new AiError('refused', message.stop_details?.explanation ?? '')
    const text = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
    return { text, cut: message.stop_reason === 'max_tokens' }
  } catch (err) {
    if (err instanceof AiError) throw err
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError)
      throw new AiError('key', err.message)
    if (err instanceof Anthropic.RateLimitError) throw new AiError('rate', err.message)
    if (err instanceof Anthropic.BadRequestError || err instanceof Anthropic.NotFoundError)
      throw new AiError('request', err.message)
    if (err instanceof Anthropic.APIConnectionError) throw new AiError('network', err.message)
    if (err instanceof Anthropic.APIError) throw new AiError('server', err.message)
    throw err
  }
}

async function streamOpenAi(
  { baseUrl, apiKey, model }: AiSettings['openai'],
  system: string,
  turns: AiTurn[],
  onText: (delta: string) => void,
  signal?: AbortSignal,
): Promise<AiResult> {
  let res: Response
  try {
    res = await fetch(`${baseUrl.trim().replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : {}),
      },
      body: JSON.stringify({
        model: model.trim(),
        stream: true,
        messages: [{ role: 'system', content: system }, ...turns],
      }),
      signal,
    })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new AiError('network', err instanceof Error ? err.message : String(err))
  }
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '')
    let message = detail
    try {
      message = (JSON.parse(detail) as { error?: { message?: string } }).error?.message ?? detail
    } catch {
      // not JSON: keep the text
    }
    const kind: AiErrorKind =
      res.status === 401 || res.status === 403
        ? 'key'
        : res.status === 429
          ? 'rate'
          : res.status >= 500
            ? 'server'
            : 'request'
    throw new AiError(kind, `${res.status} ${message}`.trim())
  }
  return readChatStream(res.body, onText)
}

/** An OpenAI-style stream (server-sent events of chat completion chunks) as text */
export async function readChatStream(
  body: ReadableStream<Uint8Array>,
  onText: (delta: string) => void,
): Promise<AiResult> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let cut = false
  const take = (line: string) => {
    if (!line.startsWith('data:')) return
    const data = line.slice(5).trim()
    if (!data || data === '[DONE]') return
    let chunk: {
      choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[]
      error?: { message?: string }
    }
    try {
      chunk = JSON.parse(data)
    } catch {
      return
    }
    if (chunk.error) throw new AiError('server', chunk.error.message ?? '')
    const choice = chunk.choices?.[0]
    const delta = choice?.delta?.content
    if (delta) {
      text += delta
      onText(delta)
    }
    if (choice?.finish_reason === 'length') cut = true
  }
  for (;;) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const lines = buffer.split(/\r?\n/)
    buffer = done ? '' : (lines.pop() ?? '')
    for (const line of lines) take(line)
    if (done) break
  }
  return { text, cut }
}
