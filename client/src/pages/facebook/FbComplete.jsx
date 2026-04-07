import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import { fbState, resetFbState } from './fbState'

function isIssueAnswer(qIdx, answer) {
  const issueOnYes = [1]   // Q2: issue on Yes
  const issueOnNo = [0, 3, 4, 5, 6]  // Q1,Q4–Q7: issue on No
  if (issueOnYes.includes(qIdx) && answer === 'yes') return true
  if (issueOnNo.includes(qIdx) && answer === 'no') return true
  return false
}

export default function FbComplete() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!fbState.buyer) navigate('/facebook', { replace: true })
  }, [navigate])

  const issueCount = fbState.items.filter((it, i) => i !== 2 && isIssueAnswer(i, it.answer)).length

  const fmtDate = (d) => {
    if (!d) return ''
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const handleNewChecklist = () => {
    resetFbState()
    navigate('/facebook')
  }

  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <Navbar />
      <div className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md text-center">
          {/* Check icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.3)' }}>
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-[#c5c1b9] mb-2">Checklist Complete!</h1>
          <p className="text-[#8a8680] text-sm mb-8">Your PDF report has been downloaded.</p>

          {/* Summary card */}
          <div className="bg-[#242424] border border-white/[0.08] rounded-xl p-6 mb-6 text-left">
            <div className="space-y-3">
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
              <div className="pt-3 border-t border-white/[0.06] flex justify-between items-center">
                <span className="text-[#8a8680] text-sm">Issues flagged</span>
                {issueCount > 0 ? (
                  <span className="text-sm font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                    {issueCount}/7 flagged
                  </span>
                ) : (
                  <span className="text-sm font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                    All clear ✓
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleNewChecklist}
              className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: '#575ECF' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#6B72D8' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#575ECF' }}
            >
              Start New Checklist
            </button>
            <Link
              to="/"
              className="w-full py-3 rounded-lg text-sm font-medium text-center transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#8a8680', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
