import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import toast from 'react-hot-toast'
import Navbar from '../../components/Navbar'
import { fbState } from './fbState'

// ─── Question definitions ─────────────────────────────────────────────────────

const QUESTIONS = [
  {
    text: 'Is the ad account active?',
    issueOnNo: true,
    verifyOnYes: true,
    issuePlaceholder: 'Describe why the account is inactive and what steps you took…',
  },
  {
    text: 'Are there any rejected ads?',
    issueOnNo: false,   // issue on YES for Q2
    issueOnYes: true,
    verifyOnNo: true,
    issuePlaceholder: 'Which ads were rejected and how did you resolve it?',
  },
  {
    text: 'Did the account hit its daily budget yesterday?',
    spendOnly: true,
  },
  {
    text: 'Are leads syncing from Facebook to GHL correctly?',
    issueOnNo: true,
    verifyOnYes: true,
    issuePlaceholder: 'Describe the sync issue and resolution steps taken…',
  },
  {
    text: 'Are the Lead Connector app permissions still active?',
    issueOnNo: true,
    verifyOnYes: true,
    issuePlaceholder: 'Describe the permission issue and how you resolved it…',
  },
  {
    text: 'Are Workflows triggering for new leads?',
    issueOnNo: true,
    verifyOnYes: true,
    issuePlaceholder: 'Which workflows are not triggering and what did you do?',
  },
  {
    text: 'Are the new leads populating in the pipelines?',
    issueOnNo: true,
    verifyOnYes: true,
    issuePlaceholder: 'Describe the pipeline issue and resolution…',
  },
]

// For each question: is this answer an "issue" (bad)?
function isIssueAnswer(qIdx, answer) {
  const q = QUESTIONS[qIdx]
  if (q.spendOnly) return false
  if (q.issueOnYes && answer === 'yes') return true
  if (q.issueOnNo && answer === 'no') return true
  return false
}

function isComplete(idx) {
  const it = fbState.items[idx]
  if (!it.answer) return false
  if (idx === 2) return it.spendAmount.trim() !== ''
  if (it.hasIssue) return !!(it.issueText.trim() || it.issueImage)
  return !!(it.chatText.trim() || it.image)
}

// ─── Answer button colors ─────────────────────────────────────────────────────

function getButtonStyle(qIdx, side, selectedAnswer) {
  // side: 'yes' | 'no'
  const isSelected = selectedAnswer === side

  if (!isSelected) {
    return {
      backgroundColor: 'transparent',
      color: '#8a8680',
      border: '1px solid rgba(255,255,255,0.1)',
    }
  }

  if (qIdx === 2) {
    // Q3: neutral selected
    return { backgroundColor: '#575ECF', color: '#fff', border: 'none' }
  }

  // Determine if this answer is "good" or "bad"
  const isBad = isIssueAnswer(qIdx, side)
  if (isBad) {
    return { backgroundColor: '#ef4444', color: '#fff', border: 'none' }
  } else {
    return { backgroundColor: '#22c55e', color: '#fff', border: 'none' }
  }
}

// ─── Image paste / upload utilities ──────────────────────────────────────────

function readFileAsBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.readAsDataURL(file)
  })
}

// ─── PDF generation ───────────────────────────────────────────────────────────

