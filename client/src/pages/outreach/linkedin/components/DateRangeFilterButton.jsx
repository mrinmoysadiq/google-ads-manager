import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { fmtDate } from '../../../../utils/dates'

const DATE_TYPES = [
  { value: 'created', label: 'Created Date' },
  { value: 'activity', label: 'Activity Date' },
]

// Filters the pipeline to leads whose created date or last-activity date
// (status_updated_at — the last time their stage moved) falls in a range.
// The popover renders through a portal so it isn't clipped inside scroll
// containers, matching ConnectionStatusBadge's approach.
export default function DateRangeFilterButton({ dateType, dateFrom, dateTo, onApply }) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState(null)
  const [draftType, setDraftType] = useState(dateType || 'created')
  const [draftFrom, setDraftFrom] = useState(dateFrom || '')
  const [draftTo, setDraftTo] = useState(dateTo || '')
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  const isActive = !!(dateFrom || dateTo)

  const openMenu = () => {
    setDraftType(dateType || 'created')
    setDraftFrom(dateFrom || '')
    setDraftTo(dateTo || '')
    const rect = btnRef.current.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 8, left: rect.left })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (btnRef.current?.contains(e.target)) return
      if (menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    function handleReposition() { setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
    }
  }, [open])

  const label = () => {
    if (!isActive) return 'Date Range'
    const typeLabel = dateType === 'activity' ? 'Activity' : 'Created'
    if (dateFrom && dateTo) return `${typeLabel}: ${fmtDate(dateFrom)} – ${fmtDate(dateTo)}`
    if (dateFrom) return `${typeLabel}: from ${fmtDate(dateFrom)}`
    return `${typeLabel}: until ${fmtDate(dateTo)}`
  }

  const handleApply = () => {
    onApply({ date_type: draftType, date_from: draftFrom, date_to: draftTo })
    setOpen(false)
  }

  const handleClear = () => {
    onApply({ date_type: draftType, date_from: '', date_to: '' })
    setOpen(false)
  }

  const fieldLabel = { display: 'block', fontSize: 11, color: '#8a8680', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 600 }
  const dateInput = { width: '100%', boxSizing: 'border-box', backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#c5c1b9', padding: '7px 10px', fontSize: 13 }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={btnRef}
        onClick={() => (open ? setOpen(false) : openMenu())}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10,
          border: `1px solid ${isActive ? 'rgba(10,102,194,0.5)' : 'rgba(255,255,255,0.1)'}`,
          backgroundColor: isActive ? 'rgba(10,102,194,0.15)' : '#242424',
          color: isActive ? '#0a66c2' : '#8a8680', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
        }}
        title="Filter leads by created or activity date"
      >
        📅 {label()}
        {isActive && (
          <span
            onClick={e => { e.stopPropagation(); handleClear() }}
            style={{ marginLeft: 2, background: 'rgba(255,255,255,0.12)', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}
            title="Clear date filter"
          >✕</span>
        )}
      </button>

      {open && menuPos && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999,
            backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
            padding: 16, width: 280, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <label style={fieldLabel}>Filter by</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {DATE_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setDraftType(t.value)}
                  style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12,
                    border: '1px solid', borderColor: draftType === t.value ? '#0a66c2' : 'rgba(255,255,255,0.12)',
                    backgroundColor: draftType === t.value ? 'rgba(10,102,194,0.15)' : 'transparent',
                    color: draftType === t.value ? '#0a66c2' : '#8a8680',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={fieldLabel}>From</label>
              <input type="date" value={draftFrom} onChange={e => setDraftFrom(e.target.value)} style={dateInput} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={fieldLabel}>To</label>
              <input type="date" value={draftTo} onChange={e => setDraftTo(e.target.value)} style={dateInput} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <button onClick={handleClear} style={{ background: 'none', border: 'none', color: '#8a8680', fontSize: 12, cursor: 'pointer', fontWeight: 600, padding: 0 }}>
              Clear
            </button>
            <button onClick={handleApply} style={{ backgroundColor: '#0a66c2', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Apply
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
