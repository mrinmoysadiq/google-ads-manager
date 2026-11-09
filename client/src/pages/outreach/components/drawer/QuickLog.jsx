import { useState, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getUser } from '../../../../utils/auth'
import { todayLocal } from '../../../../utils/dates'
import { upsertTouchpoint, updateLead, createLeadResponse, addLeadNote } from '../../../../utils/outreachApi'
import { stageTypeOf, touchpointStageName } from '../../stageTypes'
import { addDays } from '../kanban/boardModel'
import ChannelSelect from '../ChannelSelect'
import FollowUpPicker from '../FollowUpPicker'
import { inputClass } from '../LeadFields'

const MUTED = '#8a8680'
const LOGGABLE_TYPES = ['new', 'touchpoint'] // logging a touchpoint moves these leads along
const MODES = [
  ['touchpoint', 'Touchpoint', '#14b8a6'],
  ['reply', 'Their reply', '#a855f7'],
  ['note', 'Note', '#f59e0b'],
]

const LS_LAST_CHANNEL = 'outreach_last_channel'
const lastChannel = () => { try { return localStorage.getItem(LS_LAST_CHANNEL) || '' } catch { return '' } }
const rememberChannel = c => { try { localStorage.setItem(LS_LAST_CHANNEL, c) } catch { /* private mode */ } }

// Tell the drawer when a form holds unsaved text (so closing / switching leads can warn)
function useReportDirty(dirty, onDirty) {
  useEffect(() => { onDirty(dirty) }, [dirty, onDirty])
}

// Primary save, plus "save & open the next lead" when there is one
function SaveButtons({ label, color, textColor = '#fff', saving, onSave, hasNext }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      {hasNext && (
        <button
          type="button"
          onClick={() => onSave(true)}
          disabled={saving}
          title="Save, then open the next lead"
          className="rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-60 hover:bg-white/[0.06]"
          style={{ color, border: `1px solid ${color}66` }}
        >
          {label.replace(/^(Log|Add)\b.*/, '$1')} & next →
        </button>
      )}
      <button
        type="button"
        onClick={() => onSave(false)}
        disabled={saving}
        className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
        style={{ backgroundColor: color, color: textColor }}
      >
        {saving ? 'Saving…' : label}
      </button>
    </div>
  )
}

const Label = ({ children, error }) => (
  <label className="block text-[11px] uppercase tracking-wide mb-1" style={{ color: error ? '#ef4444' : MUTED }}>{children}</label>
)

// Highest touchpoint actually logged (with a date)
export function lastLoggedTouchpoint(lead) {
  return Math.max(0, ...(lead?.touchpoints || []).filter(t => t.date).map(t => t.touchpoint_number))
}

