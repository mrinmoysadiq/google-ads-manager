/**
 * Shared session start page for all tracking audits.
 * Props:
 *   auditState     — the module-level state object
 *   resetState     — function to reset state
 *   auditTitle     — display title string
 *   accentColor    — hex color for the icon/button
 *   icon           — JSX element for the audit icon
 *   checklistPath  — route to navigate to checklist
 *   guardBack      — route to go back (/tracking)
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Select from 'react-select'
import api from '../../../utils/api'
import toast from 'react-hot-toast'

const selectStyles = {
  control: (b, s) => ({
    ...b,
    backgroundColor: '#2a2a2a',
    borderColor: s.isFocused ? '#575ECF' : 'rgba(255,255,255,0.12)',
    boxShadow: 'none',
    borderRadius: '8px',
    minHeight: '42px',
    fontSize: '14px',
    '&:hover': { borderColor: '#575ECF' },
  }),
  menu: b => ({ ...b, backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px' }),
  option: (b, s) => ({ ...b, backgroundColor: s.isSelected ? '#575ECF' : s.isFocused ? 'rgba(87,94,207,0.15)' : 'transparent', color: '#c5c1b9', cursor: 'pointer' }),
  singleValue: b => ({ ...b, color: '#c5c1b9' }),
  placeholder: b => ({ ...b, color: '#8a8680' }),
  input: b => ({ ...b, color: '#c5c1b9' }),
  indicatorSeparator: () => ({ display: 'none' }),
}

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const inputCls = 'w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#575ECF] transition-colors placeholder-[#8a8680]'

export default function TrackingStartPage({
  auditState,
  resetState,
  auditTitle,
  accentColor = '#575ECF',
  icon,
  checklistPath,
  guardBack = '/tracking',
}) {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedClient, setSelectedClient] = useState(null)
  const [website, setWebsite] = useState('')
  const [date, setDate] = useState(today())

  // Get specialist from logged-in user
  const specialistName = (() => {
    try { return JSON.parse(localStorage.getItem('app_user') || '{}').name || '' }
    catch { return '' }
  })()

  useEffect(() => {
    resetState()
    api.get('/tracking/clients')
      .then(({ data }) => setClients(data))
      .catch(() => toast.error('Failed to load clients'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line

  // Auto-fill website when client selected
  useEffect(() => {
    if (selectedClient?.data?.website) setWebsite(selectedClient.data.website)
    else if (!selectedClient) setWebsite('')
  }, [selectedClient])

  const clientOptions = clients.map(c => ({ value: c.id, label: c.name, data: c }))
  const canStart = !!selectedClient && !!date && !!specialistName

  function handleStart() {
    if (!canStart) return
    auditState.specialist = specialistName
    auditState.client = selectedClient.label
    auditState.website = website
    auditState.date = date
    auditState.currentSlide = 0
    navigate(checklistPath)
  }

  return (
    <div className="min-h-screen bg-[#1b1b1b] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo badge */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3 bg-[#242424] border border-white/8 rounded-2xl px-5 py-3">
            {icon}
            <span className="text-[#c5c1b9] font-semibold text-sm">{auditTitle}</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#242424] border border-white/8 rounded-2xl p-7">
          <h1 className="text-xl font-bold text-[#c5c1b9] mb-1">Start Audit Session</h1>
          <p className="text-[#8a8680] text-sm mb-6">Fill in the details to begin.</p>

          {loading ? (
            <div className="flex justify-center py-8">
              <svg className="animate-spin h-6 w-6 text-[#575ECF]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Specialist — read-only from login */}
              <div>
                <label className="block text-xs font-medium text-[#8a8680] mb-1.5 uppercase tracking-wider">Specialist</label>
                <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[#c5c1b9]"
                  style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <svg className="w-3.5 h-3.5 text-[#8a8680] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="flex-1">{specialistName || <span className="text-[#8a8680]">Not logged in</span>}</span>
                  <span className="text-[10px] text-[#8a8680] bg-white/6 px-1.5 py-0.5 rounded-md">You</span>
                </div>
              </div>

              {/* Client */}
              <div>
                <label className="block text-xs font-medium text-[#8a8680] mb-1.5 uppercase tracking-wider">Client *</label>
                <Select
                  styles={selectStyles}
                  options={clientOptions}
                  value={selectedClient}
                  onChange={setSelectedClient}
                  placeholder="Select client…"
                  isClearable
                />
              </div>

              {/* Website */}
              <div>
                <label className="block text-xs font-medium text-[#8a8680] mb-1.5 uppercase tracking-wider">Website</label>
                <input
                  className={inputCls}
                  placeholder="https://client-website.com"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-[#8a8680] mb-1.5 uppercase tracking-wider">Date *</label>
                <input
                  type="date"
                  className={inputCls}
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>

              {/* Start button */}
              <button
                onClick={handleStart}
                disabled={!canStart}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all mt-2"
                style={{
                  backgroundColor: canStart ? accentColor : 'rgba(87,94,207,0.3)',
                  cursor: canStart ? 'pointer' : 'not-allowed',
                }}
              >
                Start Audit →
              </button>
            </div>
          )}
        </div>

        <div className="text-center mt-5">
          <button onClick={() => navigate(guardBack)} className="text-xs text-[#8a8680] hover:text-[#c5c1b9] transition-colors">
            ← Back to Tracking Audits
          </button>
        </div>
      </div>
    </div>
  )
}
