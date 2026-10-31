import { useState, useMemo, useCallback } from 'react'
import toast from 'react-hot-toast'
import { stageColor, PHASES, phaseOf } from '../stageTypes'
import { useChannelColors } from '../channels'
import TouchpointPeek from './TouchpointPeek'
import KanbanCard from './kanban/KanbanCard'
import { FollowUpMenu, MoveMenu } from './kanban/CardMenus'
import { leadSignals, FOCUS_FILTERS, SORTS } from './kanban/boardModel'

// The board is a daily work surface: phases group the stages, finished and empty
// columns fold into slim rails, focus filters answer "who do I contact now?",
// and every card carries its next action (follow-up, next touchpoint, move).

const LS_SORT = 'outreach_kanban_sort'
const LS_DENSITY = 'outreach_kanban_density'
const LS_COLUMNS = 'outreach_kanban_columns' // { [stage name]: 'open' | 'closed' } — user overrides
const COL_WIDTH = 272
const RAIL_WIDTH = 46
const PAGE = 40 // cards rendered per column before "Show more"
const MISSING = '__missing__'

function readLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback } catch { return fallback }
}
function writeLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* private mode */ }
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

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function Toolbar({ focus, setFocus, counts, sort, setSort, compact, setCompact }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Focus">
        {FOCUS_FILTERS.map(f => {
          const active = focus === f.key
          const n = counts[f.key] || 0
          const tone = f.tone || '#575ECF'
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFocus(active && f.key !== 'all' ? 'all' : f.key)}
              title={f.hint}
              aria-pressed={active}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors"
              style={{
                color: active ? '#fff' : n === 0 && f.key !== 'all' ? '#555' : '#c5c1b9',
                backgroundColor: active ? tone : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? tone : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              {f.key !== 'all' && !active && n > 0 && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tone }} />}
              {f.label}
              <span className="font-semibold" style={{ opacity: active ? 0.9 : 0.6 }}>{n}</span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs" style={{ color: '#8a8680' }}>
          Sort
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            title={SORTS.find(s => s.key === sort)?.hint}
            className="rounded-lg px-2 py-1 text-xs focus:outline-none cursor-pointer"
            style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.1)', color: '#c5c1b9', colorScheme: 'dark' }}
          >
            {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }} role="group" aria-label="Card density">
          {[[false, 'Detailed'], [true, 'Compact']].map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setCompact(value)}
              aria-pressed={compact === value}
              className="px-2.5 py-1 text-xs font-medium"
              style={compact === value ? { backgroundColor: 'rgba(87,94,207,0.35)', color: '#fff' } : { color: '#8a8680' }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Columns ──────────────────────────────────────────────────────────────────

// The card the dragged one would land above (null = the end), from the cursor's position
function cardBelowPointer(container, clientY, draggedId) {
  for (const el of container.querySelectorAll('[data-card-id]')) {
    const id = Number(el.dataset.cardId)
    if (id === draggedId) continue
    const r = el.getBoundingClientRect()
    if (clientY < r.top + r.height / 2) return id
  }
  return null
}

function dropProps(status, dropAt, setDropAt, draggedId, onDropLead) {
  return {
    onDragOver: e => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      const beforeId = cardBelowPointer(e.currentTarget, e.clientY, draggedId)
      if (dropAt?.status !== status || dropAt.beforeId !== beforeId) setDropAt({ status, beforeId })
    },
    onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropAt(null) },
    onDrop: e => {
      e.preventDefault()
      const id = parseInt(e.dataTransfer.getData('text/plain'))
      const beforeId = cardBelowPointer(e.currentTarget, e.clientY, id)
      setDropAt(null)
      if (id) onDropLead(id, status, beforeId)
    },
  }
}

// Where the dragged card will land
const DropLine = () => <div className="h-0.5 rounded-full -my-1" style={{ backgroundColor: '#575ECF', boxShadow: '0 0 6px #575ECF' }} />

