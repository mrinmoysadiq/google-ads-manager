import { useState, useEffect } from 'react'
import { saveSlideResponse, saveChangeLog } from '../../utils/api'
import { useDebounce } from '../../hooks/useDebounce'
import AutoSaveIndicator from '../../components/AutoSaveIndicator'
import LastActionBox from '../../components/LastActionBox'
import ExpandablePanel from '../../components/ExpandablePanel'

const SLIDE_NUMBER = 2
const SECTION_NAME = 'Keyword Analysis'
const MATCH_TYPES = ['Broad', 'Phrase', 'Exact']

export default function Slide2({ session, sessionId, onNext, onBack }) {
  const [fields, setFields] = useState({
    underperforming_keywords: '',
    keyword_analysis: '',
    negative_keywords: '',
  })
  const [changeNote, setChangeNote] = useState('')
  const [pauseOpen, setPauseOpen] = useState(false)
  const [pauseFields, setPauseFields] = useState({ keywords_paused: '', pause_reason: '' })
  const [addOpen, setAddOpen] = useState(false)
  const [addFields, setAddFields] = useState({ keywords_added: '', add_reason: '' })
  const [selectedMatchTypes, setSelectedMatchTypes] = useState([])

  const [saveStatus, setSaveStatus] = useState('idle')
  const [changeLogStatus, setChangeLogStatus] = useState('idle')
  const [pauseStatus, setPauseStatus] = useState('idle')
  const [addStatus, setAddStatus] = useState('idle')

  const debouncedFields = useDebounce(fields, 1000)
  const debouncedChangeNote = useDebounce(changeNote, 1000)
  const debouncedPauseFields = useDebounce(pauseFields, 1000)
  const debouncedAddFields = useDebounce({ ...addFields, add_match_type: selectedMatchTypes.join(',') }, 1000)

  const resetStatus = (setter) => setTimeout(() => setter('idle'), 2000)

  // Auto-save slide fields
  useEffect(() => {
    const anyFilled = Object.values(debouncedFields).some(v => v !== '')
    if (!anyFilled) return

    setSaveStatus('saving')
    Promise.all(
      Object.entries(debouncedFields).map(([key, value]) =>
        saveSlideResponse({
          session_id: sessionId,
          slide_number: SLIDE_NUMBER,
          section_name: SECTION_NAME,
          field_key: key,
          field_value: value,
        }).catch(err => console.error(`Failed to save ${key}:`, err))
      )
    )
      .then(() => { setSaveStatus('saved'); resetStatus(setSaveStatus) })
      .catch(() => { setSaveStatus('error'); resetStatus(setSaveStatus) })
  }, [debouncedFields])

  // Auto-save change note
  useEffect(() => {
    if (!debouncedChangeNote) return
    setChangeLogStatus('saving')
    saveChangeLog({
      session_id: sessionId,
      team_member: session.team_member,
      account_name: session.account_name,
      date: session.date,
      section: SECTION_NAME,
      change_type: 'performance_note',
      changes_made_note: debouncedChangeNote,
    })
      .then(() => { setChangeLogStatus('saved'); resetStatus(setChangeLogStatus) })
      .catch(err => { console.error(err); setChangeLogStatus('error'); resetStatus(setChangeLogStatus) })
  }, [debouncedChangeNote])

  // Auto-save pause panel
  useEffect(() => {
    if (!pauseOpen) return
    const { keywords_paused, pause_reason } = debouncedPauseFields
    if (!keywords_paused && !pause_reason) return

    setPauseStatus('saving')
    saveChangeLog({
      session_id: sessionId,
      team_member: session.team_member,
      account_name: session.account_name,
      date: session.date,
      section: SECTION_NAME,
      change_type: 'keyword_paused',
      keywords_paused,
      pause_reason,
    })
      .then(() => { setPauseStatus('saved'); resetStatus(setPauseStatus) })
      .catch(err => { console.error(err); setPauseStatus('error'); resetStatus(setPauseStatus) })
  }, [debouncedPauseFields, pauseOpen])

  // Auto-save add panel
  useEffect(() => {
    if (!addOpen) return
    const { keywords_added, add_reason, add_match_type } = debouncedAddFields
    if (!keywords_added && !add_reason && !add_match_type) return

    setAddStatus('saving')
    saveChangeLog({
      session_id: sessionId,
      team_member: session.team_member,
      account_name: session.account_name,
      date: session.date,
      section: SECTION_NAME,
      change_type: 'keyword_added',
      keywords_added,
      add_match_type,
      add_reason,
    })
      .then(() => { setAddStatus('saved'); resetStatus(setAddStatus) })
      .catch(err => { console.error(err); setAddStatus('error'); resetStatus(setAddStatus) })
  }, [debouncedAddFields, addOpen])

  const inputClass = 'w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#575ECF]'
  const labelClass = 'block text-sm font-semibold text-[#8a8680] mb-1.5'

  const toggleMatchType = (type) => {
    setSelectedMatchTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl p-6" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-[#c5c1b9]">Keyword Analysis & Management</h2>
          <AutoSaveIndicator saveStatus={saveStatus} />
        </div>
        {/* Instruction block */}
        <div className="mt-3 rounded-lg p-4" style={{ backgroundColor: 'rgba(87,94,207,0.1)', border: '1px solid rgba(87,94,207,0.2)' }}>
          <p className="text-sm text-[#c5c1b9] leading-relaxed">
            <strong>Instructions:</strong> Analyze keyword performance for the last 7, 14, and 30 days. Identify keywords that have spent the most but are generating results at a high cost and low conversion rate. Take action accordingly.
          </p>
        </div>
      </div>

      {/* Last Action */}
      <LastActionBox account={session.account_name} section={SECTION_NAME} />

      {/* Analysis Fields */}
      <div className="rounded-xl p-6 space-y-5" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="text-base font-semibold text-[#c5c1b9]">Keyword Review</h3>

        <div>
          <label className={labelClass}>Underperforming Keywords Identified</label>
          <textarea
            rows={3}
            placeholder="List keywords that are underperforming based on spend and conversion data..."
            value={fields.underperforming_keywords}
            onChange={e => setFields(prev => ({ ...prev, underperforming_keywords: e.target.value }))}
            className={inputClass + ' resize-none'}
          />
        </div>

        <div>
          <label className={labelClass}>Keyword Performance Analysis</label>
          <textarea
            rows={3}
            placeholder="Summarize your analysis of keyword performance trends..."
            value={fields.keyword_analysis}
            onChange={e => setFields(prev => ({ ...prev, keyword_analysis: e.target.value }))}
            className={inputClass + ' resize-none'}
          />
        </div>

        <div>
          <label className={labelClass}>Negative Keywords to Consider</label>
          <textarea
            rows={3}
            placeholder="List potential negative keywords to add..."
            value={fields.negative_keywords}
            onChange={e => setFields(prev => ({ ...prev, negative_keywords: e.target.value }))}
            className={inputClass + ' resize-none'}
          />
        </div>
      </div>

      {/* Changes Made */}
      <div className="rounded-xl p-6" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[#c5c1b9]">Changes Made</h3>
          <AutoSaveIndicator saveStatus={changeLogStatus} />
        </div>
        <textarea
          rows={3}
          placeholder="Describe any changes made based on keyword analysis..."
          value={changeNote}
          onChange={e => setChangeNote(e.target.value)}
          className={inputClass + ' resize-none'}
        />
      </div>

      {/* Expandable Panels */}
      <div className="space-y-3">
        {/* Panel A — Paused Keywords */}
        <ExpandablePanel
          title="I paused keywords today"
          isOpen={pauseOpen}
          onToggle={() => setPauseOpen(v => !v)}
        >
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <label className={labelClass + ' mb-0'}>Paused Keywords Details</label>
              <AutoSaveIndicator saveStatus={pauseStatus} />
            </div>
            <div>
              <label className="block text-xs text-[#8a8680] mb-1">Keywords Paused</label>
              <textarea
                rows={3}
                placeholder="List the keywords you paused (one per line or comma-separated)..."
                value={pauseFields.keywords_paused}
                onChange={e => setPauseFields(prev => ({ ...prev, keywords_paused: e.target.value }))}
                className={inputClass + ' resize-none'}
              />
            </div>
            <div>
              <label className="block text-xs text-[#8a8680] mb-1">Reason for Pausing</label>
              <textarea
                rows={2}
                placeholder="Explain why these keywords were paused..."
                value={pauseFields.pause_reason}
                onChange={e => setPauseFields(prev => ({ ...prev, pause_reason: e.target.value }))}
                className={inputClass + ' resize-none'}
              />
            </div>
          </div>
        </ExpandablePanel>

        {/* Panel B — Added Keywords */}
        <ExpandablePanel
          title="I added new keywords today"
          isOpen={addOpen}
          onToggle={() => setAddOpen(v => !v)}
        >
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <label className={labelClass + ' mb-0'}>New Keywords Details</label>
              <AutoSaveIndicator saveStatus={addStatus} />
            </div>
            <div>
              <label className="block text-xs text-[#8a8680] mb-1">Keywords Added</label>
              <textarea
                rows={3}
                placeholder="List the new keywords you added (one per line or comma-separated)..."
                value={addFields.keywords_added}
                onChange={e => setAddFields(prev => ({ ...prev, keywords_added: e.target.value }))}
                className={inputClass + ' resize-none'}
              />
            </div>
            <div>
              <label className="block text-xs text-[#8a8680] mb-1">Match Type</label>
              <div className="flex gap-2 flex-wrap">
                {MATCH_TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleMatchType(type)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                      selectedMatchTypes.includes(type)
                        ? 'bg-[#575ECF] text-white'
                        : 'bg-[#2a2a2a] text-[#8a8680] border border-white/10 hover:border-[#575ECF]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-[#8a8680] mb-1">Reason for Adding</label>
              <textarea
                rows={2}
                placeholder="Explain why these keywords were added..."
                value={addFields.add_reason}
                onChange={e => setAddFields(prev => ({ ...prev, add_reason: e.target.value }))}
                className={inputClass + ' resize-none'}
              />
            </div>
          </div>
        </ExpandablePanel>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-2 pb-6">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-lg font-medium text-sm transition-all bg-[#2a2a2a] text-[#c5c1b9] border border-white/10 hover:border-[#575ECF]"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="px-8 py-2.5 text-white rounded-lg font-medium text-sm transition-all"
          style={{ backgroundColor: '#575ECF' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#6B72D8'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#575ECF'}
        >
          Save & Continue →
        </button>
      </div>
    </div>
  )
}
