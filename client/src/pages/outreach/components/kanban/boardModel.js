import { todayLocal } from '../../../../utils/dates'
import { isClosedStatus, stageTypeOf, touchpointNumberOf, touchpointStageName, hasNumberedTouchpointStages } from '../../stageTypes'

// ─── Dates ────────────────────────────────────────────────────────────────────

const DAY = 86400000
const dayValue = (ymd) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10))

// Whole days from `ymd` ("YYYY-MM-DD") to today; positive = in the past
export function daysAgo(ymd) {
  if (!ymd) return null
  return Math.round((dayValue(todayLocal()) - dayValue(ymd.slice(0, 10))) / DAY)
}

export function addDays(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// status_updated_at is a UTC "YYYY-MM-DD HH:MM:SS" — convert to the local calendar day
function localDay(utcDateTime) {
  if (!utcDateTime) return null
  const d = new Date(utcDateTime.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return utcDateTime.slice(0, 10)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function relDays(n) {
  if (n === null || n === undefined) return ''
  if (n <= 0) return 'today'
  if (n === 1) return 'yesterday'
  if (n < 30) return `${n}d ago`
  if (n < 365) return `${Math.round(n / 30)}mo ago`
  return `${Math.round(n / 365)}y ago`
}

// ─── Per-lead signals ─────────────────────────────────────────────────────────

const HOT_TYPES = ['interested', 'booked', 'trial']
const LOGGABLE_TYPES = ['new', 'touchpoint'] // still in outreach — later stages move on via the Move menu
export const COLD_AFTER_DAYS = 7

// Everything a card and the focus filters need, computed once per lead
export function leadSignals(lead, stages) {
  const type = stageTypeOf(stages, lead.status)
  const closed = isClosedStatus(stages, lead.status)
  const followupIn = lead.next_followup_date ? -daysAgo(lead.next_followup_date) : null
  const followup = closed || followupIn === null ? 'none'
    : followupIn < 0 ? 'overdue'
    : followupIn === 0 ? 'today'
    : 'upcoming'

  // Most recent thing that happened: a touchpoint, a reply, or a stage move
  const touchDay = lead.last_touchpoint_date || null
  const replyDay = lead.last_response_date || null
  const movedDay = localDay(lead.status_updated_at)
  const lastActivity = [touchDay, replyDay, movedDay].filter(Boolean).sort().pop() || null
  const quietDays = daysAgo(lastActivity)
  const repliedLast = !!replyDay && (!touchDay || replyDay >= touchDay)

  // With a stage per touchpoint, sitting in "Touchpoint 3" means three are done even if unlogged
  const stageTp = hasNumberedTouchpointStages(stages) ? touchpointNumberOf(stages, lead.status) || 0 : 0
  const nextTp = Math.max(lead.last_touchpoint_number || 0, stageTp) + 1
  const nextTpStage = LOGGABLE_TYPES.includes(type) ? touchpointStageName(stages, nextTp) : null

  return {
    type,
    closed,
    followup,
    followupIn,
    overdueDays: followup === 'overdue' ? -followupIn : 0,
    lastActivity,
    quietDays,
    daysInStage: daysAgo(movedDay),
    repliedLast,
    nextTp,
    nextTpStage,
    hot: HOT_TYPES.includes(type),
    untouched: type === 'new' && !(lead.touchpoint_count > 0),
    cold: !closed && !lead.next_followup_date && quietDays !== null && quietDays >= COLD_AFTER_DAYS,
  }
}

// ─── Focus filters ────────────────────────────────────────────────────────────

export const FOCUS_FILTERS = [
  { key: 'all',       label: 'All leads',      hint: 'Every lead on the board',                                    test: () => true },
  { key: 'overdue',   label: 'Overdue',        hint: 'Follow-up date has passed',                                  test: s => s.followup === 'overdue', tone: '#ef4444' },
  { key: 'today',     label: 'Due today',      hint: 'Follow-up is due today',                                     test: s => s.followup === 'today', tone: '#f59e0b' },
  { key: 'untouched', label: 'Not contacted',  hint: 'New leads with no touchpoint yet',                           test: s => s.untouched, tone: '#575ECF' },
  { key: 'cold',      label: 'Going cold',     hint: `No follow-up set and nothing logged for ${COLD_AFTER_DAYS}+ days`, test: s => s.cold, tone: '#3b82f6' },
  { key: 'hot',       label: 'Hot',            hint: 'Interested, meeting booked or on trial',                     test: s => s.hot, tone: '#a855f7' },
]

// ─── Sorting within a column ──────────────────────────────────────────────────

const FOLLOWUP_RANK = { overdue: 0, today: 1, none: 2, upcoming: 3 }

export const SORTS = [
  {
    key: 'priority',
    label: 'Priority',
    hint: 'Overdue first, then due today, then leads with no follow-up (quietest first), then upcoming',
    compare: (a, b) =>
      (FOLLOWUP_RANK[a.s.followup] - FOLLOWUP_RANK[b.s.followup]) ||
      (a.s.followup === 'overdue' ? b.s.overdueDays - a.s.overdueDays : 0) ||
      (a.s.followup === 'upcoming' ? a.s.followupIn - b.s.followupIn : 0) ||
      ((b.s.quietDays ?? 1e9) - (a.s.quietDays ?? 1e9)),
  },
  {
    key: 'manual',
    label: 'Custom order (drag to arrange)',
    hint: 'Drag cards up and down to arrange them. Leads that just arrived in a stage show at the top.',
    compare: (a, b) => {
      const pa = a.lead.board_position, pb = b.lead.board_position
      const unplacedA = pa === null || pa === undefined
      const unplacedB = pb === null || pb === undefined
      if (unplacedA !== unplacedB) return unplacedA ? -1 : 1
      if (unplacedA) return (b.lead.status_updated_at || '').localeCompare(a.lead.status_updated_at || '')
      return pa - pb
    },
  },
  {
    key: 'quiet',
    label: 'Longest without contact',
    compare: (a, b) => (b.s.quietDays ?? 1e9) - (a.s.quietDays ?? 1e9),
  },
  {
    key: 'moved',
    label: 'Recently moved',
    compare: (a, b) => (b.lead.status_updated_at || '').localeCompare(a.lead.status_updated_at || ''),
  },
  {
    key: 'newest',
    label: 'Newest leads',
    compare: (a, b) => (b.lead.created_at || '').localeCompare(a.lead.created_at || ''),
  },
  {
    key: 'company',
    label: 'Company A–Z',
    compare: (a, b) => (a.lead.company_name || '').localeCompare(b.lead.company_name || '', undefined, { sensitivity: 'base' }),
  },
]
