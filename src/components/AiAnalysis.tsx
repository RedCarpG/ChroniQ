// AI 解读: a card under a chart (八字, 紫微) or a day (今日) that hands what ChroniQ worked out to an
// AI of the reader's choosing and shows its reading as it is written, with follow-up questions. The
// reader brings their own key (Claude, or an OpenAI-compatible service), kept in this browser; or,
// without one, copies the whole prompt to paste into a chat they already pay for (claude.ai …).
import { useEffect, useRef, useState } from 'react'
import { promptForPasting, systemPrompt } from '../ai/prompts'
import { aiLabel, aiReady, CLAUDE_MODELS, loadAi, saveAi, type AiSettings } from '../ai/settings'
import { AiError, streamAnswer, type AiTurn } from '../ai/stream'
import { forgetChat, loadChat, saveChat } from '../ai/history'
import { useSettings, useT } from '../settingsContext'
import { AiText } from './AiText'
import { TitleMark } from './Logo'
import { isStaleBuild } from '../pwa'

/** How a question asked with the first message is put to the AI (in Chinese, as the rest of the prompt) */
const QUESTION_LEAD = '请结合上面的内容，重点回答这个问题，不必面面俱到：'

interface Props {
  /** The section's id (for the page's jump links) */
  id: string
  /** The first message: the chart or day in full and what to write about it; null while there is none */
  prompt: string | null
}

