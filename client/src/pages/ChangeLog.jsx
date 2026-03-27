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
  performance_note: 'bg-blue-100 text-blue-700',
  keyword_paused: 'bg-orange-100 text-orange-700',
  keyword_added: 'bg-green-100 text-green-700',
  ad_copy_change: 'bg-purple-100 text-purple-700',
  audience_targeting_change: 'bg-pink-100 text-pink-700',
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
      borderColor: state.isFocused ? '#2563eb' : '#d1d5db',
      boxShadow: state.isFocused ? '0 0 0 1px #2563eb' : 'none',
      '&:hover': { borderColor: '#2563eb' },
      borderRadius: '8px',
      minHeight: '38px',
      fontSize: '13px',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? '#eff6ff' : 'white',
      color: state.isSelected ? 'white' : '#111827',
      fontSize: '13px',
    }),
  }

  const startIndex = (page - 1) * 25 + 1
  const endIndex = Math.min(page * 25, total)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Change Log</h1>
          <p className="text-gray-500 text-sm mt-1">Track all changes made across accounts</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Filters</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Account</label>
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
            <label className="block text-xs text-gray-500 mb-1">Team Member</label>
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
            <label className="block text-xs text-gray-500 mb-1">Date From</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={e => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date To</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={e => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Change Type</label>
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
            <label className="block text-xs text-gray-500 mb-1">Section</label>
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
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all"
          >
            Apply Filters
          </button>
          <button
            onClick={handleReset}
            className="px-5 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-all"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="w-8 h-8 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-400 text-sm">No change log entries found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Date', 'Account', 'Team Member', 'Section', 'Change Type', 'Summary', 'Actions'].map(col => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDate(log.date)}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{log.account_name}</td>
                    <td className="px-4 py-3 text-gray-700">{log.team_member}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs">{log.section}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CHANGE_TYPE_COLORS[log.change_type] || 'bg-gray-100 text-gray-700'}`}>
                        {CHANGE_TYPE_LABELS[log.change_type] || log.change_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">
                      <span className="line-clamp-2 text-xs">
                        {log.changes_made_note
                          ? log.changes_made_note.substring(0, 80) + (log.changes_made_note.length > 80 ? '…' : '')
                          : <span className="text-gray-300 italic">—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedEntry(log)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:underline"
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              Showing <strong>{startIndex}–{endIndex}</strong> of <strong>{total}</strong> results
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { const np = page - 1; setPage(np); fetchLogs(appliedFilters, np) }}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                ← Prev
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600 font-medium">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => { const np = page + 1; setPage(np); fetchLogs(appliedFilters, np) }}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Change Log Details</h3>
                <p className="text-sm text-gray-500">
                  {selectedEntry.account_name} — {formatDate(selectedEntry.date)}
                </p>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
                      </div>
                      <div className="flex-1">
                        {key === 'change_type' ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CHANGE_TYPE_COLORS[value] || 'bg-gray-100 text-gray-700'}`}>
                            {CHANGE_TYPE_LABELS[value] || value}
                          </span>
                        ) : (
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{value}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setSelectedEntry(null)}
                className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
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