function TouchpointForm({ lead, stages, slots, onLogged, onDirty, nextLeadId, onNext }) {
  const number = lastLoggedTouchpoint(lead) + 1
  const blank = () => ({ date: todayLocal(), channel: lastChannel(), message_body: '', notes: '', loom_url: '', next_followup_date: addDays(3) })
  const [f, setF] = useState(blank)
  const [showLoom, setShowLoom] = useState(false)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const setChannel = useCallback(channel => { setF(v => ({ ...v, channel })); if (channel) setErrors(e => ({ ...e, channel: false })) }, [])

  useReportDirty(!!(f.message_body.trim() || f.notes.trim() || f.loom_url.trim()), onDirty)

  const type = stageTypeOf(stages, lead.status)
  const target = LOGGABLE_TYPES.includes(type) ? touchpointStageName(stages, number) : null
  const moveTo = target && target !== lead.status ? target : null
  // Follow-ups often repeat the last message — one click to start from it
  const previous = [...(lead.touchpoints || [])].filter(t => t.message_body).sort((a, b) => b.touchpoint_number - a.touchpoint_number)[0]

  if (number > slots) {
    return <p className="text-xs py-2" style={{ color: MUTED }}>All {slots} touchpoints are logged. Edit them in the activity below, or log their reply.</p>
  }

  const submit = async (andNext = false) => {
    const errs = { channel: !f.channel, body: !f.message_body.trim() && !f.notes.trim() }
    if (errs.channel || errs.body) {
      setErrors(errs)
      toast.error(errs.channel ? 'Pick a channel' : 'Add a message or a note')
      return
    }
    const next = andNext ? nextLeadId : null
    setSaving(true)
    try {
      const { next_followup_date, ...touchpoint } = f
      await upsertTouchpoint(lead.id, number, touchpoint)
      await updateLead(lead.id, {
        next_followup_date,
        ...(moveTo ? { status: moveTo, performed_by: getUser()?.name || null } : {}),
      })
      rememberChannel(f.channel)
      toast.success(`Touchpoint ${number} logged${moveTo ? ` — moved to ${moveTo}` : ''}`)
      setF(blank())
      setShowLoom(false)
      setErrors({})
      onLogged()
      if (next) onNext(next)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to log touchpoint')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3" onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e.shiftKey) }}>
      <div className="grid grid-cols-[1fr_150px] gap-2">
        <div>
          <Label error={errors.channel}>Channel</Label>
          <ChannelSelect value={f.channel} error={!!errors.channel} onChange={setChannel} />
        </div>
        <div>
          <Label>Date</Label>
          <input type="date" className={inputClass} value={f.date} onChange={e => setF(v => ({ ...v, date: e.target.value }))} style={{ colorScheme: 'dark' }} />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label error={errors.body}>Message</Label>
          {previous && !f.message_body && (
            <button
              type="button"
              onClick={() => setF(v => ({ ...v, message_body: previous.message_body }))}
              className="text-[11px] hover:underline mb-1"
              style={{ color: '#575ECF' }}
              title={previous.message_body.slice(0, 200)}
            >
              ↺ Reuse TP{previous.touchpoint_number} message
            </button>
          )}
        </div>
        <textarea
          className={inputClass}
          rows={3}
          value={f.message_body}
          onChange={e => { setF(v => ({ ...v, message_body: e.target.value })); setErrors(x => ({ ...x, body: false })) }}
          placeholder="What you sent or said…"
          style={{ resize: 'vertical', borderColor: errors.body ? '#ef4444' : undefined }}
        />
      </div>
      <div>
        <Label error={errors.body}>Note</Label>
        <textarea
          className={inputClass}
          rows={2}
          value={f.notes}
          onChange={e => { setF(v => ({ ...v, notes: e.target.value })); setErrors(x => ({ ...x, body: false })) }}
          placeholder="e.g. Called, no answer — left a voicemail"
          style={{ resize: 'vertical', borderColor: errors.body ? '#ef4444' : undefined }}
        />
      </div>
      {showLoom ? (
        <div>
          <Label>Loom link</Label>
          <input className={inputClass} value={f.loom_url} onChange={e => setF(v => ({ ...v, loom_url: e.target.value }))} placeholder="https://loom.com/share/…" autoFocus />
        </div>
      ) : (
        <button type="button" onClick={() => setShowLoom(true)} className="text-xs hover:underline" style={{ color: '#575ECF' }}>+ Add Loom link</button>
      )}
      <div>
        <Label>Next follow-up</Label>
        <FollowUpPicker value={f.next_followup_date} onChange={d => setF(v => ({ ...v, next_followup_date: d }))} inputClass={inputClass} />
      </div>
      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-[11px] min-w-0" style={{ color: '#666' }}>
          {moveTo ? `Moves to "${moveTo}"` : `Stays in "${lead.status}"`}
        </span>
        <SaveButtons label={`Log touchpoint ${number}`} color="#14b8a6" saving={saving} onSave={submit} hasNext={!!nextLeadId} />
      </div>
    </div>
  )
}

function ReplyForm({ lead, stages, onLogged, onDirty, nextLeadId, onNext }) {
  const blank = () => ({ date: todayLocal(), channel: lastChannel(), message_body: '', notes: '', status: '' })
  const [f, setF] = useState(blank)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const setChannel = useCallback(channel => { setF(v => ({ ...v, channel })); if (channel) setErrors(e => ({ ...e, channel: false })) }, [])

  useReportDirty(!!(f.message_body.trim() || f.notes.trim()), onDirty)

  const submit = async (andNext = false) => {
    const errs = { channel: !f.channel, body: !f.message_body.trim() }
    if (errs.channel || errs.body) {
      setErrors(errs)
      toast.error(errs.channel ? 'Pick a channel' : 'Add what they said')
      return
    }
    const next = andNext ? nextLeadId : null
    setSaving(true)
    try {
      const { status, ...reply } = f
      await createLeadResponse(lead.id, reply)
      if (status) await updateLead(lead.id, { status, performed_by: getUser()?.name || null })
      toast.success(status ? `Reply logged — moved to ${status}` : 'Reply logged')
      setF(blank())
      setErrors({})
      onLogged()
      if (next) onNext(next)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to log reply')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3" onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e.shiftKey) }}>
      <div className="grid grid-cols-[1fr_150px] gap-2">
        <div>
          <Label error={errors.channel}>Channel</Label>
          <ChannelSelect value={f.channel} error={!!errors.channel} onChange={setChannel} />
        </div>
        <div>
          <Label>Date</Label>
          <input type="date" className={inputClass} value={f.date} onChange={e => setF(v => ({ ...v, date: e.target.value }))} style={{ colorScheme: 'dark' }} />
        </div>
      </div>
      <div>
        <Label error={errors.body}>What they said</Label>
        <textarea
          className={inputClass}
          rows={3}
          value={f.message_body}
          onChange={e => { setF(v => ({ ...v, message_body: e.target.value })); setErrors(x => ({ ...x, body: false })) }}
          placeholder="Paste or summarise their reply…"
          style={{ resize: 'vertical', borderColor: errors.body ? '#ef4444' : undefined }}
        />
      </div>
      <div>
        <Label>Note</Label>
        <textarea className={inputClass} rows={2} value={f.notes} onChange={e => setF(v => ({ ...v, notes: e.target.value }))} placeholder="Optional" style={{ resize: 'vertical' }} />
      </div>
      <div>
        <Label>Move to stage</Label>
        <select className={inputClass} value={f.status} onChange={e => setF(v => ({ ...v, status: e.target.value }))} style={{ colorScheme: 'dark' }}>
          <option value="">Keep in "{lead.status}"</option>
          {stages.filter(s => s.name !== lead.status).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
      </div>
      <div className="flex items-center justify-end gap-3 pt-1">
        <SaveButtons label="Log reply" color="#a855f7" saving={saving} onSave={submit} hasNext={!!nextLeadId} />
      </div>
    </div>
  )
}

function NoteForm({ lead, onLogged, onDirty, nextLeadId, onNext }) {
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  useReportDirty(!!body.trim(), onDirty)
  const submit = async (andNext = false) => {
    if (!body.trim()) { toast.error('Write something first'); return }
    const next = andNext ? nextLeadId : null
    setSaving(true)
    try {
      await addLeadNote(lead.id, body.trim())
      toast.success('Note added')
      setBody('')
      onLogged()
      if (next) onNext(next)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add note')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="space-y-3" onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e.shiftKey) }}>
      <textarea
        className={inputClass}
        rows={3}
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Context, research, things to remember… (dated and signed with your name)"
        style={{ resize: 'vertical' }}
      />
      <div className="flex items-center justify-end gap-3">
        <SaveButtons label="Add note" color="#f59e0b" textColor="#000" saving={saving} onSave={submit} hasNext={!!nextLeadId} />
      </div>
    </div>
  )
}

// Log what just happened without leaving the lead
export default function QuickLog({ lead, stages, slots, onLogged, onDirtyChange, nextLeadId, onNext }) {
  const [mode, setMode] = useState('touchpoint')
  // Each form reports its own unsaved text; the drawer only needs "anything unsaved?"
  const [dirty, setDirty] = useState({})
  const reportTp = useCallback(d => setDirty(v => (v.tp === d ? v : { ...v, tp: d })), [])
  const reportReply = useCallback(d => setDirty(v => (v.reply === d ? v : { ...v, reply: d })), [])
  const reportNote = useCallback(d => setDirty(v => (v.note === d ? v : { ...v, note: d })), [])
  const anyDirty = !!(dirty.tp || dirty.reply || dirty.note)
  useEffect(() => { onDirtyChange?.(anyDirty) }, [anyDirty, onDirtyChange])
  const shared = { onLogged, nextLeadId, onNext }
  return (
    <section className="rounded-xl p-4" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }} aria-label="Log activity">
      <div className="flex items-center gap-1 mb-3" role="tablist">
        {MODES.map(([key, label, color]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => setMode(key)}
            className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
            style={mode === key
              ? { color, backgroundColor: `${color}22`, border: `1px solid ${color}55` }
              : { color: MUTED, border: '1px solid transparent' }}
          >
            {key === 'touchpoint' ? `+ ${label} ${lastLoggedTouchpoint(lead) + 1 <= slots ? lastLoggedTouchpoint(lead) + 1 : ''}`.trim() : `+ ${label}`}
            {(key === 'touchpoint' ? dirty.tp : key === 'reply' ? dirty.reply : dirty.note) && mode !== key && (
              <span className="inline-block w-1.5 h-1.5 rounded-full ml-1.5 align-middle" style={{ backgroundColor: color }} title="Unsaved draft" />
            )}
          </button>
        ))}
        <span className="ml-auto text-[10px]" style={{ color: '#555' }} title="⌘↵ saves · ⇧⌘↵ saves and opens the next lead">⌘↵ save · ⇧⌘↵ & next</span>
      </div>
      <div hidden={mode !== 'touchpoint'}>
        <TouchpointForm key={`tp-${lead.id}`} lead={lead} stages={stages} slots={slots} onDirty={reportTp} {...shared} />
      </div>
      <div hidden={mode !== 'reply'}>
        <ReplyForm key={`re-${lead.id}`} lead={lead} stages={stages} onDirty={reportReply} {...shared} />
      </div>
      <div hidden={mode !== 'note'}>
        <NoteForm key={`no-${lead.id}`} lead={lead} onDirty={reportNote} {...shared} />
      </div>
    </section>
  )
}
