import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../../utils/lmsApi'
import { fmtDate } from '../../utils/dates'
import toast from 'react-hot-toast'
import Select from 'react-select'

const DEFAULT_STAGES = ['Assigned', 'In Progress', 'Notes Submitted', 'Assessed', 'Needs Revision', 'Completed']
const DEFAULT_COLORS = {
  'Assigned': '#8a8680', 'In Progress': '#575ECF', 'Notes Submitted': '#f59e0b',
  'Assessed': '#3b82f6', 'Needs Revision': '#ef4444', 'Completed': '#22c55e',
}

// ── Notification helpers ──────────────────────────────────────────────────────
function seenKey(userId, topicId) { return `lms_seen_${userId}_${topicId}` }
function getSeen(userId, topicId) {
  try { return JSON.parse(localStorage.getItem(seenKey(userId, topicId))) || { c: 0, a: 0 } }
  catch { return { c: 0, a: 0 } }
}
function getStageColor(stagesData, name) {
  const found = stagesData?.find(s => s.name === name)
  return found?.color || DEFAULT_COLORS[name] || '#8a8680'
}

const selectStyles = {
  control: (b, s) => ({ ...b, backgroundColor: '#1b1b1b', borderColor: s.isFocused ? '#575ECF' : 'rgba(255,255,255,0.12)', borderRadius: '8px', boxShadow: 'none', minHeight: '36px', '&:hover': { borderColor: '#575ECF' } }),
  menu: b => ({ ...b, backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }),
  option: (b, s) => ({ ...b, backgroundColor: s.isSelected ? '#575ECF' : s.isFocused ? 'rgba(87,94,207,0.15)' : 'transparent', color: '#c5c1b9', cursor: 'pointer', fontSize: '13px' }),
  singleValue: b => ({ ...b, color: '#c5c1b9', fontSize: '13px' }),
  input: b => ({ ...b, color: '#c5c1b9' }),
  placeholder: b => ({ ...b, color: '#8a8680', fontSize: '13px' }),
}

function inputCls() {
  return 'w-full bg-[#1b1b1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#c5c1b9] outline-none focus:border-[#575ECF] placeholder-[#8a8680]'
}

