// AI 解读 kept in this browser: each conversation under its first message (the chart or day it is
// about, in its language), so leaving the page and coming back finds it again, and another chart or
// day starts afresh. Only the latest few are kept.
import type { AiTurn } from './stream'

const KEY = 'chroniq-ai-chats'
const KEEP = 20

export interface AiChat {
  turns: AiTurn[]
  /** The question asked with the first message, if any */
  asked: string
  /** When it was last added to, ms */
  at: number
}

/** A short, stable name for a conversation's first message (FNV-1a over its text) */
export function chatKey(lang: string, prompt: string): string {
  let h = 0x811c9dc5
  const s = `${lang}\n${prompt}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36) + s.length.toString(36)
}

function readAll(): Record<string, AiChat> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return raw && typeof raw === 'object' ? (raw as Record<string, AiChat>) : {}
  } catch {
    return {}
  }
}

export function loadChat(lang: string, prompt: string): AiChat | null {
  const chat = readAll()[chatKey(lang, prompt)]
  return chat && Array.isArray(chat.turns) && chat.turns.length > 1 ? chat : null
}

export function saveChat(lang: string, prompt: string, chat: Omit<AiChat, 'at'>): void {
  const all = readAll()
  all[chatKey(lang, prompt)] = { ...chat, at: Date.now() }
  // The latest few, the oldest let go
  const kept = Object.entries(all)
    .sort(([, a], [, b]) => b.at - a.at)
    .slice(0, KEEP)
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(kept)))
  } catch {
    // storage full or unavailable: it lasts for this visit
  }
}

export function forgetChat(lang: string, prompt: string): void {
  const all = readAll()
  delete all[chatKey(lang, prompt)]
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // storage unavailable
  }
}
