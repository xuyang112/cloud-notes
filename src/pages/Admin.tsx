import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Download, Plus, Pencil, Trash2, Eye, EyeOff, LogOut, FolderOpen, ArrowLeft, HardDrive, Cloud } from 'lucide-react'
import { useNotebook } from '../store'
import { configured, supabase, saveNote, deleteNote, saveCategory, deleteCategory, loadNotebook } from '../lib/repository'
import { makeSlug } from '../lib/content'
import type { Category, Note } from '../types'

export function AdminGuard({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'admin' | 'guest' | 'denied'>(configured ? 'checking' : 'admin')
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let alive = true
    async function check() {
      const { data: { user }, error } = await client.auth.getUser()
      if (!alive) return
      if (error || !user) { setStatus('guest'); return }
      const { data, error: roleError } = await client.rpc('is_admin')
      if (alive) setStatus(!roleError && data === true ? 'admin' : 'denied')
    }
    void check()
    const { data } = client.auth.onAuthStateChange(() => { window.setTimeout(() => void check(), 0) })
    return () => { alive = false; data.subscription.unsubscribe() }
  }, [])
  if (status === 'checking') return <div className="empty-state" role="status">正在验证身份…</div>
  if (status === 'guest') return <Navigate to="/admin/login" replace />
  if (status === 'denied') return <div className="empty-state"><h1>当前账户没有管理员权限</h1><p>请在 Supabase 中配置管理员账号。</p><button onClick={() => void supabase?.auth.signOut()}>退出登录</button></div>
  return <>{children}</>
}

