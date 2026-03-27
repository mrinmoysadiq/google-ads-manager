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
      <div className="rounded-lg p-4 mb-5 animate-pulse" style={{ backgroundColor: '#242424', border: '2px solid rgba(87,94,207,0.15)' }}>
        <div className="h-4 rounded w-48 mb-2" style={{ backgroundColor: 'rgba(87,94,207,0.2)' }}></div>
        <div className="h-3 rounded w-full" style={{ backgroundColor: 'rgba(87,94,207,0.1)' }}></div>
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
    <div className="rounded-lg p-4 mb-5" style={{ backgroundColor: '#242424', border: '2px solid rgba(87,94,207,0.3)' }}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#575ECF' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm mb-1" style={{ color: '#575ECF' }}>
            Last Action on This Account — {section}
          </p>
          {lastAction ? (
            <p className="text-sm leading-relaxed" style={{ color: '#c5c1b9' }}>
              By <strong>{lastAction.team_member}</strong> on {formatDate(lastAction.date)}
              {lastAction.changes_made_note && (
                <>: {lastAction.changes_made_note.substring(0, 200)}{lastAction.changes_made_note.length > 200 ? '…' : ''}</>
              )}
            </p>
          ) : (
            <p className="text-sm italic" style={{ color: '#8a8680' }}>
              No previous actions recorded for this account.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
