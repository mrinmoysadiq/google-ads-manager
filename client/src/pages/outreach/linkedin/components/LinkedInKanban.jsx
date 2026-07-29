import { useState, useRef } from 'react'
import ConnectionStatusBadge from './ConnectionStatusBadge'
import { FOLLOWUP_STAGE_KEYS } from '../constants'

const DEFAULT_STATUS_COLORS = {
  'Identified':                { bg: 'rgba(138,134,128,0.15)', color: '#8a8680', dot: '#8a8680' },
  'Connection Request Sent':   { bg: 'rgba(10,102,194,0.15)',  color: '#0a66c2', dot: '#0a66c2' },
  'Connected':                 { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6', dot: '#3b82f6' },
  'Engaging (Warming Up)':     { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b', dot: '#f59e0b' },
  'Ready to Message':          { bg: 'rgba(168,85,247,0.15)',  color: '#a855f7', dot: '#a855f7' },
  'Follow-up 1':                { bg: 'rgba(20,184,166,0.15)',  color: '#14b8a6', dot: '#14b8a6' },
  'Follow-up 2':                { bg: 'rgba(20,184,166,0.15)',  color: '#14b8a6', dot: '#14b8a6' },
  'Follow-up 3':                { bg: 'rgba(20,184,166,0.15)',  color: '#14b8a6', dot: '#14b8a6' },
  'Follow-up 4':                { bg: 'rgba(20,184,166,0.15)',  color: '#14b8a6', dot: '#14b8a6' },
  'Emailed':                   { bg: 'rgba(56,189,248,0.15)',  color: '#38bdf8', dot: '#38bdf8' },
  'Replied':                   { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e', dot: '#22c55e' },
  'Meeting Booked':            { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b', dot: '#f59e0b' },
  'Started Trial':             { bg: 'rgba(6,182,212,0.15)',   color: '#06b6d4', dot: '#06b6d4' },
  'Closed / Booked as Client': { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e', dot: '#22c55e' },
  'No Response / Dead':        { bg: 'rgba(55,65,81,0.2)',     color: '#6b7280', dot: '#374151' },
  'Disqualified':              { bg: 'rgba(55,65,81,0.2)',     color: '#6b7280', dot: '#374151' },
}

const FALLBACK_COLOR = { bg: 'rgba(138,134,128,0.15)', color: '#8a8680', dot: '#8a8680' }

function ListIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  )
}

function ChatIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  )
}

// Small "live" notification dot — a solid center with a soft expanding ring,
// the same visual language as a system tray unread indicator.
function PulseDot({ color = '#3b82f6' }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 6, height: 6, flexShrink: 0 }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', backgroundColor: color, animation: 'commentPulseRing 1.8s cubic-bezier(0,0,0.2,1) infinite' }} />
      <span style={{ position: 'relative', display: 'block', width: 6, height: 6, borderRadius: '50%', backgroundColor: color }} />
    </span>
  )
}

