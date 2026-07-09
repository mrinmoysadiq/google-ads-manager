import { useState } from 'react'
import toast from 'react-hot-toast'
import { todayLocal } from '../../../../utils/dates'

const inputClass =
  'w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#0a66c2] transition-colors'

// Called with a fresh key each open so form state always resets
export default function FollowupQuickModal({ stageKey, initialData, onSave, onClose }) {
  const today = todayLocal()
  const [fields, setFields] = useState({
    date: initialData?.date || today,
    message_body: initialData?.message_body || '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const labelStyle = (hasError) => ({
    display: 'block',
    fontSize: '11px',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: hasError ? '#ef4444' : '#8a8680',
  })

  const handleSave = async () => {
    if (!fields.message_body.trim()) {
      setErrors({ message_body: true })
      toast.error('Message is required')
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
              Log {stageKey}
            </h3>
            <p style={{ color: '#8a8680', fontSize: '12px', marginTop: '4px' }}>
              Fill in the details — this will be saved and the stage will update.
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

          {/* Message Body — required */}
          <div>
            <label style={labelStyle(errors.message_body)}>
              Message <span style={{ color: '#ef4444' }}>*</span>
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
              placeholder={stageKey === 'Emailed' ? 'Paste the email you sent…' : 'Write your DM here…'}
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
              backgroundColor: '#0a66c2',
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
