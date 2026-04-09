import { useNavigate } from 'react-router-dom'

const AUDITS = [
  {
    path: '/tracking/google-ads',
    title: 'Google Ads Tracking Audit',
    description: 'Verify conversion actions, GTM tags, call tracking, and form submission tracking.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-8 h-8">
        <path d="M24 4L44 40H4L24 4Z" fill="#4285F4" opacity="0.15" stroke="#4285F4" strokeWidth="2"/>
        <circle cx="24" cy="30" r="6" fill="#4285F4" opacity="0.8"/>
        <path d="M24 4L8 40" stroke="#34A853" strokeWidth="3" strokeLinecap="round"/>
        <path d="M24 4L40 40" stroke="#EA4335" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    ),
    accent: '#4285F4',
    questions: 5,
    slides: 3,
  },
  {
    path: '/tracking/meta',
    title: 'Meta Pixel & CAPI Audit',
    description: 'Check Pixel health, Events Manager, CAPI firing, and Event Match Quality score.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-8 h-8">
        <rect width="48" height="48" rx="10" fill="#1877f2" opacity="0.15"/>
        <path d="M24 10C16.268 10 10 16.268 10 24C10 31.732 16.268 38 24 38C31.732 38 38 31.732 38 24C38 16.268 31.732 10 24 10Z" fill="#1877f2" opacity="0.6"/>
        <path d="M26 38V27h4l1-5h-5v-2c0-1.4.7-2.7 2.8-2.7H31V13s-1.9-.3-3.7-.3c-3.8 0-6.3 2.3-6.3 6.4V22h-4v5h4v11" fill="white"/>
      </svg>
    ),
    accent: '#1877f2',
    questions: 5,
    slides: 3,
  },
  {
    path: '/tracking/ga4',
    title: 'GA4 Audit',
    description: 'Review real-time data, key events, and conversion configuration in Google Analytics 4.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-8 h-8">
        <rect width="48" height="48" rx="10" fill="#E37400" opacity="0.15"/>
        <path d="M12 36V24" stroke="#E37400" strokeWidth="4" strokeLinecap="round"/>
        <path d="M24 36V12" stroke="#E37400" strokeWidth="4" strokeLinecap="round"/>
        <path d="M36 36V20" stroke="#E37400" strokeWidth="4" strokeLinecap="round"/>
        <circle cx="12" cy="20" r="3" fill="#E37400" opacity="0.5"/>
        <circle cx="24" cy="8" r="3" fill="#E37400" opacity="0.5"/>
        <circle cx="36" cy="16" r="3" fill="#E37400" opacity="0.5"/>
      </svg>
    ),
    accent: '#E37400',
    questions: 5,
    slides: 3,
  },
]

export default function TrackingHome() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#c5c1b9]">Tracking Audit</h1>
            <p className="text-sm text-[#8a8680] mt-1">Select an audit tool to begin a tracking review</p>
          </div>
          <button
            onClick={() => navigate('/tracking/admin')}
            className="text-xs text-[#8a8680] hover:text-[#c5c1b9] transition-colors px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          >
            Admin Panel →
          </button>
        </div>

        {/* Audit cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {AUDITS.map(audit => (
            <div
              key={audit.path}
              className="bg-[#242424] border border-white/8 rounded-2xl p-6 flex flex-col gap-4 hover:border-white/15 transition-all cursor-pointer group"
              style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.2)' }}
              onClick={() => navigate(audit.path)}
            >
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${audit.accent}12`, border: `1px solid ${audit.accent}30` }}>
                  {audit.icon}
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-[#c5c1b9] mb-2 group-hover:text-white transition-colors">
                  {audit.title}
                </h2>
                <p className="text-xs text-[#8a8680] leading-relaxed">{audit.description}</p>
              </div>
              <div className="flex items-center justify-between mt-1">
                <div className="flex gap-3 text-xs text-[#8a8680]">
                  <span>{audit.questions} questions</span>
                  <span>·</span>
                  <span>{audit.slides} slides</span>
                </div>
                <button
                  className="text-xs font-semibold px-4 py-2 rounded-lg text-white transition-all group-hover:opacity-90"
                  style={{ backgroundColor: audit.accent }}
                >
                  Start Audit →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
