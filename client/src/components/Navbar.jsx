import { Link, useLocation } from 'react-router-dom'
import infinixLogo from '../assets/infinix-logo.svg'

// ── Infinix brand logo (compact navbar version) ───────────────────────────────
function InfinixLogo() {
  return (
    <div className="flex items-center">
      <img src={infinixLogo} alt="Infinix" style={{ height: '36px', width: 'auto' }} />
    </div>
  )
}

export default function Navbar() {
  const location = useLocation()
  const path = location.pathname

  // Context detection
  const isAudit = path === '/audit' ||
    path.startsWith('/checklist') ||
    path.startsWith('/complete') ||
    path === '/changelog' ||
    path === '/admin'

  const isLearning = path.startsWith('/learning')
  const isOutreach = path.startsWith('/outreach')

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

          {/* Context-aware nav links */}
          <div className="flex items-center gap-1">
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

            {/* "Back to modules" pill — shown inside any module */}
            {(isAudit || isLearning || isOutreach) && (
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
          </div>
        </div>
      </div>
    </nav>
  )
}
