// 繁體中文 over the whole page: every text and the attributes people read (title, aria-label,
// placeholder, alt), as they are added or changed, converted before the browser paints them. The
// interface keeps rendering its 简体 source; this covers t() text, notes from the lib and anything a
// library writes alike. React sets a text node's value afresh when it changes, so it never sees
// the converted one as its own.
import { hant } from './lib/hant'

const ATTRIBUTES = ['title', 'aria-label', 'placeholder', 'alt']
/** What people type, and code, are left as they are */
const SKIP = 'input, textarea, script, style, [contenteditable], [data-no-hant]'

function convertText(node: Text) {
  const parent = node.parentElement
  if (!parent || parent.closest(SKIP)) return
  const value = node.nodeValue
  if (!value) return
  const next = hant(value)
  if (next !== value) node.nodeValue = next
}

function convertAttributes(el: Element) {
  if (el.closest(SKIP) && !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return
  for (const name of ATTRIBUTES) {
    const value = el.getAttribute(name)
    if (value) {
      const next = hant(value)
      if (next !== value) el.setAttribute(name, next)
    }
  }
}

function convertTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return convertText(root as Text)
  if (root.nodeType !== Node.ELEMENT_NODE) return
  convertAttributes(root as Element)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) convertText(node as Text)
    else convertAttributes(node as Element)
  }
}

/** Converts the page now and as it changes; returns the stop */
export function startHantDom(root: Node = document.body): () => void {
  convertTree(root)
  const title = document.title
  document.title = hant(title)
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') convertText(r.target as Text)
      else if (r.type === 'attributes') convertAttributes(r.target as Element)
      else r.addedNodes.forEach(convertTree)
    }
  })
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES })
  return () => {
    observer.disconnect()
    document.title = title
  }
}
