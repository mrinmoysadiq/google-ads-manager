import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  getLinkedInDashboard, getStaleEngagementLeads,
  getLinkedInDashboardCards, createLinkedInDashboardCard, updateLinkedInDashboardCard, deleteLinkedInDashboardCard,
  getLinkedInActivity, getLinkedInActivityLeads,
} from '../../../../utils/linkedinApi'
import { fmtDateLong, fmtDateTimeLong } from '../../../../utils/dates'

const ACTIVITY_DATE_RANGE_OPTIONS = [
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7days',     label: '7 Days' },
  { value: '1month',    label: '1 Month' },
  { value: 'custom',    label: 'Custom' },
]

function getActivityDateParams(range, customFrom, customTo) {
  const today = new Date()
  const fmt = (d) => d.toISOString().slice(0, 10)
  switch (range) {
    case 'yesterday': {
      const yest = new Date(today)
      yest.setDate(today.getDate() - 1)
      return { date_from: fmt(yest), date_to: fmt(yest) }
    }
    case '7days': {
      const from = new Date(today)
      from.setDate(today.getDate() - 7)
      return { date_from: fmt(from), date_to: fmt(today) }
    }
    case '1month': {
      const from = new Date(today)
      from.setMonth(today.getMonth() - 1)
      return { date_from: fmt(from), date_to: fmt(today) }
    }
    case 'custom':
      return {
        ...(customFrom ? { date_from: customFrom } : {}),
        ...(customTo ? { date_to: customTo } : {}),
      }
    default:
      return {}
  }
}

const PRESET_COLORS = ['#0a66c2', '#3b82f6', '#a855f7', '#f59e0b', '#22c55e', '#ef4444', '#06b6d4', '#8a8680', '#ec4899', '#f97316']

function daysAgo(dateStr) {
  if (!dateStr) return null
  const diff = Math.floor((new Date() - new Date(dateStr)) / 86400000)
  return diff > 0 ? diff : 0
}

function computeCardValue(card, byStatus, totalLeads) {
  if (!byStatus) return '—'
  const numStatuses = card.numerator_statuses || []
  if (numStatuses.length === 0) return card.card_type === 'rate' ? '0%' : totalLeads
  const numCount = numStatuses.reduce((sum, s) => sum + (byStatus[s] || 0), 0)
  if (card.card_type === 'count') return numCount
  let denCount = card.denominator === 'total' ? totalLeads : Array.isArray(card.denominator) ? card.denominator.reduce((sum, s) => sum + (byStatus[s] || 0), 0) : totalLeads
  if (!denCount) return '0%'
  return ((numCount / denCount) * 100).toFixed(1) + '%'
}