async function generatePDF() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 15

  const fmtDate = (d) => {
    if (!d) return ''
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  // Header
  const drawHeader = () => {
    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, pageW, 28, 'F')
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text('Infinix Online Ltd.', margin, 11)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('Facebook & Meta Ads Daily Checklist Report', margin, 18)
    doc.setDrawColor(200, 200, 200)
    doc.line(0, 28, pageW, 28)
  }

  // Footer
  const drawFooter = (pageNum, totalPages) => {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150, 150, 150)
    doc.text(`Infinix Online Ltd. · Confidential · ${fmtDate(fbState.date)}`, margin, pageH - 8)
    doc.text(`Page ${pageNum} of ${totalPages}`, pageW - margin, pageH - 8, { align: 'right' })
  }

  drawHeader()

  // Meta block
  let y = 36
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text(`Media Buyer: ${fbState.buyer}`, margin, y); y += 6
  doc.text(`Date: ${fmtDate(fbState.date)}`, margin, y); y += 6
  doc.text(`Ad Account: ${fbState.account}`, margin, y); y += 10

  doc.setDrawColor(220, 220, 220)
  doc.line(margin, y, pageW - margin, y); y += 8

  // Per-question sections
  for (let i = 0; i < 7; i++) {
    const q = QUESTIONS[i]
    const it = fbState.items[i]

    // Check page space
    if (y > pageH - 50) {
      doc.addPage()
      drawHeader()
      y = 36
    }

    // Question header
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text(`Q${i + 1}: ${q.text}`, margin, y); y += 6

    // Answer
    const answerText = it.answer ? it.answer.toUpperCase() : 'NOT ANSWERED'
    const isIssue = isIssueAnswer(i, it.answer)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    if (it.answer === 'yes') doc.setTextColor(34, 150, 50)
    else if (it.answer === 'no') doc.setTextColor(200, 50, 50)
    else doc.setTextColor(150, 100, 0)
    doc.text(`Answer: ${answerText}`, margin + 4, y); y += 5

    // Status badge
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    if (i === 2) {
      doc.setTextColor(60, 60, 60)
      doc.text(`Amount Spent Yesterday: $${it.spendAmount || '0'}`, margin + 4, y); y += 5
    } else if (isIssue) {
      doc.setTextColor(200, 120, 0)
      doc.text('⚠ ISSUE', margin + 4, y); y += 5
      if (it.issueText) {
        doc.setTextColor(60, 60, 60)
        const lines = doc.splitTextToSize(it.issueText, pageW - margin * 2 - 8)
        doc.text(lines, margin + 8, y); y += lines.length * 4.5 + 2
      }
    } else {
      doc.setTextColor(34, 150, 50)
      doc.text('✓ OK', margin + 4, y); y += 5
      if (it.chatText) {
        doc.setTextColor(60, 60, 60)
        const lines = doc.splitTextToSize(it.chatText, pageW - margin * 2 - 8)
        doc.text(lines, margin + 8, y); y += lines.length * 4.5 + 2
      }
    }

    // Images
    const imgSrc = isIssue ? it.issueImage : it.image
    if (imgSrc && imgSrc.startsWith('data:image')) {
      try {
        if (y > pageH - 60) { doc.addPage(); drawHeader(); y = 36 }
        const imgType = imgSrc.includes('data:image/png') ? 'PNG' : 'JPEG'
        const imgW = 80
        const imgH = 45
        doc.addImage(imgSrc, imgType, margin + 4, y, imgW, imgH)
        y += imgH + 4
      } catch (e) {
        // skip image on error
      }
    }

    y += 4
    doc.setDrawColor(230, 230, 230)
    doc.line(margin, y, pageW - margin, y); y += 6
  }

  // Add footers on all pages
  const totalPages = doc.internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    drawFooter(p, totalPages)
  }

  // Filename
  const fmtDateFile = (d) => {
    if (!d) return ''
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }
  const filename = `${fbState.account} ${fmtDateFile(fbState.date)}.pdf`
  doc.save(filename)
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FbChecklist() {
  const navigate = useNavigate()
  const [, forceUpdate] = useState(0)
  const rerender = useCallback(() => forceUpdate(n => n + 1), [])
  const fileInputRef = useRef(null)
  const [submitting, setSubmitting] = useState(false)

  // Guard: redirect if no session
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
          if (it.hasIssue) {
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
  }, [qi, it, rerender])

  const handleAnswer = (ans) => {
    const item = fbState.items[qi]
    if (item.answer === ans) return
    // Clear opposite section
    if (ans === 'yes') {
      fbState.items[qi].issueText = ''
      fbState.items[qi].issueImage = null
    } else {
      fbState.items[qi].chatText = ''
      fbState.items[qi].image = null
    }
    fbState.items[qi].answer = ans
    fbState.items[qi].hasIssue = isIssueAnswer(qi, ans)
    fbState.items[qi].spendAmount = item.spendAmount // preserve
    rerender()
  }

  const handleFileAttach = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const b64 = await readFileAsBase64(file)
    if (it.hasIssue) {
      fbState.items[qi].issueImage = b64
    } else {
      fbState.items[qi].image = b64
    }
    rerender()
    e.target.value = ''
  }

  const handlePrev = () => {
    if (qi > 0) { fbState.currentQuestion = qi - 1; rerender() }
  }

  const handleNext = () => {
    if (!isComplete(qi)) {
      toast.error('Please complete this question before proceeding')
      return
    }
    if (qi < 6) {
      fbState.currentQuestion = qi + 1
      rerender()
    }
  }

  const handleSubmit = async () => {
    // Validate all
    const incomplete = fbState.items.findIndex((_, i) => !isComplete(i))
    if (incomplete !== -1) {
      fbState.currentQuestion = incomplete
      rerender()
      toast.error(`Question ${incomplete + 1} is incomplete`)
      return
    }
    setSubmitting(true)
    try {
      await generatePDF()
      navigate('/facebook/complete')
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate PDF')
    } finally {
      setSubmitting(false)
    }
  }

  const progress = Math.round(((qi + 1) / 7) * 100)
  const completedCount = fbState.items.filter((_, i) => isComplete(i)).length

  // Determine active image slot
  const activeImage = it.hasIssue ? it.issueImage : it.image
  const removeImage = () => {
    if (it.hasIssue) { fbState.items[qi].issueImage = null } else { fbState.items[qi].image = null }
    rerender()
  }

  const isGoodAnswer = it.answer && !it.hasIssue

  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-[#8a8680]">Question {qi + 1} of 7 · {progress}%</span>
            <span className="text-xs text-[#8a8680]">{completedCount}/7 complete</span>
          </div>
          <div className="w-full bg-[#2a2a2a] rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, backgroundColor: '#575ECF' }}
            />
          </div>
          <div className="mt-3 text-xs text-[#8a8680]">
            {fbState.buyer} · {fbState.account} · {fbState.date}
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-[#242424] border border-white/[0.08] rounded-xl p-6 mb-4">

          {/* Question text */}
          <p className="text-lg font-semibold text-[#c5c1b9] mb-6">{q.text}</p>

          {/* Answer buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {['yes', 'no'].map(side => (
              <button
                key={side}
                onClick={() => handleAnswer(side)}
                className="py-3 rounded-xl text-sm font-semibold capitalize transition-all"
                style={getButtonStyle(qi, side, it.answer)}
              >
                {side === 'yes' ? 'Yes' : 'No'}
              </button>
            ))}
          </div>

          {/* Q3: Spend amount only */}
          {q.spendOnly && it.answer && (
            <div className="mt-2">
              <label className="block text-xs font-semibold text-[#f59e0b] uppercase tracking-wider mb-2">
                💰 Amount Spent Yesterday <span className="text-[#ef4444]">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8680] text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg pl-7 pr-4 py-3 text-sm focus:outline-none bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#575ECF] transition-colors"
                  placeholder="0.00"
                  value={it.spendAmount}
                  onChange={e => { fbState.items[qi].spendAmount = e.target.value; rerender() }}
                />
              </div>
            </div>
          )}

          {/* Issue box (bad answer) */}
          {!q.spendOnly && it.answer && it.hasIssue && (
            <div className="rounded-xl border border-[#f59e0b]/30 bg-[#2a2a2a] p-4">
              <p className="text-xs font-semibold text-[#f59e0b] uppercase tracking-wider mb-3">⚠ Issue & Resolution <span className="text-[#ef4444]">*</span></p>
              <textarea
                className="w-full bg-transparent text-[#c5c1b9] text-sm placeholder-[#555] resize-none outline-none min-h-[90px]"
                placeholder={q.issuePlaceholder || 'Describe the issue and resolution…'}
                value={it.issueText}
                onChange={e => { fbState.items[qi].issueText = e.target.value; rerender() }}
              />
              {/* Image */}
              {it.issueImage && (
                <div className="relative inline-block mt-2">
                  <img src={it.issueImage} alt="Issue" className="max-h-28 rounded-lg border border-white/10" />
                  <button onClick={removeImage} className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">✕</button>
                </div>
              )}
              {/* Toolbar */}
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.06]">
                <button onClick={() => fileInputRef.current?.click()} className="text-xs text-[#8a8680] hover:text-[#c5c1b9] transition-colors">📎 Attach</button>
                <span className="text-xs text-[#555]">or ⌘V / Ctrl+V to paste image</span>
              </div>
            </div>
          )}

          {/* Verification box (good answer) */}
          {!q.spendOnly && it.answer && !it.hasIssue && (
            <div className="rounded-xl border border-[#22c55e]/30 bg-[#2a2a2a] p-4">
              <p className="text-xs font-semibold text-[#22c55e] uppercase tracking-wider mb-3">✓ Verification <span className="text-[#ef4444]">*</span></p>
              <textarea
                className="w-full bg-transparent text-[#c5c1b9] text-sm placeholder-[#555] resize-none outline-none min-h-[90px]"
                placeholder="Describe what you verified…"
                value={it.chatText}
                onChange={e => { fbState.items[qi].chatText = e.target.value; rerender() }}
              />
              {/* Image */}
              {it.image && (
                <div className="relative inline-block mt-2">
                  <img src={it.image} alt="Verification" className="max-h-28 rounded-lg border border-white/10" />
                  <button onClick={removeImage} className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">✕</button>
                </div>
              )}
              {/* Toolbar */}
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.06]">
                <button onClick={() => fileInputRef.current?.click()} className="text-xs text-[#8a8680] hover:text-[#c5c1b9] transition-colors">📎 Attach</button>
                <span className="text-xs text-[#555]">or ⌘V / Ctrl+V to paste image</span>
              </div>
            </div>
          )}

          {/* Completion chip */}
          {it.answer && (
            <div className="mt-3">
              {isComplete(qi) ? (
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-[#22c55e]/15 text-[#22c55e]">✓ Complete</span>
              ) : (
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-[#f59e0b]/15 text-[#f59e0b]">⚠ Incomplete</span>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          {qi > 0 ? (
            <button
              onClick={handlePrev}
              className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#8a8680', border: '1px solid rgba(255,255,255,0.08)' }}
            >← Prev</button>
          ) : <div />}

          {/* Question dots */}
          <div className="flex gap-1.5">
            {Array.from({ length: 7 }, (_, i) => (
              <button
                key={i}
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

          {qi < 6 ? (
            <button
              onClick={handleNext}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: '#575ECF' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#6B72D8' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#575ECF' }}
            >Next →</button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#22c55e' }}
              onMouseEnter={e => { if (!submitting) e.currentTarget.style.backgroundColor = '#16a34a' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#22c55e' }}
            >{submitting ? 'Generating PDF…' : '✓ Submit'}</button>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileAttach}
        />
      </div>
    </div>
  )
}
