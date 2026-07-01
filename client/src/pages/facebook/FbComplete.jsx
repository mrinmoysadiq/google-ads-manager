import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { fbState, resetFbState } from './fbState'
import { fmtDate } from '../../utils/dates'

const QUESTIONS = [
  'Is the ad account active?',
  'Are there any rejected ads?',
  'Are leads syncing from Facebook to GHL correctly?',
]


export default function FbComplete() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!fbState.buyer) navigate('/facebook', { replace: true })
  }, [navigate])

  const issueCount = fbState.items.filter(it => it.hasIssue).length
  const wasEditing = !!fbState.sessionId

  const handleAnotherAccount = () => {
    // Keep buyer + date, clear account + answers
    const buyer = fbState.buyer
    const date = fbState.date
    resetFbState()
    fbState.buyer = buyer
    fbState.date = date
    navigate('/facebook')
  }

  const handleEditThisAudit = () => {
    // sessionId and all answers stay in fbState — go back to checklist
    fbState.currentQuestion = 0
    navigate('/facebook/checklist')
  }

  const handleNewSession = () => {
    resetFbState()
    navigate('/facebook')
  }

  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Success icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.3)' }}>
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-[#c5c1b9] mb-1 text-center">
            {wasEditing ? 'Audit Updated!' : 'Audit Submitted!'}
          </h1>
          <p className="text-[#8a8680] text-sm mb-6 text-center">Daily checklist saved successfully.</p>

          {/* Summary card */}
          <div className="bg-[#242424] border border-white/[0.08] rounded-xl p-5 mb-6">
            <div className="space-y-2.5 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-[#8a8680]">Media Buyer</span>
                <span className="text-[#c5c1b9] font-medium">{fbState.buyer}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#8a8680]">Date</span>
                <span className="text-[#c5c1b9] font-medium">{fmtDate(fbState.date)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#8a8680]">Ad Account</span>
                <span className="text-[#c5c1b9] font-medium">{fbState.account}</span>
              </div>
              <div className="flex justify-between text-sm items-center pt-2.5 border-t border-white/[0.06]">
                <span className="text-[#8a8680]">Issues flagged</span>
                {issueCount > 0 ? (
                  <span className="text-sm font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                    {issueCount} flagged
                  </span>
                ) : (
                  <span className="text-sm font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                    All clear ✓
                  </span>
                )}
              </div>
            </div>

            {/* Per-question summary */}
            <div className="space-y-1.5 pt-3 border-t border-white/[0.06]">
              {QUESTIONS.map((q, i) => {
                const it = fbState.items[i]
                return (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 flex-shrink-0">
                      {it.hasIssue
                        ? <span style={{ color: '#f59e0b' }}>⚠</span>
                        : <span style={{ color: '#22c55e' }}>✓</span>
                      }
                    </span>
                    <span style={{ color: it.hasIssue ? '#f59e0b' : '#8a8680' }}>{q}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button onClick={handleEditThisAudit}
              className="w-full py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{ backgroundColor: 'rgba(87,94,207,0.12)', color: '#575ECF', border: '1px solid rgba(87,94,207,0.3)' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(87,94,207,0.2)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(87,94,207,0.12)'}
            >
              ✏ Edit This Audit
            </button>

            <button onClick={handleAnotherAccount}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
              style={{ backgroundColor: '#22c55e' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#16a34a'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#22c55e'}
            >
              + Audit Another Account
            </button>

            <div className="grid grid-cols-2 gap-3">
              <Link to="/facebook/audit-log"
                className="py-2.5 rounded-lg text-sm font-medium text-center transition-all"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#c5c1b9', border: '1px solid rgba(255,255,255,0.08)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
              >
                View Audit Log
              </Link>
              <button onClick={handleNewSession}
                className="py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#8a8680', border: '1px solid rgba(255,255,255,0.08)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#c5c1b9' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#8a8680' }}
              >
                New Session
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
