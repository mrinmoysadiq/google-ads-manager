import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../utils/lmsApi'
import { fmtDate } from '../../utils/dates'
import toast from 'react-hot-toast'

const DEFAULT_STAGES = ['Assigned', 'In Progress', 'Notes Submitted', 'Assessed', 'Needs Revision', 'Completed']
const DEFAULT_COLORS = {
  'Assigned': '#8a8680', 'In Progress': '#575ECF', 'Notes Submitted': '#f59e0b',
  'Assessed': '#3b82f6', 'Needs Revision': '#ef4444', 'Completed': '#22c55e',
}

// For employees: only these two forward moves are allowed
const ALLOWED_TRANSITIONS = [
  ['Assigned', 'In Progress'],
  ['In Progress', 'Notes Submitted'],
]

function getStageColor(stagesData, name) {
  const found = stagesData.find(s => s.name === name)
  return found?.color || DEFAULT_COLORS[name] || '#8a8680'
}

function StageBadge({ stage }) {
  const color = DEFAULT_COLORS[stage] || '#8a8680'
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${color}20`, color }}>
      {stage}
    </span>
  )
}

const formatDate = fmtDate

function isOverdue(topic) {
  if (!topic.due_date || topic.stage === 'Completed') return false
  return topic.due_date < new Date().toISOString().split('T')[0]
}

function daysDiff(dateStr) {
  const diff = new Date().setHours(0,0,0,0) - new Date(dateStr).setHours(0,0,0,0)
  return Math.floor(diff / 86400000)
}

// ── Stat Pill ─────────────────────────────────────────────────────────────────
function Pill({ label, value, color }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
      <span className="font-bold" style={{ color }}>{value}</span>
      <span className="text-[#6b7280]">{label}</span>
    </span>
  )
}

// ── Notification helpers (localStorage-based per-user seen tracking) ──────────
function seenKey(userId, topicId) { return `lms_seen_${userId}_${topicId}` }
function getSeen(userId, topicId) {
  try { return JSON.parse(localStorage.getItem(seenKey(userId, topicId))) || { c: 0, a: 0 } }
  catch { return { c: 0, a: 0 } }
}
function markTopicSeen(userId, topicId, counts) {
  localStorage.setItem(seenKey(userId, topicId), JSON.stringify(counts))
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
const IconStar = () => (
  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
)
const IconCalendar = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)
const IconNote = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

// ── Topic Card ────────────────────────────────────────────────────────────────
function TopicCard({ topic, userId, onDragStart, onDragEnd }) {
  const overdue = isOverdue(topic)
  const seen = getSeen(userId, topic.id)
  const newComments = Math.max(0, (topic.comment_count || 0) - seen.c)
  const newAssessments = Math.max(0, (topic.assessment_count || 0) - seen.a)
  const hasNew = newComments > 0 || newAssessments > 0

  return (
    <Link
      to={`/learning/topic/${topic.id}`}
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart(e, topic) }}
      onDragEnd={onDragEnd}
      onClick={e => e.stopPropagation()}
      className="group relative block rounded-xl p-4 cursor-grab active:cursor-grabbing transition-all duration-150 select-none"
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
      <p className="text-[13px] font-semibold leading-snug text-[#d4cfc7] group-hover:text-white transition-colors line-clamp-2 mb-3 pr-4">
        {topic.title}
      </p>

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
              <IconStar /> {newAssessments} new
            </span>
          )}
        </div>
      )}

      {/* Footer meta */}
      <div className="flex items-center justify-between gap-2 pt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2">
          {topic.has_notes && (
            <span className="text-[#575ECF]"><IconNote /></span>
          )}
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
    </Link>
  )
}

// ── Kanban Column ─────────────────────────────────────────────────────────────
function KanbanColumn({ stage, color, topics, userId, onDrop, dimmed }) {
  const [dragOver, setDragOver] = useState(false)
  const totalNew = topics.reduce((acc, t) => {
    const seen = getSeen(userId, t.id)
    return acc + Math.max(0, (t.comment_count || 0) - seen.c) + Math.max(0, (t.assessment_count || 0) - seen.a)
  }, 0)

  return (
    <div
      className="flex-shrink-0 w-64 flex flex-col rounded-2xl transition-all duration-200"
      style={{
        opacity: dimmed ? 0.35 : 1,
        backgroundColor: '#1a1a1a',
        border: dragOver ? `1.5px dashed ${color}70` : '1.5px solid rgba(255,255,255,0.05)',
        boxShadow: dragOver ? `0 0 0 3px ${color}15` : 'none',
      }}
      onDragOver={e => { if (!dimmed) { e.preventDefault(); setDragOver(true) } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { setDragOver(false); if (!dimmed) onDrop(e, stage) }}
    >
      {/* Column header */}
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
          <TopicCard
            key={t.id}
            topic={t}
            userId={userId}
            onDragStart={(e, topic) => { e.dataTransfer.setData('topic_id', topic.id); e.dataTransfer.setData('from_stage', topic.stage) }}
            onDragEnd={() => {}}
          />
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

// ── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab({ userId }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.get(`/lms/dashboard?user_id=${userId}`).then(({ data }) => setStats(data))
  }, [userId])

  if (!stats) return <p className="text-[#8a8680] text-sm">Loading...</p>

  return (
    <div className="space-y-6">
      {/* Completion rate */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-[#c5c1b9]">Completion Rate</p>
          <p className="text-sm font-bold text-[#22c55e]">{stats.completion_rate}%</p>
        </div>
        <div className="h-2 bg-white/8 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${stats.completion_rate}%`, backgroundColor: '#22c55e' }} />
        </div>
      </div>

      {/* Stage breakdown */}
      <div>
        <p className="text-xs font-medium text-[#8a8680] uppercase tracking-wide mb-3">By Stage</p>
        <div className="grid grid-cols-3 gap-2">
          {DEFAULT_STAGES.map(s => (
            <div key={s} className="bg-[#242424] border border-white/8 rounded-lg p-3 text-center">
              <p className="text-lg font-bold" style={{ color: DEFAULT_COLORS[s] }}>{stats.by_stage[s] || 0}</p>
              <p className="text-xs text-[#8a8680] mt-0.5">{s}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Overdue topics */}
      {stats.overdue_topics && stats.overdue_topics.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[#8a8680] uppercase tracking-wide mb-3">Overdue Topics</p>
          <div className="space-y-2">
            {stats.overdue_topics.map(t => (
              <Link
                key={t.id}
                to={`/learning/topic/${t.id}`}
                className="flex items-center justify-between bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg px-4 py-3 hover:border-[#ef4444]/40"
              >
                <span className="text-sm text-[#c5c1b9]">{t.title}</span>
                <span className="text-xs text-[#ef4444]">{daysDiff(t.due_date)}d overdue</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Assessment history */}
      {stats.avg_star_rating > 0 && (
        <div>
          <p className="text-xs font-medium text-[#8a8680] uppercase tracking-wide mb-2">Avg Rating</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-[#f59e0b]">{stats.avg_star_rating}</span>
            <span className="text-[#f59e0b] text-lg">★</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── New Topic Modal ───────────────────────────────────────────────────────────
function NewTopicModal({ userId, onCreated, onClose }) {
  const [form, setForm] = useState({ title: '', description: '', due_date: '' })
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!form.title.trim()) return toast.error('Title required')
    setSaving(true)
    try {
      await api.post('/lms/topics', {
        title: form.title.trim(),
        description: form.description,
        assignee_id: userId,
        assigned_by: userId,
        due_date: form.due_date || null,
      })
      toast.success('Topic created!')
      onCreated()
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error creating topic')
    }
    setSaving(false)
  }

  const inputCls = 'w-full bg-[#1b1b1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#c5c1b9] outline-none focus:border-[#575ECF] placeholder-[#8a8680]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#242424] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-bold text-[#c5c1b9] mb-4">New Topic</h3>
        <div className="space-y-3">
          <input className={inputCls} placeholder="Topic title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
          <textarea className={inputCls + ' resize-none h-20'} placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div>
            <p className="text-xs text-[#8a8680] mb-1">Due Date (optional)</p>
            <input className={inputCls} type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={submit} disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: '#575ECF' }}>
              Create Topic
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm text-[#8a8680] bg-white/8">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LmsEmployee() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [topics, setTopics] = useState([])
  const [stagesData, setStagesData] = useState([])
  const [stats, setStats] = useState(null)
  const [activeTab, setActiveTab] = useState('pipeline')
  const [loading, setLoading] = useState(true)
  const [draggingStage, setDraggingStage] = useState(null)
  const [showNewTopic, setShowNewTopic] = useState(false)

  const storedUserId = localStorage.getItem('lms_user_id')
  const userName = localStorage.getItem('lms_user_name')
  const role = localStorage.getItem('lms_user_role')

  useEffect(() => {
    if (!storedUserId || role !== 'employee') { navigate('/learning'); return }
    loadData()
  }, [userId])

  async function loadData() {
    setLoading(true)
    const [topicsRes, statsRes, stagesRes] = await Promise.all([
      api.get(`/lms/topics?assignee_id=${userId}`),
      api.get(`/lms/dashboard?user_id=${userId}`),
      api.get('/lms/stages'),
    ])
    setTopics(topicsRes.data)
    setStats(statsRes.data)
    setStagesData(stagesRes.data.filter(s => s.active))
    setLoading(false)
  }

  const stages = stagesData.length > 0 ? stagesData.map(s => s.name) : DEFAULT_STAGES

  function topicsForStage(stage) {
    return topics.filter(t => t.stage === stage)
  }

  async function handleDrop(e, targetStage) {
    const topicId = e.dataTransfer.getData('topic_id')
    const fromStage = e.dataTransfer.getData('from_stage')
    setDraggingStage(null)

    const isAllowed = ALLOWED_TRANSITIONS.some(([from, to]) => from === fromStage && to === targetStage)
    if (!isAllowed) {
      toast.error('You can only advance topics one stage at a time')
      return
    }

    // Check notes for submit
    if (targetStage === 'Notes Submitted') {
      const topic = topics.find(t => String(t.id) === String(topicId))
      if (!topic?.has_notes) {
        toast.error('Please add your notes first')
        return
      }
    }

    try {
      await api.patch(`/lms/topics/${topicId}/stage`, {
        new_stage: targetStage,
        changed_by: storedUserId,
        role: 'employee',
      })
      setTopics(prev => prev.map(t => String(t.id) === String(topicId) ? { ...t, stage: targetStage } : t))
      toast.success(`Moved to ${targetStage}`)
    } catch (e) {
      toast.error(e.response?.data?.error || 'Cannot move topic')
    }
  }

  function getDimmed(stage) {
    if (!draggingStage) return false
    return !ALLOWED_TRANSITIONS.some(([from, to]) => from === draggingStage && to === stage)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#1b1b1b] flex items-center justify-center">
      <p className="text-[#8a8680]">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#161616' }}>
      {/* Top bar */}
      <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Welcome back, {userName}</h1>
          {stats && (
            <div className="flex flex-wrap gap-2 mt-2">
              <Pill label="Topics" value={stats.total_assigned} color="#c5c1b9" />
              <Pill label="Completed" value={stats.completed} color="#34d399" />
              <Pill label="Overdue" value={stats.overdue} color={stats.overdue > 0 ? '#f87171' : '#c5c1b9'} />
              {stats.avg_star_rating > 0 && <Pill label="Avg Score" value={`${stats.avg_star_rating}★`} color="#fbbf24" />}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewTopic(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: '#575ECF', boxShadow: '0 2px 8px rgba(87,94,207,0.35)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Topic
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
          {[{ id: 'pipeline', label: 'My Pipeline' }, { id: 'dashboard', label: 'Dashboard' }].map(t => (
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

      {/* Pipeline — Kanban */}
      {activeTab === 'pipeline' && (
        <div className="px-6 pb-10 overflow-x-auto">
          <div className="flex gap-4 min-w-max">
            {stages.map(stage => (
              <KanbanColumn
                key={stage}
                stage={stage}
                color={getStageColor(stagesData, stage)}
                topics={topicsForStage(stage)}
                onDrop={handleDrop}
                userId={Number(storedUserId)}
                dimmed={draggingStage ? getDimmed(stage) : false}
              />
            ))}
          </div>
          {topics.length === 0 && (
            <div className="text-center py-20">
              <div className="w-12 h-12 rounded-2xl bg-white/4 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-[#8a8680]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-[#8a8680] text-sm">No topics yet. Create your first one above.</p>
            </div>
          )}
        </div>
      )}

      {/* Dashboard */}
      {activeTab === 'dashboard' && (
        <div className="px-4 pb-8 max-w-2xl">
          <div className="bg-[#242424] border border-white/8 rounded-2xl p-6">
            <DashboardTab userId={userId} />
          </div>
        </div>
      )}

      {/* New Topic Modal */}
      {showNewTopic && (
        <NewTopicModal
          userId={Number(storedUserId)}
          onCreated={loadData}
          onClose={() => setShowNewTopic(false)}
        />
      )}
    </div>
  )
}
