export default function AutoSaveIndicator({ saveStatus }) {
  if (saveStatus === 'idle') return null

  return (
    <div className="flex items-center gap-1.5 text-xs font-medium">
      {saveStatus === 'saving' && (
        <>
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: '#8a8680' }}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span style={{ color: '#8a8680' }}>Saving...</span>
        </>
      )}
      {saveStatus === 'saved' && (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#4ade80' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span style={{ color: '#4ade80' }}>Saved</span>
        </>
      )}
      {saveStatus === 'error' && (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#f87171' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span style={{ color: '#f87171' }}>Save failed</span>
        </>
      )}
    </div>
  )
}
