import { Link } from 'react-router-dom'
import infinixLogo from '../assets/infinix-logo.svg'
import ModuleCard from '../components/ModuleCard'

// ── Infinix brand logo (large hero version) ───────────────────────────────────
function InfinixLogoLarge() {
  return (
    <div className="flex items-center justify-center">
      <img src={infinixLogo} alt="Infinix" style={{ height: '72px', width: 'auto' }} />
    </div>
  )
}

// ── Utility card (smaller, for Profile / Admin Panel) ──────────────────────────
function UtilCard({ href, icon, title, description, accentColor, accentAlpha }) {
  return (
    <Link
      to={href}
      className="group flex items-center gap-4 rounded-2xl px-6 py-4 transition-all duration-200"
      style={{
        backgroundColor: '#242424',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = accentAlpha
        e.currentTarget.style.boxShadow = `0 0 30px ${accentAlpha}`
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${accentColor}18`, border: `1px solid ${accentColor}30` }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[#c5c1b9] group-hover:text-white transition-colors">{title}</div>
        <div className="text-xs text-[#8a8680] mt-0.5">{description}</div>
      </div>
      <svg className="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke={accentColor} strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-5xl">

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

        {/* Outreach CRM */}
        <ModuleCard
          href="/outreach"
          accentColor="#e05d0a"
          accentAlpha="rgba(224,93,10,0.18)"
          title="Outreach CRM"
          description="Cold email/phone outreach and LinkedIn connection outreach, tracked in one place — pick a pipeline, manage touchpoints, and measure conversion from first contact to closed client."
          tags={['Cold Reach Out', 'LinkedIn Tracker', 'Dashboard']}
          cta="Open CRM"
          icon={
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#e05d0a" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />

        {/* Facebook / Meta Ads Checklist */}
        <ModuleCard
          href="/facebook"
          accentColor="#1877f2"
          accentAlpha="rgba(24,119,242,0.18)"
          title="Facebook / Meta Ads"
          description="Run your daily Meta Ads checklist — verify campaign health, flag issues with screenshots, log spend, and export a branded PDF report."
          tags={['Daily Checklist', 'PDF Export', 'Issue Tracking']}
          cta="Start Checklist"
          icon={
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#1877f2" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        {/* Tracking Audit */}
        <ModuleCard
          href="/tracking"
          accentColor="#65db38"
          accentAlpha="rgba(101,219,56,0.18)"
          title="Tracking Audit"
          description="Audit Google Ads conversion tracking, Meta Pixel & CAPI events, and GA4 data — capture screenshots, log issues, and export a branded PDF report."
          tags={['Google Ads', 'Meta Pixel & CAPI', 'GA4']}
          cta="Start Audit"
          icon={
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#65db38" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          }
        />
      </div>

      {/* Footer note */}
      <p className="mt-10 text-xs text-[#8a8680]/50 tracking-wide">
        More modules coming soon
      </p>
    </div>
  )
}
