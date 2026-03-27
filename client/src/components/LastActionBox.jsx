import { useEffect, useState } from 'react'
import { getLastAction } from '../utils/api'

export default function LastActionBox({ account, section }) {
  const [lastAction, setLastAction] = useState(undefined) // undefined = loading, null = no data
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!account || !section) return

    setLoading(true)
    getLastAction(account, section)
      .then(data => {
        setLastAction(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch last action:', err)
        setLastAction(null)
        setLoading(false)
      })
  }, [account, section])

  if (loading) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5 animate-pulse">
        <div className="h-4 bg-amber-200 rounded w-48 mb-2"></div>
        <div className="h-3 bg-amber-100 rounded w-full"></div>
      </div>
    )
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    try {
      const [year, month, day] = dateStr.split('-')
      return new Date(year, month - 1, day).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5">
      <div className="flex items-start gap-2">
        <div className="mt-0.5">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-amber-800 font-semibold text-sm mb-1">
            Last Action on This Account — {section}
          </p>
          {lastAction ? (
            <p className="text-amber-700 text-sm leading-relaxed">
              By <strong>{lastAction.team_member}</strong> on {formatDate(lastAction.date)}
              {lastAction.changes_made_note && (
                <>: {lastAction.changes_made_note.substring(0, 200)}{lastAction.changes_made_note.length > 200 ? '…' : ''}</>
              )}
            </p>
          ) : (
            <p className="text-amber-600 text-sm italic">
              No previous actions recorded for this account.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
