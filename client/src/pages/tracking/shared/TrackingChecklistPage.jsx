/**
 * Shared checklist page for all three tracking audits.
 * Props:
 *   auditState       — the module-level state object
 *   questions        — array of question definitions
 *   auditType        — 'googleAds' | 'meta' | 'ga4'
 *   totalSlides      — number of slides (3 for all)
 *   completePath     — route to navigate on submit
 *   onGenPdf         — function() called on submit before navigation
 *   guardPath        — route to redirect if state.specialist is empty
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const RESOLUTION_OPTIONS = ['Fixed', 'In Progress', 'Needs Client Action', 'Escalated']

function isGoodAnswer(idx, answer, auditType) {
  // Meta Q2 (index 1): reversed — No is good
  if (auditType === 'meta' && idx === 1) return answer === 'no'
  return answer === 'yes'
}

function isComplete(idx, item, auditType) {
  if (!item.answer) return false
  if (item.answer === 'na') return true

  // Meta Q5 (EMQ score) — score always required
  if (auditType === 'meta' && idx === 4) {
    if (!item.emqScore || !item.emqScore.trim()) return false
  }

  if (isGoodAnswer(idx, item.answer, auditType)) {
    // Yes answer: need verification text OR screenshot
    return !!(item.verifyText.trim() || item.verifyImage)
  }
  // No answer: need issue text OR screenshot (resolution is optional)
  return !!(item.issueText.trim() || item.issueImage)
}

// Read an image file/blob and call callback with the data URL
function readImageFromClipboard(clipboardItems, callback) {
  if (!clipboardItems) return false
  for (const it of clipboardItems) {
    if (it.type.startsWith('image/')) {
      const file = it.getAsFile()
      if (!file) continue
      const reader = new FileReader()
      reader.onload = e => callback(e.target.result)
      reader.readAsDataURL(file)
      return true
    }
  }
  return false
}

/**
 * ScreenshotUpload — handles its own paste events when the label is focused.
 * Paste intercepted here does NOT propagate to the global handler.
 */
function ScreenshotUpload({ label, image, onChange }) {
  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => onChange(e.target.result)
    reader.readAsDataURL(file)
  }

  // Intercept paste events bubbling up from inside this zone (e.g. when label is focused)
  function handleZonePaste(e) {
    const handled = readImageFromClipboard(e.clipboardData?.items, onChange)
    if (handled) {
      e.preventDefault()
      e.stopPropagation() // block global handler from also firing
    }
  }

  return (
    <div className="mt-3" onPaste={handleZonePaste}>
      <p className="text-xs font-medium mb-1.5" style={{ color: '#8a8680' }}>{label}</p>
      {image ? (
        <div className="relative inline-block">
          <img src={image} alt="screenshot" className="max-h-28 rounded-lg border border-white/10 object-contain" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ backgroundColor: '#ef4444' }}
          >✕</button>
        </div>
      ) : (
        <label
          tabIndex={0}
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl cursor-pointer transition-colors outline-none"
          style={{ border: '1.5px dashed rgba(255,255,255,0.12)', padding: '20px', backgroundColor: 'rgba(255,255,255,0.02)' }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
        >
          <span className="text-lg">📎</span>
          <span className="text-xs text-[#8a8680]">Click to upload or drag & drop</span>
          <span className="text-[10px] text-[#8a8680]/60">or press ⌘V / Ctrl+V to paste from clipboard</span>
          <input type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
        </label>
      )}
    </div>
  )
}

