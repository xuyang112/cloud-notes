import { createClient } from '@supabase/supabase-js'
import { seed } from '../data/seed'
import type { Category, Note, Notebook } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
export const configured = Boolean(url && key)
export const configurationIncomplete = Boolean(url) !== Boolean(key)
export const supabase = configured ? createClient(url!, key!) : null
const LOCAL_KEY = 'note-local-preview-v1'

function readLocal(): Notebook {
  const raw = localStorage.getItem(LOCAL_KEY)
  if (!raw) return structuredClone(seed)
  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data.notes) || !Array.isArray(data.categories)) throw new Error('invalid')
    return data
  } catch { throw new Error('本机预览数据无法读取。请先备份浏览器中的 note-local-preview-v1 数据，不要清除存储。') }
}

export function persistLocal(data: Notebook) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)) }
  catch { throw new Error('本机存储空间不足，未保存。请导出备份并减少图片大小。') }
}

async function readAll<T>(table: string): Promise<T[]> {
  if (!supabase) return []
  const rows: T[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from(table).select('*').order('id').range(offset, offset + 499)
    if (error) throw error
    rows.push(...data as T[])
    if (data.length < 500) return rows
  }
}

export async function loadNotebook(): Promise<Notebook> {
  if (configurationIncomplete) throw new Error('Supabase 环境变量不完整，请同时填写 URL 和 anon key 后重启。')
  if (!supabase) return readLocal()
  const [categories, notes] = await Promise.all([readAll<Category>('categories'), readAll<Note>('notes')])
  return { categories, notes }
}

export async function saveNote(note: Note, expected?: string): Promise<Note> {
  if (!supabase) {
    const data = readLocal()
    const current = data.notes.find(item => item.id === note.id)
    if (expected && (!current || current.updated_at !== expected)) throw new Error('这篇笔记已在另一个窗口更新或删除。请导出当前内容，再重新打开文章。')
    if (data.notes.some(item => item.slug === note.slug && item.id !== note.id)) throw new Error('这个 slug 已被其他笔记使用。')
    const saved = { ...note, updated_at: new Date().toISOString() }
    data.notes = [...data.notes.filter(item => item.id !== note.id), saved]
    persistLocal(data)
    return saved
  }
  const { updated_at: _updated, ...values } = note
  const query = expected
    ? supabase.from('notes').update(values).eq('id', note.id).eq('updated_at', expected)
    : supabase.from('notes').insert(values)
  const { data, error } = await query.select().maybeSingle()
  if (error) throw error
  if (!data) throw new Error('保存冲突或没有编辑权限。请保留当前内容，重新打开文章后再试。')
  return data as Note
}

export async function deleteNote(id: string) {
  if (!supabase) {
    const data = readLocal()
    data.notes = data.notes.filter(note => note.id !== id)
    persistLocal(data)
  } else {
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (error) throw error
  }
}

export async function saveCategory(category: Category) {
  if (!supabase) {
    const data = readLocal()
    if (data.categories.some(item => item.slug === category.slug && item.id !== category.id)) throw new Error('分类 slug 已存在。')
    data.categories = [...data.categories.filter(item => item.id !== category.id), category]
    persistLocal(data)
  } else {
    const { error } = await supabase.from('categories').upsert(category)
    if (error) throw error
  }
}

export async function deleteCategory(id: string) {
  if (!supabase) {
    const data = readLocal()
    if (data.notes.some(note => note.category_id === id)) throw new Error('请先移动或删除该分类下的笔记。')
    data.categories = data.categories.filter(category => category.id !== id)
    persistLocal(data)
  } else {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) throw new Error('无法删除分类，请确认该分类下已没有笔记。', { cause: error })
  }
}

export async function uploadImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('支持 PNG、JPG、WebP 和 GIF 图片。')
  if (file.size > 5 * 1024 * 1024) throw new Error('图片不能超过 5 MB。')
  if (!supabase) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('图片读取失败。'))
      reader.readAsDataURL(file)
    })
  }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('请先登录。')
  const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('note-images').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return supabase.storage.from('note-images').getPublicUrl(path).data.publicUrl
}
