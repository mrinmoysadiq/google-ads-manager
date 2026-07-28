import { useState, useRef, useEffect } from 'react'
import Select from 'react-select'
import ConnectionStatusBadge from './ConnectionStatusBadge'

const STATUS_COLORS = {
  'Identified':                { bg: 'rgba(138,134,128,0.15)', color: '#8a8680' },
  'Connection Request Sent':   { bg: 'rgba(10,102,194,0.15)',  color: '#0a66c2' },
  'Connected':                 { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6' },
  'Engaging (Warming Up)':     { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
  'Ready to Message':          { bg: 'rgba(168,85,247,0.15)',  color: '#a855f7' },
  'Follow-up 1':                { bg: 'rgba(20,184,166,0.15)',  color: '#14b8a6' },
  'Follow-up 2':                { bg: 'rgba(20,184,166,0.15)',  color: '#14b8a6' },
  'Follow-up 3':                { bg: 'rgba(20,184,166,0.15)',  color: '#14b8a6' },
  'Follow-up 4':                { bg: 'rgba(20,184,166,0.15)',  color: '#14b8a6' },
  'Replied':                   { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e' },
  'Meeting Booked':            { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
  'Started Trial':             { bg: 'rgba(6,182,212,0.15)',   color: '#06b6d4' },
  'Closed / Booked as Client': { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e' },
  'No Response / Dead':        { bg: 'rgba(55,65,81,0.2)',     color: '#6b7280' },
  'Disqualified':              { bg: 'rgba(55,65,81,0.2)',     color: '#6b7280' },
}

const DEFAULT_STATUS_COLOR = { bg: 'rgba(138,134,128,0.15)', color: '#8a8680' }
function getStatusColor(status) { return STATUS_COLORS[status] || DEFAULT_STATUS_COLOR }

const selectStyles = {
  control: (base, state) => ({ ...base, background: '#2a2a2a', borderColor: state.isFocused ? '#0a66c2' : 'rgba(255,255,255,0.08)', boxShadow: 'none', minHeight: 36, fontSize: 13, '&:hover': { borderColor: 'rgba(255,255,255,0.2)' } }),
  menu: (base) => ({ ...base, background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.08)', zIndex: 50 }),
  option: (base, state) => ({ ...base, background: state.isSelected ? '#0a66c2' : state.isFocused ? 'rgba(255,255,255,0.05)' : 'transparent', color: state.isSelected ? '#fff' : '#c5c1b9', fontSize: 13, cursor: 'pointer' }),
  multiValue: (base) => ({ ...base, background: 'rgba(10,102,194,0.2)', borderRadius: 4 }),
  multiValueLabel: (base) => ({ ...base, color: '#c5c1b9', fontSize: 12 }),
  multiValueRemove: (base) => ({ ...base, color: '#8a8680', ':hover': { background: 'rgba(255,255,255,0.1)', color: '#fff' } }),
  singleValue: (base) => ({ ...base, color: '#c5c1b9' }),
  placeholder: (base) => ({ ...base, color: '#8a8680', fontSize: 13 }),
  input: (base) => ({ ...base, color: '#c5c1b9' }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base) => ({ ...base, color: '#8a8680', padding: '0 6px' }),
  clearIndicator: (base) => ({ ...base, color: '#8a8680', padding: '0 4px' }),
}

function StatusDropdown({ currentStatus, leadId, stageNames, onStatusChange, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    function handleClickOutside(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div ref={ref} style={{ position: 'absolute', top: '100%', left: 0, zIndex: 999, background: '#242424', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: 4, minWidth: 220, maxHeight: 320, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
      {stageNames.map(s => {
        const { color } = getStatusColor(s)
        const isActive = s === currentStatus
        return (
          <div key={s} onClick={() => { onStatusChange(leadId, s); onClose() }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 5, cursor: 'pointer', background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent' }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: isActive ? '#fff' : '#c5c1b9' }}>{s}</span>
            {isActive && <span style={{ marginLeft: 'auto', fontSize: 11, color }}>✓</span>}
          </div>
        )
      })}
    </div>
  )
}

export default function LinkedInTable({
  leads, loading, pagination, filters, onFiltersChange, onPageChange,
  onLeadClick, onStatusChange, onConnectionStatusChange, onToggleHotLead, onViewLog, stages, showSpecialistColumn,
}) {
  const [openStatusFor, setOpenStatusFor] = useState(null)

  // Stage list must always come from the DB-driven `stages` prop — never a
  // hardcoded fallback, or a stale/renamed/deleted stage would show up here.
  const stageNames = (stages || []).map(s => s.name)
  const statusOptions = stageNames.map(s => ({ value: s, label: s }))

  const selectedStatuses = (filters.status || '').split(',').filter(Boolean)
  const selectedStatusOptions = statusOptions.filter(o => selectedStatuses.includes(o.value))

  const thStyle = { textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#8a8680', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }
  const tdStyle = { padding: '10px 12px', fontSize: 13, color: '#c5c1b9', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' }

  const hasActiveFilters = filters.status || filters.search

  const clearFilters = () => onFiltersChange({ ...filters, status: '', search: '' })

  return (
    <div>
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div style={{ minWidth: 220 }}>
          <Select
            isMulti
            styles={selectStyles}
            options={statusOptions}
            value={selectedStatusOptions}
            onChange={opts => onFiltersChange({ ...filters, status: opts.map(o => o.value).join(',') })}
            placeholder="Filter by stage…"
            closeMenuOnSelect={false}
          />
        </div>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: '#8a8680', backgroundColor: 'transparent' }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: '#1f1f1f' }}>
              <tr>
                <th style={thStyle}>Lead</th>
                <th style={thStyle}>Company</th>
                <th style={thStyle}>Connection</th>
                <th style={thStyle}>Stage</th>
                <th style={thStyle}>Engagement Log</th>
                {showSpecialistColumn && <th style={thStyle}>Specialist</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={showSpecialistColumn ? 6 : 5} style={{ ...tdStyle, textAlign: 'center', color: '#555' }}>Loading…</td></tr>
                ))
              ) : leads.length === 0 ? (
                <tr><td colSpan={showSpecialistColumn ? 6 : 5} style={{ ...tdStyle, textAlign: 'center', color: '#555', padding: '32px 12px' }}>No leads found</td></tr>
              ) : (
                leads.map(lead => {
                  const sc = getStatusColor(lead.status)
                  return (
                    <tr key={lead.id} style={{ cursor: 'pointer' }} onClick={() => onLeadClick(lead.id)}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <button
                            onClick={e => { e.stopPropagation(); onToggleHotLead(lead.id, !lead.is_hot_lead) }}
                            title={lead.is_hot_lead ? 'Unmark as hot lead' : 'Mark as hot lead'}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0, flexShrink: 0, filter: lead.is_hot_lead ? 'none' : 'grayscale(1)', opacity: lead.is_hot_lead ? 1 : 0.3 }}
                          >🔥</button>
                          <span style={{ fontWeight: 600, color: '#fff' }}>{lead.lead_name}</span>
                          {lead.unread_comment_count > 0 && (
                            <span
                              title={`${lead.unread_comment_count} unread comment${lead.unread_comment_count !== 1 ? 's' : ''}`}
                              style={{ backgroundColor: '#f59e0b', color: '#1b1b1b', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '2px 6px', flexShrink: 0 }}
                            >
                              💬 {lead.unread_comment_count}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={tdStyle}>{[lead.job_title, lead.company_name].filter(Boolean).join(' @ ') || '—'}</td>
                      <td style={tdStyle}>
                        <ConnectionStatusBadge status={lead.connection_status} onChange={s => onConnectionStatusChange(lead.id, s)} size="sm" />
                      </td>
                      <td style={{ ...tdStyle, position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setOpenStatusFor(openStatusFor === lead.id ? null : lead.id)}
                          style={{ backgroundColor: sc.bg, color: sc.color, border: 'none', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {lead.status} ▾
                        </button>
                        {openStatusFor === lead.id && (
                          <StatusDropdown currentStatus={lead.status} leadId={lead.id} stageNames={stageNames} onStatusChange={onStatusChange} onClose={() => setOpenStatusFor(null)} />
                        )}
                      </td>
                      <td style={tdStyle} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => onViewLog(lead.id, lead.lead_name)}
                          className="flex items-center gap-1.5 text-xs font-medium"
                          style={{ padding: '5px 12px', borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.04)', color: '#8a8680', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#0a66c2'; e.currentTarget.style.borderColor = 'rgba(10,102,194,0.3)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#8a8680'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                          title="View engagement history"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                          </svg>
                          View Log
                        </button>
                      </td>
                      {showSpecialistColumn && <td style={tdStyle}>{lead.specialist_name || '—'}</td>}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span style={{ color: '#8a8680', fontSize: 12 }}>
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} lead{pagination.total !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-30"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#c5c1b9', border: '1px solid rgba(255,255,255,0.08)' }}
            >Prev</button>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-30"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#c5c1b9', border: '1px solid rgba(255,255,255,0.08)' }}
            >Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