function QuestionCard({ idx, question, item, auditType, onChange, isActive, onActivate }) {
  const good = item.answer ? isGoodAnswer(idx, item.answer, auditType) : null
  const complete = isComplete(idx, item, auditType)
  const hasAnswer = !!item.answer

  const yesIsGood = question.yesIsGood !== false
  const yesColor = yesIsGood ? '#22c55e' : '#ef4444'
  const noColor  = yesIsGood ? '#ef4444' : '#22c55e'

  function handleAnswer(ans) {
    onActivate() // track for global paste fallback
    if (ans === item.answer) return
    const updated = { ...item, answer: ans }
    if (ans === 'yes') { updated.issueText = ''; updated.issueImage = null; updated.resolution = '' }
    if (ans === 'no')  { updated.verifyText = ''; updated.verifyImage = null }
    if (ans === 'na')  { updated.verifyText = ''; updated.verifyImage = null; updated.issueText = ''; updated.issueImage = null; updated.resolution = '' }
    onChange(updated)
  }

  // Intercept image pastes in the textarea and route to the correct image slot
  function makeTextareaPasteHandler(imageKey) {
    return function(e) {
      const handled = readImageFromClipboard(
        e.clipboardData?.items,
        (img) => onChange({ ...item, [imageKey]: img })
      )
      if (handled) {
        e.preventDefault()
        e.stopPropagation() // block global handler
      }
      // text paste falls through normally
    }
  }

  const btnBase = 'flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all'
  function btnStyle(color, selected) {
    if (selected) return { backgroundColor: color, borderColor: color, color: '#fff' }
    return { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.12)', color: '#8a8680' }
  }

  return (
    <div
      className="rounded-2xl p-5 cursor-pointer transition-all"
      style={{
        backgroundColor: isActive ? '#2a2a2a' : '#232323',
        border: isActive ? '1.5px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.06)',
      }}
      onClick={onActivate}
    >
      {/* Question */}
      <p className="text-sm font-semibold text-[#c5c1b9] mb-4 leading-snug">{question.question}</p>

      {/* Answer buttons */}
      <div className="flex gap-2 mb-3" onClick={e => e.stopPropagation()}>
        <button className={btnBase} style={btnStyle(yesColor, item.answer === 'yes')} onClick={() => handleAnswer('yes')}>Yes</button>
        <button className={btnBase} style={btnStyle(noColor,  item.answer === 'no')}  onClick={() => handleAnswer('no')}>No</button>
        {question.hasNA && (
          <button
            className={btnBase}
            style={item.answer === 'na'
              ? { backgroundColor: '#6366f1', borderColor: '#6366f1', color: '#fff' }
              : { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.12)', color: '#8a8680' }}
            onClick={() => handleAnswer('na')}
          >N/A</button>
        )}
      </div>
      {/* N/A label shown below buttons when selected */}
      {item.answer === 'na' && question.naLabel && (
        <p className="text-xs mt-1 mb-1" style={{ color: '#6366f1' }}>✓ {question.naLabel}</p>
      )}

      {/* EMQ score — always shown for Meta Q5 once answered */}
      {question.hasEMQScore && (hasAnswer || isActive) && (
        <div className="mb-3" onClick={e => e.stopPropagation()}>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#f59e0b' }}>
            {question.emqScoreLabel}
          </label>
          <input
            className="w-full rounded-lg px-3 py-2 text-sm text-[#c5c1b9] outline-none transition-colors"
            style={{ backgroundColor: '#1b1b1b', border: '1px solid rgba(255,255,255,0.1)' }}
            placeholder={question.emqScorePlaceholder}
            value={item.emqScore || ''}
            onChange={e => onChange({ ...item, emqScore: e.target.value })}
            onFocus={e => e.target.style.borderColor = '#575ECF'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
        </div>
      )}

      {/* Follow-up sections — always visible once answered */}
      {hasAnswer && item.answer !== 'na' && (
        <div onClick={e => e.stopPropagation()}>
          {good ? (
            /* Verification box */
            <div className="rounded-xl p-4 mt-1" style={{ border: '1px solid rgba(34,197,94,0.25)', backgroundColor: 'rgba(34,197,94,0.04)' }}>
              <p className="text-xs font-bold mb-2" style={{ color: '#22c55e' }}>✓ VERIFICATION (text or screenshot required)</p>
              <textarea
                className="w-full rounded-lg px-3 py-2 text-sm text-[#c5c1b9] outline-none resize-none transition-colors"
                style={{ backgroundColor: '#1b1b1b', border: '1px solid rgba(255,255,255,0.08)', minHeight: '72px' }}
                placeholder={question.verifyPrompt}
                value={item.verifyText}
                onChange={e => onChange({ ...item, verifyText: e.target.value })}
                onFocus={e => { onActivate(); e.target.style.borderColor = '#22c55e' }}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                onPaste={makeTextareaPasteHandler('verifyImage')}
              />
              <ScreenshotUpload
                label={question.screenshotLabel}
                image={item.verifyImage}
                onChange={img => onChange({ ...item, verifyImage: img })}
              />
            </div>
          ) : (
            /* Issue box */
            <div className="rounded-xl p-4 mt-1" style={{ border: '1px solid rgba(245,158,11,0.25)', backgroundColor: 'rgba(245,158,11,0.04)' }}>
              <p className="text-xs font-bold mb-2" style={{ color: '#f59e0b' }}>⚠ ISSUE (text or screenshot required)</p>
              <textarea
                className="w-full rounded-lg px-3 py-2 text-sm text-[#c5c1b9] outline-none resize-none transition-colors"
                style={{ backgroundColor: '#1b1b1b', border: '1px solid rgba(255,255,255,0.08)', minHeight: '72px' }}
                placeholder={question.issuePrompt}
                value={item.issueText}
                onChange={e => onChange({ ...item, issueText: e.target.value })}
                onFocus={e => { onActivate(); e.target.style.borderColor = '#f59e0b' }}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                onPaste={makeTextareaPasteHandler('issueImage')}
              />
              <ScreenshotUpload
                label={question.screenshotLabel}
                image={item.issueImage}
                onChange={img => onChange({ ...item, issueImage: img })}
              />
              {/* Resolution dropdown */}
              <div className="mt-3">
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#8a8680' }}>Resolution Status (optional)</label>
                <div className="flex flex-wrap gap-2">
                  {RESOLUTION_OPTIONS.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => onChange({ ...item, resolution: r })}
                      className="text-xs px-3 py-1.5 rounded-lg border transition-all font-medium"
                      style={item.resolution === r
                        ? { backgroundColor: '#f59e0b', borderColor: '#f59e0b', color: '#000' }
                        : { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.12)', color: '#8a8680' }}
                    >{r}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Completion chip */}
      {hasAnswer && (
        <div className="mt-3 flex justify-end">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={complete
              ? { backgroundColor: 'rgba(34,197,94,0.12)', color: '#22c55e' }
              : { backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
            {complete ? '✓ Complete' : '⚠ Incomplete'}
          </span>
        </div>
      )}
    </div>
  )
}

export default function TrackingChecklistPage({
  auditState,
  questions,
  auditType,
  totalSlides,
  completePath,
  onGenPdf,
  guardPath,
}) {
  const navigate = useNavigate()
  const [, forceUpdate] = useState(0)
  const [activeIdx, setActiveIdx] = useState(null)

  const refresh = useCallback(() => forceUpdate(n => n + 1), [])

  // Guard: redirect if session not started
  useEffect(() => {
    if (!auditState.specialist) navigate(guardPath, { replace: true })
  }, []) // eslint-disable-line

  // Global paste listener — FALLBACK ONLY.
  // Per-element paste handlers (textareas, upload zones) call stopPropagation so
  // they never reach here. This only fires when the user presses Ctrl+V/Cmd+V
  // while no specific input element is focused.
  useEffect(() => {
    function handlePaste(e) {
      const clipItems = e.clipboardData?.items
      if (!clipItems) return

      // Only handle images
      let imageItem = null
      for (const it of clipItems) {
        if (it.type.startsWith('image/')) { imageItem = it; break }
      }
      if (!imageItem) return

      const file = imageItem.getAsFile()
      if (!file) return

      // Determine target: activeIdx on current slide, or first answered question
      const slideIdxs = questions.reduce((acc, q, i) => {
        if (q.slide === auditState.currentSlide + 1) acc.push(i)
        return acc
      }, [])

      const targetIdx = (activeIdx !== null && slideIdxs.includes(activeIdx))
        ? activeIdx
        : slideIdxs.find(i => {
            const ans = auditState.items[i]?.answer
            return ans && ans !== 'na'
          }) ?? null

      if (targetIdx === null) return

      const target = auditState.items[targetIdx]
      if (!target?.answer || target.answer === 'na') return

      const reader = new FileReader()
      reader.onload = ev => {
        const good = isGoodAnswer(targetIdx, target.answer, auditType)
        const fresh = auditState.items[targetIdx]
        if (good) auditState.items[targetIdx] = { ...fresh, verifyImage: ev.target.result }
        else      auditState.items[targetIdx] = { ...fresh, issueImage: ev.target.result }
        refresh()
      }
      reader.readAsDataURL(file)
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [activeIdx, auditType, auditState, questions, refresh])

  const slide = auditState.currentSlide
  const slideQuestions = questions.filter(q => q.slide === slide + 1)
  const slideIndices = questions.reduce((acc, q, i) => { if (q.slide === slide + 1) acc.push(i); return acc }, [])

  const slideComplete = slideIndices.every(i => isComplete(i, auditState.items[i], auditType))
  const isLastSlide = slide === totalSlides - 1

  function updateItem(idx, updated) {
    auditState.items[idx] = updated
    refresh()
  }

  function goNext() {
    if (!slideComplete) return
    if (isLastSlide) {
      try { onGenPdf() } catch (e) { console.error('PDF error', e) }
      navigate(completePath)
    } else {
      auditState.currentSlide += 1
      setActiveIdx(null)
      refresh()
    }
  }

  function goPrev() {
    if (slide === 0) return
    auditState.currentSlide -= 1
    setActiveIdx(null)
    refresh()
  }

  const totalAnswered = questions.filter((_, i) => auditState.items[i]?.answer).length
  const progress = Math.round((totalAnswered / questions.length) * 100)
  const slideTitle = slideQuestions[0]?.slideTitle || `Slide ${slide + 1}`

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#161616' }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Progress header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#8a8680]">Slide {slide + 1} of {totalSlides} · {progress}%</span>
            <span className="text-xs text-[#8a8680]">{auditState.client} · {auditState.date}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: '#575ECF' }} />
          </div>
          <h2 className="mt-4 text-xl font-bold text-white">{slideTitle}</h2>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {slideQuestions.map((q, si) => {
            const idx = slideIndices[si]
            return (
              <QuestionCard
                key={idx}
                idx={idx}
                question={q}
                item={auditState.items[idx]}
                auditType={auditType}
                onChange={updated => updateItem(idx, updated)}
                isActive={activeIdx === idx}
                onActivate={() => setActiveIdx(idx)}
              />
            )
          })}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={goPrev}
            disabled={slide === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              backgroundColor: slide === 0 ? 'transparent' : 'rgba(255,255,255,0.06)',
              color: slide === 0 ? 'rgba(255,255,255,0.15)' : '#c5c1b9',
              border: '1px solid ' + (slide === 0 ? 'transparent' : 'rgba(255,255,255,0.1)'),
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Prev
          </button>

          <div className="flex gap-1.5">
            {Array.from({ length: totalSlides }, (_, i) => (
              <span key={i} className="w-2 h-2 rounded-full transition-all" style={{
                backgroundColor: i === slide ? '#575ECF' : i < slide ? '#575ECF60' : 'rgba(255,255,255,0.12)'
              }} />
            ))}
          </div>

          <button
            onClick={goNext}
            disabled={!slideComplete}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              backgroundColor: slideComplete ? '#575ECF' : 'rgba(87,94,207,0.25)',
              color: slideComplete ? '#fff' : 'rgba(255,255,255,0.25)',
              cursor: slideComplete ? 'pointer' : 'not-allowed',
            }}
          >
            {isLastSlide ? '✓ Submit' : 'Next'}
            {!isLastSlide && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
