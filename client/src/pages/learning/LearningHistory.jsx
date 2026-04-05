import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Select from 'react-select'
import toast from 'react-hot-toast'
import { getLearningUsers, getUserStats, getEntries, deleteEntry, getThreads, postThread } from '../../utils/learningApi'
import { getISOWeek, getWeekRange, weekLabel, isFridayPassed, formatDateTime } from '../../utils/weekUtils'

const LS_KEY = 'learning_selected_user'

const selectStyles = {
  control: (base, { isFocused }) => ({
    ...base,
    backgroundColor: '#2a2a2a',
    borderColor: isFocused ? '#575ECF' : 'rgba(255,255,255,0.1)',
    boxShadow: 'none',
    '&:hover': { borderColor: '#575ECF' },
    minHeight: '38px',
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
}

// ── Thread inline component ────────────────────────────────────────────────────
function ThreadSection({ entry, allUsers, currentUserId }) {
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [replyAuthorId, setReplyAuthorId] = useState(currentUserId || '')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    getThreads(entry.id)
      .then(t => { setThreads(t); setLoading(false) })
      .catch(() => setLoading(false))
  }, [entry.id])

  const handlePost = async () => {
    if (!replyText.trim()) return
    if (!replyAuthorId) return toast.error('Please select who you are')
    setPosting(true)
    try {
      const msg = await postThread({ entry_id: entry.id, author_id: replyAuthorId, message: replyText.trim() })
      setThreads(p => [...p, msg])
      setReplyText('')
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
          {threads.length === 0 ? (
            <p className="text-xs italic text-[#8a8680]">No replies yet.</p>
          ) : (
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
          )}

          {/* Reply form */}
          <div className="space-y-2">
            <div className="w-48">
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
                placeholder="Write a reply…"
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
                {posting ? '…' : 'Reply'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Entry Card ─────────────────────────────────────────────────────────────────
function EntryCard({ entry, allUsers, currentUserId, onDelete }) {
  const [showThread, setShowThread] = useState(false)

  return (
    <div className="rounded-xl p-5 bg-[#2a2a2a] border border-white/8">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(87,94,207,0.15)', color: '#575ECF' }}>
            {entry.source_type}
          </span>
          {entry.is_late === 1 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
              Late
            </span>
          )}
          <span className="text-xs text-[#8a8680]">{formatDateTime(entry.created_at)}</span>
        </div>
        <button
          onClick={() => onDelete(entry.id)}
          className="text-xs text-[#8a8680] hover:text-[#f87171] transition-colors flex-shrink-0"
          title="Delete entry"
        >
          ✕
        </button>
      </div>

      {/* What learned */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-[#8a8680] uppercase tracking-wide mb-1">What I Learned</p>
        <p className="text-sm text-[#c5c1b9] leading-relaxed whitespace-pre-line">{entry.what_learned}</p>
      </div>

      {/* Source detail */}
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

      {/* How to apply */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-[#8a8680] uppercase tracking-wide mb-1">How I'll Apply It</p>
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
        {entry.thread_count > 0 ? `${entry.thread_count} repl${entry.thread_count === 1 ? 'y' : 'ies'}` : 'Reply'}
        <svg className={`w-3 h-3 transition-transform ${showThread ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showThread && (
        <ThreadSection entry={entry} allUsers={allUsers} currentUserId={currentUserId} />
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function LearningHistory() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [allUsers, setAllUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const currentWeek = getISOWeek()

  // Get current user from localStorage for thread reply defaults
  let currentUserId = null
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY))
    currentUserId = saved?.id || null
  } catch {}

  useEffect(() => {
    Promise.all([
      getLearningUsers(),
      getUserStats(userId),
      getEntries({ user_id: userId }),
    ]).then(([users, s, e]) => {
      const target = users.find(u => u.id === parseInt(userId))
      setUser(target)
      setAllUsers(users)
      setStats(s)
      setEntries(e)
      setLoading(false)
    }).catch(() => {
      toast.error('Failed to load history')
      setLoading(false)
    })
  }, [userId])

  const handleDelete = async (entryId) => {
    if (!window.confirm('Delete this entry? This cannot be undone.')) return
    try {
      await deleteEntry(entryId)
      setEntries(p => p.filter(e => e.id !== entryId))
      toast.success('Entry deleted')
    } catch {
      toast.error('Failed to delete entry')
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#1b1b1b] flex items-center justify-center">
      <svg className="w-8 h-8 animate-spin text-[#575ECF]" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  )

  if (!user) return (
    <div className="min-h-screen bg-[#1b1b1b] flex items-center justify-center">
      <p className="text-[#8a8680]">User not found. <Link to="/learning" className="text-[#575ECF]">Back to Learning</Link></p>
    </div>
  )

  // Build week list
  const allWeeks = getWeekRange(user.joined_week, currentWeek).reverse()
  const entryMap = {}
  entries.forEach(e => {
    if (!entryMap[e.week]) entryMap[e.week] = []
    entryMap[e.week].push(e)
  })

  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-7 text-sm">
          <Link to="/learning" className="text-[#8a8680] hover:text-[#c5c1b9] transition-colors">Learning</Link>
          <span className="text-[#8a8680]">/</span>
          <span className="text-[#c5c1b9] font-medium">{user.name}</span>
        </div>

        {/* User Header */}
        <div className="rounded-xl p-6 bg-[#242424] border border-white/8 mb-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-xl bg-[#575ECF]/15 border border-[#575ECF]/25 flex items-center justify-center text-lg font-bold text-[#575ECF]">
              {user.name[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#c5c1b9]">{user.name}</h1>
              <p className="text-sm text-[#8a8680]">
                {user.role_name || 'No role'} · Joined {user.joined_week}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '🔥 Streak', value: `${stats?.streak ?? 0} wks` },
              { label: 'Submissions', value: stats?.total_submissions ?? 0 },
              { label: 'Missed', value: stats?.missed_weeks ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg p-3 text-center" style={{ backgroundColor: '#1b1b1b', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-xs text-[#8a8680] mb-1">{label}</p>
                <p className="text-lg font-bold text-[#c5c1b9]">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Week-by-week history */}
        <div className="space-y-4">
          {allWeeks.map(week => {
            const weekEntries = entryMap[week] || []
            const deadlinePassed = isFridayPassed(week)
            const isCurrentWeek = week === currentWeek

            return (
              <div key={week}>
                {/* Week header */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-sm font-semibold text-[#c5c1b9]">{weekLabel(week)}</h3>
                  {isCurrentWeek && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(87,94,207,0.15)', color: '#575ECF' }}>
                      Current week
                    </span>
                  )}
                </div>

                {weekEntries.length > 0 ? (
                  <div className="space-y-3">
                    {weekEntries.map(entry => (
                      <EntryCard
                        key={entry.id}
                        entry={entry}
                        allUsers={allUsers}
                        currentUserId={currentUserId}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                ) : isCurrentWeek && !deadlinePassed ? (
                  <div className="rounded-xl px-5 py-4 border border-dashed border-white/10 flex items-center justify-between">
                    <p className="text-sm text-[#8a8680] italic">Not yet submitted this week</p>
                    <Link
                      to="/learning/submit"
                      className="text-xs font-medium text-[#575ECF] hover:text-[#6B72D8] transition-colors"
                    >
                      Submit now →
                    </Link>
                  </div>
                ) : (
                  <div className="rounded-xl px-5 py-4 border border-white/6 opacity-50">
                    <p className="text-sm text-[#8a8680] italic">No submission</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {allWeeks.length === 0 && (
          <p className="text-sm text-[#8a8680] italic text-center py-8">No weeks tracked yet.</p>
        )}
      </div>
    </div>
  )
}
