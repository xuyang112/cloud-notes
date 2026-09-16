import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useParams } from 'react-router-dom'
import { ArrowLeft, Check, LoaderCircle, Save, Download } from 'lucide-react'
import { useNotebook } from '../store'
import { saveNote } from '../lib/repository'
import { makeSlug } from '../lib/content'
import Editor from '../components/Editor'
import { ModeNotice } from './Admin'
import type { Note } from '../types'

export default function EditNote() {
  const { id } = useParams()
  const { data } = useNotebook()
  const note = data.notes.find(item => item.id === id)
  const retained = useRef<Note | undefined>(undefined)
  if (retained.current?.id !== id) retained.current = undefined
  if (note) retained.current = note
  const initial = note || retained.current
  return initial ? <EditForm key={initial.id} initial={initial} /> : <main className="empty-state"><h1>没有找到这篇笔记</h1><Link to="/admin">返回笔记管理</Link></main>
}

function EditForm({ initial }: { initial: Note }) {
  const { data, reload } = useNotebook()
  const [draft, setDraft] = useState(initial)
  const latest = useRef(initial)
  const expected = useRef(initial.updated_at)
  const savedRevision = useRef(0)
  const revision = useRef(0)
  const inFlight = useRef<Promise<boolean> | null>(null)
  const [status, setStatus] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current)
    if (inFlight.current) return inFlight.current
    const perform = async () => {
      while (savedRevision.current < revision.current) {
        const currentRevision = revision.current
        const snapshot = { ...latest.current, title: latest.current.title.trim(), slug: latest.current.slug.trim() }
        if (!snapshot.title || !/^[\p{L}\p{N}_-]+$/u.test(snapshot.slug)) {
          setError('标题不能为空；slug 只能包含文字、数字、连字符与下划线。'); setStatus('error'); return false
        }
        setStatus('saving')
        try {
          const saved = await saveNote(snapshot, expected.current)
          expected.current = saved.updated_at
          savedRevision.current = currentRevision
        } catch (err) { setError(err instanceof Error ? err.message : '保存失败。'); setStatus('error'); return false }
      }
      setStatus('saved'); setError('')
      void reload()
      return true
    }
    inFlight.current = perform()
    try { return await inFlight.current } finally { inFlight.current = null }
  }, [reload])

  const update = useCallback((values: Partial<Note>) => {
    const next = { ...latest.current, ...values }
    latest.current = next
    revision.current += 1
    setDraft(next); setStatus('dirty')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), 2000)
  }, [flush])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (savedRevision.current < revision.current || uploading) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', warn)
    return () => { window.removeEventListener('beforeunload', warn) }
  }, [uploading])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const blocker = useBlocker(status !== 'saved' || uploading)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (uploading) { window.alert('图片仍在上传，请稍后再离开。'); blocker.reset(); return }
    void flush().then(ok => {
      if (ok) blocker.proceed()
      else if (window.confirm('保存失败，离开会丢失未保存的修改。确定离开？')) blocker.proceed()
      else blocker.reset()
    })
  }, [blocker, flush, uploading])
  return <main className="edit-page"><ModeNotice />
    <div className="edit-topline"><Link className="back-link" to="/admin"><ArrowLeft size={15} />笔记管理</Link><div className="action-group"><span className={`save-state ${status}`} role="status">{uploading || status === 'saving' ? <LoaderCircle size={14} className="spin" /> : status === 'saved' ? <Check size={14} /> : null}{uploading ? '图片上传中…' : ({ saved: '已保存', dirty: '等待保存…', saving: '保存中…', error: '未保存' })[status]}</span><button className="icon-button" title="立即保存" aria-label="立即保存" disabled={status === 'saving' || uploading} onClick={() => void flush()}><Save size={18} /></button><button className="icon-button" title="导出当前笔记" aria-label="导出当前笔记" disabled={exporting} onClick={async () => { setExporting(true); try { const { exportNotebook } = await import('../lib/export'); const warnings = await exportNotebook({ notes: [latest.current], categories: data.categories }); if (warnings.length) setError('已导出，部分图片未能打包，请查看备份内 README.txt。') } catch (err) { setError(String(err)) } finally { setExporting(false) } }}><Download size={18} /></button></div></div>
    <input className="note-title-input" aria-label="文章标题" value={draft.title} maxLength={160} onChange={event => update({ title: event.target.value })} />
    <div className="note-settings"><label>分类<select value={draft.category_id || ''} onChange={event => update({ category_id: event.target.value || null })}><option value="">未分类</option>{data.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="slug-field">Slug<div><input aria-label="文章 slug" value={draft.slug} maxLength={180} onChange={event => update({ slug: event.target.value })} /><button type="button" title="从标题生成 slug" onClick={() => update({ slug: makeSlug(draft.title) })}>生成</button></div></label><label className="publish-check"><input type="checkbox" checked={draft.published} onChange={event => update({ published: event.target.checked })} />发布文章</label></div>
    {error && <p className="field-error" role="alert">{error}</p>}
    <Editor content={initial.content} onChange={(content, content_html) => update({ content, content_html })} onUploadChange={setUploading} />
  </main>
}