function computeCardSub(card, byStatus, totalLeads) {
  if (!byStatus) return ''
  const numStatuses = card.numerator_statuses || []
  if (numStatuses.length === 0) return 'total leads'
  const numCount = numStatuses.reduce((sum, s) => sum + (byStatus[s] || 0), 0)
  if (card.card_type === 'count') {
    if (card.denominator === 'total') return `of ${totalLeads} total leads`
    if (Array.isArray(card.denominator)) return `of ${card.denominator.reduce((sum, s) => sum + (byStatus[s] || 0), 0)}`
    return ''
  }
  if (card.denominator === 'total') return `${numCount} of ${totalLeads} total`
  if (Array.isArray(card.denominator)) return `${numCount} of ${card.denominator.reduce((sum, s) => sum + (byStatus[s] || 0), 0)}`
  return ''
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
      <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#0a66c2', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function MetricCard({ label, value, sub, color, onEdit }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: '#242424', border: `1px solid ${hovered ? (color || '#0a66c2') : 'rgba(255,255,255,0.08)'}`, position: 'relative', transition: 'border-color 0.15s' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    >
      {hovered && (
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <button onClick={onEdit} title="Edit card" style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 5, color: '#c5c1b9', cursor: 'pointer', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      )}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '12px 12px 0 0', backgroundColor: color || '#0a66c2', opacity: 0.7 }} />
      <p style={{ color: '#8a8680', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600, paddingTop: 4 }}>{label}</p>
      <p style={{ color: '#ffffff', fontSize: '1.875rem', fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>{value ?? '—'}</p>
      {sub && <p style={{ color: '#8a8680', fontSize: '0.72rem', marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

const BLANK_CARD = { label: '', card_type: 'count', numerator_statuses: [], denominator: 'total', denominator_type: 'total', denominator_custom: [], color: '#0a66c2' }

function CardModal({ card, allStatuses, onClose, onSave, onDelete }) {
  const isEdit = !!card?.id
  const [form, setForm] = useState(() => {
    if (!card) return { ...BLANK_CARD }
    const denominatorType = card.denominator === 'total' ? 'total' : 'custom'
    const denominatorCustom = Array.isArray(card.denominator) ? card.denominator : []
    return {
      label: card.label || '', card_type: card.card_type || 'count', numerator_statuses: card.numerator_statuses || [],
      denominator: card.denominator || 'total', denominator_type: denominatorType, denominator_custom: denominatorCustom,
      color: card.color || '#0a66c2',
    }
  })
  const [saving, setSaving] = useState(false)
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const toggleStatus = (key, status) => setForm(f => { const arr = f[key] || []; return { ...f, [key]: arr.includes(status) ? arr.filter(s => s !== status) : [...arr, status] } })

  async function handleSave() {
    if (!form.label.trim()) { toast.error('Label is required'); return }
    setSaving(true)
    try {
      const denominator = form.card_type === 'rate' ? (form.denominator_type === 'total' ? 'total' : form.denominator_custom) : 'total'
      await onSave({ label: form.label.trim(), card_type: form.card_type, numerator_statuses: form.numerator_statuses, denominator, color: form.color })
      onClose()
    } catch { toast.error('Failed to save card') } finally { setSaving(false) }
  }

  const overlay = { position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
  const modal = { backgroundColor: '#1a1a1a', borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 28, color: '#c5c1b9' }
  const label = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8a8680', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }
  const input = { width: '100%', boxSizing: 'border-box', backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#c5c1b9', padding: '8px 12px', fontSize: '0.9rem' }
  const section = { marginBottom: 20 }

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{isEdit ? 'Edit Metric Card' : 'Add Metric Card'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8a8680', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={section}>
          <label style={label}>Card Name</label>
          <input style={input} value={form.label} onChange={e => set('label', e.target.value)} placeholder="e.g. Reply Rate" />
        </div>

        <div style={section}>
          <label style={label}>Card Type</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {[['count', 'Count (#)'], ['rate', 'Rate (%)']].map(([val, lbl]) => (
              <button key={val} onClick={() => set('card_type', val)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', border: '1px solid', borderColor: form.card_type === val ? '#0a66c2' : 'rgba(255,255,255,0.12)', backgroundColor: form.card_type === val ? 'rgba(10,102,194,0.15)' : 'transparent', color: form.card_type === val ? '#0a66c2' : '#8a8680' }}>{lbl}</button>
            ))}
          </div>
        </div>

        <div style={section}>
          <label style={label}>
            {form.card_type === 'rate' ? 'Numerator — count leads in these stages' : 'Count leads in these stages'}
            <span style={{ color: '#0a66c2', marginLeft: 6, textTransform: 'none', fontWeight: 400 }}>
              {form.numerator_statuses.length === 0 ? '(empty = total leads)' : `(${form.numerator_statuses.length} selected)`}
            </span>
          </label>
          <div style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px', display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
            {allStatuses.map(s => {
              const active = form.numerator_statuses.includes(s)
              return (
                <button key={s} onClick={() => toggleStatus('numerator_statuses', s)} style={{ padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem', cursor: 'pointer', border: '1px solid', borderColor: active ? form.color : 'rgba(255,255,255,0.1)', backgroundColor: active ? `${form.color}22` : 'transparent', color: active ? form.color : '#8a8680', fontWeight: active ? 600 : 400 }}>{s}</button>
              )
            })}
          </div>
        </div>

        {form.card_type === 'rate' && (
          <div style={section}>
            <label style={label}>Denominator — divide by</label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              {[['total', 'Total Leads'], ['custom', 'Custom Stages']].map(([val, lbl]) => (
                <button key={val} onClick={() => set('denominator_type', val)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', border: '1px solid', borderColor: form.denominator_type === val ? '#0a66c2' : 'rgba(255,255,255,0.12)', backgroundColor: form.denominator_type === val ? 'rgba(10,102,194,0.15)' : 'transparent', color: form.denominator_type === val ? '#0a66c2' : '#8a8680' }}>{lbl}</button>
              ))}
            </div>
            {form.denominator_type === 'custom' && (
              <div style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px', display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
                {allStatuses.map(s => {
                  const active = form.denominator_custom.includes(s)
                  return (
                    <button key={s} onClick={() => toggleStatus('denominator_custom', s)} style={{ padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem', cursor: 'pointer', border: '1px solid', borderColor: active ? '#f59e0b' : 'rgba(255,255,255,0.1)', backgroundColor: active ? 'rgba(245,158,11,0.12)' : 'transparent', color: active ? '#f59e0b' : '#8a8680', fontWeight: active ? 600 : 400 }}>{s}</button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div style={section}>
          <label style={label}>Color</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => set('color', c)} style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: c, border: form.color === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }} title={c} />
            ))}
            <input type="color" value={form.color} onChange={e => set('color', e.target.value)} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0 }} title="Custom color" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          {isEdit && onDelete ? (
            <button onClick={onDelete} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>Delete Card</button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'transparent', color: '#8a8680', cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 24px', borderRadius: 8, border: 'none', backgroundColor: '#0a66c2', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Card'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const STATUS_PILL_COLORS = {
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
  'No Response / Dead':        { bg: 'rgba(138,134,128,0.15)', color: '#8a8680' },
  'Disqualified':              { bg: 'rgba(138,134,128,0.15)', color: '#8a8680' },
}
function statusPill(status) {
  const c = STATUS_PILL_COLORS[status] || { bg: 'rgba(138,134,128,0.15)', color: '#8a8680' }
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 600, backgroundColor: c.bg, color: c.color, whiteSpace: 'nowrap' }}>{status}</span>
  )
}

function ActivityLeadsDrawer({ title, subtitle, leads, loading, onClose, onLeadClick }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9500, display: 'flex' }}>
      <div style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', cursor: 'pointer' }} onClick={onClose} />
      <div style={{ width: 520, maxWidth: '92vw', backgroundColor: '#1b1b1b', borderLeft: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'hidden', boxShadow: '-8px 0 40px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ color: '#ffffff', margin: '0 0 4px', fontSize: '1rem', fontWeight: 700 }}>{title}</h3>
              {subtitle && <p style={{ color: '#8a8680', margin: 0, fontSize: '0.78rem' }}>{subtitle}</p>}
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, color: '#8a8680', cursor: 'pointer', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0, marginLeft: 12 }}>✕</button>
          </div>
          {!loading && (
            <p style={{ color: '#0a66c2', fontSize: '0.75rem', margin: '10px 0 0', fontWeight: 600 }}>
              {leads.length} lead{leads.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {loading ? <Spinner /> : leads.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#8a8680', padding: '40px 0', fontSize: '0.88rem' }}>No leads found for this period</p>
          ) : leads.map((lead, idx) => (
            <div
              key={lead.move_id || `${lead.id}-${idx}`}
              onClick={() => { onLeadClick(lead.id); onClose() }}
              style={{ padding: '12px 10px', borderRadius: 10, cursor: 'pointer', borderBottom: idx < leads.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', transition: 'background 0.12s' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ color: '#0a66c2', fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lead.lead_name || '—'}
                </span>
                {statusPill(lead.status)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#8a8680', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lead.company_name || '—'}
                  {lead.specialist_name && <span style={{ marginLeft: 8, color: 'rgba(138,134,128,0.6)' }}>· {lead.specialist_name}</span>}
                </span>
                {lead.new_status ? (
                  <span style={{ fontSize: '0.72rem', color: '#8a8680', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <span style={{ color: 'rgba(138,134,128,0.5)' }}>{lead.old_status || '—'}</span>
                    {' → '}
                    <span style={{ color: '#c5c1b9', fontWeight: 600 }}>{lead.new_status}</span>
                  </span>
                ) : null}
              </div>
              <div style={{ marginTop: 5 }}>
                <span style={{ fontSize: '0.7rem', color: 'rgba(138,134,128,0.6)' }}>
                  {lead.changed_at ? fmtDateTimeLong(lead.changed_at) : fmtDateTimeLong(lead.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LinkedInDashboard({ specialistId, onLeadClick, refreshKey, stages = [] }) {
  const [metrics, setMetrics] = useState(null)
  const [cards, setCards] = useState([])
  const [staleLeads, setStaleLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalCard, setModalCard] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Daily Activity section — independent date filter, defaults to yesterday
  const [actDateRange, setActDateRange] = useState('yesterday')
  const [actCustomFrom, setActCustomFrom] = useState('')
  const [actCustomTo, setActCustomTo] = useState('')
  const [activity, setActivity] = useState(null)
  const [actLoading, setActLoading] = useState(true)

  // Activity leads drill-through drawer
  const [actDrawer, setActDrawer] = useState(null) // { title, subtitle }
  const [actLeads, setActLeads] = useState([])
  const [actLeadsLoading, setActLeadsLoading] = useState(false)

  // Stage names must always come from the DB-driven `stages` prop — never a
  // hardcoded list, or a stale/renamed/deleted stage would show up here.
  const dbStageNames = stages.map(s => s.name)
  const allStatuses = metrics?.by_status ? [...new Set([...dbStageNames, ...Object.keys(metrics.by_status)])] : dbStageNames

  const fetchCards = useCallback(async () => {
    try { setCards(await getLinkedInDashboardCards()) } catch (err) { console.error('Failed to load dashboard cards', err) }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (specialistId) params.specialist_id = specialistId
      const [dashRes, staleRes] = await Promise.all([
        getLinkedInDashboard(params),
        getStaleEngagementLeads(params),
      ])
      setMetrics(dashRes)
      setStaleLeads(staleRes || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load dashboard data')
    } finally { setLoading(false) }
  }, [specialistId])

  useEffect(() => { fetchCards() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { if (refreshKey === undefined) return; fetchData() }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function openActivityLeads(title, subtitle, params) {
    const dateParams = getActivityDateParams(actDateRange, actCustomFrom, actCustomTo)
    const fullParams = { ...dateParams, ...params }
    if (specialistId) fullParams.specialist_id = specialistId
    setActDrawer({ title, subtitle })
    setActLeads([])
    setActLeadsLoading(true)
    getLinkedInActivityLeads(fullParams)
      .then(data => { setActLeads(data); setActLeadsLoading(false) })
      .catch(() => { toast.error('Failed to load leads'); setActLeadsLoading(false) })
  }

  const fetchActivity = useCallback(async () => {
    setActLoading(true)
    try {
      const dateParams = getActivityDateParams(actDateRange, actCustomFrom, actCustomTo)
      const params = { ...dateParams }
      if (specialistId) params.specialist_id = specialistId
      const data = await getLinkedInActivity(params)
      setActivity(data)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load activity data')
    } finally { setActLoading(false) }
  }, [actDateRange, actCustomFrom, actCustomTo, specialistId])

  useEffect(() => {
    if (actDateRange === 'custom' && (!actCustomFrom || !actCustomTo)) return
    fetchActivity()
  }, [fetchActivity])

  useEffect(() => { if (refreshKey === undefined) return; fetchActivity() }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCardSave(data) {
    if (modalCard?.id) {
      const updated = await updateLinkedInDashboardCard(modalCard.id, data)
      setCards(prev => prev.map(c => c.id === modalCard.id ? updated : c))
      toast.success('Card updated')
    } else {
      const created = await createLinkedInDashboardCard({ ...data, sort_order: cards.length })
      setCards(prev => [...prev, created])
      toast.success('Card added')
    }
  }

  async function handleCardDelete(cardId) {
    try {
      await deleteLinkedInDashboardCard(cardId)
      setCards(prev => prev.filter(c => c.id !== cardId))
      toast.success('Card deleted')
    } catch { toast.error('Failed to delete card') }
  }

  const m = metrics || {}
  const byStatus = m.by_status || {}
  const totalLeads = m.total_leads || 0
  const bySpecialist = m.by_specialist || []

  const cardStyle = { backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }
  const mutedText = { color: '#8a8680' }
  const primaryText = { color: '#c5c1b9' }

  return (
    <div style={{ color: '#c5c1b9' }}>
      {loading ? <Spinner /> : (
        <>
          {/* ── Custom Metric Cards ───────────────────────────────────── */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ color: '#8a8680', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, margin: 0 }}>Metrics</p>
              <button onClick={() => { setModalCard({}); setModalOpen(true) }} style={{ padding: '4px 14px', borderRadius: 999, border: '1px solid rgba(10,102,194,0.4)', backgroundColor: 'rgba(10,102,194,0.1)', color: '#0a66c2', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>+ Add Card</button>
            </div>
            {cards.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12, color: '#8a8680', fontSize: '0.85rem' }}>
                No metric cards yet.{' '}
                <button onClick={() => { setModalCard({}); setModalOpen(true) }} style={{ color: '#0a66c2', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>Add your first card →</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                {cards.map(card => (
                  <MetricCard key={card.id} label={card.label} value={computeCardValue(card, byStatus, totalLeads)} sub={computeCardSub(card, byStatus, totalLeads)} color={card.color} onEdit={() => { setModalCard(card); setModalOpen(true) }} />
                ))}
              </div>
            )}
          </div>

          {/* ── Stage distribution ───────────────────────────────────── */}
          <div className="rounded-xl p-6" style={{ ...cardStyle, marginBottom: 24 }}>
            <h3 style={{ ...primaryText, fontWeight: 600, fontSize: '0.9rem', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pipeline by Stage</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {allStatuses.map(stage => {
                const count = byStatus[stage] || 0
                const barWidth = totalLeads > 0 ? Math.max((count / totalLeads) * 100, 2) : 2
                return (
                  <div key={stage}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.75rem' }}>
                      <span style={{ color: '#c5c1b9', fontWeight: 500 }}>{stage}</span>
                      <span style={mutedText}>{count}</span>
                    </div>
                    <div style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barWidth}%`, backgroundColor: '#0a66c2', borderRadius: 999, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Team Performance (admin only) ─────────────────────────── */}
          {!specialistId && bySpecialist.length > 0 && (
            <div className="rounded-xl p-6" style={{ ...cardStyle, marginBottom: 24 }}>
              <h3 style={{ ...primaryText, fontWeight: 600, fontSize: '0.9rem', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Team Performance</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      {['Specialist', 'Total Leads', 'Connected', 'Closed'].map(col => (
                        <th key={col} style={{ ...mutedText, textAlign: col === 'Specialist' ? 'left' : 'right', padding: '6px 12px', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bySpecialist.map((sp, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ ...primaryText, padding: '8px 12px' }}>{sp.name || '—'}</td>
                        <td style={{ ...mutedText, padding: '8px 12px', textAlign: 'right' }}>{sp.total || 0}</td>
                        <td style={{ ...mutedText, padding: '8px 12px', textAlign: 'right' }}>{sp.connected || 0}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#22c55e', fontWeight: 600 }}>{sp.closed || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Daily Activity ────────────────────────────────────────── */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <h3 style={{ color: '#c5c1b9', fontWeight: 700, fontSize: '1rem', margin: 0 }}>Daily Activity</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {ACTIVITY_DATE_RANGE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setActDateRange(opt.value)}
                    style={{
                      padding: '4px 12px', borderRadius: 999,
                      border: '1px solid rgba(255,255,255,0.12)',
                      fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer',
                      transition: 'all 0.15s',
                      backgroundColor: actDateRange === opt.value ? '#0a66c2' : 'transparent',
                      color: actDateRange === opt.value ? '#ffffff' : '#8a8680',
                    }}
                  >{opt.label}</button>
                ))}
                {actDateRange === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="date" value={actCustomFrom} onChange={e => setActCustomFrom(e.target.value)}
                      style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#c5c1b9', padding: '3px 8px', fontSize: '0.78rem' }} />
                    <span style={{ color: '#8a8680' }}>–</span>
                    <input type="date" value={actCustomTo} onChange={e => setActCustomTo(e.target.value)}
                      style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#c5c1b9', padding: '3px 8px', fontSize: '0.78rem' }} />
                  </div>
                )}
              </div>
            </div>

            {actLoading ? <Spinner /> : activity && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'Leads Collected',  value: activity.new_leads_total, color: '#22c55e' },
                    { label: 'Stage Movements',  value: activity.stage_moves_by_stage.reduce((s, r) => s + r.moves_count, 0), color: '#0a66c2' },
                    { label: 'Leads Worked On',  value: activity.stage_moves_by_stage.reduce((s, r) => s + r.leads_count, 0), color: '#f59e0b' },
                    { label: 'Comments',         value: activity.engagement_totals?.comments || 0, color: '#a855f7' },
                    { label: 'Likes',            value: activity.engagement_totals?.likes || 0, color: '#ec4899' },
                    { label: 'DMs / Follow-ups', value: activity.followups_sent_total || 0, color: '#14b8a6' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl p-5" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '12px 12px 0 0', backgroundColor: color, opacity: 0.7 }} />
                      <p style={{ color: '#8a8680', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600, paddingTop: 4 }}>{label}</p>
                      <p style={{ color: '#ffffff', fontSize: '1.875rem', fontWeight: 700, lineHeight: 1 }}>{value}</p>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                  {/* Stage movement breakdown — shows Connection Requests Sent, Follow-ups, etc. */}
                  <div className="rounded-xl p-6" style={cardStyle}>
                    <h4 style={{ ...primaryText, fontWeight: 600, fontSize: '0.85rem', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stage Movements</h4>
                    {activity.stage_moves_by_stage.length === 0 ? (
                      <p style={{ ...mutedText, fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>No stage movements in this period</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px', gap: 8, padding: '4px 8px', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#8a8680', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 4 }}>
                          <span>Stage</span>
                          <span style={{ textAlign: 'right' }}>Leads</span>
                          <span style={{ textAlign: 'right' }}>Moves</span>
                        </div>
                        {activity.stage_moves_by_stage.map(row => (
                          <div key={row.stage} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px', gap: 8, padding: '6px 8px', borderRadius: 6, fontSize: '0.82rem' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <span style={{ color: '#c5c1b9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.stage}</span>
                            <span
                              onClick={() => openActivityLeads(
                                `Moved to "${row.stage}"`,
                                `${row.leads_count} lead${row.leads_count !== 1 ? 's' : ''} — distinct`,
                                { filter_type: 'stage_moves', stage: row.stage, distinct_leads: '1' }
                              )}
                              style={{ color: '#8a8680', textAlign: 'right', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}
                              title="Click to see leads"
                            >{row.leads_count}</span>
                            <span
                              onClick={() => openActivityLeads(
                                `All moves to "${row.stage}"`,
                                `${row.moves_count} move event${row.moves_count !== 1 ? 's' : ''}`,
                                { filter_type: 'stage_moves', stage: row.stage }
                              )}
                              style={{ color: '#0a66c2', fontWeight: 600, textAlign: 'right', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}
                              title="Click to see all move events"
                            >{row.moves_count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Team activity — how many leads each specialist actually worked with */}
                  <div className="rounded-xl p-6" style={cardStyle}>
                    <h4 style={{ ...primaryText, fontWeight: 600, fontSize: '0.85rem', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Team Activity</h4>
                    {activity.activity_by_specialist.length === 0 ? (
                      <p style={{ ...mutedText, fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>No activity in this period</p>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 520 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 55px 60px 55px 55px 65px 55px', gap: 8, padding: '4px 8px', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#8a8680', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 4 }}>
                          <span>Specialist</span>
                          <span style={{ textAlign: 'right' }}>New</span>
                          <span style={{ textAlign: 'right' }}>Worked</span>
                          <span style={{ textAlign: 'right' }}>Moves</span>
                          <span style={{ textAlign: 'right' }}>Likes</span>
                          <span style={{ textAlign: 'right' }}>Comments</span>
                          <span style={{ textAlign: 'right' }}>DMs</span>
                        </div>
                        {activity.activity_by_specialist.map(sp => (
                          <div key={sp.name} style={{ display: 'grid', gridTemplateColumns: '1fr 55px 60px 55px 55px 65px 55px', gap: 8, padding: '6px 8px', borderRadius: 6, fontSize: '0.82rem' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <span style={{ color: '#c5c1b9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sp.name}</span>
                            <span
                              onClick={() => sp.new_leads > 0 && openActivityLeads(
                                `New leads — ${sp.name}`,
                                `${sp.new_leads} lead${sp.new_leads !== 1 ? 's' : ''} created`,
                                { filter_type: 'new_leads', specialist_name: sp.name }
                              )}
                              style={{ color: '#22c55e', fontWeight: 600, textAlign: 'right', cursor: sp.new_leads > 0 ? 'pointer' : 'default', textDecoration: sp.new_leads > 0 ? 'underline dotted' : 'none', textUnderlineOffset: 3 }}
                              title={sp.new_leads > 0 ? 'Click to see new leads' : undefined}
                            >{sp.new_leads || 0}</span>
                            <span
                              onClick={() => sp.leads_worked > 0 && openActivityLeads(
                                `Leads worked on — ${sp.name}`,
                                `${sp.leads_worked} distinct lead${sp.leads_worked !== 1 ? 's' : ''}`,
                                { filter_type: 'stage_moves', specialist_name: sp.name, distinct_leads: '1' }
                              )}
                              style={{ color: '#f59e0b', fontWeight: 500, textAlign: 'right', cursor: sp.leads_worked > 0 ? 'pointer' : 'default', textDecoration: sp.leads_worked > 0 ? 'underline dotted' : 'none', textUnderlineOffset: 3 }}
                              title={sp.leads_worked > 0 ? 'Click to see leads worked on' : undefined}
                            >{sp.leads_worked || 0}</span>
                            <span
                              onClick={() => sp.stage_moves > 0 && openActivityLeads(
                                `All stage moves — ${sp.name}`,
                                `${sp.stage_moves} move event${sp.stage_moves !== 1 ? 's' : ''}`,
                                { filter_type: 'stage_moves', specialist_name: sp.name }
                              )}
                              style={{ color: '#0a66c2', fontWeight: 600, textAlign: 'right', cursor: sp.stage_moves > 0 ? 'pointer' : 'default', textDecoration: sp.stage_moves > 0 ? 'underline dotted' : 'none', textUnderlineOffset: 3 }}
                              title={sp.stage_moves > 0 ? 'Click to see all move events' : undefined}
                            >{sp.stage_moves || 0}</span>
                            <span
                              onClick={() => sp.likes > 0 && openActivityLeads(
                                `Likes — ${sp.name}`,
                                `${sp.likes} like${sp.likes !== 1 ? 's' : ''} logged`,
                                { filter_type: 'engagement_likes', specialist_name: sp.name }
                              )}
                              style={{ color: '#ec4899', fontWeight: 500, textAlign: 'right', cursor: sp.likes > 0 ? 'pointer' : 'default', textDecoration: sp.likes > 0 ? 'underline dotted' : 'none', textUnderlineOffset: 3 }}
                              title={sp.likes > 0 ? 'Click to see likes' : undefined}
                            >{sp.likes || 0}</span>
                            <span
                              onClick={() => sp.comments > 0 && openActivityLeads(
                                `Comments — ${sp.name}`,
                                `${sp.comments} comment${sp.comments !== 1 ? 's' : ''} logged`,
                                { filter_type: 'engagement_comments', specialist_name: sp.name }
                              )}
                              style={{ color: '#a855f7', fontWeight: 500, textAlign: 'right', cursor: sp.comments > 0 ? 'pointer' : 'default', textDecoration: sp.comments > 0 ? 'underline dotted' : 'none', textUnderlineOffset: 3 }}
                              title={sp.comments > 0 ? 'Click to see comments' : undefined}
                            >{sp.comments || 0}</span>
                            <span
                              onClick={() => sp.followups_sent > 0 && openActivityLeads(
                                `DMs / Follow-ups — ${sp.name}`,
                                `${sp.followups_sent} message${sp.followups_sent !== 1 ? 's' : ''} sent`,
                                { filter_type: 'followups', specialist_name: sp.name }
                              )}
                              style={{ color: '#14b8a6', fontWeight: 600, textAlign: 'right', cursor: sp.followups_sent > 0 ? 'pointer' : 'default', textDecoration: sp.followups_sent > 0 ? 'underline dotted' : 'none', textUnderlineOffset: 3 }}
                              title={sp.followups_sent > 0 ? 'Click to see DMs / follow-ups sent' : undefined}
                            >{sp.followups_sent || 0}</span>
                          </div>
                        ))}
                      </div>
                      </div>
                    )}
                  </div>

                </div>
              </>
            )}
          </div>

          {/* ── Due for Engagement ────────────────────────────────────── */}
          <div className="rounded-xl p-6" style={{ ...cardStyle, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <h3 style={{ ...primaryText, fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Due for Engagement</h3>
              {staleLeads.length > 0 && (
                <span style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(245,158,11,0.3)' }}>{staleLeads.length}</span>
              )}
            </div>
            {staleLeads.length === 0 ? (
              <p style={{ ...mutedText, fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>Everyone's engaged recently</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr', gap: 12, padding: '4px 10px', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#8a8680', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 4 }}>
                  <span>Lead</span><span>Stage</span><span>Specialist</span><span style={{ textAlign: 'right' }}>Last Engaged</span>
                </div>
                {staleLeads.map(lead => {
                  const lastDate = lead.last_engagement_date
                  const days = daysAgo(lastDate)
                  return (
                    <div key={lead.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr', gap: 12, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      onClick={() => onLeadClick && onLeadClick(lead.id)}
                    >
                      <span style={{ color: '#0a66c2', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.lead_name}</span>
                      <span style={{ ...mutedText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.status}</span>
                      <span style={{ ...mutedText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.specialist_name || '—'}</span>
                      <span style={{ textAlign: 'right', fontWeight: 600, color: days == null ? '#ef4444' : days >= 21 ? '#ef4444' : '#f59e0b', whiteSpace: 'nowrap' }}>
                        {lastDate ? `${days}d ago` : 'Never'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {actDrawer && (
        <ActivityLeadsDrawer
          title={actDrawer.title}
          subtitle={actDrawer.subtitle}
          leads={actLeads}
          loading={actLeadsLoading}
          onClose={() => setActDrawer(null)}
          onLeadClick={onLeadClick}
        />
      )}

      {modalOpen && (
        <CardModal
          card={modalCard}
          allStatuses={allStatuses}
          onClose={() => { setModalOpen(false); setModalCard(null) }}
          onSave={handleCardSave}
          onDelete={modalCard?.id ? async () => { await handleCardDelete(modalCard.id); setModalOpen(false); setModalCard(null) } : undefined}
        />
      )}
    </div>
  )
}
