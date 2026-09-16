import { Navigate } from 'react-router-dom'
import { useNotebook } from '../store'

export default function RootRedirect() {
  const { data } = useNotebook()
  const categories = [...data.categories].sort((a, b) => a.sort_order - b.sort_order)
  const notes = data.notes
    .filter(note => note.published)
    .sort((a, b) => {
      const categoryOrder = categories.findIndex(category => category.id === a.category_id) - categories.findIndex(category => category.id === b.category_id)
      return categoryOrder || a.created_at.localeCompare(b.created_at) || a.slug.localeCompare(b.slug)
    })
  const firstNote = notes[0]

  if (firstNote) return <Navigate to={`/notes/${encodeURIComponent(firstNote.slug)}`} replace />
  return <main className="empty-state"><h1>还没有已发布笔记</h1><p>请从侧边栏选择文章。</p></main>
}
