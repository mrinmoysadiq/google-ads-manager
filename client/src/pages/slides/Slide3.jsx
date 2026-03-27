import { useState, useEffect } from 'react'
import { saveSlideResponse, saveChangeLog } from '../../utils/api'
import { useDebounce } from '../../hooks/useDebounce'
import AutoSaveIndicator from '../../components/AutoSaveIndicator'
import LastActionBox from '../../components/LastActionBox'
import ExpandablePanel from '../../components/ExpandablePanel'

const SLIDE_NUMBER = 3
const SECTION_NAME = 'Ad Copy Review'

export default function Slide3({ session, sessionId, onNext, onBack }) {
  const [fields, setFields] = useState({
    active_ads_count: '',
    underperforming_ads: '',
    underperforming_ads_detail: '',
    ad_copy_changes: '',
    top_performing_ad: '',
  })
  const [changeNote, setChangeNote] = useState('')
  const [adPanelOpen, setAdPanelOpen] = useState(false)
  const [adPanelFields, setAdPanelFields] = useState({
    ads_paused: '',
    ads_created: '',
    ad_change_reason: '',
  })

  const [saveStatus, setSaveStatus] = useState('idle')
  const [changeLogStatus, setChangeLogStatus] = useState('idle')
  const [adPanelStatus, setAdPanelStatus] = useState('idle')

  const debouncedFields = useDebounce(fields, 1000)
  const debouncedChangeNote = useDebounce(changeNote, 1000)
  const debouncedAdPanelFields = useDebounce(adPanelFields, 1000)

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

  // Auto-save change log note
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

  // Auto-save ad panel
  useEffect(() => {
    if (!adPanelOpen) return
    const { ads_paused, ads_created, ad_change_reason } = debouncedAdPanelFields
    if (!ads_paused && !ads_created && !ad_change_reason) return

    setAdPanelStatus('saving')
    saveChangeLog({
      session_id: sessionId,
      team_member: session.team_member,
      account_name: session.account_name,
      date: session.date,
      section: SECTION_NAME,
      change_type: 'ad_copy_change',
      ads_paused,
      ads_created,
      ad_change_reason,
    })
      .then(() => { setAdPanelStatus('saved'); resetStatus(setAdPanelStatus) })
      .catch(err => { console.error(err); setAdPanelStatus('error'); resetStatus(setAdPanelStatus) })
  }, [debouncedAdPanelFields, adPanelOpen])

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
          <h2 className="text-xl font-bold text-[#c5c1b9]">Ad Copy & Creative Review</h2>
          <AutoSaveIndicator saveStatus={saveStatus} />
        </div>
        <p className="text-[#8a8680] text-sm">Review active ads, assess performance, and log any creative changes.</p>
      </div>

      {/* Last Action */}
      <LastActionBox account={session.account_name} section={SECTION_NAME} />

      {/* Ad Review Fields */}
      <div className="rounded-xl p-6 space-y-5" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="text-base font-semibold text-[#c5c1b9]">Ad Performance Review</h3>

        {/* Active Ads Count */}
        <div>
          <label className={labelClass}>Number of Active Ads</label>
          <input
            type="number"
            min="0"
            placeholder="0"
            value={fields.active_ads_count}
            onChange={e => setField('active_ads_count', e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Underperforming Ads Toggle */}
        <div>
          <label className={labelClass}>Are there underperforming ads?</label>
          <YesNoToggle
            value={fields.underperforming_ads}
            onChange={val => setField('underperforming_ads', val)}
          />
          {fields.underperforming_ads === 'yes' && (
            <div className="mt-3">
              <textarea
                rows={3}
                placeholder="Describe which ads are underperforming and why..."
                value={fields.underperforming_ads_detail}
                onChange={e => setField('underperforming_ads_detail', e.target.value)}
                className={inputClass + ' resize-none mt-2'}
              />
            </div>
          )}
        </div>

        {/* Ad Copy Changes */}
        <div>
          <label className={labelClass}>Ad Copy Changes Observed</label>
          <textarea
            rows={3}
            placeholder="Note any ad copy improvements or changes needed..."
            value={fields.ad_copy_changes}
            onChange={e => setField('ad_copy_changes', e.target.value)}
            className={inputClass + ' resize-none'}
          />
        </div>

        {/* Top Performing Ad */}
        <div>
          <label className={labelClass}>Top Performing Ad</label>
          <textarea
            rows={3}
            placeholder="Describe the top performing ad and what makes it effective..."
            value={fields.top_performing_ad}
            onChange={e => setField('top_performing_ad', e.target.value)}
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
          placeholder="Describe any changes made to ad copy or creatives..."
          value={changeNote}
          onChange={e => setChangeNote(e.target.value)}
          className={inputClass + ' resize-none'}
        />
      </div>

      {/* Expandable Panel */}
      <ExpandablePanel
        title="I made ad copy changes today"
        isOpen={adPanelOpen}
        onToggle={() => setAdPanelOpen(v => !v)}
      >
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[#c5c1b9]">Ad Change Details</span>
            <AutoSaveIndicator saveStatus={adPanelStatus} />
          </div>
          <div>
            <label className="block text-xs text-[#8a8680] mb-1">Ads Paused</label>
            <textarea
              rows={2}
              placeholder="List ads that were paused..."
              value={adPanelFields.ads_paused}
              onChange={e => setAdPanelFields(prev => ({ ...prev, ads_paused: e.target.value }))}
              className={inputClass + ' resize-none'}
            />
          </div>
          <div>
            <label className="block text-xs text-[#8a8680] mb-1">Ads Created</label>
            <textarea
              rows={2}
              placeholder="Describe new ads created..."
              value={adPanelFields.ads_created}
              onChange={e => setAdPanelFields(prev => ({ ...prev, ads_created: e.target.value }))}
              className={inputClass + ' resize-none'}
            />
          </div>
          <div>
            <label className="block text-xs text-[#8a8680] mb-1">Reason for Changes</label>
            <textarea
              rows={2}
              placeholder="Explain why these ad changes were made..."
              value={adPanelFields.ad_change_reason}
              onChange={e => setAdPanelFields(prev => ({ ...prev, ad_change_reason: e.target.value }))}
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
