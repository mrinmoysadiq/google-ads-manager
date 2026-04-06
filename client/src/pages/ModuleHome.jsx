import { Link } from 'react-router-dom'

// ── Infinix brand SVG logo (reused here at large size) ────────────────────────
function InfinixLogoLarge() {
  return (
    <div className="flex items-center gap-4">
      <svg width="64" height="40" viewBox="0 0 64 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M32 20C32 20 25 5 14 5C6.8 5 2 11 2 20C2 29 6.8 35 14 35C25 35 32 20 32 20Z"
          stroke="#96D400" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
        />
        <path
          d="M32 20C32 20 39 5 50 5C57.2 5 62 11 62 20C62 29 57.2 35 50 35C39 35 32 20 32 20Z"
          stroke="#96D400" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
        />
      </svg>
      <span
        className="font-black tracking-[0.18em] text-white select-none"
        style={{ fontSize: '2.4rem', fontFamily: 'Inter, sans-serif', letterSpacing: '0.18em' }}
      >
        INFINIX
      </span>
    </div>
  )
}

// ── Module card ───────────────────────────────────────────────────────────────
function ModuleCard({ href, icon, title, description, accentColor, accentAlpha, tags, cta }) {
  return (
    <Link
      to={href}
      className="group block rounded-2xl p-8 transition-all duration-200 relative overflow-hidden"
      style={{
        backgroundColor: '#242424',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = accentAlpha
        e.currentTarget.style.boxShadow = `0 0 50px ${accentAlpha}, 0 20px 40px rgba(0,0,0,0.3)`
        e.currentTarget.style.transform = 'translateY(-4px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Subtle gradient glow in top corner */}
      <div
        className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${accentAlpha} 0%, transparent 70%)`,
          transform: 'translate(30%, -30%)',
        }}
      />

      {/* Icon */}
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center mb-6"
        style={{ backgroundColor: `${accentColor}18`, border: `1px solid ${accentColor}30` }}
      >
        {icon}
      </div>

      {/* Title */}
      <h2 className="text-xl font-bold text-[#c5c1b9] mb-3 group-hover:text-white transition-colors">
        {title}
      </h2>

      {/* Description */}
      <p className="text-[#8a8680] text-sm leading-relaxed mb-6">
        {description}
      </p>

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {tags.map(tag => (
            <span
              key={tag}
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#8a8680' }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* CTA row */}
      <div className="flex items-center gap-2 text-sm font-semibold transition-colors" style={{ color: accentColor }}>
        <span>{cta}</span>
        <svg
          className="w-4 h-4 transition-transform group-hover:translate-x-1"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ModuleHome() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#1b1b1b] flex flex-col items-center justify-center px-4 py-16">

      {/* Brand hero */}
      <div className="text-center mb-14">
        <div className="flex justify-center mb-5">
          <InfinixLogoLarge />
        </div>
        <p className="text-[#8a8680] text-base tracking-wide">
          Your digital marketing operations platform
        </p>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-3xl">

        {/* Google Ads Audit */}
        <ModuleCard
          href="/audit"
          accentColor="#575ECF"
          accentAlpha="rgba(87,94,207,0.2)"
          title="Google Ads Audit"
          description="Run your daily Google Ads review checklist — performance metrics, search term analysis, ad asset audits, and a full change log."
          tags={['Daily Checklist', 'Change Log', 'Admin']}
          cta="Start Audit"
          icon={
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#575ECF" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />

        {/* Learning Tracker */}
        <ModuleCard
          href="/learning"
          accentColor="#96D400"
          accentAlpha="rgba(150,212,0,0.15)"
          title="Weekly Learning Tracker"
          description="Track what your team learns each week, build submission streaks, and give managers full visibility into team growth."
          tags={['Weekly Submissions', 'Streak Tracking', 'Manager View']}
          cta="Open Tracker"
          icon={
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#96D400" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        />
      </div>

      {/* Footer note */}
      <p className="mt-14 text-xs text-[#8a8680]/50 tracking-wide">
        More modules coming soon
      </p>
    </div>
  )
}
