import { useState, useMemo, useCallback } from 'react'
import toast from 'react-hot-toast'
import { getUser, isAdmin } from '../../../../utils/auth'
import { fmtDate, fmtDateTime } from '../../../../utils/dates'
import { upsertTouchpoint, deleteLeadResponse, updateLeadNote, deleteLeadNote } from '../../../../utils/outreachApi'
import { stageColor } from '../../stageTypes'
import { useChannelColors, DEFAULT_CHANNEL_COLOR } from '../../channels'
import ChannelSelect from '../ChannelSelect'
import { inputClass } from '../LeadFields'

const MUTED = '#8a8680'
const KINDS = {
  touchpoint: { label: 'Touchpoints', color: '#14b8a6' },
  reply: { label: 'Replies', color: '#a855f7' },
  note: { label: 'Notes', color: '#f59e0b' },
  stage: { label: 'Stage changes', color: '#575ECF' },
}

// Server timestamps are UTC "YYYY-MM-DD HH:MM:SS"
const utc = s => (s && s.includes(' ') && !s.endsWith('Z') ? `${s.replace(' ', 'T')}Z` : s)

// Newest first. A date-only item logged the same day it was created uses its creation time.
function sortKey(date, createdAt) {
  if (date && createdAt && createdAt.startsWith(date)) return createdAt
  if (date) return `${date} 12:00:00`
  return createdAt || ''
}

