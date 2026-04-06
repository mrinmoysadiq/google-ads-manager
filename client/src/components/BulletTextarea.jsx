import { useState, useRef } from 'react'

/**
 * BulletTextarea — a textarea with Google Docs-style bullet point support.
 *
 * Behaviour:
 * - Click the Bullets toolbar button to toggle bullets on the current line
 *   or on every line in the current selection.
 * - While the cursor is on a bullet line, pressing Enter automatically
 *   starts the next line with "• ".
 * - Pressing Enter on an empty bullet line (just "• ") removes that bullet
 *   and exits bullet mode (same as double-Enter in Google Docs).
 * - All other props (value, onChange, rows, placeholder, className, style)
 *   behave exactly like a normal <textarea>.
 */
export default function BulletTextarea({
  value,
  onChange,
  rows = 4,
  placeholder,
  className = '',
  style = {},
}) {
  const ref = useRef(null)
  const [onBulletLine, setOnBulletLine] = useState(false)

  /* ── helpers ──────────────────────────────────────────────────── */

  const getLineRange = (text, pos) => {
    const start = text.lastIndexOf('\n', pos - 1) + 1
    let end = text.indexOf('\n', pos)
    if (end === -1) end = text.length
    return { start, end }
  }

  const refreshBulletIndicator = (text, pos) => {
    const { start, end } = getLineRange(text, pos)
    const line = text.substring(start, end)
    setOnBulletLine(line.startsWith('• '))
  }

  /* ── keyboard handler ─────────────────────────────────────────── */

  const handleKeyDown = (e) => {
    if (e.key !== 'Enter') return

    const ta = ref.current
    const pos = ta.selectionStart
    const selEnd = ta.selectionEnd
    const { start, end } = getLineRange(value, pos)
    const currentLine = value.substring(start, end)

    if (!currentLine.startsWith('• ')) return // normal Enter behaviour

    e.preventDefault()

    if (currentLine === '• ') {
      // Empty bullet → remove bullet prefix and break out
      const newValue = value.substring(0, start) + value.substring(end)
      onChange({ target: { value: newValue } })
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start
        refreshBulletIndicator(newValue, start)
      }, 0)
    } else {
      // Continue bullet on next line
      const insert = '\n• '
      const newValue = value.substring(0, pos) + insert + value.substring(selEnd)
      onChange({ target: { value: newValue } })
      const newPos = pos + insert.length
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = newPos
        refreshBulletIndicator(newValue, newPos)
      }, 0)
    }
  }

  /* ── bullet toggle button ─────────────────────────────────────── */

  const handleBulletToggle = () => {
    const ta = ref.current
    if (!ta) return

    const start = ta.selectionStart
    const end = ta.selectionEnd

    // Expand selection to cover full lines
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    let lineEnd = value.indexOf('\n', end)
    if (lineEnd === -1) lineEnd = value.length

    const block = value.substring(lineStart, lineEnd)
    const lines = block.split('\n')
    const allBullets = lines.every(l => l.startsWith('• '))

    const newLines = allBullets
      ? lines.map(l => (l.startsWith('• ') ? l.slice(2) : l))   // remove
      : lines.map(l => (l.startsWith('• ') ? l : '• ' + l))     // add

    const newBlock = newLines.join('\n')
    const newValue = value.substring(0, lineStart) + newBlock + value.substring(lineEnd)

    onChange({ target: { value: newValue } })

    setTimeout(() => {
      ta.focus()
      // keep the same selection range (adjusted for length change)
      const delta = newBlock.length - block.length
      ta.selectionStart = lineStart
      ta.selectionEnd = lineEnd + delta
      refreshBulletIndicator(newValue, ta.selectionStart)
    }, 0)
  }

  /* ── cursor-move tracking ─────────────────────────────────────── */

  const handleCursorMove = () => {
    const ta = ref.current
    if (ta) refreshBulletIndicator(value, ta.selectionStart)
  }

  /* ── render ───────────────────────────────────────────────────── */

  return (
    <div>
      {/* Toolbar */}
      <div className="flex gap-1 mb-1.5">
        <button
          type="button"
          onClick={handleBulletToggle}
          title="Toggle bullet list — select lines then click, or click to toggle current line. Press Enter to continue, double-Enter to exit."
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all select-none"
          style={
            onBulletLine
              ? { backgroundColor: 'rgba(87,94,207,0.18)', color: '#575ECF', border: '1px solid rgba(87,94,207,0.45)' }
              : { backgroundColor: '#2a2a2a', color: '#8a8680', border: '1px solid rgba(255,255,255,0.1)' }
          }
          onMouseEnter={e => { if (!onBulletLine) e.currentTarget.style.borderColor = '#575ECF' }}
          onMouseLeave={e => { if (!onBulletLine) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
        >
          {/* Bullet list icon */}
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="2" cy="4" r="1.5" />
            <rect x="5" y="3.25" width="10" height="1.5" rx="0.75" />
            <circle cx="2" cy="8" r="1.5" />
            <rect x="5" y="7.25" width="10" height="1.5" rx="0.75" />
            <circle cx="2" cy="12" r="1.5" />
            <rect x="5" y="11.25" width="10" height="1.5" rx="0.75" />
          </svg>
          Bullets
        </button>
        <span className="text-xs text-[#8a8680] self-center hidden sm:inline">
          Select text → click Bullets, or click to toggle on current line
        </span>
      </div>

      {/* Textarea */}
      <textarea
        ref={ref}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e)
          // keep indicator in sync as user types
          setTimeout(() => {
            if (ref.current) refreshBulletIndicator(e.target.value, ref.current.selectionStart)
          }, 0)
        }}
        onKeyDown={handleKeyDown}
        onSelect={handleCursorMove}
        onClick={handleCursorMove}
        onKeyUp={handleCursorMove}
        className={className}
        style={style}
      />
    </div>
  )
}
