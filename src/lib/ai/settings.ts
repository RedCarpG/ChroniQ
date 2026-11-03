// AI 解读's settings, kept in this browser only: which service reads the charts, with the reader's
// own key. Claude (Anthropic's API), or any service that speaks OpenAI's chat API (DeepSeek, Qwen,
// a model on this computer…). The key never goes anywhere but the service it is for.

export type AiProvider = 'anthropic' | 'openai'

export interface AiSettings {
  provider: AiProvider
  anthropic: { apiKey: string; model: string }
  /** An OpenAI-compatible service: where it is (…/v1), its key (some local ones need none) and model */
  openai: { baseUrl: string; apiKey: string; model: string }
}

/** The Claude models offered, most capable first */
export const CLAUDE_MODELS = [
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5' },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5' },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5' },
] as const

export const DEFAULT_AI: AiSettings = {
  provider: 'anthropic',
  anthropic: { apiKey: '', model: CLAUDE_MODELS[0].id },
  openai: { baseUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-chat' },
}

const KEY = 'chroniq-ai'

const text = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback)

export function loadAi(): AiSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Record<keyof AiSettings, unknown>> | null
    if (!raw || typeof raw !== 'object') return DEFAULT_AI
    const a = (raw.anthropic ?? {}) as Record<string, unknown>
    const o = (raw.openai ?? {}) as Record<string, unknown>
    return {
      provider: raw.provider === 'openai' ? 'openai' : 'anthropic',
      anthropic: {
        apiKey: text(a.apiKey, ''),
        model: text(a.model, DEFAULT_AI.anthropic.model) || DEFAULT_AI.anthropic.model,
      },
      openai: {
        baseUrl: text(o.baseUrl, DEFAULT_AI.openai.baseUrl),
        apiKey: text(o.apiKey, ''),
        model: text(o.model, DEFAULT_AI.openai.model),
      },
    }
  } catch {
    return DEFAULT_AI
  }
}

export function saveAi(settings: AiSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // storage unavailable: lasts for this visit
  }
}

/** Ready to ask: the chosen service has what it needs */
export function aiReady(s: AiSettings): boolean {
  return s.provider === 'anthropic'
    ? s.anthropic.apiKey.trim() !== ''
    : s.openai.baseUrl.trim() !== '' && s.openai.model.trim() !== ''
}

/** What is asking, for the panel: "Claude Opus 5.5", "deepseek-chat" */
export function aiLabel(s: AiSettings): string {
  if (s.provider === 'openai') return s.openai.model || s.openai.baseUrl
  return CLAUDE_MODELS.find((m) => m.id === s.anthropic.model)?.name ?? s.anthropic.model
}
