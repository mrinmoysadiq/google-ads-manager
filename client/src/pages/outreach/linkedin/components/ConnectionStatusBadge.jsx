import { useState, useEffect, useRef } from 'react'

export const CONNECTION_STATUSES = ['Not Connected', 'Request Sent', 'Connected']

export const CONNECTION_STATUS_COLORS = {
  'Not Connected': { bg: 'rgba(138,134,128,0.15)', color: '#8a8680', dot: '#8a8680' },
  'Request Sent':  { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b', dot: '#f59e0b' },
  'Connected':     { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e', dot: '#22c55e' },
}

// Compact quick-toggle control — click to open a 3-option menu.
// Stops propagation so it's safe to drop onto a clickable Kanban card / table row.
export default function ConnectionStatusBadge({ status, onChange, size = 'md' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const c = CONNECTION_STATUS_COLORS[status] || CONNECTION_STATUS_COLORS['Not Connected']
  const isSmall = size === 'sm'

  useEffect(() => {
    if (!open) return
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          backgroundColor: c.bg, color: c.color, border: `1px solid ${c.color}33`,
          borderRadius: '20px', padding: isSmall ? '2px 8px' : '3px 10px',
          fontSize: isSmall ? '11px' : '12px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: c.dot, flexShrink: 0 }} />
        {status || 'Not Connected'}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200,
          backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
          padding: '4px', minWidth: '150px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {CONNECTION_STATUSES.map(s => {
            const sc = CONNECTION_STATUS_COLORS[s]
            const isActive = s === status
            return (
              <button
                key={s}
                onClick={() => { onChange(s); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                  padding: '6px 10px', borderRadius: '6px', border: 'none',
                  backgroundColor: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                  color: sc.color, fontSize: '13px', cursor: 'pointer', fontWeight: isActive ? 600 : 400,
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: sc.dot, flexShrink: 0 }} />
                {s}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
