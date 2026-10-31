import { memo, useRef } from 'react'
import { fmtDate } from '../../../../utils/dates'
import { DEFAULT_CHANNEL_COLOR } from '../../channels'
import { relDays, daysAgo } from './boardModel'

const MUTED = '#8a8680'

const Icon = ({ d, size = 14 }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
)
const ICONS = {
  notes: 'M8 10h8M8 14h5M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.83L3 20l1.4-3.72A7.6 7.6 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  move: 'M13 7l5 5-5 5M6 12h12',
  mail: 'M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  phone: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  link: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  reply: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6',
}

// Stops a click on a card control from also opening the drawer / starting a drag
const stop = e => e.stopPropagation()

function IconButton({ title, onClick, href, children, active, popover }) {
  const common = {
    title,
    'aria-label': title,
    draggable: false,
    className: 'inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors hover:bg-white/10 hover:text-[#e8e5df]',
    style: { color: active ? '#e8e5df' : MUTED, backgroundColor: active ? 'rgba(87,94,207,0.3)' : undefined },
  }
  if (href) {
    return <a {...common} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" onClick={stop}>{children}</a>
  }
  return (
    <button type="button" {...common} data-popover-trigger={popover ? '' : undefined} aria-expanded={popover ? !!active : undefined}
      onClick={e => { stop(e); onClick(e.currentTarget) }}>
      {children}
    </button>
  )
}

// The follow-up state, as a button that opens the follow-up menu
function FollowUpChip({ lead, s, active, onOpen }) {
  if (s.closed) return null
  const styles = {
    overdue: { color: '#ef4444', bg: 'rgba(239,68,68,0.14)', text: `Overdue ${s.overdueDays}d` },
    today: { color: '#f59e0b', bg: 'rgba(245,158,11,0.14)', text: 'Due today' },
    upcoming: { color: '#c5c1b9', bg: 'rgba(255,255,255,0.06)', text: s.followupIn === 1 ? 'Tomorrow' : fmtDate(lead.next_followup_date) },
    none: { color: MUTED, bg: 'transparent', text: 'Set follow-up' },
  }[s.followup]
  return (
    <button
      type="button"
      data-popover-trigger
      draggable={false}
      aria-expanded={active}
      title={s.followup === 'none' ? 'Schedule the next follow-up' : 'Change the follow-up date'}
      onClick={e => { stop(e); onOpen(e.currentTarget) }}
      className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-md px-1.5 py-0.5 hover:brightness-125"
      style={{
        color: styles.color, backgroundColor: styles.bg,
        border: s.followup === 'none' ? '1px dashed rgba(255,255,255,0.15)' : '1px solid transparent',
        outline: active ? '1px solid #575ECF' : undefined,
      }}
    >
      <Icon d={ICONS.clock} size={11} />
      {styles.text}
    </button>
  )
}

// What happened last: their reply, or our last touchpoint and its channel
function LastActivity({ lead, s, channelColors }) {
  if (s.repliedLast) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] truncate" style={{ color: '#a855f7' }}>
        <Icon d={ICONS.reply} size={11} /> Replied {relDays(daysAgo(lead.last_response_date))}
      </span>
    )
  }
  if (lead.last_touchpoint_date) {
    const ch = lead.last_touchpoint_channel
    const color = (ch && channelColors[ch]) || DEFAULT_CHANNEL_COLOR
    return (
      <span className="inline-flex items-center gap-1 text-[11px] truncate" style={{ color: MUTED }}>
        {ch && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
        {ch ? `${ch} · ` : 'Touched '}{relDays(daysAgo(lead.last_touchpoint_date))}
      </span>
    )
  }
  return <span className="text-[11px]" style={{ color: '#555' }}>No touches yet</span>
}

// Touchpoint progress as dots (filled up to the last one logged); opens the notes quick view
function Progress({ lead, slots, active, onOpen }) {
  const done = Math.min(lead.last_touchpoint_number || lead.touchpoint_count || 0, slots)
  return (
    <button
      type="button"
      data-popover-trigger
      draggable={false}
      aria-expanded={active}
      title="View touchpoints & notes"
      aria-label={`View touchpoints and notes for ${lead.company_name}`}
      onClick={e => { stop(e); onOpen(e.currentTarget) }}
      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 -ml-1.5 transition-colors hover:bg-white/10"
      style={{ backgroundColor: active ? 'rgba(87,94,207,0.3)' : undefined }}
    >
      <span className="inline-flex gap-[3px]">
        {Array.from({ length: slots }, (_, i) => (
          <span
            key={i}
            className="w-[7px] h-[7px] rounded-full"
            style={{ backgroundColor: i < done ? '#14b8a6' : 'rgba(255,255,255,0.12)' }}
          />
        ))}
      </span>
      <span className="text-[11px]" style={{ color: MUTED }}>{done}/{slots}</span>
      <span style={{ color: MUTED }}><Icon d={ICONS.notes} size={12} /></span>
    </button>
  )
}

