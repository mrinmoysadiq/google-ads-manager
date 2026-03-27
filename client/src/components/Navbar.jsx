import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const location = useLocation()

  const isActive = (path) => location.pathname === path

  return (
    <nav className="bg-[#1b1b1b] border-b sticky top-0 z-50" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Title */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-[#242424] rounded-lg flex items-center justify-center border" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <span className="text-[#575ECF] font-bold text-sm leading-none">IO</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[#c5c1b9] font-semibold text-sm leading-tight tracking-tight">
                Infinix Online
              </span>
              <span className="text-[#8a8680] text-xs leading-tight">
                Ads Manager
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            <Link
              to="/changelog"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/changelog')
                  ? 'text-[#575ECF] bg-[#575ECF]/10'
                  : 'text-[#8a8680] hover:text-[#c5c1b9] hover:bg-white/5'
              }`}
            >
              Change Log
            </Link>
            <Link
              to="/admin"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/admin')
                  ? 'text-[#575ECF] bg-[#575ECF]/10'
                  : 'text-[#8a8680] hover:text-[#c5c1b9] hover:bg-white/5'
              }`}
            >
              Admin
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
