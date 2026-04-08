import { useRef, useEffect, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// RichTextEditor
// Toolbar: Normal | Heading | Bold | Bullet list
// Stores content as an HTML string.
// Uses document.execCommand (deprecated but universally supported without libs).
// ─────────────────────────────────────────────────────────────────────────────

export default function RichTextEditor({
  value = '',
  onChange,
  readOnly = false,
  placeholder = 'Start typing...',
}) {
  const editorRef = useRef(null)
  const [isEmpty, setIsEmpty] = useState(true)
  const [focused, setFocused] = useState(false)

  // Sync external value into DOM when not focused
  useEffect(() => {
    if (!editorRef.current) return
    if (document.activeElement === editorRef.current) return
    const currentHtml = editorRef.current.innerHTML
    if (currentHtml !== value) {
      editorRef.current.innerHTML = value || ''
      checkEmpty()
    }
  }, [value])

  function checkEmpty() {
    if (!editorRef.current) return
    const text = editorRef.current.textContent.trim()
    setIsEmpty(!text)
  }

  function emitChange() {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    const text = editorRef.current.textContent.trim()
    checkEmpty()
    onChange(text ? html : '')
  }

  // Execute a formatting command without losing editor focus
  function execCmd(cmd, arg) {
    editorRef.current?.focus()
    document.execCommand(cmd, false, arg || null)
    emitChange()
  }

  // ── Toolbar Button ──────────────────────────────────────────────────────────
  function Btn({ label, cmd, arg, title, bold }) {
    return (
      <button
        type="button"
        title={title || label}
        onMouseDown={e => {
          e.preventDefault() // Keep focus in editor
          execCmd(cmd, arg)
        }}
        className="px-2.5 py-1 rounded text-xs transition-colors select-none hover:bg-white/15 active:bg-white/20"
        style={{ color: '#c5c1b9', fontWeight: bold ? '700' : '500' }}
      >
        {label}
      </button>
    )
  }

  // ── Read-only render ────────────────────────────────────────────────────────
  if (readOnly) {
    if (!value || !value.replace(/<[^>]*>/g, '').trim()) {
      return <p className="text-sm text-[#8a8680] italic">No content yet.</p>
    }
    return (
      <div
        className="rte-readonly text-sm text-[#c5c1b9] leading-relaxed"
        dangerouslySetInnerHTML={{ __html: value }}
        style={{ lineHeight: '1.7' }}
      />
    )
  }

  // ── Editor render ───────────────────────────────────────────────────────────
  return (
    <div
      className="rounded-lg overflow-hidden transition-all"
      style={{
        border: `1px solid ${focused ? '#575ECF' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap"
        style={{
          backgroundColor: '#242424',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Btn label="Normal" cmd="formatBlock" arg="p" title="Normal paragraph" />
        <div className="w-px h-4 mx-1" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
        <Btn label="H" cmd="formatBlock" arg="h2" title="Heading" />
        <div className="w-px h-4 mx-1" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
        <Btn label="B" cmd="bold" title="Bold" bold />
        <div className="w-px h-4 mx-1" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
        <Btn label="• List" cmd="insertUnorderedList" title="Bullet list" />
        <div className="w-px h-4 mx-1" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
        <Btn label="1. List" cmd="insertOrderedList" title="Numbered list" />
      </div>

      {/* Editor */}
      <div className="relative" style={{ backgroundColor: '#1b1b1b' }}>
        {/* Placeholder */}
        {isEmpty && (
          <div
            className="absolute top-3 left-3 text-sm pointer-events-none select-none"
            style={{ color: '#8a8680', zIndex: 1 }}
          >
            {placeholder}
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emitChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={e => {
            // On Enter inside a list item, browser handles it natively
            // On Enter in an empty block, prevent double blank lines
            if (e.key === 'Tab') {
              e.preventDefault()
              document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;')
            }
          }}
          className="rte-editor outline-none p-3 text-sm"
          style={{
            minHeight: '140px',
            color: '#c5c1b9',
            lineHeight: '1.7',
            position: 'relative',
            zIndex: 2,
          }}
        />
      </div>

      <style>{`
        .rte-editor h2 { font-size: 1.1em; font-weight: 700; color: #fff; margin: 0.4em 0; }
        .rte-editor h3 { font-size: 0.95em; font-weight: 600; color: #e5e1d9; margin: 0.3em 0; }
        .rte-editor ul { padding-left: 1.25em; margin: 0.25em 0; list-style-type: disc; }
        .rte-editor ol { padding-left: 1.25em; margin: 0.25em 0; list-style-type: decimal; }
        .rte-editor li { margin: 0.1em 0; }
        .rte-editor p { margin: 0.2em 0; }
        .rte-editor strong, .rte-editor b { font-weight: 700; color: #fff; }
        .rte-readonly h2 { font-size: 1.1em; font-weight: 700; color: #fff; margin: 0.4em 0; }
        .rte-readonly h3 { font-size: 0.95em; font-weight: 600; color: #e5e1d9; margin: 0.3em 0; }
        .rte-readonly ul { padding-left: 1.25em; margin: 0.25em 0; list-style-type: disc; }
        .rte-readonly ol { padding-left: 1.25em; margin: 0.25em 0; list-style-type: decimal; }
        .rte-readonly li { margin: 0.1em 0; }
        .rte-readonly p { margin: 0.2em 0; }
        .rte-readonly strong, .rte-readonly b { font-weight: 700; color: #fff; }
      `}</style>
    </div>
  )
}
