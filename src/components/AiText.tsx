// The Markdown an AI answers in, drawn as the page's own text: headings, lists, paragraphs, bold and
// code. Built as React elements (never as HTML), so nothing in an answer can run or reach the page.
import type { ReactNode } from 'react'

/** **bold**, *italic* and `code` within a line */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g
  let last = 0
  let i = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const s = m[0]
    const k = `${key}-${i++}`
    if (s.startsWith('**')) out.push(<strong key={k}>{s.slice(2, -2)}</strong>)
    else if (s.startsWith('`')) out.push(<code key={k}>{s.slice(1, -1)}</code>)
    else out.push(<em key={k}>{s.slice(1, -1)}</em>)
    last = m.index + s.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

type Block =
  | { kind: 'h'; level: number; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'p'; text: string }
  | { kind: 'hr' }

/** Lines into blocks: a heading, a run of list items, a paragraph (lines until a blank one) */
export function blocks(md: string): Block[] {
  const out: Block[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) out.push({ kind: 'p', text: para.join(' ') })
    para = []
  }
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim()
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    const ul = /^[-*•]\s+(.*)$/.exec(line)
    const ol = /^\d+[.、)]\s+(.*)$/.exec(line)
    if (!line) flush()
    else if (/^(-{3,}|\*{3,})$/.test(line)) {
      flush()
      out.push({ kind: 'hr' })
    } else if (h) {
      flush()
      out.push({ kind: 'h', level: h[1].length, text: h[2] })
    } else if (ul || ol) {
      flush()
      const kind = ul ? 'ul' : 'ol'
      const prev = out[out.length - 1]
      const item = (ul ?? ol)![1]
      if (prev && prev.kind === kind) prev.items.push(item)
      else out.push({ kind, items: [item] })
    } else para.push(line)
  }
  flush()
  return out
}

export function AiText({ text }: { text: string }) {
  return (
    <div className="ai-text">
      {blocks(text).map((b, i) => {
        const k = String(i)
        if (b.kind === 'h')
          return b.level <= 2 ? <h4 key={k}>{inline(b.text, k)}</h4> : <h5 key={k}>{inline(b.text, k)}</h5>
        if (b.kind === 'hr') return <hr key={k} />
        if (b.kind === 'p') return <p key={k}>{inline(b.text, k)}</p>
        const List = b.kind
        return (
          <List key={k}>
            {b.items.map((item, j) => (
              <li key={j}>{inline(item, `${k}-${j}`)}</li>
            ))}
          </List>
        )
      })}
    </div>
  )
}
