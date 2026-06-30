import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Select from 'react-select'
import toast from 'react-hot-toast'
import api from '../../utils/api'

function fmtDate(d) {
  if (!d) return ''
  try {
    const [y, m, day] = d.split('-')
    return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return d }
}

function isoDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return isoDate(d)
}

function today() { return isoDate(new Date()) }

// Last N days as array of date strings (newest first)
function lastNDays(n) {
  return Array.from({ length: n }, (_, i) => daysAgo(i))
}

const DATE_PRESETS = [
  { label: 'Last 7 days', from: () => daysAgo(6), to: () => today() },
  { label: 'Last 14 days', from: () => daysAgo(13), to: () => today() },
  { label: 'Last 30 days', from: () => daysAgo(29), to: () => today() },
  { label: 'This month', from: () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` }, to: () => today() },
  { label: 'All time', from: () => '', to: () => '' },
]

const selectStyles = {
  control: (base, state) => ({
    ...base, backgroundColor: '#2a2a2a',
    borderColor: state.isFocused ? '#575ECF' : 'rgba(255,255,255,0.12)',
    boxShadow: 'none', '&:hover': { borderColor: '#575ECF' },
    borderRadius: '8px', minHeight: '36px', fontSize: '13px',
  }),
  menu: (base) => ({ ...base, backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', zIndex: 100 }),
  option: (base, state) => ({ ...base, backgroundColor: state.isSelected ? '#575ECF' : state.isFocused ? '#333' : '#2a2a2a', color: '#c5c1b9', fontSize: '13px' }),
  singleValue: (base) => ({ ...base, color: '#c5c1b9' }),
  placeholder: (base) => ({ ...base, color: '#8a8680' }),
  input: (base) => ({ ...base, color: '#c5c1b9' }),
  indicatorSeparator: () => ({ display: 'none' }),
}

export default function FbAuditLog() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [adAccounts, setAdAccounts] = useState([])
  const [mediaBuyers, setMediaBuyers] = useState([])

  const [selectedAccount, setSelectedAccount] = useState(null)
  const [selectedBuyer, setSelectedBuyer] = useState(null)
  const [preset, setPreset] = useState('Last 7 days')
  const [dateFrom, setDateFrom] = useState(daysAgo(6))
  const [dateTo, setDateTo] = useState(today())

  const [selectedSession, setSelectedSession] = useState(null)
  const [viewMode, setViewMode] = useState('calendar') // 'calendar' | 'table'

  useEffect(() => {
    Promise.all([api.get('/facebook/ad-accounts'), api.get('/facebook/media-buyers')])
      .then(([a, b]) => {
        setAdAccounts(a.data.filter(x => x.active))
        setMediaBuyers(b.data.filter(x => x.active).map(x => ({ value: x.name, label: x.name })))
      })
  }, [])

  const fetchSessions = (acct, buyer, from, to) => {
    setLoading(true)
    const params = { limit: 200 }
    if (acct) params.ad_account = acct
    if (buyer) params.media_buyer = buyer
    if (from) params.date_from = from
    if (to) params.date_to = to
    api.get('/facebook/audit-sessions', { params })
      .then(({ data }) => setSessions(data.data))
      .catch(() => toast.error('Failed to load audit log'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchSessions(selectedAccount?.value, selectedBuyer?.value, dateFrom, dateTo)
  }, [])

  const handleApply = () => {
    fetchSessions(selectedAccount?.value, selectedBuyer?.value, dateFrom, dateTo)
  }

  const handlePreset = (p) => {
    setPreset(p.label)
    const from = p.from()
    const to = p.to()
    setDateFrom(from)
    setDateTo(to)
    fetchSessions(selectedAccount?.value, selectedBuyer?.value, from, to)
  }

  const handleAccountFilter = (acct) => {
    setSelectedAccount(acct)
    fetchSessions(acct?.value, selectedBuyer?.value, dateFrom, dateTo)
  }

  const handleBuyerFilter = (buyer) => {
    setSelectedBuyer(buyer)
    fetchSessions(selectedAccount?.value, buyer?.value, dateFrom, dateTo)
  }

  // Build a map: date → account → session
  const sessionMap = {}
  sessions.forEach(s => {
    if (!sessionMap[s.date]) sessionMap[s.date] = {}
    sessionMap[s.date][s.ad_account] = s
  })

  // Accounts to show (filter by selectedAccount if set)
  const accountsToShow = selectedAccount
    ? adAccounts.filter(a => a.name === selectedAccount.value)
    : adAccounts

  // Days in range (for calendar view) — today is always the first column
  const days = (() => {
    const todayD = today()
    const start = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date()
    // End is whichever is later: dateTo or today (so today always shows)
    const endDate = dateTo ? new Date(dateTo + 'T00:00:00') : new Date()
    const todayDate = new Date(todayD + 'T00:00:00')
    const end = endDate > todayDate ? endDate : todayDate
    const result = []
    const cur = new Date(end)
    while (cur >= start && result.length < 60) {
      result.push(isoDate(cur))
      cur.setDate(cur.getDate() - 1)
    }
    return result
  })()

  const todayStr = today()

  const dateInputStyle = {
    backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)',
    color: '#c5c1b9', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', outline: 'none',
  }

  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="mb-1">
              <Link to="/facebook" className="text-[#8a8680] hover:text-[#c5c1b9] transition-colors text-sm">← Facebook & Meta Ads</Link>
            </div>
            <h1 className="text-2xl font-bold text-[#c5c1b9]">Daily Audit Log</h1>
            <p className="text-[#8a8680] text-sm mt-0.5">Track completed daily audits — red cells = missing audit for that day</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode(v => v === 'calendar' ? 'table' : 'calendar')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#8a8680', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#575ECF'; e.currentTarget.style.color = '#c5c1b9' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#8a8680' }}
            >
              {viewMode === 'calendar'
                ? <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>Table View</>
                : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>Calendar View</>
              }
            </button>
            <Link to="/facebook/trash"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#8a8680', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#c5c1b9'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#8a8680'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
            >🗑 Trash</Link>
            <Link to="/facebook/start"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: '#575ECF' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#6B72D8'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#575ECF'}
            >+ New Audit</Link>
          </div>
        </div>

        {/* Filters row */}
        <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <label className="block text-xs text-[#8a8680] mb-1">Ad Account</label>
              <Select options={[{ value: '', label: 'All Accounts' }, ...adAccounts.map(a => ({ value: a.name, label: a.name }))]}
                value={selectedAccount} onChange={handleAccountFilter}
                placeholder="All…" styles={selectStyles} isClearable />
            </div>
            <div className="w-44">
              <label className="block text-xs text-[#8a8680] mb-1">Media Buyer</label>
              <Select options={mediaBuyers} value={selectedBuyer} onChange={handleBuyerFilter}
                placeholder="All…" styles={selectStyles} isClearable />
            </div>
            <div>
              <label className="block text-xs text-[#8a8680] mb-1">Date From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                style={dateInputStyle}
                onFocus={e => e.target.style.borderColor = '#575ECF'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
            </div>
            <div>
              <label className="block text-xs text-[#8a8680] mb-1">Date To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                style={dateInputStyle}
                onFocus={e => e.target.style.borderColor = '#575ECF'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
            </div>
            <button onClick={handleApply}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: '#575ECF' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#6B72D8'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#575ECF'}
            >Apply</button>

            {/* Quick presets */}
            <div className="flex gap-1.5 ml-auto flex-wrap">
              {DATE_PRESETS.map(p => (
                <button key={p.label} onClick={() => handlePreset(p)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    backgroundColor: preset === p.label ? 'rgba(87,94,207,0.2)' : 'rgba(255,255,255,0.04)',
                    color: preset === p.label ? '#575ECF' : '#8a8680',
                    border: `1px solid ${preset === p.label ? 'rgba(87,94,207,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >{p.label}</button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: '#575ECF' }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : accountsToShow.length === 0 ? (
          <div className="text-center py-16" style={{ color: '#8a8680' }}>
            <p className="text-sm">No ad accounts found. <Link to="/facebook/admin" className="underline" style={{ color: '#575ECF' }}>Add accounts in Admin</Link></p>
          </div>
        ) : viewMode === 'calendar' ? (
          <CalendarView
            accounts={accountsToShow}
            days={days}
            sessionMap={sessionMap}
            todayStr={todayStr}
            onViewSession={setSelectedSession}
          />
        ) : (
          <TableView
            sessions={sessions}
            onViewSession={setSelectedSession}
          />
        )}
      </div>

      {/* Session detail modal */}
      {selectedSession && (
        <SessionModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onDelete={(id) => setSessions(prev => prev.filter(s => s.id !== id))}
        />
      )}
    </div>
  )
}

