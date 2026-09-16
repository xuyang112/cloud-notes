import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownWideNarrow, ArrowRight, CalendarDays, FileText } from 'lucide-react'
import { useNotebook } from '../store'
import { excerpt, plainText } from '../lib/content'

export default function Home() {
  const { data } = useNotebook()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') || ''
  const selected = params.get('category') || ''
  const [order, setOrder] = useState('recent')
  const categories = [...data.categories].sort((a, b) => a.sort_order - b.sort_order)
  let notes = data.notes.filter(note => note.published && (!selected || note.category_id === selected))
  if (query) {
    const terms = query.toLocaleLowerCase().trim().split(/\s+/)
    notes = notes.filter(note => terms.every(term => `${note.title} ${plainText(note.content)}`.toLocaleLowerCase().includes(term)))
  }
  notes = [...notes].sort((a, b) => order === 'recent' ? b.updated_at.localeCompare(a.updated_at) : a.title.localeCompare(b.title, 'zh-CN'))
  return <main className="index-page">
    <div className="index-title"><div><div className="eyebrow">NOTE / KNOWLEDGE</div><h1>{query ? '搜索结果' : '全部笔记'}</h1><p>{query ? `“${query}” · 找到 ${notes.length} 篇笔记` : `${categories.length} 个分类 · ${data.notes.filter(note => note.published).length} 篇知识记录`}</p></div><FileText className="index-mark" size={38} strokeWidth={1.2} /></div>
    <div className="list-controls">
      <div className="category-tabs" role="tablist" aria-label="筛选分类">{[{ id: '', name: '全部' }, ...categories].map(category => <button key={category.id} role="tab" aria-selected={selected === category.id} className={selected === category.id ? 'selected' : ''} onClick={() => { const next = new URLSearchParams(params); category.id ? next.set('category', category.id) : next.delete('category'); setParams(next) }}>{category.name}</button>)}</div>
      <label className="sort-control"><ArrowDownWideNarrow size={15} /><select aria-label="笔记排序" value={order} onChange={event => setOrder(event.target.value)}><option value="recent">最近更新</option><option value="title">按标题</option></select></label>
    </div>
    <div className="note-list">
      {notes.map((note, index) => <Link className="note-row" key={note.id} to={`/notes/${encodeURIComponent(note.slug)}`}>
        <span className="note-number">{String(index + 1).padStart(2, '0')}</span>
        <div className="note-summary"><div className="note-row-meta"><span className={`category-label category-${categories.findIndex(category => category.id === note.category_id)}`}>{categories.find(category => category.id === note.category_id)?.name || '未分类'}</span><span><CalendarDays size={12} />{note.updated_at.slice(0, 10)}</span></div><h2>{note.title}</h2><p>{excerpt(note)}</p></div>
        <ArrowRight size={19} className="row-arrow" />
      </Link>)}
      {!notes.length && <div className="empty-state"><SearchEmpty /><h2>没有找到笔记</h2><p>换一个关键词，或查看其他分类。</p><Link to="/">查看全部笔记</Link></div>}
    </div>
    <footer className="index-footer"><span>共 {notes.length} 篇</span><span>记录 · 理解 · 回顾</span></footer>
  </main>
}
function SearchEmpty() { return <FileText size={30} strokeWidth={1.3} /> }
