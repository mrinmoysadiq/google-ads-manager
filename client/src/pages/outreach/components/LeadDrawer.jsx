import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { getUser, isAdmin } from '../../../utils/auth'
import {
  getLead,
  updateLead,
  deleteLead,
  upsertTouchpoint,
  createLead,
  createLeadResponse,
  getFields,
  updateCustomField,
} from '../../../utils/outreachApi'
import TouchpointQuickModal from './TouchpointQuickModal'
import ResponseQuickModal from './ResponseQuickModal'
import { fmtDate } from '../../../utils/dates'
import LeadFields, { isEmptyFieldValue } from './LeadFields'
import { touchpointNumberForMove, needsResponse } from '../stageTypes'
import { leadTitle } from '../leadDisplay'
import DrawerHeader from './drawer/DrawerHeader'
import QuickLog, { lastLoggedTouchpoint } from './drawer/QuickLog'
import ActivityTimeline from './drawer/ActivityTimeline'
import NewLeadForm from './drawer/NewLeadForm'

const LS_DETAILS_OPEN = 'outreach_drawer_details_open'


function FieldsLoadError({ onRetry }) {
  return (
    <div style={{ color: '#ef4444', fontSize: '13px' }}>
      Couldn't load the lead form.{' '}
      <button type="button" onClick={onRetry} style={{ color: '#575ECF', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LeadDrawer({
  leadId: initialLeadId,
  defaultSpecialistId,
  onClose,
  navIds = [],
  onNavigate,
  onSaved,
  onDeleted,
  onLeadUpdated,
  specialists = [],
  industries = [],
  sources = [],
  stages = [],
  maxTouchpoints = 5,
}) {
  const [visible, setVisible] = useState(false)
  const [mode, setMode] = useState(initialLeadId === null ? 'create' : 'edit')
  const [leadId, setLeadId] = useState(initialLeadId)
  const [lead, setLead] = useState(null)
  const [loading, setLoading] = useState(initialLeadId !== null)
  const [switching, setSwitching] = useState(false) // loading the next/previous lead over the current one
  const draftDirty = useRef(false) // the quick log has unsaved text
  // Lead details form: collapsed by default, remembered per browser
  const [detailsOpen, setDetailsOpen] = useState(() => {
    try { return localStorage.getItem(LS_DETAILS_OPEN) === '1' } catch { return false }
  })
  const detailsRef = useRef(null)
  const scrollRef = useRef(null)
  const [saved, setSaved] = useState({})
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [tpQuickModal, setTpQuickModal] = useState({ open: false, number: null, status: null, modalKey: 0 })
  const [responseModal, setResponseModal] = useState({ open: false, status: null, modalKey: 0 })
  // Form layout (built-in + custom fields, in admin-configured order); null until loaded
  const [fields, setFields] = useState(null)
  const [fieldsError, setFieldsError] = useState(false)

  // Create form state: built-in values keyed like the lead columns, custom values nested
  // New leads go to the specialist being viewed, or else to your own specialist profile
  const [createForm, setCreateForm] = useState(() => {
    const me = getUser()
    const own = !defaultSpecialistId && me && specialists.find(s => s.name.toLowerCase() === (me.name || '').toLowerCase())
    const initial = defaultSpecialistId || own?.id
    return { specialist_ids: initial ? [initial] : [], custom_fields: {} }
  })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [createKey, setCreateKey] = useState(0) // remounts the form for "create & add another"

  const commitCreateField = (field, value) => {
    setCreateError(null)
    if (field.is_builtin) {
      setCreateForm(v => ({ ...v, [field.field_key]: value }))
    } else {
      setCreateForm(v => ({ ...v, custom_fields: { ...v.custom_fields, [field.field_key]: value } }))
    }
  }

  const loadFields = () => {
    setFieldsError(false)
    getFields().then(setFields).catch(() => setFieldsError(true))
  }
  useEffect(loadFields, [])

  // Field definitions are shared by everyone, so only admins can change them
  const canManageFields = isAdmin()
  const resizeFieldHeight = (field, height_px) => {
    setFields(prev => prev.map(f => f.id === field.id ? { ...f, height_px } : f))
    if (!canManageFields) return
    updateCustomField(field.id, { height_px }).catch(() => toast.error('Failed to save field size'))
  }

  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  // The parent switches leads (next / previous) without reopening the drawer
  useEffect(() => {
    if (mode === 'edit' && initialLeadId && initialLeadId !== leadId) setLeadId(initialLeadId)
  }, [initialLeadId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch lead in edit mode — keep the current one on screen while the next loads
  useEffect(() => {
    if (mode !== 'edit' || !leadId) return
    let cancelled = false
    if (lead) setSwitching(true)
    else setLoading(true)
    getLead(leadId)
      .then(data => { if (!cancelled) setLead(data) })
      .catch(() => { if (!cancelled) toast.error('Failed to load lead') })
      .finally(() => { if (!cancelled) { setLoading(false); setSwitching(false) } })
    return () => { cancelled = true }
  }, [leadId, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Each lead opens at the top (quick log first) — matters when stepping through leads
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0 }, [lead?.id])

  // ── Helpers ──────────────────────────────────────────────────────────────────

  // Refresh the timeline (touchpoints, replies, notes, stage moves) without a spinner
  const reloadLead = useCallback(() => {
    if (!leadId) return
    getLead(leadId).then(setLead).catch(() => {})
  }, [leadId])

  // Something was logged: refresh this lead and the pipeline behind the drawer
  const handleActivity = () => {
    reloadLead()
    if (onSaved) onSaved()
  }

  const toggleDetails = (open = !detailsOpen) => {
    setDetailsOpen(open)
    try { localStorage.setItem(LS_DETAILS_OPEN, open ? '1' : '0') } catch { /* private mode */ }
  }

  // Open the details; with a field key, jump to that field and put the cursor in it
  const editDetails = (fieldKey) => {
    toggleDetails(true)
    setTimeout(() => {
      const field = typeof fieldKey === 'string' && detailsRef.current?.querySelector(`[data-field-key="${fieldKey}"]`)
      if (field) {
        field.scrollIntoView({ behavior: 'smooth', block: 'center' })
        field.querySelector('input, textarea')?.focus({ preventScroll: true })
      } else {
        detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 80)
  }

  const markSaved = (field) => {
    setSaved(v => ({ ...v, [field]: true }))
    setTimeout(() => setSaved(v => ({ ...v, [field]: false })), 1500)
  }

  // Unsaved text in the quick log is easy to lose with one stray click
  const confirmDiscard = () => !draftDirty.current || window.confirm('You have an unsaved log entry. Discard it?')

  const handleClose = () => {
    if (!confirmDiscard()) return
    setVisible(false)
    setTimeout(onClose, 280)
  }

  // ── Next / previous lead (in the order the board or table shows them) ────────
  const navIndex = leadId ? navIds.indexOf(leadId) : -1
  const prevId = navIndex > 0 ? navIds[navIndex - 1] : null
  const nextId = navIndex !== -1 && navIndex < navIds.length - 1 ? navIds[navIndex + 1] : null
  const goTo = (id, { force = false } = {}) => {
    if (!id || !onNavigate) return
    if (!force && !confirmDiscard()) return
    draftDirty.current = false
    onNavigate(id)
  }

  // J / K step through leads, Esc closes — not while typing or with a menu or dialog open
  const keys = useRef({})
  keys.current = { prevId, nextId, goTo, handleClose }
  useEffect(() => {
    if (mode !== 'edit') return
    const onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
      const el = e.target
      if (el.closest?.('input, textarea, select, [contenteditable="true"]')) return
      if (document.querySelector('[role="menu"], [role="dialog"]')) return
      const k = keys.current
      if (e.key === 'j' || e.key === 'J') { e.preventDefault(); k.goTo(k.nextId) }
      else if (e.key === 'k' || e.key === 'K') { e.preventDefault(); k.goTo(k.prevId) }
      else if (e.key === 'Escape') k.handleClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mode])

  // ── Field save (edit mode) ───────────────────────────────────────────────────

  const saveField = async (field, value) => {
    try {
      const updated = await updateLead(leadId, { [field]: value })
      setLead(prev => ({ ...prev, ...updated }))
      markSaved(field)
      if (onLeadUpdated) onLeadUpdated(updated)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save', { duration: 6000 })
      if (err.response?.status === 409) {
        // Revert the input to the last saved value so the rejected duplicate doesn't linger on screen
        getLead(leadId).then(setLead).catch(() => {})
      }
    }
  }

  const saveCustomField = async (fieldKey, value) => {
    try {
      const updated = await updateLead(leadId, { custom_fields: { [fieldKey]: value } })
      setLead(prev => ({
        ...prev,
        ...updated,
        custom_fields: { ...prev.custom_fields, ...(updated.custom_fields || {}) },
      }))
      markSaved(`custom_${fieldKey}`)
      if (onLeadUpdated) onLeadUpdated(updated)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save')
    }
  }

  const saveSpecialists = (ids) => {
    const names = ids.map(id => specialists.find(s => s.id === id)?.name).filter(Boolean)
    setLead(prev => ({
      ...prev,
      specialists: ids.map((id, i) => ({ id, name: names[i] })),
      specialist_id: ids[0] || null,
      specialist_name: names[0] || null,
      specialist_names: names.join(', '),
    }))
    updateLead(leadId, { specialist_ids: ids, performed_by: getUser()?.name || null })
      .then(updated => {
        setLead(prev => ({ ...prev, ...updated }))
        markSaved('specialist_ids')
        if (onLeadUpdated) onLeadUpdated(updated)
      })
      .catch(err => toast.error(err.response?.data?.error || 'Failed to save specialists'))
  }

  const commitEditField = (field, value) => {
    if (!field.is_builtin) return saveCustomField(field.field_key, value)
    if (field.field_key === 'specialist_ids') return saveSpecialists(value)
    return saveField(field.field_key, value === '' ? null : value)
  }

  // ── Status change ────────────────────────────────────────────────────────────

  const handleStatusChange = async (newStatus) => {
    const tpNum = touchpointNumberForMove(stages, newStatus, lastLoggedTouchpoint(lead))
    if (tpNum !== null) {
      setTpQuickModal({ open: true, number: tpNum, status: newStatus, modalKey: Date.now() })
      return
    }
    if (needsResponse(stages, newStatus)) {
      setResponseModal({ open: true, status: newStatus, modalKey: Date.now() })
      return
    }
    try {
      const updated = await updateLead(leadId, { status: newStatus, performed_by: getUser()?.name || null })
      setLead(prev => ({ ...prev, ...updated }))
      toast.success(`Moved to ${newStatus}`)
      reloadLead()
      if (onLeadUpdated) onLeadUpdated(updated)
    } catch {
      toast.error('Failed to update status')
    }
  }

  const handleResponseModalSave = async (fields) => {
    const { status } = responseModal
    const created = await createLeadResponse(leadId, fields)
    const updated = await updateLead(leadId, { status, performed_by: getUser()?.name || null })
    setLead(prev => ({
      ...prev,
      ...updated,
      responses: [created, ...(prev.responses || [])],
    }))
    if (onLeadUpdated) onLeadUpdated(updated)
    reloadLead()
    setResponseModal({ open: false, status: null, modalKey: 0 })
    toast.success(`Response logged — moved to ${status}`)
  }

  const handleTpQuickModalSave = async (fields) => {
    const { number, status } = tpQuickModal
    const { next_followup_date, ...touchpoint } = fields
    const savedTp = await upsertTouchpoint(leadId, number, touchpoint)
    const updated = await updateLead(leadId, { status, next_followup_date, performed_by: getUser()?.name || null })
    setLead(prev => ({
      ...prev,
      ...updated,
      touchpoints: [
        ...(prev.touchpoints || []).filter(t => t.touchpoint_number !== number),
        savedTp,
      ],
    }))
    handleActivity()
    setTpQuickModal({ open: false, number: null, status: null, modalKey: 0 })
    toast.success(`Touchpoint ${number} saved — moved to ${status}`)
  }

  // ── Create lead ───────────────────────────────────────────────────────────────

  // andAnother: create, then start a fresh form (keeping source and specialists) for the next lead
  const handleCreate = async (andAnother = false) => {
    setCreateError(null)
    const identity = ['company_name', 'contact_name', 'email', 'phone'].some(k => !isEmptyFieldValue(createForm[k]))
    if (!identity) {
      setCreateError('Add at least a company, contact name, email or phone')
      return
    }
    for (const field of fields || []) {
      const value = field.is_builtin ? createForm[field.field_key] : createForm.custom_fields[field.field_key]
      if (field.required && isEmptyFieldValue(value)) {
        toast.error(`${field.label} is required`)
        return
      }
    }
    setCreating(true)
    try {
      const payload = { performed_by: getUser()?.name || undefined }
      for (const field of fields || []) {
        if (!field.is_builtin) continue
        const value = createForm[field.field_key]
        if (!isEmptyFieldValue(value)) payload[field.field_key] = typeof value === 'string' ? value.trim() : value
      }
      const custom = Object.fromEntries(Object.entries(createForm.custom_fields).filter(([, v]) => !isEmptyFieldValue(v)))
      if (Object.keys(custom).length > 0) payload.custom_fields = custom
      const newLead = await createLead(payload)
      onSaved()
      if (andAnother) {
        toast.success(`${leadTitle(newLead)} created — add the next one`)
        setCreateForm(prev => ({
          specialist_ids: prev.specialist_ids,
          source_id: prev.source_id,
          custom_fields: {},
        }))
        setCreateKey(k => k + 1)
        return
      }
      toast.success('Lead created')
      setLeadId(newLead.id)
      setMode('edit')
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to create lead'
      setCreateError(msg)
      toast.error(msg, { duration: 6000 })
    } finally {
      setCreating(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteLead(leadId)
      toast.success('Lead moved to trash')
      onDeleted(leadId)
      handleClose()
    } catch {
      toast.error('Failed to delete lead')
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  // ── Copy Summary ──────────────────────────────────────────────────────────────

  const handleCopySummary = () => {
    if (!lead) return
    const tp = [...(lead.touchpoints || [])].filter(t => t.date).sort((a, b) => b.touchpoint_number - a.touchpoint_number)[0]
    const lines = [
      `Lead: ${leadTitle(lead)}`,
      lead.company_name && lead.contact_name ? `Contact: ${lead.contact_name}` : null,
      `Status: ${lead.status || '—'}`,
      lead.website ? `Website: ${lead.website}` : null,
      lead.email ? `Email: ${lead.email}` : null,
      lead.phone ? `Phone: ${lead.phone}` : null,
      lead.next_followup_date ? `Next follow-up: ${fmtDate(lead.next_followup_date)}` : null,
      tp ? `Latest touchpoint: TP${tp.touchpoint_number} on ${fmtDate(tp.date)} via ${tp.channel || '?'}` : null,
      tp?.message_body ? `Message: ${tp.message_body.slice(0, 120)}` : null,
      tp?.notes ? `Note: ${tp.notes.slice(0, 120)}` : null,
    ].filter(Boolean).join('\n')

    navigator.clipboard.writeText(lines)
      .then(() => toast.success('Summary copied'))
      .catch(() => toast.error('Failed to copy'))
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 50,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.28s ease',
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: '620px',
          maxWidth: '100vw',
          backgroundColor: '#1b1b1b',
          zIndex: 51,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
        }}
      >
        {/* ── CREATE MODE ─────────────────────────────────────────────────────── */}
        {mode === 'create' && (
          <>
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h2 style={{ color: '#ecebe8', fontSize: '18px', fontWeight: 700, margin: 0 }}>New lead</h2>
              <button onClick={handleClose} style={{ background: 'none', border: 'none', color: '#8a8680', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            {fieldsError ? (
              <div style={{ padding: '24px' }}><FieldsLoadError onRetry={loadFields} /></div>
            ) : !fields ? (
              <span style={{ color: '#8a8680', fontSize: '13px', padding: '24px' }}>Loading form…</span>
            ) : (
              <NewLeadForm
                key={createKey}
                fields={fields}
                values={createForm}
                customValues={createForm.custom_fields}
                onCommit={commitCreateField}
                specialists={specialists}
                industries={industries}
                sources={sources}
                canManage={canManageFields}
                onResizeHeight={resizeFieldHeight}
                creating={creating}
                error={createError}
                onSubmit={handleCreate}
                onCancel={handleClose}
              />
            )}
          </>
        )}

        {/* ── EDIT MODE ───────────────────────────────────────────────────────── */}
        {mode === 'edit' && (
          <>
            {loading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  width: '36px', height: '36px',
                  border: '3px solid rgba(255,255,255,0.08)',
                  borderTopColor: '#575ECF',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }} />
                <span style={{ color: '#8a8680', fontSize: '13px' }}>Loading…</span>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : lead ? (
              <>
                <DrawerHeader
                  lead={lead}
                  stages={stages}
                  maxTouchpoints={maxTouchpoints}
                  nav={navIndex !== -1 && navIds.length > 1 ? {
                    position: navIndex + 1,
                    total: navIds.length,
                    onPrev: prevId ? () => goTo(prevId) : null,
                    onNext: nextId ? () => goTo(nextId) : null,
                  } : null}
                  switching={switching}
                  onSaveField={saveField}
                  onStatusChange={handleStatusChange}
                  onFollowUp={date => saveField('next_followup_date', date)}
                  onEditDetails={editDetails}
                  onCopySummary={handleCopySummary}
                  onDelete={() => setShowDeleteModal(true)}
                  onClose={handleClose}
                />

                <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <QuickLog
                    lead={lead}
                    stages={stages}
                    slots={maxTouchpoints}
                    onLogged={handleActivity}
                    onDirtyChange={dirty => { draftDirty.current = dirty }}
                    nextLeadId={nextId}
                    onNext={id => goTo(id, { force: true })}
                  />

                  <ActivityTimeline lead={lead} stages={stages} onChanged={handleActivity} />

                  {/* ── Lead details (collapsible) ─────────────────────────── */}
                  <section ref={detailsRef} aria-label="Lead details" style={{ scrollMarginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => toggleDetails()}
                      aria-expanded={detailsOpen}
                      className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-white/[0.04]"
                      style={{ border: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#1e1e1e' }}
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#8a8680' }}>Lead details</span>
                      <span className="text-xs" style={{ color: '#8a8680' }}>
                        {detailsOpen ? 'Hide ▲' : 'Edit contact info & fields ▼'}
                      </span>
                    </button>
                    {detailsOpen && (
                      <div style={{ paddingTop: '16px' }}>
                        {fieldsError ? (
                          <FieldsLoadError onRetry={loadFields} />
                        ) : !fields ? (
                          <span style={{ color: '#8a8680', fontSize: '13px' }}>Loading fields…</span>
                        ) : (
                          <LeadFields
                            fields={fields}
                            values={{ ...lead, specialist_ids: (lead.specialists || []).map(sp => sp.id) }}
                            customValues={lead.custom_fields}
                            onCommit={commitEditField}
                            saved={saved}
                            specialists={specialists}
                            industries={industries}
                            sources={sources}
                            canManage={canManageFields}
                            onResizeHeight={resizeFieldHeight}
                            exclude={['next_followup_date']}
                          />
                        )}
                        <p style={{ color: '#555', fontSize: '11px', fontStyle: 'italic', marginTop: '12px' }}>Fields save automatically. The follow-up date is set from the chip at the top.</p>
                      </div>
                    )}
                  </section>
                </div>
              </>
            ) : (
              /* Error state */
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '32px' }}>⚠️</span>
                <p style={{ color: '#8a8680', fontSize: '14px', textAlign: 'center' }}>Failed to load lead data.</p>
                <button
                  onClick={() => { setLoading(true); getLead(leadId).then(d => { setLead(d); setLoading(false) }).catch(() => setLoading(false)) }}
                  style={{ color: '#575ECF', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}
                >
                  Retry
                </button>
                <button onClick={handleClose} style={{ color: '#8a8680', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>
                  Close
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Touchpoint Quick Modal (from status badge) ───────────────────────── */}
      {tpQuickModal.open && (
        <TouchpointQuickModal
          key={tpQuickModal.modalKey}
          touchpointNumber={tpQuickModal.number}
          initialData={lead ? (lead.touchpoints || []).find(t => t.touchpoint_number === tpQuickModal.number) : null}
          onSave={handleTpQuickModalSave}
          onClose={() => setTpQuickModal({ open: false, number: null, status: null, modalKey: 0 })}
        />
      )}

      {/* ── Response Quick Modal (for Interested / Not Interested stages) ──────── */}
      {responseModal.open && (
        <ResponseQuickModal
          key={responseModal.modalKey}
          newStatus={responseModal.status}
          onSave={handleResponseModalSave}
          onClose={() => setResponseModal({ open: false, status: null, modalKey: 0 })}
        />
      )}

      {/* ── Delete Confirmation Modal ─────────────────────────────────────────── */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            zIndex: 60,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.7)',
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowDeleteModal(false) }}
        >
          <div style={{
            backgroundColor: '#242424',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '28px 32px',
            width: '360px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <h3 style={{ color: '#c5c1b9', fontSize: '16px', fontWeight: 600, margin: '0 0 10px' }}>Move lead to trash?</h3>
            <p style={{ color: '#8a8680', fontSize: '13px', margin: '0 0 24px', lineHeight: 1.5 }}>
              <strong style={{ color: '#c5c1b9' }}>{leadTitle(lead)}</strong> will be removed from the pipeline. An admin can restore it from the trash.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  color: '#8a8680',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '7px',
                  padding: '8px 20px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '7px',
                  padding: '8px 20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? 'Moving…' : 'Move to trash'}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}
