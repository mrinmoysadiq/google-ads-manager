import { useState, useEffect } from 'react'
import { saveSlideResponse, saveChangeLog, getSlideResponses } from '../../utils/api'
import { useDebounce } from '../../hooks/useDebounce'
import AutoSaveIndicator from '../../components/AutoSaveIndicator'
import LastActionBox from '../../components/LastActionBox'
import ExpandablePanel from '../../components/ExpandablePanel'

const SLIDE_NUMBER = 2
const SECTION_NAME = 'Search Term Analysis'
const MATCH_TYPES = ['Broad', 'Phrase', 'Exact']

export default function Slide2({ session, sessionId, onNext, onBack }) {
  const [pauseOpen, setPauseOpen] = useState(false)
  const [pauseFields, setPauseFields] = useState({ keywords_paused: '', pause_reason: '' })
  const [addOpen, setAddOpen] = useState(false)
  const [addFields, setAddFields] = useState({ keywords_added: '', add_reason: '' })
  const [selectedMatchTypes, setSelectedMatchTypes] = useState([])

  const [saveStatus, setSaveStatus] = useState('idle')
  const [pauseStatus, setPauseStatus] = useState('idle')
  const [addStatus, setAddStatus] = useState('idle')

  const debouncedPauseFields = useDebounce(pauseFields, 1000)
  const debouncedAddFields = useDebounce({ ...addFields, add_match_type: selectedMatchTypes.join(',') }, 1000)
  const debouncedMatchTypes = useDebounce(selectedMatchTypes, 1000)

  const resetStatus = (setter) => setTimeout(() => setter('idle'), 2000)

  // Load persistent data on mount
  useEffect(() => {
    getSlideResponses(sessionId).then(responses => {
      const map = {}
      responses.forEach(r => { map[r.field_key] = r.field_value || '' })
      if (map.keywords_paused) {
        setPauseFields(prev => ({ ...prev, keywords_paused: map.keywords_paused }))
        setPauseOpen(true)
      }
      if (map.pause_reason) {
        setPauseFields(prev => ({ ...prev, pause_reason: map.pause_reason }))
      }
      if (map.keywords_added) {
        setAddFields(prev => ({ ...prev, keywords_added: map.keywords_added }))
        setAddOpen(true)
      }
      if (map.add_reason) {
        setAddFields(prev => ({ ...prev, add_reason: map.add_reason }))
      }
      if (map.add_match_type) {
        const types = map.add_match_type.split(',').filter(Boolean)
        setSelectedMatchTypes(types)
      }
    }).catch(console.error)
  }, [sessionId])

  // Auto-save pause panel fields to slide_responses
  useEffect(() => {
    const { keywords_paused, pause_reason } = debouncedPauseFields
    if (!keywords_paused && !pause_reason) return

    setSaveStatus('saving')
    Promise.all([
      saveSlideResponse({ session_id: sessionId, slide_number: SLIDE_NUMBER, section_name: SECTION_NAME, field_key: 'keywords_paused', field_value: keywords_paused }),
      saveSlideResponse({ session_id: sessionId, slide_number: SLIDE_NUMBER, section_name: SECTION_NAME, field_key: 'pause_reason', field_value: pause_reason }),
    ])
      .then(() => { setSaveStatus('saved'); resetStatus(setSaveStatus) })
      .catch(() => { setSaveStatus('error'); resetStatus(setSaveStatus) })
  }, [debouncedPauseFields])

  // Auto-save add panel fields to slide_responses
  useEffect(() => {
    const { keywords_added, add_reason, add_match_type } = debouncedAddFields
    if (!keywords_added && !add_reason && !add_match_type) return

    setSaveStatus('saving')
    Promise.all([
      saveSlideResponse({ session_id: sessionId, slide_number: SLIDE_NUMBER, section_name: SECTION_NAME, field_key: 'keywords_added', field_value: keywords_added }),
      saveSlideResponse({ session_id: sessionId, slide_number: SLIDE_NUMBER, section_name: SECTION_NAME, field_key: 'add_reason', field_value: add_reason }),
      saveSlideResponse({ session_id: sessionId, slide_number: SLIDE_NUMBER, section_name: SECTION_NAME, field_key: 'add_match_type', field_value: add_match_type }),
    ])
      .then(() => { setSaveStatus('saved'); resetStatus(setSaveStatus) })
      .catch(() => { setSaveStatus('error'); resetStatus(setSaveStatus) })
  }, [debouncedAddFields])

  // Auto-save pause panel to change_log
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

  // Auto-save add panel to change_log
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
          <h2 className="text-xl font-bold text-[#c5c1b9]">Search Term Analysis</h2>
          <AutoSaveIndicator saveStatus={saveStatus} />
        </div>
        {/* Instruction block */}
        <div className="mt-3 rounded-lg p-4" style={{ backgroundColor: 'rgba(87,94,207,0.1)', border: '1px solid rgba(87,94,207,0.2)' }}>
          <p className="text-sm text-[#c5c1b9] leading-relaxed">
            Review your search term report for the last 7, 14 and 30 days. Identify irrelevant search terms to add as negatives, and high-intent terms to add as new keywords.
          </p>
        </div>
      </div>

      {/* Last Action */}
      <LastActionBox account={session.account_name} section={SECTION_NAME} />

      {/* Expandable Panels */}
      <div className="space-y-3">
        {/* Panel A — Negative Keywords */}
        <ExpandablePanel
          title="I added negative keywords from search terms today"
          isOpen={pauseOpen}
          onToggle={() => setPauseOpen(v => !v)}
        >
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <label className={labelClass + ' mb-0'}>Negative Keyword Details</label>
              <AutoSaveIndicator saveStatus={pauseStatus} />
            </div>
            <div>
              <label className="block text-xs text-[#8a8680] mb-1">Negative Keywords Added (one per line)</label>
              <textarea
                rows={4}
                placeholder="Enter each negative keyword on a new line..."
                value={pauseFields.keywords_paused}
                onChange={e => setPauseFields(prev => ({ ...prev, keywords_paused: e.target.value }))}
                className={inputClass + ' resize-none'}
              />
            </div>
            <div>
              <label className="block text-xs text-[#8a8680] mb-1">Reason for adding as negative</label>
              <textarea
                rows={2}
                placeholder="Why are these search terms irrelevant or harmful?"
                value={pauseFields.pause_reason}
                onChange={e => setPauseFields(prev => ({ ...prev, pause_reason: e.target.value }))}
                className={inputClass + ' resize-none'}
              />
            </div>
          </div>
        </ExpandablePanel>

        {/* Panel B — New Keywords */}
        <ExpandablePanel
          title="I added new keywords from search terms today"
          isOpen={addOpen}
          onToggle={() => setAddOpen(v => !v)}
        >
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <label className={labelClass + ' mb-0'}>New Keyword Details</label>
              <AutoSaveIndicator saveStatus={addStatus} />
            </div>
            <div>
              <label className="block text-xs text-[#8a8680] mb-1">New Keywords Added (one per line)</label>
              <textarea
                rows={4}
                placeholder="Enter each new keyword on a new line..."
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
              <label className="block text-xs text-[#8a8680] mb-1">Reason for adding</label>
              <textarea
                rows={2}
                placeholder="Why are these high-intent search terms worth adding?"
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
          style={{ border: '1px solid rgba(255,255,255,0.1)' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#575ECF'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
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
