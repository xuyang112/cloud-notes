import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

const KEY = 'note-tutorial-collapsed'
export default function Tutorial({ title, children, onCollapsedChange }: { title: string; children: ReactNode; onCollapsedChange?: (value: boolean) => void }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(KEY) === 'true' } catch { return false }
  })
  const [storageError, setStorageError] = useState(false)
  const id = useId()
  useEffect(() => { onCollapsedChange?.(collapsed) }, [collapsed, onCollapsedChange])
  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(KEY, String(next)); setStorageError(false) } catch { setStorageError(true) }
  }
  return <>
    <div className="article-heading">
      <h1>{title}</h1>
      <button className="tutorial-toggle" aria-expanded={!collapsed} aria-controls={id} onClick={toggle}>
        {collapsed ? '显示教程' : '隐藏教程'}{collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
    </div>
    {storageError && <p role="status" className="field-error">浏览器禁止存储，折叠状态无法在刷新后保留。</p>}
    <div id={id} className={`tutorial-body ${collapsed ? 'is-collapsed' : ''}`} aria-hidden={collapsed} inert={collapsed}>
      <div className="tutorial-inner">{children}</div>
    </div>
  </>
}
