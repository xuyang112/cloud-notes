import type { JSONContent } from '@tiptap/core'
import { createLowlight } from 'lowlight'
import java from 'highlight.js/lib/languages/java'
import sql from 'highlight.js/lib/languages/sql'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import javascript from 'highlight.js/lib/languages/javascript'
import bash from 'highlight.js/lib/languages/bash'
import hljs from 'highlight.js/lib/core'

export const languages = { java, sql, c, cpp, javascript, bash }
export const lowlight = createLowlight(languages)
Object.entries(languages).forEach(([name, language]) => hljs.registerLanguage(name, language))
export { hljs }

export function plainText(node: JSONContent): string {
  if (node.type === 'text') return node.text || ''
  return (node.content || []).map(plainText).join(node.type === 'paragraph' || node.type === 'heading' ? '' : ' ')
}

export function safeUrl(value: string, image = false): string | undefined {
  if (/^\/(?!\/)/.test(value)) return value
  if (image && /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(value)) return value
  try {
    const url = new URL(value)
    if (['https:', 'http:', ...(image ? [] : ['mailto:'])].includes(url.protocol)) return url.href
  } catch { /* Unsupported URLs are not rendered as active links. */ }
}

export function safeAttachmentUrl(value: string): string | undefined {
  if (/^\/(?!\/)/.test(value)) return value
  if (/^data:application\/octet-stream;base64,[a-z0-9+/=\s]*$/i.test(value)) return value
  try {
    const url = new URL(value)
    if (['https:', 'http:'].includes(url.protocol)) return url.href
  } catch { /* Unsupported URLs are not rendered as downloads. */ }
}

export function makeSlug(title: string) {
  return title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || `note-${Date.now()}`
}

export function excerpt(note: { content: JSONContent }, max = 112) {
  const firstParagraph = note.content.content?.find(node => node.type === 'paragraph')
  const text = plainText(firstParagraph || note.content)
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function headings(content: JSONContent) {
  return (content.content || []).flatMap((node, index) => node.type === 'heading'
    ? [{ id: `section-${index}`, text: plainText(node), level: Number(node.attrs?.level || 2) }]
    : [])
}
