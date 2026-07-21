import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import Select from 'react-select'
import { getUser } from '../../../../utils/auth'
import {
  getLinkedInLead,
  updateLinkedInLead,
  deleteLinkedInLead,
  createLinkedInLead,
  createEngagement,
  deleteEngagement,
  upsertFollowup,
  toggleFollowupSeen,
  createReply,
  deleteReply,
  checkLinkedInDuplicate,
} from '../../../../utils/linkedinApi'
import { fmtDateLong, fmtDateTimeLong, todayLocal } from '../../../../utils/dates'
import ConnectionStatusBadge from './ConnectionStatusBadge'
import ImagePasteZone, { ImageLightbox } from '../../../../components/ImagePasteZone'
import FollowupQuickModal from './FollowupQuickModal'
import ReplyQuickModal from './ReplyQuickModal'
import { FOLLOWUP_STAGE_KEYS, REPLIED_STAGE } from '../constants'

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  'Identified':                { bg: 'rgba(138,134,128,0.15)', color: '#8a8680' },
  'Connection Request Sent':   { bg: 'rgba(10,102,194,0.15)',  color: '#0a66c2' },
  'Connected':                 { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6' },
  'Engaging (Warming Up)':     { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
  'Ready to Message':          { bg: 'rgba(168,85,247,0.15)',  color: '#a855f7' },
  'Follow-up 1':                { bg: 'rgba(20,184,166,0.15)',  color: '#14b8a6' },
  'Follow-up 2':                { bg: 'rgba(20,184,166,0.15)',  color: '#14b8a6' },
  'Follow-up 3':                { bg: 'rgba(20,184,166,0.15)',  color: '#14b8a6' },
  'Follow-up 4':                { bg: 'rgba(20,184,166,0.15)',  color: '#14b8a6' },
  'Emailed':                   { bg: 'rgba(56,189,248,0.15)',  color: '#38bdf8' },
  'Replied':                   { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e' },
  'Meeting Booked':            { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
  'Started Trial':             { bg: 'rgba(6,182,212,0.15)',   color: '#06b6d4' },
  'Closed / Booked as Client': { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e' },
  'No Response / Dead':        { bg: 'rgba(55,65,81,0.2)',     color: '#6b7280' },
  'Disqualified':              { bg: 'rgba(55,65,81,0.2)',     color: '#6b7280' },
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#0a66c2] transition-colors'

const selectStyles = {
  control: (base, { isFocused }) => ({
    ...base, backgroundColor: '#2a2a2a', borderColor: isFocused ? '#0a66c2' : 'rgba(255,255,255,0.1)',
    boxShadow: 'none', minHeight: '36px', fontSize: '13px',
    '&:hover': { borderColor: isFocused ? '#0a66c2' : 'rgba(255,255,255,0.2)' },
  }),
  menu: (base) => ({ ...base, backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)', zIndex: 100 }),
  menuList: (base) => ({ ...base, padding: '4px' }),
  option: (base, { isFocused, isSelected }) => ({
    ...base, backgroundColor: isSelected ? '#0a66c2' : isFocused ? 'rgba(10,102,194,0.15)' : 'transparent',
    color: '#c5c1b9', fontSize: '13px', borderRadius: '6px', cursor: 'pointer',
  }),
  singleValue: (base) => ({ ...base, color: '#c5c1b9' }),
  placeholder: (base) => ({ ...base, color: '#8a8680' }),
  input: (base) => ({ ...base, color: '#c5c1b9' }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base) => ({ ...base, color: '#8a8680', padding: '0 8px' }),
  clearIndicator: (base) => ({ ...base, color: '#8a8680' }),
}

function SavedIndicator({ show }) {
  if (!show) return null
  return <span style={{ color: '#22c55e', fontSize: '11px', marginLeft: '6px' }}>Saved ✓</span>
}

function DuplicateWarning({ duplicate }) {
  if (!duplicate) return null
  return (
    <p style={{ color: '#f59e0b', fontSize: '11px', marginTop: '6px', lineHeight: 1.5 }}>
      ⚠ Already tracked as "{duplicate.lead_name}" ({duplicate.status}) for this specialist.
    </p>
  )
}

// ─── Sub-component: StatusBadge with dropdown ────────────────────────────────

function StatusBadge({ status, onChange, stages = [] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const colors = STATUS_COLORS[status] || { bg: 'rgba(138,134,128,0.15)', color: '#8a8680' }

  useEffect(() => {
    if (!open) return
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(v => !v)} style={{ backgroundColor: colors.bg, color: colors.color, border: `1px solid ${colors.color}33`, borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {status || 'Set status'} ▾
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200, backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '4px', minWidth: '240px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {stages.map(s => {
            const c = STATUS_COLORS[s] || { color: '#8a8680' }
            return (
              <button key={s} onClick={() => { onChange(s); setOpen(false) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: s === status ? 'rgba(10,102,194,0.15)' : 'transparent', color: c.color || '#c5c1b9', fontSize: '13px', cursor: 'pointer', fontWeight: s === status ? 600 : 400 }}
                onMouseEnter={e => { if (s !== status) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { if (s !== status) e.currentTarget.style.backgroundColor = 'transparent' }}
              >{s}</button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Sub-component: EngagementsSection ───────────────────────────────────────

function EngagementsSection({ leadId, initialEngagements = [], warmupThreshold, activityUrl, notes }) {
  const today = todayLocal()
  const [engagements, setEngagements] = useState(initialEngagements)
  const [form, setForm] = useState({ date: today, post_url: '', liked: true, commented: false, comment_text: '' })
  const [saving, setSaving] = useState(false)

  const labelStyle = { display: 'block', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8a8680' }

  const handleAdd = async () => {
    if (!form.liked && !form.commented) { toast.error('Log at least a like or a comment'); return }
    setSaving(true)
    try {
      const created = await createEngagement(leadId, form)
      setEngagements(prev => [created, ...prev])
      setForm({ date: today, post_url: '', liked: true, commented: false, comment_text: '' })
      toast.success('Engagement logged')
    } catch { toast.error('Failed to log engagement') } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    try {
      await deleteEngagement(leadId, id)
      setEngagements(prev => prev.filter(e => e.id !== id))
      toast.success('Engagement deleted')
    } catch { toast.error('Failed to delete engagement') }
  }

  const isWarmedUp = engagements.length >= warmupThreshold

  return (
    <div>
      {(activityUrl || notes) && (
        <div style={{ backgroundColor: '#242424', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {activityUrl && (
            <div>
              <label style={labelStyle}>Activity URL</label>
              <a href={activityUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0a66c2', fontSize: '13px', wordBreak: 'break-all' }}>{activityUrl}</a>
            </div>
          )}
          {notes && (
            <div>
              <label style={labelStyle}>Notes</label>
              <p style={{ color: '#c5c1b9', fontSize: '13px', lineHeight: 1.5, margin: 0, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{notes}</p>
            </div>
          )}
        </div>
      )}

      {isWarmedUp && (
        <div style={{ backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: '#22c55e', fontSize: 13, fontWeight: 600 }}>
          Warmed up — {engagements.length} engagement{engagements.length !== 1 ? 's' : ''} logged. Consider moving to "Ready to Message".
        </div>
      )}

      {/* Add engagement form */}
      <div style={{ backgroundColor: '#242424', borderRadius: '10px', padding: '16px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h4 style={{ color: '#c5c1b9', fontSize: '13px', fontWeight: 600, marginBottom: '14px' }}>Log Engagement</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" className={inputClass} value={form.date} onChange={e => setForm(v => ({ ...v, date: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Post URL <span style={{ color: '#555', fontSize: '10px', textTransform: 'none' }}>(optional)</span></label>
            <input type="text" className={inputClass} value={form.post_url} onChange={e => setForm(v => ({ ...v, post_url: e.target.value }))} placeholder="https://linkedin.com/feed/update/…" />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={() => setForm(v => ({ ...v, liked: !v.liked }))}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, border: '1px solid', borderColor: form.liked ? '#0a66c2' : 'rgba(255,255,255,0.12)', backgroundColor: form.liked ? 'rgba(10,102,194,0.15)' : 'transparent', color: form.liked ? '#0a66c2' : '#8a8680' }}
            >Liked</button>
            <button type="button" onClick={() => setForm(v => ({ ...v, commented: !v.commented }))}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, border: '1px solid', borderColor: form.commented ? '#0a66c2' : 'rgba(255,255,255,0.12)', backgroundColor: form.commented ? 'rgba(10,102,194,0.15)' : 'transparent', color: form.commented ? '#0a66c2' : '#8a8680' }}
            >Commented</button>
          </div>
          {form.commented && (
            <div>
              <label style={labelStyle}>Comment text <span style={{ color: '#555', fontSize: '10px', textTransform: 'none' }}>(optional)</span></label>
              <textarea className={inputClass} rows={2} value={form.comment_text} onChange={e => setForm(v => ({ ...v, comment_text: e.target.value }))} style={{ resize: 'vertical' }} placeholder="What did you comment…" />
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleAdd} disabled={saving} style={{ backgroundColor: '#0a66c2', color: '#fff', border: 'none', borderRadius: '7px', padding: '8px 20px', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving…' : 'Log Engagement'}
            </button>
          </div>
        </div>
      </div>

      {/* Engagement list */}
      {engagements.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 24px', color: '#555', fontSize: '13px' }}>No engagements logged yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {engagements.map(e => (
            <div key={e.id} style={{ backgroundColor: '#242424', borderRadius: '8px', padding: '12px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    {!!e.liked && <span style={{ backgroundColor: 'rgba(10,102,194,0.15)', color: '#0a66c2', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', fontWeight: 500 }}>Liked</span>}
                    {!!e.commented && <span style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', fontWeight: 500 }}>Commented</span>}
                    {e.date && <span style={{ color: '#555', fontSize: '11px' }}>{fmtDateLong(e.date)}</span>}
                  </div>
                  {e.post_url && <p style={{ color: '#8a8680', fontSize: '12px', margin: '0 0 4px', wordBreak: 'break-all' }}><a href={e.post_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0a66c2' }}>{e.post_url}</a></p>}
                  {e.comment_text && <p style={{ color: '#c5c1b9', fontSize: '13px', lineHeight: 1.5, margin: 0, wordBreak: 'break-word' }}>{e.comment_text}</p>}
                </div>
                <button onClick={() => handleDelete(e.id)} style={{ background: 'none', border: 'none', color: '#555', fontSize: '14px', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}
                  onMouseEnter={ev => { ev.currentTarget.style.color = '#ef4444'; ev.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)' }}
                  onMouseLeave={ev => { ev.currentTarget.style.color = '#555'; ev.currentTarget.style.backgroundColor = 'transparent' }}
                  title="Delete engagement"
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sub-component: FollowupsSection ──────────────────────────────────────────

function FollowupRow({ stageKey, record, onSave, onToggleSeen }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ backgroundColor: '#242424', borderRadius: '8px', padding: '12px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span style={{ color: '#c5c1b9', fontSize: '13px', fontWeight: 600 }}>{stageKey}</span>
          {record?.date && <span style={{ color: '#555', fontSize: '11px' }}>{fmtDateLong(record.date)}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {record && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', color: record.is_seen ? '#22c55e' : '#8a8680', fontSize: '11px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={!!record.is_seen}
                onChange={e => onToggleSeen(stageKey, e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Seen
            </label>
          )}
          <button
            onClick={() => setModalOpen(true)}
            style={{ background: 'none', border: '1px solid rgba(10,102,194,0.35)', color: '#0a66c2', borderRadius: '6px', padding: '3px 10px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
          >
            {record ? 'Edit' : 'Log'}
          </button>
        </div>
      </div>

      {record?.message_body ? (
        <p
          onClick={() => setExpanded(v => !v)}
          style={{
            color: '#8a8680', fontSize: '12px', margin: '8px 0 0', lineHeight: 1.5, cursor: 'pointer',
            whiteSpace: expanded ? 'pre-wrap' : 'nowrap', overflow: expanded ? 'visible' : 'hidden', textOverflow: expanded ? 'clip' : 'ellipsis',
          }}
        >
          {record.message_body}
        </p>
      ) : !record ? (
        <p style={{ color: '#555', fontSize: '12px', margin: '8px 0 0' }}>Not sent yet</p>
      ) : null}

      {modalOpen && (
        <FollowupQuickModal
          stageKey={stageKey}
          initialData={record}
          onSave={async (fields) => { await onSave(stageKey, fields); setModalOpen(false) }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}

function ReplyRow({ reply, onDelete }) {
  const [lightbox, setLightbox] = useState(false)

  return (
    <div style={{ backgroundColor: '#242424', borderRadius: '8px', padding: '12px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span style={{
              backgroundColor: reply.channel === 'Email' ? 'rgba(168,85,247,0.15)' : 'rgba(10,102,194,0.15)',
              color: reply.channel === 'Email' ? '#a855f7' : '#0a66c2',
              borderRadius: '12px', padding: '2px 8px', fontSize: '11px', fontWeight: 500,
            }}>
              {reply.channel}
            </span>
            {reply.date && <span style={{ color: '#555', fontSize: '11px' }}>{fmtDateLong(reply.date)}</span>}
          </div>
          {reply.screenshot && (
            <>
              {lightbox && <ImageLightbox src={reply.screenshot} onClose={() => setLightbox(false)} />}
              <img
                src={reply.screenshot}
                alt="Reply screenshot"
                onClick={() => setLightbox(true)}
                style={{ maxWidth: '100%', maxHeight: '160px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', display: 'block', cursor: 'zoom-in', marginBottom: '6px' }}
              />
            </>
          )}
          {reply.notes && <p style={{ color: '#c5c1b9', fontSize: '13px', lineHeight: 1.5, margin: 0, wordBreak: 'break-word' }}>{reply.notes}</p>}
        </div>
        <button onClick={onDelete} style={{ background: 'none', border: 'none', color: '#555', fontSize: '14px', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.backgroundColor = 'transparent' }}
          title="Delete reply"
        >✕</button>
      </div>
    </div>
  )
}

function FollowupsSection({ followups = [], replies = [], onSaveFollowup, onToggleSeen, onSaveReply, onDeleteReply }) {
  const [replyModalOpen, setReplyModalOpen] = useState(false)
  const byStage = {}
  followups.forEach(f => { byStage[f.stage_key] = f })

  return (
    <div>
      <h4 style={{ color: '#c5c1b9', fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Follow-ups</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
        {FOLLOWUP_STAGE_KEYS.map(stageKey => (
          <FollowupRow
            key={stageKey}
            stageKey={stageKey}
            record={byStage[stageKey] || null}
            onSave={onSaveFollowup}
            onToggleSeen={onToggleSeen}
          />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h4 style={{ color: '#c5c1b9', fontSize: '13px', fontWeight: 600, margin: 0 }}>Replies</h4>
        <button
          onClick={() => setReplyModalOpen(true)}
          style={{ background: 'none', border: '1px solid rgba(10,102,194,0.35)', color: '#0a66c2', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
        >
          + Add Reply
        </button>
      </div>

      {replies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px', color: '#555', fontSize: '13px' }}>No replies logged yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {replies.map(r => (
            <ReplyRow key={r.id} reply={r} onDelete={() => onDeleteReply(r.id)} />
          ))}
        </div>
      )}

      {replyModalOpen && (
        <ReplyQuickModal
          onSave={async (fields) => { await onSaveReply(fields); setReplyModalOpen(false) }}
          onClose={() => setReplyModalOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LinkedInLeadDrawer({
  leadId: initialLeadId,
  defaultSpecialistId,
  initialTab = 'details',
  onClose,
  onSaved,
  onDeleted,
  onLeadUpdated,
  specialists = [],
  stages = [],
  warmupThreshold = 3,
  leads = [],
}) {
  const [visible, setVisible] = useState(false)
  const [mode, setMode] = useState(initialLeadId === null ? 'create' : 'edit')
  const [leadId, setLeadId] = useState(initialLeadId)
  const [lead, setLead] = useState(null)
  // Anchored once to whichever stage this lead was in when the drawer opened, so
  // prev/next keep walking the stage the user is actively working through even
  // after they move the current lead somewhere else.
  const [workingStage, setWorkingStage] = useState(null)
  const [loading, setLoading] = useState(initialLeadId !== null)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [saved, setSaved] = useState({})
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [followupModal, setFollowupModal] = useState({ open: false, stageKey: null, initialData: null, modalKey: 0 })
  const [replyModal, setReplyModal] = useState({ open: false, modalKey: 0 })

  const [createDupWarning, setCreateDupWarning] = useState(null)
  const [dupConfirmedFor, setDupConfirmedFor] = useState(null)
  const [editDupWarning, setEditDupWarning] = useState(null)

  const [createForm, setCreateForm] = useState({
    lead_name: '',
    linkedin_profile_url: '',
    activity_url: '',
    company_name: '',
    website: '',
    email: '',
    phone: '',
    job_title: '',
    follower_count: '',
    specialist_id: defaultSpecialistId || '',
    connection_status: 'Not Connected',
    notes: '',
    source_image: null,
  })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (mode !== 'edit' || !leadId) return
    setLoading(true)
    getLinkedInLead(leadId)
      .then(data => { setLead(data); setLoading(false) })
      .catch(() => { toast.error('Failed to load lead'); setLoading(false) })
  }, [leadId, mode])

  useEffect(() => {
    if (lead && workingStage === null) setWorkingStage(lead.status)
  }, [lead]) // eslint-disable-line react-hooks/exhaustive-deps

  const markSaved = (field) => {
    setSaved(v => ({ ...v, [field]: true }))
    setTimeout(() => setSaved(v => ({ ...v, [field]: false })), 1500)
  }

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  // Match the Kanban board's canonical oldest-first ordering so the "N of M"
  // position always lines up with where the lead actually sits in its column.
  const stageLeadIds = workingStage
    ? leads
        .filter(l => l.status === workingStage)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map(l => l.id)
    : []
  const navIndex = stageLeadIds.indexOf(leadId)
  const hasPrev = navIndex > 0
  const hasNext = navIndex !== -1 && navIndex < stageLeadIds.length - 1
  const navigateTo = (offset) => {
    const nextId = stageLeadIds[navIndex + offset]
    if (nextId === undefined) return
    setLeadId(nextId)
    setLead(null)
    setLoading(true)
    setSaved({})
    setEditDupWarning(null)
  }

  const checkDuplicate = async (specialistId, url, excludeLeadId, setWarning) => {
    if (!specialistId || !url || !url.trim()) { setWarning(null); return }
    try {
      const res = await checkLinkedInDuplicate({
        specialist_id: specialistId,
        linkedin_profile_url: url.trim(),
        exclude_lead_id: excludeLeadId || undefined,
      })
      setWarning(res.duplicate || null)
    } catch { /* non-blocking — silently skip on check failure */ }
  }

  const saveField = async (field, value) => {
    try {
      const updated = await updateLinkedInLead(leadId, { [field]: value })
      setLead(prev => ({ ...prev, ...updated }))
      markSaved(field)
      if (onLeadUpdated) onLeadUpdated(updated)
    } catch { toast.error('Failed to save') }
  }

  const handleStatusChange = async (newStatus) => {
    if (FOLLOWUP_STAGE_KEYS.includes(newStatus)) {
      const existing = (lead.followups || []).find(f => f.stage_key === newStatus) || null
      setFollowupModal({ open: true, stageKey: newStatus, initialData: existing, modalKey: Date.now() })
      return
    }
    if (newStatus === REPLIED_STAGE) {
      setReplyModal({ open: true, modalKey: Date.now() })
      return
    }
    try {
      const updated = await updateLinkedInLead(leadId, { status: newStatus, performed_by: getUser()?.name || null })
      setLead(prev => ({ ...prev, ...updated }))
      markSaved('status')
      if (onLeadUpdated) onLeadUpdated(updated)
      if (workingStage && newStatus !== workingStage) navigateTo(1)
    } catch { toast.error('Failed to update status') }
  }

  const handleFollowupModalSave = async (fields) => {
    const { stageKey } = followupModal
    const saved = await upsertFollowup(leadId, stageKey, fields)
    const updated = await updateLinkedInLead(leadId, { status: stageKey, performed_by: getUser()?.name || null })
    setLead(prev => ({
      ...prev,
      ...updated,
      followups: [...(prev.followups || []).filter(f => f.stage_key !== stageKey), saved],
    }))
    if (onLeadUpdated) onLeadUpdated(updated)
    setFollowupModal({ open: false, stageKey: null, initialData: null, modalKey: 0 })
    toast.success(`${stageKey} logged — moved to ${stageKey}`)
    if (workingStage && stageKey !== workingStage) navigateTo(1)
  }

  const handleReplyModalSave = async (fields) => {
    const created = await createReply(leadId, fields)
    const updated = await updateLinkedInLead(leadId, { status: REPLIED_STAGE, performed_by: getUser()?.name || null })
    setLead(prev => ({
      ...prev,
      ...updated,
      replies: [created, ...(prev.replies || [])],
    }))
    if (onLeadUpdated) onLeadUpdated(updated)
    setReplyModal({ open: false, modalKey: 0 })
    toast.success('Reply logged — moved to Replied')
    if (workingStage && REPLIED_STAGE !== workingStage) navigateTo(1)
  }

  const handleSaveFollowup = async (stageKey, fields) => {
    const saved = await upsertFollowup(leadId, stageKey, fields)
    setLead(prev => ({
      ...prev,
      followups: [...(prev.followups || []).filter(f => f.stage_key !== stageKey), saved],
    }))
  }

  const handleToggleFollowupSeen = async (stageKey, isSeen) => {
    const updatedRow = await toggleFollowupSeen(leadId, stageKey, isSeen)
    setLead(prev => ({
      ...prev,
      followups: (prev.followups || []).map(f => f.stage_key === stageKey ? updatedRow : f),
    }))
  }

  const handleSaveReply = async (fields) => {
    const created = await createReply(leadId, fields)
    setLead(prev => ({ ...prev, replies: [created, ...(prev.replies || [])] }))
  }

  const handleDeleteReply = async (id) => {
    await deleteReply(leadId, id)
    setLead(prev => ({ ...prev, replies: (prev.replies || []).filter(r => r.id !== id) }))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!createForm.lead_name.trim()) { toast.error('Lead name is required'); return }
    if (!createForm.specialist_id) { toast.error('Please assign a specialist'); return }

    // Duplicate check happens here (not just on blur) so a duplicate is never
    // missed if the user fills the URL and submits before the blur check resolves.
    const url = createForm.linkedin_profile_url?.trim()
    if (url && dupConfirmedFor !== url) {
      const res = await checkLinkedInDuplicate({ specialist_id: createForm.specialist_id, linkedin_profile_url: url }).catch(() => null)
      const duplicate = res?.duplicate || null
      setCreateDupWarning(duplicate)
      if (duplicate) {
        setDupConfirmedFor(url)
        toast.error(`"${duplicate.lead_name}" already has this profile URL for this specialist. Click Create Lead again to add anyway.`)
        return
      }
    }

    setCreating(true)
    try {
      const payload = {
        lead_name: createForm.lead_name.trim(),
        linkedin_profile_url: createForm.linkedin_profile_url || undefined,
        activity_url: createForm.activity_url || undefined,
        company_name: createForm.company_name || undefined,
        website: createForm.website || undefined,
        email: createForm.email || undefined,
        phone: createForm.phone || undefined,
        job_title: createForm.job_title || undefined,
        follower_count: createForm.follower_count ? parseInt(createForm.follower_count) : undefined,
        specialist_id: createForm.specialist_id,
        connection_status: createForm.connection_status || undefined,
        notes: createForm.notes || undefined,
        source_image: createForm.source_image || undefined,
        performed_by: getUser()?.name || undefined,
      }
      const newLead = await createLinkedInLead(payload)
      toast.success('Lead created')
      onSaved()
      setLeadId(newLead.id)
      setMode('edit')
    } catch { toast.error('Failed to create lead') } finally { setCreating(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteLinkedInLead(leadId)
      toast.success('Lead deleted')
      onDeleted(leadId)
      handleClose()
    } catch {
      toast.error('Failed to delete lead')
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const specialistOptions = specialists.map(s => ({ value: s.id, label: s.name }))

  return (
    <>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 50, opacity: visible ? 1 : 0, transition: 'opacity 0.28s ease' }} />

      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '580px', backgroundColor: '#1b1b1b', zIndex: 51, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,0.5)', transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden' }}>

        {/* ── CREATE MODE ─────────────────────────────────────────────────── */}
        {mode === 'create' && (
          <>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ color: '#c5c1b9', fontSize: '18px', fontWeight: 600, margin: 0 }}>New LinkedIn Lead</h2>
              <button onClick={handleClose} style={{ background: 'none', border: 'none', color: '#8a8680', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            <form onSubmit={handleCreate} style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>
                    Lead Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input type="text" className={inputClass} value={createForm.lead_name} onChange={e => setCreateForm(v => ({ ...v, lead_name: e.target.value }))} placeholder="Jane Smith" required />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>Position</label>
                  <input type="text" className={inputClass} value={createForm.job_title} onChange={e => setCreateForm(v => ({ ...v, job_title: e.target.value }))} placeholder="CEO" />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>Email</label>
                  <input type="email" className={inputClass} value={createForm.email} onChange={e => setCreateForm(v => ({ ...v, email: e.target.value }))} placeholder="contact@example.com" />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>Phone</label>
                  <input type="text" className={inputClass} value={createForm.phone} onChange={e => setCreateForm(v => ({ ...v, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>Company Name</label>
                  <input type="text" className={inputClass} value={createForm.company_name} onChange={e => setCreateForm(v => ({ ...v, company_name: e.target.value }))} placeholder="Acme Corp" />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>Company Website</label>
                  <input type="text" className={inputClass} value={createForm.website} onChange={e => setCreateForm(v => ({ ...v, website: e.target.value }))} placeholder="example.com or https://example.com" />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>Follower Count</label>
                  <input type="number" min="0" className={inputClass} value={createForm.follower_count} onChange={e => setCreateForm(v => ({ ...v, follower_count: e.target.value }))} placeholder="1200" />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>Connection Status</label>
                  <ConnectionStatusBadge status={createForm.connection_status} onChange={s => setCreateForm(v => ({ ...v, connection_status: s }))} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>Profile URL</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={createForm.linkedin_profile_url}
                    onChange={e => setCreateForm(v => ({ ...v, linkedin_profile_url: e.target.value }))}
                    onBlur={e => checkDuplicate(createForm.specialist_id, e.target.value, null, setCreateDupWarning)}
                    placeholder="https://linkedin.com/in/…"
                  />
                  <DuplicateWarning duplicate={createDupWarning} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>Activity URL</label>
                  <input type="text" className={inputClass} value={createForm.activity_url} onChange={e => setCreateForm(v => ({ ...v, activity_url: e.target.value }))} placeholder="https://linkedin.com/in/…/recent-activity/" />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>
                    Specialist <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <Select
                    styles={selectStyles}
                    options={specialistOptions}
                    value={specialistOptions.find(o => o.value === createForm.specialist_id) || null}
                    onChange={opt => {
                      const specId = opt?.value || ''
                      setCreateForm(v => ({ ...v, specialist_id: specId }))
                      checkDuplicate(specId, createForm.linkedin_profile_url, null, setCreateDupWarning)
                    }}
                    placeholder="Assign specialist…"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>Notes</label>
                  <textarea className={inputClass} rows={3} value={createForm.notes} onChange={e => setCreateForm(v => ({ ...v, notes: e.target.value }))} style={{ resize: 'vertical' }} placeholder="Any additional notes…" />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8680', marginBottom: '6px', fontWeight: 500 }}>
                    Source Image <span style={{ color: '#555', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <ImagePasteZone
                    value={createForm.source_image}
                    onChange={v => setCreateForm(prev => ({ ...prev, source_image: v }))}
                    accentColor="#0a66c2"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '28px' }}>
                <button type="submit" disabled={creating} style={{ flex: 1, backgroundColor: createDupWarning ? '#f59e0b' : '#0a66c2', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1 }}>
                  {creating ? 'Creating…' : createDupWarning ? 'Create Anyway' : 'Create Lead'}
                </button>
                <button type="button" onClick={handleClose} style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#8a8680', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}

        {/* ── EDIT MODE ───────────────────────────────────────────────────── */}
        {mode === 'edit' && (
          <>
            {loading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', border: '3px solid rgba(255,255,255,0.08)', borderTopColor: '#0a66c2', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                <span style={{ color: '#8a8680', fontSize: '13px' }}>Loading…</span>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : lead ? (
              <>
                <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#1e1e1e' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
                    <button onClick={() => navigateTo(-1)} disabled={!hasPrev} title="Previous lead"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: hasPrev ? 'rgba(10,102,194,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${hasPrev ? 'rgba(10,102,194,0.4)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '8px', color: hasPrev ? '#0a66c2' : '#444', fontSize: '13px', fontWeight: 600, cursor: hasPrev ? 'pointer' : 'not-allowed', padding: '8px 16px' }}
                    >‹ Previous</button>
                    {navIndex !== -1 && stageLeadIds.length > 0 && (
                      <span style={{ color: '#8a8680', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>
                        {navIndex + 1} of {stageLeadIds.length}
                      </span>
                    )}
                    <button onClick={() => navigateTo(1)} disabled={!hasNext} title="Next lead"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: hasNext ? 'rgba(10,102,194,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${hasNext ? 'rgba(10,102,194,0.4)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '8px', color: hasNext ? '#0a66c2' : '#444', fontSize: '13px', fontWeight: 600, cursor: hasNext ? 'pointer' : 'not-allowed', padding: '8px 16px' }}
                    >Next ›</button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input
                        key={lead.lead_name}
                        defaultValue={lead.lead_name}
                        onBlur={e => { const v = e.target.value.trim(); if (v && v !== lead.lead_name) saveField('lead_name', v) }}
                        style={{ background: 'none', border: 'none', borderBottom: '1px solid transparent', color: '#c5c1b9', fontSize: '20px', fontWeight: 700, width: '100%', padding: '2px 0', outline: 'none', transition: 'border-color 0.15s' }}
                        onFocus={e => { e.currentTarget.style.borderBottomColor = '#0a66c2' }}
                        onBlurCapture={e => { e.currentTarget.style.borderBottomColor = 'transparent' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <StatusBadge status={lead.status} onChange={handleStatusChange} stages={stages.map(s => s.name)} />
                        <span style={{ color: '#555', fontSize: '11px' }}>
                          Created {fmtDateLong(lead.created_at)}{lead.specialist_name ? ` · ${lead.specialist_name}` : ''}
                        </span>
                      </div>
                    </div>
                    <button onClick={handleClose} style={{ background: 'none', border: 'none', color: '#8a8680', fontSize: '20px', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>✕</button>
                  </div>

                  <div style={{ display: 'flex', gap: '4px', marginTop: '16px' }}>
                    {['details', 'engagements', 'followups', 'history'].map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab)}
                        style={{ background: activeTab === tab ? 'rgba(10,102,194,0.2)' : 'none', border: activeTab === tab ? '1px solid rgba(10,102,194,0.4)' : '1px solid transparent', borderRadius: '6px', color: activeTab === tab ? '#0a66c2' : '#8a8680', fontSize: '13px', fontWeight: activeTab === tab ? 600 : 400, padding: '5px 14px', cursor: 'pointer', textTransform: 'capitalize' }}
                      >{tab}</button>
                    ))}
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

                  {/* ── DETAILS TAB ─────────────────────────────────────────── */}
                  <div style={{ display: activeTab === 'details' ? 'block' : 'none' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Position <SavedIndicator show={saved.job_title} />
                        </label>
                        <input key={lead.job_title} type="text" className={inputClass} defaultValue={lead.job_title || ''} onBlur={e => saveField('job_title', e.target.value || null)} />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Email <SavedIndicator show={saved.email} />
                        </label>
                        <input key={lead.email} type="email" className={inputClass} defaultValue={lead.email || ''} onBlur={e => saveField('email', e.target.value || null)} />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Phone <SavedIndicator show={saved.phone} />
                        </label>
                        <input key={lead.phone} type="text" className={inputClass} defaultValue={lead.phone || ''} onBlur={e => saveField('phone', e.target.value || null)} />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Company Name <SavedIndicator show={saved.company_name} />
                        </label>
                        <input key={lead.company_name} type="text" className={inputClass} defaultValue={lead.company_name || ''} onBlur={e => saveField('company_name', e.target.value || null)} />
                      </div>

                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Company Website <SavedIndicator show={saved.website} />
                        </label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            key={lead.website}
                            type="text"
                            className={inputClass}
                            defaultValue={lead.website || ''}
                            onBlur={e => saveField('website', e.target.value || null)}
                            placeholder="example.com or https://example.com"
                            style={{ flex: 1 }}
                          />
                          {lead.website && (
                            <a href={lead.website} target="_blank" rel="noopener noreferrer" title="Open website"
                              style={{ color: '#0a66c2', fontSize: '16px', textDecoration: 'none', flexShrink: 0, lineHeight: 1 }}>↗</a>
                          )}
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Follower Count <SavedIndicator show={saved.follower_count} />
                        </label>
                        <input key={lead.follower_count} type="number" min="0" className={inputClass} defaultValue={lead.follower_count ?? ''} onBlur={e => saveField('follower_count', e.target.value ? parseInt(e.target.value) : null)} />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Connection Status <SavedIndicator show={saved.connection_status} />
                        </label>
                        <ConnectionStatusBadge status={lead.connection_status} onChange={s => saveField('connection_status', s)} />
                      </div>

                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Profile URL <SavedIndicator show={saved.linkedin_profile_url} />
                        </label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            key={lead.linkedin_profile_url}
                            type="text"
                            className={inputClass}
                            defaultValue={lead.linkedin_profile_url || ''}
                            onBlur={e => {
                              saveField('linkedin_profile_url', e.target.value || null)
                              checkDuplicate(lead.specialist_id, e.target.value, leadId, setEditDupWarning)
                            }}
                            placeholder="https://linkedin.com/in/…"
                            style={{ flex: 1 }}
                          />
                          {lead.linkedin_profile_url && (
                            <a href={lead.linkedin_profile_url} target="_blank" rel="noopener noreferrer" title="Open profile"
                              style={{ color: '#0a66c2', fontSize: '16px', textDecoration: 'none', flexShrink: 0, lineHeight: 1 }}>↗</a>
                          )}
                        </div>
                        <DuplicateWarning duplicate={editDupWarning} />
                      </div>

                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Activity URL <SavedIndicator show={saved.activity_url} />
                        </label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            key={lead.activity_url}
                            type="text"
                            className={inputClass}
                            defaultValue={lead.activity_url || ''}
                            onBlur={e => saveField('activity_url', e.target.value || null)}
                            placeholder="https://linkedin.com/in/…/recent-activity/"
                            style={{ flex: 1 }}
                          />
                          {lead.activity_url && (
                            <a href={lead.activity_url} target="_blank" rel="noopener noreferrer" title="Open activity"
                              style={{ color: '#0a66c2', fontSize: '16px', textDecoration: 'none', flexShrink: 0, lineHeight: 1 }}>↗</a>
                          )}
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Specialist</label>
                        <Select
                          styles={selectStyles}
                          options={specialistOptions}
                          value={specialistOptions.find(o => o.value === lead.specialist_id) || null}
                          onChange={opt => {
                            if (!opt) return
                            saveField('specialist_id', opt.value)
                            checkDuplicate(opt.value, lead.linkedin_profile_url, leadId, setEditDupWarning)
                          }}
                          placeholder="Assign specialist…"
                        />
                      </div>

                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Notes <SavedIndicator show={saved.notes} />
                        </label>
                        <textarea key={lead.notes} className={inputClass} rows={3} defaultValue={lead.notes || ''} onBlur={e => saveField('notes', e.target.value || null)} style={{ resize: 'vertical' }} />
                      </div>

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
                          accentColor="#0a66c2"
                        />
                      </div>
                    </div>

                    {/* Delete lead */}
                    <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <button onClick={() => setShowDeleteModal(true)} style={{ color: '#ef4444', background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '7px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}>
                        Delete Lead
                      </button>
                    </div>
                  </div>

                  {/* ── FOLLOW-UPS TAB ──────────────────────────────────────── */}
                  <div style={{ display: activeTab === 'followups' ? 'block' : 'none' }}>
                    <FollowupsSection
                      followups={lead.followups || []}
                      replies={lead.replies || []}
                      onSaveFollowup={handleSaveFollowup}
                      onToggleSeen={handleToggleFollowupSeen}
                      onSaveReply={handleSaveReply}
                      onDeleteReply={handleDeleteReply}
                    />
                  </div>

                  {/* ── ENGAGEMENTS TAB ─────────────────────────────────────── */}
                  <div style={{ display: activeTab === 'engagements' ? 'block' : 'none' }}>
                    <EngagementsSection leadId={leadId} initialEngagements={lead.engagements || []} warmupThreshold={warmupThreshold} activityUrl={lead.activity_url} notes={lead.notes} />
                  </div>

                  {/* ── HISTORY TAB ──────────────────────────────────────────── */}
                  <div style={{ display: activeTab === 'history' ? 'block' : 'none' }}>
                    {(lead.history || []).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px 24px', color: '#555', fontSize: '13px' }}>No stage changes yet</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {lead.history.map(h => (
                          <div key={h.id} style={{ backgroundColor: '#242424', borderRadius: '8px', padding: '10px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              {h.old_status && <span style={{ color: '#8a8680', fontSize: '12px' }}>{h.old_status}</span>}
                              {h.old_status && <span style={{ color: '#555', fontSize: '12px' }}>→</span>}
                              <span style={{ color: '#c5c1b9', fontSize: '12px', fontWeight: 600 }}>{h.new_status}</span>
                            </div>
                            <p style={{ color: '#555', fontSize: '11px', margin: '4px 0 0' }}>
                              {fmtDateTimeLong(h.changed_at)}{h.performed_by ? ` · ${h.performed_by}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </>
        )}
      </div>

      {/* Delete confirmation */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.75)' }} onClick={e => { if (e.target === e.currentTarget) setShowDeleteModal(false) }}>
          <div style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '24px', width: '360px', maxWidth: '90vw' }}>
            <h3 style={{ color: '#c5c1b9', fontSize: '15px', fontWeight: 700, margin: '0 0 8px' }}>Delete this lead?</h3>
            <p style={{ color: '#8a8680', fontSize: '13px', margin: '0 0 20px' }}>This can be restored from Trash within 7 days.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteModal(false)} style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#8a8680', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', padding: '8px 18px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '7px', padding: '8px 18px', fontSize: '13px', fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {followupModal.open && (
        <FollowupQuickModal
          key={followupModal.modalKey}
          stageKey={followupModal.stageKey}
          initialData={followupModal.initialData}
          onSave={handleFollowupModalSave}
          onClose={() => setFollowupModal({ open: false, stageKey: null, initialData: null, modalKey: 0 })}
        />
      )}

      {replyModal.open && (
        <ReplyQuickModal
          key={replyModal.modalKey}
          onSave={handleReplyModalSave}
          onClose={() => setReplyModal({ open: false, modalKey: 0 })}
        />
      )}
    </>
  )
}
