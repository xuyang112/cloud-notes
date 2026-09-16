import { useEffect, useReducer, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'
import { Bold, Italic, Code2, List, ListOrdered, Link as LinkIcon, Quote, ImagePlus, Table2, Undo2, Redo2, Unlink, Rows3, Columns3, Trash2, Minus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { editorExtensions } from '../lib/editor'
import { uploadImage } from '../lib/repository'
import { safeUrl } from '../lib/content'
import TextColorPicker from './TextColorPicker'

export default function Editor({ content, onChange, onUploadChange }: {
  content: JSONContent
  onChange: (content: JSONContent, html: string) => void
  onUploadChange: (busy: boolean) => void
}) {
  const [error, setError] = useState('')
  const [, render] = useReducer(value => value + 1, 0)
  const input = useRef<HTMLInputElement>(null)
  const uploads = useRef(0)
  const editor = useEditor({
    extensions: editorExtensions(),
    content,
    editorProps: {
      attributes: { class: 'tiptap prose-content', 'aria-label': '笔记正文', spellcheck: 'false' },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files || []).filter(file => file.type.startsWith('image/'))
        if (!files.length) return false
        event.preventDefault()
        void addImages(files)
        return true
      },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files || []).filter(file => file.type.startsWith('image/'))
        if (!files.length) return false
        event.preventDefault()
        void addImages(files)
        return true
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getJSON(), current.getHTML()),
  })
  useEffect(() => {
    if (!editor) return
    editor.on('transaction', render)
    return () => { editor.off('transaction', render) }
  }, [editor])
  async function addImages(files: File[]) {
    uploads.current += 1
    onUploadChange(true)
    setError('')
    try {
      for (const file of files) {
        const src = await uploadImage(file)
        if (!editor?.isDestroyed) editor?.chain().focus().setImage({ src, alt: file.name }).run()
      }
    } catch (err) { setError(err instanceof Error ? err.message : '图片上传失败。') }
    finally { uploads.current -= 1; onUploadChange(uploads.current > 0) }
  }
  function setLink() {
    if (!editor) return
    const value = window.prompt('链接地址', editor.getAttributes('link').href || 'https://')
    if (value === null) return
    if (!value) { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return }
    const href = safeUrl(value)
    if (!href) { setError('请输入 http、https 或 mailto 链接。'); return }
    setError('')
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
  }
  if (!editor) return <p role="status">编辑器加载中…</p>
  const tool = (Icon: LucideIcon, label: string, action: () => void, active = false, disabled = false) =>
    <button type="button" key={label} className={`tool-button ${active ? 'active' : ''}`} title={label} aria-label={label} aria-pressed={active} onClick={action} disabled={disabled}><Icon size={17} /></button>
  return <div className="editor-surface">
    <div className="editor-toolbar" role="toolbar" aria-label="文字格式">
      <select aria-label="段落格式" value={editor.isActive('heading') ? editor.getAttributes('heading').level : 'paragraph'} onChange={event => { if (event.target.value === 'paragraph') editor.chain().focus().setParagraph().run(); else editor.chain().focus().toggleHeading({ level: Number(event.target.value) as 2 | 3 | 4 }).run() }}>
        <option value="paragraph">正文</option><option value="2">二级标题</option><option value="3">三级标题</option><option value="4">四级标题</option>
      </select>
      <span className="toolbar-divider" />
      {tool(Bold, '加粗', () => { editor.chain().focus().toggleBold().run() }, editor.isActive('bold'))}
      {tool(Italic, '斜体', () => { editor.chain().focus().toggleItalic().run() }, editor.isActive('italic'))}
      <TextColorPicker editor={editor} />
      {tool(LinkIcon, '插入链接', setLink, editor.isActive('link'))}
      {editor.isActive('link') && tool(Unlink, '移除链接', () => { editor.chain().focus().unsetLink().run() })}
      <span className="toolbar-divider" />
      {tool(List, '无序列表', () => { editor.chain().focus().toggleBulletList().run() }, editor.isActive('bulletList'))}
      {tool(ListOrdered, '有序列表', () => { editor.chain().focus().toggleOrderedList().run() }, editor.isActive('orderedList'))}
      {tool(Quote, '引用', () => { editor.chain().focus().toggleBlockquote().run() }, editor.isActive('blockquote'))}
      {tool(Code2, '代码块', () => { editor.chain().focus().toggleCodeBlock().run() }, editor.isActive('codeBlock'))}
      {tool(Table2, '插入表格', () => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() })}
      {tool(ImagePlus, '插入图片', () => input.current?.click())}
      {tool(Minus, '分隔线', () => { editor.chain().focus().setHorizontalRule().run() })}
      <span className="toolbar-divider" />
      {tool(Undo2, '撤销', () => { editor.chain().focus().undo().run() }, false, !editor.can().undo())}
      {tool(Redo2, '重做', () => { editor.chain().focus().redo().run() }, false, !editor.can().redo())}
      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden ref={input} onChange={event => { void addImages(Array.from(event.target.files || [])); event.target.value = '' }} />
    </div>
    {editor.isActive('codeBlock') && <div className="context-toolbar"><label>代码语言 <select aria-label="代码语言" value={editor.getAttributes('codeBlock').language || 'java'} onChange={event => editor.chain().focus().updateAttributes('codeBlock', { language: event.target.value }).run()}>{['java', 'sql', 'c', 'cpp', 'javascript', 'bash', 'text'].map(language => <option key={language} value={language}>{language.toUpperCase()}</option>)}</select></label></div>}
    {editor.isActive('table') && <div className="context-toolbar">
      {tool(Rows3, '在下方添加行', () => { editor.chain().focus().addRowAfter().run() })}
      {tool(Columns3, '在右侧添加列', () => { editor.chain().focus().addColumnAfter().run() })}
      <button type="button" onClick={() => editor.chain().focus().deleteRow().run()}>删除行</button>
      <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()}>删除列</button>
      {tool(Trash2, '删除表格', () => { editor.chain().focus().deleteTable().run() })}
    </div>}
    {error && <p className="field-error" role="alert">{error}</p>}
    <EditorContent editor={editor} />
  </div>
}
