import { useState, useEffect } from 'react'
import Select from 'react-select'
import toast from 'react-hot-toast'
import { getChangeLogs, exportChangeLogs, getAccounts, getTeamMembers } from '../utils/api'

const CHANGE_TYPE_OPTIONS = [
  { value: 'performance_note', label: 'Performance Note' },
  { value: 'keyword_paused', label: 'Keyword Paused' },
  { value: 'keyword_added', label: 'Keyword Added' },
  { value: 'ad_copy_change', label: 'Ad Copy Change' },
  { value: 'audience_targeting_change', label: 'Audience/Targeting Change' },
]

const SECTION_OPTIONS = [
  { value: '', label: 'All Sections' },
  { value: 'Spend & Conversions', label: 'Spend & Conversions' },
  { value: 'Keyword Analysis', label: 'Keyword Analysis' },
  { value: 'Ad Copy Review', label: 'Ad Copy Review' },
  { value: 'Audience & Targeting', label: 'Audience & Targeting' },
]

const CHANGE_TYPE_LABELS = {
  performance_note: 'Performance Note',
  keyword_paused: 'Keyword Paused',
  keyword_added: 'Keyword Added',
  ad_copy_change: 'Ad Copy Change',
  audience_targeting_change: 'Audience/Targeting',
}

