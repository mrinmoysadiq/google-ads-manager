import { useState, useEffect, useRef } from 'react'
import { useDebounce } from './useDebounce'

export function useAutoSave(saveFunction, data, delay = 1000) {
  const [saveStatus, setSaveStatus] = useState('idle')
  const debouncedData = useDebounce(data, delay)
  const isFirstRender = useRef(true)
  const resetTimer = useRef(null)

  useEffect(() => {
    // Skip the very first render to avoid saving on mount
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    if (debouncedData === undefined || debouncedData === null) return

    let cancelled = false

    const performSave = async () => {
      setSaveStatus('saving')
      if (resetTimer.current) clearTimeout(resetTimer.current)

      try {
        await saveFunction(debouncedData)
        if (!cancelled) {
          setSaveStatus('saved')
          resetTimer.current = setTimeout(() => {
            if (!cancelled) setSaveStatus('idle')
          }, 2000)
        }
      } catch (err) {
        if (!cancelled) {
          setSaveStatus('error')
          resetTimer.current = setTimeout(() => {
            if (!cancelled) setSaveStatus('idle')
          }, 3000)
        }
      }
    }

    performSave()

    return () => {
      cancelled = true
    }
  }, [debouncedData])

  return { saveStatus }
}

export default useAutoSave