export function AiAnalysis({ id, prompt }: Props) {
  const t = useT()
  const { language } = useSettings()
  const lang = language === 'en' ? 'en' : 'zh'
  const [settings, setSettings] = useState<AiSettings>(loadAi)
  const [editing, setEditing] = useState(false)
  const [turns, setTurns] = useState<AiTurn[]>([])
  const [live, setLive] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cut, setCut] = useState(false)
  const [question, setQuestion] = useState('')
  // A question asked with the first message, instead of the whole reading; left empty, the whole reading
  const [firstQuestion, setFirstQuestion] = useState('')
  const [askedFirst, setAskedFirst] = useState('')
  /** The first message: the chart, and the question if one is asked */
  const firstMessage = (q: string) => (prompt && q.trim() ? `${prompt}\n\n${QUESTION_LEAD}${q.trim()}` : prompt)
  const [copied, setCopied] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const system = systemPrompt(lang)

  // Another chart, day or language: its own conversation, as it was left if it was had before
  useEffect(() => {
    abort.current?.abort()
    const kept = prompt ? loadChat(lang, prompt) : null
    setTurns(kept?.turns ?? [])
    setAskedFirst(kept?.asked ?? '')
    setLive(null)
    setError(null)
    setCut(false)
  }, [prompt, lang])
  /** Keeps the conversation in this browser, under the chart or day it is about */
  const keep = (next: AiTurn[], asked: string) => prompt && saveChat(lang, prompt, { turns: next, asked })
  useEffect(() => () => abort.current?.abort(), [])

  const errorText = (err: unknown) => {
    if (err instanceof AiError) {
      const why = {
        key: t('API key 不对或没有权限，请在设置里检查。'),
        rate: t('请求太频繁或额度用完了，稍后再试。'),
        network: t('连不上 AI 服务（网络问题，或者这个服务不允许从浏览器直接访问）。'),
        refused: t('AI 拒绝回答这个请求。'),
        request: t('请求出错（模型名或地址可能不对）。'),
        server: t('AI 服务出错，稍后再试。'),
      }[err.kind]
      return err.message ? `${why} ${err.message}` : why
    }
    // The page outlived its build: the AI library's file has been replaced on the server
    if (isStaleBuild(err)) return t('网站已经更新，这个页面还是旧版本。请刷新页面后再试。')
    return err instanceof Error ? err.message : String(err)
  }

  const ask = async (next: AiTurn[], asked = askedFirst) => {
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setTurns(next)
    setLive('')
    setError(null)
    setCut(false)
    let text = ''
    try {
      const result = await streamAnswer(settings, system, next, (d) => setLive((text += d)), controller.signal)
      if (controller.signal.aborted) return
      const answered: AiTurn[] = [...next, { role: 'assistant', content: result.text || text }]
      setTurns(answered)
      setCut(result.cut)
      keep(answered, asked)
    } catch (err) {
      if (controller.signal.aborted) {
        // Stopped: keep what was written so far
        if (text) {
          const stopped: AiTurn[] = [...next, { role: 'assistant', content: text }]
          setTurns(stopped)
          keep(stopped, asked)
        }
        return
      }
      setError(errorText(err))
      // A failed question can be asked again: it goes back to the box
      if (next.length > 1) {
        setTurns(next.slice(0, -1))
        setQuestion(next[next.length - 1].content)
      } else setTurns([])
    } finally {
      if (abort.current === controller) {
        abort.current = null
        setLive(null)
      }
    }
  }

  const start = () => {
    if (!prompt) return
    const asked = firstQuestion.trim()
    setAskedFirst(asked)
    void ask([{ role: 'user', content: firstMessage(firstQuestion)! }], asked)
  }
  const follow = () => {
    const q = question.trim()
    if (!q || live !== null) return
    setQuestion('')
    void ask([...turns, { role: 'user', content: q }])
  }
  const copy = async () => {
    if (!prompt) return
    try {
      await navigator.clipboard.writeText(promptForPasting(system, firstMessage(firstQuestion)!))
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setError(t('没能复制到剪贴板。'))
    }
  }
  const save = (next: AiSettings) => {
    setSettings(next)
    saveAi(next)
  }

  const ready = aiReady(settings)
  const busy = live !== null
  // The conversation as shown: the first message (the chart) is not, the answers and later questions are
  const shown = turns.slice(1)

  return (
    <section className="card ai-card" id={id}>
      <div className="ai-head">
        <h3>
          <TitleMark />
          {t('AI 解读')}
        </h3>
        <span className="muted ai-model">{ready ? aiLabel(settings) : ''}</span>
        <button
          type="button"
          className={`ghost ai-settings-btn${editing ? ' on' : ''}`}
          aria-expanded={editing}
          onClick={() => setEditing((e) => !e)}
        >
          {t('设置')}
        </button>
      </div>

      {editing && <AiSettingsForm settings={settings} onSave={save} onDone={() => setEditing(false)} />}

      {shown.length === 0 && !busy && (
        <p className="muted ai-intro">
          {ready
            ? t('交给 AI 写一份解读，之后可以接着问。')
            : t(
                '填上自己的 API key（Claude，或兼容 OpenAI 的接口）就能在这里生成解读；用的是订阅的话，复制提示词，粘贴到 Claude 等的网页里。',
              )}
        </p>
      )}

      {/* The question asked with the chart, shown as the others are */}
      {askedFirst && (shown.length > 0 || busy) && <p className="ai-question">{askedFirst}</p>}
      {shown.map((turn, i) =>
        turn.role === 'assistant' ? (
          <AiText key={i} text={turn.content} />
        ) : (
          <p key={i} className="ai-question">
            {turn.content}
          </p>
        ),
      )}
      {busy && (live ? <AiText text={live} /> : <p className="muted ai-thinking">{t('正在思考…')}</p>)}
      {cut && <p className="muted ai-note">{t('回答太长，到上限截断了。')}</p>}
      {error && (
        <p className="ai-error" role="alert">
          {error}
        </p>
      )}

      {/* Before the first answer: a question of one's own, or nothing for the whole reading */}
      {shown.length === 0 && !busy && prompt && (
        <textarea
          className="ai-first-question"
          rows={2}
          value={firstQuestion}
          placeholder={t('想问什么？比如「今天适合谈合作吗？」留空就生成完整解读')}
          aria-label={t('想问的问题')}
          onChange={(e) => setFirstQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && ready) {
              e.preventDefault()
              start()
            }
          }}
        />
      )}
      <div className="ai-actions">
        {busy ? (
          <button type="button" className="ghost" onClick={() => abort.current?.abort()}>
            {t('停止')}
          </button>
        ) : (
          ready &&
          prompt && (
            <button type="button" className="primary" data-sound="gong" onClick={start}>
              {shown.length ? t('重新解读') : firstQuestion.trim() ? t('提问') : t('生成解读')}
            </button>
          )
        )}
        {shown.length > 0 && !busy && (
          <button
            type="button"
            className="ghost"
            title={t('这段对话存在这个浏览器里，换页面回来还在；清除后就没有了')}
            onClick={() => {
              if (prompt) forgetChat(lang, prompt)
              setTurns([])
              setAskedFirst('')
              setCut(false)
            }}
          >
            {t('清除对话')}
          </button>
        )}
        <button
          type="button"
          className="ghost"
          disabled={!prompt}
          onClick={() => void copy()}
          title={t('复制完整的提示词，粘贴到 Claude、ChatGPT 等网页里用订阅提问')}
        >
          {copied ? t('已复制') : t('复制提示词')}
        </button>
        {copied && (
          <a className="ai-link" href="https://claude.ai/new" target="_blank" rel="noreferrer">
            {t('打开 Claude')}
          </a>
        )}
      </div>

      {shown.length > 0 && !busy && ready && (
        <form
          className="ai-follow"
          onSubmit={(e) => {
            e.preventDefault()
            follow()
          }}
        >
          <textarea
            rows={2}
            value={question}
            placeholder={t('接着问，比如「今年适合换工作吗？」')}
            aria-label={t('接着问')}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                follow()
              }
            }}
          />
          <button type="submit" className="primary" disabled={!question.trim()}>
            {t('发送')}
          </button>
        </form>
      )}

      <p className="muted row-note ai-privacy">
        {t(
          '生成解读会把这里的命盘或黄历（命盘含出生日期、时间和地点）发给你选的 AI 服务；API key 只存在这个浏览器里，不经过别的服务器。AI 的解读仅供参考。',
        )}
      </p>
    </section>
  )
}