// A folded column: name, count and overdue dot. Click to open; still a drop target.
function Rail({ column, isDragTarget, drop, onExpand }) {
  return (
    <button
      type="button"
      {...drop}
      onClick={onExpand}
      title={`${column.name} — ${column.items.length} lead${column.items.length === 1 ? '' : 's'}. Click to open.`}
      className="flex-shrink-0 rounded-xl flex flex-col items-center gap-2 py-3 transition-colors hover:bg-white/[0.04]"
      style={{
        width: RAIL_WIDTH,
        minHeight: 220,
        backgroundColor: isDragTarget ? 'rgba(87,94,207,0.12)' : '#1f1f1f',
        border: `1px solid ${isDragTarget ? 'rgba(87,94,207,0.5)' : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <span className="text-xs font-bold" style={{ color: column.items.length ? '#c5c1b9' : '#555' }}>{column.items.length}</span>
      {column.overdue > 0 && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#ef4444' }} title={`${column.overdue} overdue`} />}
      <span
        className="text-xs font-semibold whitespace-nowrap"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: column.color.color }}
      >
        {column.label}
      </span>
    </button>
  )
}

function Column({ column, isDragTarget, showDropBox, drop, onCollapse, children, footer }) {
  return (
    <div
      {...drop}
      className="flex-shrink-0 rounded-xl flex flex-col"
      style={{
        width: COL_WIDTH,
        minHeight: 220,
        backgroundColor: isDragTarget ? 'rgba(87,94,207,0.06)' : '#1f1f1f',
        border: `1px ${column.missing ? 'dashed' : 'solid'} ${isDragTarget ? 'rgba(87,94,207,0.4)' : column.missing ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.06)'}`,
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
    >
      <div className="px-3 pt-2.5 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: column.color.dot }} />
            <span className="text-xs font-semibold truncate" style={{ color: column.color.color }}>{column.label}</span>
            <span className="text-xs font-bold" style={{ color: '#8a8680' }}>{column.items.length}</span>
          </div>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              title="Fold this column"
              aria-label={`Fold ${column.label}`}
              className="w-6 h-6 inline-flex items-center justify-center rounded-md hover:bg-white/10"
              style={{ color: '#8a8680' }}
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
        </div>
        {(column.overdue > 0 || column.dueToday > 0 || column.missing) && (
          <p className="text-[11px] mt-1" style={{ color: '#8a8680' }}>
            {column.missing && <span style={{ color: '#f59e0b' }}>Stage renamed or removed — move these on</span>}
            {column.overdue > 0 && <span style={{ color: '#ef4444' }}>{column.overdue} overdue</span>}
            {column.overdue > 0 && column.dueToday > 0 && ' · '}
            {column.dueToday > 0 && <span style={{ color: '#f59e0b' }}>{column.dueToday} due today</span>}
          </p>
        )}
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
        {children}
        {isDragTarget && showDropBox && (
          <div className="rounded-lg border-2 border-dashed h-12 flex items-center justify-center" style={{ borderColor: 'rgba(87,94,207,0.4)' }}>
            <span className="text-xs" style={{ color: '#575ECF' }}>Drop here</span>
          </div>
        )}
        {footer}
      </div>
    </div>
  )
}

// ─── Board ────────────────────────────────────────────────────────────────────

export default function PipelineKanban({
  leads, loading, onLeadClick, onStatusChange, onFollowUpChange, onReorder, showSpecialistColumn, stages = [], maxTouchpoints = 5,
}) {
  const channelColors = useChannelColors()
  const [focus, setFocus] = useState('all')
  const [sort, setSortState] = useState(() => readLS(LS_SORT, 'priority'))
  const [compact, setCompactState] = useState(() => readLS(LS_DENSITY, false))
  const [columnPrefs, setColumnPrefs] = useState(() => readLS(LS_COLUMNS, {}))
  const [shown, setShown] = useState({}) // { [column key]: cards rendered }
  const [dragging, setDragging] = useState(null) // { leadId, status } of the card being dragged
  const [dropAt, setDropAt] = useState(null) // { status, beforeId } — where it would land
  const [menu, setMenu] = useState(null) // { lead, leadId, type, anchor }

  const setSort = v => { setSortState(v); writeLS(LS_SORT, v) }
  const setCompact = v => { setCompactState(v); writeLS(LS_DENSITY, v) }
  const setColumnPref = (key, value) => setColumnPrefs(prev => {
    const next = { ...prev, [key]: value }
    writeLS(LS_COLUMNS, next)
    return next
  })

  const onMenu = useCallback((lead, type, anchor) => {
    setMenu(prev => (prev?.leadId === lead.id && prev.type === type ? null : { lead, leadId: lead.id, type, anchor }))
  }, [])
  const closeMenu = useCallback(() => setMenu(null), [])
  const logTouchpoint = useCallback((lead, stageName) => onStatusChange(lead.id, stageName), [onStatusChange])
  const startDrag = useCallback(lead => setDragging({ leadId: lead.id, status: lead.status }), [])
  const endDrag = useCallback(() => { setDragging(null); setDropAt(null) }, [])

  const items = useMemo(() => leads.map(lead => ({ lead, s: leadSignals(lead, stages) })), [leads, stages])

  const counts = useMemo(() => Object.fromEntries(
    FOCUS_FILTERS.map(f => [f.key, items.filter(it => f.test(it.s)).length]),
  ), [items])

  // Columns grouped into phases, filtered by focus and sorted
  const phases = useMemo(() => {
    const test = (FOCUS_FILTERS.find(f => f.key === focus) || FOCUS_FILTERS[0]).test
    const compare = (SORTS.find(s => s.key === sort) || SORTS[0]).compare
    const names = new Set(stages.map(s => s.name))
    const byStatus = {}
    items.forEach(it => {
      if (!test(it.s)) return
      const key = names.has(it.lead.status) ? it.lead.status : MISSING
      ;(byStatus[key] = byStatus[key] || []).push(it)
    })
    const makeColumn = (key, label, type, extra = {}) => {
      const list = (byStatus[key] || []).sort(compare)
      return {
        key, label, name: key, type, items: list,
        color: key === MISSING ? { color: '#f59e0b', dot: '#f59e0b' } : stageColor(stages, key),
        overdue: list.filter(it => it.s.followup === 'overdue').length,
        dueToday: list.filter(it => it.s.followup === 'today').length,
        ...extra,
      }
    }
    const groups = PHASES.map(phase => ({
      ...phase,
      columns: stages.filter(s => phaseOf(s.stage_type) === phase.key).map(s => makeColumn(s.name, s.name, s.stage_type)),
    })).filter(p => p.columns.length)
    if (byStatus[MISSING]?.length) {
      groups.push({ key: 'missing', label: 'Needs a stage', columns: [makeColumn(MISSING, 'Missing stage', null, { missing: true })] })
    }
    return groups
  }, [items, stages, focus, sort])

  const isOpen = (column, phaseKey) => {
    const pref = columnPrefs[column.key]
    if (pref) return pref === 'open'
    // Defaults: finished stages and empty columns fold away
    return phaseKey !== 'closed' && column.items.length > 0
  }

  // A column's lead IDs top to bottom (ignoring the focus filter), with `leadId` placed above `beforeId`
  const orderWith = (status, leadId, beforeId, compare) => {
    const ids = items.filter(it => it.lead.status === status && it.lead.id !== leadId)
      .sort(compare).map(it => it.lead.id)
    const at = beforeId ? ids.indexOf(beforeId) : -1
    ids.splice(at === -1 ? ids.length : at, 0, leadId)
    return ids
  }
  const manualCompare = SORTS.find(s => s.key === 'manual').compare

  const handleDropLead = (leadId, status, beforeId) => {
    endDrag()
    if (status === MISSING) return
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return
    if (lead.status === status) {
      // Re-arranging within a column: keep the order as it looks now, with this card moved
      if (beforeId === leadId) return
      const current = (SORTS.find(s => s.key === sort) || SORTS[0]).compare
      onReorder(orderWith(status, leadId, beforeId, current))
      if (sort !== 'manual') {
        setSort('manual')
        toast.success('Switched to Custom order — drag cards to arrange them')
      }
      return
    }
    // Into another column: in Custom order it lands where it was dropped, otherwise per the sort
    const place = sort === 'manual' && beforeId !== undefined
      ? () => onReorder(orderWith(status, leadId, beforeId, manualCompare))
      : undefined
    onStatusChange(leadId, status, place)
  }

  const slots = maxTouchpoints

  return (
    <div>
      <Toolbar
        focus={focus} setFocus={setFocus} counts={counts}
        sort={sort} setSort={setSort} compact={compact} setCompact={setCompact}
      />

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 items-start" style={{ width: 'max-content' }}>
          {phases.map(phase => {
            const total = phase.columns.reduce((n, c) => n + c.items.length, 0)
            return (
              <section key={phase.key} aria-label={phase.label}>
                <div className="flex items-baseline gap-2 px-1 mb-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#8a8680' }}>{phase.label}</h3>
                  <span className="text-[11px]" style={{ color: '#555' }}>{total}</span>
                </div>
                <div className="flex gap-2 items-start">
                  {phase.columns.map(column => {
                    const drop = dropProps(column.key, dropAt, setDropAt, dragging?.leadId, handleDropLead)
                    const isDragTarget = dropAt?.status === column.key
                    // Shows exactly where the card will go when that position is kept
                    const positional = isDragTarget && (sort === 'manual' || dragging?.status === column.key)
                    if (!loading && !isOpen(column, phase.key)) {
                      return (
                        <Rail key={column.key} column={column} isDragTarget={isDragTarget}
                          drop={{
                            ...drop,
                            // A folded column has no visible spot to aim for — the lead arrives at the top
                            onDrop: e => {
                              e.preventDefault()
                              setDropAt(null)
                              const id = parseInt(e.dataTransfer.getData('text/plain'))
                              if (id) handleDropLead(id, column.key, undefined)
                            },
                          }}
                          onExpand={() => setColumnPref(column.key, 'open')} />
                      )
                    }
                    const limit = shown[column.key] || PAGE
                    const hidden = column.items.length - limit
                    return (
                      <Column
                        key={column.key}
                        column={column}
                        isDragTarget={isDragTarget}
                        showDropBox={!positional}
                        drop={drop}
                        onCollapse={column.missing ? null : () => setColumnPref(column.key, 'closed')}
                        footer={hidden > 0 && (
                          <button
                            type="button"
                            onClick={() => setShown(prev => ({ ...prev, [column.key]: limit + PAGE }))}
                            className="w-full rounded-lg py-2 text-xs font-medium hover:bg-white/[0.06]"
                            style={{ color: '#8a8680', border: '1px dashed rgba(255,255,255,0.1)' }}
                          >
                            Show {Math.min(PAGE, hidden)} more of {hidden}
                          </button>
                        )}
                      >
                        {loading ? (
                          <><SkeletonCard /><SkeletonCard /></>
                        ) : column.items.length === 0 ? (
                          <div className="flex items-center justify-center h-16">
                            <span className="text-xs" style={{ color: '#444' }}>{focus === 'all' ? 'No leads' : 'Nothing here for this filter'}</span>
                          </div>
                        ) : (
                          <>
                          {column.items.slice(0, limit).map(({ lead, s }) => (
                            <div key={lead.id} className="space-y-2">
                            {positional && dropAt.beforeId === lead.id && <DropLine />}
                            <KanbanCard
                              lead={lead}
                              s={s}
                              slots={slots}
                              compact={compact}
                              showSpecialist={showSpecialistColumn}
                              channelColors={channelColors}
                              menuType={menu?.leadId === lead.id ? menu.type : null}
                              onMenu={onMenu}
                              onOpen={onLeadClick}
                              onLogTouchpoint={logTouchpoint}
                              isDragging={dragging?.leadId === lead.id}
                              onDragStart={startDrag}
                              onDragEnd={endDrag}
                            />
                            </div>
                          ))}
                          {positional && dropAt.beforeId === null && <DropLine />}
                          </>
                        )}
                      </Column>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      {menu?.type === 'peek' && (
        <TouchpointPeek lead={menu.lead} anchor={menu.anchor} channelColors={channelColors} onClose={closeMenu} onOpenLead={onLeadClick} />
      )}
      {menu?.type === 'followup' && (
        <FollowUpMenu lead={menu.lead} anchor={menu.anchor} onClose={closeMenu} onSet={onFollowUpChange} />
      )}
      {menu?.type === 'move' && (
        <MoveMenu lead={menu.lead} anchor={menu.anchor} stages={stages} onClose={closeMenu} onMove={onStatusChange} />
      )}
    </div>
  )
}
