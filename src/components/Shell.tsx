import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ArrowUpRight, ChevronDown, Code2, Database, Layers, Menu, SquarePen, X, Cpu } from 'lucide-react'
import { site } from '../../site.config.mjs'
import { configured } from '../lib/repository'
import { useNotebook } from '../store'

const icons = [Code2, Database, Cpu, Layers]
export default function Shell() {
  const { data, loading, error, reload } = useNotebook()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const drawerRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  const [closedGroups, setClosedGroups] = useState<string[]>([])
  const publicNotes = data.notes.filter(note => note.published)
  const categories = [...data.categories].sort((a, b) => a.sort_order - b.sort_order)
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [location.pathname, location.search])
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawerRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { setOpen(false); menuRef.current?.focus() }
      if (event.key === 'Tab') {
        const elements = drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
        const visible = Array.from(elements || []).filter(element => element.getClientRects().length > 0)
        const first = visible[0]; const last = visible.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', handleKey) }
  }, [open])
  return <div className="app-layout min-h-screen bg-white text-ink antialiased">
    {open && <div className="drawer-backdrop" onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? 'is-open' : ''}`} ref={drawerRef} aria-label="笔记分类">
      <div className="sidebar-brand"><Link to="/" className="brand">{site.name}<span className="brand-dot" /></Link><button className="icon-button drawer-close" aria-label="关闭导航" onClick={() => { setOpen(false); menuRef.current?.focus() }}><X size={20} /></button></div>
      <span className="sidebar-caption">技术笔记</span>
      <nav className="sidebar-nav">
        {categories.map((category, index) => {
          const Icon = icons[index % icons.length]
          const notes = publicNotes.filter(note => note.category_id === category.id).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.slug.localeCompare(b.slug))
          const closed = closedGroups.includes(category.id)
          return <div className="nav-group" key={category.id}>
            <button className="category-toggle" aria-expanded={!closed} aria-controls={`category-${category.id}`} onClick={() => setClosedGroups(value => closed ? value.filter(id => id !== category.id) : [...value, category.id])}><Icon size={16} /><span>{category.name}</span><ChevronDown size={13} className={closed ? 'rotated' : ''} /></button>
            <div id={`category-${category.id}`} hidden={closed} className="category-articles">{notes.map(note => <NavLink key={note.id} to={`/notes/${encodeURIComponent(note.slug)}`} className={({ isActive }) => `article-link ${isActive ? 'active' : ''}`}><span>{note.title.replace(/^.*? - /, '')}</span></NavLink>)}</div>
          </div>
        })}
      </nav>
      <footer className="sidebar-footer"><Link to="/admin"><SquarePen size={15} />管理笔记<ArrowUpRight size={13} /></Link><p>© {site.copyrightYear} {site.hostname}</p></footer>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <button ref={menuRef} className="icon-button mobile-menu" title="打开导航" aria-label="打开导航" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={21} /></button>
        <div className="breadcrumb"><Link to="/">笔记本</Link><span>/</span><span>{location.pathname.startsWith('/admin') ? '管理' : location.pathname.startsWith('/notes/') ? '知识记录' : '全部笔记'}</span></div>
        {!configured && <span className="preview-badge">本机预览</span>}
      </header>
      {error ? <div className="error-state"><h1>暂时无法读取笔记</h1><p>{error}</p><button className="primary-button" onClick={() => void reload()}>重新加载</button></div>
        : loading ? <div className="empty-state" role="status">正在加载笔记…</div> : <Outlet />}
    </div>
  </div>
}
