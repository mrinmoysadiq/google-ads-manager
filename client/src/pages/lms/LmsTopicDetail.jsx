import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import BulletEditor from './components/BulletEditor'

const STAGES = ['Assigned', 'In Progress', 'Notes Submitted', 'Assessed', 'Needs Revision', 'Completed']
const STAGE_COLORS = {
  'Assigned': '#8a8680',
  'In Progress': '#575ECF',
  'Notes Submitted': '#f59e0b',
  'Assessed': '#3b82f6',
  'Needs Revision': '#ef4444',
  'Completed': '#22c55e',
}

function StageBadge({ stage }) {
  const color = STAGE_COLORS[stage] || '#8a8680'
  return (
    <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: `${color}20`, color }}>
      {stage}
    </span>
  )
}

function StarRating({ value, onChange, readOnly = false }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange && onChange(n)}
          onMouseEnter={() => !readOnly && setHovered(n)}
          onMouseLeave={() => !readOnly && setHovered(0)}
          className="text-2xl leading-none transition-colors"
          style={{ color: n <= (hovered || value) ? '#f59e0b' : '#8a8680', cursor: readOnly ? 'default' : 'pointer' }}
        >
          {n <= (hovered || value) ? '★' : '☆'}
        </button>
      ))}
    </div>
  )
}

