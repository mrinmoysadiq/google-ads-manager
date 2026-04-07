import { useState, useRef } from 'react'

const DEFAULT_STATUS_COLORS = {
  'New Lead':                        { bg: 'rgba(87,94,207,0.15)',  color: '#575ECF',  dot: '#575ECF'  },
  'Touchpoint 1':                    { bg: 'rgba(20,184,166,0.15)', color: '#14b8a6',  dot: '#14b8a6'  },
  'Touchpoint 2':                    { bg: 'rgba(20,184,166,0.15)', color: '#14b8a6',  dot: '#14b8a6'  },
  'Touchpoint 3':                    { bg: 'rgba(20,184,166,0.15)', color: '#14b8a6',  dot: '#14b8a6'  },
  'Touchpoint 4':                    { bg: 'rgba(20,184,166,0.15)', color: '#14b8a6',  dot: '#14b8a6'  },
  'Touchpoint 5':                    { bg: 'rgba(20,184,166,0.15)', color: '#14b8a6',  dot: '#14b8a6'  },
  'Contacted':                       { bg: 'rgba(138,134,128,0.15)', color: '#8a8680', dot: '#8a8680'  },
  'Responded':                       { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6', dot: '#3b82f6'  },
  'Interested':                      { bg: 'rgba(168,85,247,0.15)',  color: '#a855f7', dot: '#a855f7'  },
  'Appointment Booked':              { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b', dot: '#f59e0b'  },
  'No Show':                         { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444', dot: '#ef4444'  },
  'Meeting Done - Not Interested':   { bg: 'rgba(107,114,128,0.15)', color: '#6b7280', dot: '#6b7280'  },
  'Started Trial':                   { bg: 'rgba(6,182,212,0.15)',   color: '#06b6d4', dot: '#06b6d4'  },
  'Closed / Booked as Client':       { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e', dot: '#22c55e'  },
  'Disqualified / Dead':             { bg: 'rgba(55,65,81,0.2)',     color: '#6b7280', dot: '#374151'  },
}

const FALLBACK_COLOR = { bg: 'rgba(138,134,128,0.15)', color: '#8a8680', dot: '#8a8680' }

const CHANNEL_COLORS = {
  'LinkedIn': '#0a66c2', 'Email': '#575ECF', 'WhatsApp': '#25d366',
  'Facebook': '#1877f2', 'Instagram': '#e1306c', 'SMS': '#8a8680',
  'Website Form': '#06b6d4', 'Other': '#6b7280',
}

const NOT_OVERDUE_STATUSES = ['Closed / Booked as Client', 'Disqualified / Dead', 'Meeting Done - Not Interested']

function isOverdue(lead) {
  if (!lead.next_followup_date) return false
  if (NOT_OVERDUE_STATUSES.includes(lead.status)) return false
  return lead.next_followup_date < new Date().toISOString().slice(0, 10)
}

function daysOverdue(dateStr) {
  return Math.floor((new Date() - new Date(dateStr)) / 86400000)
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ChannelPills({ channels }) {
  if (!channels || channels.length === 0) return null
  return (
    <div className="flex gap-1 flex-wrap mt-1.5">
      {channels.slice(0, 3).map(ch => (
        <span key={ch} className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${CHANNEL_COLORS[ch] || '#6b7280'}22`, color: CHANNEL_COLORS[ch] || '#6b7280' }}>
          {ch}
        </span>
      ))}
      {channels.length > 3 && (
        <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: '#8a8680', backgroundColor: 'rgba(255,255,255,0.05)' }}>+{channels.length - 3}</span>
      )}
    </div>
  )
}

function KanbanCard({ lead, onLeadClick, showSpecialistColumn, maxTouchpoints }) {
  const dragStarted = useRef(false)
  const overdue = isOverdue(lead)
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
      style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.06)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; e.currentTarget.style.backgroundColor = '#313131' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.backgroundColor = '#2a2a2a' }}
    >
      <p className="text-sm font-semibold text-white leading-snug">{lead.company_name}</p>
      {(lead.contact_name || lead.job_title) && (
        <p className="text-xs mt-0.5" style={{ color: '#8a8680' }}>
          {[lead.contact_name, lead.job_title].filter(Boolean).join(' · ')}
        </p>
      )}
      <ChannelPills channels={lead.channels_used} />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs" style={{ color: '#8a8680' }}>
          {lead.touchpoint_count || 0}/{maxTouchpoints} TPs
        </span>
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

  const stageNames = stages && stages.length > 0 ? stages.map(s => s.name) : DEFAULT_STAGES

  const leadsByStatus = {}
  stageNames.forEach(s => { leadsByStatus[s] = [] })
  leads.forEach(l => {
    if (leadsByStatus[l.status] !== undefined) {
      leadsByStatus[l.status].push(l)
    } else {
      // Lead has a status not in current stages — put in first column or skip
      if (stageNames.length > 0) {
        if (!leadsByStatus['__other__']) leadsByStatus['__other__'] = []
        leadsByStatus['__other__'].push(l)
      }
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

  return (
    <div className="overflow-x-auto pb-4" style={{ minHeight: 400 }}>
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
                      onLeadClick={onLeadClick}
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
      </div>
    </div>
  )
}
