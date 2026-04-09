import { useNavigate } from 'react-router-dom'

function isGoodAnswer(idx, answer, auditType) {
  if (auditType === 'meta' && idx === 1) return answer === 'no'
  return answer === 'yes'
}

export default function TrackingCompletePage({
  auditState,
  questions,
  auditType,
  auditTitle,
  startPath,
  resetState,
  guardPath = '/tracking',
}) {
  const navigate = useNavigate()

  if (!auditState.specialist) {
    navigate(guardPath, { replace: true })
    return null
  }

  const issueCount = questions.filter((q, i) => {
    const item = auditState.items[i]
    if (!item?.answer || item.answer === 'na') return false
    return !isGoodAnswer(i, item.answer, auditType)
  }).length

  return (
    <div className="min-h-screen bg-[#1b1b1b] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* Check icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.3)' }}>
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-[#c5c1b9] mb-2">{auditTitle} Complete!</h1>
        <p className="text-[#8a8680] text-sm mb-6">Your PDF report has been downloaded.</p>

        {/* Summary */}
        <div className="bg-[#242424] border border-white/8 rounded-xl p-5 mb-4 text-left">
          <div className="space-y-2.5">
            {[
              ['Specialist', auditState.specialist],
              ['Client', auditState.client],
              ['Website', auditState.website || '—'],
              ['Date', auditState.date],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4">
                <span className="text-xs text-[#8a8680] flex-shrink-0">{label}</span>
                <span className="text-sm text-[#c5c1b9] text-right truncate">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Issue count */}
        <div className="mb-6">
          {issueCount === 0 ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl"
              style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
              ✓ All checks passed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl"
              style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
              ⚠ {issueCount} question{issueCount > 1 ? 's' : ''} flagged as issue{issueCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate('/tracking')}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ backgroundColor: '#575ECF', color: '#fff' }}
          >
            Run Another Audit
          </button>
          <button
            onClick={() => { resetState(); navigate(startPath) }}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#8a8680] transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#c5c1b9'}
            onMouseLeave={e => e.currentTarget.style.color = '#8a8680'}
          >
            Run Same Audit Again
          </button>
        </div>
      </div>
    </div>
  )
}
