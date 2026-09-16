import StarterKit from '@tiptap/starter-kit'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import { lowlight } from './content'

export function editorExtensions() {
  return [
    StarterKit.configure({
      codeBlock: false,
      heading: { levels: [2, 3, 4] },
      link: { openOnClick: false, protocols: ['https', 'http', 'mailto'], HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
    }),
    TextStyle,
    Color,
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: 'java' }),
    Image.configure({ allowBase64: true }),
    TableKit.configure({ table: { resizable: false } }),
  ]
}