function StageBadge({ stage }) {
  const color = DEFAULT_COLORS[stage] || '#8a8680'
  return <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${color}20`, color }}>{stage}</span>
}

function StarRating({ value }) {
  return (
    <span className="text-sm" style={{ color: '#f59e0b' }}>
      {'★'.repeat(value)}{'☆'.repeat(5 - value)}
    </span>
  )
}

const formatDate = fmtDate

function isOverdue(topic) {
  if (!topic.due_date || topic.stage === 'Completed') return false
  return topic.due_date < new Date().toISOString().split('T')[0]
}

// ── Assign Topic Drawer ───────────────────────────────────────────────────────
function AssignDrawer({ users, templates, onClose, onAssigned, managerId }) {
  const [tab, setTab] = useState('template')
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', resources: [], assignee_id: null, due_date: '', is_sequential: false })

  function applyTemplate(t) {
    setSelectedTemplate(t)
    setForm(f => ({ ...f, title: t.title, description: t.description || '', resources: t.resources || [] }))
  }

  function addResource() { setForm(f => ({ ...f, resources: [...f.resources, { label: '', url: '' }] })) }
  function updateResource(i, field, val) {
    setForm(f => { const res = [...f.resources]; res[i] = { ...res[i], [field]: val }; return { ...f, resources: res } })
  }
  function removeResource(i) { setForm(f => ({ ...f, resources: f.resources.filter((_, j) => j !== i) })) }

  async function assign() {
    if (!form.title.trim()) return toast.error('Title required')
    if (!form.assignee_id) return toast.error('Assignee required')
    try {
      await api.post('/lms/topics', {
        title: form.title,
        description: form.description,
        resources: form.resources,
        assignee_id: form.assignee_id,
        assigned_by: managerId,
        template_id: selectedTemplate?.id || null,
        is_sequential: form.is_sequential,
        due_date: form.due_date || null,
      })
      toast.success('Topic assigned!')
      onAssigned()
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error assigning topic')
    }
  }

  const employeeOptions = users.filter(u => u.role === 'employee').map(u => ({ value: u.id, label: u.name }))

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[#242424] border-l border-white/10 w-full max-w-md h-full overflow-y-auto shadow-2xl">
        <div className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-[#c5c1b9]">Assign Topic</h2>
            <button onClick={onClose} className="text-[#8a8680] hover:text-[#c5c1b9] text-xl">✕</button>
          </div>

          {/* Source tabs */}
          <div className="flex gap-1 bg-[#1b1b1b] rounded-lg p-1 mb-4">
            {[{ id: 'template', label: 'From Template' }, { id: 'custom', label: 'Custom Topic' }].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 py-1.5 rounded-md text-xs font-medium transition-colors"
                style={{ backgroundColor: tab === t.id ? '#575ECF' : 'transparent', color: tab === t.id ? '#fff' : '#8a8680' }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Template picker */}
          {tab === 'template' && (
            <div className="mb-4">
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className="w-full text-left p-3 rounded-lg border transition-colors"
                    style={{
                      backgroundColor: selectedTemplate?.id === t.id ? '#575ECF18' : '#1b1b1b',
                      borderColor: selectedTemplate?.id === t.id ? '#575ECF' : 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <p className="text-sm font-medium text-[#c5c1b9]">{t.title}</p>
                    {t.suggested_days && <p className="text-xs text-[#8a8680] mt-0.5">{t.suggested_days} days suggested</p>}
                  </button>
                ))}
                {templates.length === 0 && <p className="text-sm text-[#8a8680] text-center py-4">No templates yet</p>}
              </div>
            </div>
          )}

          {/* Form fields */}
          <div className="space-y-3">
            <input className={inputCls()} placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <textarea className={inputCls() + ' resize-none h-20'} placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

            <div>
              <Select
                options={employeeOptions}
                value={employeeOptions.find(o => o.value === form.assignee_id) || null}
                onChange={o => setForm(f => ({ ...f, assignee_id: o?.value || null }))}
                styles={selectStyles}
                placeholder="Assign to..."
                isClearable
              />
            </div>

            <input
              className={inputCls()}
              type="date"
              value={form.due_date}
              onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
            />

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_sequential}
                onChange={e => setForm(f => ({ ...f, is_sequential: e.target.checked }))}
                className="accent-[#575ECF]"
              />
              <span className="text-sm text-[#c5c1b9]">Sequential (informational)</span>
            </label>

            {/* Resources */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-[#8a8680]">Resources</p>
                <button onClick={addResource} className="text-xs text-[#575ECF]">+ Add</button>
              </div>
              <div className="space-y-2">
                {form.resources.map((r, i) => (
                  <div key={i} className="flex gap-2">
                    <input className={inputCls() + ' flex-1'} placeholder="Label" value={r.label} onChange={e => updateResource(i, 'label', e.target.value)} />
                    <input className={inputCls() + ' flex-1'} placeholder="URL" value={r.url} onChange={e => updateResource(i, 'url', e.target.value)} />
                    <button onClick={() => removeResource(i)} className="text-[#ef4444] text-sm">✕</button>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={assign} className="w-full py-3 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: '#575ECF' }}>
              Assign Topic
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const IconUser = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)
const IconChat = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
)
const IconStarFill = () => (
  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
)
const IconCalendar = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

// ── Topic Card (Manager) ──────────────────────────────────────────────────────
function ManagerTopicCard({ topic, userId, onDragStart }) {
  const overdue = isOverdue(topic)
  const seen = getSeen(userId, topic.id)
  const newComments = Math.max(0, (topic.comment_count || 0) - seen.c)
  const newAssessments = Math.max(0, (topic.assessment_count || 0) - seen.a)
  const hasNew = newComments > 0 || newAssessments > 0

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('topic_id', topic.id); e.dataTransfer.setData('from_stage', topic.stage); onDragStart(topic.stage) }}
      className="group relative rounded-xl p-4 cursor-grab active:cursor-grabbing transition-all duration-150"
      style={{
        backgroundColor: '#252525',
        border: `1px solid ${hasNew ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: hasNew
          ? '0 0 0 1px rgba(245,158,11,0.1), 0 2px 8px rgba(0,0,0,0.3)'
          : '0 1px 3px rgba(0,0,0,0.25)',
      }}
    >
      {/* Notification pulse dot */}
      {hasNew && (
        <span className="absolute top-3 right-3 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: '#f59e0b' }} />
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: '#f59e0b' }} />
        </span>
      )}

      {/* Title */}
      <Link to={`/learning/topic/${topic.id}`} onClick={e => e.stopPropagation()}>
        <p className="text-[13px] font-semibold leading-snug text-[#d4cfc7] group-hover:text-white transition-colors line-clamp-2 mb-3 pr-4">
          {topic.title}
        </p>
      </Link>

      {/* Assignee */}
      {topic.assignee_name && (
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-[#8a8680]"><IconUser /></span>
          <span className="text-xs text-[#8a8680] truncate">{topic.assignee_name}</span>
        </div>
      )}

      {/* Notification badges */}
      {(newComments > 0 || newAssessments > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {newComments > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#575ECF18', color: '#818cf8' }}>
              <IconChat /> {newComments} new
            </span>
          )}
          {newAssessments > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f59e0b18', color: '#fbbf24' }}>
              <IconStarFill /> {newAssessments} new
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2">
          {topic.latest_rating ? (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: '#fbbf24' }}>
              {'★'.repeat(topic.latest_rating)}
            </span>
          ) : null}
          {topic.comment_count > 0 && newComments === 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-[#8a8680]">
              <IconChat /> {topic.comment_count}
            </span>
          )}
        </div>
        {topic.due_date ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: overdue ? '#f87171' : '#6b7280' }}>
            <IconCalendar />
            {formatDate(topic.due_date)}
            {overdue && <span className="ml-0.5 text-[10px] font-bold">OVERDUE</span>}
          </span>
        ) : (
          <span className="text-[11px] text-[#8a8680]/30">No deadline</span>
        )}
      </div>
    </div>
  )
}

