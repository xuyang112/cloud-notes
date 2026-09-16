import StarterKit from '@tiptap/starter-kit'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Image from '@tiptap/extension-image'
import { mergeAttributes, Node } from '@tiptap/core'
import { TableKit } from '@tiptap/extension-table'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import { lowlight } from './content'

const Attachment = Node.create({
  name: 'attachment',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      name: { default: 'attachment' },
      size: { default: 0 },
      mime: { default: 'application/octet-stream' },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="attachment"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    const name = String(HTMLAttributes.name || 'attachment')
    const size = Number(HTMLAttributes.size || 0)
    const sizeLabel = size >= 1024 * 1024
      ? `${(size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.ceil(size / 1024))} KB`
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'attachment', class: 'attachment-node' }),
      ['a', { href: HTMLAttributes.src, download: name, target: '_blank', rel: 'noopener noreferrer' },
        ['span', { 'data-attachment-name': '' }, name],
        ['span', { 'data-attachment-size': '' }, sizeLabel],
      ],
    ]
  },
})

export function editorExtensions() {
  const ResizableImage = Image.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        width: {
          default: null,
          parseHTML: element => element.getAttribute('width') || element.style.width || null,
          renderHTML: attributes => attributes.width ? { width: attributes.width, style: `width: ${attributes.width};` } : {},
        },
      }
    },
  })
  return [
    StarterKit.configure({
      codeBlock: false,
      heading: { levels: [2, 3, 4] },
      link: { openOnClick: false, protocols: ['https', 'http', 'mailto'], HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
    }),
    TextStyle,
    Color,
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: 'java' }),
    ResizableImage.configure({ allowBase64: true }),
    Attachment,
    TableKit.configure({ table: { resizable: false } }),
  ]
}
