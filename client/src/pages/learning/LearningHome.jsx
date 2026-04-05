import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Select from 'react-select'
import toast from 'react-hot-toast'
import { getLearningUsers, getUserStats } from '../../utils/learningApi'
import { weekLabel, getISOWeek } from '../../utils/weekUtils'

const LS_KEY = 'learning_selected_user'

const selectStyles = {
  control: (base, { isFocused }) => ({
    ...base,
    backgroundColor: '#2a2a2a',
    borderColor: isFocused ? '#575ECF' : 'rgba(255,255,255,0.1)',
    boxShadow: 'none',
    '&:hover': { borderColor: '#575ECF' },
    minHeight: '44px',
    color: '#c5c1b9',
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: '#2a2a2a',
    border: '1px solid rgba(255,255,255,0.12)',
    zIndex: 50,
  }),
  option: (base, { isSelected, isFocused }) => ({
    ...base,
    backgroundColor: isSelected ? '#575ECF' : isFocused ? 'rgba(87,94,207,0.15)' : 'transparent',
    color: '#c5c1b9',
    cursor: 'pointer',
  }),
  singleValue: (base) => ({ ...base, color: '#c5c1b9' }),
  placeholder: (base) => ({ ...base, color: '#8a8680' }),
  input: (base) => ({ ...base, color: '#c5c1b9' }),
  dropdownIndicator: (base) => ({ ...base, color: '#8a8680' }),
  indicatorSeparator: (base) => ({ ...base, backgroundColor: 'rgba(255,255,255,0.1)' }),
}

function StatPill({ label, value, accent }) {
  return (
    <div className="rounded-xl px-5 py-4 flex flex-col gap-0.5 flex-1" style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="text-xs uppercase tracking-wide font-semibold text-[#8a8680]">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-[#575ECF]' : 'text-[#c5c1b9]'}`}>{value}</p>
    </div>
  )
}

export default function LearningHome() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [hasReports, setHasReports] = useState(false)

  // Load all active users
  useEffect(() => {
    getLearningUsers()
      .then(all => {
        setUsers(all.filter(u => u.active))
        setLoadingUsers(false)

        // Restore previously selected user from localStorage
        try {
          const saved = JSON.parse(localStorage.getItem(LS_KEY))
          if (saved?.id) {
            const match = all.find(u => u.id === saved.id && u.active)
            if (match) setSelectedUser(match)
          }
        } catch {}
      })
      .catch(() => {
        toast.error('Failed to load users')
        setLoadingUsers(false)
      })
  }, [])

  // When selected user changes, fetch stats + check direct reports
  useEffect(() => {
    if (!selectedUser) {
      setStats(null)
      setHasReports(false)
      return
    }
    localStorage.setItem(LS_KEY, JSON.stringify(selectedUser))

    setLoadingStats(true)
    Promise.all([
      getUserStats(selectedUser.id),
      getLearningUsers(),
    ]).then(([s, allUsers]) => {
      setStats(s)
      setHasReports(allUsers.some(u => u.manager_id === selectedUser.id && u.active))
      setLoadingStats(false)
    }).catch(() => {
      toast.error('Failed to load stats')
      setLoadingStats(false)
    })
  }, [selectedUser])

  const userOptions = users.map(u => ({
    value: u.id,
    label: u.name + (u.role_name ? ` · ${u.role_name}` : ''),
    user: u,
  }))

  const currentWeek = getISOWeek()

  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#c5c1b9]">Weekly Learning Tracker</h1>
            <p className="text-[#8a8680] text-sm mt-1">Track and share what you're learning each week</p>
          </div>
          <Link
            to="/learning/admin"
            className="flex items-center gap-1.5 text-sm text-[#8a8680] hover:text-[#c5c1b9] transition-colors mt-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Admin
          </Link>
        </div>

        {/* User Selector Card */}
        <div className="rounded-xl p-6 bg-[#242424] border border-white/8 mb-5">
          <label className="block text-sm font-semibold text-[#c5c1b9] mb-3">
            Who are you?
          </label>
          {loadingUsers ? (
            <div className="flex items-center gap-2 text-sm text-[#8a8680]">
              <svg className="w-4 h-4 animate-spin text-[#575ECF]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading users…
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-lg p-4 text-sm text-[#8a8680]" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              No users set up yet.{' '}
              <Link to="/learning/admin" className="text-[#575ECF] hover:text-[#6B72D8]">Go to Admin</Link> to add users.
            </div>
          ) : (
            <Select
              options={userOptions}
              value={userOptions.find(o => o.value === selectedUser?.id) || null}
              onChange={opt => setSelectedUser(opt ? opt.user : null)}
              placeholder="Select your name…"
              isClearable
              styles={selectStyles}
            />
          )}
        </div>

        {/* Stats + Actions */}
        {selectedUser && (
          <>
            {/* Stats */}
            <div className="rounded-xl p-6 bg-[#242424] border border-white/8 mb-5">
              {/* Streak hero */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: 'rgba(87,94,207,0.15)', border: '1px solid rgba(87,94,207,0.25)' }}>
                  🔥
                </div>
                <div>
                  {loadingStats ? (
                    <div className="h-7 w-24 rounded bg-[#2a2a2a] animate-pulse" />
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-[#c5c1b9]">
                        {stats?.streak ?? 0} week{stats?.streak !== 1 ? 's' : ''}
                        <span className="text-sm font-normal text-[#8a8680] ml-2">streak</span>
                      </p>
                      <p className="text-xs text-[#8a8680]">
                        {selectedUser.role_name ? `${selectedUser.role_name} · ` : ''}
                        Joined {selectedUser.joined_week}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Stat pills */}
              {loadingStats ? (
                <div className="flex gap-3">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="flex-1 h-20 rounded-xl bg-[#2a2a2a] animate-pulse" />
                  ))}
                </div>
              ) : stats && (
                <div className="flex gap-3">
                  <StatPill label="Total Submissions" value={stats.total_submissions} />
                  <StatPill label="Missed Weeks" value={stats.missed_weeks} accent={stats.missed_weeks > 2} />
                </div>
              )}

              {/* Current week label */}
              <p className="text-xs text-[#8a8680] mt-4">
                Current week: <span className="text-[#c5c1b9]">{weekLabel(currentWeek)}</span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate('/learning/submit')}
                className="w-full flex items-center justify-between px-6 py-4 rounded-xl text-white font-semibold text-sm transition-all group"
                style={{ backgroundColor: '#575ECF', border: '1px solid rgba(255,255,255,0.1)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#6B72D8'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#575ECF'}
              >
                <span>📝 Submit This Week's Learning</span>
                <svg className="w-5 h-5 opacity-70 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={() => navigate(`/learning/history/${selectedUser.id}`)}
                className="w-full flex items-center justify-between px-6 py-4 rounded-xl font-semibold text-sm transition-all group text-[#c5c1b9]"
                style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#575ECF'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
              >
                <span>📚 View My History</span>
                <svg className="w-5 h-5 opacity-70 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {hasReports && (
                <button
                  onClick={() => navigate(`/learning/manager/${selectedUser.id}`)}
                  className="w-full flex items-center justify-between px-6 py-4 rounded-xl font-semibold text-sm transition-all group text-[#c5c1b9]"
                  style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#575ECF'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                >
                  <span>👥 Manager Dashboard</span>
                  <svg className="w-5 h-5 opacity-70 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
