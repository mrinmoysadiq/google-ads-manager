import { Link } from 'react-router-dom'

const CARDS = [
  {
    to: '/facebook/start',
    icon: (
      <svg viewBox="0 0 24 24" fill="white" style={{ width: 28, height: 28 }}>
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    iconBg: '#1877f2',
    accent: '#1877f2',
    accentAlpha: 'rgba(24,119,242,0.18)',
    label: 'Daily Checklist',
    desc: 'Run your daily Meta Ads account review — verify campaign health, sync leads, log issues and flag underperforming ads.',
    tags: ['3 Questions', 'Performance Review', 'Underperforming Ads'],
  },
  {
    to: '/facebook/accounts',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="#a78bfa" strokeWidth={1.8} style={{ width: 28, height: 28 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 4v16M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z" />
      </svg>
    ),
    iconBg: '#7c3aed',
    accent: '#a78bfa',
    accentAlpha: 'rgba(167,139,250,0.18)',
    label: 'Accounts',
    desc: 'Master sheet of all Facebook ad accounts — custom fields, target CPL, performance data, and change history at a glance.',
    tags: ['Custom Fields', 'CPL Tracking', 'Change History'],
  },
  {
    to: '/facebook/audit-log',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="#34d399" strokeWidth={1.8} style={{ width: 28, height: 28 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    iconBg: '#059669',
    accent: '#34d399',
    accentAlpha: 'rgba(52,211,153,0.18)',
    label: 'Audit Log',
    desc: 'Calendar view of all daily checklist sessions — quickly spot missing audits and review issues flagged by any media buyer.',
    tags: ['Calendar View', 'Missing Audits', 'Issue Tracking'],
  },
  {
    to: '/facebook/changelog',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="#fb923c" strokeWidth={1.8} style={{ width: 28, height: 28 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    iconBg: '#c2410c',
    accent: '#fb923c',
    accentAlpha: 'rgba(251,146,60,0.18)',
    label: 'Change Log',
    desc: 'Full history of changes made across all accounts — account, campaign, ad set, and ad level entries with reasons and media buyer.',
    tags: ['All Levels', 'Filtered View', 'Auto-logged Ads'],
  },
]

export default function FbHome() {
  return (
    <div style={{ minHeight: '100vh', background: '#1b1b1b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>

      {/* Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#242424', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '12px 24px', marginBottom: 40 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" fill="white" style={{ width: 22, height: 22 }}>
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </div>
        <span style={{ color: '#c5c1b9', fontWeight: 600, fontSize: 15 }}>Facebook & Meta Ads</span>
      </div>

      {/* Cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, width: '100%', maxWidth: 780 }}>
        {CARDS.map(card => (
          <Link key={card.to} to={card.to}
            style={{ display: 'block', background: '#242424', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 28, textDecoration: 'none', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = card.accentAlpha.replace('0.18', '0.5');
              e.currentTarget.style.boxShadow = `0 0 40px ${card.accentAlpha}, 0 16px 32px rgba(0,0,0,0.3)`;
              e.currentTarget.style.transform = 'translateY(-3px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {/* Glow */}
            <div style={{ position: 'absolute', top: 0, right: 0, width: 160, height: 160, borderRadius: '50%', background: `radial-gradient(circle, ${card.accentAlpha} 0%, transparent 70%)`, transform: 'translate(30%,-30%)', pointerEvents: 'none', opacity: 0, transition: 'opacity 0.3s' }} />

            {/* Icon */}
            <div style={{ width: 52, height: 52, borderRadius: 14, background: `${card.iconBg}22`, border: `1px solid ${card.iconBg}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              {card.icon}
            </div>

            {/* Label */}
            <p style={{ color: '#c5c1b9', fontWeight: 700, fontSize: 18, margin: '0 0 8px' }}>{card.label}</p>

            {/* Description */}
            <p style={{ color: '#8a8680', fontSize: 13, lineHeight: 1.6, margin: '0 0 18px' }}>{card.desc}</p>

            {/* Tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {card.tags.map(t => (
                <span key={t} style={{ background: 'rgba(255,255,255,0.06)', color: '#8a8680', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>{t}</span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
