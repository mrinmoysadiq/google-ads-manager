import { useState } from 'react'
import { todayInTz } from '../../../../utils/dates'
import ImagePasteZone from '../../../../components/ImagePasteZone'

const CHANNELS = ['LinkedIn', 'Email']

const inputClass =
  'w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#0a66c2] transition-colors'

// Called with a fresh key each open so form state always resets. Defaults to
// today in ET (the checklist's fixed business timezone), not the browser's.
export default function ReplyQuickModal({ onSave, onClose }) {
  const today = todayInTz()
  const [fields, setFields] = useState({
    date: today,
    channel: 'LinkedIn',
    screenshot: null,
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#8a8680',
  }

  const handleSave = async () => {
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
              Log Reply
            </h3>
            <p style={{ color: '#8a8680', fontSize: '12px', marginTop: '4px' }}>
              Log their reply — lead will be moved to "Replied".
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
            <label style={labelStyle}>Date</label>
            <input
              type="date"
              className={inputClass}
              value={fields.date}
              onChange={e => setFields(v => ({ ...v, date: e.target.value }))}
            />
          </div>

          {/* Channel */}
          <div>
            <label style={labelStyle}>Channel</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {CHANNELS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFields(v => ({ ...v, channel: c }))}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 13,
                    border: '1px solid',
                    borderColor: fields.channel === c ? '#0a66c2' : 'rgba(255,255,255,0.12)',
                    backgroundColor: fields.channel === c ? 'rgba(10,102,194,0.15)' : 'transparent',
                    color: fields.channel === c ? '#0a66c2' : '#8a8680',
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Screenshot — optional */}
          <div>
            <label style={labelStyle}>
              Screenshot <span style={{ color: '#555', fontSize: '10px', textTransform: 'none', letterSpacing: 0 }}>(optional — proof of the reply)</span>
            </label>
            <ImagePasteZone
              value={fields.screenshot}
              onChange={v => setFields(f => ({ ...f, screenshot: v }))}
              accentColor="#0a66c2"
            />
          </div>

          {/* Notes — optional */}
          <div>
            <label style={labelStyle}>
              Notes <span style={{ color: '#555', fontSize: '10px', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <textarea
              className={inputClass}
              rows={2}
              value={fields.notes}
              onChange={e => setFields(v => ({ ...v, notes: e.target.value }))}
              style={{ resize: 'vertical' }}
              placeholder="What did they say…"
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
            {saving ? 'Saving…' : 'Log Reply & Move Lead'}
          </button>
        </div>
      </div>
    </div>
  )
}
