import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../utils/lmsApi'
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

function formatDate(str) {
  if (!str) return ''
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isOverdue(topic) {
  if (!topic.due_date || topic.stage === 'Completed') return false
  return topic.due_date < new Date().toISOString().split('T')[0]
}

function daysDiff(dateStr) {
  const diff = new Date().setHours(0,0,0,0) - new Date(dateStr).setHours(0,0,0,0)
  return Math.floor(diff / 86400000)
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

// ── Topic Card ────────────────────────────────────────────────────────────────
function TopicCard({ topic, userId, onDragStart, onDragEnd }) {
  const overdue = isOverdue(topic)
  const seen = getSeen(userId, topic.id)
  const newComments = Math.max(0, (topic.comment_count || 0) - seen.c)
  const newAssessments = Math.max(0, (topic.assessment_count || 0) - seen.a)
  const hasNew = newComments > 0 || newAssessments > 0

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, topic)}
      onDragEnd={onDragEnd}
      className="relative bg-[#2a2a2a] border rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all"
      style={{ borderColor: hasNew ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)' }}
    >
      {/* Notification dot */}
      {hasNew && (
        <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#f59e0b] shadow-sm shadow-[#f59e0b]/50" />
      )}

      <Link to={`/learning/topic/${topic.id}`} onClick={e => e.stopPropagation()}>
        <p className="text-sm font-medium text-[#c5c1b9] mb-1.5 line-clamp-2 hover:text-white transition-colors pr-4">{topic.title}</p>
      </Link>
      {topic.assignee_name && (
        <p className="text-xs text-[#8a8680] mb-2 truncate">👤 {topic.assignee_name}</p>
      )}

      {/* Notification badges */}
      {(newComments > 0 || newAssessments > 0) && (
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {newComments > 0 && (
            <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#575ECF20', color: '#575ECF' }}>
              💬 {newComments} new
            </span>
          )}
          {newAssessments > 0 && (
            <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#f59e0b20', color: '#f59e0b' }}>
              ⭐ {newAssessments} new
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {topic.has_notes ? <span className="text-xs text-[#575ECF]">📝</span> : null}
          {topic.comment_count > 0 && newComments === 0 && (
            <span className="text-xs text-[#8a8680]">💬 {topic.comment_count}</span>
          )}
        </div>
        {topic.due_date ? (
          <span className="text-xs font-medium" style={{ color: overdue ? '#ef4444' : '#8a8680' }}>
            {overdue ? '⚠ ' : '📅 '}{formatDate(topic.due_date)}
          </span>
        ) : (
          <span className="text-xs text-[#8a8680]/40">No deadline</span>
        )}
      </div>
    </div>
  )
}

// ── Kanban Column ─────────────────────────────────────────────────────────────
function KanbanColumn({ stage, color, topics, userId, onDrop, dimmed }) {
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      className="flex-shrink-0 w-56 flex flex-col rounded-xl overflow-hidden transition-opacity"
      style={{ opacity: dimmed ? 0.4 : 1 }}
      onDragOver={e => { if (!dimmed) { e.preventDefault(); setDragOver(true) } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { setDragOver(false); if (!dimmed) onDrop(e, stage) }}
    >
      {/* Column header */}
      <div
        className="px-3 py-2.5 flex items-center justify-between"
        style={{ backgroundColor: `${color}18`, borderBottom: `2px solid ${color}` }}
      >
        <span className="text-xs font-semibold" style={{ color }}>{stage}</span>
        <span className="text-xs text-[#8a8680] bg-black/20 rounded-full px-1.5 py-0.5">{topics.length}</span>
      </div>

      {/* Cards */}
      <div
        className="flex-1 p-2 space-y-2 min-h-[100px] rounded-b-xl transition-colors"
        style={{ backgroundColor: dragOver ? `${color}08` : '#1b1b1b', border: dragOver ? `1px dashed ${color}60` : '1px solid transparent' }}
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
    <div className="min-h-screen bg-[#1b1b1b]">
      {/* Top bar */}
      <div className="bg-[#242424] border-b border-white/8 px-4 py-4">
        <div className="max-w-full mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-[#c5c1b9]">Welcome, {userName}</h1>
            {stats && (
              <div className="flex gap-4 mt-1 text-xs text-[#8a8680]">
                <span><strong className="text-[#c5c1b9]">{stats.total_assigned}</strong> Topics</span>
                <span><strong className="text-[#22c55e]">{stats.completed}</strong> Completed</span>
                <span><strong className={stats.overdue > 0 ? 'text-[#ef4444]' : 'text-[#c5c1b9]'}>{stats.overdue}</strong> Overdue</span>
                {stats.avg_star_rating > 0 && <span><strong className="text-[#f59e0b]">{stats.avg_star_rating}★</strong> Avg Score</span>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNewTopic(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: '#575ECF' }}
            >
              + New Topic
            </button>
            <button onClick={() => navigate('/learning')} className="text-xs text-[#8a8680] hover:text-[#c5c1b9]">
              Switch User
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4">
        <div className="flex gap-1 bg-[#242424] border border-white/8 rounded-lg p-1 w-fit mb-4">
          {[{ id: 'pipeline', label: 'My Pipeline' }, { id: 'dashboard', label: 'Dashboard' }].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
              style={{ backgroundColor: activeTab === t.id ? '#575ECF' : 'transparent', color: activeTab === t.id ? '#fff' : '#8a8680' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pipeline — Kanban */}
      {activeTab === 'pipeline' && (
        <div className="px-4 pb-8 overflow-x-auto">
          <div className="flex gap-3 min-w-max">
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
            <div className="text-center py-16">
              <p className="text-[#8a8680] text-sm">No topics assigned to you yet. Create one with "+ New Topic".</p>
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
