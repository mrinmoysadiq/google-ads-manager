import { useState, useEffect } from 'react'
import { saveSlideResponse, saveChangeLog } from '../../utils/api'
import { useDebounce } from '../../hooks/useDebounce'
import AutoSaveIndicator from '../../components/AutoSaveIndicator'
import LastActionBox from '../../components/LastActionBox'
import ExpandablePanel from '../../components/ExpandablePanel'

const SLIDE_NUMBER = 4
const SECTION_NAME = 'Audience & Targeting'

export default function Slide4({ session, sessionId, onNext, onBack, isLastSlide }) {
  const [fields, setFields] = useState({
    reviewed_audiences: '',
    underperforming_audiences: '',
    underperforming_detail: '',
    bid_adjustments: '',
    bid_audience_segments: '',
    bid_percentages: '',
    targeting_changes: '',
    targeting_changes_detail: '',
  })
  const [changeNote, setChangeNote] = useState('')
  const [targetingPanelOpen, setTargetingPanelOpen] = useState(false)
  const [targetingFields, setTargetingFields] = useState({
    audiences_adjusted: '',
    bid_changes: '',
    other_targeting: '',
    targeting_reason: '',
  })

  const [saveStatus, setSaveStatus] = useState('idle')
  const [changeLogStatus, setChangeLogStatus] = useState('idle')
  const [targetingStatus, setTargetingStatus] = useState('idle')

  const debouncedFields = useDebounce(fields, 1000)
  const debouncedChangeNote = useDebounce(changeNote, 1000)
  const debouncedTargetingFields = useDebounce(targetingFields, 1000)

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

  // Auto-save targeting panel
  useEffect(() => {
    if (!targetingPanelOpen) return
    const { audiences_adjusted, bid_changes, other_targeting, targeting_reason } = debouncedTargetingFields
    if (!audiences_adjusted && !bid_changes && !other_targeting && !targeting_reason) return

    setTargetingStatus('saving')
    saveChangeLog({
      session_id: sessionId,
      team_member: session.team_member,
      account_name: session.account_name,
      date: session.date,
      section: SECTION_NAME,
      change_type: 'audience_targeting_change',
      audiences_adjusted,
      bid_changes,
      other_targeting,
      targeting_reason,
    })
      .then(() => { setTargetingStatus('saved'); resetStatus(setTargetingStatus) })
      .catch(err => { console.error(err); setTargetingStatus('error'); resetStatus(setTargetingStatus) })
  }, [debouncedTargetingFields, targetingPanelOpen])

  const setField = (key, value) => setFields(prev => ({ ...prev, [key]: value }))

  const inputClass = 'w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#575ECF]'
  const labelClass = 'block text-sm font-semibold text-[#8a8680] mb-1.5'

  const YesNoToggle = ({ value, onChange }) => (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange('yes')}
        className={`px-5 py-2 rounded-lg text-sm font-medium border transition-all ${
          value === 'yes'
            ? 'bg-[#575ECF] border-[#575ECF] text-white'
            : 'bg-[#2a2a2a] border-white/10 text-[#8a8680] hover:border-[#575ECF]'
        }`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange('no')}
        className={`px-5 py-2 rounded-lg text-sm font-medium border transition-all ${
          value === 'no'
            ? 'bg-[#575ECF] border-[#575ECF] text-white'
            : 'bg-[#2a2a2a] border-white/10 text-[#8a8680] hover:border-[#575ECF]'
        }`}
      >
        No
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl p-6" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-[#c5c1b9]">Audience & Targeting Review</h2>
          <AutoSaveIndicator saveStatus={saveStatus} />
        </div>
        <p className="text-[#8a8680] text-sm">Review audience performance and assess targeting adjustments.</p>
      </div>

      {/* Last Action */}
      <LastActionBox account={session.account_name} section={SECTION_NAME} />

      {/* Audience Fields */}
      <div className="rounded-xl p-6 space-y-6" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="text-base font-semibold text-[#c5c1b9]">Audience & Targeting Review</h3>

        {/* Reviewed Audiences */}
        <div>
          <label className={labelClass}>Did you review audience performance today?</label>
          <YesNoToggle
            value={fields.reviewed_audiences}
            onChange={val => setField('reviewed_audiences', val)}
          />
        </div>

        {/* Underperforming Audiences */}
        <div>
          <label className={labelClass}>Are there underperforming audiences?</label>
          <YesNoToggle
            value={fields.underperforming_audiences}
            onChange={val => setField('underperforming_audiences', val)}
          />
          {fields.underperforming_audiences === 'yes' && (
            <div className="mt-3">
              <textarea
                rows={3}
                placeholder="Describe which audiences are underperforming and why..."
                value={fields.underperforming_detail}
                onChange={e => setField('underperforming_detail', e.target.value)}
                className={inputClass + ' resize-none'}
              />
            </div>
          )}
        </div>

        {/* Bid Adjustments */}
        <div>
          <label className={labelClass}>Did you make bid adjustments today?</label>
          <YesNoToggle
            value={fields.bid_adjustments}
            onChange={val => setField('bid_adjustments', val)}
          />
          {fields.bid_adjustments === 'yes' && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Audience Segments Adjusted</label>
                <textarea
                  rows={2}
                  placeholder="Which audience segments had bid adjustments?"
                  value={fields.bid_audience_segments}
                  onChange={e => setField('bid_audience_segments', e.target.value)}
                  className={inputClass + ' resize-none'}
                />
              </div>
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Bid Percentages / Changes</label>
                <textarea
                  rows={2}
                  placeholder="e.g., +20% for in-market audiences, -15% for low intent..."
                  value={fields.bid_percentages}
                  onChange={e => setField('bid_percentages', e.target.value)}
                  className={inputClass + ' resize-none'}
                />
              </div>
            </div>
          )}
        </div>

        {/* Targeting Changes */}
        <div>
          <label className={labelClass}>Did you make any other targeting changes?</label>
          <YesNoToggle
            value={fields.targeting_changes}
            onChange={val => setField('targeting_changes', val)}
          />
          {fields.targeting_changes === 'yes' && (
            <div className="mt-3">
              <textarea
                rows={3}
                placeholder="Describe the targeting changes made (location, device, schedule, etc.)..."
                value={fields.targeting_changes_detail}
                onChange={e => setField('targeting_changes_detail', e.target.value)}
                className={inputClass + ' resize-none'}
              />
            </div>
          )}
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
          placeholder="Summarize all targeting and audience changes made today..."
          value={changeNote}
          onChange={e => setChangeNote(e.target.value)}
          className={inputClass + ' resize-none'}
        />
      </div>

      {/* Expandable Panel */}
      <ExpandablePanel
        title="I made targeting or audience changes today"
        isOpen={targetingPanelOpen}
        onToggle={() => setTargetingPanelOpen(v => !v)}
      >
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[#c5c1b9]">Targeting Change Details</span>
            <AutoSaveIndicator saveStatus={targetingStatus} />
          </div>
          <div>
            <label className="block text-xs text-[#8a8680] mb-1">Audiences Adjusted</label>
            <textarea
              rows={2}
              placeholder="List audience segments that were adjusted..."
              value={targetingFields.audiences_adjusted}
              onChange={e => setTargetingFields(prev => ({ ...prev, audiences_adjusted: e.target.value }))}
              className={inputClass + ' resize-none'}
            />
          </div>
          <div>
            <label className="block text-xs text-[#8a8680] mb-1">Bid Changes</label>
            <textarea
              rows={2}
              placeholder="Describe bid changes made..."
              value={targetingFields.bid_changes}
              onChange={e => setTargetingFields(prev => ({ ...prev, bid_changes: e.target.value }))}
              className={inputClass + ' resize-none'}
            />
          </div>
          <div>
            <label className="block text-xs text-[#8a8680] mb-1">Other Targeting Changes</label>
            <textarea
              rows={2}
              placeholder="Any other targeting modifications (location, device, schedule)..."
              value={targetingFields.other_targeting}
              onChange={e => setTargetingFields(prev => ({ ...prev, other_targeting: e.target.value }))}
              className={inputClass + ' resize-none'}
            />
          </div>
          <div>
            <label className="block text-xs text-[#8a8680] mb-1">Reason for Changes</label>
            <textarea
              rows={2}
              placeholder="Explain why these targeting changes were made..."
              value={targetingFields.targeting_reason}
              onChange={e => setTargetingFields(prev => ({ ...prev, targeting_reason: e.target.value }))}
              className={inputClass + ' resize-none'}
            />
          </div>
        </div>
      </ExpandablePanel>

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
          className="px-8 py-2.5 text-white rounded-lg font-semibold text-sm transition-all"
          style={{ backgroundColor: '#575ECF' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#6B72D8'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#575ECF'}
        >
          Complete Session ✓
        </button>
      </div>
    </div>
  )
}