// menuType: which of this card's pop-ups is open ('peek' | 'followup' | 'move'), if any
function KanbanCard({ lead, s, slots, compact, showSpecialist, channelColors, menuType, onMenu, onOpen, onLogTouchpoint, onDragEnd }) {
  const dragged = useRef(false)
  const sourceColor = lead.source_color || null

  return (
    <div
      draggable
      onDragStart={e => {
        dragged.current = true
        e.dataTransfer.setData('text/plain', String(lead.id))
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragEnd={() => { setTimeout(() => { dragged.current = false }, 100); onDragEnd?.() }}
      onClick={() => { if (!dragged.current) onOpen(lead.id) }}
      className="group rounded-lg cursor-pointer select-none transition-[filter] hover:brightness-[1.15]"
      style={{
        padding: compact ? '8px 10px' : '10px 12px',
        backgroundColor: '#2a2a2a',
        // Tinted by lead source: a wash of the source colour plus a solid left edge
        backgroundImage: sourceColor ? `linear-gradient(${sourceColor}1a, ${sourceColor}1a)` : undefined,
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: `3px solid ${sourceColor || 'rgba(255,255,255,0.08)'}`,
        boxShadow: s.followup === 'overdue' ? 'inset 0 0 0 1px rgba(239,68,68,0.25)' : undefined,
      }}
    >
      {!compact && (lead.source_name || s.daysInStage !== null) && (
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide truncate" style={{ color: sourceColor || 'transparent' }}>
            {lead.source_name || '·'}
          </span>
          {s.daysInStage !== null && (
            <span
              className="text-[10px] shrink-0"
              style={{ color: s.cold ? '#f59e0b' : '#666' }}
              title={`In "${lead.status}" since ${fmtDate(lead.status_updated_at)}`}
            >
              {s.daysInStage <= 0 ? 'moved today' : `${s.daysInStage}d in stage`}
            </span>
          )}
        </div>
      )}

      <p className="text-[13px] font-semibold leading-snug line-clamp-2" style={{ color: '#ecebe8' }}>{lead.company_name}</p>
      {!compact && (lead.contact_name || lead.job_title) && (
        <p className="text-[11px] mt-0.5 truncate" style={{ color: MUTED }}>
          {[lead.contact_name, lead.job_title].filter(Boolean).join(' · ')}
        </p>
      )}

      <div className="flex items-center gap-2 mt-2 min-w-0">
        <FollowUpChip lead={lead} s={s} active={menuType === 'followup'} onOpen={a => onMenu(lead, 'followup', a)} />
        {!compact && <span className="min-w-0 truncate"><LastActivity lead={lead} s={s} channelColors={channelColors} /></span>}
      </div>

      <div className="flex items-center justify-between gap-1 mt-1.5 pt-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Progress lead={lead} slots={slots} active={menuType === 'peek'} onOpen={a => onMenu(lead, 'peek', a)} />
        <div className="flex items-center gap-0.5 shrink-0">
          {s.nextTpStage && (
            <button
              type="button"
              draggable={false}
              onClick={e => { stop(e); onLogTouchpoint(lead, s.nextTpStage) }}
              title={`Log touchpoint ${s.nextTp} and move to "${s.nextTpStage}"`}
              className="inline-flex items-center h-7 px-2 rounded-md text-[11px] font-semibold transition-colors hover:brightness-125"
              style={{ color: '#14b8a6', backgroundColor: 'rgba(20,184,166,0.12)' }}
            >
              + TP{s.nextTp}
            </button>
          )}
          <IconButton title="Move to stage…" popover active={menuType === 'move'} onClick={a => onMenu(lead, 'move', a)}>
            <Icon d={ICONS.move} />
          </IconButton>
          {!compact && lead.email && <IconButton title={`Email ${lead.email}`} href={`mailto:${lead.email}`}><Icon d={ICONS.mail} /></IconButton>}
          {!compact && lead.phone && <IconButton title={`Call ${lead.phone}`} href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`}><Icon d={ICONS.phone} /></IconButton>}
          {!compact && lead.linkedin_url && (
            <IconButton title="Open LinkedIn profile" href={lead.linkedin_url.startsWith('http') ? lead.linkedin_url : `https://${lead.linkedin_url}`}>
              <Icon d={ICONS.link} />
            </IconButton>
          )}
        </div>
      </div>

      {showSpecialist && lead.specialist_names && !compact && (
        <p className="text-[10px] mt-1 truncate" style={{ color: '#666' }}>{lead.specialist_names}</p>
      )}
    </div>
  )
}

export default memo(KanbanCard)
