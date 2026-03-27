export default function StickyHeader({ session }) {
  if (!session) return null

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    try {
      const [year, month, day] = dateStr.split('-')
      return new Date(year, month - 1, day).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5 sticky top-16 z-40">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-blue-500 font-medium">Account:</span>
            <span className="text-blue-900 font-semibold">{session.account_name}</span>
          </div>
          <div className="text-blue-200 hidden sm:block">|</div>
          <div className="flex items-center gap-1.5">
            <span className="text-blue-500 font-medium">Team Member:</span>
            <span className="text-blue-900 font-semibold">{session.team_member}</span>
          </div>
          <div className="text-blue-200 hidden sm:block">|</div>
          <div className="flex items-center gap-1.5">
            <span className="text-blue-500 font-medium">Date:</span>
            <span className="text-blue-900 font-semibold">{formatDate(session.date)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
