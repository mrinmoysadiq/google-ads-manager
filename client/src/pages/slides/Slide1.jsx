import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { saveSlideResponse, getSlideResponses } from '../../utils/api'
import { useDebounce } from '../../hooks/useDebounce'
import AutoSaveIndicator from '../../components/AutoSaveIndicator'
import LastActionBox from '../../components/LastActionBox'

const SLIDE_NUMBER = 1
const SECTION_NAME = 'Daily Performance'

const MANDATORY_FIELDS = [
  'spend_yesterday',
  'conversions_yesterday',
  'conversion_rate_yesterday',
  'cpr_yesterday',
  'conversions_7d',
  'conversion_rate_7d',
  'cpr_7d',
  'conversions_14d',
  'conversion_rate_14d',
  'cpr_14d',
]

export default function Slide1({ session, sessionId, onNext, onBack, isFirstSlide }) {
  const [fields, setFields] = useState({
    spend_yesterday: '',
    conversions_yesterday: '',
    conversion_rate_yesterday: '',
    cpr_yesterday: '',
    conversions_7d: '',
    conversion_rate_7d: '',
    cpr_7d: '',
    conversions_14d: '',
    conversion_rate_14d: '',
    cpr_14d: '',
    observations: '',
  })
  const [saveStatus, setSaveStatus] = useState('idle')
  const [errors, setErrors] = useState({})

  // Load persistent data on mount
  useEffect(() => {
    if (!sessionId) return
    getSlideResponses(sessionId).then(grouped => {
      const slideData = grouped[SLIDE_NUMBER] || []
      const map = {}
      slideData.forEach(r => { map[r.field_key] = r.field_value || '' })
      setFields(prev => ({
        ...prev,
        spend_yesterday: map.spend_yesterday !== undefined ? map.spend_yesterday : prev.spend_yesterday,
        conversions_yesterday: map.conversions_yesterday !== undefined ? map.conversions_yesterday : prev.conversions_yesterday,
        conversion_rate_yesterday: map.conversion_rate_yesterday !== undefined ? map.conversion_rate_yesterday : prev.conversion_rate_yesterday,
        cpr_yesterday: map.cpr_yesterday !== undefined ? map.cpr_yesterday : prev.cpr_yesterday,
        conversions_7d: map.conversions_7d !== undefined ? map.conversions_7d : prev.conversions_7d,
        conversion_rate_7d: map.conversion_rate_7d !== undefined ? map.conversion_rate_7d : prev.conversion_rate_7d,
        cpr_7d: map.cpr_7d !== undefined ? map.cpr_7d : prev.cpr_7d,
        conversions_14d: map.conversions_14d !== undefined ? map.conversions_14d : prev.conversions_14d,
        conversion_rate_14d: map.conversion_rate_14d !== undefined ? map.conversion_rate_14d : prev.conversion_rate_14d,
        cpr_14d: map.cpr_14d !== undefined ? map.cpr_14d : prev.cpr_14d,
        observations: map.observations !== undefined ? map.observations : prev.observations,
      }))
    }).catch(console.error)
  }, [sessionId])

  const debouncedFields = useDebounce(fields, 1000)

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

  const handleField = (key, value) => {
    setFields(prev => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors(prev => { const e = { ...prev }; delete e[key]; return e })
  }

  const handleNext = () => {
    const newErrors = {}
    MANDATORY_FIELDS.forEach(key => {
      if (fields[key] === '' || fields[key] === null || fields[key] === undefined) {
        newErrors[key] = true
      }
    })
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error('Please fill in all required fields before continuing.')
      return
    }
    setErrors({})
    onNext()
  }

  const inputClass = (key) =>
    `w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors bg-[#2a2a2a] text-[#c5c1b9] focus:border-[#575ECF] border ${
      errors[key] ? 'border-red-500' : 'border-white/10'
    }`

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
            <label className={labelClass}>
              Spend Yesterday (USD) <span className="text-red-400 ml-0.5">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8680] text-sm">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={fields.spend_yesterday}
                onChange={e => handleField('spend_yesterday', e.target.value)}
                className={inputClass('spend_yesterday') + ' pl-7'}
              />
            </div>
            {errors.spend_yesterday && <p className="text-red-400 text-xs mt-1">This field is required.</p>}
          </div>

          {/* Yesterday — 3 columns */}
          <div>
            <label className={labelClass}>
              Yesterday <span className="text-red-400 ml-0.5">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Conversions</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={fields.conversions_yesterday}
                  onChange={e => handleField('conversions_yesterday', e.target.value)}
                  className={inputClass('conversions_yesterday')}
                />
                {errors.conversions_yesterday && <p className="text-red-400 text-xs mt-1">Required</p>}
              </div>
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Conversion Rate (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0.00"
                    value={fields.conversion_rate_yesterday}
                    onChange={e => handleField('conversion_rate_yesterday', e.target.value)}
                    className={inputClass('conversion_rate_yesterday') + ' pr-7'}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8680] text-sm">%</span>
                </div>
                {errors.conversion_rate_yesterday && <p className="text-red-400 text-xs mt-1">Required</p>}
              </div>
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Cost Per Result ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8680] text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={fields.cpr_yesterday}
                    onChange={e => handleField('cpr_yesterday', e.target.value)}
                    className={inputClass('cpr_yesterday') + ' pl-7'}
                  />
                </div>
                {errors.cpr_yesterday && <p className="text-red-400 text-xs mt-1">Required</p>}
              </div>
            </div>
          </div>

          {/* 7-day — 3 columns */}
          <div>
            <label className={labelClass}>
              Last 7 Days <span className="text-red-400 ml-0.5">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Conversions</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={fields.conversions_7d}
                  onChange={e => handleField('conversions_7d', e.target.value)}
                  className={inputClass('conversions_7d')}
                />
                {errors.conversions_7d && <p className="text-red-400 text-xs mt-1">Required</p>}
              </div>
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Conversion Rate (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0.00"
                    value={fields.conversion_rate_7d}
                    onChange={e => handleField('conversion_rate_7d', e.target.value)}
                    className={inputClass('conversion_rate_7d') + ' pr-7'}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8680] text-sm">%</span>
                </div>
                {errors.conversion_rate_7d && <p className="text-red-400 text-xs mt-1">Required</p>}
              </div>
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Cost Per Result ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8680] text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={fields.cpr_7d}
                    onChange={e => handleField('cpr_7d', e.target.value)}
                    className={inputClass('cpr_7d') + ' pl-7'}
                  />
                </div>
                {errors.cpr_7d && <p className="text-red-400 text-xs mt-1">Required</p>}
              </div>
            </div>
          </div>

          {/* 14-day — 3 columns */}
          <div>
            <label className={labelClass}>
              Last 14 Days <span className="text-red-400 ml-0.5">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Conversions</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={fields.conversions_14d}
                  onChange={e => handleField('conversions_14d', e.target.value)}
                  className={inputClass('conversions_14d')}
                />
                {errors.conversions_14d && <p className="text-red-400 text-xs mt-1">Required</p>}
              </div>
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Conversion Rate (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0.00"
                    value={fields.conversion_rate_14d}
                    onChange={e => handleField('conversion_rate_14d', e.target.value)}
                    className={inputClass('conversion_rate_14d') + ' pr-7'}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8680] text-sm">%</span>
                </div>
                {errors.conversion_rate_14d && <p className="text-red-400 text-xs mt-1">Required</p>}
              </div>
              <div>
                <label className="block text-xs text-[#8a8680] mb-1">Cost Per Result ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8680] text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={fields.cpr_14d}
                    onChange={e => handleField('cpr_14d', e.target.value)}
                    className={inputClass('cpr_14d') + ' pl-7'}
                  />
                </div>
                {errors.cpr_14d && <p className="text-red-400 text-xs mt-1">Required</p>}
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
              className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#575ECF] resize-none"
            />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-2 pb-6">
        <button
          onClick={onBack}
          disabled={isFirstSlide}
          className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${
            isFirstSlide ? 'cursor-not-allowed' : ''
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
          onClick={handleNext}
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
