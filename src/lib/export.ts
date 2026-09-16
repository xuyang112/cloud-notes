import JSZip from 'jszip'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { generateHTML } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import type { Notebook } from '../types'
import { editorExtensions } from './editor'
import { safeUrl } from './content'
import { normalizeTextColor } from './text-color'

const safeName = (value: string) => value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '').slice(0, 100) || 'note'

export async function exportNotebook(data: Notebook) {
  const zip = new JSZip()
  const converter = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
  converter.use(gfm)
  converter.addRule('textColor', {
    filter: node => node.nodeName === 'SPAN' && Boolean(normalizeTextColor((node as HTMLElement).style.color)),
    replacement(content, node) {
      const color = normalizeTextColor((node as HTMLElement).style.color)!
      return `<span style="color: ${color}">${content}</span>`
    },
  })
  converter.addRule('tableCellContent', {
    filter: ['th', 'td'],
    replacement(content, node) {
      const cell = node as HTMLTableCellElement
      return `${cell.cellIndex === 0 ? '| ' : ' '}${content.trim().replace(/\|/g, '\\|').replace(/\n+/g, '<br>')} |`
    },
  })
  converter.addRule('mergedTable', {
    filter: node => node.nodeName === 'TABLE' && Boolean((node as HTMLTableElement).querySelector('[colspan]:not([colspan="1"]),[rowspan]:not([rowspan="1"])')),
    replacement: (_content, node) => `\n\n${(node as HTMLElement).outerHTML}\n\n`,
  })
  const images = new Map<string, string>()
  const warnings: string[] = []
  async function archiveImages(node: JSONContent): Promise<void> {
    if (node.type === 'image' && node.attrs?.src) {
      const source = String(node.attrs.src)
      if (images.has(source)) { node.attrs.src = images.get(source); return }
      try {
        const valid = safeUrl(source, true)
        if (!valid) throw new Error('不支持的图片地址')
        const response = await fetch(valid, { signal: AbortSignal.timeout(20000) })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const blob = await response.blob()
        const extension = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' } as Record<string, string>)[blob.type]
        if (!extension) throw new Error('无法识别的图片类型')
        const name = `assets/image-${images.size + 1}.${extension}`
        zip.file(name, await blob.arrayBuffer())
        images.set(source, `../${name}`)
        node.attrs.src = `../${name}`
      } catch (error) { warnings.push(`图片未打包，Markdown 保留原地址：${source.slice(0, 180)}。${String(error)}`) }
    }
    for (const child of node.content || []) await archiveImages(child)
  }
  for (const note of data.notes) {
    const content = structuredClone(note.content)
    await archiveImages(content)
    const document = new DOMParser().parseFromString(generateHTML(content, editorExtensions()), 'text/html')
    // Tiptap's colgroup precedes tbody; GFM expects the header section first.
    document.querySelectorAll('colgroup').forEach(element => element.remove())
    const html = document.body.innerHTML
    const category = data.categories.find(item => item.id === note.category_id)?.name || '未分类'
    const metadata = ['---', `title: ${JSON.stringify(note.title)}`, `slug: ${JSON.stringify(note.slug)}`, `category: ${JSON.stringify(category)}`, `published: ${note.published}`, `created_at: ${JSON.stringify(note.created_at)}`, `updated_at: ${JSON.stringify(note.updated_at)}`, '---', ''].join('\n')
    zip.file(`notes/${safeName(note.slug)}-${note.id}.md`, `${metadata}\n# ${note.title}\n\n${converter.turndown(html)}\n`)
  }
  zip.file('notebook.json', JSON.stringify(data, null, 2))
  zip.file('README.txt', `NOTE 备份\n时间：${new Date().toISOString()}\n文章：${data.notes.length} 篇（含未发布）\n分类：${data.categories.length}\n\nnotes/：Markdown 文件\nassets/：已下载的图片\nnotebook.json：原始 Tiptap JSON 与完整字段\n\n${warnings.length ? warnings.join('\n') : '所有引用的图片均已打包。'}\n`)
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `NOTE-backup-${new Date().toISOString().slice(0, 10)}.zip`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  return warnings
}
