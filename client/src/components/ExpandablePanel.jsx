import { useRef, useEffect, useState } from 'react'

export default function ExpandablePanel({ title, isOpen, onToggle, children }) {
  const contentRef = useRef(null)
  const [contentHeight, setContentHeight] = useState(0)

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight)
    }
  }, [isOpen, children])

  return (
    <div
      className="rounded-lg overflow-hidden transition-all duration-200"
      style={{
        border: `1px solid ${isOpen ? 'rgba(87,94,207,0.3)' : 'rgba(255,255,255,0.08)'}`,
        backgroundColor: '#242424',
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ ':hover': { backgroundColor: 'rgba(255,255,255,0.03)' } }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        {/* Checkbox-style toggle */}
        <div
          className="w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 transition-all"
          style={{
            backgroundColor: isOpen ? '#575ECF' : 'transparent',
            borderColor: isOpen ? '#575ECF' : 'rgba(255,255,255,0.2)',
          }}
        >
          {isOpen && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className="font-medium text-sm" style={{ color: '#c5c1b9' }}>
          {title}
        </span>
        <div className="ml-auto">
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            style={{ color: '#8a8680' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Animated content */}
      <div
        style={{
          maxHeight: isOpen ? `${contentHeight + 200}px` : '0px',
          overflow: 'hidden',
          transition: 'max-height 0.3s ease-in-out',
        }}
      >
        <div ref={contentRef} className="px-4 pb-4 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