// ── Calendar / matrix view ────────────────────────────────────────────────────

function CalendarView({ accounts, days, sessionMap, todayStr, onViewSession }) {

  return (
    <>
      {/* Matrix table */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead style={{ backgroundColor: '#1b1b1b', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide sticky left-0 z-10" style={{ color: '#8a8680', backgroundColor: '#1b1b1b', minWidth: '160px' }}>
                  Ad Account
                </th>
                {days.map(d => (
                  <th key={d} className="px-2 py-3 text-center text-xs font-medium whitespace-nowrap" style={{ color: d === todayStr ? '#575ECF' : '#8a8680', minWidth: '80px' }}>
                    <div>{new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    {d === todayStr && <div className="text-xs" style={{ color: '#575ECF', fontSize: '10px' }}>Today</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((acct, ai) => (
                <tr key={acct.id} style={{ backgroundColor: ai % 2 === 0 ? '#242424' : '#2a2a2a', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="px-4 py-3 font-medium sticky left-0 z-10 text-sm" style={{ color: '#c5c1b9', backgroundColor: ai % 2 === 0 ? '#242424' : '#2a2a2a' }}>
                    {acct.name}
                  </td>
                  {days.map(d => {
                    const session = sessionMap[d]?.[acct.name]
                    const isFuture = d > todayStr
                    if (isFuture) {
                      return (
                        <td key={d} className="px-2 py-2 text-center">
                          <div className="w-8 h-8 mx-auto rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                            <span className="text-xs" style={{ color: '#333' }}>–</span>
                          </div>
                        </td>
                      )
                    }
                    if (session) {
                      return (
                        <td key={d} className="px-2 py-2 text-center">
                          <button onClick={() => onViewSession(session)}
                            className="w-8 h-8 mx-auto rounded-lg flex items-center justify-center transition-all group relative"
                            style={{ backgroundColor: session.issue_count > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.15)' }}
                            title={session.issue_count > 0 ? `${session.issue_count} issue(s) — click to view` : 'All clear — click to view'}
                            onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                          >
                            {session.issue_count > 0
                              ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                              : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            }
                          </button>
                        </td>
                      )
                    }
                    return (
                      <td key={d} className="px-2 py-2 text-center">
                        <Link to="/facebook/start"
                          className="w-8 h-8 mx-auto rounded-lg flex items-center justify-center transition-all"
                          style={{ backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}
                          title={`Missing audit for ${fmtDate(d)} — click to log`}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.25)'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.15)'}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </Link>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', backgroundColor: '#1b1b1b' }}>
          <LegendItem color="rgba(34,197,94,0.15)" icon="✓" label="All clear" />
          <LegendItem color="rgba(245,158,11,0.2)" icon="⚠" label="Issues flagged" />
          <LegendItem color="rgba(239,68,68,0.15)" icon="✕" label="Missing audit" />
          <LegendItem color="rgba(255,255,255,0.02)" icon="–" label="Future date" />
        </div>
      </div>
    </>
  )
}

function LegendItem({ color, icon, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-5 h-5 rounded flex items-center justify-center text-xs" style={{ backgroundColor: color }}>{icon}</div>
      <span className="text-xs" style={{ color: '#8a8680' }}>{label}</span>
    </div>
  )
}

// ── Table view ────────────────────────────────────────────────────────────────

function TableView({ sessions, onViewSession }) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl text-center py-16" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-sm" style={{ color: '#8a8680' }}>No audit sessions found for the selected filters.</p>
      </div>
    )
  }
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: '#1b1b1b', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <tr>
              {['Date', 'Ad Account', 'Media Buyer', 'Status', 'Issues', 'Actions'].map(col => (
                <th key={col} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#8a8680' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => (
              <tr key={s.id} style={{ backgroundColor: i % 2 === 0 ? '#242424' : '#2a2a2a', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td className="px-4 py-3 whitespace-nowrap text-sm" style={{ color: '#c5c1b9' }}>{fmtDate(s.date)}</td>
                <td className="px-4 py-3 font-medium text-sm" style={{ color: '#c5c1b9' }}>{s.ad_account}</td>
                <td className="px-4 py-3 text-sm" style={{ color: '#8a8680' }}>{s.media_buyer || '—'}</td>
                <td className="px-4 py-3">
                  {s.issue_count > 0
                    ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>⚠ {s.issue_count} issue{s.issue_count > 1 ? 's' : ''}</span>
                    : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>✓ All clear</span>
                  }
                </td>
                <td className="px-4 py-3 text-sm max-w-xs">
                  {s.issue_count > 0 ? (
                    <span className="text-xs" style={{ color: '#8a8680' }}>
                      {s.answers.filter(a => a.hasIssue).map(a => a.question.split(' ').slice(0, 4).join(' ') + '…').join('; ')}
                    </span>
                  ) : <span style={{ color: '#555' }}>—</span>}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => onViewSession(s)} className="text-xs font-medium hover:underline" style={{ color: '#575ECF' }}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Session detail modal ──────────────────────────────────────────────────────

function SessionModal({ session, onClose, onDelete }) {
  const perf = session.performance_data ? (typeof session.performance_data === 'string' ? JSON.parse(session.performance_data) : session.performance_data) : null
  const flagged = session.flagged_ads ? (typeof session.flagged_ads === 'string' ? JSON.parse(session.flagged_ads) : session.flagged_ads) : []
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!window.confirm('Move this audit to trash? You can restore it within 7 days.')) return
    setDeleting(true)
    try {
      await api.delete(`/facebook/audit-sessions/${session.id}`)
      toast.success('Audit moved to trash')
      onDelete(session.id)
      onClose()
    } catch { toast.error('Failed to delete'); setDeleting(false) }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
      <div className="rounded-2xl w-full max-w-xl max-h-[88vh] overflow-hidden flex flex-col" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h3 className="text-lg font-bold text-[#c5c1b9]">Audit Details</h3>
            <p className="text-sm text-[#8a8680]">{session.ad_account} · {fmtDate(session.date)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ color: '#8a8680' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#c5c1b9' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#8a8680' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-3 gap-3">
            {[['Media Buyer', session.media_buyer || '—'], ['Date', fmtDate(session.date)], ['Status', session.issue_count > 0 ? `${session.issue_count} issue(s)` : 'All clear']].map(([label, val]) => (
              <div key={label} className="rounded-lg p-3" style={{ backgroundColor: '#2a2a2a' }}>
                <div className="text-xs mb-1" style={{ color: '#8a8680' }}>{label}</div>
                <div className="text-sm font-medium" style={{ color: '#c5c1b9' }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Checklist answers */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8a8680' }}>Checklist</p>
            <div className="space-y-2">
              {session.answers.map((a, i) => (
                <div key={i} className="rounded-lg p-4" style={{ backgroundColor: '#2a2a2a', border: `1px solid ${a.hasIssue ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.15)'}` }}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium" style={{ color: '#c5c1b9' }}>{a.question}</p>
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                      style={a.hasIssue ? { backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' } : { backgroundColor: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                      {a.answer?.toUpperCase()}
                    </span>
                  </div>
                  {a.note && <p className="text-xs whitespace-pre-wrap mt-1" style={{ color: '#8a8680' }}>{a.note}</p>}
                  {a.image && <img src={a.image} alt="Screenshot" className="mt-2 max-h-48 rounded-lg border border-white/10 object-contain" />}
                </div>
              ))}
            </div>
          </div>

          {/* Performance data */}
          {perf && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8a8680' }}>📊 Performance</p>
              {perf.type === 'multi' && perf.campaigns ? (
                <div className="space-y-3">
                  {perf.campaigns.map((c, i) => (
                    <div key={i} className="rounded-lg p-3" style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-sm font-semibold" style={{ color: '#c5c1b9' }}>{c.name}</p>
                        {c.target_cpl != null && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: '#8a8680' }}>Target: {c.target_cpl}</span>}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[['7 Days', c.days7], ['3 Days', c.days3]].map(([label, d]) => d && (
                          <div key={label} className="rounded p-2" style={{ background: '#1b1b1b' }}>
                            <p className="text-xs mb-1" style={{ color: '#8a8680' }}>Last {label}</p>
                            {d.from && <p className="text-xs mb-1" style={{ color: '#444' }}>{d.from} → {d.to}</p>}
                            <div className="flex gap-3">
                              <div><div className="text-xs" style={{ color: '#8a8680' }}>Leads</div><div className="text-sm font-semibold" style={{ color: '#c5c1b9' }}>{d.leads || '—'}</div></div>
                              <div><div className="text-xs" style={{ color: '#8a8680' }}>CPL</div><div className="text-sm font-semibold" style={{ color: d.cpl ? '#22c55e' : '#555' }}>{d.cpl ? `$${d.cpl}` : '—'}</div></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {[['Last 7 Days', perf.days7], ['Last 3 Days', perf.days3]].map(([label, d]) => d && (
                    <div key={label} className="rounded-lg p-3" style={{ backgroundColor: '#2a2a2a' }}>
                      <p className="text-xs font-semibold mb-2" style={{ color: '#c5c1b9' }}>{label}</p>
                      {d.from && <p className="text-xs mb-2" style={{ color: '#555' }}>{d.from} → {d.to}</p>}
                      <div className="flex gap-4">
                        <div><div className="text-xs" style={{ color: '#8a8680' }}>Leads</div><div className="text-sm font-semibold" style={{ color: '#c5c1b9' }}>{d.leads || '—'}</div></div>
                        <div><div className="text-xs" style={{ color: '#8a8680' }}>CPL</div><div className="text-sm font-semibold" style={{ color: '#c5c1b9' }}>{d.cpl ? `$${d.cpl}` : '—'}</div></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Flagged ads */}
          {flagged && flagged.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8a8680' }}>⚠ Flagged Ads ({flagged.length})</p>
              <div className="space-y-2">
                {flagged.map((ad, i) => (
                  <div key={i} className="rounded-lg p-3" style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <p className="text-sm font-medium" style={{ color: '#c5c1b9' }}>{ad.ad_name || '—'}</p>
                    {ad.campaign_name && <p className="text-xs mt-0.5" style={{ color: '#8a8680' }}>Campaign: {ad.campaign_name}</p>}
                    {ad.action_taken && <p className="text-xs mt-1" style={{ color: '#f59e0b' }}>Action: {ad.action_taken}</p>}
                    {ad.notes && <p className="text-xs mt-1" style={{ color: '#555' }}>{ad.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#1b1b1b' }}>
          <button onClick={handleDelete} disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.2)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'}
          >🗑 Delete</button>
          <button onClick={onClose}
            className="flex-1 py-2 px-4 rounded-lg text-sm font-medium text-[#c5c1b9]"
            style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#575ECF'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
          >Close</button>
        </div>
      </div>
    </div>
  )
}
