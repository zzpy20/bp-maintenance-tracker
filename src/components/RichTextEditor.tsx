import { useEditor, EditorContent, Extension } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import Image from '@tiptap/extension-image'

// Font size support via TextStyle attribute
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] } },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: el => el.style.fontSize || null,
          renderHTML: attrs => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
        },
      },
    }]
  },
})

type Props = {
  content: string
  onChange: (html: string) => void
  grow?: boolean  // fills available height (use inside a flex-col container)
}

export function RichTextEditor({ content, onChange, grow }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Image.configure({ allowBase64: true, inline: true }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      transformPastedHTML(html) {
        // Only convert <div> block containers to <p> for proper paragraph handling.
        // Everything else (styles, colours, font sizes, images) is kept as-is.
        return html
          .replace(/<div([^>]*)>/gi, '<p$1>')
          .replace(/<\/div>/gi, '</p>')
      },
    },
  })

  if (!editor) return null

  const ToolBtn = ({
    active, onClick, children,
  }: { active?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      className={`px-2 py-1 text-xs rounded transition-colors ${
        active ? 'bg-gray-700 text-white' : 'text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  )

  const Sep = () => <span className="w-px h-4 bg-gray-300 mx-0.5 self-center" />

  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 ${grow ? 'flex flex-col flex-1 min-h-0' : ''}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50 shrink-0">
        <ToolBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <strong>B</strong>
        </ToolBtn>
        <ToolBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <em>I</em>
        </ToolBtn>
        <ToolBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <span className="underline">U</span>
        </ToolBtn>
        <ToolBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <span className="line-through">S</span>
        </ToolBtn>

        <Sep />

        <ToolBtn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</ToolBtn>
        <ToolBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolBtn>
        <ToolBtn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolBtn>

        <Sep />

        <ToolBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</ToolBtn>
        <ToolBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</ToolBtn>
        <ToolBtn active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>☐ Task</ToolBtn>

        <Sep />

        <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()}>— Break</ToolBtn>

        <Sep />

        <ToolBtn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>Clear</ToolBtn>
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className={`rich-text px-3 py-2 text-sm text-gray-800 cursor-text ${grow ? 'flex-1 overflow-y-auto' : 'min-h-[8rem]'}`}
      />
    </div>
  )
}
