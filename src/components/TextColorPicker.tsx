import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { Check, RotateCcw, Type } from 'lucide-react'
import { DEFAULT_TEXT_COLOR, normalizeTextColor } from '../lib/text-color'

const colors = [
  { name: '黑色', value: '#25282e' },
  { name: '灰色', value: '#687582' },
  { name: '红色', value: '#c73939' },
  { name: '橙色', value: '#c26720' },
  { name: '金色', value: '#927018' },
  { name: '绿色', value: '#27834b' },
  { name: '青绿色', value: '#168278' },
  { name: '青色', value: '#187e9a' },
  { name: '蓝色', value: '#2365d9' },
  { name: '靛蓝色', value: '#5156b8' },
  { name: '紫色', value: '#8b49ac' },
  { name: '玫红色', value: '#b83c77' },
]

export default function TextColorPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('#2365d9')
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const current = normalizeTextColor(editor.getAttributes('textStyle').color)
  const disabled = editor.isActive('codeBlock')
  const customColor = normalizeTextColor(custom)

  useEffect(() => {
    if (!open) return
    function place() {
      const rect = trigger.current?.getBoundingClientRect()
      if (!rect) return
      const height = panel.current?.offsetHeight || 245
      const below = rect.bottom + 8
      setPosition({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 264)),
        top: below + height <= window.innerHeight - 12 ? below : Math.max(12, rect.top - height - 8),
      })
    }
    function outside(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus() }
    }
    place()
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape, true)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  function apply(color?: string) {
    if (color) editor.chain().focus().setColor(color).run()
    else editor.chain().focus().unsetColor().run()
    setOpen(false)
  }
  return <div ref={container} className="text-color-picker">
    <button ref={trigger} type="button" className={`tool-button color-trigger ${open ? 'active' : ''}`} title={disabled ? '代码块使用语法高亮颜色' : '字体颜色'} aria-label="字体颜色" aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => { setCustom(current || '#2365d9'); setOpen(value => !value) }}>
      <Type size={16} /><span className="current-color-line" style={{ backgroundColor: current || DEFAULT_TEXT_COLOR }} />
    </button>
    {open && <div ref={panel} role="dialog" aria-label="选择字体颜色" className="color-popover" style={position}>
      <div className="color-panel-label">字体颜色</div>
      <div className="color-swatches" role="group" aria-label="常用颜色">{colors.map(color => <button type="button" className="color-swatch" key={color.value} style={{ backgroundColor: color.value }} aria-label={color.name} title={color.name} aria-pressed={current === color.value} onMouseDown={event => event.preventDefault()} onClick={() => apply(color.value)}>{current === color.value && <Check size={15} />}</button>)}</div>
      <button type="button" className="reset-text-color" onMouseDown={event => event.preventDefault()} onClick={() => apply()}><RotateCcw size={14} />恢复默认颜色</button>
      <form className="color-custom" onSubmit={event => { event.preventDefault(); if (customColor) apply(customColor) }}>
        <label htmlFor="custom-text-color">自定义</label>
        <div className="custom-color-fields">
          <input type="color" aria-label="自定义颜色选择器" value={customColor || '#2365d9'} onChange={event => setCustom(event.target.value)} />
          <input id="custom-text-color" aria-label="颜色值" autoComplete="off" spellCheck={false} value={custom} maxLength={24} onChange={event => setCustom(event.target.value)} />
          <button type="submit" disabled={!customColor}>应用</button>
        </div>
      </form>
    </div>}
  </div>
}
