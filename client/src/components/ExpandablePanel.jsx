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
    <div className={`border rounded-lg overflow-hidden transition-all duration-200 ${
      isOpen ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white'
    }`}>
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        {/* Checkbox-style toggle */}
        <div className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 transition-all ${
          isOpen
            ? 'bg-blue-600 border-blue-600'
            : 'bg-white border-gray-300'
        }`}>
          {isOpen && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className={`font-medium text-sm ${isOpen ? 'text-blue-700' : 'text-gray-700'}`}>
          {title}
        </span>
        <div className="ml-auto">
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
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
        <div ref={contentRef} className="px-4 pb-4 pt-1 border-t border-gray-100">
          {children}
        </div>
      </div>
    </div>
  )
}
