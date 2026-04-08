import { useRef, useEffect } from 'react'

const BULLET = '• '
const INDENT_BULLET = '  • '

function linesFromBullets(bullets) {
  if (!bullets || bullets.length === 0) return [BULLET]
  return bullets.map(b => {
    if (b.startsWith('  ')) return INDENT_BULLET + b.replace(/^\s+/, '')
    return BULLET + b
  })
}

function bulletsFromLines(lines) {
  return lines
    .map(line => {
      if (line.startsWith(INDENT_BULLET)) return '  ' + line.slice(INDENT_BULLET.length)
      if (line.startsWith(BULLET)) return line.slice(BULLET.length)
      return line
    })
    .filter(b => b.trim() !== '')
}

export default function BulletEditor({ value = [], onChange, readOnly = false, placeholder = 'Add bullet points...' }) {
  const ref = useRef(null)
  const isComposing = useRef(false)
  const lastLines = useRef(linesFromBullets(value))

  // Sync external value changes into the DOM (only when not focused)
  useEffect(() => {
    if (!ref.current) return
    if (document.activeElement === ref.current) return
    const lines = linesFromBullets(value)
    lastLines.current = lines
    ref.current.innerHTML = lines.map(l => `<div>${escapeHtml(l)}</div>`).join('')
  }, [value])

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function getLines() {
    if (!ref.current) return []
    const divs = ref.current.querySelectorAll('div')
    if (divs.length === 0) {
      return [ref.current.innerText || '']
    }
    return Array.from(divs).map(d => d.innerText || '')
  }

  function setLines(lines, caretLineIndex, caretOffset) {
    if (!ref.current) return
    ref.current.innerHTML = lines.map(l => `<div>${escapeHtml(l) || '<br>'}</div>`).join('')
    // Restore caret
    if (caretLineIndex !== undefined) {
      const divs = ref.current.querySelectorAll('div')
      const targetDiv = divs[Math.min(caretLineIndex, divs.length - 1)]
      if (targetDiv) {
        const range = document.createRange()
        const sel = window.getSelection()
        const textNode = targetDiv.firstChild
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          const offset = Math.min(caretOffset ?? targetDiv.innerText.length, textNode.length)
          range.setStart(textNode, offset)
        } else {
          range.setStart(targetDiv, 0)
        }
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
  }

  function getCaretInfo() {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return { lineIndex: 0, offset: 0 }
    const range = sel.getRangeAt(0)
    const divs = Array.from(ref.current?.querySelectorAll('div') || [])
    let lineIndex = 0
    for (let i = 0; i < divs.length; i++) {
      if (divs[i].contains(range.startContainer)) { lineIndex = i; break }
    }
    return { lineIndex, offset: range.startOffset }
  }

  function emitChange(lines) {
    lastLines.current = lines
    onChange(bulletsFromLines(lines))
  }

  function handleKeyDown(e) {
    if (isComposing.current) return
    const lines = getLines()
    const { lineIndex, offset } = getCaretInfo()

    if (e.key === 'Enter') {
      e.preventDefault()
      const currentLine = lines[lineIndex] || ''
      const indent = currentLine.startsWith(INDENT_BULLET) ? INDENT_BULLET : BULLET
      const newLines = [
        ...lines.slice(0, lineIndex + 1),
        indent,
        ...lines.slice(lineIndex + 1),
      ]
      setLines(newLines, lineIndex + 1, indent.length)
      emitChange(newLines)
      return
    }

    if (e.key === 'Backspace') {
      const currentLine = lines[lineIndex] || ''
      const prefix = currentLine.startsWith(INDENT_BULLET) ? INDENT_BULLET : BULLET
      if (offset <= prefix.length && lineIndex > 0) {
        e.preventDefault()
        // Merge with previous line or remove empty
        const prevLine = lines[lineIndex - 1] || ''
        const content = currentLine.slice(prefix.length)
        const newLines = [
          ...lines.slice(0, lineIndex - 1),
          prevLine + content,
          ...lines.slice(lineIndex + 1),
        ]
        setLines(newLines, lineIndex - 1, prevLine.length)
        emitChange(newLines)
        return
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      const currentLine = lines[lineIndex] || ''
      let newLine
      if (e.shiftKey) {
        // Unindent
        newLine = currentLine.startsWith(INDENT_BULLET)
          ? BULLET + currentLine.slice(INDENT_BULLET.length)
          : currentLine
      } else {
        // Indent
        newLine = currentLine.startsWith(BULLET) && !currentLine.startsWith(INDENT_BULLET)
          ? INDENT_BULLET + currentLine.slice(BULLET.length)
          : currentLine
      }
      const newLines = [...lines.slice(0, lineIndex), newLine, ...lines.slice(lineIndex + 1)]
      const newOffset = e.shiftKey
        ? Math.max(BULLET.length, offset - (INDENT_BULLET.length - BULLET.length))
        : Math.min(newLine.length, offset + (INDENT_BULLET.length - BULLET.length))
      setLines(newLines, lineIndex, newOffset)
      emitChange(newLines)
      return
    }
  }

  function handleInput() {
    if (isComposing.current) return
    const lines = getLines()
    // Ensure each line starts with a bullet prefix
    const fixed = lines.map(line => {
      if (line.startsWith(INDENT_BULLET)) return line
      if (line.startsWith(BULLET)) return line
      return BULLET + line
    })
    // Only re-render if something was fixed (avoid cursor jump on normal typing)
    const needsFix = fixed.some((l, i) => l !== lines[i])
    if (needsFix) {
      const { lineIndex, offset } = getCaretInfo()
      setLines(fixed, lineIndex, offset)
    }
    emitChange(needsFix ? fixed : lines)
  }

  function handleFocus() {
    if (!ref.current) return
    const lines = linesFromBullets(value)
    if (ref.current.querySelectorAll('div').length === 0) {
      ref.current.innerHTML = lines.map(l => `<div>${escapeHtml(l) || '<br>'}</div>`).join('')
    }
  }

  if (readOnly) {
    const bullets = value && value.length > 0 ? value : []
    if (bullets.length === 0) return (
      <p className="text-[#8a8680] text-sm italic">No content yet.</p>
    )
    return (
      <ul className="space-y-1.5">
        {bullets.map((b, i) => (
          <li
            key={i}
            className="flex gap-2 text-sm text-[#c5c1b9]"
            style={{ paddingLeft: b.startsWith('  ') ? '1.25rem' : '0' }}
          >
            <span className="text-[#575ECF] mt-0.5 flex-shrink-0">•</span>
            <span>{b.replace(/^\s+/, '')}</span>
          </li>
        ))}
      </ul>
    )
  }

  const isEmpty = !value || value.length === 0 || value.every(b => !b.trim())

  return (
    <div className="relative">
      {isEmpty && (
        <div className="absolute top-3 left-3 text-[#8a8680] text-sm pointer-events-none select-none">
          {placeholder}
        </div>
      )}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onFocus={handleFocus}
        onCompositionStart={() => { isComposing.current = true }}
        onCompositionEnd={() => { isComposing.current = false; handleInput() }}
        className="min-h-[120px] rounded-lg p-3 text-sm text-[#c5c1b9] outline-none transition-colors"
        style={{
          backgroundColor: '#1b1b1b',
          border: '1px solid rgba(255,255,255,0.08)',
          lineHeight: '1.7',
        }}
        onFocusCapture={e => { e.currentTarget.style.borderColor = '#575ECF' }}
        onBlurCapture={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
      />
    </div>
  )
}
