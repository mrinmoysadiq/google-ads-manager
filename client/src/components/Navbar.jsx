import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { getUser, logout, decodeToken } from '../utils/auth'
import Avatar from './Avatar'
import infinixLogo from '../assets/infinix-logo.svg'

function InfinixLogo() {
  return (
    <div className="flex items-center">
      <img src={infinixLogo} alt="Infinix" style={{ height: '28px', width: 'auto' }} />
    </div>
  )
}

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname
  const [user, setUser] = useState(getUser())
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Always fetch fresh user data from API on mount so role/name/photo are correct.
  // If the API returns garbage (HTML page instead of JSON), fall back to localStorage
  // then to the decoded JWT token so the admin role is still detected correctly.
  useEffect(() => {
    const token = localStorage.getItem('app_token')
    if (!token) return

    // Seed the initial state from the token payload immediately (covers the "blank" flash)
    if (!user) {
      const decoded = decodeToken()
      if (decoded) setUser(prev => prev || { username: decoded.username, role: decoded.role, name: '' })
    }

    api.get('/auth/me')
      .then(({ data }) => {
        // Validate it's a real user object, not an HTML page
        if (data && typeof data === 'object' && data.id) {
          localStorage.setItem('app_user', JSON.stringify(data))
          setUser(data)
        }
      })
      .catch(() => { /* keep whatever is in state */ })

    const refresh = () => setUser(getUser())
    window.addEventListener('profile-updated', refresh)
    return () => window.removeEventListener('profile-updated', refresh)
  }, []) // eslint-disable-line

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isAudit = path === '/audit' || path.startsWith('/checklist') || path.startsWith('/complete') || path === '/changelog' || path === '/admin'
  const isLearning = path.startsWith('/learning')
  const isLinkedIn = path.startsWith('/outreach/linkedin')
  const isOutreach = path.startsWith('/outreach') && !isLinkedIn
  const isFacebook = path.startsWith('/facebook')
  const isTracking = path.startsWith('/tracking')

  const navLink = (to, label, activeColor = '#575ECF') => (
    <Link
      to={to}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors`}
      style={path === to
        ? { color: activeColor, backgroundColor: `${activeColor}18` }
        : { color: '#8a8680' }}
      onMouseEnter={e => { if (path !== to) { e.currentTarget.style.color = '#c5c1b9'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' } }}
      onMouseLeave={e => { if (path !== to) { e.currentTarget.style.color = '#8a8680'; e.currentTarget.style.backgroundColor = 'transparent' } }}
    >
      {label}
    </Link>
  )

  return (
    <nav className="bg-[#1b1b1b] border-b sticky top-0 z-50" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          <Link to="/" className="flex items-center">
            <InfinixLogo />
          </Link>

          <div className="flex items-center gap-1">
            {isAudit && <>{navLink('/changelog', 'Change Log')}{navLink('/admin', 'Admin')}</>}
            {isLearning && navLink('/learning/admin', 'Admin')}
            {isOutreach && navLink('/outreach/admin', 'Admin', '#e05d0a')}
            {isLinkedIn && navLink('/outreach/linkedin/admin', 'Admin', '#0a66c2')}
            {isFacebook && navLink('/facebook/admin', 'Admin', '#1877f2')}
            {isTracking && navLink('/tracking/admin', 'Admin', '#65db38')}

            {(isAudit || isLearning || isOutreach || isLinkedIn || isFacebook || isTracking) && (
              <Link
                to="/"
                className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#8a8680] hover:text-[#c5c1b9] transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Modules
              </Link>
            )}

            {/* Avatar / profile dropdown — always rendered if token exists */}
            <div className="relative ml-3" ref={ref}>
              <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-colors"
              >
                <Avatar name={user?.name || '?'} avatarUrl={user?.avatar_url} size={32} />
                <div className="hidden sm:block text-left max-w-[140px]">
                  <div className="text-xs font-semibold text-[#c5c1b9] leading-tight truncate">{user?.name || 'Account'}</div>
                  {user?.designation && <div className="text-[10px] text-[#8a8680] leading-tight truncate">{user.designation}</div>}
                </div>
                <svg className="w-3.5 h-3.5 text-[#8a8680] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {open && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-xl overflow-hidden z-50"
                  style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
                >
                  {/* User header */}
                  <div className="px-4 py-3 flex items-center gap-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                    <Avatar name={user?.name || '?'} avatarUrl={user?.avatar_url} size={36} />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#c5c1b9] truncate">{user?.name || '—'}</div>
                      <div className="text-[10px] text-[#8a8680] truncate">@{user?.username || '—'}</div>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 inline-block"
                        style={{ backgroundColor: user?.role === 'admin' ? '#575ECF20' : 'rgba(255,255,255,0.06)', color: user?.role === 'admin' ? '#818cf8' : '#8a8680' }}>
                        {user?.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => { setOpen(false); navigate('/profile') }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#c5c1b9] hover:bg-white/5 transition-colors text-left"
                    >
                      <svg className="w-4 h-4 text-[#8a8680]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      My Profile
                    </button>

                    {(user?.role === 'admin') && (
                      <button
                        onClick={() => { setOpen(false); navigate('/admin-panel') }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#c5c1b9] hover:bg-white/5 transition-colors text-left"
                      >
                        <svg className="w-4 h-4 text-[#f59e0b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span>User Management</span>
                        <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#f59e0b20', color: '#f59e0b' }}>Admin</span>
                      </button>
                    )}

                    <div className="my-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }} />

                    <button
                      onClick={() => { setOpen(false); logout() }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
                      style={{ color: '#ef4444' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </nav>
  )
}
