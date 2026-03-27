import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getSession } from '../utils/api'

const SECTIONS = [
  'Spend & Conversions',
  'Keyword Analysis',
  'Ad Copy Review',
  'Audience & Targeting',
]

export default function SessionComplete() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

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
      <div className="min-h-screen flex items-center justify-center">
        <svg className="w-10 h-10 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-xl shadow-green-200">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Session Complete!</h1>
          <p className="text-gray-500 mt-2">Your daily Google Ads review has been saved.</p>
        </div>

        {/* Summary Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-100 border border-gray-100 p-8 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-5 pb-4 border-b border-gray-100">
            Session Summary
          </h2>

          {session && (
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Account</span>
                <span className="font-semibold text-gray-900">{session.account_name}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Team Member</span>
                <span className="font-semibold text-gray-900">{session.team_member}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Date</span>
                <span className="font-semibold text-gray-900">{formatDate(session.date)}</span>
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 pt-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Sections Completed
            </p>
            <div className="space-y-2">
              {SECTIONS.map(section => (
                <div key={section} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-700">{section}</span>
                  <span className="ml-auto text-xs text-green-600 font-medium">Complete</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/changelog"
            className="flex-1 py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm text-center transition-all shadow-md shadow-blue-200 hover:shadow-lg"
          >
            View Change Log
          </Link>
          <Link
            to="/"
            className="flex-1 py-3 px-6 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-semibold text-sm text-center transition-all"
          >
            Start New Session
          </Link>
        </div>
      </div>
    </div>
  )
}
