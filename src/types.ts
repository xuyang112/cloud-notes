import type { JSONContent } from '@tiptap/core'

export interface Category {
  id: string
  name: string
  slug: string
  sort_order: number
  created_at: string
}

export interface Note {
  id: string
  title: string
  slug: string
  content: JSONContent
  content_html: string
  category_id: string | null
  published: boolean
  created_at: string
  updated_at: string
}

export interface Notebook { categories: Category[]; notes: Note[] }