function formatDate(str) {
  if (!str) return ''
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isOverdue(topic) {
  if (!topic.due_date || topic.stage === 'Completed') return false
  return topic.due_date < new Date().toISOString().split('T')[0]
}

// ── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ topic, role, onTopicUpdated }) {
  const [editTitle, setEditTitle] = useState(false)
  const [titleVal, setTitleVal] = useState(topic.title)
  const [editDesc, setEditDesc] = useState(false)
  const [descVal, setDescVal] = useState(topic.description || '')
  const [resources, setResources] = useState(topic.resources || [])
  const [addingRes, setAddingRes] = useState(false)
  const [newRes, setNewRes] = useState({ label: '', url: '' })

  const isManager = role === 'manager' || role === 'admin'

  async function saveTitle() {
    try {
      const { data } = await axios.patch(`/api/lms/topics/${topic.id}`, { title: titleVal })
      onTopicUpdated(data)
      setEditTitle(false)
      toast.success('Title updated')
    } catch { toast.error('Error updating title') }
  }

  async function saveDesc() {
    try {
      const { data } = await axios.patch(`/api/lms/topics/${topic.id}`, { description: descVal })
      onTopicUpdated(data)
      setEditDesc(false)
      toast.success('Description updated')
    } catch { toast.error('Error updating description') }
  }

  async function saveResources(newList) {
    try {
      await axios.patch(`/api/lms/topics/${topic.id}`, { resources: newList })
      setResources(newList)
    } catch { toast.error('Error updating resources') }
  }

  async function addResource() {
    if (!newRes.label || !newRes.url) return toast.error('Label and URL required')
    const newList = [...resources, newRes]
    await saveResources(newList)
    setNewRes({ label: '', url: '' })
    setAddingRes(false)
  }

  async function removeResource(i) {
    const newList = resources.filter((_, j) => j !== i)
    await saveResources(newList)
  }

  return (
    <div className="space-y-6">
      {/* Description */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-[#8a8680] uppercase tracking-wide">Description</p>
          {isManager && !editDesc && (
            <button onClick={() => setEditDesc(true)} className="text-xs text-[#575ECF]">Edit</button>
          )}
        </div>
        {editDesc ? (
          <div>
            <textarea
              className="w-full bg-[#1b1b1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#c5c1b9] outline-none focus:border-[#575ECF] resize-none h-24 placeholder-[#8a8680]"
              value={descVal}
              onChange={e => setDescVal(e.target.value)}
            />
            <div className="flex gap-2 mt-2">
              <button onClick={saveDesc} className="text-xs px-3 py-1.5 rounded-lg bg-[#575ECF] text-white">Save</button>
              <button onClick={() => { setEditDesc(false); setDescVal(topic.description || '') }} className="text-xs px-3 py-1.5 rounded-lg bg-white/8 text-[#8a8680]">Cancel</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#c5c1b9]">{topic.description || <span className="text-[#8a8680] italic">No description</span>}</p>
        )}
      </div>

      {/* Resources */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-[#8a8680] uppercase tracking-wide">Resources</p>
          {isManager && (
            <button onClick={() => setAddingRes(true)} className="text-xs text-[#575ECF]">+ Add</button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {resources.map((r, i) => (
            <div key={i} className="flex items-center gap-1 bg-[#1b1b1b] border border-white/8 rounded-lg px-3 py-1.5">
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#575ECF] hover:text-[#6B72D8]">
                {r.label || r.url}
              </a>
              {isManager && (
                <button onClick={() => removeResource(i)} className="text-[#ef4444] ml-1 text-xs">✕</button>
              )}
            </div>
          ))}
          {resources.length === 0 && <p className="text-sm text-[#8a8680] italic">No resources attached</p>}
        </div>
        {addingRes && (
          <div className="mt-3 flex gap-2 flex-wrap">
            <input
              className="flex-1 min-w-[120px] bg-[#1b1b1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#c5c1b9] outline-none focus:border-[#575ECF] placeholder-[#8a8680]"
              placeholder="Label"
              value={newRes.label}
              onChange={e => setNewRes(r => ({ ...r, label: e.target.value }))}
            />
            <input
              className="flex-1 min-w-[200px] bg-[#1b1b1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#c5c1b9] outline-none focus:border-[#575ECF] placeholder-[#8a8680]"
              placeholder="https://..."
              value={newRes.url}
              onChange={e => setNewRes(r => ({ ...r, url: e.target.value }))}
            />
            <button onClick={addResource} className="text-xs px-3 py-2 rounded-lg bg-[#575ECF] text-white">Add</button>
            <button onClick={() => setAddingRes(false)} className="text-xs px-3 py-2 rounded-lg bg-white/8 text-[#8a8680]">Cancel</button>
          </div>
        )}
      </div>

      {/* Stage History */}
      <div>
        <p className="text-xs font-medium text-[#8a8680] uppercase tracking-wide mb-3">Stage History</p>
        <div className="space-y-2">
          {(topic.stage_history || []).map((h, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-[#575ECF] mt-1.5 flex-shrink-0" />
              <div>
                <span className="text-[#c5c1b9]">
                  {h.old_stage ? `Moved from ${h.old_stage} to ` : 'Started at '}
                  <strong>{h.new_stage}</strong>
                </span>
                {h.changed_by_name && <span className="text-[#8a8680]"> by {h.changed_by_name}</span>}
                <span className="text-[#8a8680]"> · {formatDate(h.changed_at)}</span>
              </div>
            </div>
          ))}
          {(!topic.stage_history || topic.stage_history.length === 0) && (
            <p className="text-sm text-[#8a8680] italic">No history yet</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Notes Tab ─────────────────────────────────────────────────────────────────
function NotesTab({ topic, role, userId, onTopicUpdated }) {
  const [notes, setNotes] = useState(topic.notes || { key_takeaways: [], how_to_apply: [] })
  const [questions, setQuestions] = useState(topic.questions || [])
  const [newQuestion, setNewQuestion] = useState('')
  const [answeringId, setAnsweringId] = useState(null)
  const [answerText, setAnswerText] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const saveTimer = useRef(null)
  const isEmployee = role === 'employee'
  const isManager = role === 'manager' || role === 'admin'
  const canEdit = (isEmployee && ['Assigned', 'In Progress', 'Needs Revision'].includes(topic.stage)) || isManager

  function debouncedSave(field, value) {
    setSaveStatus('Saving...')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        const payload = { ...notes, [field]: value }
        await axios.put(`/api/lms/notes/${topic.id}`, payload)
        setNotes(n => ({ ...n, [field]: value }))
        setSaveStatus('Saved ✓')
        setTimeout(() => setSaveStatus(''), 2000)
      } catch {
        setSaveStatus('Error saving')
      }
    }, 1000)
  }

  async function addQuestion() {
    if (!newQuestion.trim()) return
    try {
      const { data } = await axios.post(`/api/lms/questions/${topic.id}`, { question_text: newQuestion.trim() })
      setQuestions(q => [...q, data])
      setNewQuestion('')
    } catch { toast.error('Error adding question') }
  }

  async function deleteQuestion(qId) {
    await axios.delete(`/api/lms/questions/${qId}`)
    setQuestions(q => q.filter(x => x.id !== qId))
  }

  async function submitAnswer(qId) {
    try {
      const { data } = await axios.patch(`/api/lms/questions/${qId}`, { manager_answer: answerText, answered_by: userId })
      setQuestions(q => q.map(x => x.id === qId ? data : x))
      setAnsweringId(null)
      setAnswerText('')
      toast.success('Answer saved')
    } catch { toast.error('Error saving answer') }
  }

  async function submitNotes() {
    const takeaways = notes.key_takeaways || []
    if (!takeaways.some(b => b.trim())) return toast.error('Add at least one key takeaway first')
    try {
      await axios.patch(`/api/lms/topics/${topic.id}/stage`, { new_stage: 'Notes Submitted', changed_by: userId, role })
      onTopicUpdated({ ...topic, stage: 'Notes Submitted' })
      toast.success('Notes submitted!')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error submitting notes')
    }
  }

  const readOnly = !canEdit

  return (
    <div className="space-y-6">
      {/* Save indicator */}
      {saveStatus && <p className="text-xs text-[#8a8680]">{saveStatus}</p>}

      {/* Key Takeaways */}
      <div>
        <p className="text-sm font-medium text-[#c5c1b9] mb-2">Key Takeaways</p>
        <BulletEditor
          value={notes.key_takeaways || []}
          onChange={v => debouncedSave('key_takeaways', v)}
          readOnly={readOnly}
          placeholder="Add your key takeaways..."
        />
      </div>

      {/* How I'll Apply */}
      <div>
        <p className="text-sm font-medium text-[#c5c1b9] mb-2">How I'll Apply This</p>
        <BulletEditor
          value={notes.how_to_apply || []}
          onChange={v => debouncedSave('how_to_apply', v)}
          readOnly={readOnly}
          placeholder="How will you apply what you've learned?"
        />
      </div>

      {/* Questions */}
      <div>
        <p className="text-sm font-medium text-[#c5c1b9] mb-3">Questions for Manager</p>
        <div className="space-y-3">
          {questions.map(q => (
            <div key={q.id} className="bg-[#1b1b1b] border border-white/8 rounded-lg p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm text-[#c5c1b9]">{q.question_text}</p>
                {isEmployee && !q.manager_answer && (
                  <button onClick={() => deleteQuestion(q.id)} className="text-[#ef4444] text-xs flex-shrink-0">✕</button>
                )}
              </div>
              {q.manager_answer ? (
                <div className="mt-2 pl-3 border-l-2 border-[#575ECF]">
                  <p className="text-xs text-[#8a8680] mb-1">Manager's answer</p>
                  <p className="text-sm text-[#c5c1b9]">{q.manager_answer}</p>
                </div>
              ) : (
                <p className="text-xs text-[#8a8680] italic">Awaiting manager response</p>
              )}
              {isManager && !q.manager_answer && answeringId !== q.id && (
                <button
                  onClick={() => { setAnsweringId(q.id); setAnswerText('') }}
                  className="mt-2 text-xs text-[#575ECF]"
                >Answer</button>
              )}
              {answeringId === q.id && (
                <div className="mt-2">
                  <textarea
                    className="w-full bg-[#242424] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#c5c1b9] outline-none focus:border-[#575ECF] resize-none h-20 placeholder-[#8a8680]"
                    placeholder="Type your answer..."
                    value={answerText}
                    onChange={e => setAnswerText(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => submitAnswer(q.id)} className="text-xs px-3 py-1.5 rounded-lg bg-[#575ECF] text-white">Save Answer</button>
                    <button onClick={() => setAnsweringId(null)} className="text-xs px-3 py-1.5 rounded-lg bg-white/8 text-[#8a8680]">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {questions.length === 0 && (
            <p className="text-sm text-[#8a8680] italic">No questions yet</p>
          )}
        </div>

        {(isEmployee && ['Assigned', 'In Progress', 'Needs Revision'].includes(topic.stage)) && (
          <div className="mt-3 flex gap-2">
            <input
              className="flex-1 bg-[#1b1b1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#c5c1b9] outline-none focus:border-[#575ECF] placeholder-[#8a8680]"
              placeholder="Ask a question..."
              value={newQuestion}
              onChange={e => setNewQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addQuestion()}
            />
            <button onClick={addQuestion} className="px-3 py-2 rounded-lg bg-white/8 text-sm text-[#c5c1b9]">＋ Add</button>
          </div>
        )}
      </div>

      {/* Submit button for employees */}
      {isEmployee && ['Assigned', 'In Progress', 'Needs Revision'].includes(topic.stage) && (
        <div className="pt-2 border-t border-white/8">
          <button
            onClick={submitNotes}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: '#575ECF' }}
          >
            Submit Notes →
          </button>
          <p className="text-xs text-[#8a8680] mt-2">This will move the topic to "Notes Submitted" for manager review.</p>
        </div>
      )}
    </div>
  )
}

// ── Assessment Tab ────────────────────────────────────────────────────────────
function AssessmentTab({ topic, role, userId, onTopicUpdated }) {
  const [assessments, setAssessments] = useState(topic.assessments || [])
  const [stars, setStars] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isManager = role === 'manager' || role === 'admin'
  const canAssess = isManager && topic.stage === 'Notes Submitted'

  async function submitAssessment(decision) {
    if (!stars) return toast.error('Please select a star rating')
    if (!feedback.trim()) return toast.error('Feedback is required')
    setSubmitting(true)
    try {
      await axios.post('/api/lms/assessments', { topic_id: topic.id, assessor_id: userId, star_rating: stars, feedback, decision })
      const newStage = decision === 'completed' ? 'Completed' : 'Needs Revision'
      onTopicUpdated({ ...topic, stage: newStage })
      const { data } = await axios.get(`/api/lms/assessments/${topic.id}`)
      setAssessments(data)
      toast.success(decision === 'completed' ? 'Marked as Completed!' : 'Sent for revision')
      setStars(0)
      setFeedback('')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error submitting assessment')
    }
    setSubmitting(false)
  }

  const decisionColors = { completed: '#22c55e', needs_revision: '#ef4444' }

  return (
    <div className="space-y-6">
      {canAssess && (
        <div className="bg-[#242424] border border-white/8 rounded-xl p-5">
          <p className="text-sm font-medium text-[#c5c1b9] mb-4">Submit Assessment</p>
          <div className="mb-4">
            <p className="text-xs text-[#8a8680] mb-2">Star Rating</p>
            <StarRating value={stars} onChange={setStars} />
          </div>
          <div className="mb-4">
            <p className="text-xs text-[#8a8680] mb-2">Feedback</p>
            <textarea
              className="w-full bg-[#1b1b1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#c5c1b9] outline-none focus:border-[#575ECF] resize-none h-24 placeholder-[#8a8680]"
              placeholder="Write your feedback..."
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => submitAssessment('completed')}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: '#22c55e' }}
            >
              ✓ Mark as Completed
            </button>
            <button
              onClick={() => submitAssessment('needs_revision')}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: '#ef4444' }}
            >
              ↩ Send for Revision
            </button>
          </div>
        </div>
      )}

      {assessments.length === 0 && !canAssess && (
        <p className="text-sm text-[#8a8680] italic">No assessment yet</p>
      )}

      {assessments.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-medium text-[#8a8680] uppercase tracking-wide">Assessment History</p>
          {assessments.map((a, i) => (
            <div key={a.id} className="bg-[#242424] border border-white/8 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <StarRating value={a.star_rating} readOnly />
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: `${decisionColors[a.decision]}20`, color: decisionColors[a.decision] }}
                >
                  {a.decision === 'completed' ? 'Completed' : 'Needs Revision'}
                </span>
              </div>
              <p className="text-sm text-[#c5c1b9] mt-2">{a.feedback}</p>
              <p className="text-xs text-[#8a8680] mt-2">by {a.assessor_name} · {formatDate(a.assessed_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Discussion Tab ────────────────────────────────────────────────────────────
function DiscussionTab({ topic, userId, userName }) {
  const [comments, setComments] = useState([])
  const [locked, setLocked] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { loadComments() }, [topic.stage])

  async function loadComments() {
    try {
      const { data } = await axios.get(`/api/lms/comments/${topic.id}`)
      setComments(data)
      setLocked(false)
    } catch (e) {
      if (e.response?.status === 403) setLocked(true)
    }
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [comments])

  async function sendMessage() {
    if (!message.trim() || sending) return
    setSending(true)
    try {
      const { data } = await axios.post('/api/lms/comments', { topic_id: topic.id, author_id: userId, message: message.trim() })
      setComments(c => [...c, data])
      setMessage('')
    } catch { toast.error('Error sending message') }
    setSending(false)
  }

  const roleBadge = role => {
    const colors = { employee: '#575ECF', manager: '#f59e0b', admin: '#22c55e' }
    return (
      <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${colors[role] || '#8a8680'}20`, color: colors[role] || '#8a8680' }}>
        {role}
      </span>
    )
  }

  if (locked) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-[#8a8680]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-[#c5c1b9] mb-1">Discussion Locked</p>
        <p className="text-xs text-[#8a8680]">Discussion unlocks after notes are submitted</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
        {comments.map(c => (
          <div key={c.id} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[#575ECF]/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-[#575ECF]">
              {c.author_name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-[#c5c1b9]">{c.author_name}</span>
                {roleBadge(c.author_role)}
                <span className="text-xs text-[#8a8680]">{formatDate(c.created_at)}</span>
              </div>
              <div className="bg-[#242424] border border-white/8 rounded-lg px-3 py-2">
                <p className="text-sm text-[#c5c1b9]">{c.message}</p>
              </div>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-sm text-[#8a8680] italic text-center py-4">No messages yet. Start the discussion!</p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 pt-3 border-t border-white/8">
        <textarea
          className="flex-1 bg-[#1b1b1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#c5c1b9] outline-none focus:border-[#575ECF] resize-none placeholder-[#8a8680]"
          placeholder="Write a message..."
          rows={2}
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
        />
        <button
          onClick={sendMessage}
          disabled={sending || !message.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white self-end"
          style={{ backgroundColor: message.trim() ? '#575ECF' : 'rgba(87,94,207,0.3)' }}
        >
          Send
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LmsTopicDetail() {
  const { topicId } = useParams()
  const navigate = useNavigate()
  const [topic, setTopic] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [stageMenuOpen, setStageMenuOpen] = useState(false)

  const userId = Number(localStorage.getItem('lms_user_id'))
  const role = localStorage.getItem('lms_user_role')
  const isManager = role === 'manager' || role === 'admin'

  useEffect(() => {
    if (!userId) { navigate('/learning'); return }
    loadTopic()
  }, [topicId])

  async function loadTopic() {
    setLoading(true)
    try {
      const { data } = await axios.get(`/api/lms/topics/${topicId}`)
      setTopic(data)
    } catch {
      toast.error('Topic not found')
      navigate(-1)
    }
    setLoading(false)
  }

  async function changeStage(newStage) {
    setStageMenuOpen(false)
    try {
      await axios.patch(`/api/lms/topics/${topicId}/stage`, { new_stage: newStage, changed_by: userId, role })
      loadTopic()
      toast.success(`Stage changed to ${newStage}`)
    } catch (e) {
      toast.error(e.response?.data?.error || 'Cannot change stage')
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#1b1b1b] flex items-center justify-center">
      <p className="text-[#8a8680]">Loading...</p>
    </div>
  )

  if (!topic) return null

  const overdue = isOverdue(topic)

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'notes', label: 'Notes' },
    { id: 'assessment', label: 'Assessment' },
    { id: 'discussion', label: 'Discussion' },
  ]

  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-[#8a8680] hover:text-[#c5c1b9] mb-6">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>

        {/* Header */}
        <div className="bg-[#242424] border border-white/8 rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-[#c5c1b9] mb-3">{topic.title}</h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#8a8680]">
                <span>Assigned to <strong className="text-[#c5c1b9]">{topic.assignee_name}</strong></span>
                {topic.assigned_by_name && <span>by {topic.assigned_by_name}</span>}
                {topic.due_date && (
                  <span style={{ color: overdue ? '#ef4444' : '#8a8680' }}>
                    Due {formatDate(topic.due_date)}{overdue ? ' · OVERDUE' : ''}
                  </span>
                )}
                {topic.is_sequential ? (
                  <span className="px-2 py-0.5 rounded-full bg-white/8 text-[#8a8680]">Sequential</span>
                ) : null}
              </div>
            </div>

            {/* Stage badge / dropdown */}
            <div className="relative">
              {isManager ? (
                <button
                  onClick={() => setStageMenuOpen(o => !o)}
                  className="flex items-center gap-1"
                >
                  <StageBadge stage={topic.stage} />
                  <svg className="w-3 h-3 text-[#8a8680]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              ) : (
                <StageBadge stage={topic.stage} />
              )}

              {stageMenuOpen && (
                <div className="absolute right-0 top-8 z-50 bg-[#2a2a2a] border border-white/10 rounded-lg overflow-hidden shadow-2xl min-w-[160px]">
                  {STAGES.map(s => (
                    <button
                      key={s}
                      onClick={() => changeStage(s)}
                      className="w-full text-left px-4 py-2.5 text-sm text-[#c5c1b9] hover:bg-white/8 transition-colors"
                      style={{ color: STAGE_COLORS[s] }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[#242424] border border-white/8 rounded-lg p-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="flex-1 py-2 rounded-md text-sm font-medium transition-colors"
              style={{
                backgroundColor: activeTab === t.id ? '#575ECF' : 'transparent',
                color: activeTab === t.id ? '#fff' : '#8a8680',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-[#242424] border border-white/8 rounded-2xl p-6">
          {activeTab === 'overview' && (
            <OverviewTab topic={topic} role={role} onTopicUpdated={t => setTopic(prev => ({ ...prev, ...t }))} />
          )}
          {activeTab === 'notes' && (
            <NotesTab
              topic={topic}
              role={role}
              userId={userId}
              onTopicUpdated={t => setTopic(prev => ({ ...prev, ...t }))}
            />
          )}
          {activeTab === 'assessment' && (
            <AssessmentTab
              topic={topic}
              role={role}
              userId={userId}
              onTopicUpdated={t => { setTopic(prev => ({ ...prev, ...t })); loadTopic() }}
            />
          )}
          {activeTab === 'discussion' && (
            <DiscussionTab topic={topic} userId={userId} userName={localStorage.getItem('lms_user_name')} />
          )}
        </div>
      </div>

      {/* Close stage menu on outside click */}
      {stageMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setStageMenuOpen(false)} />}
    </div>
  )
}
