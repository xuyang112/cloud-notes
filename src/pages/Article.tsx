import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, List } from 'lucide-react'
import { useNotebook } from '../store'
import RichContent from '../components/RichContent'
import Tutorial from '../components/Tutorial'
import { headings, plainText } from '../lib/content'

export default function Article() {
  const { slug } = useParams()
  const { data } = useNotebook()
  const [collapsed, setCollapsed] = useState(false)
  const [active, setActive] = useState('')
  const categories = [...data.categories].sort((a, b) => a.sort_order - b.sort_order)
  const notes = data.notes.filter(note => note.published).sort((a, b) => (categories.findIndex(category => category.id === a.category_id) - categories.findIndex(category => category.id === b.category_id)) || a.created_at.localeCompare(b.created_at) || a.slug.localeCompare(b.slug))
  const index = notes.findIndex(note => note.slug === slug)
  const note = notes[index]
  const toc = note ? headings(note.content) : []
  useEffect(() => {
    setActive('')
    if (!note) return
    document.title = `${note.title} · NOTE`
    const observer = new IntersectionObserver(entries => {
      const first = entries.find(entry => entry.isIntersecting)
      if (first) setActive(first.target.id)
    }, { rootMargin: '-80px 0px -65% 0px' })
    headings(note.content).forEach(heading => { const element = document.getElementById(heading.id); if (element) observer.observe(element) })
    return () => observer.disconnect()
  }, [note?.id, note?.updated_at])
  if (!note) return <main className="empty-state"><h1>这篇笔记不存在或尚未发布</h1><Link to="/">返回全部笔记</Link></main>
  const category = categories.find(item => item.id === note.category_id)
  return <main className="article-layout">
    <article className="article-main">
      <div className="article-kicker"><Link to={`/?category=${category?.id || ''}`}>{category?.name || '未分类'}</Link><span> / </span><span>学习笔记</span></div>
      <Tutorial title={note.title} onCollapsedChange={setCollapsed}>
        <div className="article-meta"><span><CalendarDays size={13} />更新于 {note.updated_at.slice(0, 10)}</span><span><Clock3 size={13} />约 {Math.max(1, Math.ceil(plainText(note.content).length / 350))} 分钟</span></div>
        <RichContent content={note.content} />
      </Tutorial>
      <nav className="article-pagination" aria-label="相邻文章">
        {notes[index - 1] ? <Link to={`/notes/${encodeURIComponent(notes[index - 1].slug)}`}><span><ArrowLeft size={14} />上一篇</span><strong>{notes[index - 1].title}</strong></Link> : <div />}
        {notes[index + 1] ? <Link to={`/notes/${encodeURIComponent(notes[index + 1].slug)}`}><span>下一篇<ArrowRight size={14} /></span><strong>{notes[index + 1].title}</strong></Link> : <div />}
      </nav>
    </article>
    {!collapsed && <aside className="toc" aria-label="页面目录"><div className="toc-title"><List size={15} />本页目录</div><nav>{toc.map(heading => <a key={heading.id} className={active === heading.id ? 'active' : ''} style={{ paddingLeft: 14 + (heading.level - 2) * 12 }} href={`#${heading.id}`} onClick={() => setActive(heading.id)}>{heading.text.replace(/^\d+ · /, '')}</a>)}</nav><a className="back-to-top" href="#root">返回顶部 ↑</a></aside>}
    {!collapsed && toc.length > 0 && <details className="mobile-toc"><summary>本页目录</summary>{toc.map(heading => <a key={heading.id} href={`#${heading.id}`}>{heading.text}</a>)}</details>}
  </main>
}
