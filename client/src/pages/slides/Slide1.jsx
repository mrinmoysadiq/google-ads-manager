import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { saveSlideResponse, saveChangeLog } from '../../utils/api'
import { useDebounce } from '../../hooks/useDebounce'
import AutoSaveIndicator from '../../components/AutoSaveIndicator'
import LastActionBox from '../../components/LastActionBox'

const SLIDE_NUMBER = 1
const SECTION_NAME = 'Spend & Conversions'

export default function Slide1({ session, sessionId, onNext, onBack, isFirstSlide }) {
  const [fields, setFields] = useState({
    spend_yesterday: '',
    conversions_yesterday: '',
    cpr_yesterday: '',
    conversions_7d: '',
    cpr_7d: '',
    conversions_14d: '',
    cpr_14d: '',
    observations: '',
  })
  const [changeNote, setChangeNote] = useState('')
  const [saveStatus, setSaveStatus] = useState('idle')
  const [changeLogSaveStatus, setChangeLogSaveStatus] = useState('idle')

  const debouncedFields = useDebounce(fields, 1000)
  const debouncedChangeNote = useDebounce(changeNote, 1000)

  const resetSaveStatus = (setter) => {
    setTimeout(() => setter('idle'), 2000)
  }

  // Auto-save slide fields
  useEffect(() => {
    const anyFilled = Object.values(debouncedFields).some(v => v !== '')
    if (!anyFilled) return

    setSaveStatus('saving')
    const saves = Object.entries(debouncedFields).map(([key, value]) =>
      saveSlideResponse({
        session_id: sessionId,
        slide_number: SLIDE_NUMBER,
        section_name: SECTION_NAME,
        field_key: key,
        field_value: value,
      }).catch(err => console.error(`Failed to save ${key}:`, err))
    )

    Promise.all(saves)
      .then(() => {
        setSaveStatus('saved')
        resetSaveStatus(setSaveStatus)
      })
      .catch(() => {
        setSaveStatus('error')
        resetSaveStatus(setSaveStatus)
      })
  }, [debouncedFields])

  // Auto-save change log note
  useEffect(() => {
    if (!debouncedChangeNote) return

    setChangeLogSaveStatus('saving')
    saveChangeLog({
      session_id: sessionId,
      team_member: session.team_member,
      account_name: session.account_name,
      date: session.date,
      section: SECTION_NAME,
      change_type: 'performance_note',
      changes_made_note: debouncedChangeNote,
    })
      .then(() => {
        setChangeLogSaveStatus('saved')
        resetSaveStatus(setChangeLogSaveStatus)
      })
      .catch(err => {
        console.error(err)
        setChangeLogSaveStatus('error')
        resetSaveStatus(setChangeLogSaveStatus)
      })
  }, [debouncedChangeNote])

  const handleField = (key, value) => {
    setFields(prev => ({ ...prev, [key]: value }))
  }

  const inputClass = 'w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#575ECF]'
  const labelClass = 'block text-sm font-semibold text-[#8a8680] mb-1.5'

  return (
    <div className="space-y-6">
      {/* Slide header */}
      <div className="rounded-xl p-6" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-[#c5c1b9]">Daily Performance Review</h2>
          <AutoSaveIndicator saveStatus={saveStatus} />
        </div>
        <p className="text-[#8a8680] text-sm">Enter today's performance metrics and observations.</p>
      </div>

      {/* Last Action Box */}
      <LastActionBox account={session.account_name} section={SECTION_NAME} />

      {/* Performance Metrics */}
      <div className="rounded-xl p-6" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="text-base font-semibold text-[#c5c1b9] mb-5">Performance Metrics</h3>

        <div className="space-y-5">
          {/* Yesterday Spend */}
          <div>
            <label className={labelClass}>Spend Yesterday (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8680] text-sm">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={fields.spend_yesterday}
                onChange={e => handleField('spend_yesterday', e.target.value)}
                className={inputClass + ' pl-7'}
              />
            </div>
          </div>

          {/* Yesterday Conversions + CPR */}
          <div>
            <label className={labelClass}>Yesterday</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Conversions</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={fields.conversions_yesterday}
                  onChange={e => handleField('conversions_yesterday', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Cost Per Result (CPR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8680] text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={fields.cpr_yesterday}
                    onChange={e => handleField('cpr_yesterday', e.target.value)}
                    className={inputClass + ' pl-7'}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 7-day */}
          <div>
            <label className={labelClass}>Last 7 Days</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Conversions</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={fields.conversions_7d}
                  onChange={e => handleField('conversions_7d', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Cost Per Result (CPR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8680] text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={fields.cpr_7d}
                    onChange={e => handleField('cpr_7d', e.target.value)}
                    className={inputClass + ' pl-7'}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 14-day */}
          <div>
            <label className={labelClass}>Last 14 Days</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Conversions</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={fields.conversions_14d}
                  onChange={e => handleField('conversions_14d', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Cost Per Result (CPR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8680] text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={fields.cpr_14d}
                    onChange={e => handleField('cpr_14d', e.target.value)}
                    className={inputClass + ' pl-7'}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Observations */}
          <div>
            <label className={labelClass}>Observations <span className="text-[#8a8680] font-normal">(optional)</span></label>
            <textarea
              rows={3}
              placeholder="Note any trends, anomalies, or performance observations..."
              value={fields.observations}
              onChange={e => handleField('observations', e.target.value)}
              className={inputClass + ' resize-none'}
            />
          </div>
        </div>
      </div>

      {/* Changes Made */}
      <div className="rounded-xl p-6" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[#c5c1b9]">Changes Made</h3>
          <AutoSaveIndicator saveStatus={changeLogSaveStatus} />
        </div>
        <div>
          <label className={labelClass}>Notes on changes or actions taken</label>
          <textarea
            rows={4}
            placeholder="Describe any changes made or actions taken based on performance data..."
            value={changeNote}
            onChange={e => setChangeNote(e.target.value)}
            className={inputClass + ' resize-none'}
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-2 pb-6">
        <button
          onClick={onBack}
          disabled={isFirstSlide}
          className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${
            isFirstSlide
              ? 'cursor-not-allowed'
              : ''
          }`}
          style={isFirstSlide
            ? { backgroundColor: '#2a2a2a', color: '#555', border: '1px solid rgba(255,255,255,0.05)' }
            : { backgroundColor: '#2a2a2a', color: '#c5c1b9', border: '1px solid rgba(255,255,255,0.1)' }
          }
          onMouseEnter={e => { if (!isFirstSlide) e.currentTarget.style.borderColor = '#575ECF' }}
          onMouseLeave={e => { if (!isFirstSlide) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
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
