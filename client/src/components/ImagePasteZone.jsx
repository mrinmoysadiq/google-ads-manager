import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

// ─── Helper: ImageLightbox ─────────────────────────────────────────────────────

export function ImageLightbox({ src, onClose }) {
  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = src
    a.download = 'source-image.png'
    a.click()
  }

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Portal to document.body so position:fixed escapes any parent's transform stacking context
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        backgroundColor: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '16px',
      }}
    >
      {/* Toolbar */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ display: 'flex', gap: '10px', alignItems: 'center' }}
      >
        <button
          onClick={handleDownload}
          style={{
            backgroundColor: '#575ECF', color: '#fff', border: 'none',
            borderRadius: '8px', padding: '8px 18px', fontSize: '13px',
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          ↓ Download
        </button>
        <button
          onClick={onClose}
          style={{
            backgroundColor: 'rgba(255,255,255,0.1)', color: '#c5c1b9', border: 'none',
            borderRadius: '8px', padding: '8px 18px', fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          ✕ Close
        </button>
      </div>
      {/* Image — full size, no crop */}
      <img
        src={src}
        alt="Source screenshot fullscreen"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '92vw', maxHeight: '82vh',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          objectFit: 'contain',
          display: 'block',
        }}
      />
      <p style={{ color: '#555', fontSize: '12px', margin: 0 }}>Click outside or press Esc to close</p>
    </div>,
    document.body
  )
}

// ─── ImagePasteZone ─────────────────────────────────────────────────────────────
// Click-to-focus, then Ctrl+V / ⌘V to paste a screenshot. Click the thumbnail to
// view it fullscreen. `accentColor` lets each module match its own theme color.

export default function ImagePasteZone({ value, onChange, accentColor = '#575ECF' }) {
  const zoneRef = useRef(null)
  const [focused, setFocused] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const blob = item.getAsFile()
        const reader = new FileReader()
        reader.onload = (ev) => onChange(ev.target.result)
        reader.readAsDataURL(blob)
        break
      }
    }
  }, [onChange])

  if (value) {
    return (
      <>
        {lightbox && <ImageLightbox src={value} onClose={() => setLightbox(false)} />}
        <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
          <img
            src={value}
            alt="Source screenshot"
            onClick={() => setLightbox(true)}
            style={{
              maxWidth: '100%', maxHeight: '180px', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)', display: 'block',
              cursor: 'zoom-in',
            }}
          />
          {/* Expand button */}
          <button
            type="button"
            onClick={() => setLightbox(true)}
            title="View fullscreen"
            style={{
              position: 'absolute', top: '6px', left: '6px',
              background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none',
              borderRadius: '6px', padding: '3px 8px',
              fontSize: '12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            ⛶ View
          </button>
          {/* Remove button */}
          <button
            type="button"
            onClick={() => onChange(null)}
            title="Remove image"
            style={{
              position: 'absolute', top: '6px', right: '6px',
              background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none',
              borderRadius: '50%', width: '22px', height: '22px',
              fontSize: '13px', cursor: 'pointer', lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>
      </>
    )
  }

  return (
    <div
      ref={zoneRef}
      tabIndex={0}
      onPaste={handlePaste}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        border: `1px dashed ${focused ? accentColor : 'rgba(255,255,255,0.15)'}`,
        borderRadius: '8px',
        padding: '20px',
        textAlign: 'center',
        color: focused ? '#8a8680' : '#555',
        fontSize: '12px',
        cursor: 'pointer',
        backgroundColor: focused ? `${accentColor}0d` : 'rgba(255,255,255,0.02)',
        userSelect: 'none',
        outline: 'none',
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
    >
      <div style={{ fontSize: '20px', marginBottom: '6px', opacity: 0.4 }}>🖼</div>
      <div>{focused ? 'Now press Ctrl+V / ⌘V to paste' : 'Click here, then Ctrl+V / ⌘V to paste screenshot'}</div>
      <div style={{ marginTop: '3px', opacity: 0.6, fontSize: '11px' }}>Click the zone first to focus it</div>
    </div>
  )
}
