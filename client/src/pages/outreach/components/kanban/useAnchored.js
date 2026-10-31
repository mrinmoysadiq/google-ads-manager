import { useState, useEffect, useLayoutEffect, useRef } from 'react'

// Places a fixed-position popover next to the element that opened it: below when there's
// room, otherwise above (decided once, so it doesn't flip while scrolling), never off the
// right edge — and re-places it on scroll/resize so it follows its card.
export function useAnchoredPosition(anchor, width, minRoom = 280) {
  const [pos, setPos] = useState({ left: -9999, top: 0, maxHeight: 400 })
  const side = useRef(null)

  useLayoutEffect(() => {
    const margin = 12
    let frame = 0
    const place = () => {
      frame = 0
      if (!anchor?.isConnected) return // card re-rendered away — stay where we are
      const rect = anchor.getBoundingClientRect()
      const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin))
      const below = window.innerHeight - rect.bottom - margin
      const above = rect.top - margin
      if (!side.current) side.current = below >= minRoom || below >= above ? 'below' : 'above'
      if (side.current === 'below') {
        setPos({ left, top: rect.bottom + 6, maxHeight: Math.max(160, below - 6) })
      } else {
        setPos({ left, bottom: window.innerHeight - rect.top + 6, maxHeight: Math.max(160, above - 6) })
      }
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(place) }
    place()
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
  }, [anchor, width, minRoom])

  return pos
}

// Closes on a click outside `ref` (ignoring the buttons that toggle it) or Escape
export function useDismiss(ref, onClose, triggerSelector = '[data-popover-trigger]') {
  useEffect(() => {
    const onDown = e => {
      if (ref.current?.contains(e.target)) return
      if (e.target.closest?.(triggerSelector)) return
      onClose()
    }
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, onClose, triggerSelector])
}
