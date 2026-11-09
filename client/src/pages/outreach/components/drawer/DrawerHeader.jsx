import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { fmtDate } from '../../../../utils/dates'
import { stageColor, isClosedStatus } from '../../stageTypes'
import { daysAgo, relDays } from '../kanban/boardModel'
import { FollowUpMenu } from '../kanban/CardMenus'
import { useDismiss } from '../kanban/useAnchored'

const MUTED = '#8a8680'

// ─── Stage picker ─────────────────────────────────────────────────────────────

export function StatusBadge({ status, onChange, stages = [] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const colors = stageColor(stages, status)

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
        type="button"
        onClick={() => setOpen(v => !v)}
        title="Change stage"
        style={{
          backgroundColor: colors.bg, color: colors.color, border: `1px solid ${colors.color}33`,
          borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        {status || 'Set stage'} ▾
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200, backgroundColor: '#2a2a2a',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '4px', minWidth: '240px',
          maxHeight: '360px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {stages.map(stage => {
            const s = stage.name
            const c = stageColor(stages, s)
            return (
              <button
                key={s}
                type="button"
                onClick={() => { setOpen(false); if (s !== status) onChange(s) }}
                className="hover:bg-white/[0.05]"
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '6px 10px',
                  borderRadius: '6px', border: 'none', backgroundColor: s === status ? 'rgba(87,94,207,0.15)' : undefined,
                  color: '#c5c1b9', fontSize: '13px', cursor: 'pointer', fontWeight: s === status ? 600 : 400,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: c.dot, flexShrink: 0 }} />
                {s}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Follow-up chip ───────────────────────────────────────────────────────────

function FollowUpChip({ lead, closed, onSet }) {
  const [anchor, setAnchor] = useState(null)
  const date = lead.next_followup_date
  const inDays = date ? -daysAgo(date) : null
  const tone = !date || closed ? { color: MUTED, bg: 'transparent', text: date ? `Follow-up ${fmtDate(date)}` : 'Set follow-up' }
    : inDays < 0 ? { color: '#ef4444', bg: 'rgba(239,68,68,0.14)', text: `Overdue ${-inDays}d` }
    : inDays === 0 ? { color: '#f59e0b', bg: 'rgba(245,158,11,0.14)', text: 'Due today' }
    : { color: '#c5c1b9', bg: 'rgba(255,255,255,0.06)', text: inDays === 1 ? 'Follow-up tomorrow' : `Follow-up ${fmtDate(date)}` }
  return (
    <>
      <button
        type="button"
        data-popover-trigger
        onClick={e => setAnchor(anchor ? null : e.currentTarget)}
        aria-expanded={!!anchor}
        title="Set the next follow-up"
        className="hover:brightness-125"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '12px', fontWeight: 600, borderRadius: 6,
          padding: '3px 8px', color: tone.color, backgroundColor: tone.bg, cursor: 'pointer',
          border: date ? '1px solid transparent' : '1px dashed rgba(255,255,255,0.18)',
        }}
      >
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        {tone.text}
      </button>
      {anchor && (
        <FollowUpMenu lead={lead} anchor={anchor} onClose={() => setAnchor(null)} onSet={(_, d) => onSet(d)} />
      )}
    </>
  )
}

// ─── Contact quick links ──────────────────────────────────────────────────────

const LINK_ICONS = {
  email: 'M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  phone: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  web: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0zM3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18',
  link: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
}
const Icon = ({ d }) => (
  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d={d} /></svg>
)
const toUrl = v => (/^https?:\/\//i.test(v) ? v : `https://${v}`)

function copy(text, label) {
  navigator.clipboard.writeText(text)
    .then(() => toast.success(`${label} copied`))
    .catch(() => toast.error('Failed to copy'))
}

// A pill that opens the link; values you'd paste elsewhere (email, phone) get a copy button
function ContactPill({ icon, label, href, copyValue, copyLabel }) {
  return (
    <span className="inline-flex items-center rounded-md overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' }}>
      <a
        href={href}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-2 py-1 text-xs hover:bg-white/[0.06] max-w-[220px]"
        style={{ color: '#c5c1b9' }}
        title={label}
      >
        <span style={{ color: MUTED }}><Icon d={icon} /></span>
        <span className="truncate">{label}</span>
      </a>
      {copyValue && (
        <button
          type="button"
          onClick={() => copy(copyValue, copyLabel)}
          title={`Copy ${copyLabel.toLowerCase()}`}
          aria-label={`Copy ${copyLabel.toLowerCase()}`}
          className="px-1.5 py-1 hover:bg-white/[0.08]"
          style={{ color: MUTED, borderLeft: '1px solid rgba(255,255,255,0.08)' }}
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        </button>
      )}
    </span>
  )
}

// ─── Overflow menu ────────────────────────────────────────────────────────────

function MoreMenu({ onCopySummary, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, close, '[data-more-trigger]')
  const item = 'w-full text-left px-3 py-2 text-[13px] rounded-md hover:bg-white/[0.06]'
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        data-more-trigger
        onClick={() => setOpen(o => !o)}
        aria-label="More actions"
        aria-expanded={open}
        className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-white/[0.08] text-lg leading-none"
        style={{ color: MUTED }}
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-[70] w-48 rounded-lg p-1" role="menu"
          style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <button type="button" role="menuitem" className={item} style={{ color: '#c5c1b9' }} onClick={() => { close(); onCopySummary() }}>
            Copy summary
          </button>
          <button type="button" role="menuitem" className={item} style={{ color: '#ef4444' }} onClick={() => { close(); onDelete() }}>
            Move to trash…
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Next / previous ──────────────────────────────────────────────────────────

function NavButtons({ nav }) {
  const btn = 'w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-white/[0.08] disabled:opacity-25 disabled:hover:bg-transparent'
  return (
    <div className="inline-flex items-center gap-0.5 shrink-0" aria-label="Lead navigation">
      <button type="button" className={btn} style={{ color: MUTED }} onClick={nav.onPrev} disabled={!nav.onPrev} title="Previous lead (K)" aria-label="Previous lead">‹</button>
      <span className="text-[11px] tabular-nums px-0.5" style={{ color: MUTED }}>{nav.position} of {nav.total}</span>
      <button type="button" className={btn} style={{ color: MUTED }} onClick={nav.onNext} disabled={!nav.onNext} title="Next lead (J)" aria-label="Next lead">›</button>
    </div>
  )
}

// ─── At a glance ──────────────────────────────────────────────────────────────

// Touches so far, when we last reached out, whether they replied, how old the lead is
function GlanceStrip({ lead, maxTouchpoints }) {
  const touches = (lead.touchpoints || []).filter(t => t.date)
  const last = [...touches].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.touchpoint_number - a.touchpoint_number)[0]
  const replies = (lead.responses || []).map(r => r.date || (r.created_at || '').slice(0, 10)).filter(Boolean).sort()
  const lastReply = replies[replies.length - 1]
  const added = (lead.created_at || '').slice(0, 10)
  const item = (label, value, color) => (
    <span className="whitespace-nowrap">
      <span style={{ color: '#666' }}>{label} </span>
      <span style={{ color: color || '#c5c1b9' }}>{value}</span>
    </span>
  )
  return (
    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px] mt-2.5 px-2.5 py-1.5 rounded-md" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
      {item('Touches', `${touches.length}/${maxTouchpoints}`, '#14b8a6')}
      {item('Last contact', last ? `${relDays(daysAgo(last.date))}${last.channel ? ` · ${last.channel}` : ''}` : 'never')}
      {item('Replied', lastReply ? relDays(daysAgo(lastReply)) : 'not yet', lastReply ? '#a855f7' : undefined)}
      {added && item('Added', fmtDate(added))}
    </div>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

export default function DrawerHeader({ lead, stages, maxTouchpoints, nav, switching, onSaveField, onStatusChange, onFollowUp, onEditDetails, onCopySummary, onDelete, onClose }) {
  const closed = isClosedStatus(stages, lead.status)
  const inStage = lead.status_updated_at ? daysAgo(lead.status_updated_at.slice(0, 10)) : null
  const specialistNames = lead.specialists?.length ? lead.specialists.map(s => s.name).join(', ') : lead.specialist_names || lead.specialist_name
  const subtitle = [lead.contact_name, lead.job_title].filter(Boolean).join(' · ')

  const links = [
    lead.email && { key: 'email', icon: LINK_ICONS.email, label: lead.email, href: `mailto:${lead.email}`, copyValue: lead.email, copyLabel: 'Email' },
    lead.phone && { key: 'phone', icon: LINK_ICONS.phone, label: lead.phone, href: `tel:${lead.phone.replace(/[^\d+]/g, '')}`, copyValue: lead.phone, copyLabel: 'Phone' },
    lead.website && { key: 'web', icon: LINK_ICONS.web, label: lead.website.replace(/^https?:\/\//i, '').replace(/\/$/, ''), href: toUrl(lead.website) },
    lead.linkedin_url && { key: 'li', icon: LINK_ICONS.link, label: 'LinkedIn', href: toUrl(lead.linkedin_url) },
    lead.fb_page_url && { key: 'fb', icon: LINK_ICONS.link, label: 'Facebook', href: toUrl(lead.fb_page_url) },
    lead.ig_url && { key: 'ig', icon: LINK_ICONS.link, label: 'Instagram', href: toUrl(lead.ig_url) },
  ].filter(Boolean)

  return (
    <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#1e1e1e', position: 'relative' }}>
      {/* Loading the next / previous lead */}
      {switching && <div className="absolute left-0 right-0 top-0 h-0.5 animate-pulse" style={{ backgroundColor: '#575ECF' }} />}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {lead.source_name && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: lead.source_color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lead.source_color }} />
              {lead.source_name}
            </span>
          )}
          <input
            key={lead.company_name}
            defaultValue={lead.company_name}
            aria-label="Company name"
            title="Click to rename"
            onBlur={e => {
              e.currentTarget.style.borderBottomColor = 'transparent'
              const v = e.target.value.trim()
              if (v && v !== lead.company_name) onSaveField('company_name', v)
              else e.target.value = lead.company_name
            }}
            onFocus={e => { e.currentTarget.style.borderBottomColor = '#575ECF' }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            style={{
              background: 'none', border: 'none', borderBottom: '1px solid transparent', color: '#ecebe8',
              fontSize: '19px', fontWeight: 700, width: '100%', padding: '1px 0', outline: 'none',
            }}
          />
          {subtitle && <p className="text-xs truncate" style={{ color: MUTED }}>{subtitle}</p>}
        </div>
        {nav && <NavButtons nav={nav} />}
        <MoreMenu onCopySummary={onCopySummary} onDelete={onDelete} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-white/[0.08] text-lg leading-none"
          style={{ color: MUTED }}
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-2.5">
        <StatusBadge status={lead.status} onChange={onStatusChange} stages={stages} />
        <FollowUpChip lead={lead} closed={closed} onSet={onFollowUp} />
        <span className="text-[11px]" style={{ color: '#666' }}>
          {inStage !== null && (inStage <= 0 ? 'Moved today' : `${inStage}d in stage`)}
          {specialistNames && ` · ${specialistNames}`}
        </span>
      </div>

      <GlanceStrip lead={lead} maxTouchpoints={maxTouchpoints} />

      <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
        {links.map(l => <ContactPill key={l.key} {...l} />)}
        {(!lead.email || !lead.phone) && (
          <button
            type="button"
            onClick={onEditDetails}
            className="text-xs px-2 py-1 rounded-md hover:bg-white/[0.06]"
            style={{ color: '#575ECF', border: '1px dashed rgba(87,94,207,0.4)' }}
          >
            + Add {[!lead.email && 'email', !lead.phone && 'phone'].filter(Boolean).join(' / ')}
          </button>
        )}
      </div>
    </div>
  )
}