/** Which service, its key and model */
function AiSettingsForm({
  settings,
  onSave,
  onDone,
}: {
  settings: AiSettings
  onSave: (s: AiSettings) => void
  onDone: () => void
}) {
  const t = useT()
  const [draft, setDraft] = useState(settings)
  const set = (next: AiSettings) => setDraft(next)
  return (
    <form
      className="ai-settings"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(draft)
        onDone()
      }}
    >
      <div className="seg small" role="group" aria-label={t('AI 服务')}>
        {(
          [
            ['anthropic', 'Claude'],
            ['openai', t('兼容 OpenAI 的接口')],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            className={draft.provider === v ? 'on' : undefined}
            aria-pressed={draft.provider === v}
            onClick={() => set({ ...draft, provider: v })}
          >
            {label}
          </button>
        ))}
      </div>
      {draft.provider === 'anthropic' ? (
        <>
          <label>
            {t('API key')}
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-ant-…"
              value={draft.anthropic.apiKey}
              onChange={(e) => set({ ...draft, anthropic: { ...draft.anthropic, apiKey: e.target.value } })}
            />
          </label>
          <label>
            {t('模型')}
            <select
              value={draft.anthropic.model}
              onChange={(e) => set({ ...draft, anthropic: { ...draft.anthropic, model: e.target.value } })}
            >
              {CLAUDE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <p className="muted row-note">
            {t('在 Anthropic 控制台创建 API key，按用量付费；Claude 的订阅（Pro、Max）不能在这里用。')}{' '}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
              console.anthropic.com
            </a>
          </p>
        </>
      ) : (
        <>
          <label>
            {t('接口地址')}
            <input
              type="url"
              spellCheck={false}
              placeholder="https://api.deepseek.com/v1"
              value={draft.openai.baseUrl}
              onChange={(e) => set({ ...draft, openai: { ...draft.openai, baseUrl: e.target.value } })}
            />
          </label>
          <label>
            {t('API key')}
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={draft.openai.apiKey}
              onChange={(e) => set({ ...draft, openai: { ...draft.openai, apiKey: e.target.value } })}
            />
          </label>
          <label>
            {t('模型')}
            <input
              type="text"
              spellCheck={false}
              placeholder="deepseek-chat"
              value={draft.openai.model}
              onChange={(e) => set({ ...draft, openai: { ...draft.openai, model: e.target.value } })}
            />
          </label>
          <p className="muted row-note">
            {t(
              '填到 /v1 为止，会请求它的 /chat/completions。服务要允许从浏览器直接访问（CORS），本机的模型（如 Ollama）可能要先打开这个选项。',
            )}
          </p>
        </>
      )}
      <div className="ai-actions">
        <button type="submit" className="primary">
          {t('保存')}
        </button>
        <button type="button" className="ghost" onClick={onDone}>
          {t('取消')}
        </button>
      </div>
    </form>
  )
}
