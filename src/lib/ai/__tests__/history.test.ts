// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { chatKey, forgetChat, loadChat, saveChat } from '../history'

const turns = [
  { role: 'user' as const, content: '八字……' },
  { role: 'assistant' as const, content: '## 解读' },
]

beforeEach(() => localStorage.clear())

describe('AI conversation history', () => {
  it('finds a conversation again by its first message and language', () => {
    saveChat('zh', 'prompt A', { turns, asked: '今年如何？' })
    expect(loadChat('zh', 'prompt A')?.turns).toEqual(turns)
    expect(loadChat('zh', 'prompt A')?.asked).toBe('今年如何？')
    expect(loadChat('zh', 'prompt B')).toBeNull()
    expect(loadChat('en', 'prompt A')).toBeNull()
  })

  it('keeps nothing of a message with no answer', () => {
    saveChat('zh', 'prompt A', { turns: turns.slice(0, 1), asked: '' })
    expect(loadChat('zh', 'prompt A')).toBeNull()
  })

  it('forgets one when asked', () => {
    saveChat('zh', 'prompt A', { turns, asked: '' })
    forgetChat('zh', 'prompt A')
    expect(loadChat('zh', 'prompt A')).toBeNull()
  })

  it('keeps only the latest twenty', () => {
    for (let i = 0; i < 25; i++) saveChat('zh', `prompt ${i}`, { turns, asked: '' })
    expect(Object.keys(JSON.parse(localStorage.getItem('chroniq-ai-chats')!))).toHaveLength(20)
    expect(loadChat('zh', 'prompt 24')).not.toBeNull()
  })

  it('names messages apart', () => {
    expect(chatKey('zh', 'a')).not.toBe(chatKey('zh', 'b'))
    expect(chatKey('zh', 'a')).toBe(chatKey('zh', 'a'))
  })
})
