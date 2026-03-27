import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getSession, getSlideResponses } from '../utils/api'
import { generateSessionPDF } from '../utils/pdfGenerator'

const SECTIONS = [
  'Daily Performance',
  'Search Terms',
  'Assets & Landing Pages',
  'Audience & Targeting',
]

export default function SessionComplete() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pdfStatus, setPdfStatus] = useState('pending') // 'pending' | 'generating' | 'done' | 'error'

  useEffect(() => {
    getSession(sessionId)
      .then(sess => {
        setSession(sess)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [sessionId])

  // Auto-generate PDF once session is loaded
  useEffect(() => {
    if (!session) return
    if (pdfStatus !== 'pending') return

    setPdfStatus('generating')

    getSlideResponses(parseInt(sessionId))
      .then(responses => {
        // Build a map: slideResponsesMap[slideNumber][fieldKey] = fieldValue
        const map = {}
        responses.forEach(r => {
          if (!map[r.slide_number]) map[r.slide_number] = {}
          map[r.slide_number][r.field_key] = r.field_value || ''
        })
        generateSessionPDF(session, map)
        setPdfStatus('done')
      })
      .catch(err => {
        console.error('PDF generation failed:', err)
        setPdfStatus('error')
      })
  }, [session])

  const handleDownloadAgain = () => {
    if (!session) return
    setPdfStatus('generating')
    getSlideResponses(parseInt(sessionId))
      .then(responses => {
        const map = {}
        responses.forEach(r => {
          if (!map[r.slide_number]) map[r.slide_number] = {}
          map[r.slide_number][r.field_key] = r.field_value || ''
        })
        generateSessionPDF(session, map)
        setPdfStatus('done')
      })
      .catch(err => {
        console.error('PDF generation failed:', err)
        setPdfStatus('error')
      })
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    try {
      const [year, month, day] = dateStr.split('-')
      return new Date(year, month - 1, day).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1b1b1b] flex items-center justify-center">
        <svg className="w-10 h-10 animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: '#575ECF' }}>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1b1b1b] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'rgba(74,222,128,0.1)', border: '2px solid rgba(74,222,128,0.3)' }}>
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#4ade80' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-[#c5c1b9]">Session Complete!</h1>
          <p className="text-[#8a8680] mt-2">Your daily Google Ads review has been saved.</p>
        </div>

        {/* PDF Status */}
        <div className="rounded-xl p-4 mb-4 flex items-center gap-3" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
          {pdfStatus === 'generating' && (
            <>
              <svg className="w-5 h-5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24" style={{ color: '#575ECF' }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-[#c5c1b9]">Downloading PDF report...</span>
            </>
          )}
          {pdfStatus === 'done' && (
            <>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#4ade80' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-[#c5c1b9]">PDF Downloaded</span>
              <button
                onClick={handleDownloadAgain}
                className="ml-auto text-xs font-medium transition-colors"
                style={{ color: '#575ECF' }}
                onMouseEnter={e => e.currentTarget.style.color = '#6B72D8'}
                onMouseLeave={e => e.currentTarget.style.color = '#575ECF'}
              >
                Download Again
              </button>
            </>
          )}
          {pdfStatus === 'error' && (
            <>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#f87171' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm" style={{ color: '#f87171' }}>PDF generation failed</span>
              <button
                onClick={handleDownloadAgain}
                className="ml-auto text-xs font-medium transition-colors"
                style={{ color: '#575ECF' }}
                onMouseEnter={e => e.currentTarget.style.color = '#6B72D8'}
                onMouseLeave={e => e.currentTarget.style.color = '#575ECF'}
              >
                Try Again
              </button>
            </>
          )}
          {pdfStatus === 'pending' && (
            <span className="text-sm text-[#8a8680]">Preparing PDF report...</span>
          )}
        </div>

        {/* Summary Card */}
        <div className="rounded-2xl p-8 mb-6" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="text-lg font-semibold text-[#c5c1b9] mb-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            Session Summary
          </h2>

          {session && (
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#8a8680]">Account</span>
                <span className="font-semibold text-[#c5c1b9]">{session.account_name}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#8a8680]">Team Member</span>
                <span className="font-semibold text-[#c5c1b9]">{session.team_member}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#8a8680]">Date</span>
                <span className="font-semibold text-[#c5c1b9]">{formatDate(session.date)}</span>
              </div>
            </div>
          )}

          <div className="pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs font-semibold text-[#8a8680] uppercase tracking-wide mb-3">
              Sections Completed
            </p>
            <div className="space-y-2">
              {SECTIONS.map(section => (
                <div key={section} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(74,222,128,0.1)' }}>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#4ade80' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm text-[#8a8680]">{section}</span>
                  <span className="ml-auto text-xs font-medium" style={{ color: '#4ade80' }}>Complete</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/changelog"
            className="flex-1 py-3 px-6 text-white rounded-xl font-semibold text-sm text-center transition-all"
            style={{ backgroundColor: '#575ECF' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#6B72D8'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#575ECF'}
          >
            View Change Log
          </Link>
          <Link
            to="/"
            className="flex-1 py-3 px-6 rounded-xl font-semibold text-sm text-center transition-all text-[#c5c1b9]"
            style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#575ECF'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
          >
            Start New Session
          </Link>
        </div>
      </div>
    </div>
  )
}