// ── Assessment Modal (triggered when dragging to Assessed) ────────────────────
function AssessmentModal({ topic, managerId, onSubmit, onClose }) {
  const [stars, setStars] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(decision) {
    if (!stars) return toast.error('Please select a star rating')
    if (!feedback.trim()) return toast.error('Feedback is required')
    setSubmitting(true)
    try {
      await api.post('/lms/assessments', { topic_id: topic.id, assessor_id: managerId, star_rating: stars, feedback, decision })
      onSubmit(decision === 'completed' ? 'Completed' : 'Needs Revision')
      toast.success('Assessment submitted')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error')
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#242424] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-bold text-[#c5c1b9] mb-1">Assess: {topic.title}</h3>
        <p className="text-sm text-[#8a8680] mb-4">Submit your assessment before changing the stage.</p>

        <div className="mb-4">
          <p className="text-xs text-[#8a8680] mb-2">Star Rating</p>
          <div className="flex gap-1">
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setStars(n)} className="text-2xl" style={{ color: n <= stars ? '#f59e0b' : '#8a8680' }}>
                {n <= stars ? '★' : '☆'}
              </button>
            ))}
          </div>
        </div>

        <textarea
          className="w-full bg-[#1b1b1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#c5c1b9] outline-none focus:border-[#575ECF] resize-none h-24 placeholder-[#8a8680] mb-4"
          placeholder="Write your feedback..."
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
        />

        <div className="flex gap-3">
          <button onClick={() => submit('completed')} disabled={submitting} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: '#22c55e' }}>
            ✓ Mark Completed
          </button>
          <button onClick={() => submit('needs_revision')} disabled={submitting} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: '#ef4444' }}>
            ↩ Needs Revision
          </button>
        </div>
        <button onClick={onClose} className="mt-3 w-full py-2 text-xs text-[#8a8680]">Cancel (don't change stage)</button>
      </div>
    </div>
  )
}

