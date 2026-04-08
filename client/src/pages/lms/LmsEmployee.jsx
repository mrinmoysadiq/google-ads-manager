import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../utils/lmsApi'
import toast from 'react-hot-toast'

const STAGES = ['Assigned', 'In Progress', 'Notes Submitted', 'Assessed', 'Needs Revision', 'Completed']
const STAGE_COLORS = {
  'Assigned': '#8a8680',
  'In Progress': '#575ECF',
  'Notes Submitted': '#f59e0b',
  'Assessed': '#3b82f6',
  'Needs Revision': '#ef4444',
  'Completed': '#22c55e',
}

// Moves an employee can make
const ALLOWED_TRANSITIONS = [
  ['Assigned', 'In Progress'],
  ['In Progress', 'Notes Submitted'],
]

function StageBadge({ stage }) {
  const color = STAGE_COLORS[stage] || '#8a8680'
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

// ── Topic Card ────────────────────────────────────────────────────────────────
function TopicCard({ topic, onDragStart, onDragEnd }) {
  const overdue = isOverdue(topic)
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, topic)}
      onDragEnd={onDragEnd}
      className="bg-[#2a2a2a] border border-white/8 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-white/15 transition-colors"
    >
      <Link to={`/learning/topic/${topic.id}`} onClick={e => e.stopPropagation()}>
        <p className="text-sm font-medium text-[#c5c1b9] mb-2 line-clamp-2 hover:text-white transition-colors">{topic.title}</p>
      </Link>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {topic.has_notes ? <span className="text-xs text-[#575ECF]">📝</span> : null}
          {topic.resources?.length > 0 && (
            <span className="text-xs text-[#8a8680]">{topic.resources.length} res</span>
          )}
          {topic.is_sequential ? <span className="text-xs text-[#8a8680]">Seq</span> : null}
        </div>
        {topic.due_date && (
          <span className="text-xs" style={{ color: overdue ? '#ef4444' : '#8a8680' }}>
            {overdue ? '⚠ ' : ''}{formatDate(topic.due_date)}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Kanban Column ─────────────────────────────────────────────────────────────
function KanbanColumn({ stage, topics, onDrop, dimmed }) {
  const [dragOver, setDragOver] = useState(false)
  const color = STAGE_COLORS[stage]

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
          {STAGES.map(s => (
            <div key={s} className="bg-[#242424] border border-white/8 rounded-lg p-3 text-center">
              <p className="text-lg font-bold" style={{ color: STAGE_COLORS[s] }}>{stats.by_stage[s] || 0}</p>
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LmsEmployee() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [topics, setTopics] = useState([])
  const [stats, setStats] = useState(null)
  const [activeTab, setActiveTab] = useState('pipeline')
  const [loading, setLoading] = useState(true)
  const [draggingStage, setDraggingStage] = useState(null)

  const storedUserId = localStorage.getItem('lms_user_id')
  const userName = localStorage.getItem('lms_user_name')
  const role = localStorage.getItem('lms_user_role')

  useEffect(() => {
    if (!storedUserId || role !== 'employee') { navigate('/learning'); return }
    loadData()
  }, [userId])

  async function loadData() {
    setLoading(true)
    const [topicsRes, statsRes] = await Promise.all([
      api.get(`/lms/topics?assignee_id=${userId}`),
      api.get(`/lms/dashboard?user_id=${userId}`),
    ])
    setTopics(topicsRes.data)
    setStats(statsRes.data)
    setLoading(false)
  }

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
          <button onClick={() => navigate('/learning')} className="text-xs text-[#8a8680] hover:text-[#c5c1b9]">
            Switch User
          </button>
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
          <div
            className="flex gap-3 min-w-max"
            onDragStart={e => {
              const stage = e.dataTransfer?.getData?.('from_stage')
              setTimeout(() => setDraggingStage(e.target.closest('[draggable]')?.dataset?.stage || null), 0)
            }}
          >
            {STAGES.map(stage => (
              <KanbanColumn
                key={stage}
                stage={stage}
                topics={topicsForStage(stage)}
                onDrop={handleDrop}
                dimmed={draggingStage ? getDimmed(stage) : false}
              />
            ))}
          </div>
          {topics.length === 0 && (
            <div className="text-center py-16">
              <p className="text-[#8a8680] text-sm">No topics assigned to you yet.</p>
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
    </div>
  )
}
