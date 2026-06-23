import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { fbState } from './fbState'

// ─── Question definitions (Q1, Q2, Q4, Q6 from original) ─────────────────────

const QUESTIONS = [
  {
    text: 'Is the ad account active?',
    issueOnNo: true,
    verifyOnYes: true,
    issuePlaceholder: 'Describe why the account is inactive and what steps you took…',
  },
  {
    text: 'Are there any rejected ads?',
    issueOnYes: true,
    verifyOnNo: true,
    issuePlaceholder: 'Which ads were rejected and how did you resolve it?',
  },
  {
    text: 'Are leads syncing from Facebook to GHL correctly?',
    issueOnNo: true,
    verifyOnYes: true,
    issuePlaceholder: 'Describe the sync issue and resolution steps taken…',
  },
  {
    text: 'Are Workflows triggering for new leads?',
    issueOnNo: true,
    verifyOnYes: true,
    issuePlaceholder: 'Which workflows are not triggering and what did you do?',
  },
]

const TOTAL = QUESTIONS.length

function isIssueAnswer(qIdx, answer) {
  const q = QUESTIONS[qIdx]
  if (q.issueOnYes && answer === 'yes') return true
  if (q.issueOnNo && answer === 'no') return true
  return false
}

function isComplete(idx) {
  const it = fbState.items[idx]
  if (!it.answer) return false
  if (it.hasIssue) return !!(it.issueText.trim() || it.issueImage)
  return !!(it.chatText.trim() || it.image)
}

function getButtonStyle(qIdx, side, selectedAnswer) {
  const isSelected = selectedAnswer === side
  if (!isSelected) return { backgroundColor: 'transparent', color: '#8a8680', border: '1px solid rgba(255,255,255,0.1)' }
  const isBad = isIssueAnswer(qIdx, side)
  if (isBad) return { backgroundColor: '#ef4444', color: '#fff', border: 'none' }
  return { backgroundColor: '#22c55e', color: '#fff', border: 'none' }
}

function readFileAsBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.readAsDataURL(file)
  })
}

