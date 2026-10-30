import { useState, useRef, useCallback } from 'react'
import { fmtDate as formatDate, todayLocal } from '../../../utils/dates'
import { stageColor, isClosedStatus } from '../stageTypes'
import TouchpointPeek from './TouchpointPeek'
import { useChannelColors, DEFAULT_CHANNEL_COLOR } from '../channels'


function isOverdue(lead, stages) {
  if (!lead.next_followup_date) return false
  if (isClosedStatus(stages, lead.status)) return false
  return lead.next_followup_date < todayLocal()
}

function daysOverdue(dateStr) {
  return Math.floor((new Date() - new Date(dateStr)) / 86400000)
}


function ChannelPills({ channels }) {
  const channelColors = useChannelColors()
  if (!channels || channels.length === 0) return null
  return (
    <div className="flex gap-1 flex-wrap mt-1.5">
      {channels.slice(0, 3).map(ch => (
        <span key={ch} className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${channelColors[ch] || DEFAULT_CHANNEL_COLOR}22`, color: channelColors[ch] || DEFAULT_CHANNEL_COLOR }}>
          {ch}
        </span>
      ))}
      {channels.length > 3 && (
        <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: '#8a8680', backgroundColor: 'rgba(255,255,255,0.05)' }}>+{channels.length - 3}</span>
      )}
    </div>
  )
}

function KanbanCard({ lead, stages, onLeadClick, onPeek, peekOpen, showSpecialistColumn, maxTouchpoints }) {
  const dragStarted = useRef(false)
  const overdue = isOverdue(lead, stages)
  const sourceColor = lead.source_color || null
  const days = overdue ? daysOverdue(lead.next_followup_date) : 0
  const followupColor = !overdue ? '#c5c1b9' : days >= 3 ? '#ef4444' : '#f59e0b'

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
      className="rounded-lg p-3 cursor-pointer select-none"
      style={{
        backgroundColor: '#2a2a2a',
        // Tinted by lead source: a wash of the source colour plus a solid left edge
        backgroundImage: sourceColor ? `linear-gradient(${sourceColor}1f, ${sourceColor}1f)` : undefined,
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: `3px solid ${sourceColor || 'rgba(255,255,255,0.06)'}`,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderTopColor = e.currentTarget.style.borderRightColor = e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.14)'; e.currentTarget.style.backgroundColor = '#313131' }}
      onMouseLeave={e => { e.currentTarget.style.borderTopColor = e.currentTarget.style.borderRightColor = e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.backgroundColor = '#2a2a2a' }}
    >
      {lead.source_name && (
        <span className="inline-block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: sourceColor }}>
          {lead.source_name}
        </span>
      )}
      <p className="text-sm font-semibold text-white leading-snug">{lead.company_name}</p>
      {(lead.contact_name || lead.job_title) && (
        <p className="text-xs mt-0.5" style={{ color: '#8a8680' }}>
          {[lead.contact_name, lead.job_title].filter(Boolean).join(' · ')}
        </p>
      )}
      <ChannelPills channels={lead.channels_used} />
      <div className="flex items-center justify-between mt-2">
        {/* Opens a quick view of touchpoints, notes and replies without the drawer */}
        <button
          type="button"
          data-peek-trigger
          draggable={false}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onPeek(lead, e.currentTarget) }}
          title="View touchpoints & notes"
          aria-label={`View touchpoints and notes for ${lead.company_name}`}
          aria-expanded={peekOpen}
          className="inline-flex items-center gap-1 text-xs rounded px-1.5 py-0.5 -ml-1.5 transition-colors"
          style={{ color: peekOpen ? '#c5c1b9' : '#8a8680', backgroundColor: peekOpen ? 'rgba(87,94,207,0.25)' : 'transparent' }}
          onMouseEnter={e => { if (!peekOpen) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)' }}
          onMouseLeave={e => { if (!peekOpen) e.currentTarget.style.backgroundColor = 'transparent' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.83L3 20l1.4-3.72A7.6 7.6 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {lead.touchpoint_count || 0}/{maxTouchpoints} TPs
        </button>
        {lead.next_followup_date && (
          <span className="text-xs font-medium" style={{ color: followupColor }}>
            {overdue ? `${days}d overdue` : formatDate(lead.next_followup_date)}
          </span>
        )}
      </div>
      {showSpecialistColumn && lead.specialist_name && (
        <p className="text-xs mt-1" style={{ color: '#555' }}>{lead.specialist_name}</p>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-lg p-3 animate-pulse" style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="h-3 rounded mb-2" style={{ backgroundColor: '#333', width: '70%' }} />
      <div className="h-2.5 rounded mb-3" style={{ backgroundColor: '#2d2d2d', width: '50%' }} />
      <div className="h-2 rounded" style={{ backgroundColor: '#2d2d2d', width: '40%' }} />
    </div>
  )
}

const DEFAULT_STAGES = [
  'New Lead', 'Touchpoint 1', 'Touchpoint 2', 'Touchpoint 3', 'Touchpoint 4', 'Touchpoint 5',
  'Responded', 'Interested', 'Appointment Booked', 'No Show',
  'Meeting Done - Not Interested', 'Started Trial', 'Closed / Booked as Client', 'Disqualified / Dead',
]

export default function PipelineKanban({ leads, loading, onLeadClick, onStatusChange, showSpecialistColumn, stages, maxTouchpoints = 5 }) {
  const [dragOverStatus, setDragOverStatus] = useState(null)
  const [peek, setPeek] = useState(null) // { lead, anchor } for the open touchpoint quick view
  const channelColors = useChannelColors()

  const togglePeek = useCallback((lead, anchor) => {
    setPeek(prev => (prev?.lead.id === lead.id ? null : { lead, anchor }))
  }, [])
  const closePeek = useCallback(() => setPeek(null), [])

  const stageNames = stages && stages.length > 0 ? stages.map(s => s.name) : DEFAULT_STAGES

  const leadsByStatus = {}
  stageNames.forEach(s => { leadsByStatus[s] = [] })
  leads.forEach(l => {
    if (leadsByStatus[l.status] !== undefined) {
      leadsByStatus[l.status].push(l)
    } else {
      // Status isn't an active stage (renamed/deleted/deactivated) — collected in a separate column
      if (!leadsByStatus['__other__']) leadsByStatus['__other__'] = []
      leadsByStatus['__other__'].push(l)
    }
  })

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

  const otherLeads = leadsByStatus['__other__'] || []

  return (
    <div className="overflow-x-auto pb-4" style={{ minHeight: 400 }}>
      <div className="flex gap-3" style={{ minWidth: (stageNames.length + (otherLeads.length ? 1 : 0)) * 236 + 'px' }}>
        {stageNames.map(status => {
          const sc = stageColor(stages, status)
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
                backgroundColor: isDragTarget ? 'rgba(87,94,207,0.06)' : '#1f1f1f',
                border: `1px solid ${isDragTarget ? 'rgba(87,94,207,0.4)' : 'rgba(255,255,255,0.06)'}`,
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
                      stages={stages}
                      onLeadClick={onLeadClick}
                      onPeek={togglePeek}
                      peekOpen={peek?.lead.id === lead.id}
                      showSpecialistColumn={showSpecialistColumn}
                      maxTouchpoints={maxTouchpoints}
                    />
                  ))
                )}
                {isDragTarget && (
                  <div className="rounded-lg border-2 border-dashed h-14 flex items-center justify-center" style={{ borderColor: 'rgba(87,94,207,0.4)' }}>
                    <span className="text-xs" style={{ color: '#575ECF' }}>Drop here</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Leads whose stage no longer exists — open one to move it, or remap them in Admin */}
        {!loading && stages?.length > 0 && otherLeads.length > 0 && (
          <div
            className="flex-shrink-0 rounded-xl flex flex-col"
            style={{ width: 228, backgroundColor: '#1f1f1f', border: '1px dashed rgba(245,158,11,0.4)', minHeight: 200 }}
          >
            <div className="px-3 pt-3 pb-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: '#f59e0b' }}>⚠ Missing stage</span>
                <span className="text-xs font-bold ml-1 flex-shrink-0" style={{ color: '#8a8680' }}>{otherLeads.length}</span>
              </div>
              <p className="text-[11px] mt-1" style={{ color: '#8a8680' }}>In a stage that was renamed, removed or turned off</p>
            </div>
            <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
              {otherLeads.map(lead => (
                <div key={lead.id}>
                  <p className="text-[10px] px-1 mb-1 truncate" style={{ color: '#f59e0b' }}>{lead.status}</p>
                  <KanbanCard
                    lead={lead}
                    stages={stages}
                    onLeadClick={onLeadClick}
                    onPeek={togglePeek}
                    peekOpen={peek?.lead.id === lead.id}
                    showSpecialistColumn={showSpecialistColumn}
                    maxTouchpoints={maxTouchpoints}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {peek && (
        <TouchpointPeek
          lead={peek.lead}
          anchor={peek.anchor}
          channelColors={channelColors}
          onClose={closePeek}
          onOpenLead={onLeadClick}
        />
      )}
    </div>
  )
}
