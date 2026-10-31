import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { fmtDate } from '../../../../utils/dates'
import { PHASES, phaseOf, stageColor } from '../../stageTypes'
import { useAnchoredPosition, useDismiss } from './useAnchored'
import { addDays } from './boardModel'

const WIDTH = 236

function MenuShell({ anchor, onClose, label, children }) {
  const ref = useRef(null)
  const pos = useAnchoredPosition(anchor, WIDTH, 220)
  useDismiss(ref, onClose)
  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      className="fixed z-[60] rounded-xl overflow-y-auto p-1"
      style={{
        width: WIDTH, left: pos.left, top: pos.top, bottom: pos.bottom, maxHeight: Math.min(pos.maxHeight, 420),
        backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
      }}
    >
      {children}
    </div>,
    document.body,
  )
}

function Item({ onClick, active, children, hint }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-2 text-left text-[13px] px-2.5 py-1.5 rounded-md hover:bg-white/[0.06]"
      style={{ color: '#c5c1b9', backgroundColor: active ? 'rgba(87,94,207,0.18)' : undefined }}
    >
      <span className="flex items-center gap-2 min-w-0">{children}</span>
      {hint && <span className="text-[11px] shrink-0" style={{ color: '#8a8680' }}>{hint}</span>}
    </button>
  )
}

const Heading = ({ children }) => (
  <p className="text-[10px] uppercase tracking-wide font-semibold px-2.5 pt-2 pb-1" style={{ color: '#8a8680' }}>{children}</p>
)

// Set or clear the next follow-up date in one click
export function FollowUpMenu({ lead, anchor, onClose, onSet }) {
  const set = (date) => { onSet(lead.id, date); onClose() }
  const presets = [
    ['Today', 0], ['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7], ['In 2 weeks', 14],
  ]
  return (
    <MenuShell anchor={anchor} onClose={onClose} label={`Follow-up for ${lead.company_name}`}>
      <Heading>Next follow-up</Heading>
      {presets.map(([label, n]) => {
        const date = addDays(n)
        return <Item key={label} onClick={() => set(date)} active={lead.next_followup_date === date} hint={fmtDate(date)}>{label}</Item>
      })}
      <div className="px-2.5 py-1.5">
        <input
          type="date"
          aria-label="Pick a date"
          defaultValue={lead.next_followup_date || ''}
          onChange={e => e.target.value && set(e.target.value)}
          className="w-full rounded-md px-2 py-1 text-[13px] focus:outline-none"
          style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', color: '#c5c1b9', colorScheme: 'dark' }}
        />
      </div>
      {lead.next_followup_date && (
        <Item onClick={() => set(null)}><span style={{ color: '#ef4444' }}>Clear follow-up</span></Item>
      )}
    </MenuShell>
  )
}

// Move to any stage without dragging across the board
export function MoveMenu({ lead, anchor, stages, onClose, onMove }) {
  return (
    <MenuShell anchor={anchor} onClose={onClose} label={`Move ${lead.company_name}`}>
      {PHASES.map(phase => {
        const inPhase = stages.filter(s => phaseOf(s.stage_type) === phase.key)
        if (!inPhase.length) return null
        return (
          <div key={phase.key}>
            <Heading>{phase.label}</Heading>
            {inPhase.map(stage => {
              const current = stage.name === lead.status
              return (
                <Item
                  key={stage.id}
                  active={current}
                  hint={current ? 'current' : null}
                  onClick={() => { onClose(); if (!current) onMove(lead.id, stage.name) }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stageColor(stages, stage.name).dot }} />
                  <span className="truncate">{stage.name}</span>
                </Item>
              )
            })}
          </div>
        )
      })}
    </MenuShell>
  )
}