const CHANGE_TYPE_COLORS = {
  performance_note: { backgroundColor: 'rgba(87,94,207,0.15)', color: '#575ECF' },
  keyword_paused: { backgroundColor: 'rgba(251,191,36,0.15)', color: '#fbbf24' },
  keyword_added: { backgroundColor: 'rgba(74,222,128,0.15)', color: '#4ade80' },
  ad_copy_change: { backgroundColor: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
  audience_targeting_change: { backgroundColor: 'rgba(248,113,113,0.15)', color: '#f87171' },
}

const DETAIL_FIELD_LABELS = {
  team_member: 'Team Member',
  account_name: 'Account',
  date: 'Date',
  section: 'Section',
  change_type: 'Change Type',
  changes_made_note: 'Changes Made',
  keywords_paused: 'Keywords Paused',
  pause_reason: 'Pause Reason',
  keywords_added: 'Keywords Added',
  add_match_type: 'Match Type',
  add_reason: 'Reason for Adding',
  ads_paused: 'Ads Paused',
  ads_created: 'Ads Created',
  ad_change_reason: 'Ad Change Reason',
  audiences_adjusted: 'Audiences Adjusted',
  bid_changes: 'Bid Changes',
  other_targeting: 'Other Targeting Changes',
  targeting_reason: 'Targeting Reason',
  created_at: 'Logged At',
}

export default function ChangeLog() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [accounts, setAccounts] = useState([])
  const [teamMembers, setTeamMembers] = useState([])

  // Filters
  const [filters, setFilters] = useState({
    account: null,
    team_member: null,
    date_from: '',
    date_to: '',
    change_type: [],
    section: null,
  })
  const [appliedFilters, setAppliedFilters] = useState({})

  // Modal
  const [selectedEntry, setSelectedEntry] = useState(null)

  useEffect(() => {
    Promise.all([getAccounts(), getTeamMembers()])
      .then(([accts, members]) => {
        setAccounts(accts.map(a => ({ value: a.name, label: a.name })))
        setTeamMembers(members.map(m => ({ value: m.name, label: m.name })))
      })
      .catch(err => console.error(err))
  }, [])

  const buildQueryFilters = (f, pg = 1) => {
    const q = { page: pg, limit: 25 }
    if (f.account) q.account = f.account
    if (f.team_member) q.team_member = f.team_member
    if (f.date_from) q.date_from = f.date_from
    if (f.date_to) q.date_to = f.date_to
    if (f.change_type && f.change_type.length > 0) q.change_type = f.change_type
    if (f.section) q.section = f.section
    return q
  }

  const fetchLogs = (f = appliedFilters, pg = 1) => {
    setLoading(true)
    const query = buildQueryFilters(f, pg)
    getChangeLogs(query)
      .then(data => {
        setLogs(data.data)
        setTotal(data.total)
        setPage(data.page)
        setTotalPages(data.totalPages)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        toast.error('Failed to load change log')
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchLogs({}, 1)
  }, [])

  const handleApplyFilters = () => {
    const f = {
      account: filters.account?.value || '',
      team_member: filters.team_member?.value || '',
      date_from: filters.date_from,
      date_to: filters.date_to,
      change_type: filters.change_type.map(t => t.value).join(','),
      section: filters.section?.value || '',
    }
    setAppliedFilters(f)
    fetchLogs(f, 1)
  }

  const handleReset = () => {
    setFilters({
      account: null,
      team_member: null,
      date_from: '',
      date_to: '',
      change_type: [],
      section: null,
    })
    setAppliedFilters({})
    fetchLogs({}, 1)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const f = {
        account: filters.account?.value || '',
        team_member: filters.team_member?.value || '',
        date_from: filters.date_from,
        date_to: filters.date_to,
        change_type: filters.change_type.map(t => t.value).join(','),
        section: filters.section?.value || '',
      }
      const blob = await exportChangeLogs(f)
      const url = window.URL.createObjectURL(new Blob([blob]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'change-log-export.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('CSV exported!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to export CSV')
    } finally {
      setExporting(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    try {
      const [year, month, day] = dateStr.split('-')
      return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch { return dateStr }
  }

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: '#2a2a2a',
      borderColor: state.isFocused ? '#575ECF' : 'rgba(255,255,255,0.12)',
      boxShadow: state.isFocused ? '0 0 0 1px #575ECF' : 'none',
      '&:hover': { borderColor: '#575ECF' },
      borderRadius: '8px',
      minHeight: '38px',
      fontSize: '13px',
      color: '#c5c1b9',
    }),
    menu: (base) => ({ ...base, backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)' }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected ? '#575ECF' : state.isFocused ? '#333' : '#2a2a2a',
      color: '#c5c1b9',
      fontSize: '13px',
    }),
    singleValue: (base) => ({ ...base, color: '#c5c1b9' }),
    placeholder: (base) => ({ ...base, color: '#8a8680' }),
    input: (base) => ({ ...base, color: '#c5c1b9' }),
    multiValue: (base) => ({ ...base, backgroundColor: 'rgba(87,94,207,0.13)' }),
    multiValueLabel: (base) => ({ ...base, color: '#c5c1b9' }),
  }

  const startIndex = (page - 1) * 25 + 1
  const endIndex = Math.min(page * 25, total)

  const dateInputStyle = {
    backgroundColor: '#2a2a2a',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#c5c1b9',
    borderRadius: '8px',
    padding: '6px 10px',
    fontSize: '12px',
    width: '100%',
    outline: 'none',
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#c5c1b9]">Change Log</h1>
          <p className="text-[#8a8680] text-sm mt-1">Track all changes made across accounts</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
          style={{ backgroundColor: '#575ECF' }}
          onMouseEnter={e => { if (!exporting) e.currentTarget.style.backgroundColor = '#6B72D8' }}
          onMouseLeave={e => { if (!exporting) e.currentTarget.style.backgroundColor = '#575ECF' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-xl p-5 mb-6" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="text-sm font-semibold text-[#c5c1b9] mb-4">Filters</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs text-[#8a8680] mb-1">Account</label>
            <Select
              options={[{ value: '', label: 'All Accounts' }, ...accounts]}
              value={filters.account}
              onChange={v => setFilters(prev => ({ ...prev, account: v?.value ? v : null }))}
              placeholder="All..."
              styles={selectStyles}
              isClearable
            />
          </div>
          <div>
            <label className="block text-xs text-[#8a8680] mb-1">Team Member</label>
            <Select
              options={[{ value: '', label: 'All Members' }, ...teamMembers]}
              value={filters.team_member}
              onChange={v => setFilters(prev => ({ ...prev, team_member: v?.value ? v : null }))}
              placeholder="All..."
              styles={selectStyles}
              isClearable
            />
          </div>
          <div>
            <label className="block text-xs text-[#8a8680] mb-1">Date From</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={e => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
              style={dateInputStyle}
              onFocus={e => e.target.style.borderColor = '#575ECF'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>
          <div>
            <label className="block text-xs text-[#8a8680] mb-1">Date To</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={e => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
              style={dateInputStyle}
              onFocus={e => e.target.style.borderColor = '#575ECF'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>
          <div>
            <label className="block text-xs text-[#8a8680] mb-1">Change Type</label>
            <Select
              options={CHANGE_TYPE_OPTIONS}
              value={filters.change_type}
              onChange={v => setFilters(prev => ({ ...prev, change_type: v || [] }))}
              placeholder="All..."
              styles={selectStyles}
              isMulti
            />
          </div>
          <div>
            <label className="block text-xs text-[#8a8680] mb-1">Section</label>
            <Select
              options={SECTION_OPTIONS}
              value={filters.section}
              onChange={v => setFilters(prev => ({ ...prev, section: v }))}
              placeholder="All..."
              styles={selectStyles}
              isClearable
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleApplyFilters}
            className="px-5 py-2 text-white rounded-lg text-sm font-medium transition-all"
            style={{ backgroundColor: '#575ECF' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#6B72D8'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#575ECF'}
          >
            Apply Filters
          </button>
          <button
            onClick={handleReset}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all text-[#c5c1b9]"
            style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#575ECF'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: '#575ECF' }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#333' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm" style={{ color: '#8a8680' }}>No change log entries found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: '#1b1b1b', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <tr>
                  {['Date', 'Account', 'Team Member', 'Section', 'Change Type', 'Summary', 'Actions'].map(col => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#8a8680' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id} style={{ backgroundColor: i % 2 === 0 ? '#242424' : '#2a2a2a', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#c5c1b9' }}>{formatDate(log.date)}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: '#c5c1b9' }}>{log.account_name}</td>
                    <td className="px-4 py-3" style={{ color: '#c5c1b9' }}>{log.team_member}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#8a8680' }}>{log.section}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        style={CHANGE_TYPE_COLORS[log.change_type] || { backgroundColor: 'rgba(255,255,255,0.08)', color: '#c5c1b9' }}
                      >
                        {CHANGE_TYPE_LABELS[log.change_type] || log.change_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <span className="line-clamp-2 text-xs" style={{ color: '#8a8680' }}>
                        {log.changes_made_note
                          ? log.changes_made_note.substring(0, 80) + (log.changes_made_note.length > 80 ? '…' : '')
                          : <span style={{ color: '#555', fontStyle: 'italic' }}>—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedEntry(log)}
                        className="text-xs font-medium transition-colors hover:underline"
                        style={{ color: '#575ECF' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#6B72D8'}
                        onMouseLeave={e => e.currentTarget.style.color = '#575ECF'}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#1b1b1b' }}>
            <p className="text-sm" style={{ color: '#8a8680' }}>
              Showing <strong style={{ color: '#c5c1b9' }}>{startIndex}–{endIndex}</strong> of <strong style={{ color: '#c5c1b9' }}>{total}</strong> results
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { const np = page - 1; setPage(np); fetchLogs(appliedFilters, np) }}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#c5c1b9', backgroundColor: '#2a2a2a' }}
                onMouseEnter={e => { if (page > 1) e.currentTarget.style.borderColor = '#575ECF' }}
                onMouseLeave={e => { if (page > 1) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
              >
                ← Prev
              </button>
              <span className="px-3 py-1.5 text-sm font-medium" style={{ color: '#c5c1b9' }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => { const np = page + 1; setPage(np); fetchLogs(appliedFilters, np) }}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#c5c1b9', backgroundColor: '#2a2a2a' }}
                onMouseEnter={e => { if (page < totalPages) e.currentTarget.style.borderColor = '#575ECF' }}
                onMouseLeave={e => { if (page < totalPages) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.12)' }}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <h3 className="text-lg font-bold text-[#c5c1b9]">Change Log Details</h3>
                <p className="text-sm text-[#8a8680]">
                  {selectedEntry.account_name} — {formatDate(selectedEntry.date)}
                </p>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                style={{ color: '#8a8680' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#c5c1b9' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#8a8680' }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <div className="space-y-3">
                {Object.entries(DETAIL_FIELD_LABELS).map(([key, label]) => {
                  const value = selectedEntry[key]
                  if (!value) return null
                  return (
                    <div key={key} className="flex gap-4">
                      <div className="w-44 flex-shrink-0">
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#8a8680' }}>{label}</span>
                      </div>
                      <div className="flex-1">
                        {key === 'change_type' ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                            style={CHANGE_TYPE_COLORS[value] || { backgroundColor: 'rgba(255,255,255,0.08)', color: '#c5c1b9' }}
                          >
                            {CHANGE_TYPE_LABELS[value] || value}
                          </span>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap" style={{ color: '#c5c1b9' }}>{value}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#1b1b1b' }}>
              <button
                onClick={() => setSelectedEntry(null)}
                className="w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors text-[#c5c1b9]"
                style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#575ECF'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