export function ModeNotice() {
  return <div className={`mode-notice ${configured ? 'cloud' : ''}`}>{configured ? <Cloud size={15} /> : <HardDrive size={15} />}<span>{configured ? 'Supabase 云端工作区' : '本机预览 · 数据仅存当前浏览器，不会同步到其他设备'}</span></div>
}

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) setError(authError.message)
    else navigate('/admin', { replace: true })
    setBusy(false)
  }
  return <main className="login-page"><Link className="back-link" to="/"><ArrowLeft size={15} />返回笔记</Link><h1>登录工作区</h1><p className="muted">NOTE / 管理员</p>
    {!configured ? <><ModeNotice /><p>尚未连接 Supabase，本机预览无需账户。</p><Link to="/admin" className="primary-button">进入本机预览</Link></>
      : <form onSubmit={submit} className="login-form"><label>邮箱<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label><label>密码<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>{error && <p role="alert" className="field-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? '正在登录…' : '登录'}</button></form>}
  </main>
}

export function AdminList() {
  const { data, reload } = useNotebook()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('all')
  const navigate = useNavigate()
  async function run(action: () => Promise<void>) {
    setBusy(true); setNotice('')
    try { await action(); await reload() }
    catch (error) { setNotice(error instanceof Error ? error.message : '操作失败。') }
    finally { setBusy(false) }
  }
  async function create() {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const note: Note = { id, title: '未命名笔记', slug: `note-${id.slice(0, 8)}`, category_id: data.categories[0]?.id || null, content: { type: 'doc', content: [{ type: 'paragraph' }] }, content_html: '<p></p>', published: false, created_at: now, updated_at: now }
    await saveNote(note); await reload(); navigate(`/admin/notes/${id}`)
  }
  return <main className="admin-page">
    <ModeNotice />
    <div className="page-heading"><div><div className="eyebrow">WORKSPACE</div><h1>笔记管理</h1></div><div className="action-group">
      {configured && <button className="icon-button" title="退出登录" aria-label="退出登录" onClick={() => void supabase?.auth.signOut()}><LogOut size={18} /></button>}
      <Link className="secondary-button" to="/admin/categories"><FolderOpen size={16} />分类</Link>
      <button className="secondary-button" disabled={busy} onClick={() => void run(async () => { const { exportNotebook } = await import('../lib/export'); const warnings = await exportNotebook(await loadNotebook()); setNotice(warnings.length ? `已导出，但 ${warnings.length} 张图片未能打包，请查看 zip 内 README.txt。` : '已导出全部笔记、原始 JSON 与图片。') })}><Download size={16} />导出备份</button>
      <button className="primary-button" disabled={busy} onClick={() => void run(create)}><Plus size={16} />新建笔记</button>
    </div></div>
    <div className="management-tabs" role="tablist" aria-label="发布状态">{[['all', '全部'], ['published', '已发布'], ['draft', '草稿']].map(([value, label]) => <button key={value} role="tab" aria-selected={filter === value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{label}<span>{data.notes.filter(note => value === 'all' || (value === 'published' ? note.published : !note.published)).length}</span></button>)}</div>
    {notice && <p role="status" className="operation-notice">{notice}</p>}
    <div className="management-list">{[...data.notes].filter(note => filter === 'all' || (filter === 'published' ? note.published : !note.published)).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(note => <div className="management-row" key={note.id}>
      <div className="management-summary"><Link to={`/admin/notes/${note.id}`}>{note.title}</Link><span>{data.categories.find(category => category.id === note.category_id)?.name || '未分类'} · {note.updated_at.slice(0, 10)}</span></div>
      <span className={`status-label ${note.published ? 'published' : ''}`}>{note.published ? '已发布' : '草稿'}</span>
      <div className="action-group">
        <Link className="icon-button" title="编辑笔记" aria-label={`编辑 ${note.title}`} to={`/admin/notes/${note.id}`}><Pencil size={16} /></Link>
        <button className="icon-button" disabled={busy} title={note.published ? '下架' : '发布'} aria-label={`${note.published ? '下架' : '发布'} ${note.title}`} onClick={() => void run(async () => { await saveNote({ ...note, published: !note.published }, note.updated_at) })}>{note.published ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        <button className="icon-button danger" disabled={busy} title="删除笔记" aria-label={`删除 ${note.title}`} onClick={() => { if (window.confirm(`确定删除“${note.title}”？此操作不可撤销，建议先导出备份。`)) void run(() => deleteNote(note.id)) }}><Trash2 size={16} /></button>
      </div>
    </div>)}</div>
    {!data.notes.length && <div className="empty-state">还没有笔记</div>}
  </main>
}

export function Categories() {
  const { data, reload } = useNotebook()
  const [edit, setEdit] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [sort, setSort] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  function reset() { setEdit(null); setName(''); setSlug(''); setSort(0) }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      await saveCategory({ id: edit?.id || crypto.randomUUID(), name: name.trim(), slug: slug.trim() || makeSlug(name), sort_order: sort, created_at: edit?.created_at || new Date().toISOString() })
      await reload(); reset()
    } catch (err) { setError(err instanceof Error ? err.message : '保存失败。') }
    finally { setBusy(false) }
  }
  return <main className="admin-page"><ModeNotice /><Link className="back-link" to="/admin"><ArrowLeft size={15} />笔记管理</Link><div className="page-heading"><h1>分类管理</h1></div>
    <form className="category-form" onSubmit={save}><label>分类名称<input required maxLength={40} value={name} onChange={event => { setName(event.target.value); if (!edit) setSlug(makeSlug(event.target.value)) }} /></label><label>Slug<input required maxLength={120} pattern="[\p{L}\p{N}_\-]+" value={slug} onChange={event => setSlug(event.target.value)} /></label><label className="sort-field">排序<input type="number" min={0} max={999} required value={sort} onChange={event => setSort(Number(event.target.value))} /></label><button className="primary-button" disabled={busy}>{edit ? '保存分类' : '添加分类'}</button>{edit && <button type="button" className="secondary-button" onClick={reset}>取消</button>}</form>
    {error && <p role="alert" className="field-error">{error}</p>}
    <div className="management-list">{[...data.categories].sort((a, b) => a.sort_order - b.sort_order).map(category => <div className="management-row" key={category.id}><div className="management-summary"><strong>{category.name}</strong><span>{category.slug} · {data.notes.filter(note => note.category_id === category.id).length} 篇笔记</span></div><span className="muted">排序 {category.sort_order}</span><div className="action-group"><button className="icon-button" title="编辑分类" aria-label={`编辑分类 ${category.name}`} onClick={() => { setEdit(category); setName(category.name); setSlug(category.slug); setSort(category.sort_order) }}><Pencil size={16} /></button><button className="icon-button danger" disabled={busy} aria-label={`删除分类 ${category.name}`} title="删除分类" onClick={async () => { if (!window.confirm(`确定删除分类“${category.name}”？`)) return; setBusy(true); setError(''); try { await deleteCategory(category.id); await reload() } catch (err) { setError(err instanceof Error ? err.message : '删除失败。') } finally { setBusy(false) } }}><Trash2 size={16} /></button></div></div>)}</div>
  </main>
}