function ChannelTag({ channel }) {
  const colors = useChannelColors()
  if (!channel) return null
  const c = colors[channel] || DEFAULT_CHANNEL_COLOR
  return <span className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${c}22`, color: c }}>{channel}</span>
}

function Block({ label, children }) {
  return (
    <div className="mt-1.5">
      {label && <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: MUTED }}>{label}</p>}
      <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words" style={{ color: '#c5c1b9' }}>{children}</p>
    </div>
  )
}

const iconBtn = 'w-6 h-6 inline-flex items-center justify-center rounded hover:bg-white/10 text-xs'

function Card({ kind, children }) {
  const { color } = KINDS[kind]
  return (
    <div className="relative pl-4">
      <span className="absolute left-0 top-3 w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `2px solid ${color}66` }}>
        {children}
      </div>
    </div>
  )
}

// ─── Items ────────────────────────────────────────────────────────────────────

function TouchpointItem({ tp, leadId, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [f, setF] = useState(null)
  const [saving, setSaving] = useState(false)
  const setChannel = useCallback(channel => setF(v => ({ ...v, channel })), [])

  const start = () => {
    setF({ date: tp.date || '', channel: tp.channel || '', message_body: tp.message_body || '', notes: tp.notes || '', loom_url: tp.loom_url || '' })
    setEditing(true)
  }
  const save = async () => {
    if (!f.channel) { toast.error('Pick a channel'); return }
    if (!f.message_body.trim() && !f.notes.trim()) { toast.error('Add a message or a note'); return }
    setSaving(true)
    try {
      await upsertTouchpoint(leadId, tp.touchpoint_number, f)
      toast.success(`Touchpoint ${tp.touchpoint_number} updated`)
      setEditing(false)
      onChanged()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save touchpoint')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card kind="touchpoint">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold" style={{ color: KINDS.touchpoint.color }}>TP {tp.touchpoint_number}</span>
        <ChannelTag channel={tp.channel} />
        <span className="text-[11px] ml-auto" style={{ color: MUTED }}>{fmtDate(tp.date)}</span>
        {!editing && <button type="button" className={iconBtn} style={{ color: MUTED }} onClick={start} title="Edit touchpoint" aria-label={`Edit touchpoint ${tp.touchpoint_number}`}>✎</button>}
      </div>
      {editing ? (
        <div className="space-y-2 mt-2">
          <div className="grid grid-cols-[1fr_140px] gap-2">
            <ChannelSelect value={f.channel} onChange={setChannel} />
            <input type="date" className={inputClass} value={f.date} onChange={e => setF(v => ({ ...v, date: e.target.value }))} style={{ colorScheme: 'dark' }} />
          </div>
          <textarea className={inputClass} rows={3} value={f.message_body} onChange={e => setF(v => ({ ...v, message_body: e.target.value }))} placeholder="Message" style={{ resize: 'vertical' }} />
          <textarea className={inputClass} rows={2} value={f.notes} onChange={e => setF(v => ({ ...v, notes: e.target.value }))} placeholder="Note" style={{ resize: 'vertical' }} />
          <input className={inputClass} value={f.loom_url} onChange={e => setF(v => ({ ...v, loom_url: e.target.value }))} placeholder="Loom link (optional)" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs rounded-md" style={{ color: MUTED }}>Cancel</button>
            <button type="button" onClick={save} disabled={saving} className="px-3 py-1.5 text-xs font-semibold rounded-md text-white disabled:opacity-60" style={{ backgroundColor: '#14b8a6' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {tp.message_body && <Block label="Message">{tp.message_body}</Block>}
          {tp.notes && <Block label="Note">{tp.notes}</Block>}
          {tp.loom_url && (
            <a href={tp.loom_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-1.5 text-xs hover:underline" style={{ color: '#575ECF' }}>▶ Loom video</a>
          )}
        </>
      )}
    </Card>
  )
}

function ReplyItem({ r, leadId, onChanged }) {
  const remove = async () => {
    if (!window.confirm('Delete this reply?')) return
    try {
      await deleteLeadResponse(leadId, r.id)
      toast.success('Reply deleted')
      onChanged()
    } catch {
      toast.error('Failed to delete reply')
    }
  }
  return (
    <Card kind="reply">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold" style={{ color: KINDS.reply.color }}>↩ Their reply</span>
        <ChannelTag channel={r.channel} />
        <span className="text-[11px] ml-auto" style={{ color: MUTED }}>{fmtDate(r.date || utc(r.created_at))}</span>
        <button type="button" className={iconBtn} style={{ color: MUTED }} onClick={remove} title="Delete reply" aria-label="Delete reply">✕</button>
      </div>
      {r.message_body && <Block>{r.message_body}</Block>}
      {r.notes && <Block label="Note">{r.notes}</Block>}
    </Card>
  )
}

function NoteItem({ note, leadId, onChanged }) {
  const me = getUser()
  const canEdit = isAdmin() || (me && note.user_id === me.id)
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(note.body)
  const save = async () => {
    if (!body.trim()) { toast.error('A note cannot be empty'); return }
    try {
      await updateLeadNote(leadId, note.id, body.trim())
      setEditing(false)
      onChanged()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save note')
    }
  }
  const remove = async () => {
    if (!window.confirm('Delete this note?')) return
    try {
      await deleteLeadNote(leadId, note.id)
      toast.success('Note deleted')
      onChanged()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete note')
    }
  }
  return (
    <Card kind="note">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold" style={{ color: KINDS.note.color }}>Note</span>
        <span className="text-[11px]" style={{ color: MUTED }}>{note.author || 'Someone'}</span>
        <span className="text-[11px] ml-auto" style={{ color: MUTED }} title={note.updated_at ? `Edited ${fmtDateTime(utc(note.updated_at))}` : undefined}>
          {fmtDateTime(utc(note.created_at))}{note.updated_at ? ' · edited' : ''}
        </span>
        {canEdit && !editing && (
          <>
            <button type="button" className={iconBtn} style={{ color: MUTED }} onClick={() => { setBody(note.body); setEditing(true) }} title="Edit note" aria-label="Edit note">✎</button>
            <button type="button" className={iconBtn} style={{ color: MUTED }} onClick={remove} title="Delete note" aria-label="Delete note">✕</button>
          </>
        )}
      </div>
      {editing ? (
        <div className="space-y-2 mt-2">
          <textarea className={inputClass} rows={3} value={body} onChange={e => setBody(e.target.value)} autoFocus style={{ resize: 'vertical' }} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs rounded-md" style={{ color: MUTED }}>Cancel</button>
            <button type="button" onClick={save} className="px-3 py-1.5 text-xs font-semibold rounded-md text-black" style={{ backgroundColor: '#f59e0b' }}>Save</button>
          </div>
        </div>
      ) : (
        <Block>{note.body}</Block>
      )}
    </Card>
  )
}

function StageItem({ h, stages }) {
  const pill = name => {
    const c = stageColor(stages, name)
    return <span className="text-[11px] font-medium rounded-full px-2 py-0.5" style={{ backgroundColor: c.bg, color: c.color }}>{name}</span>
  }
  return (
    <div className="relative pl-4 py-1">
      <span className="absolute left-[1px] top-[9px] w-1.5 h-1.5 rounded-full" style={{ backgroundColor: KINDS.stage.color }} />
      <div className="flex items-center gap-1.5 flex-wrap text-[11px]" style={{ color: MUTED }}>
        {h.old_status && <>{pill(h.old_status)}<span>→</span></>}
        {pill(h.new_status)}
        <span className="ml-auto">{fmtDateTime(utc(h.changed_at || h.created_at))}{h.performed_by ? ` · ${h.performed_by}` : ''}</span>
      </div>
    </div>
  )
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

// Everything that happened to a lead, newest first: touchpoints, replies, notes and stage moves
export default function ActivityTimeline({ lead, stages, onChanged }) {
  const [filter, setFilter] = useState('all')

  const items = useMemo(() => [
    ...(lead.touchpoints || [])
      .filter(t => t.date || t.channel || t.message_body || t.notes)
      .map(t => ({ kind: 'touchpoint', key: `tp-${t.id}`, at: sortKey(t.date, t.created_at), data: t })),
    ...(lead.responses || []).map(r => ({ kind: 'reply', key: `re-${r.id}`, at: sortKey(r.date, r.created_at), data: r })),
    ...(lead.notes || []).map(n => ({ kind: 'note', key: `no-${n.id}`, at: n.created_at || '', data: n })),
    ...(lead.history || []).map((h, i) => ({ kind: 'stage', key: `st-${h.id || i}`, at: h.changed_at || h.created_at || '', data: h })),
  ].sort((a, b) => b.at.localeCompare(a.at)), [lead])

  const counts = useMemo(() => items.reduce((acc, it) => ({ ...acc, [it.kind]: (acc[it.kind] || 0) + 1 }), {}), [items])
  const shown = filter === 'all' ? items : items.filter(it => it.kind === filter)

  return (
    <section aria-label="Activity">
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider mr-1" style={{ color: MUTED }}>Activity</h3>
        {[['all', 'All', '#575ECF', items.length], ...Object.entries(KINDS).map(([k, v]) => [k, v.label, v.color, counts[k] || 0])].map(([key, label, color, n]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            disabled={key !== 'all' && n === 0}
            className="text-[11px] font-medium rounded-full px-2.5 py-0.5 disabled:opacity-40"
            style={filter === key
              ? { color: '#fff', backgroundColor: color, border: `1px solid ${color}` }
              : { color: '#c5c1b9', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {label} <span style={{ opacity: 0.7 }}>{n}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: '#555' }}>
          {items.length === 0 ? 'No activity yet — log the first touchpoint above.' : 'Nothing of this type yet.'}
        </p>
      ) : (
        <div className="space-y-2 relative">
          <span className="absolute left-[3px] top-2 bottom-2 w-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} aria-hidden="true" />
          {shown.map(it => (
            it.kind === 'touchpoint' ? <TouchpointItem key={it.key} tp={it.data} leadId={lead.id} onChanged={onChanged} />
            : it.kind === 'reply' ? <ReplyItem key={it.key} r={it.data} leadId={lead.id} onChanged={onChanged} />
            : it.kind === 'note' ? <NoteItem key={it.key} note={it.data} leadId={lead.id} onChanged={onChanged} />
            : <StageItem key={it.key} h={it.data} stages={stages} />
          ))}
        </div>
      )}
    </section>
  )
}
