import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Select from 'react-select'
import toast from 'react-hot-toast'
import {
  getLearningUsers,
  getManagerOverview,
  getManagerFeed,
  getThreads,
  postThread,
} from '../../utils/learningApi'
import { getISOWeek, getWeekRange, weekLabel, isFridayPassed, formatDateTime } from '../../utils/weekUtils'

const LS_KEY = 'learning_selected_user'

const selectStyles = {
  control: (base, { isFocused }) => ({
    ...base,
    backgroundColor: '#2a2a2a',
    borderColor: isFocused ? '#575ECF' : 'rgba(255,255,255,0.1)',
    boxShadow: 'none',
    '&:hover': { borderColor: '#575ECF' },
    minHeight: '40px',
  }),
  menu: (base) => ({ ...base, backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', zIndex: 50 }),
  option: (base, { isSelected, isFocused }) => ({
    ...base,
    backgroundColor: isSelected ? '#575ECF' : isFocused ? 'rgba(87,94,207,0.15)' : 'transparent',
    color: '#c5c1b9',
    cursor: 'pointer',
    fontSize: '13px',
  }),
  singleValue: (base) => ({ ...base, color: '#c5c1b9', fontSize: '13px' }),
  placeholder: (base) => ({ ...base, color: '#8a8680', fontSize: '13px' }),
  input: (base) => ({ ...base, color: '#c5c1b9' }),
  dropdownIndicator: (base) => ({ ...base, color: '#8a8680' }),
  indicatorSeparator: (base) => ({ ...base, backgroundColor: 'rgba(255,255,255,0.1)' }),
  clearIndicator: (base) => ({ ...base, color: '#8a8680', '&:hover': { color: '#c5c1b9' } }),
}

// ── Thread inline component ────────────────────────────────────────────────────
function FeedEntryThread({ entry, allUsers, currentUserId, onNewReply }) {
  const [threads, setThreads] = useState(null)
  const [loading, setLoading] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replyAuthorId, setReplyAuthorId] = useState(currentUserId || '')
  const [posting, setPosting] = useState(false)

  const LS_THREAD_KEY = `learning_thread_count_${entry.id}`

  const load = useCallback(() => {
    setLoading(true)
    getThreads(entry.id).then(t => {
      setThreads(t)
      setLoading(false)
      // Mark as viewed — store current count
      localStorage.setItem(LS_THREAD_KEY, String(t.length))
    }).catch(() => setLoading(false))
  }, [entry.id])

  useEffect(() => { load() }, [])

  const handlePost = async () => {
    if (!replyText.trim()) return
    if (!replyAuthorId) return toast.error('Please select who you are')
    setPosting(true)
    try {
      const msg = await postThread({ entry_id: entry.id, author_id: replyAuthorId, message: replyText.trim() })
      const updated = [...(threads || []), msg]
      setThreads(updated)
      localStorage.setItem(LS_THREAD_KEY, String(updated.length))
      setReplyText('')
      onNewReply(entry.id, updated.length)
      toast.success('Reply posted!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to post reply')
    } finally {
      setPosting(false)
    }
  }

  const authorOptions = allUsers
    .filter(u => u.active)
    .map(u => ({ value: u.id, label: u.name + (u.role_name ? ` · ${u.role_name}` : '') }))

  return (
    <div className="mt-4 pt-4 border-t border-white/8">
      {loading ? (
        <p className="text-xs text-[#8a8680] italic">Loading thread…</p>
      ) : (
        <>
          {threads && threads.length > 0 ? (
            <div className="space-y-3 mb-4">
              {threads.map(t => (
                <div key={t.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#575ECF]/20 border border-[#575ECF]/30 flex items-center justify-center text-xs font-bold text-[#575ECF] flex-shrink-0 mt-0.5">
                    {t.author_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-[#c5c1b9]">{t.author_name}</span>
                      <span className="text-xs text-[#8a8680]">{formatDateTime(t.created_at)}</span>
                    </div>
                    <p className="text-sm text-[#c5c1b9] leading-relaxed">{t.message}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#8a8680] italic mb-3">No replies yet.</p>
          )}

          {/* Reply form */}
          <div className="space-y-2">
            <div className="w-52">
              <Select
                options={authorOptions}
                value={authorOptions.find(o => o.value === replyAuthorId) || null}
                onChange={opt => setReplyAuthorId(opt ? opt.value : '')}
                placeholder="Reply as…"
                styles={selectStyles}
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask a question or leave feedback…"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePost()}
                className="flex-1 rounded-lg px-3 py-2 text-sm bg-[#1b1b1b] border border-white/10 text-[#c5c1b9] focus:outline-none focus:border-[#575ECF] transition-colors"
              />
              <button
                onClick={handlePost}
                disabled={posting || !replyText.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-colors"
                style={{ backgroundColor: '#575ECF' }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#6B72D8' }}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#575ECF'}
              >
                {posting ? '…' : 'Send'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Feed Entry Card ────────────────────────────────────────────────────────────
function FeedEntryCard({ entry, allUsers, currentUserId }) {
  const [showThread, setShowThread] = useState(false)
  const [threadCount, setThreadCount] = useState(entry.thread_count || 0)

  const LS_THREAD_KEY = `learning_thread_count_${entry.id}`
  const storedCount = parseInt(localStorage.getItem(LS_THREAD_KEY) || '0')
  const unreadCount = Math.max(0, threadCount - storedCount)

  const handleNewReply = (entryId, newCount) => {
    setThreadCount(newCount)
  }

  return (
    <div className="rounded-xl p-5 bg-[#242424] border border-white/8">
      {/* Author + meta */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#575ECF]/15 border border-[#575ECF]/25 flex items-center justify-center text-sm font-bold text-[#575ECF] flex-shrink-0">
            {entry.user_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-sm font-semibold text-[#c5c1b9]">{entry.user_name}</p>
            <p className="text-xs text-[#8a8680]">
              {entry.role_name || 'No role'} · {weekLabel(entry.week)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(87,94,207,0.12)', color: '#575ECF' }}>
            {entry.source_type}
          </span>
          {entry.is_late === 1 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
              Late
            </span>
          )}
        </div>
      </div>

      {/* What learned */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-[#8a8680] uppercase tracking-wide mb-1">What They Learned</p>
        <p className="text-sm text-[#c5c1b9] leading-relaxed whitespace-pre-line">{entry.what_learned}</p>
      </div>

      {entry.source_detail && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-[#8a8680] uppercase tracking-wide mb-1">Source</p>
          <p className="text-sm text-[#c5c1b9]">
            {entry.source_detail.startsWith('http') ? (
              <a href={entry.source_detail} target="_blank" rel="noopener noreferrer" className="text-[#575ECF] hover:text-[#6B72D8] underline break-all">
                {entry.source_detail}
              </a>
            ) : entry.source_detail}
          </p>
        </div>
      )}

      <div className="mb-4">
        <p className="text-xs font-semibold text-[#8a8680] uppercase tracking-wide mb-1">How They'll Apply It</p>
        <p className="text-sm text-[#c5c1b9] leading-relaxed whitespace-pre-line">{entry.how_to_apply}</p>
      </div>

      {/* Thread toggle */}
      <button
        onClick={() => setShowThread(v => !v)}
        className="flex items-center gap-1.5 text-xs font-medium transition-colors"
        style={{ color: showThread ? '#575ECF' : '#8a8680' }}
        onMouseEnter={e => e.currentTarget.style.color = '#575ECF'}
        onMouseLeave={e => e.currentTarget.style.color = showThread ? '#575ECF' : '#8a8680'}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {threadCount > 0 ? `${threadCount} repl${threadCount === 1 ? 'y' : 'ies'}` : 'Ask a question'}
        {unreadCount > 0 && !showThread && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: '#575ECF' }}>
            {unreadCount}
          </span>
        )}
        <svg className={`w-3 h-3 transition-transform ${showThread ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showThread && (
        <FeedEntryThread
          entry={{ ...entry, thread_count: threadCount }}
          allUsers={allUsers}
          currentUserId={currentUserId}
          onNewReply={handleNewReply}
        />
      )}
    </div>
  )
}

// ── Overview Tab ───────────────────────────────────────────────────────────────
function OverviewTab({ managerId }) {
  const navigate = useNavigate()
  const [overview, setOverview] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getManagerOverview(managerId)
      .then(data => { setOverview(data); setLoading(false) })
      .catch(() => { toast.error('Failed to load overview'); setLoading(false) })
  }, [managerId])

  if (loading) return (
    <div className="flex justify-center py-10">
      <svg className="w-7 h-7 animate-spin text-[#575ECF]" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  )

  if (overview.length === 0) return (
    <div className="text-center py-10">
      <p className="text-[#8a8680] text-sm">No direct reports found.</p>
      <p className="text-xs text-[#8a8680] mt-1">Assign team members to this manager in <Link to="/learning/admin" className="text-[#575ECF]">Admin</Link>.</p>
    </div>
  )

  return (
    <div className="rounded-xl overflow-hidden border border-white/8">
      <table className="w-full text-sm">
        <thead style={{ backgroundColor: '#1b1b1b' }}>
          <tr>
            {['Name', 'Role', 'Streak', 'Submissions', 'Missed', 'Last Submission'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#8a8680]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {overview.map(({ user, streak, total_submissions, missed_weeks, last_submission_week }, i) => (
            <tr
              key={user.id}
              onClick={() => navigate(`/learning/history/${user.id}`)}
              className="cursor-pointer transition-colors"
              style={{
                backgroundColor: i % 2 === 0 ? '#242424' : '#2a2a2a',
                borderTop: '1px solid rgba(255,255,255,0.04)',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(87,94,207,0.08)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#242424' : '#2a2a2a'}
            >
              <td className="px-4 py-3 font-medium text-[#c5c1b9]">{user.name}</td>
              <td className="px-4 py-3 text-[#8a8680]">{user.role_name || '—'}</td>
              <td className="px-4 py-3">
                <span className="font-semibold text-[#c5c1b9]">🔥 {streak}</span>
              </td>
              <td className="px-4 py-3 text-[#c5c1b9]">{total_submissions}</td>
              <td className="px-4 py-3">
                <span className={`font-medium ${missed_weeks > 2 ? 'text-[#f87171]' : missed_weeks > 0 ? 'text-[#fbbf24]' : 'text-[#4ade80]'}`}>
                  {missed_weeks}
                </span>
              </td>
              <td className="px-4 py-3 text-[#8a8680] text-xs">
                {last_submission_week ? weekLabel(last_submission_week) : <span className="italic">Never</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Feed Tab ───────────────────────────────────────────────────────────────────
function FeedTab({ managerId, allUsers, currentUserId }) {
  const currentWeek = getISOWeek()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterUser, setFilterUser] = useState(null)
  const [filterWeek, setFilterWeek] = useState(null)

  // Build week options for filter
  const [weekOptions, setWeekOptions] = useState([])

  useEffect(() => {
    // Gather weeks from all direct reports' joined dates
    const joinedWeeks = allUsers
      .filter(u => u.manager_id === parseInt(managerId))
      .map(u => u.joined_week)
    if (joinedWeeks.length > 0) {
      const earliest = joinedWeeks.sort()[0]
      const weeks = getWeekRange(earliest, currentWeek).reverse()
      setWeekOptions(weeks.map(w => ({ value: w, label: weekLabel(w) })))
    }
  }, [allUsers, managerId])

  const fetchFeed = useCallback(() => {
    setLoading(true)
    const params = {}
    if (filterUser) params.user_id = filterUser
    if (filterWeek) params.week = filterWeek
    getManagerFeed(managerId, params)
      .then(data => { setEntries(data); setLoading(false) })
      .catch(() => { toast.error('Failed to load feed'); setLoading(false) })
  }, [managerId, filterUser, filterWeek])

  useEffect(() => { fetchFeed() }, [fetchFeed])

  const directReports = allUsers.filter(u => u.manager_id === parseInt(managerId) && u.active)
  const userOptions = directReports.map(u => ({ value: u.id, label: u.name + (u.role_name ? ` · ${u.role_name}` : '') }))

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <div className="w-52">
          <Select
            options={userOptions}
            value={userOptions.find(o => o.value === filterUser) || null}
            onChange={opt => setFilterUser(opt ? opt.value : null)}
            placeholder="Filter by member…"
            isClearable
            styles={selectStyles}
          />
        </div>
        <div className="w-60">
          <Select
            options={weekOptions}
            value={weekOptions.find(o => o.value === filterWeek) || null}
            onChange={opt => setFilterWeek(opt ? opt.value : null)}
            placeholder="Filter by week…"
            isClearable
            styles={selectStyles}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <svg className="w-7 h-7 animate-spin text-[#575ECF]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl p-8 text-center bg-[#242424] border border-white/8">
          <p className="text-[#8a8680] text-sm italic">No entries found{filterUser || filterWeek ? ' for the selected filters' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map(entry => (
            <FeedEntryCard
              key={entry.id}
              entry={entry}
              allUsers={allUsers}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function LearningManagerDashboard() {
  const { managerId } = useParams()
  const [activeTab, setActiveTab] = useState('overview')
  const [manager, setManager] = useState(null)
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)

  let currentUserId = null
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY))
    currentUserId = saved?.id || null
  } catch {}

  useEffect(() => {
    getLearningUsers()
      .then(users => {
        setAllUsers(users)
        const m = users.find(u => u.id === parseInt(managerId))
        setManager(m)
        setLoading(false)
      })
      .catch(() => { toast.error('Failed to load users'); setLoading(false) })
  }, [managerId])

  if (loading) return (
    <div className="min-h-screen bg-[#1b1b1b] flex items-center justify-center">
      <svg className="w-8 h-8 animate-spin text-[#575ECF]" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  )

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'feed', label: '📋 Feed' },
  ]

  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-7 text-sm">
          <Link to="/learning" className="text-[#8a8680] hover:text-[#c5c1b9] transition-colors">Learning</Link>
          <span className="text-[#8a8680]">/</span>
          <span className="text-[#c5c1b9] font-medium">Manager Dashboard</span>
        </div>

        {/* Header */}
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-[#c5c1b9]">Manager Dashboard</h1>
          {manager && (
            <p className="text-[#8a8680] text-sm mt-1">
              Viewing as <span className="text-[#c5c1b9] font-medium">{manager.name}</span>
              {manager.role_name ? ` · ${manager.role_name}` : ''}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
              style={activeTab === tab.id
                ? { backgroundColor: '#575ECF', color: '#fff' }
                : { color: '#8a8680' }
              }
              onMouseEnter={e => { if (activeTab !== tab.id) e.currentTarget.style.color = '#c5c1b9' }}
              onMouseLeave={e => { if (activeTab !== tab.id) e.currentTarget.style.color = '#8a8680' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' ? (
          <OverviewTab managerId={managerId} />
        ) : (
          <FeedTab managerId={managerId} allUsers={allUsers} currentUserId={currentUserId} />
        )}
      </div>
    </div>
  )
}
