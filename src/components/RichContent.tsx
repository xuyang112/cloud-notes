import { Fragment, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { JSONContent } from '@tiptap/core'
import { Check, Copy, X } from 'lucide-react'
import { hljs, safeUrl } from '../lib/content'
import { normalizeTextColor } from '../lib/text-color'

function CodeBlock({ node }: { node: JSONContent }) {
  const text = (node.content || []).map(item => item.text || '').join('')
  const language = String(node.attrs?.language || 'text')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const html = hljs.getLanguage(language) ? hljs.highlight(text, { language }).value : text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1600) }
    catch { setError('复制失败，请选中代码后复制。') }
  }
  return <figure className="code-block">
    <figcaption><span>{language.toUpperCase()}</span><button type="button" className="icon-button" title={copied ? '已复制' : '复制代码'} aria-label={copied ? '已复制' : '复制代码'} onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}</button></figcaption>
    <div className="code-scroll">
      <div className="line-numbers" aria-hidden="true">{text.split('\n').map((_, index) => <span key={index}>{index + 1}</span>)}</div>
      <pre><code className={`language-${language}`} dangerouslySetInnerHTML={{ __html: html }} /></pre>
    </div>
    {error && <span role="status">{error}</span>}
  </figure>
}

function ImagePreview({ src, alt, title }: { src: string; alt: string; title?: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return <>
    <button type="button" className="image-preview-trigger" onClick={() => setOpen(true)} aria-label={alt ? `查看图片：${alt}` : '查看大图'}>
      <img src={src} alt={alt} loading="lazy" />
    </button>
    {open && <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={alt ? `图片预览：${alt}` : '图片预览'} onClick={() => setOpen(false)}>
      <button type="button" className="image-lightbox-close icon-button" title="关闭图片预览" aria-label="关闭图片预览" onClick={() => setOpen(false)}><X size={20} /></button>
      <div className="image-lightbox-content" onClick={event => event.stopPropagation()}>
        <img src={src} alt={alt} />
        {title && <p>{title}</p>}
      </div>
    </div>}
  </>
}

function ContentNode({ node, index }: { node: JSONContent; index: number }) {
  const children = node.content?.map((child, childIndex) => <ContentNode key={childIndex} node={child} index={childIndex} />)
  switch (node.type) {
    case 'text': {
      const color = normalizeTextColor(node.marks?.find(mark => mark.type === 'textStyle')?.attrs?.color)
      let result: ReactNode = color ? <span style={{ color }}>{node.text}</span> : node.text
      for (const mark of node.marks || []) {
        if (mark.type === 'bold') result = <strong>{result}</strong>
        if (mark.type === 'italic') result = <em>{result}</em>
        if (mark.type === 'strike') result = <s>{result}</s>
        if (mark.type === 'underline') result = <u>{result}</u>
        if (mark.type === 'code') result = <code>{result}</code>
        if (mark.type === 'link') {
          const href = safeUrl(String(mark.attrs?.href || ''))
          if (href) result = <a href={href} target="_blank" rel="noopener noreferrer">{result}</a>
        }
      }
      return <>{result}</>
    }
    case 'paragraph': return <p>{children || <br />}</p>
    case 'heading': {
      const level = Math.max(2, Math.min(4, Number(node.attrs?.level || 2)))
      const Tag = `h${level}` as 'h2' | 'h3' | 'h4'
      return <Tag id={`section-${index}`}>{children}<a className="heading-anchor" href={`#section-${index}`} aria-label="链接到本节">#</a></Tag>
    }
    case 'codeBlock': return <CodeBlock node={node} />
    case 'orderedList': return <ol start={Number(node.attrs?.start || 1)}>{children}</ol>
    case 'bulletList': return <ul>{children}</ul>
    case 'listItem': return <li>{children}</li>
    case 'blockquote': return <blockquote>{children}</blockquote>
    case 'hardBreak': return <br />
    case 'horizontalRule': return <hr />
    case 'image': {
      const src = safeUrl(String(node.attrs?.src || ''), true)
      const alt = String(node.attrs?.alt || '')
      const title = node.attrs?.title ? String(node.attrs.title) : undefined
      return src ? <figure className="article-image"><ImagePreview src={src} alt={alt} title={title} />{title && <figcaption>{title}</figcaption>}</figure> : null
    }
    case 'table': return <div className="table-scroll"><table><tbody>{children}</tbody></table></div>
    case 'tableRow': return <tr>{children}</tr>
    case 'tableHeader': return <th colSpan={Number(node.attrs?.colspan || 1)} rowSpan={Number(node.attrs?.rowspan || 1)}>{children}</th>
    case 'tableCell': return <td colSpan={Number(node.attrs?.colspan || 1)} rowSpan={Number(node.attrs?.rowspan || 1)}>{children}</td>
    default: return <Fragment>{children}</Fragment>
  }
}

export default function RichContent({ content }: { content: JSONContent }) {
  return <div className="prose-content">{content.content?.map((node, index) => <ContentNode key={index} node={node} index={index} />)}</div>
}
