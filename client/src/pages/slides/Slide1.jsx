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

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white'
  const labelClass = 'block text-sm font-semibold text-gray-700 mb-1.5'

  return (
    <div className="space-y-6">
      {/* Slide header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-gray-900">Daily Performance Review</h2>
          <AutoSaveIndicator saveStatus={saveStatus} />
        </div>
        <p className="text-gray-500 text-sm">Enter today's performance metrics and observations.</p>
      </div>

      {/* Last Action Box */}
      <LastActionBox account={session.account_name} section={SECTION_NAME} />

      {/* Performance Metrics */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-5">Performance Metrics</h3>

        <div className="space-y-5">
          {/* Yesterday Spend */}
          <div>
            <label className={labelClass}>Spend Yesterday (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
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
                <label className="block text-xs text-gray-500 mb-1">Conversions</label>
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
                <label className="block text-xs text-gray-500 mb-1">Cost Per Result (CPR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
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
                <label className="block text-xs text-gray-500 mb-1">Conversions</label>
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
                <label className="block text-xs text-gray-500 mb-1">Cost Per Result (CPR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
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
                <label className="block text-xs text-gray-500 mb-1">Conversions</label>
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
                <label className="block text-xs text-gray-500 mb-1">Cost Per Result (CPR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
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
            <label className={labelClass}>Observations <span className="text-gray-400 font-normal">(optional)</span></label>
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
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-800">Changes Made</h3>
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
              ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
          }`}
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-all shadow-sm hover:shadow-md"
        >
          Save & Continue →
        </button>
      </div>
    </div>
  )
}