function KanbanCard({ lead, onLeadClick, onViewLog, onConnectionStatusChange, onToggleHotLead, showSpecialistColumn, warmupThreshold }) {
  const dragStarted = useRef(false)
  const isWarmedUp = (lead.engagement_count || 0) >= warmupThreshold
  const hasUnreadComments = lead.unread_comment_count > 0
  const baseBorderColor = lead.is_hot_lead ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.07)'

  return (
    <div
      draggable
      onDragStart={e => {
        dragStarted.current = true
        e.dataTransfer.setData('text/plain', String(lead.id))
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragEnd={() => { setTimeout(() => { dragStarted.current = false }, 100) }}
      onClick={() => { if (!dragStarted.current) onLeadClick(lead.id) }}
      className="rounded-xl cursor-pointer select-none overflow-hidden"
      style={{
        position: 'relative', backgroundColor: '#242424',
        border: `1px solid ${hasUnreadComments ? 'rgba(59,130,246,0.4)' : baseBorderColor}`,
        boxShadow: hasUnreadComments ? '0 2px 16px -2px rgba(59,130,246,0.28)' : 'none',
        transition: 'border-color 0.15s, background-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(10,102,194,0.35)'; e.currentTarget.style.backgroundColor = '#272727' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = hasUnreadComments ? 'rgba(59,130,246,0.4)' : baseBorderColor; e.currentTarget.style.backgroundColor = '#242424' }}
    >
      <button
        onClick={e => { e.stopPropagation(); onToggleHotLead(lead.id, !lead.is_hot_lead) }}
        title={lead.is_hot_lead ? 'Unmark as hot lead' : 'Mark as hot lead'}
        style={{
          position: 'absolute', top: 8, right: 8, zIndex: 1, background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 14, lineHeight: 1, padding: 2,
          filter: lead.is_hot_lead ? 'none' : 'grayscale(1)', opacity: lead.is_hot_lead ? 1 : 0.35,
        }}
      >🔥</button>
      <div className="p-3.5">
        <p className="text-sm font-semibold text-white leading-snug truncate" style={{ paddingRight: 18 }}>{lead.lead_name}</p>
        {(lead.company_name || lead.job_title) && (
          <p className="text-xs mt-1 truncate" style={{ color: '#8a8680' }}>
            {[lead.job_title, lead.company_name].filter(Boolean).join(' @ ')}
          </p>
        )}

        <div className="mt-2.5">
          <ConnectionStatusBadge
            status={lead.connection_status}
            onChange={s => onConnectionStatusChange(lead.id, s)}
            size="sm"
          />
        </div>

        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            {FOLLOWUP_STAGE_KEYS.map(key => {
              const fu = lead.followups_summary?.[key]
              const color = !fu ? '#555' : fu.is_seen ? '#22c55e' : '#f59e0b'
              return (
                <span
                  key={key}
                  title={`${key}${fu ? (fu.is_seen ? ' — sent & seen' : ' — sent, not seen') : ' — not sent'}`}
                  style={{
                    width: 7, height: 7, borderRadius: '50%',
                    backgroundColor: fu ? color : 'transparent',
                    border: `1.5px solid ${color}`,
                    display: 'inline-block',
                  }}
                />
              )
            })}
          </div>
          {lead.reply_count > 0 && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' }}
            >
              ↩ Replied{lead.reply_count > 1 ? ` ×${lead.reply_count}` : ''}
            </span>
          )}
          {lead.unread_comment_count > 0 ? (
            <span
              title={`${lead.unread_comment_count} unread comment${lead.unread_comment_count !== 1 ? 's' : ''}`}
              className="flex items-center gap-1.5 text-[10px] font-semibold pl-1.5 pr-2 py-1 rounded-full"
              style={{ backgroundColor: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', letterSpacing: '0.01em' }}
            >
              <PulseDot />
              <ChatIcon />
              {lead.unread_comment_count} new
            </span>
          ) : lead.comment_count > 0 && (
            <span
              title={`${lead.comment_count} comment${lead.comment_count !== 1 ? 's' : ''} — all read`}
              className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: '#6b7280' }}
            >
              <ChatIcon size={10} />
              {lead.comment_count}
            </span>
          )}
        </div>

        {isWarmedUp && (
          <div className="mt-2.5">
            <span className="text-[11px] font-semibold tracking-wide" style={{ color: '#22c55e' }}>
              Warmed up
            </span>
          </div>
        )}

        {showSpecialistColumn && lead.specialist_name && (
          <p className="text-xs mt-2" style={{ color: '#555' }}>{lead.specialist_name}</p>
        )}
      </div>

      <button
        onClick={e => { e.stopPropagation(); onViewLog(lead.id, lead.lead_name) }}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-medium"
        style={{ padding: '7px 0', backgroundColor: 'rgba(255,255,255,0.02)', color: '#8a8680', border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', transition: 'color 0.15s, background-color 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.color = '#0a66c2'; e.currentTarget.style.backgroundColor = 'rgba(10,102,194,0.08)' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#8a8680'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)' }}
        title="View engagement history"
      >
        <ListIcon />
        View Log
      </button>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl p-3.5 animate-pulse" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="h-3 rounded mb-2" style={{ backgroundColor: '#333', width: '70%' }} />
      <div className="h-2.5 rounded mb-3" style={{ backgroundColor: '#2d2d2d', width: '50%' }} />
      <div className="h-2 rounded" style={{ backgroundColor: '#2d2d2d', width: '40%' }} />
    </div>
  )
}

export default function LinkedInKanban({ leads, loading, onLeadClick, onStatusChange, onConnectionStatusChange, onToggleHotLead, onViewLog, showSpecialistColumn, stages, warmupThreshold = 3 }) {
  const [dragOverStatus, setDragOverStatus] = useState(null)

  // Stage columns must always come from the DB-driven `stages` prop — never
  // fall back to a hardcoded list, or a stale/renamed/deleted stage would
  // flash on screen before the real stages finish loading.
  const stageNames = (stages || []).map(s => s.name)

  const leadsByStatus = {}
  stageNames.forEach(s => { leadsByStatus[s] = [] })
  leads.forEach(l => {
    if (leadsByStatus[l.status] !== undefined) leadsByStatus[l.status].push(l)
  })
  stageNames.forEach(s => { leadsByStatus[s].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) })

  const handleDragOver = (e, status) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStatus(status)
  }

  const handleDragLeave = () => setDragOverStatus(null)

  const handleDrop = (e, targetStatus) => {
    e.preventDefault()
    setDragOverStatus(null)
    const leadId = parseInt(e.dataTransfer.getData('text/plain'))
    if (!leadId) return
    const lead = leads.find(l => l.id === leadId)
    if (!lead || lead.status === targetStatus) return
    onStatusChange(leadId, targetStatus)
  }

  if (stageNames.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
        <span className="text-sm" style={{ color: '#8a8680' }}>Loading pipeline stages…</span>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto pb-4" style={{ minHeight: 400 }}>
      <style>{`@keyframes commentPulseRing { 0% { transform: scale(1); opacity: 0.7; } 75%, 100% { transform: scale(2.4); opacity: 0; } }`}</style>
      <div className="flex gap-3" style={{ minWidth: stageNames.length * 236 + 'px' }}>
        {stageNames.map(status => {
          const sc = DEFAULT_STATUS_COLORS[status] || FALLBACK_COLOR
          const colLeads = leadsByStatus[status] || []
          const isDragTarget = dragOverStatus === status

          return (
            <div
              key={status}
              onDragOver={e => handleDragOver(e, status)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, status)}
              className="flex-shrink-0 rounded-xl flex flex-col"
              style={{
                width: 228,
                backgroundColor: isDragTarget ? 'rgba(10,102,194,0.06)' : '#1f1f1f',
                border: `1px solid ${isDragTarget ? 'rgba(10,102,194,0.4)' : 'rgba(255,255,255,0.06)'}`,
                minHeight: 200,
                transition: 'border-color 0.15s, background-color 0.15s',
              }}
            >
              <div className="px-3 pt-3 pb-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sc.dot }} />
                  <span className="text-xs font-semibold truncate" style={{ color: sc.color }}>{status}</span>
                </div>
                <span className="text-xs font-bold ml-1 flex-shrink-0" style={{ color: '#8a8680' }}>{colLeads.length}</span>
              </div>

              <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                {loading ? (
                  <><SkeletonCard /><SkeletonCard /></>
                ) : colLeads.length === 0 ? (
                  <div className="flex items-center justify-center h-16">
                    <span className="text-xs" style={{ color: '#444' }}>No leads</span>
                  </div>
                ) : (
                  colLeads.map(lead => (
                    <KanbanCard
                      key={lead.id}
                      lead={lead}
                      onLeadClick={onLeadClick}
                      onViewLog={onViewLog}
                      onConnectionStatusChange={onConnectionStatusChange}
                      onToggleHotLead={onToggleHotLead}
                      showSpecialistColumn={showSpecialistColumn}
                      warmupThreshold={warmupThreshold}
                    />
                  ))
                )}
                {isDragTarget && (
                  <div className="rounded-lg border-2 border-dashed h-14 flex items-center justify-center" style={{ borderColor: 'rgba(10,102,194,0.4)' }}>
                    <span className="text-xs" style={{ color: '#0a66c2' }}>Drop here</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
