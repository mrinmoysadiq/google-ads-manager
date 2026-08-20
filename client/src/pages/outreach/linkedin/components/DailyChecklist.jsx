import { useState } from 'react'
import { fmtDateLong } from '../../../../utils/dates'

const LS_COLLAPSED_KEY = 'linkedin_checklist_collapsed'

const CHECKLIST_ITEMS = [
  { key: 'identified',  label: 'Identified',  target: 10 },
  { key: 'messaged',    label: 'Messaged',     target: 10 },
  { key: 'follow_up_1', label: 'Follow-up 1',  target: 10 },
  { key: 'follow_up_2', label: 'Follow-up 2',  target: 10 },
  { key: 'follow_up_3', label: 'Follow-up 3',  target: 10 },
  { key: 'follow_up_4', label: 'Follow-up 4',  target: 10 },
  { key: 'emailed',     label: 'Emailed',      target: 5 },
]

function scoreColor(pct) {
  if (pct >= 70) return '#22c55e'
  if (pct >= 40) return '#f59e0b'
  return '#ef4444'
}

function computeScore(row) {
  const met = CHECKLIST_ITEMS.filter(item => (row[item.key] || 0) >= item.target).length
  return Math.round((met / CHECKLIST_ITEMS.length) * 100)
}

const thStyle = { textAlign: 'center', padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#8a8680', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '10px', color: '#c5c1b9', whiteSpace: 'nowrap' }

export default function DailyChecklist({ date, rows, loading }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(LS_COLLAPSED_KEY) === '1')

  const toggle = () => {
    setCollapsed(v => {
      const next = !v
      localStorage.setItem(LS_COLLAPSED_KEY, next ? '1' : '0')
      return next
    })
  }

  return (
    <div className="rounded-xl" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 16, overflow: 'hidden' }}>
      <button
        onClick={toggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#c5c1b9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📋 Daily Checklist
          </span>
          {date && <span style={{ fontSize: 12, color: '#8a8680' }}>{fmtDateLong(date)}</span>}
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a8680" strokeWidth={2} style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!collapsed && (
        <div style={{ padding: '0 16px 16px', overflowX: 'auto' }}>
          {loading ? (
            <p style={{ color: '#8a8680', fontSize: 13, padding: '12px 0' }}>Loading…</p>
          ) : rows.length === 0 ? (
            <p style={{ color: '#8a8680', fontSize: 13, padding: '12px 0' }}>No specialists to show.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Specialist</th>
                  {CHECKLIST_ITEMS.map(item => (
                    <th key={item.key} style={thStyle}>
                      {item.label}
                      <div style={{ color: '#555', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>target {item.target}</div>
                    </th>
                  ))}
                  <th style={{ ...thStyle, textAlign: 'right', minWidth: 130 }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const score = computeScore(row)
                  const color = scoreColor(score)
                  return (
                    <tr key={row.specialist_id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: '#c5c1b9' }}>{row.specialist_name}</td>
                      {CHECKLIST_ITEMS.map(item => {
                        const val = row[item.key] || 0
                        const met = val >= item.target
                        return (
                          <td key={item.key} style={{ ...tdStyle, textAlign: 'center', color: met ? '#22c55e' : '#8a8680', fontWeight: met ? 700 : 400 }}>
                            {met ? '✓ ' : ''}{val}
                          </td>
                        )
                      })}
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <div style={{ width: 70, height: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', flexShrink: 0 }}>
                            <div style={{ width: `${score}%`, height: '100%', backgroundColor: color, transition: 'width 0.4s ease' }} />
                          </div>
                          <span style={{ color, fontWeight: 700, fontSize: 12, minWidth: 34 }}>{score}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