export default function FbChecklist() {
  const navigate = useNavigate()
  const [, forceUpdate] = useState(0)
  const rerender = useCallback(() => forceUpdate(n => n + 1), [])
  const fileInputRef = useRef(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!fbState.buyer) navigate('/facebook', { replace: true })
  }, [navigate])

  const qi = fbState.currentQuestion
  const q = QUESTIONS[qi]
  const it = fbState.items[qi]

  // Global paste listener
  useEffect(() => {
    const handler = async (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const blob = item.getAsFile()
          const b64 = await readFileAsBase64(blob)
          if (fbState.items[qi].hasIssue) {
            fbState.items[qi].issueImage = b64
          } else {
            fbState.items[qi].image = b64
          }
          rerender()
          break
        }
      }
    }
    document.addEventListener('paste', handler)
    return () => document.removeEventListener('paste', handler)
  }, [qi, rerender])

  const handleAnswer = (ans) => {
    const item = fbState.items[qi]
    if (item.answer === ans) return
    if (ans === 'yes') { fbState.items[qi].issueText = ''; fbState.items[qi].issueImage = null }
    else { fbState.items[qi].chatText = ''; fbState.items[qi].image = null }
    fbState.items[qi].answer = ans
    fbState.items[qi].hasIssue = isIssueAnswer(qi, ans)
    rerender()
  }

  const handleFileAttach = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const b64 = await readFileAsBase64(file)
    if (it.hasIssue) { fbState.items[qi].issueImage = b64 } else { fbState.items[qi].image = b64 }
    rerender()
    e.target.value = ''
  }

  const handlePrev = () => {
    if (qi > 0) { fbState.currentQuestion = qi - 1; rerender() }
  }

  const handleNext = () => {
    if (!isComplete(qi)) { toast.error('Please complete this question before proceeding'); return }
    if (qi < TOTAL - 1) { fbState.currentQuestion = qi + 1; rerender() }
  }

  const handleSubmit = async () => {
    const incomplete = fbState.items.findIndex((_, i) => !isComplete(i))
    if (incomplete !== -1) {
      fbState.currentQuestion = incomplete
      rerender()
      toast.error(`Question ${incomplete + 1} is incomplete`)
      return
    }
    setSubmitting(true)
    try {
      const answers = QUESTIONS.map((q, i) => {
        const it = fbState.items[i]
        return {
          question: q.text,
          answer: it.answer,
          hasIssue: it.hasIssue,
          note: it.hasIssue ? it.issueText : it.chatText,
        }
      })
      const issueCount = answers.filter(a => a.hasIssue).length
      const payload = {
        date: fbState.date,
        media_buyer: fbState.buyer,
        ad_account: fbState.account,
        answers,
        issue_count: issueCount,
      }

      if (fbState.sessionId) {
        await api.patch(`/facebook/audit-sessions/${fbState.sessionId}`, payload)
        toast.success('Audit updated!')
      } else {
        const { data } = await api.post('/facebook/audit-sessions', payload)
        fbState.sessionId = data.id
        toast.success('Audit saved!')
      }
      navigate('/facebook/complete')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save audit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const progress = Math.round(((qi + 1) / TOTAL) * 100)
  const completedCount = fbState.items.filter((_, i) => isComplete(i)).length

  const activeImage = it.hasIssue ? it.issueImage : it.image
  const removeImage = () => {
    if (it.hasIssue) { fbState.items[qi].issueImage = null } else { fbState.items[qi].image = null }
    rerender()
  }

  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-[#8a8680]">Question {qi + 1} of {TOTAL} · {progress}%</span>
            <span className="text-xs text-[#8a8680]">{completedCount}/{TOTAL} complete</span>
          </div>
          <div className="w-full bg-[#2a2a2a] rounded-full h-2">
            <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: '#575ECF' }} />
          </div>
          <div className="mt-3 text-xs text-[#8a8680] flex items-center gap-2">
            <span>{fbState.buyer}</span>
            <span style={{ color: '#444' }}>·</span>
            <span>{fbState.account}</span>
            <span style={{ color: '#444' }}>·</span>
            <span>{fbState.date}</span>
            {fbState.sessionId && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: 'rgba(87,94,207,0.15)', color: '#575ECF' }}>editing</span>
            )}
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-[#242424] border border-white/[0.08] rounded-xl p-6 mb-4">
          <p className="text-lg font-semibold text-[#c5c1b9] mb-6">{q.text}</p>

          {/* Answer buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {['yes', 'no'].map(side => (
              <button key={side} onClick={() => handleAnswer(side)}
                className="py-3 rounded-xl text-sm font-semibold capitalize transition-all"
                style={getButtonStyle(qi, side, it.answer)}
              >{side === 'yes' ? 'Yes' : 'No'}</button>
            ))}
          </div>

          {/* Issue box (bad answer) */}
          {it.answer && it.hasIssue && (
            <div className="rounded-xl border border-[#f59e0b]/30 bg-[#2a2a2a] p-4">
              <p className="text-xs font-semibold text-[#f59e0b] uppercase tracking-wider mb-3">⚠ Issue & Resolution <span className="text-[#ef4444]">*</span></p>
              <textarea
                className="w-full bg-transparent text-[#c5c1b9] text-sm placeholder-[#555] resize-none outline-none min-h-[90px]"
                placeholder={q.issuePlaceholder || 'Describe the issue and resolution…'}
                value={it.issueText}
                onChange={e => { fbState.items[qi].issueText = e.target.value; rerender() }}
              />
              {it.issueImage && (
                <div className="relative inline-block mt-2">
                  <img src={it.issueImage} alt="Issue" className="max-h-28 rounded-lg border border-white/10" />
                  <button onClick={removeImage} className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">✕</button>
                </div>
              )}
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.06]">
                <button onClick={() => fileInputRef.current?.click()} className="text-xs text-[#8a8680] hover:text-[#c5c1b9] transition-colors">📎 Attach</button>
                <span className="text-xs text-[#555]">or ⌘V / Ctrl+V to paste image</span>
              </div>
            </div>
          )}

          {/* Verification box (good answer) */}
          {it.answer && !it.hasIssue && (
            <div className="rounded-xl border border-[#22c55e]/30 bg-[#2a2a2a] p-4">
              <p className="text-xs font-semibold text-[#22c55e] uppercase tracking-wider mb-3">✓ Verification <span className="text-[#ef4444]">*</span></p>
              <textarea
                className="w-full bg-transparent text-[#c5c1b9] text-sm placeholder-[#555] resize-none outline-none min-h-[90px]"
                placeholder="Describe what you verified…"
                value={it.chatText}
                onChange={e => { fbState.items[qi].chatText = e.target.value; rerender() }}
              />
              {it.image && (
                <div className="relative inline-block mt-2">
                  <img src={it.image} alt="Verification" className="max-h-28 rounded-lg border border-white/10" />
                  <button onClick={removeImage} className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">✕</button>
                </div>
              )}
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.06]">
                <button onClick={() => fileInputRef.current?.click()} className="text-xs text-[#8a8680] hover:text-[#c5c1b9] transition-colors">📎 Attach</button>
                <span className="text-xs text-[#555]">or ⌘V / Ctrl+V to paste image</span>
              </div>
            </div>
          )}

          {it.answer && (
            <div className="mt-3">
              {isComplete(qi)
                ? <span className="text-xs font-medium px-2 py-1 rounded-full bg-[#22c55e]/15 text-[#22c55e]">✓ Complete</span>
                : <span className="text-xs font-medium px-2 py-1 rounded-full bg-[#f59e0b]/15 text-[#f59e0b]">⚠ Incomplete</span>
              }
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          {qi > 0 ? (
            <button onClick={handlePrev}
              className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#8a8680', border: '1px solid rgba(255,255,255,0.08)' }}
            >← Prev</button>
          ) : <div />}

          {/* Dots */}
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL }, (_, i) => (
              <button key={i}
                onClick={() => { fbState.currentQuestion = i; rerender() }}
                className="rounded-full transition-all"
                style={{
                  width: i === qi ? '20px' : '8px',
                  height: '8px',
                  backgroundColor: isComplete(i) ? '#22c55e' : i === qi ? '#575ECF' : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>

          {qi < TOTAL - 1 ? (
            <button onClick={handleNext}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: '#575ECF' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#6B72D8'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#575ECF'}
            >Next →</button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#22c55e' }}
              onMouseEnter={e => { if (!submitting) e.currentTarget.style.backgroundColor = '#16a34a' }}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#22c55e'}
            >{submitting ? 'Saving…' : fbState.sessionId ? '✓ Update Audit' : '✓ Submit'}</button>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileAttach} />
      </div>
    </div>
  )
}
