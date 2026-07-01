import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import Select from 'react-select'
import toast from 'react-hot-toast'
import { useDebounce } from '../../hooks/useDebounce'
import { getUser, isAdmin } from '../../utils/auth'
import { todayLocal } from '../../utils/dates'
import { getSpecialists, createSpecialist, getIndustries, getLeads, updateLead, createLead, exportCsv, getPipelineStages, getSettings, upsertTouchpoint, createLeadResponse } from '../../utils/outreachApi'
import LeadDrawer from './components/LeadDrawer'
import PipelineTable from './components/PipelineTable'
import PipelineKanban from './components/PipelineKanban'
import Dashboard from './components/Dashboard'
import TouchpointQuickModal from './components/TouchpointQuickModal'
import ResponseQuickModal from './components/ResponseQuickModal'

function getTouchpointNumber(status) {
  const m = status && status.match(/^Touchpoint (\d+)$/)
  return m ? parseInt(m[1]) : null
}

const LS_SPECIALIST_KEY = 'outreach_specialist'
const LS_VIEW_KEY = 'outreach_view'

const NOT_OVERDUE_STATUSES = ['Closed / Booked as Client', 'Disqualified / Dead', 'Meeting Done - Not Interested']

const selectStyles = {
  control: (base, { isFocused }) => ({ ...base, backgroundColor: '#2a2a2a', borderColor: isFocused ? '#575ECF' : 'rgba(255,255,255,0.1)', boxShadow: 'none', '&:hover': { borderColor: '#575ECF' }, minHeight: '38px', fontSize: '13px' }),
  menu: (base) => ({ ...base, backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', zIndex: 100 }),
  option: (base, { isSelected, isFocused }) => ({ ...base, backgroundColor: isSelected ? '#575ECF' : isFocused ? 'rgba(87,94,207,0.15)' : 'transparent', color: '#c5c1b9', cursor: 'pointer' }),
  singleValue: (base) => ({ ...base, color: '#c5c1b9' }),
  placeholder: (base) => ({ ...base, color: '#8a8680' }),
  input: (base) => ({ ...base, color: '#c5c1b9' }),
}

export default function OutreachHome() {
  const [tab, setTab] = useState('pipeline') // pipeline | dashboard
  const [viewMode, setViewMode] = useState(() => localStorage.getItem(LS_VIEW_KEY) || 'kanban')
  const [specialists, setSpecialists] = useState([])
  const [industries, setIndustries] = useState([])
  const [selectedSpecialist, setSelectedSpecialist] = useState(null) // null = All
  const [leads, setLeads] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [overdueCount, setOverdueCount] = useState(0)
  const [stages, setStages] = useState([])
  const [maxTouchpoints, setMaxTouchpoints] = useState(5)
  const [tpModal, setTpModal] = useState({ open: false, leadId: null, number: null, status: null, modalKey: 0 })
  const [responseModal, setResponseModal] = useState({ open: false, leadId: null, status: null, modalKey: 0 })

  // Drawer state
  const [drawerLeadId, setDrawerLeadId] = useState(undefined) // undefined=closed, null=create, number=edit
  const [drawerKey, setDrawerKey] = useState(0) // force remount on open
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0) // increment to refresh dashboard

  // Pipeline filters — default sort by most-recently-updated so moved leads surface to top
  const [filters, setFilters] = useState({
    status: '', industry_id: '', search: '', followup_overdue: false,
    date_from: '', date_to: '', sort_by: 'status_updated_at', sort_dir: 'DESC',
  })
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 350)
  const searchRef = useRef(null)

  // Sync debounced search → filters
  useEffect(() => {
    if (debouncedSearch !== (filters.search || '')) {
      setFilters(f => ({ ...f, search: debouncedSearch }))
      setPage(1)
    }
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync filters.search → local search input (e.g. when PipelineTable clears all filters)
  useEffect(() => {
    if (!filters.search && searchInput) setSearchInput('')
  }, [filters.search]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load metadata
  useEffect(() => {
    const appUser = getUser()
    const userIsAdmin = isAdmin()
    Promise.all([getSpecialists(), getIndustries(), getPipelineStages(), getSettings()])
      .then(async ([specs, inds, stgs, settings]) => {
        const activeSpecs = specs.filter(s => s.active)
        setSpecialists(activeSpecs)
        setIndustries(inds)
        setStages(stgs.filter(s => s.active))
        setMaxTouchpoints(parseInt(settings.max_touchpoints) || 5)

        if (!userIsAdmin && appUser) {
          // Regular user: auto-select specialist matching their name, create if missing
          const match = activeSpecs.find(s => s.name.toLowerCase() === appUser.name.toLowerCase())
          if (match) {
            setSelectedSpecialist(match)
            localStorage.setItem(LS_SPECIALIST_KEY, String(match.id))
          } else {
            try {
              const created = await createSpecialist({ name: appUser.name })
              setSpecialists(prev => [...prev, created])
              setSelectedSpecialist(created)
              localStorage.setItem(LS_SPECIALIST_KEY, String(created.id))
            } catch { /* ignore */ }
          }
        } else {
          // Admin: restore from localStorage or leave as "All"
          const saved = localStorage.getItem(LS_SPECIALIST_KEY)
          if (saved) {
            const found = activeSpecs.find(s => String(s.id) === saved)
            if (found) setSelectedSpecialist(found)
          }
        }
      })
      .catch(() => toast.error('Failed to load outreach data'))
  }, [])

  // Fetch leads — Kanban loads up to 500 (no images in list response, so this is fast);
  // Table stays at 25/page with server-side pagination.
  const fetchLeads = useCallback(() => {
    setLoading(true)
    const isKanban = viewMode === 'kanban'
    const params = {
      page: isKanban ? 1 : page,
      limit: isKanban ? 500 : 25,
      sort_by: filters.sort_by,
      sort_dir: filters.sort_dir,
    }
    if (selectedSpecialist) params.specialist_id = selectedSpecialist.id
    if (filters.status) params.status = filters.status
    if (filters.industry_id) params.industry_id = filters.industry_id
    if (filters.search) params.search = filters.search
    if (filters.followup_overdue) params.followup_overdue = 'true'
    if (filters.date_from) params.date_from = filters.date_from
    if (filters.date_to) params.date_to = filters.date_to

    getLeads(params)
      .then(data => {
        setLeads(data.data)
        setPagination({ page: data.page, total: data.total, totalPages: data.totalPages })
        // Count overdue in current result set for badge
        const today = todayLocal()
        const overdue = data.data.filter(l => l.next_followup_date && l.next_followup_date < today && !NOT_OVERDUE_STATUSES.includes(l.status)).length
        setOverdueCount(overdue)
      })
      .catch(() => toast.error('Failed to load leads'))
      .finally(() => setLoading(false))
  }, [selectedSpecialist, filters, page, viewMode])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const handleSpecialistChange = (opt) => {
    const spec = opt?.value ? specialists.find(s => s.id === opt.value) : null
    setSelectedSpecialist(spec)
    localStorage.setItem(LS_SPECIALIST_KEY, spec ? String(spec.id) : '')
    setPage(1)
  }

  const handleViewMode = (mode) => {
    setViewMode(mode)
    localStorage.setItem(LS_VIEW_KEY, mode)
  }

  const RESPONSE_REQUIRED_STATUSES = ['Interested', 'Not Interested', 'Not interested', 'Meeting Done - Not Interested']

  const handleStatusChange = async (leadId, newStatus) => {
    const tpNum = getTouchpointNumber(newStatus)
    if (tpNum !== null) {
      setTpModal({ open: true, leadId, number: tpNum, status: newStatus, modalKey: Date.now() })
      return
    }
    if (RESPONSE_REQUIRED_STATUSES.includes(newStatus)) {
      setResponseModal({ open: true, leadId, status: newStatus, modalKey: Date.now() })
      return
    }
    // All other stages: optimistic update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
    try {
      await updateLead(leadId, { status: newStatus, performed_by: getUser()?.name || null })
      bumpDashboard()
    } catch {
      toast.error('Failed to update status')
      fetchLeads()
    }
  }

  const handleTpModalSave = async (fields) => {
    const { leadId, number, status } = tpModal
    await upsertTouchpoint(leadId, number, fields)
    await updateLead(leadId, { status, performed_by: getUser()?.name || null })
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l))
    setTpModal({ open: false, leadId: null, number: null, status: null, modalKey: 0 })
    toast.success(`Touchpoint ${number} saved — moved to ${status}`)
    bumpDashboard()
  }

  const handleResponseModalSave = async (fields) => {
    const { leadId, status } = responseModal
    try {
      await createLeadResponse(leadId, fields)
      await updateLead(leadId, { status, performed_by: getUser()?.name || null })
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l))
      setResponseModal({ open: false, leadId: null, status: null, modalKey: 0 })
      toast.success(`Response logged — moved to "${status}"`)
      bumpDashboard()
    } catch {
      toast.error('Failed to save response')
      throw new Error('Failed')
    }
  }

  const handleLeadUpdated = (updatedLead) => {
    setLeads(prev => prev.map(l => l.id === updatedLead.id ? { ...l, ...updatedLead } : l))
    bumpDashboard()
  }

  const bumpDashboard = () => setDashboardRefreshKey(k => k + 1)

  const handleLeadSaved = () => { fetchLeads(); bumpDashboard() }
  const handleLeadDeleted = (id) => {
    setLeads(prev => prev.filter(l => l.id !== id))
    setDrawerLeadId(undefined)
    fetchLeads()
    bumpDashboard()
  }

  const openDrawer = (leadId) => {
    setDrawerLeadId(leadId)
    setDrawerKey(k => k + 1)
  }

  const handleExportCsv = async () => {
    try {
      const params = {}
      if (selectedSpecialist) params.specialist_id = selectedSpecialist.id
      if (filters.status) params.status = filters.status
      if (filters.date_from) params.date_from = filters.date_from
      if (filters.date_to) params.date_to = filters.date_to
      const blob = await exportCsv(params)
      const url = window.URL.createObjectURL(new Blob([blob]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'outreach-pipeline.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('CSV exported!')
    } catch { toast.error('Failed to export CSV') }
  }

  const specialistOptions = [
    { value: null, label: 'All Specialists' },
    ...specialists.map(s => ({ value: s.id, label: s.name })),
  ]

  const showSpecialistColumn = !selectedSpecialist

  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <div className="max-w-screen-xl mx-auto px-4 py-6">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#c5c1b9]">Outreach CRM</h1>
            <p className="text-[#8a8680] text-sm mt-0.5">Manage your outreach pipeline and track prospects.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Overdue badge */}
            {overdueCount > 0 && (
              <button
                onClick={() => { setFilters(f => ({ ...f, followup_overdue: true })); setTab('pipeline') }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
              >
                ⚠ {overdueCount} overdue
              </button>
            )}

            {/* Specialist selector — read-only for non-admins */}
            <div style={{ minWidth: 180 }}>
              <Select
                options={specialistOptions}
                value={selectedSpecialist ? { value: selectedSpecialist.id, label: selectedSpecialist.name } : specialistOptions[0]}
                onChange={handleSpecialistChange}
                styles={selectStyles}
                isSearchable={false}
                isDisabled={!isAdmin()}
              />
            </div>

            {/* Add Lead */}
            <button
              onClick={() => openDrawer(null)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: '#575ECF' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#6B72D8'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#575ECF'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Lead
            </button>

            {/* Admin link */}
            <Link
              to="/outreach/admin"
              className="p-2 rounded-lg transition-colors"
              style={{ color: '#8a8680', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              title="Admin settings"
              onMouseEnter={e => e.currentTarget.style.color = '#c5c1b9'}
              onMouseLeave={e => e.currentTarget.style.color = '#8a8680'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {[['pipeline', 'Pipeline'], ['dashboard', 'Dashboard']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="px-4 py-2.5 text-sm font-medium transition-colors -mb-px"
              style={tab === key
                ? { color: '#575ECF', borderBottom: '2px solid #575ECF' }
                : { color: '#8a8680', borderBottom: '2px solid transparent' }
              }
            >
              {label}
            </button>
          ))}

          {tab === 'pipeline' && (
            <div className="ml-auto mb-1 flex items-center gap-1.5">
              {/* View toggle */}
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                {[['table', 'Table', 'M3 10h18M3 14h18M3 6h18M3 18h18'], ['kanban', 'Kanban', 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2']].map(([mode, label, iconPath]) => (
                  <button
                    key={mode}
                    onClick={() => handleViewMode(mode)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
                    style={viewMode === mode
                      ? { backgroundColor: '#575ECF', color: '#fff' }
                      : { backgroundColor: 'transparent', color: '#8a8680' }
                    }
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} /></svg>
                    {label}
                  </button>
                ))}
              </div>

              {/* Export CSV */}
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#8a8680', border: '1px solid rgba(255,255,255,0.08)' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#c5c1b9'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#8a8680'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                CSV
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {tab === 'pipeline' && (
          <>
            {/* ── Global Search Bar ── */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ position: 'relative', maxWidth: 560 }}>
                {/* Search icon */}
                <svg
                  style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: searchInput ? '#575ECF' : '#8a8680', transition: 'color 0.15s' }}
                  width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Search by company, contact, email, phone, location…"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    paddingLeft: 38,
                    paddingRight: searchInput ? 36 : 14,
                    paddingTop: 9,
                    paddingBottom: 9,
                    backgroundColor: '#242424',
                    border: `1px solid ${searchInput ? '#575ECF' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 10,
                    color: '#c5c1b9',
                    fontSize: '0.875rem',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#575ECF'; e.target.previousSibling && (e.target.previousSibling.style.color = '#575ECF') }}
                  onBlur={e => { if (!searchInput) e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
                  onKeyDown={e => e.key === 'Escape' && (setSearchInput(''), e.target.blur())}
                />
                {/* Clear button */}
                {searchInput && (
                  <button
                    onClick={() => { setSearchInput(''); searchRef.current?.focus() }}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%',
                      width: 18, height: 18, cursor: 'pointer', color: '#8a8680',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.7rem', lineHeight: 1,
                    }}
                    title="Clear search"
                  >✕</button>
                )}
              </div>
              {/* Result count hint when searching */}
              {filters.search && (
                <p style={{ color: '#8a8680', fontSize: '0.75rem', marginTop: 6, marginLeft: 2 }}>
                  {loading
                    ? 'Searching…'
                    : `${pagination.total} result${pagination.total !== 1 ? 's' : ''} for "${filters.search}"`
                  }
                </p>
              )}
            </div>

            {viewMode === 'table' ? (
              <PipelineTable
                leads={leads}
                loading={loading}
                pagination={pagination}
                filters={filters}
                onFiltersChange={(f) => { setFilters(f); setPage(1) }}
                onPageChange={setPage}
                onLeadClick={openDrawer}
                onStatusChange={handleStatusChange}
                specialists={specialists}
                industries={industries}
                stages={stages}
                showSpecialistColumn={showSpecialistColumn}
              />
            ) : (
              <PipelineKanban
                leads={leads}
                loading={loading}
                onLeadClick={openDrawer}
                onStatusChange={handleStatusChange}
                showSpecialistColumn={showSpecialistColumn}
                stages={stages}
              />
            )}
          </>
        )}

        {tab === 'dashboard' && (
          <Dashboard
            specialistId={selectedSpecialist ? selectedSpecialist.id : ''}
            specialists={specialists}
            onLeadClick={openDrawer}
            refreshKey={dashboardRefreshKey}
          />
        )}
      </div>

      {/* Lead Drawer */}
      {drawerLeadId !== undefined && (
        <LeadDrawer
          key={drawerKey}
          leadId={drawerLeadId}
          defaultSpecialistId={selectedSpecialist?.id || null}
          onClose={() => setDrawerLeadId(undefined)}
          onSaved={handleLeadSaved}
          onDeleted={handleLeadDeleted}
          onLeadUpdated={handleLeadUpdated}
          specialists={specialists}
          industries={industries}
          stages={stages}
          maxTouchpoints={maxTouchpoints}
        />
      )}

      {/* Touchpoint Quick Modal (kanban drag / table / drawer → touchpoint stage) */}
      {tpModal.open && (
        <TouchpointQuickModal
          key={tpModal.modalKey}
          touchpointNumber={tpModal.number}
          onSave={handleTpModalSave}
          onClose={() => setTpModal({ open: false, leadId: null, number: null, status: null, modalKey: 0 })}
        />
      )}

      {/* Response Quick Modal (kanban drag / table / drawer → Interested or Not Interested) */}
      {responseModal.open && (
        <ResponseQuickModal
          key={responseModal.modalKey}
          newStatus={responseModal.status}
          onSave={handleResponseModalSave}
          onClose={() => setResponseModal({ open: false, leadId: null, status: null, modalKey: 0 })}
        />
      )}
    </div>
  )
}
