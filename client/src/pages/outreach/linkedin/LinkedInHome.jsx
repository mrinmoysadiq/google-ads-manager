import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import Select from 'react-select'
import toast from 'react-hot-toast'
import { useDebounce } from '../../../hooks/useDebounce'
import { getUser, isAdmin } from '../../../utils/auth'
import { getSpecialists } from '../../../utils/outreachApi'
import {
  getLinkedInLeads, updateLinkedInLead, getLinkedInPipelineStages, getLinkedInSettings,
  upsertFollowup, createReply,
} from '../../../utils/linkedinApi'
import LinkedInLeadDrawer from './components/LinkedInLeadDrawer'
import LinkedInTable from './components/LinkedInTable'
import LinkedInKanban from './components/LinkedInKanban'
import LinkedInDashboard from './components/LinkedInDashboard'
import FollowupQuickModal from './components/FollowupQuickModal'
import ReplyQuickModal from './components/ReplyQuickModal'
import { FOLLOWUP_STAGE_KEYS, REPLIED_STAGE } from './constants'

const LS_SPECIALIST_KEY = 'linkedin_specialist'
const LS_VIEW_KEY = 'linkedin_view'

const selectStyles = {
  control: (base, { isFocused }) => ({ ...base, backgroundColor: '#2a2a2a', borderColor: isFocused ? '#0a66c2' : 'rgba(255,255,255,0.1)', boxShadow: 'none', '&:hover': { borderColor: '#0a66c2' }, minHeight: '38px', fontSize: '13px' }),
  menu: (base) => ({ ...base, backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', zIndex: 100 }),
  option: (base, { isSelected, isFocused }) => ({ ...base, backgroundColor: isSelected ? '#0a66c2' : isFocused ? 'rgba(10,102,194,0.15)' : 'transparent', color: '#c5c1b9', cursor: 'pointer' }),
  singleValue: (base) => ({ ...base, color: '#c5c1b9' }),
  placeholder: (base) => ({ ...base, color: '#8a8680' }),
  input: (base) => ({ ...base, color: '#c5c1b9' }),
}

export default function LinkedInHome() {
  const [tab, setTab] = useState('pipeline') // pipeline | dashboard
  const [viewMode, setViewMode] = useState(() => localStorage.getItem(LS_VIEW_KEY) || 'kanban')
  const [specialists, setSpecialists] = useState([])
  const [selectedSpecialist, setSelectedSpecialist] = useState(null) // null = All
  const [leads, setLeads] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [stages, setStages] = useState([])
  const [warmupThreshold, setWarmupThreshold] = useState(3)

  const [drawerLeadId, setDrawerLeadId] = useState(undefined)
  const [drawerInitialTab, setDrawerInitialTab] = useState('details')
  const [drawerKey, setDrawerKey] = useState(0)
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0)

  const [followupModal, setFollowupModal] = useState({ open: false, leadId: null, stageKey: null, modalKey: 0 })
  const [replyModal, setReplyModal] = useState({ open: false, leadId: null, modalKey: 0 })

  const [filters, setFilters] = useState({
    status: '', search: '', date_from: '', date_to: '', sort_by: 'status_updated_at', sort_dir: 'DESC',
  })
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 350)
  const searchRef = useRef(null)

  useEffect(() => {
    if (debouncedSearch !== (filters.search || '')) {
      setFilters(f => ({ ...f, search: debouncedSearch }))
      setPage(1)
    }
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!filters.search && searchInput) setSearchInput('')
  }, [filters.search]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load metadata — specialists are shared with the cold reach out module
  useEffect(() => {
    const appUser = getUser()
    const userIsAdmin = isAdmin()
    Promise.all([getSpecialists(), getLinkedInPipelineStages(), getLinkedInSettings()])
      .then(async ([specs, stgs, settings]) => {
        const activeSpecs = specs.filter(s => s.active)
        setSpecialists(activeSpecs)
        setStages(stgs.filter(s => s.active))
        setWarmupThreshold(parseInt(settings.warmup_threshold) || 3)

        if (!userIsAdmin && appUser) {
          const match = activeSpecs.find(s => s.name.toLowerCase() === appUser.name.toLowerCase())
          if (match) {
            setSelectedSpecialist(match)
            localStorage.setItem(LS_SPECIALIST_KEY, String(match.id))
          }
        } else {
          const saved = localStorage.getItem(LS_SPECIALIST_KEY)
          if (saved) {
            const found = activeSpecs.find(s => String(s.id) === saved)
            if (found) setSelectedSpecialist(found)
          }
        }
      })
      .catch(() => toast.error('Failed to load LinkedIn tracker data'))
  }, [])

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
    if (filters.search) params.search = filters.search
    if (filters.date_from) params.date_from = filters.date_from
    if (filters.date_to) params.date_to = filters.date_to

    getLinkedInLeads(params)
      .then(data => {
        setLeads(data.data)
        setPagination({ page: data.page, total: data.total, totalPages: data.totalPages })
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

  const handleStatusChange = async (leadId, newStatus) => {
    if (FOLLOWUP_STAGE_KEYS.includes(newStatus)) {
      setFollowupModal({ open: true, leadId, stageKey: newStatus, modalKey: Date.now() })
      return
    }
    if (newStatus === REPLIED_STAGE) {
      setReplyModal({ open: true, leadId, modalKey: Date.now() })
      return
    }
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
    try {
      await updateLinkedInLead(leadId, { status: newStatus, performed_by: getUser()?.name || null })
      bumpDashboard()
    } catch {
      toast.error('Failed to update status')
      fetchLeads()
    }
  }

  const handleFollowupModalSave = async (fields) => {
    const { leadId, stageKey } = followupModal
    await upsertFollowup(leadId, stageKey, fields)
    await updateLinkedInLead(leadId, { status: stageKey, performed_by: getUser()?.name || null })
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: stageKey } : l))
    setFollowupModal({ open: false, leadId: null, stageKey: null, modalKey: 0 })
    toast.success(`${stageKey} logged — lead moved`)
    bumpDashboard()
    fetchLeads()
  }

  const handleReplyModalSave = async (fields) => {
    const { leadId } = replyModal
    await createReply(leadId, fields)
    await updateLinkedInLead(leadId, { status: REPLIED_STAGE, performed_by: getUser()?.name || null })
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: REPLIED_STAGE } : l))
    setReplyModal({ open: false, leadId: null, modalKey: 0 })
    toast.success('Reply logged — lead moved to Replied')
    bumpDashboard()
    fetchLeads()
  }

  const handleConnectionStatusChange = async (leadId, newConnectionStatus) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, connection_status: newConnectionStatus } : l))
    try {
      await updateLinkedInLead(leadId, { connection_status: newConnectionStatus })
      bumpDashboard()
    } catch {
      toast.error('Failed to update connection status')
      fetchLeads()
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

  const openDrawer = (leadId, initialTab = 'details') => {
    setDrawerLeadId(leadId)
    setDrawerInitialTab(initialTab)
    setDrawerKey(k => k + 1)
  }

  const openEngagementsTab = (leadId) => openDrawer(leadId, 'engagements')

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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[#c5c1b9]">LinkedIn Reach Out Tracker</h1>
              <Link to="/outreach" className="text-xs font-medium px-2 py-1 rounded-md transition-colors" style={{ color: '#8a8680', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                ← Outreach CRM
              </Link>
            </div>
            <p className="text-[#8a8680] text-sm mt-0.5">Track LinkedIn engagement and connection outreach.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
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

            <button
              onClick={() => openDrawer(null)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: '#0a66c2' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#0e7cd8'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0a66c2'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Lead
            </button>

            <Link
              to="/outreach/linkedin/admin"
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
              style={tab === key ? { color: '#0a66c2', borderBottom: '2px solid #0a66c2' } : { color: '#8a8680', borderBottom: '2px solid transparent' }}
            >
              {label}
            </button>
          ))}

          {tab === 'pipeline' && (
            <div className="ml-auto mb-1 flex items-center gap-1.5">
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                {[['table', 'Table', 'M3 10h18M3 14h18M3 6h18M3 18h18'], ['kanban', 'Kanban', 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2']].map(([mode, label, iconPath]) => (
                  <button
                    key={mode}
                    onClick={() => handleViewMode(mode)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
                    style={viewMode === mode ? { backgroundColor: '#0a66c2', color: '#fff' } : { backgroundColor: 'transparent', color: '#8a8680' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} /></svg>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        {tab === 'pipeline' && (
          <>
            <div style={{ marginBottom: 14 }}>
              <div style={{ position: 'relative', maxWidth: 560 }}>
                <svg style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: searchInput ? '#0a66c2' : '#8a8680', transition: 'color 0.15s' }} width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Search by lead name, company, job title…"
                  style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 38, paddingRight: searchInput ? 36 : 14, paddingTop: 9, paddingBottom: 9, backgroundColor: '#242424', border: `1px solid ${searchInput ? '#0a66c2' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, color: '#c5c1b9', fontSize: '0.875rem', outline: 'none', transition: 'border-color 0.15s' }}
                  onFocus={e => { e.target.style.borderColor = '#0a66c2'; e.target.previousSibling && (e.target.previousSibling.style.color = '#0a66c2') }}
                  onBlur={e => { if (!searchInput) e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
                  onKeyDown={e => e.key === 'Escape' && (setSearchInput(''), e.target.blur())}
                />
                {searchInput && (
                  <button onClick={() => { setSearchInput(''); searchRef.current?.focus() }} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', color: '#8a8680', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', lineHeight: 1 }} title="Clear search">✕</button>
                )}
              </div>
              {filters.search && (
                <p style={{ color: '#8a8680', fontSize: '0.75rem', marginTop: 6, marginLeft: 2 }}>
                  {loading ? 'Searching…' : `${pagination.total} result${pagination.total !== 1 ? 's' : ''} for "${filters.search}"`}
                </p>
              )}
            </div>

            {viewMode === 'table' ? (
              <LinkedInTable
                leads={leads}
                loading={loading}
                pagination={pagination}
                filters={filters}
                onFiltersChange={(f) => { setFilters(f); setPage(1) }}
                onPageChange={setPage}
                onLeadClick={openDrawer}
                onStatusChange={handleStatusChange}
                onConnectionStatusChange={handleConnectionStatusChange}
                onViewLog={openEngagementsTab}
                stages={stages}
                showSpecialistColumn={showSpecialistColumn}
              />
            ) : (
              <LinkedInKanban
                leads={leads}
                loading={loading}
                onLeadClick={openDrawer}
                onStatusChange={handleStatusChange}
                onConnectionStatusChange={handleConnectionStatusChange}
                onViewLog={openEngagementsTab}
                showSpecialistColumn={showSpecialistColumn}
                stages={stages}
                warmupThreshold={warmupThreshold}
              />
            )}
          </>
        )}

        {tab === 'dashboard' && (
          <LinkedInDashboard
            specialistId={selectedSpecialist ? selectedSpecialist.id : ''}
            onLeadClick={openDrawer}
            refreshKey={dashboardRefreshKey}
            stages={stages}
          />
        )}
      </div>

      {drawerLeadId !== undefined && (
        <LinkedInLeadDrawer
          key={drawerKey}
          leadId={drawerLeadId}
          initialTab={drawerInitialTab}
          defaultSpecialistId={selectedSpecialist?.id || null}
          onClose={() => setDrawerLeadId(undefined)}
          onSaved={handleLeadSaved}
          onDeleted={handleLeadDeleted}
          onLeadUpdated={handleLeadUpdated}
          specialists={specialists}
          stages={stages}
          warmupThreshold={warmupThreshold}
          leads={leads}
        />
      )}

      {followupModal.open && (
        <FollowupQuickModal
          key={followupModal.modalKey}
          stageKey={followupModal.stageKey}
          onSave={handleFollowupModalSave}
          onClose={() => setFollowupModal({ open: false, leadId: null, stageKey: null, modalKey: 0 })}
        />
      )}

      {replyModal.open && (
        <ReplyQuickModal
          key={replyModal.modalKey}
          onSave={handleReplyModalSave}
          onClose={() => setReplyModal({ open: false, leadId: null, modalKey: 0 })}
        />
      )}
    </div>
  )
}
