import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import Select from 'react-select'
import {
  getLead,
  updateLead,
  deleteLead,
  upsertTouchpoint,
  createLead,
  createLeadResponse,
  deleteLeadResponse,
} from '../../../utils/outreachApi'
import TouchpointQuickModal from './TouchpointQuickModal'
import ResponseQuickModal from './ResponseQuickModal'

function getTouchpointNumber(status) {
  const m = status && status.match(/^Touchpoint (\d+)$/)
  return m ? parseInt(m[1]) : null
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  'New Lead':                        { bg: 'rgba(87,94,207,0.15)',  color: '#575ECF' },
  'Touchpoint 1':                    { bg: 'rgba(20,184,166,0.15)', color: '#14b8a6' },
  'Touchpoint 2':                    { bg: 'rgba(20,184,166,0.15)', color: '#14b8a6' },
  'Touchpoint 3':                    { bg: 'rgba(20,184,166,0.15)', color: '#14b8a6' },
  'Touchpoint 4':                    { bg: 'rgba(20,184,166,0.15)', color: '#14b8a6' },
  'Touchpoint 5':                    { bg: 'rgba(20,184,166,0.15)', color: '#14b8a6' },
  'Contacted':                       { bg: 'rgba(138,134,128,0.15)', color: '#8a8680' },
  'Responded':                       { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6' },
  'Interested':                      { bg: 'rgba(168,85,247,0.15)',  color: '#a855f7' },
  'Appointment Booked':              { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
  'No Show':                         { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
  'Meeting Done - Not Interested':   { bg: 'rgba(107,114,128,0.15)', color: '#6b7280' },
  'Started Trial':                   { bg: 'rgba(6,182,212,0.15)',   color: '#06b6d4' },
  'Closed / Booked as Client':       { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e' },
  'Disqualified / Dead':             { bg: 'rgba(55,65,81,0.2)',     color: '#6b7280' },
}

const CHANNELS = [
  'LinkedIn', 'Email', 'WhatsApp', 'Facebook',
  'Instagram', 'SMS', 'Website Form', 'Other',
]

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#575ECF] transition-colors'

const selectStyles = {
  control: (base, { isFocused }) => ({
    ...base,
    backgroundColor: '#2a2a2a',
    borderColor: isFocused ? '#575ECF' : 'rgba(255,255,255,0.1)',
    boxShadow: 'none',
    minHeight: '36px',
    fontSize: '13px',
    '&:hover': { borderColor: isFocused ? '#575ECF' : 'rgba(255,255,255,0.2)' },
  }),
  menu: (base) => ({ ...base, backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)', zIndex: 100 }),
  menuList: (base) => ({ ...base, padding: '4px' }),
  option: (base, { isFocused, isSelected }) => ({
    ...base,
    backgroundColor: isSelected ? '#575ECF' : isFocused ? 'rgba(87,94,207,0.15)' : 'transparent',
    color: '#c5c1b9',
    fontSize: '13px',
    borderRadius: '6px',
    cursor: 'pointer',
  }),
  singleValue: (base) => ({ ...base, color: '#c5c1b9' }),
  placeholder: (base) => ({ ...base, color: '#8a8680' }),
  input: (base) => ({ ...base, color: '#c5c1b9' }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base) => ({ ...base, color: '#8a8680', padding: '0 8px' }),
  clearIndicator: (base) => ({ ...base, color: '#8a8680' }),
}

// ─── Helper: ImagePasteZone ────────────────────────────────────────────────────

function ImagePasteZone({ value, onChange }) {
  const zoneRef = useRef(null)
  const [focused, setFocused] = useState(false)

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const blob = item.getAsFile()
        const reader = new FileReader()
        reader.onload = (ev) => onChange(ev.target.result)
        reader.readAsDataURL(blob)
        break
      }
    }
  }, [onChange])

  if (value) {
    return (
      <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
        <img
          src={value}
          alt="Source screenshot"
          style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', display: 'block' }}
        />
        <button
          type="button"
          onClick={() => onChange(null)}
          style={{
            position: 'absolute', top: '6px', right: '6px',
            background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none',
            borderRadius: '50%', width: '22px', height: '22px',
            fontSize: '13px', cursor: 'pointer', lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>
      </div>
    )
  }

  return (
    <div
      ref={zoneRef}
      tabIndex={0}
      onPaste={handlePaste}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        border: `1px dashed ${focused ? '#575ECF' : 'rgba(255,255,255,0.15)'}`,
        borderRadius: '8px',
        padding: '20px',
        textAlign: 'center',
        color: focused ? '#8a8680' : '#555',
        fontSize: '12px',
        cursor: 'pointer',
        backgroundColor: focused ? 'rgba(87,94,207,0.05)' : 'rgba(255,255,255,0.02)',
        userSelect: 'none',
        outline: 'none',
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
    >
      <div style={{ fontSize: '20px', marginBottom: '6px', opacity: 0.4 }}>🖼</div>
      <div>{focused ? 'Now press Ctrl+V / ⌘V to paste' : 'Click here, then Ctrl+V / ⌘V to paste screenshot'}</div>
      <div style={{ marginTop: '3px', opacity: 0.6, fontSize: '11px' }}>Click the zone first to focus it</div>
    </div>
  )
}

// ─── Helper: SavedIndicator ────────────────────────────────────────────────────

function SavedIndicator({ show }) {
  if (!show) return null
  return (
    <span style={{ color: '#22c55e', fontSize: '11px', marginLeft: '6px', transition: 'opacity 0.3s' }}>
      Saved ✓
    </span>
  )
}

// ─── Helper: format date ────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// ─── Sub-component: StatusBadge with dropdown ────────────────────────────────

function StatusBadge({ status, onChange, stages = [] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const colors = STATUS_COLORS[status] || { bg: 'rgba(138,134,128,0.15)', color: '#8a8680' }

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          backgroundColor: colors.bg,
          color: colors.color,
          border: `1px solid ${colors.color}33`,
          borderRadius: '20px',
          padding: '3px 10px',
          fontSize: '12px',
          fontWeight: 500,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {status || 'Set status'} ▾
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          zIndex: 200,
          backgroundColor: '#2a2a2a',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '4px',
          minWidth: '240px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {stages.map(s => {
            const c = STATUS_COLORS[s] || { color: '#8a8680' }
            return (
              <button
                key={s}
                onClick={() => { onChange(s); setOpen(false) }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: s === status ? 'rgba(87,94,207,0.15)' : 'transparent',
                  color: c.color || '#c5c1b9',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: s === status ? 600 : 400,
                }}
                onMouseEnter={e => { if (s !== status) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { if (s !== status) e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                {s}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Sub-component: TouchpointSection ────────────────────────────────────────

function TouchpointSection({ leadId, number, initialData, defaultOpen, onStageChange }) {
  const today = new Date().toISOString().slice(0, 10)
  const [open, setOpen] = useState(defaultOpen || false)
  const [fields, setFields] = useState({
    date: initialData?.date || today,
    channel: initialData?.channel || '',
    message_body: initialData?.message_body || '',
    loom_url: initialData?.loom_url || '',
    notes: initialData?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [errors, setErrors] = useState({})

  const hasData = initialData?.date || initialData?.channel || initialData?.message_body
  const channelOptions = CHANNELS.map(c => ({ value: c, label: c }))

  const summary = hasData
    ? [initialData.date && fmtDate(initialData.date), initialData.channel,
       initialData.message_body ? initialData.message_body.slice(0, 40) + (initialData.message_body.length > 40 ? '…' : '') : null]
        .filter(Boolean).join(' · ')
    : null

  const validate = () => {
    const newErrors = {}
    if (!fields.channel) newErrors.channel = true
    if (!fields.message_body.trim()) newErrors.message_body = true
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error('Channel and Message Body are required')
      return false
    }
    setErrors({})
    return true
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await upsertTouchpoint(leadId, number, fields)
      setSavedOk(true)
      toast.success(`Touchpoint ${number} saved`)
      setTimeout(() => setSavedOk(false), 2500)
    } catch {
      toast.error('Failed to save touchpoint')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAndChangeStage = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await upsertTouchpoint(leadId, number, fields)
      setSavedOk(true)
      toast.success(`Touchpoint ${number} saved`)
      setTimeout(() => setSavedOk(false), 2500)
      if (onStageChange) await onStageChange(number)
    } catch {
      toast.error('Failed to save touchpoint')
    } finally {
      setSaving(false)
    }
  }

  const labelStyle = (hasError) => ({
    display: 'block', fontSize: '11px', marginBottom: '4px',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    color: hasError ? '#ef4444' : '#8a8680',
  })

  return (
    <div style={{ border: `1px solid ${open ? 'rgba(87,94,207,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '8px', overflow: 'hidden', marginBottom: '8px' }}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '10px 14px',
          background: open ? 'rgba(87,94,207,0.08)' : 'rgba(255,255,255,0.03)',
          border: 'none', cursor: 'pointer', textAlign: 'left', gap: '8px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ color: '#c5c1b9', fontSize: '13px', fontWeight: 500 }}>
            Touchpoint {number}
          </span>
          {!open && (
            summary
              ? <span style={{ color: '#8a8680', fontSize: '12px', marginLeft: '10px' }}>{summary}</span>
              : <span style={{ color: '#555', fontSize: '12px', marginLeft: '10px', fontStyle: 'italic' }}>Not yet used</span>
          )}
        </div>
        <span style={{ color: '#8a8680', fontSize: '12px', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Body */}
      {open && (
        <div style={{ padding: '14px', backgroundColor: '#1e1e1e', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Date — defaults to today */}
          <div>
            <label style={labelStyle(false)}>Date</label>
            <input
              type="date"
              className={inputClass}
              value={fields.date}
              onChange={e => setFields(v => ({ ...v, date: e.target.value }))}
            />
          </div>

          {/* Channel — mandatory */}
          <div>
            <label style={labelStyle(errors.channel)}>
              Channel <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <Select
              styles={{
                ...selectStyles,
                control: (base, state) => ({
                  ...selectStyles.control(base, state),
                  borderColor: errors.channel ? '#ef4444' : state.isFocused ? '#575ECF' : 'rgba(255,255,255,0.1)',
                }),
              }}
              options={channelOptions}
              value={fields.channel ? { value: fields.channel, label: fields.channel } : null}
              onChange={opt => {
                setFields(v => ({ ...v, channel: opt?.value || '' }))
                if (errors.channel) setErrors(v => ({ ...v, channel: false }))
              }}
              placeholder="Select channel…"
              isClearable
            />
          </div>

          {/* Message Body — mandatory */}
          <div>
            <label style={labelStyle(errors.message_body)}>
              Message Body <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              className={inputClass}
              rows={4}
              value={fields.message_body}
              onChange={e => {
                setFields(v => ({ ...v, message_body: e.target.value }))
                if (errors.message_body && e.target.value.trim()) setErrors(v => ({ ...v, message_body: false }))
              }}
              style={{ resize: 'vertical', borderColor: errors.message_body ? '#ef4444' : undefined }}
              placeholder="Write your outreach message here…"
            />
          </div>

          {/* Loom URL */}
          <div>
            <label style={labelStyle(false)}>Loom URL</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                className={inputClass}
                value={fields.loom_url}
                onChange={e => setFields(v => ({ ...v, loom_url: e.target.value }))}
                placeholder="https://loom.com/share/…"
                style={{ flex: 1 }}
              />
              {fields.loom_url && (
                <a href={fields.loom_url} target="_blank" rel="noopener noreferrer"
                  style={{ backgroundColor: 'rgba(87,94,207,0.15)', color: '#575ECF', border: '1px solid rgba(87,94,207,0.3)', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  ▶ View
                </a>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle(false)}>Notes</label>
            <textarea
              className={inputClass}
              rows={2}
              value={fields.notes}
              onChange={e => setFields(v => ({ ...v, notes: e.target.value }))}
              style={{ resize: 'vertical' }}
              placeholder="Any additional notes…"
            />
          </div>

          {/* Save buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px', flexWrap: 'wrap' }}>
            {onStageChange && (
              <button
                onClick={handleSaveAndChangeStage}
                disabled={saving}
                style={{
                  backgroundColor: 'rgba(20,184,166,0.15)',
                  color: '#14b8a6',
                  border: '1px solid rgba(20,184,166,0.3)',
                  borderRadius: '7px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                Save & Change Stage
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                backgroundColor: savedOk ? 'rgba(34,197,94,0.15)' : '#575ECF',
                color: savedOk ? '#22c55e' : '#fff',
                border: savedOk ? '1px solid rgba(34,197,94,0.3)' : 'none',
                borderRadius: '7px',
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
                transition: 'all 0.2s',
              }}
            >
              {saving ? 'Saving…' : savedOk ? '✓ Saved' : 'Save Touchpoint'}
            </button>
          </div>

        </div>
      )}
    </div>
  )
}

// ─── Sub-component: ResponsesSection ─────────────────────────────────────────

function ResponsesSection({ leadId, initialResponses = [] }) {
  const today = new Date().toISOString().slice(0, 10)
  const [responses, setResponses] = useState(initialResponses)
  const [form, setForm] = useState({ date: today, channel: '', message_body: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const channelOptions = CHANNELS.map(c => ({ value: c, label: c }))

  const labelStyle = (hasError) => ({
    display: 'block', fontSize: '11px', marginBottom: '4px',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    color: hasError ? '#ef4444' : '#8a8680',
  })

  const handleAdd = async () => {
    const newErrors = {}
    if (!form.channel) newErrors.channel = true
    if (!form.message_body.trim()) newErrors.message_body = true
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error('Channel and message are required')
      return
    }
    setErrors({})
    setSaving(true)
    try {
      const created = await createLeadResponse(leadId, form)
      setResponses(prev => [created, ...prev])
      setForm({ date: today, channel: '', message_body: '', notes: '' })
      toast.success('Response saved')
    } catch {
      toast.error('Failed to save response')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteLeadResponse(leadId, id)
      setResponses(prev => prev.filter(r => r.id !== id))
      toast.success('Response deleted')
    } catch {
      toast.error('Failed to delete response')
    }
  }

  return (
    <div>
      {/* Add response form */}
      <div style={{ backgroundColor: '#242424', borderRadius: '10px', padding: '16px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h4 style={{ color: '#c5c1b9', fontSize: '13px', fontWeight: 600, marginBottom: '14px' }}>Log a Response</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle(false)}>Date</label>
            <input
              type="date"
              className={inputClass}
              value={form.date}
              onChange={e => setForm(v => ({ ...v, date: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle(errors.channel)}>
              Channel <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <Select
              styles={{
                ...selectStyles,
                control: (base, state) => ({
                  ...selectStyles.control(base, state),
                  borderColor: errors.channel ? '#ef4444' : state.isFocused ? '#575ECF' : 'rgba(255,255,255,0.1)',
                }),
              }}
              options={channelOptions}
              value={form.channel ? { value: form.channel, label: form.channel } : null}
              onChange={opt => {
                setForm(v => ({ ...v, channel: opt?.value || '' }))
                if (errors.channel) setErrors(v => ({ ...v, channel: false }))
              }}
              placeholder="Select channel…"
              isClearable
            />
          </div>
          <div>
            <label style={labelStyle(errors.message_body)}>
              Response Message <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              className={inputClass}
              rows={3}
              value={form.message_body}
              onChange={e => {
                setForm(v => ({ ...v, message_body: e.target.value }))
                if (errors.message_body && e.target.value.trim()) setErrors(v => ({ ...v, message_body: false }))
              }}
              style={{ resize: 'vertical', borderColor: errors.message_body ? '#ef4444' : undefined }}
              placeholder="What did the lead say…"
            />
          </div>
          <div>
            <label style={labelStyle(false)}>Notes</label>
            <textarea
              className={inputClass}
              rows={2}
              value={form.notes}
              onChange={e => setForm(v => ({ ...v, notes: e.target.value }))}
              style={{ resize: 'vertical' }}
              placeholder="Additional notes…"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleAdd}
              disabled={saving}
              style={{
                backgroundColor: '#575ECF',
                color: '#fff',
                border: 'none',
                borderRadius: '7px',
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Log Response'}
            </button>
          </div>
        </div>
      </div>

      {/* Response list */}
      {responses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 24px', color: '#555', fontSize: '13px' }}>
          No responses logged yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {responses.map(r => (
            <div
              key={r.id}
              style={{
                backgroundColor: '#242424',
                borderRadius: '8px',
                padding: '12px 14px',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    {r.channel && (
                      <span style={{
                        backgroundColor: 'rgba(59,130,246,0.15)',
                        color: '#3b82f6',
                        borderRadius: '12px',
                        padding: '2px 8px',
                        fontSize: '11px',
                        fontWeight: 500,
                      }}>
                        {r.channel}
                      </span>
                    )}
                    {r.date && (
                      <span style={{ color: '#555', fontSize: '11px' }}>{fmtDate(r.date)}</span>
                    )}
                    <span style={{ color: '#444', fontSize: '11px' }}>{fmtDateTime(r.created_at)}</span>
                  </div>
                  <p style={{ color: '#c5c1b9', fontSize: '13px', lineHeight: 1.5, margin: 0, wordBreak: 'break-word' }}>
                    {r.message_body}
                  </p>
                  {r.notes && (
                    <p style={{ color: '#8a8680', fontSize: '12px', marginTop: '6px', fontStyle: 'italic' }}>
                      {r.notes}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(r.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#555',
                    fontSize: '14px',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.backgroundColor = 'transparent' }}
                  title="Delete response"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LeadDrawer({
  leadId: initialLeadId,
  defaultSpecialistId,
  onClose,
  onSaved,
  onDeleted,
  onLeadUpdated,
  specialists = [],
  industries = [],
  stages = [],
  maxTouchpoints = 5,
}) {
  const [visible, setVisible] = useState(false)
  const [mode, setMode] = useState(initialLeadId === null ? 'create' : 'edit')
  const [leadId, setLeadId] = useState(initialLeadId)
  const [lead, setLead] = useState(null)
  const [loading, setLoading] = useState(initialLeadId !== null)
  const [activeTab, setActiveTab] = useState('details')
  const [saved, setSaved] = useState({})
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [tpQuickModal, setTpQuickModal] = useState({ open: false, number: null, status: null, modalKey: 0 })
  const [responseModal, setResponseModal] = useState({ open: false, status: null, modalKey: 0 })

  // Create form state
  const [createForm, setCreateForm] = useState({
    company_name: '',
    contact_name: '',
    job_title: '',
    website: '',
    industry_id: '',
    location: '',
    email: '',
    phone: '',
    fb_page_url: '',
    ig_url: '',
    specialist_id: defaultSpecialistId || '',
    next_followup: '',
    source_url: '',
    source_image: null,
  })
  const [creating, setCreating] = useState(false)

  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  // Fetch lead in edit mode
  useEffect(() => {
    if (mode !== 'edit' || !leadId) return
    setLoading(true)
    getLead(leadId)
      .then(data => { setLead(data); setLoading(false) })
      .catch(() => { toast.error('Failed to load lead'); setLoading(false) })
  }, [leadId, mode])

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const markSaved = (field) => {
    setSaved(v => ({ ...v, [field]: true }))
    setTimeout(() => setSaved(v => ({ ...v, [field]: false })), 1500)
  }

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  // ── Field save (edit mode) ───────────────────────────────────────────────────

  const saveField = async (field, value) => {
    try {
      const updated = await updateLead(leadId, { [field]: value })
      setLead(prev => ({ ...prev, ...updated }))
      markSaved(field)
      if (onLeadUpdated) onLeadUpdated(updated)
    } catch {
      toast.error('Failed to save')
    }
  }

  // ── Status change ────────────────────────────────────────────────────────────

  const handleStatusChange = async (newStatus) => {
    const tpNum = getTouchpointNumber(newStatus)
    if (tpNum !== null) {
      setTpQuickModal({ open: true, number: tpNum, status: newStatus, modalKey: Date.now() })
      return
    }
    if (newStatus === 'Interested' || newStatus === 'Meeting Done - Not Interested') {
      setResponseModal({ open: true, status: newStatus, modalKey: Date.now() })
      return
    }
    try {
      const updated = await updateLead(leadId, { status: newStatus })
      setLead(prev => ({ ...prev, ...updated }))
      markSaved('status')
      if (onLeadUpdated) onLeadUpdated(updated)
    } catch {
      toast.error('Failed to update status')
    }
  }

  const handleResponseModalSave = async (fields) => {
    const { status } = responseModal
    const created = await createLeadResponse(leadId, fields)
    const updated = await updateLead(leadId, { status })
    setLead(prev => ({
      ...prev,
      ...updated,
      responses: [created, ...(prev.responses || [])],
    }))
    if (onLeadUpdated) onLeadUpdated(updated)
    setResponseModal({ open: false, status: null, modalKey: 0 })
    toast.success(`Response logged — moved to ${status}`)
  }

  const handleTpQuickModalSave = async (fields) => {
    const { number, status } = tpQuickModal
    const savedTp = await upsertTouchpoint(leadId, number, fields)
    const updated = await updateLead(leadId, { status })
    setLead(prev => ({
      ...prev,
      ...updated,
      touchpoints: [
        ...(prev.touchpoints || []).filter(t => t.touchpoint_number !== number),
        savedTp,
      ],
    }))
    if (onLeadUpdated) onLeadUpdated(updated)
    setTpQuickModal({ open: false, number: null, status: null, modalKey: 0 })
    toast.success(`Touchpoint ${number} saved — moved to ${status}`)
  }

  const handleTpStageChange = async (number) => {
    const stageName = `Touchpoint ${number}`
    try {
      const updated = await updateLead(leadId, { status: stageName })
      setLead(prev => ({ ...prev, ...updated }))
      toast.success(`Stage changed to ${stageName}`)
      if (onLeadUpdated) onLeadUpdated(updated)
    } catch {
      toast.error('Failed to change stage')
    }
  }

  // ── Create lead ───────────────────────────────────────────────────────────────

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!createForm.company_name.trim()) {
      toast.error('Company name is required')
      return
    }
    setCreating(true)
    try {
      const payload = {
        company_name: createForm.company_name.trim(),
        contact_name: createForm.contact_name || undefined,
        job_title: createForm.job_title || undefined,
        website: createForm.website || undefined,
        industry_id: createForm.industry_id || undefined,
        location: createForm.location || undefined,
        email: createForm.email || undefined,
        phone: createForm.phone || undefined,
        fb_page_url: createForm.fb_page_url || undefined,
        ig_url: createForm.ig_url || undefined,
        specialist_id: createForm.specialist_id || undefined,
        next_followup: createForm.next_followup || undefined,
        source_url: createForm.source_url || undefined,
        source_image: createForm.source_image || undefined,
      }
      const newLead = await createLead(payload)
      toast.success('Lead created')
      onSaved()
      setLeadId(newLead.id)
      setMode('edit')
    } catch {
      toast.error('Failed to create lead')
    } finally {
      setCreating(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteLead(leadId)
      toast.success('Lead deleted')
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
    const tp = lead.touchpoints?.[0]
    const lines = [
      `Company: ${lead.company_name || '—'}`,
      `Contact: ${lead.contact_name || '—'}`,
      `Status: ${lead.status || '—'}`,
      lead.website ? `Website: ${lead.website}` : null,
      tp?.date ? `Latest Touchpoint: ${fmtDate(tp.date)} via ${tp.channel || '?'}` : null,
      tp?.message_body ? `Message: ${tp.message_body.slice(0, 120)}` : null,
    ].filter(Boolean).join('\n')

    navigator.clipboard.writeText(lines)
      .then(() => toast.success('Summary copied'))
      .catch(() => toast.error('Failed to copy'))
  }

  // ── Derived select options ────────────────────────────────────────────────────

  const industryOptions = industries.map(i => ({ value: i.id, label: i.name }))
  const specialistOptions = specialists.map(s => ({ value: s.id, label: s.name }))

  // ── Touchpoints ───────────────────────────────────────────────────────────────

  const touchpointsByNumber = {}
  ;(lead?.touchpoints || []).forEach(tp => {
    touchpointsByNumber[tp.touchpoint_number] = tp
  })

  // Default open TP1 if none have data
  const anyTpData = Object.values(touchpointsByNumber).some(
    tp => tp.date || tp.channel || tp.message_body
  )

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
          width: '580px',
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
              <h2 style={{ color: '#c5c1b9', fontSize: '18px', fontWeight: 600, margin: 0 }}>New Lead</h2>
              <button onClick={handleClose} style={{ background: 'none', border: 'none', color: '#8a8680', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreate} style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Company Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>
                    Company Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className={inputClass}
                    value={createForm.company_name}
                    onChange={e => setCreateForm(v => ({ ...v, company_name: e.target.value }))}
                    placeholder="Acme Corp"
                    required
                  />
                </div>

                {/* Contact Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>Contact Name</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={createForm.contact_name}
                    onChange={e => setCreateForm(v => ({ ...v, contact_name: e.target.value }))}
                    placeholder="Jane Smith"
                  />
                </div>

                {/* Job Title */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>Job Title</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={createForm.job_title}
                    onChange={e => setCreateForm(v => ({ ...v, job_title: e.target.value }))}
                    placeholder="CEO"
                  />
                </div>

                {/* Website */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>Website</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={createForm.website}
                    onChange={e => setCreateForm(v => ({ ...v, website: e.target.value }))}
                    placeholder="example.com or https://example.com"
                  />
                </div>

                {/* Industry */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>Industry</label>
                  <Select
                    styles={selectStyles}
                    options={industryOptions}
                    value={industryOptions.find(o => o.value === createForm.industry_id) || null}
                    onChange={opt => setCreateForm(v => ({ ...v, industry_id: opt?.value || '' }))}
                    placeholder="Select industry…"
                    isClearable
                  />
                </div>

                {/* Location */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>Location</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={createForm.location}
                    onChange={e => setCreateForm(v => ({ ...v, location: e.target.value }))}
                    placeholder="New York, NY"
                  />
                </div>

                {/* Email */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>Email</label>
                  <input
                    type="email"
                    className={inputClass}
                    value={createForm.email}
                    onChange={e => setCreateForm(v => ({ ...v, email: e.target.value }))}
                    placeholder="contact@example.com"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>Phone</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={createForm.phone}
                    onChange={e => setCreateForm(v => ({ ...v, phone: e.target.value }))}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                {/* FB Page URL */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>Facebook Page URL</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={createForm.fb_page_url}
                    onChange={e => setCreateForm(v => ({ ...v, fb_page_url: e.target.value }))}
                    placeholder="https://facebook.com/…"
                  />
                </div>

                {/* IG URL */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>Instagram URL</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={createForm.ig_url}
                    onChange={e => setCreateForm(v => ({ ...v, ig_url: e.target.value }))}
                    placeholder="https://instagram.com/…"
                  />
                </div>

                {/* Specialist */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>Specialist</label>
                  <Select
                    styles={selectStyles}
                    options={specialistOptions}
                    value={specialistOptions.find(o => o.value === createForm.specialist_id) || null}
                    onChange={opt => setCreateForm(v => ({ ...v, specialist_id: opt?.value || '' }))}
                    placeholder="Assign specialist…"
                    isClearable
                  />
                </div>

                {/* Next Follow-up */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>Next Follow-up</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={createForm.next_followup}
                    onChange={e => setCreateForm(v => ({ ...v, next_followup: e.target.value }))}
                  />
                </div>

                {/* Source URL */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>
                    Source URL <span style={{ color: '#555', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    className={inputClass}
                    value={createForm.source_url}
                    onChange={e => setCreateForm(v => ({ ...v, source_url: e.target.value }))}
                    placeholder="LinkedIn profile, website, etc."
                  />
                </div>

                {/* Source Image */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>
                    Source Image <span style={{ color: '#555', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <ImagePasteZone
                    value={createForm.source_image}
                    onChange={v => setCreateForm(prev => ({ ...prev, source_image: v }))}
                  />
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '28px' }}>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    flex: 1,
                    backgroundColor: '#575ECF',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: creating ? 'not-allowed' : 'pointer',
                    opacity: creating ? 0.7 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {creating ? 'Creating…' : 'Create Lead'}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    color: '#8a8680',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
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
                {/* ── Header ─────────────────────────────────────────────────── */}
                <div style={{
                  padding: '18px 24px 14px',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  backgroundColor: '#1e1e1e',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Editable company name */}
                      <input
                        key={lead.company_name}
                        defaultValue={lead.company_name}
                        onBlur={e => {
                          const v = e.target.value.trim()
                          if (v && v !== lead.company_name) saveField('company_name', v)
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          borderBottom: '1px solid transparent',
                          color: '#c5c1b9',
                          fontSize: '20px',
                          fontWeight: 700,
                          width: '100%',
                          padding: '2px 0',
                          outline: 'none',
                          transition: 'border-color 0.15s',
                        }}
                        onFocus={e => { e.currentTarget.style.borderBottomColor = '#575ECF' }}
                        onBlurCapture={e => { e.currentTarget.style.borderBottomColor = 'transparent' }}
                      />

                      {/* Status + meta */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <StatusBadge status={lead.status} onChange={handleStatusChange} stages={stages.length > 0 ? stages.map(s => s.name) : Object.keys(STATUS_COLORS)} />
                        <span style={{ color: '#555', fontSize: '11px' }}>
                          Created {fmtDate(lead.created_at)}
                          {lead.specialist_name ? ` · ${lead.specialist_name}` : ''}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleClose}
                      style={{ background: 'none', border: 'none', color: '#8a8680', fontSize: '20px', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Tabs */}
                  <div style={{ display: 'flex', gap: '4px', marginTop: '16px' }}>
                    {['details', 'touchpoints', 'responses', 'history'].map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                          background: activeTab === tab ? 'rgba(87,94,207,0.2)' : 'none',
                          border: activeTab === tab ? '1px solid rgba(87,94,207,0.4)' : '1px solid transparent',
                          borderRadius: '6px',
                          color: activeTab === tab ? '#575ECF' : '#8a8680',
                          fontSize: '13px',
                          fontWeight: activeTab === tab ? 600 : 400,
                          padding: '5px 14px',
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                          transition: 'all 0.15s',
                        }}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Tab body — always mounted, hidden via display:none ────── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

                  {/* ── DETAILS TAB ─────────────────────────────────────────── */}
                  <div style={{ display: activeTab === 'details' ? 'block' : 'none' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                      {/* Contact Name */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Contact Name <SavedIndicator show={saved.contact_name} />
                        </label>
                        <input
                          key={lead.contact_name}
                          type="text"
                          className={inputClass}
                          defaultValue={lead.contact_name || ''}
                          onBlur={e => saveField('contact_name', e.target.value)}
                          placeholder="—"
                        />
                      </div>

                      {/* Job Title */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Job Title <SavedIndicator show={saved.job_title} />
                        </label>
                        <input
                          key={lead.job_title}
                          type="text"
                          className={inputClass}
                          defaultValue={lead.job_title || ''}
                          onBlur={e => saveField('job_title', e.target.value)}
                          placeholder="—"
                        />
                      </div>

                      {/* Website - full width */}
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Website <SavedIndicator show={saved.website} />
                        </label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            key={lead.website}
                            type="text"
                            className={inputClass}
                            defaultValue={lead.website || ''}
                            onBlur={e => {
                              setLead(prev => ({ ...prev, website: e.target.value }))
                              saveField('website', e.target.value)
                            }}
                            placeholder="example.com or https://example.com"
                            style={{ flex: 1 }}
                          />
                          {lead.website && (
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open website"
                              style={{
                                color: '#575ECF',
                                fontSize: '16px',
                                textDecoration: 'none',
                                flexShrink: 0,
                                lineHeight: 1,
                              }}
                            >
                              ↗
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Industry */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Industry <SavedIndicator show={saved.industry_id} />
                        </label>
                        <Select
                          styles={selectStyles}
                          options={industryOptions}
                          value={industryOptions.find(o => o.value === lead.industry_id) || null}
                          onChange={opt => {
                            setLead(prev => ({ ...prev, industry_id: opt?.value || null }))
                            saveField('industry_id', opt?.value || null)
                          }}
                          placeholder="Select…"
                          isClearable
                        />
                      </div>

                      {/* Location */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Location <SavedIndicator show={saved.location} />
                        </label>
                        <input
                          key={lead.location}
                          type="text"
                          className={inputClass}
                          defaultValue={lead.location || ''}
                          onBlur={e => saveField('location', e.target.value)}
                          placeholder="—"
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Email <SavedIndicator show={saved.email} />
                        </label>
                        <input
                          key={lead.email}
                          type="email"
                          className={inputClass}
                          defaultValue={lead.email || ''}
                          onBlur={e => saveField('email', e.target.value)}
                          placeholder="—"
                        />
                      </div>

                      {/* Phone */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Phone <SavedIndicator show={saved.phone} />
                        </label>
                        <input
                          key={lead.phone}
                          type="text"
                          className={inputClass}
                          defaultValue={lead.phone || ''}
                          onBlur={e => saveField('phone', e.target.value)}
                          placeholder="—"
                        />
                      </div>

                      {/* Facebook Page URL */}
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Facebook Page URL <SavedIndicator show={saved.fb_page_url} />
                        </label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            key={lead.fb_page_url}
                            type="text"
                            className={inputClass}
                            defaultValue={lead.fb_page_url || ''}
                            onBlur={e => {
                              setLead(prev => ({ ...prev, fb_page_url: e.target.value }))
                              saveField('fb_page_url', e.target.value || null)
                            }}
                            placeholder="https://facebook.com/…"
                            style={{ flex: 1 }}
                          />
                          {lead.fb_page_url && (
                            <a href={lead.fb_page_url} target="_blank" rel="noopener noreferrer" title="Open Facebook page"
                              style={{ color: '#575ECF', fontSize: '16px', textDecoration: 'none', flexShrink: 0, lineHeight: 1 }}>↗</a>
                          )}
                        </div>
                      </div>

                      {/* Instagram URL */}
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Instagram URL <SavedIndicator show={saved.ig_url} />
                        </label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            key={lead.ig_url}
                            type="text"
                            className={inputClass}
                            defaultValue={lead.ig_url || ''}
                            onBlur={e => {
                              setLead(prev => ({ ...prev, ig_url: e.target.value }))
                              saveField('ig_url', e.target.value || null)
                            }}
                            placeholder="https://instagram.com/…"
                            style={{ flex: 1 }}
                          />
                          {lead.ig_url && (
                            <a href={lead.ig_url} target="_blank" rel="noopener noreferrer" title="Open Instagram"
                              style={{ color: '#575ECF', fontSize: '16px', textDecoration: 'none', flexShrink: 0, lineHeight: 1 }}>↗</a>
                          )}
                        </div>
                      </div>

                      {/* Specialist */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Specialist <SavedIndicator show={saved.specialist_id} />
                        </label>
                        <Select
                          styles={selectStyles}
                          options={specialistOptions}
                          value={specialistOptions.find(o => o.value === lead.specialist_id) || null}
                          onChange={opt => {
                            setLead(prev => ({ ...prev, specialist_id: opt?.value || null, specialist_name: opt?.label || null }))
                            saveField('specialist_id', opt?.value || null)
                          }}
                          placeholder="Assign…"
                          isClearable
                        />
                      </div>

                      {/* Next Follow-up */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Next Follow-up <SavedIndicator show={saved.next_followup} />
                        </label>
                        <input
                          key={lead.next_followup}
                          type="date"
                          className={inputClass}
                          defaultValue={lead.next_followup ? lead.next_followup.slice(0, 10) : ''}
                          onBlur={e => saveField('next_followup', e.target.value || null)}
                        />
                      </div>

                      {/* Source URL — full width */}
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Source URL <SavedIndicator show={saved.source_url} />
                        </label>
                        <input
                          key={lead.source_url}
                          type="text"
                          className={inputClass}
                          defaultValue={lead.source_url || ''}
                          onBlur={e => saveField('source_url', e.target.value || null)}
                          placeholder="LinkedIn profile, website, etc."
                        />
                      </div>

                      {/* Source Image — full width */}
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Source Image <SavedIndicator show={saved.source_image} />
                        </label>
                        <ImagePasteZone
                          value={lead.source_image || null}
                          onChange={v => {
                            setLead(prev => ({ ...prev, source_image: v }))
                            saveField('source_image', v)
                          }}
                        />
                      </div>

                    </div>
                  </div>

                  {/* ── TOUCHPOINTS TAB ─────────────────────────────────────── */}
                  <div style={{ display: activeTab === 'touchpoints' ? 'block' : 'none' }}>
                    {Array.from({ length: maxTouchpoints }, (_, i) => i + 1).map(n => (
                      <TouchpointSection
                        key={`${leadId}-tp-${n}`}
                        leadId={leadId}
                        number={n}
                        initialData={touchpointsByNumber[n] || null}
                        defaultOpen={n === 1}
                        onStageChange={handleTpStageChange}
                      />
                    ))}
                  </div>

                  {/* ── RESPONSES TAB ───────────────────────────────────────── */}
                  <div style={{ display: activeTab === 'responses' ? 'block' : 'none' }}>
                    <ResponsesSection
                      leadId={leadId}
                      initialResponses={lead.responses || []}
                    />
                  </div>

                  {/* ── HISTORY TAB ─────────────────────────────────────────── */}
                  <div style={{ display: activeTab === 'history' ? 'block' : 'none' }}>
                    <div>
                      {!lead.history || lead.history.length === 0 ? (
                        <div style={{
                          textAlign: 'center',
                          padding: '48px 24px',
                          color: '#555',
                          fontSize: '14px',
                        }}>
                          No status changes recorded
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {[...lead.history].reverse().map((item, i) => (
                            <div
                              key={i}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '12px',
                                padding: '12px 14px',
                                backgroundColor: '#242424',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.06)',
                              }}
                            >
                              {/* Timeline dot */}
                              <div style={{
                                width: '8px', height: '8px',
                                borderRadius: '50%',
                                backgroundColor: '#575ECF',
                                marginTop: '5px',
                                flexShrink: 0,
                              }} />

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  {item.old_status && (
                                    <span style={{
                                      backgroundColor: STATUS_COLORS[item.old_status]?.bg || 'rgba(138,134,128,0.15)',
                                      color: STATUS_COLORS[item.old_status]?.color || '#8a8680',
                                      borderRadius: '12px',
                                      padding: '2px 8px',
                                      fontSize: '11px',
                                      fontWeight: 500,
                                    }}>
                                      {item.old_status}
                                    </span>
                                  )}
                                  {item.old_status && <span style={{ color: '#555', fontSize: '13px' }}>→</span>}
                                  <span style={{
                                    backgroundColor: STATUS_COLORS[item.new_status]?.bg || 'rgba(138,134,128,0.15)',
                                    color: STATUS_COLORS[item.new_status]?.color || '#8a8680',
                                    borderRadius: '12px',
                                    padding: '2px 8px',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                  }}>
                                    {item.new_status}
                                  </span>
                                </div>
                                <div style={{ color: '#555', fontSize: '11px', marginTop: '4px' }}>
                                  {fmtDateTime(item.changed_at || item.created_at)}
                                  {item.changed_by && ` · ${item.changed_by}`}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Footer ──────────────────────────────────────────────────── */}
                <div style={{
                  padding: '14px 24px',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#1e1e1e',
                  gap: '10px',
                }}>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    style={{
                      backgroundColor: 'rgba(239,68,68,0.1)',
                      color: '#ef4444',
                      border: '1px solid rgba(239,68,68,0.25)',
                      borderRadius: '7px',
                      padding: '7px 16px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      fontWeight: 500,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.18)' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)' }}
                  >
                    Delete Lead
                  </button>

                  {activeTab === 'details' && (
                    <span style={{ color: '#555', fontSize: '11px', fontStyle: 'italic' }}>
                      Fields auto-save on change
                    </span>
                  )}
                  {activeTab === 'touchpoints' && (
                    <span style={{ color: '#555', fontSize: '11px', fontStyle: 'italic' }}>
                      Use "Save Touchpoint" inside each section
                    </span>
                  )}
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
            <h3 style={{ color: '#c5c1b9', fontSize: '16px', fontWeight: 600, margin: '0 0 10px' }}>Delete Lead?</h3>
            <p style={{ color: '#8a8680', fontSize: '13px', margin: '0 0 24px', lineHeight: 1.5 }}>
              This will permanently delete <strong style={{ color: '#c5c1b9' }}>{lead?.company_name}</strong> and all associated data. This action cannot be undone.
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
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
