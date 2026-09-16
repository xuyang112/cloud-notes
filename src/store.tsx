import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Notebook } from './types'
import { loadNotebook, supabase } from './lib/repository'

interface Store {
  data: Notebook
  loading: boolean
  error: string
  reload: () => Promise<void>
}
const Context = createContext<Store | null>(null)

export function NotebookProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Notebook>({ notes: [], categories: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    try { setData(await loadNotebook()); setError('') }
    catch (err) { setError(err instanceof Error ? err.message : '读取笔记失败。') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    void reload()
    const { data: subscription } = supabase?.auth.onAuthStateChange(() => { void reload() }) || {}
    const sync = () => { void reload() }
    window.addEventListener('storage', sync)
    return () => { subscription?.subscription.unsubscribe(); window.removeEventListener('storage', sync) }
  }, [reload])
  return <Context.Provider value={{ data, loading, error, reload }}>{children}</Context.Provider>
}

export function useNotebook() {
  const context = useContext(Context)
  if (!context) throw new Error('NotebookProvider is required.')
  return context
}
