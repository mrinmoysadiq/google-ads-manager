import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../utils/api'
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
]

const CHECKLIST_COUNT = QUESTIONS.length   // 4
const TOTAL = CHECKLIST_COUNT + 2          // 6 — +performance, +flagged ads
const PERF_IDX = CHECKLIST_COUNT           // 4
const FLAGS_IDX = CHECKLIST_COUNT + 1      // 5

const ACTIONS = [
  'Paused Ad',
  'Reduced Budget',
  'Changed Creative',
  'Killed Campaign',
  'Moved to Different Ad Set',
  'Other',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function dateRange(sessionDate, days) {
  const to = new Date(sessionDate)
  const from = new Date(sessionDate)
  from.setDate(from.getDate() - (days - 1))
  const fmt = d => d.toISOString().slice(0, 10)
  return { from: fmt(from), to: fmt(to) }
}

function isIssueAnswer(qIdx, answer) {
  const q = QUESTIONS[qIdx]
  if (q.issueOnYes && answer === 'yes') return true
  if (q.issueOnNo && answer === 'no') return true
  return false
}

function isChecklistComplete(idx) {
  const it = fbState.items[idx]
  if (!it.answer) return false
  if (it.hasIssue) return !!(it.issueText.trim() || it.issueImage)
  return !!(it.chatText.trim() || it.image)
}

function isPerfComplete() {
  const { days7, days3 } = fbState.performanceData
  return !!(days7.leads.trim() && days7.cpl.trim() && days3.leads.trim() && days3.cpl.trim())
}

function isFlagsComplete() {
  if (!fbState.flaggedAdsAnswered) return false
  if (fbState.flaggedAdsAnswered === 'no') return !!(fbState.flaggedAdsNoVerification || '').trim()
  // yes — must have at least one fully-filled ad
  return fbState.flaggedAds.length > 0 &&
    fbState.flaggedAds.every(a => a.ad_name.trim() && a.campaign_name.trim() && a.action_taken)
}

function isComplete(idx) {
  if (idx < CHECKLIST_COUNT) return isChecklistComplete(idx)
  if (idx === PERF_IDX) return isPerfComplete()
  if (idx === FLAGS_IDX) return isFlagsComplete()
  return false
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

// ─── Performance Card (index 4) ───────────────────────────────────────────────
function PerformanceCard({ sessionDate, rerender }) {
  const range7 = dateRange(sessionDate, 7)
  const range3 = dateRange(sessionDate, 3)
  const p = fbState.performanceData

  const set7 = (field, val) => { fbState.performanceData.days7[field] = val; rerender() }
  const set3 = (field, val) => { fbState.performanceData.days3[field] = val; rerender() }

  const complete = isPerfComplete()

  return (
    <div className="bg-[#242424] border border-white/[0.08] rounded-xl p-6 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">📊</span>
        <p className="text-lg font-semibold text-[#c5c1b9]">Performance Review</p>
      </div>
      <p className="text-xs text-[#8a8680] mb-6">Enter the actual results from your ad account for the periods below.</p>

      {/* 7-day section */}
      <div className="rounded-xl border border-white/[0.07] bg-[#2a2a2a] p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-[#c5c1b9]">Last 7 Days</p>
          <span className="text-xs text-[#8a8680] bg-[#1b1b1b] rounded-lg px-2.5 py-1">{range7.from} → {range7.to}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#8a8680] uppercase tracking-wider mb-1.5">Total Leads</label>
            <input
              type="number"
              min="0"
              value={p.days7.leads}
              onChange={e => set7('leads', e.target.value)}
              placeholder="e.g. 24"
              className="w-full bg-[#1b1b1b] border border-white/[0.1] rounded-lg px-3 py-2.5 text-[#c5c1b9] text-sm placeholder-[#555] outline-none focus:border-[#575ECF] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8a8680] uppercase tracking-wider mb-1.5">CPL (Cost Per Lead)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={p.days7.cpl}
              onChange={e => set7('cpl', e.target.value)}
              placeholder="e.g. 12.50"
              className="w-full bg-[#1b1b1b] border border-white/[0.1] rounded-lg px-3 py-2.5 text-[#c5c1b9] text-sm placeholder-[#555] outline-none focus:border-[#575ECF] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* 3-day section */}
      <div className="rounded-xl border border-white/[0.07] bg-[#2a2a2a] p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-[#c5c1b9]">Last 3 Days</p>
          <span className="text-xs text-[#8a8680] bg-[#1b1b1b] rounded-lg px-2.5 py-1">{range3.from} → {range3.to}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#8a8680] uppercase tracking-wider mb-1.5">Total Leads</label>
            <input
              type="number"
              min="0"
              value={p.days3.leads}
              onChange={e => set3('leads', e.target.value)}
              placeholder="e.g. 8"
              className="w-full bg-[#1b1b1b] border border-white/[0.1] rounded-lg px-3 py-2.5 text-[#c5c1b9] text-sm placeholder-[#555] outline-none focus:border-[#575ECF] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8a8680] uppercase tracking-wider mb-1.5">CPL (Cost Per Lead)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={p.days3.cpl}
              onChange={e => set3('cpl', e.target.value)}
              placeholder="e.g. 10.00"
              className="w-full bg-[#1b1b1b] border border-white/[0.1] rounded-lg px-3 py-2.5 text-[#c5c1b9] text-sm placeholder-[#555] outline-none focus:border-[#575ECF] transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="mt-3">
        {complete
          ? <span className="text-xs font-medium px-2 py-1 rounded-full bg-[#22c55e]/15 text-[#22c55e]">✓ Complete</span>
          : <span className="text-xs font-medium px-2 py-1 rounded-full bg-[#f59e0b]/15 text-[#f59e0b]">Fill in all 4 fields to continue</span>
        }
      </div>
    </div>
  )
}

// ─── Flagged Ads Card (index 5) ───────────────────────────────────────────────
function mkAd() { return { ad_name: '', campaign_name: '', action_taken: '', notes: '' } }

function FlaggedAdsCard({ rerender }) {
  const answered = fbState.flaggedAdsAnswered
  const ads = fbState.flaggedAds

  function setAnswer(val) {
    fbState.flaggedAdsAnswered = val
    if (val === 'no') { fbState.flaggedAds = []; fbState.flaggedAdsNoVerification = '' }
    if (val === 'yes') { fbState.flaggedAdsNoVerification = ''; if (fbState.flaggedAds.length === 0) fbState.flaggedAds = [mkAd()] }
    rerender()
  }

  function setAdField(idx, field, val) {
    fbState.flaggedAds[idx][field] = val
    rerender()
  }

  function addAd() { fbState.flaggedAds.push(mkAd()); rerender() }
  function removeAd(idx) { fbState.flaggedAds.splice(idx, 1); rerender() }

  const complete = isFlagsComplete()

  return (
    <div className="bg-[#242424] border border-white/[0.08] rounded-xl p-6 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">⚠️</span>
        <p className="text-lg font-semibold text-[#c5c1b9]">Underperforming Ads</p>
      </div>
      <p className="text-sm text-[#8a8680] mb-6">
        Are there any ads with a <strong className="text-[#f59e0b]">CPL of at least 2×</strong> the target and <strong className="text-[#f59e0b]">spending of at least 2×</strong> the target CPL?
      </p>

      {/* Yes / No */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {['yes', 'no'].map(side => (
          <button key={side} onClick={() => setAnswer(side)}
            className="py-3 rounded-xl text-sm font-semibold capitalize transition-all"
            style={{
              backgroundColor: answered === side
                ? (side === 'yes' ? '#ef4444' : '#22c55e')
                : 'transparent',
              color: answered === side ? '#fff' : '#8a8680',
              border: answered === side ? 'none' : '1px solid rgba(255,255,255,0.1)',
            }}
          >{side === 'yes' ? 'Yes — log them' : 'No issues'}</button>
        ))}
      </div>

      {/* Ad entries */}
      {answered === 'yes' && (
        <div>
          {ads.map((ad, idx) => (
            <div key={idx} className="rounded-xl border border-[#ef4444]/20 bg-[#2a2a2a] p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-[#ef4444] uppercase tracking-wider">Ad #{idx + 1}</p>
                {ads.length > 1 && (
                  <button onClick={() => removeAd(idx)} className="text-xs text-[#8a8680] hover:text-[#ef4444] transition-colors">✕ Remove</button>
                )}
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#8a8680] uppercase tracking-wider mb-1.5">Ad Name <span className="text-[#ef4444]">*</span></label>
                    <input
                      value={ad.ad_name}
                      onChange={e => setAdField(idx, 'ad_name', e.target.value)}
                      placeholder="e.g. Summer Sale v2"
                      className="w-full bg-[#1b1b1b] border border-white/[0.1] rounded-lg px-3 py-2.5 text-[#c5c1b9] text-sm placeholder-[#555] outline-none focus:border-[#575ECF] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8a8680] uppercase tracking-wider mb-1.5">Campaign Name <span className="text-[#ef4444]">*</span></label>
                    <input
                      value={ad.campaign_name}
                      onChange={e => setAdField(idx, 'campaign_name', e.target.value)}
                      placeholder="e.g. Retargeting — June"
                      className="w-full bg-[#1b1b1b] border border-white/[0.1] rounded-lg px-3 py-2.5 text-[#c5c1b9] text-sm placeholder-[#555] outline-none focus:border-[#575ECF] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#8a8680] uppercase tracking-wider mb-1.5">Action Taken <span className="text-[#ef4444]">*</span></label>
                  <div className="flex flex-wrap gap-2">
                    {ACTIONS.map(action => (
                      <button key={action} onClick={() => setAdField(idx, 'action_taken', action)}
                        className="text-xs font-medium rounded-lg px-3 py-2 transition-all"
                        style={{
                          background: ad.action_taken === action ? 'rgba(87,94,207,0.25)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${ad.action_taken === action ? '#575ECF' : 'rgba(255,255,255,0.1)'}`,
                          color: ad.action_taken === action ? '#a5aaee' : '#8a8680',
                        }}
                      >{action}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#8a8680] uppercase tracking-wider mb-1.5">Notes</label>
                  <textarea
                    value={ad.notes}
                    onChange={e => setAdField(idx, 'notes', e.target.value)}
                    placeholder="Any additional context — spend amount, time range, what you observed…"
                    rows={2}
                    className="w-full bg-[#1b1b1b] border border-white/[0.1] rounded-lg px-3 py-2.5 text-[#c5c1b9] text-sm placeholder-[#555] outline-none focus:border-[#575ECF] transition-colors resize-none"
                  />
                </div>
              </div>
            </div>
          ))}

          <button onClick={addAd}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px dashed rgba(239,68,68,0.3)', color: '#ef4444' }}
          >+ Log another ad</button>
        </div>
      )}

      {answered === 'no' && (
        <div className="rounded-xl border border-[#22c55e]/30 bg-[#2a2a2a] p-4">
          <p className="text-xs font-semibold text-[#22c55e] uppercase tracking-wider mb-3">✓ Verification <span className="text-[#ef4444]">*</span></p>
          <textarea
            className="w-full bg-transparent text-[#c5c1b9] text-sm placeholder-[#555] resize-none outline-none min-h-[90px]"
            placeholder="Confirm you reviewed all active ads and none exceeded 2× target CPL and 2× target spend…"
            value={fbState.flaggedAdsNoVerification || ''}
            onChange={e => { fbState.flaggedAdsNoVerification = e.target.value; rerender() }}
          />
        </div>
      )}

      <div className="mt-3">
        {complete
          ? <span className="text-xs font-medium px-2 py-1 rounded-full bg-[#22c55e]/15 text-[#22c55e]">✓ Complete</span>
          : <span className="text-xs font-medium px-2 py-1 rounded-full bg-[#f59e0b]/15 text-[#f59e0b]">
              {!answered ? 'Answer Yes or No to continue' : 'Fill in all required fields for each flagged ad'}
            </span>
        }
      </div>
    </div>
  )
}

// ─── Main Checklist Component ─────────────────────────────────────────────────
export default function FbChecklist() {
  const navigate = useNavigate()
  const [, forceUpdate] = useState(0)
  const rerender = useCallback(() => forceUpdate(n => n + 1), [])
  const fileInputRef = useRef(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!fbState.buyer) navigate('/facebook/start', { replace: true })
  }, [navigate])

  const qi = fbState.currentQuestion

  // For checklist items only
  const q = qi < CHECKLIST_COUNT ? QUESTIONS[qi] : null
  const it = qi < CHECKLIST_COUNT ? fbState.items[qi] : null

  // Global paste listener (only active for checklist cards)
  useEffect(() => {
    if (qi >= CHECKLIST_COUNT) return
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
    if (qi >= CHECKLIST_COUNT) return
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
    if (!file || !it) return
    const b64 = await readFileAsBase64(file)
    if (it.hasIssue) { fbState.items[qi].issueImage = b64 } else { fbState.items[qi].image = b64 }
    rerender()
    e.target.value = ''
  }

  const handlePrev = () => {
    if (qi > 0) { fbState.currentQuestion = qi - 1; rerender() }
  }

  const handleNext = () => {
    if (!isComplete(qi)) { toast.error('Please complete this card before proceeding'); return }
    if (qi < TOTAL - 1) { fbState.currentQuestion = qi + 1; rerender() }
  }

  const handleSubmit = async () => {
    // Validate all cards
    for (let i = 0; i < TOTAL; i++) {
      if (!isComplete(i)) {
        fbState.currentQuestion = i
        rerender()
        toast.error(i < CHECKLIST_COUNT ? `Question ${i + 1} is incomplete` : i === PERF_IDX ? 'Fill in the performance metrics' : 'Complete the underperforming ads card')
        return
      }
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

      // Build performance_data with date ranges
      const { days7, days3 } = fbState.performanceData
      const sessionDate = fbState.date
      const range7 = dateRange(sessionDate, 7)
      const range3 = dateRange(sessionDate, 3)
      const performance_data = {
        days7: { leads: days7.leads, cpl: days7.cpl, from: range7.from, to: range7.to },
        days3: { leads: days3.leads, cpl: days3.cpl, from: range3.from, to: range3.to },
      }

      const flagged_ads = fbState.flaggedAdsAnswered === 'yes' ? fbState.flaggedAds : []

      const payload = {
        date: sessionDate,
        media_buyer: fbState.buyer,
        ad_account: fbState.account,
        answers,
        issue_count: issueCount,
        performance_data,
        flagged_ads,
      }

      if (fbState.sessionId) {
        await api.patch(`/facebook/audit-sessions/${fbState.sessionId}`, payload)
        toast.success('Audit updated!')
      } else {
        const { data } = await api.post('/facebook/audit-sessions', payload)
        fbState.sessionId = data.id
        if (flagged_ads.length) toast.success(`Audit saved — ${flagged_ads.length} ad${flagged_ads.length > 1 ? 's' : ''} auto-logged to change log`)
        else toast.success('Audit saved!')
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
  const completedCount = Array.from({ length: TOTAL }, (_, i) => i).filter(isComplete).length

  const activeImage = it ? (it.hasIssue ? it.issueImage : it.image) : null
  const removeImage = () => {
    if (!it) return
    if (it.hasIssue) { fbState.items[qi].issueImage = null } else { fbState.items[qi].image = null }
    rerender()
  }

  // Label for current card
  const cardLabel = qi < CHECKLIST_COUNT
    ? `Question ${qi + 1} of ${TOTAL}`
    : qi === PERF_IDX
      ? `Card 5 of ${TOTAL} — Performance`
      : `Card 6 of ${TOTAL} — Underperforming Ads`

  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-[#8a8680]">{cardLabel} · {progress}%</span>
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

        {/* Card content */}
        {qi === PERF_IDX ? (
          <PerformanceCard sessionDate={fbState.date} rerender={rerender} />
        ) : qi === FLAGS_IDX ? (
          <FlaggedAdsCard rerender={rerender} />
        ) : (
          /* Standard checklist card */
          <div className="bg-[#242424] border border-white/[0.08] rounded-xl p-6 mb-4">
            <p className="text-lg font-semibold text-[#c5c1b9] mb-4">{q.text}</p>

            {qi === 2 && (
              <a href="https://developers.facebook.com/tools/lead-ads-testing" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mb-5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{ background: 'rgba(24,119,242,0.12)', border: '1px solid rgba(24,119,242,0.3)', color: '#4a9ef8', textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(24,119,242,0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(24,119,242,0.12)'}
              >
                <span>🧪</span>
                Test Lead Ads &amp; CRM Sync
                <span style={{ fontSize: 11, opacity: 0.6 }}>↗</span>
              </a>
            )}

            <div className="grid grid-cols-2 gap-3 mb-6">
              {['yes', 'no'].map(side => (
                <button key={side} onClick={() => handleAnswer(side)}
                  className="py-3 rounded-xl text-sm font-semibold capitalize transition-all"
                  style={getButtonStyle(qi, side, it.answer)}
                >{side === 'yes' ? 'Yes' : 'No'}</button>
              ))}
            </div>

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
        )}

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
