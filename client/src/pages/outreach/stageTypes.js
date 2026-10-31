// What a pipeline stage *means* comes from its type, not its name — so stages can be
// renamed freely without breaking metrics, overdue rules or the touchpoint/response loggers.

export const STAGE_TYPES = [
  { value: 'new',            label: 'New lead',           color: '#575ECF', hint: 'New leads start here' },
  { value: 'touchpoint',     label: 'Touchpoint',         color: '#14b8a6', hint: 'Opens the touchpoint logger — numbered in pipeline order' },
  { value: 'in_progress',    label: 'In progress',        color: '#3b82f6', hint: 'Any other working stage (calls, voicemail, replied…)' },
  { value: 'interested',     label: 'Interested',         color: '#a855f7', hint: 'Replied with interest — asks for their reply' },
  { value: 'not_interested', label: 'Not interested',     color: '#6b7280', hint: 'Replied, not interested — asks for their reply' },
  { value: 'booked',         label: 'Meeting booked',     color: '#f59e0b', hint: 'Appointment booked' },
  { value: 'no_show',        label: 'No show',            color: '#ef4444', hint: "Booked but didn't show up" },
  { value: 'meeting_lost',   label: 'Meeting — lost',     color: '#6b7280', hint: 'Met, not interested — asks for their reply' },
  { value: 'trial',          label: 'Trial',              color: '#06b6d4', hint: 'Started a trial' },
  { value: 'won',            label: 'Won',                color: '#22c55e', hint: 'Closed / booked as client' },
  { value: 'dead',           label: 'Dead / disqualified', color: '#6b7280', hint: 'Disqualified or dead' },
]

// Moving a lead into these stages asks for the lead's reply
const RESPONSE_TYPES = ['interested', 'not_interested', 'meeting_lost']
// Finished stages — follow-ups are never overdue
const CLOSED_TYPES = ['won', 'dead', 'meeting_lost', 'not_interested']

const FALLBACK = { bg: 'rgba(138,134,128,0.15)', color: '#8a8680', dot: '#8a8680' }

export function findStage(stages, name) {
  return (stages || []).find(s => s.name === name) || null
}

export function stageTypeMeta(type) {
  return STAGE_TYPES.find(t => t.value === type) || null
}

// { bg, color, dot } for a status pill / column header
export function stageColor(stages, name) {
  const meta = stageTypeMeta(findStage(stages, name)?.stage_type)
  if (!meta) return FALLBACK
  return { bg: `${meta.color}26`, color: meta.color, dot: meta.color }
}

// Touchpoint number for a touchpoint-type stage, else null
export function touchpointNumberOf(stages, name) {
  return findStage(stages, name)?.touchpoint_number || null
}

// A pipeline either has a stage per touchpoint ("Touchpoint 1", "Touchpoint 2"…) or a single
// touchpoint stage that every touchpoint lands in
export function hasNumberedTouchpointStages(stages) {
  return (stages || []).filter(s => s.stage_type === 'touchpoint').length > 1
}

// The stage touchpoint N moves a lead to
export function touchpointStageName(stages, number) {
  const list = stages || []
  const exact = list.find(s => s.touchpoint_number === number)
  if (exact) return exact.name
  if (hasNumberedTouchpointStages(list)) return null
  return list.find(s => s.stage_type === 'touchpoint')?.name || null
}

// Which touchpoint a move into `stageName` logs: the stage's own number when each touchpoint
// has a stage, otherwise the lead's next one. null when it isn't a touchpoint stage.
export function touchpointNumberForMove(stages, stageName, lastLogged) {
  const n = touchpointNumberOf(stages, stageName)
  if (!n) return null
  return hasNumberedTouchpointStages(stages) ? n : (lastLogged || 0) + 1
}

export function needsResponse(stages, name) {
  return RESPONSE_TYPES.includes(findStage(stages, name)?.stage_type)
}

export function isClosedStatus(stages, name) {
  return CLOSED_TYPES.includes(findStage(stages, name)?.stage_type)
}

// How many touchpoint sections a lead shows: the setting, or more if more stages exist
export function touchpointSlots(stages, maxTouchpoints) {
  const stageCount = (stages || []).filter(s => s.stage_type === 'touchpoint').length
  return Math.max(maxTouchpoints || 0, stageCount)
}

// The board groups stages into phases (by type, so renames don't matter)
export const PHASES = [
  { key: 'outreach',     label: 'Outreach',      types: ['new', 'touchpoint'] },
  { key: 'conversation', label: 'Conversations', types: ['in_progress', 'interested'] },
  { key: 'meetings',     label: 'Meetings',      types: ['booked', 'no_show', 'trial'] },
  { key: 'closed',       label: 'Closed',        types: ['won', 'not_interested', 'meeting_lost', 'dead'] },
]

export function phaseOf(type) {
  return PHASES.find(p => p.types.includes(type))?.key || 'conversation'
}

export function stageTypeOf(stages, name) {
  return findStage(stages, name)?.stage_type || null
}