// ── Kanban Column (Manager) ───────────────────────────────────────────────────
function ManagerKanbanColumn({ stage, topics, userId, onDrop, onDragStart }) {
  const [dragOver, setDragOver] = useState(false)
  const color = DEFAULT_COLORS[stage] || '#8a8680'
  const totalNew = topics.reduce((acc, t) => {
    const seen = getSeen(userId, t.id)
    return acc + Math.max(0, (t.comment_count || 0) - seen.c) + Math.max(0, (t.assessment_count || 0) - seen.a)
  }, 0)

  return (
    <div
      className="flex-shrink-0 w-64 flex flex-col rounded-2xl transition-all duration-200"
      style={{
        backgroundColor: '#1a1a1a',
        border: dragOver ? `1.5px dashed ${color}70` : '1.5px solid rgba(255,255,255,0.05)',
        boxShadow: dragOver ? `0 0 0 3px ${color}15` : 'none',
      }}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { setDragOver(false); onDrop(e, stage) }}
    >
      {/* Header */}
      <div className="px-4 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-[13px] font-semibold tracking-tight" style={{ color }}>{stage}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {totalNew > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#f59e0b22', color: '#f59e0b' }}>
              {totalNew} new
            </span>
          )}
          <span className="text-xs font-semibold text-[#8a8680] bg-white/6 rounded-full px-2 py-0.5 min-w-[22px] text-center">
            {topics.length}
          </span>
        </div>
      </div>
      {/* Cards */}
      <div
        className="flex-1 p-3 space-y-2.5 min-h-[120px] rounded-b-2xl transition-colors duration-150"
        style={{ backgroundColor: dragOver ? `${color}06` : 'transparent' }}
      >
        {topics.map(t => (
          <ManagerTopicCard key={t.id} topic={t} userId={userId} onDragStart={onDragStart} />
        ))}
        {topics.length === 0 && (
          <div className="flex items-center justify-center h-16 rounded-xl" style={{ border: '1px dashed rgba(255,255,255,0.06)' }}>
            <p className="text-[11px] text-[#8a8680]/50">Drop here</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Employee View ─────────────────────────────────────────────────────────────
function EmployeeView({ topics, employees, stats }) {
  const [expanded, setExpanded] = useState(null)

  return (
    <div className="space-y-4">
      {/* Stats table */}
      {stats?.employees && stats.employees.length > 0 && (
        <div className="bg-[#242424] border border-white/8 rounded-xl overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                {['Employee', 'Total', 'Completed', '%', 'Overdue', 'Avg ★', 'Revision %'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[#8a8680] font-medium text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.employees.map(e => (
                <tr key={e.user_id} className="border-b border-white/5">
                  <td className="px-4 py-2.5 text-[#c5c1b9] font-medium">{e.name}</td>
                  <td className="px-4 py-2.5 text-[#c5c1b9]">{e.total}</td>
                  <td className="px-4 py-2.5 text-[#22c55e]">{e.completed}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-white/8 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${e.completion_rate}%`, backgroundColor: '#22c55e' }} />
                      </div>
                      <span className="text-xs text-[#c5c1b9]">{e.completion_rate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: e.overdue > 0 ? '#ef4444' : '#8a8680' }}>{e.overdue}</td>
                  <td className="px-4 py-2.5 text-[#f59e0b]">{e.avg_rating || '—'}</td>
                  <td className="px-4 py-2.5 text-[#8a8680]">{e.revision_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Employee cards */}
      {employees.map(emp => {
        const empTopics = topics.filter(t => t.assignee_id === emp.id)
        const isExpanded = expanded === emp.id
        const overdue = empTopics.filter(t => isOverdue(t)).length
        const completed = empTopics.filter(t => t.stage === 'Completed').length

        return (
          <div key={emp.id} className="bg-[#242424] border border-white/8 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(isExpanded ? null : emp.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-[#575ECF]/20 flex items-center justify-center text-sm font-bold text-[#575ECF]">
                  {emp.name[0]}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-[#c5c1b9]">{emp.name}</p>
                  <p className="text-xs text-[#8a8680]">{empTopics.length} topics · {completed} completed{overdue > 0 ? ` · ${overdue} overdue` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 h-1.5 bg-white/8 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${empTopics.length ? Math.round(completed / empTopics.length * 100) : 0}%`, backgroundColor: '#22c55e' }} />
                </div>
                <svg className="w-4 h-4 text-[#8a8680] transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : '' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-white/8">
                {DEFAULT_STAGES.map(stage => {
                  const stageTopics = empTopics.filter(t => t.stage === stage)
                  if (stageTopics.length === 0) return null
                  return (
                    <div key={stage} className="px-5 py-3 border-b border-white/5 last:border-0">
                      <p className="text-xs font-medium mb-2" style={{ color: DEFAULT_COLORS[stage] || '#8a8680' }}>{stage}</p>
                      <div className="space-y-2">
                        {stageTopics.map(t => (
                          <div key={t.id} className="flex items-center justify-between">
                            <Link to={`/learning/topic/${t.id}`} className="text-sm text-[#c5c1b9] hover:text-white">{t.title}</Link>
                            <div className="flex items-center gap-3">
                              {t.latest_rating && <StarRating value={t.latest_rating} />}
                              {t.due_date && <span className="text-xs" style={{ color: isOverdue(t) ? '#ef4444' : '#8a8680' }}>{formatDate(t.due_date)}</span>}
                              <Link to={`/learning/topic/${t.id}`} className="text-xs text-[#575ECF] hover:text-[#6B72D8]">View →</Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {empTopics.length === 0 && <p className="px-5 py-4 text-sm text-[#8a8680]">No topics assigned</p>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LmsManager() {
  const navigate = useNavigate()
  const [topics, setTopics] = useState([])
  const [users, setUsers] = useState([])
  const [templates, setTemplates] = useState([])
  const [stagesData, setStagesData] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('kanban')
  const [activeTab, setActiveTab] = useState('pipeline')
  const [employeeFilter, setEmployeeFilter] = useState(null)
  const [showAssignDrawer, setShowAssignDrawer] = useState(false)
  const [draggingStage, setDraggingStage] = useState(null)
  const [assessModal, setAssessModal] = useState(null) // { topicId, targetStage }

  const managerId = Number(localStorage.getItem('lms_user_id'))
  const role = localStorage.getItem('lms_user_role')

  useEffect(() => {
    if (!managerId || !['manager', 'admin'].includes(role)) { navigate('/learning'); return }
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [topicsRes, usersRes, templatesRes, statsRes, stagesRes] = await Promise.all([
      api.get('/lms/topics'),
      api.get('/lms/users'),
      api.get('/lms/templates'),
      api.get('/lms/dashboard'),
      api.get('/lms/stages'),
    ])
    setTopics(topicsRes.data)
    setUsers(usersRes.data)
    setTemplates(templatesRes.data)
    setStats(statsRes.data)
    setStagesData(stagesRes.data.filter(s => s.active))
    setLoading(false)
  }

  const stages = stagesData.length > 0 ? stagesData.map(s => s.name) : DEFAULT_STAGES

  const employeeOptions = [
    { value: null, label: 'All Employees' },
    ...users.filter(u => u.role === 'employee').map(u => ({ value: u.id, label: u.name })),
  ]

  const filteredTopics = employeeFilter
    ? topics.filter(t => t.assignee_id === employeeFilter)
    : topics

  function topicsForStage(stage) {
    return filteredTopics.filter(t => t.stage === stage)
  }

  async function handleDrop(e, targetStage) {
    const topicId = Number(e.dataTransfer.getData('topic_id'))
    setDraggingStage(null)

    // Manager dragging to Assessed → show assessment modal
    if (targetStage === 'Assessed') {
      const topic = topics.find(t => t.id === topicId)
      if (topic) {
        setAssessModal({ topic, targetStage })
        return
      }
    }

    try {
      await api.patch(`/lms/topics/${topicId}/stage`, { new_stage: targetStage, changed_by: managerId, role })
      setTopics(prev => prev.map(t => t.id === topicId ? { ...t, stage: targetStage } : t))
      toast.success(`Moved to ${targetStage}`)
    } catch (e) {
      toast.error(e.response?.data?.error || 'Cannot change stage')
    }
  }

  function handleAssessmentSubmit(topicId, newStage) {
    setTopics(prev => prev.map(t => t.id === topicId ? { ...t, stage: newStage } : t))
    setAssessModal(null)
  }

  const employees = users.filter(u => u.role === 'employee')

  if (loading) return (
    <div className="min-h-screen bg-[#1b1b1b] flex items-center justify-center">
      <p className="text-[#8a8680]">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#161616' }}>
      {/* Top bar */}
      <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h1 className="text-xl font-bold text-white tracking-tight">Manager Dashboard</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-52">
            <Select
              options={employeeOptions}
              value={employeeOptions.find(o => o.value === employeeFilter) || employeeOptions[0]}
              onChange={o => setEmployeeFilter(o?.value || null)}
              styles={selectStyles}
              isSearchable={false}
            />
          </div>
          <button
            onClick={() => setShowAssignDrawer(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: '#575ECF', boxShadow: '0 2px 8px rgba(87,94,207,0.35)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Assign Topic
          </button>
          <button
            onClick={() => navigate('/learning')}
            className="text-xs text-[#8a8680] hover:text-[#c5c1b9] transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
          >
            Switch User
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex gap-1 w-fit rounded-xl p-1" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
          {[
            { id: 'pipeline', label: 'Kanban' },
            { id: 'employees', label: 'Team View' },
            { id: 'dashboard', label: 'Dashboard' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150"
              style={{
                backgroundColor: activeTab === t.id ? '#575ECF' : 'transparent',
                color: activeTab === t.id ? '#fff' : '#6b7280',
                boxShadow: activeTab === t.id ? '0 2px 6px rgba(87,94,207,0.3)' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Kanban */}
      {activeTab === 'pipeline' && (
        <div className="px-6 pb-10 overflow-x-auto">
          <div className="flex gap-4 min-w-max">
            {stages.map(stage => (
              <ManagerKanbanColumn
                key={stage}
                stage={stage}
                topics={topicsForStage(stage)}
                userId={managerId}
                onDrop={handleDrop}
                onDragStart={stage => setDraggingStage(stage)}
              />
            ))}
          </div>
          {filteredTopics.length === 0 && (
            <div className="text-center py-20">
              <p className="text-[#8a8680] text-sm">No topics found</p>
            </div>
          )}
        </div>
      )}

      {/* Employee View */}
      {activeTab === 'employees' && (
        <div className="px-4 pb-8 max-w-4xl">
          <EmployeeView topics={filteredTopics} employees={employees} stats={stats} />
        </div>
      )}

      {/* Dashboard */}
      {activeTab === 'dashboard' && stats && (
        <div className="px-4 pb-8 max-w-4xl">
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Topics', value: stats.total_assigned, color: '#c5c1b9' },
              { label: 'Completed', value: stats.completed, color: '#22c55e' },
              { label: 'Overdue', value: stats.overdue, color: stats.overdue > 0 ? '#ef4444' : '#8a8680' },
              { label: 'Completion %', value: `${stats.completion_rate}%`, color: '#575ECF' },
            ].map(s => (
              <div key={s.label} className="bg-[#242424] border border-white/8 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-[#8a8680] mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Overdue alerts */}
          {stats.overdue_topics && stats.overdue_topics.length > 0 && (
            <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl p-4 mb-6">
              <p className="text-sm font-semibold text-[#ef4444] mb-3">⚠ Overdue Topics</p>
              <div className="space-y-2">
                {stats.overdue_topics.map(t => (
                  <Link
                    key={t.id}
                    to={`/learning/topic/${t.id}`}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm text-[#c5c1b9]">{t.title}</span>
                    <span className="text-xs text-[#8a8680]">{t.assignee_name} · {formatDate(t.due_date)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Stage breakdown */}
          <div className="bg-[#242424] border border-white/8 rounded-xl p-5">
            <p className="text-sm font-semibold text-[#c5c1b9] mb-4">By Stage</p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {stages.map(s => (
                <div key={s} className="text-center">
                  <p className="text-xl font-bold" style={{ color: DEFAULT_COLORS[s] || '#8a8680' }}>{stats.by_stage[s] || 0}</p>
                  <p className="text-xs text-[#8a8680] mt-0.5">{s}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Assign Drawer */}
      {showAssignDrawer && (
        <AssignDrawer
          users={users}
          templates={templates}
          managerId={managerId}
          onClose={() => setShowAssignDrawer(false)}
          onAssigned={loadAll}
        />
      )}

      {/* Assessment Modal */}
      {assessModal && (
        <AssessmentModal
          topic={assessModal.topic}
          managerId={managerId}
          onSubmit={newStage => handleAssessmentSubmit(assessModal.topic.id, newStage)}
          onClose={() => setAssessModal(null)}
        />
      )}
    </div>
  )
}
