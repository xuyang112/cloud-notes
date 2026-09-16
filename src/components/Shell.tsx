import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpRight, ChevronDown, Code2, Database, Layers, Menu, Moon, Search, SquarePen, Sun, X, Cpu } from 'lucide-react'
import { site } from '../../site.config.mjs'
import { configured } from '../lib/repository'
import { useNotebook } from '../store'

const icons = [Code2, Database, Cpu, Layers]
const GROUPS_KEY = 'note-sidebar-closed-groups'
const THEME_KEY = 'note-theme'

function savedGroups() {
  try {
    const value = JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch { return [] }
}

function initialTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* Fall back to the user's system preference. */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function Shell() {
  const { data, loading, error, reload } = useNotebook()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState(initialTheme)
  const drawerRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [closedGroups, setClosedGroups] = useState<string[]>(savedGroups)
  const publicNotes = data.notes.filter(note => note.published)
  const categories = [...data.categories].sort((a, b) => a.sort_order - b.sort_order)
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [location.pathname, location.search])
  useEffect(() => {
    try { localStorage.setItem(GROUPS_KEY, JSON.stringify(closedGroups)) } catch { /* Navigation remains usable without storage. */ }
  }, [closedGroups])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try { localStorage.setItem(THEME_KEY, theme) } catch { /* The visual preference is still applied for this session. */ }
  }, [theme])
  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') setSearchOpen(false)
    }
    document.addEventListener('keydown', handleShortcut)
    return () => document.removeEventListener('keydown', handleShortcut)
  }, [])
  useEffect(() => {
    if (searchOpen) window.setTimeout(() => searchRef.current?.focus(), 0)
  }, [searchOpen])
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
  function submitSearch(event: FormEvent) {
    event.preventDefault()
    const terms = query.trim()
    navigate(terms ? `/?q=${encodeURIComponent(terms)}` : '/')
    setSearchOpen(false)
  }
  const shortcut = navigator.userAgent.includes('Mac') ? 'Cmd K' : 'Ctrl K'
  return <div className="app-layout">
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
        <button type="button" className="search-trigger" aria-label="搜索笔记" onClick={() => setSearchOpen(true)}><Search size={16} /><span>搜索笔记</span><kbd>{shortcut}</kbd></button>
        <button type="button" className="icon-button theme-toggle" title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'} aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'} onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        {!configured && <span className="preview-badge">本机预览</span>}
      </header>
      {error ? <div className="error-state"><h1>暂时无法读取笔记</h1><p>{error}</p><button className="primary-button" onClick={() => void reload()}>重新加载</button></div>
        : loading ? <div className="empty-state" role="status">正在加载笔记…</div> : <Outlet />}
    </div>
    {searchOpen && <div className="search-dialog-backdrop" role="presentation" onMouseDown={() => setSearchOpen(false)}>
      <form className="search-dialog" role="search" onSubmit={submitSearch} onMouseDown={event => event.stopPropagation()}>
        <Search size={18} aria-hidden="true" />
        <input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索笔记" aria-label="搜索笔记" />
        <kbd>Esc</kbd>
      </form>
    </div>}
  </div>
}
