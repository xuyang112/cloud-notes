import { createBundledHighlighter, createSingletonShorthands } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

type ShikiToken = { content: string; color?: string; fontStyle?: number }

const supportedLanguages = {
  java: () => import('@shikijs/langs/java'),
  sql: () => import('@shikijs/langs/sql'),
  c: () => import('@shikijs/langs/c'),
  cpp: () => import('@shikijs/langs/cpp'),
  javascript: () => import('@shikijs/langs/javascript'),
  bash: () => import('@shikijs/langs/bash'),
} as const

const createHighlighter = createBundledHighlighter({
  langs: supportedLanguages,
  themes: { 'github-dark-default': () => import('@shikijs/themes/github-dark-default') },
  engine: () => createJavaScriptRegexEngine(),
})

const { codeToTokens } = createSingletonShorthands(createHighlighter)

export async function highlightCode(text: string, language: string): Promise<ShikiToken[][]> {
  const lang = language in supportedLanguages ? language as keyof typeof supportedLanguages : 'text'
  const result = await codeToTokens(text, { lang, theme: 'github-dark-default' })
  return result.tokens
}
