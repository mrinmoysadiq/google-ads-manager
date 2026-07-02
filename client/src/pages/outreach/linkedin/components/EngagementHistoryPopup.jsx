import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getEngagements } from '../../../../utils/linkedinApi'
import { fmtDateLong } from '../../../../utils/dates'

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
      <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#0a66c2', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// Read-only viewer — engagements are added/edited from the lead drawer, not here.
export default function EngagementHistoryPopup({ leadId, leadName, onClose }) {
  const [engagements, setEngagements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEngagements(leadId)
      .then(setEngagements)
      .catch(() => toast.error('Failed to load engagement history'))
      .finally(() => setLoading(false))
  }, [leadId])

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 85, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '24px 24px 20px', width: '460px', maxWidth: '95vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', flexShrink: 0 }}>
          <div>
            <h3 style={{ color: '#c5c1b9', fontSize: '15px', fontWeight: 700, margin: 0 }}>
              Engagement History{leadName ? ` — ${leadName}` : ''}
            </h3>
            {!loading && <p style={{ color: '#8a8680', fontSize: '12px', marginTop: '4px' }}>{engagements.length} logged</p>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8a8680', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '2px 6px', flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <Spinner />
          ) : engagements.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#555', fontSize: '13px', padding: '24px 0' }}>No engagements logged yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {engagements.map(e => (
                <div key={e.id} style={{ backgroundColor: '#1e1e1e', borderRadius: '8px', padding: '12px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    {!!e.liked && <span style={{ backgroundColor: 'rgba(10,102,194,0.15)', color: '#0a66c2', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', fontWeight: 500 }}>Liked</span>}
                    {!!e.commented && <span style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', fontWeight: 500 }}>Commented</span>}
                    {e.date && <span style={{ color: '#555', fontSize: '11px' }}>{fmtDateLong(e.date)}</span>}
                  </div>
                  {e.post_url && (
                    <p style={{ color: '#8a8680', fontSize: '12px', margin: '0 0 4px', wordBreak: 'break-all' }}>
                      <a href={e.post_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0a66c2' }}>{e.post_url}</a>
                    </p>
                  )}
                  {e.comment_text && <p style={{ color: '#c5c1b9', fontSize: '13px', lineHeight: 1.5, margin: 0, wordBreak: 'break-word' }}>{e.comment_text}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
