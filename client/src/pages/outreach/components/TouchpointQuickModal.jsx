import { useState, useCallback } from 'react'
import { todayLocal } from '../../../utils/dates'
import ChannelSelect from './ChannelSelect'
import toast from 'react-hot-toast'

const inputClass =
  'w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#575ECF] transition-colors'

// Called with a fresh key each open so form state always resets
export default function TouchpointQuickModal({ touchpointNumber, initialData, onSave, onClose }) {
  const today = todayLocal()
  const [fields, setFields] = useState({
    date: initialData?.date || today,
    channel: initialData?.channel || '',
    message_body: initialData?.message_body || '',
    loom_url: initialData?.loom_url || '',
    notes: initialData?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const setChannel = useCallback(channel => {
    setFields(v => ({ ...v, channel }))
    if (channel) setErrors(v => (v.channel ? { ...v, channel: false } : v))
  }, [])

  const labelStyle = (hasError) => ({
    display: 'block',
    fontSize: '11px',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: hasError ? '#ef4444' : '#8a8680',
  })

  const handleSave = async () => {
    const newErrors = {}
    if (!fields.channel) newErrors.channel = true
    if (!fields.message_body.trim()) newErrors.message_body = true
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error('Channel and Message Body are required')
      return
    }
    setErrors({})
    setSaving(true)
    try {
      await onSave(fields)
    } catch {
      // error handled by parent
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.75)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          backgroundColor: '#242424',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '14px',
          padding: '28px 28px 24px',
          width: '480px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h3 style={{ color: '#c5c1b9', fontSize: '16px', fontWeight: 700, margin: 0 }}>
              Log Touchpoint {touchpointNumber}
            </h3>
            <p style={{ color: '#8a8680', fontSize: '12px', marginTop: '4px' }}>
              Fill in the details — this will be saved to the touchpoint and the stage will update.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#8a8680', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '2px 6px', flexShrink: 0 }}
          >✕</button>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Date */}
          <div>
            <label style={labelStyle(false)}>Date</label>
            <input
              type="date"
              className={inputClass}
              value={fields.date}
              onChange={e => setFields(v => ({ ...v, date: e.target.value }))}
            />
          </div>

          {/* Channel — required */}
          <div>
            <label style={labelStyle(errors.channel)}>
              Channel <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <ChannelSelect
              value={fields.channel}
              error={!!errors.channel}
              onChange={setChannel}
            />
          </div>

          {/* Message Body — required */}
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

          {/* Loom URL — optional */}
          <div>
            <label style={labelStyle(false)}>
              Loom URL <span style={{ color: '#555', fontSize: '10px', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <input
              type="text"
              className={inputClass}
              value={fields.loom_url}
              onChange={e => setFields(v => ({ ...v, loom_url: e.target.value }))}
              placeholder="https://loom.com/share/…"
            />
          </div>

          {/* Notes — optional */}
          <div>
            <label style={labelStyle(false)}>
              Notes <span style={{ color: '#555', fontSize: '10px', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <textarea
              className={inputClass}
              rows={2}
              value={fields.notes}
              onChange={e => setFields(v => ({ ...v, notes: e.target.value }))}
              style={{ resize: 'vertical' }}
              placeholder="Any additional notes…"
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '22px' }}>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              color: '#8a8680',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '7px',
              padding: '9px 20px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              backgroundColor: '#575ECF',
              color: '#fff',
              border: 'none',
              borderRadius: '7px',
              padding: '9px 22px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {saving ? 'Saving…' : 'Save & Move Lead'}
          </button>
        </div>
      </div>
    </div>
  )
}
