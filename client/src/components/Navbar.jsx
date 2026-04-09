import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getUser, logout, isAdmin } from '../utils/auth'
import Avatar from './Avatar'
import infinixLogo from '../assets/infinix-logo.svg'

// ── Infinix brand logo (compact navbar version) ───────────────────────────────
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
  const user = getUser()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Context detection
  const isAudit = path === '/audit' ||
    path.startsWith('/checklist') ||
    path.startsWith('/complete') ||
    path === '/changelog' ||
    path === '/admin'

  const isLearning = path.startsWith('/learning')
  const isOutreach = path.startsWith('/outreach')
  const isFacebook = path.startsWith('/facebook')

  const auditNavLink = (to, label) => (
    <Link
      to={to}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        path === to
          ? 'text-[#575ECF] bg-[#575ECF]/10'
          : 'text-[#8a8680] hover:text-[#c5c1b9] hover:bg-white/5'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <nav className="bg-[#1b1b1b] border-b sticky top-0 z-50" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo — always links back to home */}
          <Link to="/" className="flex items-center">
            <InfinixLogo />
          </Link>

          {/* Right side: context nav + avatar */}
          <div className="flex items-center gap-1">
            {/* Context-aware nav links */}
            {isAudit && (
              <>
                {auditNavLink('/changelog', 'Change Log')}
                {auditNavLink('/admin', 'Admin')}
              </>
            )}

            {isLearning && (
              <Link
                to="/learning/admin"
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  path === '/learning/admin'
                    ? 'text-[#575ECF] bg-[#575ECF]/10'
                    : 'text-[#8a8680] hover:text-[#c5c1b9] hover:bg-white/5'
                }`}
              >
                Admin
              </Link>
            )}

            {isOutreach && (
              <Link
                to="/outreach/admin"
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  path === '/outreach/admin'
                    ? 'text-[#e05d0a] bg-[#e05d0a]/10'
                    : 'text-[#8a8680] hover:text-[#c5c1b9] hover:bg-white/5'
                }`}
              >
                Admin
              </Link>
            )}

            {isFacebook && (
              <Link
                to="/facebook/admin"
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  path === '/facebook/admin'
                    ? 'text-[#1877f2] bg-[#1877f2]/10'
                    : 'text-[#8a8680] hover:text-[#c5c1b9] hover:bg-white/5'
                }`}
              >
                Admin
              </Link>
            )}

            {/* "Back to modules" pill — shown inside any module */}
            {(isAudit || isLearning || isOutreach || isFacebook) && (
              <Link
                to="/"
                className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-[#8a8680] hover:text-[#c5c1b9]"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Modules
              </Link>
            )}

            {/* Avatar dropdown */}
            {user && (
              <div className="relative ml-3" ref={ref}>
                <button
                  onClick={() => setOpen(o => !o)}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <Avatar name={user.name} avatarUrl={user.avatar_url} size={30} />
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-semibold text-[#c5c1b9] leading-tight">{user.name}</div>
                    {user.designation && <div className="text-[10px] text-[#8a8680] leading-tight">{user.designation}</div>}
                  </div>
                  <svg className="w-3.5 h-3.5 text-[#8a8680]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {open && (
                  <div
                    className="absolute right-0 mt-2 w-52 rounded-xl overflow-hidden z-50"
                    style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                  >
                    {/* User info header */}
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                      <div className="text-xs font-semibold text-[#c5c1b9]">{user.name}</div>
                      <div className="text-[10px] text-[#8a8680]">@{user.username}</div>
                    </div>

                    {/* Menu items */}
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

                      {isAdmin() && (
                        <button
                          onClick={() => { setOpen(false); navigate('/admin-panel') }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#c5c1b9] hover:bg-white/5 transition-colors text-left"
                        >
                          <svg className="w-4 h-4 text-[#8a8680]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Admin Panel
                        </button>
                      )}

                      <div className="my-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }} />

                      <button
                        onClick={() => { setOpen(false); logout() }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
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
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
