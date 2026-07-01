import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { fmtDate } from '../../utils/dates'

const fb = {
  get: (path, cfg) => api.get(`/facebook${path}`, cfg),
  post: (path, data) => api.post(`/facebook${path}`, data),
  delete: (path, data) => api.delete(`/facebook${path}`, { data }),
}


function daysLeft(deletedAt) {
  const del = new Date(deletedAt)
  const expiry = new Date(del.getTime() + 7 * 24 * 60 * 60 * 1000)
  const diff = Math.ceil((expiry - Date.now()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}

export default function FbTrash() {
  const [sessions, setSessions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fb.get('/trash').then(({ data }) => {
      setSessions(data.sessions || [])
      setAccounts(data.accounts || [])
    }).catch(() => toast.error('Failed to load trash')).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const restore = async (type, id, label) => {
    try {
      await fb.post('/trash/restore', { type, id })
      toast.success(`"${label}" restored`)
      if (type === 'session') setSessions(prev => prev.filter(s => s.id !== id))
      else setAccounts(prev => prev.filter(a => a.id !== id))
    } catch { toast.error('Failed to restore') }
  }

  const permanent = async (type, id, label) => {
    if (!window.confirm(`Permanently delete "${label}"? This cannot be undone.`)) return
    try {
      await fb.delete('/trash/permanent', { type, id })
      toast.success('Permanently deleted')
      if (type === 'session') setSessions(prev => prev.filter(s => s.id !== id))
      else setAccounts(prev => prev.filter(a => a.id !== id))
    } catch { toast.error('Failed to delete') }
  }

  const empty = sessions.length === 0 && accounts.length === 0

  return (
    <div style={{ minHeight: '100vh', background: '#1b1b1b' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 28px' }}>
        <div style={{ marginBottom: 24 }}>
          <Link to="/facebook" style={{ color: '#8a8680', textDecoration: 'none', fontSize: 13 }}>← Facebook & Meta Ads</Link>
          <h1 style={{ color: '#c5c1b9', margin: '8px 0 4px', fontSize: 22, fontWeight: 700 }}>🗑 Trash</h1>
          <p style={{ color: '#8a8680', margin: 0, fontSize: 13 }}>Items are permanently deleted after 7 days. Restore them before then.</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#8a8680' }}>Loading…</div>
        ) : empty ? (
          <div style={{ textAlign: 'center', padding: '80px 0', background: '#242424', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
            <p style={{ color: '#8a8680', fontSize: 14 }}>Trash is empty</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {sessions.length > 0 && (
              <Section title={`Audit Sessions (${sessions.length})`}>
                {sessions.map(s => (
                  <TrashRow
                    key={s.id}
                    label={`${s.ad_account} — ${fmtDate(s.date)}`}
                    sublabel={s.media_buyer ? `Media buyer: ${s.media_buyer}` : null}
                    daysLeft={daysLeft(s.deleted_at)}
                    onRestore={() => restore('session', s.id, `${s.ad_account} audit`)}
                    onDelete={() => permanent('session', s.id, `${s.ad_account} audit`)}
                  />
                ))}
              </Section>
            )}

            {accounts.length > 0 && (
              <Section title={`Ad Accounts (${accounts.length})`}>
                {accounts.map(a => (
                  <TrashRow
                    key={a.id}
                    label={a.name}
                    daysLeft={daysLeft(a.deleted_at)}
                    onRestore={() => restore('account', a.id, a.name)}
                    onDelete={() => permanent('account', a.id, a.name)}
                  />
                ))}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ background: '#242424', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#1e1e1e' }}>
        <span style={{ color: '#8a8680', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function TrashRow({ label, sublabel, daysLeft: days, onRestore, onDelete }) {
  const urgent = days <= 2
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: '#c5c1b9', fontSize: 14, margin: 0, fontWeight: 500 }}>{label}</p>
        {sublabel && <p style={{ color: '#8a8680', fontSize: 12, margin: '2px 0 0' }}>{sublabel}</p>}
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, padding: '3px 8px', borderRadius: 6, flexShrink: 0, background: urgent ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)', color: urgent ? '#ef4444' : '#f59e0b' }}>
        {days === 0 ? 'Expiring today' : `${days}d left`}
      </span>
      <button onClick={onRestore} style={{ background: 'rgba(87,94,207,0.12)', border: '1px solid rgba(87,94,207,0.3)', borderRadius: 8, padding: '6px 14px', color: '#a5aaee', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(87,94,207,0.2)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(87,94,207,0.12)'}>
        Restore
      </button>
      <button onClick={onDelete} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '6px 14px', color: '#ef4444', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.18)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}>
        Delete forever
      </button>
    </div>
  )
}
