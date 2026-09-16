export const DEFAULT_TEXT_COLOR = '#25282e'

export function normalizeTextColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return
  const color = value.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(color)) return color
  if (/^#[0-9a-f]{3}$/.test(color)) return `#${[...color.slice(1)].map(character => character.repeat(2)).join('')}`
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(color)
  if (!rgb) return
  const channels = rgb.slice(1).map(Number)
  if (channels.some(channel => channel > 255)) return
  return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`
}
