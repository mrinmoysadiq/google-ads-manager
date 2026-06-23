import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Select from 'react-select'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { getUser } from '../../utils/auth'

const CHANGE_LEVELS = [
  { value: 'Ad Level', label: 'Ad Level' },
  { value: 'Ad Set Level', label: 'Ad Set Level' },
  { value: 'Campaign Level', label: 'Campaign Level' },
  { value: 'Account Level', label: 'Account Level' },
]

const CHANGES_MADE_TO_OPTIONS = [
  { value: 'Ads / Creatives', label: 'Ads / Creatives' },
  { value: 'Budget', label: 'Budget' },
  { value: 'Audience / Targeting', label: 'Audience / Targeting' },
  { value: 'Bidding / Optimization', label: 'Bidding / Optimization' },
  { value: 'Schedule', label: 'Schedule' },
  { value: 'Placements', label: 'Placements' },
  { value: 'Campaign Settings', label: 'Campaign Settings' },
  { value: 'Ad Set Settings', label: 'Ad Set Settings' },
  { value: 'Other', label: 'Other' },
]

const LEVEL_COLORS = {
  'Ad Level':       { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24' },
  'Ad Set Level':   { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
  'Campaign Level': { bg: 'rgba(87,94,207,0.15)',   color: '#575ECF' },
  'Account Level':  { bg: 'rgba(248,113,113,0.15)', color: '#f87171' },
}

// Quick date preset helpers
function today() { return new Date().toISOString().slice(0, 10) }
function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10)
}
function startOfMonth() {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function startOfLastMonth() {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function endOfLastMonth() {
  const d = new Date(); d.setDate(0)
  return d.toISOString().slice(0, 10)
}

const DATE_PRESETS = [
  { label: 'Today', get: () => ({ date_from: today(), date_to: today() }) },
  { label: 'Last 7 days', get: () => ({ date_from: daysAgo(6), date_to: today() }) },
  { label: 'Last 30 days', get: () => ({ date_from: daysAgo(29), date_to: today() }) },
  { label: 'This month', get: () => ({ date_from: startOfMonth(), date_to: today() }) },
  { label: 'Last month', get: () => ({ date_from: startOfLastMonth(), date_to: endOfLastMonth() }) },
  { label: 'All time', get: () => ({ date_from: '', date_to: '' }) },
]

const defaultForm = () => ({
  date: today(),
  change_level: null,
  media_buyer: null,
  ad_account: null,
  campaign_name: '',
  ad_set_name: '',
  ad_name: '',
  changes_made_to: null,
  what_changed: '',
  why_changed: '',
})

const defaultFilters = () => ({
  ad_account: null,
  media_buyer: null,
  date_from: '',
  date_to: '',
  change_level: null,
  changes_made_to: null,
  search: '',
  preset: 'All time',
})

const selectStyles = (hasErr = false) => ({
  control: (base, state) => ({
    ...base,
    backgroundColor: '#2a2a2a',
    borderColor: hasErr ? 'rgba(248,113,113,0.6)' : state.isFocused ? '#575ECF' : 'rgba(255,255,255,0.12)',
    boxShadow: 'none',
    '&:hover': { borderColor: '#575ECF' },
    borderRadius: '8px',
    minHeight: '38px',
    fontSize: '13px',
  }),
  menu: (base) => ({ ...base, backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', zIndex: 100 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#575ECF' : state.isFocused ? '#333' : '#2a2a2a',
    color: '#c5c1b9',
    fontSize: '13px',
  }),
  singleValue: (base) => ({ ...base, color: '#c5c1b9' }),
  placeholder: (base) => ({ ...base, color: '#8a8680' }),
  input: (base) => ({ ...base, color: '#c5c1b9' }),
  indicatorSeparator: () => ({ display: 'none' }),
})

const inputStyle = (hasErr = false) => ({
  backgroundColor: '#2a2a2a',
  border: `1px solid ${hasErr ? 'rgba(248,113,113,0.6)' : 'rgba(255,255,255,0.12)'}`,
  color: '#c5c1b9',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '13px',
  width: '100%',
  outline: 'none',
})

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

function formatDate(d) {
  if (!d) return ''
  try {
    const [y, m, day] = d.split('-')
    return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return d }
}

function countActiveFilters(f) {
  let n = 0
  if (f.ad_account) n++
  if (f.media_buyer) n++
  if (f.change_level) n++
  if (f.changes_made_to) n++
  if (f.date_from || f.date_to) n++
  if (f.search) n++
  return n
}

export default function FbChangeLog() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [stats, setStats] = useState(null)

  const [mediaBuyers, setMediaBuyers] = useState([])
  const [adAccounts, setAdAccounts] = useState([])

  const [filters, setFilters] = useState(defaultFilters())
  const [appliedFilters, setAppliedFilters] = useState({})
  const [showFilters, setShowFilters] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [form, setForm] = useState(defaultForm())
  const [formErrors, setFormErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const [selectedEntry, setSelectedEntry] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const searchTimer = useRef(null)

  useEffect(() => {
    Promise.all([
      api.get('/facebook/media-buyers'),
      api.get('/facebook/ad-accounts'),
    ]).then(([b, a]) => {
      setMediaBuyers(b.data.map(x => ({ value: x.name, label: x.name })))
      setAdAccounts(a.data.map(x => ({ value: x.name, label: x.name })))
    }).catch(() => toast.error('Failed to load filter options'))
    fetchStats()
  }, [])

  const fetchStats = () => {
    api.get('/facebook/change-log/stats')
      .then(({ data }) => setStats(data))
      .catch(() => {})
  }

  const buildQuery = (f, pg = 1) => {
    const q = { page: pg, limit: 25 }
    if (f.ad_account) q.ad_account = f.ad_account
    if (f.media_buyer) q.media_buyer = f.media_buyer
    if (f.date_from) q.date_from = f.date_from
    if (f.date_to) q.date_to = f.date_to
    if (f.change_level) q.change_level = f.change_level
    if (f.changes_made_to) q.changes_made_to = f.changes_made_to
    if (f.search) q.search = f.search
    return q
  }

  const fetchLogs = (f = appliedFilters, pg = 1) => {
    setLoading(true)
    api.get('/facebook/change-log', { params: buildQuery(f, pg) })
      .then(({ data }) => {
        setLogs(data.data)
        setTotal(data.total)
        setPage(data.page)
        setTotalPages(data.totalPages)
      })
      .catch(() => toast.error('Failed to load change log'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchLogs({}, 1) }, [])

  const applyFilters = (f) => {
    const af = {
      ad_account: f.ad_account?.value || '',
      media_buyer: f.media_buyer?.value || '',
      date_from: f.date_from,
      date_to: f.date_to,
      change_level: f.change_level?.value || '',
      changes_made_to: f.changes_made_to?.value || '',
      search: f.search,
    }
    setAppliedFilters(af)
    fetchLogs(af, 1)
  }

  const handleApplyFilters = () => applyFilters(filters)

  const handleReset = () => {
    const fresh = defaultFilters()
    setFilters(fresh)
    setAppliedFilters({})
    fetchLogs({}, 1)
  }

  // Quick preset click — instantly applies
  const handlePreset = (preset) => {
    const dates = preset.get()
    const updated = { ...filters, ...dates, preset: preset.label }
    setFilters(updated)
    applyFilters(updated)
  }

  // Level chip click — toggle filter
  const handleLevelChip = (level) => {
    const current = filters.change_level?.value
    const next = current === level ? null : { value: level, label: level }
    const updated = { ...filters, change_level: next }
    setFilters(updated)
    applyFilters(updated)
  }

  // Debounced search
  const handleSearch = (val) => {
    setFilters(p => ({ ...p, search: val }))
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      const updated = { ...filters, search: val }
      const af = {
        ad_account: updated.ad_account?.value || '',
        media_buyer: updated.media_buyer?.value || '',
        date_from: updated.date_from,
        date_to: updated.date_to,
        change_level: updated.change_level?.value || '',
        changes_made_to: updated.changes_made_to?.value || '',
        search: val,
      }
      setAppliedFilters(af)
      fetchLogs(af, 1)
    }, 350)
  }

  const openAdd = () => {
    const user = getUser()
    const buyerMatch = mediaBuyers.find(b => b.value.toLowerCase() === (user?.name || '').toLowerCase())
    setEditEntry(null)
    setForm({ ...defaultForm(), media_buyer: buyerMatch || null })
    setFormErrors({})
    setShowModal(true)
  }

  const openEdit = (entry) => {
    setEditEntry(entry)
    setForm({
      date: entry.date,
      change_level: entry.change_level ? { value: entry.change_level, label: entry.change_level } : null,
      media_buyer: entry.media_buyer ? { value: entry.media_buyer, label: entry.media_buyer } : null,
      ad_account: entry.ad_account ? { value: entry.ad_account, label: entry.ad_account } : null,
      campaign_name: entry.campaign_name || '',
      ad_set_name: entry.ad_set_name || '',
      ad_name: entry.ad_name || '',
      changes_made_to: entry.changes_made_to ? { value: entry.changes_made_to, label: entry.changes_made_to } : null,
      what_changed: entry.what_changed || '',
      why_changed: entry.why_changed || '',
    })
    setFormErrors({})
    setShowModal(true)
  }

  const handleSubmit = async () => {
    const errs = {}
    if (!form.date) errs.date = true
    if (!form.change_level) errs.change_level = true
    if (!form.what_changed.trim()) errs.what_changed = true
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return }

    setSubmitting(true)
    try {
      const payload = {
        date: form.date,
        change_level: form.change_level?.value,
        media_buyer: form.media_buyer?.value || null,
        ad_account: form.ad_account?.value || null,
        campaign_name: form.campaign_name.trim() || null,
        ad_set_name: form.ad_set_name.trim() || null,
        ad_name: form.ad_name.trim() || null,
        changes_made_to: form.changes_made_to?.value || null,
        what_changed: form.what_changed.trim(),
        why_changed: form.why_changed.trim() || null,
      }
      if (editEntry) {
        await api.patch(`/facebook/change-log/${editEntry.id}`, payload)
        toast.success('Entry updated')
      } else {
        await api.post('/facebook/change-log', payload)
        toast.success('Change logged!')
      }
      setShowModal(false)
      fetchLogs(appliedFilters, editEntry ? page : 1)
      fetchStats()
    } catch {
      toast.error('Failed to save. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/facebook/change-log/${deleteTarget.id}`)
      toast.success('Entry deleted')
      setDeleteTarget(null)
      setSelectedEntry(null)
      fetchLogs(appliedFilters, page)
      fetchStats()
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const q = { ...buildQuery(appliedFilters, 1) }
      delete q.page; delete q.limit
      const resp = await api.get('/facebook/change-log/export', { params: q, responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([resp.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'fb-change-log.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('CSV exported!')
    } catch {
      toast.error('Failed to export CSV')
    } finally {
      setExporting(false)
    }
  }

  const setField = (key, val) => {
    setForm(p => ({ ...p, [key]: val }))
    setFormErrors(p => { const n = { ...p }; delete n[key]; return n })
  }

  const activeFilterCount = countActiveFilters(filters)
  const startIndex = (page - 1) * 25 + 1
  const endIndex = Math.min(page * 25, total)

  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="mb-1">
              <Link to="/facebook" className="text-[#8a8680] hover:text-[#c5c1b9] transition-colors text-sm">
                ← Facebook & Meta Ads
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-[#c5c1b9]">Meta Ads Change Log</h1>
            <p className="text-[#8a8680] text-sm mt-0.5">Track every change made across your Meta ad accounts</p>
          </div>
          <div className="flex gap-2">
            <button onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(16,185,129,0.2)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(16,185,129,0.12)'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Log Change
            </button>
            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              style={{ backgroundColor: '#575ECF' }}
              onMouseEnter={e => { if (!exporting) e.currentTarget.style.backgroundColor = '#6B72D8' }}
              onMouseLeave={e => { if (!exporting) e.currentTarget.style.backgroundColor = '#575ECF' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        </div>

        {/* ── Stat chips ── */}
        {stats && stats.total > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)', color: '#c5c1b9' }}>
              <span style={{ color: '#8a8680' }}>Total</span>
              <span className="font-bold">{stats.total}</span>
            </div>
            {Object.entries(LEVEL_COLORS).map(([level, col]) => {
              const cnt = stats.byLevel?.[level] || 0
              if (!cnt) return null
              const isActive = filters.change_level?.value === level
              return (
                <button key={level}
                  onClick={() => handleLevelChip(level)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    backgroundColor: isActive ? col.bg : 'rgba(255,255,255,0.04)',
                    color: isActive ? col.color : '#8a8680',
                    border: `1px solid ${isActive ? col.color + '40' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  <span>{level}</span>
                  <span className="font-bold" style={{ color: isActive ? col.color : '#c5c1b9' }}>{cnt}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Search + quick presets row ── */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#8a8680' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search campaigns, ad sets, changes…"
              value={filters.search}
              onChange={e => handleSearch(e.target.value)}
              style={{ ...dateInputStyle, paddingLeft: '34px', fontSize: '13px', padding: '8px 12px 8px 34px' }}
              onFocus={e => e.target.style.borderColor = '#575ECF'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
            {filters.search && (
              <button onClick={() => handleSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#8a8680' }}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          {/* Date presets */}
          <div className="flex flex-wrap gap-1.5">
            {DATE_PRESETS.map(p => (
              <button key={p.label} onClick={() => handlePreset(p)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: filters.preset === p.label ? 'rgba(87,94,207,0.2)' : 'rgba(255,255,255,0.04)',
                  color: filters.preset === p.label ? '#575ECF' : '#8a8680',
                  border: `1px solid ${filters.preset === p.label ? 'rgba(87,94,207,0.4)' : 'rgba(255,255,255,0.08)'}`,
                }}
                onMouseEnter={e => { if (filters.preset !== p.label) { e.currentTarget.style.color = '#c5c1b9'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' } }}
                onMouseLeave={e => { if (filters.preset !== p.label) { e.currentTarget.style.color = '#8a8680'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' } }}
              >{p.label}</button>
            ))}
          </div>

          {/* Toggle advanced filters */}
          <button onClick={() => setShowFilters(p => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              backgroundColor: activeFilterCount > 0 ? 'rgba(87,94,207,0.15)' : 'rgba(255,255,255,0.04)',
              color: activeFilterCount > 0 ? '#575ECF' : '#8a8680',
              border: `1px solid ${activeFilterCount > 0 ? 'rgba(87,94,207,0.35)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            <svg className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* ── Advanced filter panel ── */}
        {showFilters && (
          <div className="rounded-xl p-5 mb-5" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Ad Account</label>
                <Select options={adAccounts} value={filters.ad_account}
                  onChange={v => setFilters(p => ({ ...p, ad_account: v || null }))}
                  placeholder="All…" styles={selectStyles()} isClearable />
              </div>
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Media Buyer</label>
                <Select options={mediaBuyers} value={filters.media_buyer}
                  onChange={v => setFilters(p => ({ ...p, media_buyer: v || null }))}
                  placeholder="All…" styles={selectStyles()} isClearable />
              </div>
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Change Level</label>
                <Select options={CHANGE_LEVELS} value={filters.change_level}
                  onChange={v => setFilters(p => ({ ...p, change_level: v || null }))}
                  placeholder="All…" styles={selectStyles()} isClearable />
              </div>
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Changed What</label>
                <Select options={CHANGES_MADE_TO_OPTIONS} value={filters.changes_made_to}
                  onChange={v => setFilters(p => ({ ...p, changes_made_to: v || null }))}
                  placeholder="All…" styles={selectStyles()} isClearable />
              </div>
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Date From</label>
                <input type="date" value={filters.date_from}
                  onChange={e => setFilters(p => ({ ...p, date_from: e.target.value, preset: 'Custom' }))}
                  style={dateInputStyle}
                  onFocus={e => e.target.style.borderColor = '#575ECF'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                />
              </div>
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Date To</label>
                <input type="date" value={filters.date_to}
                  onChange={e => setFilters(p => ({ ...p, date_to: e.target.value, preset: 'Custom' }))}
                  style={dateInputStyle}
                  onFocus={e => e.target.style.borderColor = '#575ECF'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleApplyFilters}
                className="px-5 py-2 text-white rounded-lg text-sm font-medium"
                style={{ backgroundColor: '#575ECF' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#6B72D8'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#575ECF'}
              >Apply Filters</button>
              <button onClick={handleReset}
                className="px-5 py-2 rounded-lg text-sm font-medium text-[#c5c1b9]"
                style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#575ECF'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
              >Reset All</button>
            </div>
          </div>
        )}

        {/* ── Active filter tags ── */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {filters.search && (
              <FilterTag label={`Search: "${filters.search}"`} onRemove={() => handleSearch('')} />
            )}
            {filters.ad_account && (
              <FilterTag label={`Account: ${filters.ad_account.value}`} onRemove={() => { const u = { ...filters, ad_account: null }; setFilters(u); applyFilters(u) }} />
            )}
            {filters.media_buyer && (
              <FilterTag label={`Buyer: ${filters.media_buyer.value}`} onRemove={() => { const u = { ...filters, media_buyer: null }; setFilters(u); applyFilters(u) }} />
            )}
            {filters.change_level && (
              <FilterTag label={`Level: ${filters.change_level.value}`} onRemove={() => { const u = { ...filters, change_level: null }; setFilters(u); applyFilters(u) }} />
            )}
            {filters.changes_made_to && (
              <FilterTag label={`Type: ${filters.changes_made_to.value}`} onRemove={() => { const u = { ...filters, changes_made_to: null }; setFilters(u); applyFilters(u) }} />
            )}
            {(filters.date_from || filters.date_to) && (
              <FilterTag
                label={filters.date_from && filters.date_to ? `${formatDate(filters.date_from)} – ${formatDate(filters.date_to)}` : filters.date_from ? `From ${formatDate(filters.date_from)}` : `To ${formatDate(filters.date_to)}`}
                onRemove={() => { const u = { ...filters, date_from: '', date_to: '', preset: 'All time' }; setFilters(u); applyFilters(u) }}
              />
            )}
          </div>
        )}

        {/* ── Table ── */}
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
              <p className="text-sm mb-3" style={{ color: '#8a8680' }}>
                {activeFilterCount > 0 ? 'No entries match these filters.' : 'No changes logged yet.'}
              </p>
              {activeFilterCount > 0 ? (
                <button onClick={handleReset} className="text-sm font-medium" style={{ color: '#575ECF' }}>Clear filters</button>
              ) : (
                <button onClick={openAdd} className="text-sm font-medium" style={{ color: '#10b981' }}>+ Log your first change</button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: '#1b1b1b', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <tr>
                    {['Date', 'Level', 'Who', 'Ad Account', 'Campaign / Ad Set', 'Changed What?', 'What Changed', 'Actions'].map(col => (
                      <th key={col} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#8a8680' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => {
                    const levelColor = LEVEL_COLORS[log.change_level] || { bg: 'rgba(255,255,255,0.08)', color: '#c5c1b9' }
                    return (
                      <tr key={log.id} style={{ backgroundColor: i % 2 === 0 ? '#242424' : '#2a2a2a', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm" style={{ color: '#c5c1b9' }}>{formatDate(log.date)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: levelColor.bg, color: levelColor.color }}>
                            {log.change_level}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#c5c1b9' }}>{log.media_buyer || <span style={{ color: '#555' }}>—</span>}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#8a8680' }}>{log.ad_account || <span style={{ color: '#555' }}>—</span>}</td>
                        <td className="px-4 py-3 max-w-[160px]">
                          <div className="text-xs" style={{ color: '#c5c1b9' }}>{log.campaign_name || '—'}</div>
                          {log.ad_set_name && <div className="text-xs mt-0.5" style={{ color: '#8a8680' }}>{log.ad_set_name}</div>}
                        </td>
                        <td className="px-4 py-3">
                          {log.changes_made_to ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#8a8680' }}>
                              {log.changes_made_to}
                            </span>
                          ) : <span style={{ color: '#555' }}>—</span>}
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <span className="text-xs" style={{ color: '#8a8680' }}>
                            {log.what_changed
                              ? log.what_changed.substring(0, 80) + (log.what_changed.length > 80 ? '…' : '')
                              : <span style={{ color: '#555', fontStyle: 'italic' }}>—</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setSelectedEntry(log)} className="text-xs font-medium hover:underline" style={{ color: '#575ECF' }}>View</button>
                            <button onClick={() => openEdit(log)} className="text-xs font-medium hover:underline" style={{ color: '#8a8680' }}>Edit</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > 0 && (
            <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#1b1b1b' }}>
              <p className="text-sm" style={{ color: '#8a8680' }}>
                Showing <strong style={{ color: '#c5c1b9' }}>{startIndex}–{endIndex}</strong> of <strong style={{ color: '#c5c1b9' }}>{total}</strong> entries
              </p>
              <div className="flex gap-2">
                <button onClick={() => { const np = page - 1; setPage(np); fetchLogs(appliedFilters, np) }}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-sm rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#c5c1b9', backgroundColor: '#2a2a2a' }}
                  onMouseEnter={e => { if (page > 1) e.currentTarget.style.borderColor = '#575ECF' }}
                  onMouseLeave={e => { if (page > 1) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                >← Prev</button>
                <span className="px-3 py-1.5 text-sm font-medium" style={{ color: '#c5c1b9' }}>{page} / {totalPages}</span>
                <button onClick={() => { const np = page + 1; setPage(np); fetchLogs(appliedFilters, np) }}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-sm rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#c5c1b9', backgroundColor: '#2a2a2a' }}
                  onMouseEnter={e => { if (page < totalPages) e.currentTarget.style.borderColor = '#575ECF' }}
                  onMouseLeave={e => { if (page < totalPages) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                >Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Modal ── */}
      {selectedEntry && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <div className="rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.12)' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <h3 className="text-lg font-bold text-[#c5c1b9]">Change Details</h3>
                <p className="text-sm text-[#8a8680]">{formatDate(selectedEntry.date)}</p>
              </div>
              <button onClick={() => setSelectedEntry(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full"
                style={{ color: '#8a8680' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#c5c1b9' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#8a8680' }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
              {[
                ['Change Level', selectedEntry.change_level, 'badge'],
                ['Media Buyer', selectedEntry.media_buyer],
                ['Ad Account', selectedEntry.ad_account],
                ['Campaign', selectedEntry.campaign_name],
                ['Ad Set', selectedEntry.ad_set_name],
                ['Ad', selectedEntry.ad_name],
                ['Changed What?', selectedEntry.changes_made_to, 'tag'],
                ['What Changed', selectedEntry.what_changed],
                ['Why Changed', selectedEntry.why_changed],
              ].map(([label, val, type]) => {
                if (!val) return null
                const levelColor = LEVEL_COLORS[val] || {}
                return (
                  <div key={label} className="flex gap-4">
                    <div className="w-32 flex-shrink-0">
                      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#8a8680' }}>{label}</span>
                    </div>
                    <div className="flex-1">
                      {type === 'badge' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: levelColor.bg || 'rgba(255,255,255,0.08)', color: levelColor.color || '#c5c1b9' }}>
                          {val}
                        </span>
                      ) : type === 'tag' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs"
                          style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#8a8680' }}>
                          {val}
                        </span>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap" style={{ color: '#c5c1b9' }}>{val}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="px-6 py-4 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#1b1b1b' }}>
              <button onClick={() => { openEdit(selectedEntry); setSelectedEntry(null) }}
                className="flex-1 py-2 px-4 rounded-lg text-sm font-medium text-[#c5c1b9]"
                style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#575ECF'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
              >Edit</button>
              <button onClick={() => { setDeleteTarget(selectedEntry); setSelectedEntry(null) }}
                className="flex-1 py-2 px-4 rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.2)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.1)'}
              >Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <div className="rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.12)' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <h3 className="text-lg font-bold text-[#c5c1b9]">{editEntry ? 'Edit Change' : 'Log a Change'}</h3>
                <p className="text-sm text-[#8a8680]">{editEntry ? 'Update this change log entry.' : 'Record a Meta Ads change.'}</p>
              </div>
              <button onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full"
                style={{ color: '#8a8680' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#c5c1b9' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#8a8680' }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#8a8680] mb-1.5">Date <span className="text-red-400">*</span></label>
                  <input type="date" value={form.date} onChange={e => setField('date', e.target.value)} style={inputStyle(formErrors.date)} />
                  {formErrors.date && <p className="text-red-400 text-xs mt-1">Required</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#8a8680] mb-1.5">Change Level <span className="text-red-400">*</span></label>
                  <Select options={CHANGE_LEVELS} value={form.change_level} onChange={v => setField('change_level', v)} placeholder="Select…" styles={selectStyles(!!formErrors.change_level)} />
                  {formErrors.change_level && <p className="text-red-400 text-xs mt-1">Required</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#8a8680] mb-1.5">Media Buyer</label>
                  <Select options={mediaBuyers} value={form.media_buyer} onChange={v => setField('media_buyer', v)} placeholder="Select…" styles={selectStyles()} isClearable />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#8a8680] mb-1.5">Ad Account</label>
                  <Select options={adAccounts} value={form.ad_account} onChange={v => setField('ad_account', v)} placeholder="Select…" styles={selectStyles()} isClearable />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8a8680] mb-1.5">Campaign Name</label>
                <input type="text" placeholder="e.g. MS | Leads campaign | CBO | 21st May" value={form.campaign_name} onChange={e => setField('campaign_name', e.target.value)} style={inputStyle()} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#8a8680] mb-1.5">Ad Set Name</label>
                  <input type="text" placeholder="Ad set name…" value={form.ad_set_name} onChange={e => setField('ad_set_name', e.target.value)} style={inputStyle()} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#8a8680] mb-1.5">Ad Name</label>
                  <input type="text" placeholder="Ad name…" value={form.ad_name} onChange={e => setField('ad_name', e.target.value)} style={inputStyle()} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8a8680] mb-1.5">Changes Made To</label>
                <Select options={CHANGES_MADE_TO_OPTIONS} value={form.changes_made_to} onChange={v => setField('changes_made_to', v)} placeholder="e.g. Ads / Creatives, Budget…" styles={selectStyles()} isClearable />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8a8680] mb-1.5">What Changes Were Made? <span className="text-red-400">*</span></label>
                <textarea rows={3} placeholder="Describe the change…" value={form.what_changed} onChange={e => setField('what_changed', e.target.value)} className="resize-none focus:outline-none" style={{ ...inputStyle(formErrors.what_changed), resize: 'none' }} />
                {formErrors.what_changed && <p className="text-red-400 text-xs mt-1">Required</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8a8680] mb-1.5">Why Are We Making This Change?</label>
                <textarea rows={3} placeholder="Reason for the change…" value={form.why_changed} onChange={e => setField('why_changed', e.target.value)} className="resize-none focus:outline-none" style={{ ...inputStyle(), resize: 'none' }} />
              </div>
            </div>

            <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#1b1b1b' }}>
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium text-[#c5c1b9]"
                style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#575ECF'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
              >Cancel</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: '#10b981' }}
                onMouseEnter={e => { if (!submitting) e.currentTarget.style.backgroundColor = '#059669' }}
                onMouseLeave={e => { if (!submitting) e.currentTarget.style.backgroundColor = '#10b981' }}
              >{submitting ? 'Saving…' : editEntry ? 'Save Changes' : 'Log Change'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteTarget && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <div className="rounded-2xl w-full max-w-sm p-6" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.12)' }}>
            <h3 className="text-lg font-bold text-[#c5c1b9] mb-2">Delete Entry?</h3>
            <p className="text-sm text-[#8a8680] mb-6">This will permanently remove this change log entry. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium text-[#c5c1b9]"
                style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)' }}
              >Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: '#ef4444' }}
              >{deleting ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterTag({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
      style={{ backgroundColor: 'rgba(87,94,207,0.12)', color: '#575ECF', border: '1px solid rgba(87,94,207,0.25)' }}>
      {label}
      <button onClick={onRemove} style={{ color: '#575ECF', opacity: 0.7 }}
        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
        onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </span>
  )
}
