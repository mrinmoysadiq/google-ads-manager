import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Select from 'react-select'
import toast from 'react-hot-toast'
import { getEntries, createEntry } from '../../utils/learningApi'
import { getISOWeek, getWeekRange, weekLabel, isFridayPassed } from '../../utils/weekUtils'
import BulletTextarea from '../../components/BulletTextarea'

const LS_KEY = 'learning_selected_user'
const MIN_CHARS = 300

const SOURCE_TYPES = [
  'Article',
  'Video/YouTube',
  'Course',
  'Book',
  'Colleague/Mentor',
  'On-the-job experience',
  'Other',
]

const selectStyles = {
  control: (base, { isFocused }) => ({
    ...base,
    backgroundColor: '#2a2a2a',
    borderColor: isFocused ? '#575ECF' : 'rgba(255,255,255,0.1)',
    boxShadow: 'none',
    '&:hover': { borderColor: '#575ECF' },
    minHeight: '44px',
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: '#2a2a2a',
    border: '1px solid rgba(255,255,255,0.12)',
    zIndex: 50,
  }),
  option: (base, { isSelected, isFocused }) => ({
    ...base,
    backgroundColor: isSelected ? '#575ECF' : isFocused ? 'rgba(87,94,207,0.15)' : 'transparent',
    color: '#c5c1b9',
    cursor: 'pointer',
  }),
  singleValue: (base) => ({ ...base, color: '#c5c1b9' }),
  placeholder: (base) => ({ ...base, color: '#8a8680' }),
  input: (base) => ({ ...base, color: '#c5c1b9' }),
  dropdownIndicator: (base) => ({ ...base, color: '#8a8680' }),
  indicatorSeparator: (base) => ({ ...base, backgroundColor: 'rgba(255,255,255,0.1)' }),
}

const inputClass = 'w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#575ECF]'
const labelClass = 'block text-sm font-semibold text-[#c5c1b9] mb-1.5'
const hintClass = 'text-xs text-[#8a8680] mt-1'

function CharCounter({ count, min }) {
  const ok = count >= min
  return (
    <p className={`text-xs mt-1.5 font-medium ${ok ? 'text-[#4ade80]' : 'text-[#8a8680]'}`}>
      {count} / {min} characters {ok ? '✓' : `(${min - count} more needed)`}
    </p>
  )
}

export default function LearningSubmit() {
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState(null)
  const [weekOptions, setWeekOptions] = useState([])
  const [existingCounts, setExistingCounts] = useState({}) // week → entry count
  const [loadingWeeks, setLoadingWeeks] = useState(true)

  const currentWeek = getISOWeek()
  const [form, setForm] = useState({
    week: currentWeek,
    what_learned: '',
    source_type: '',
    source_detail: '',
    how_to_apply: '',
  })
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Load current user from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY))
      if (saved?.id) {
        setCurrentUser(saved)
      } else {
        navigate('/learning')
      }
    } catch {
      navigate('/learning')
    }
  }, [])

  // Build week options + fetch existing entry counts
  useEffect(() => {
    if (!currentUser) return
    const weeks = getWeekRange(currentUser.joined_week, currentWeek).reverse()
    setWeekOptions(weeks)

    getEntries({ user_id: currentUser.id })
      .then(entries => {
        const counts = {}
        entries.forEach(e => {
          counts[e.week] = (counts[e.week] || 0) + 1
        })
        setExistingCounts(counts)
        setLoadingWeeks(false)
      })
      .catch(() => setLoadingWeeks(false))
  }, [currentUser])

  const selectedWeekIsLate = isFridayPassed(form.week)

  const weekSelectOptions = weekOptions.map(w => {
    const count = existingCounts[w] || 0
    const label = weekLabel(w) + (count > 0 ? ` · ${count} entr${count === 1 ? 'y' : 'ies'}` : '')
    return { value: w, label }
  })

  const sourceOptions = SOURCE_TYPES.map(s => ({ value: s, label: s }))

  const handleChange = (field, value) => setForm(p => ({ ...p, [field]: value }))

  const validate = () => {
    if (form.what_learned.trim().length < MIN_CHARS) return false
    if (!form.source_type) return false
    if (!form.how_to_apply.trim()) return false
    return true
  }

  const handleSubmit = async () => {
    setAttempted(true)
    if (!validate()) {
      toast.error('Please complete all required fields')
      return
    }
    setSubmitting(true)
    try {
      await createEntry({
        user_id: currentUser.id,
        week: form.week,
        what_learned: form.what_learned.trim(),
        source_type: form.source_type,
        source_detail: form.source_detail.trim() || null,
        how_to_apply: form.how_to_apply.trim(),
      })
      toast.success('Learning entry submitted!')
      setSubmitted(true)
      // Update local counts
      setExistingCounts(p => ({ ...p, [form.week]: (p[form.week] || 0) + 1 }))
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAnother = () => {
    setForm(p => ({ ...p, what_learned: '', source_type: '', source_detail: '', how_to_apply: '' }))
    setAttempted(false)
    setSubmitted(false)
  }

  if (!currentUser) return null

  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-7 text-sm">
          <Link to="/learning" className="text-[#8a8680] hover:text-[#c5c1b9] transition-colors">Learning</Link>
          <span className="text-[#8a8680]">/</span>
          <span className="text-[#c5c1b9] font-medium">Submit</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#c5c1b9]">Submit Learning Entry</h1>
          <p className="text-[#8a8680] text-sm mt-1">Submitting as <span className="text-[#c5c1b9] font-medium">{currentUser.name}</span></p>
        </div>

        {/* Success State */}
        {submitted ? (
          <div className="rounded-xl p-8 text-center bg-[#242424] border border-white/8">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-xl font-bold text-[#c5c1b9] mb-2">Entry Submitted!</h2>
            <p className="text-[#8a8680] text-sm mb-6">
              Your learning for <strong className="text-[#c5c1b9]">{weekLabel(form.week)}</strong> has been saved.
              {selectedWeekIsLate && ' (marked as late)'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleAnother}
                className="px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: '#575ECF' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#6B72D8'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#575ECF'}
              >
                Submit another for this week
              </button>
              <button
                onClick={() => navigate('/learning')}
                className="px-6 py-2.5 rounded-lg text-sm font-medium text-[#c5c1b9] transition-colors"
                style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#575ECF'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
              >
                Done — Back to Home
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl p-6 bg-[#242424] border border-white/8 space-y-6">

            {/* Late Notice */}
            {selectedWeekIsLate && (
              <div className="flex items-start gap-3 rounded-lg p-3" style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                <span className="text-base mt-0.5">⚠</span>
                <p className="text-sm text-[#fbbf24]">
                  Late submission — this entry will be marked as late (the deadline for this week has passed).
                </p>
              </div>
            )}

            {/* Week */}
            <div>
              <label className={labelClass}>Week *</label>
              {loadingWeeks ? (
                <div className="h-11 rounded-lg bg-[#2a2a2a] animate-pulse" />
              ) : (
                <Select
                  options={weekSelectOptions}
                  value={weekSelectOptions.find(o => o.value === form.week) || null}
                  onChange={opt => opt && handleChange('week', opt.value)}
                  styles={selectStyles}
                  isSearchable={false}
                />
              )}
            </div>

            {/* What did you learn */}
            <div>
              <label className={labelClass}>What did you learn? *</label>
              <BulletTextarea
                rows={6}
                placeholder="Describe what you learned in detail. Include the key concepts, insights, or skills you gained. (minimum 300 characters)"
                value={form.what_learned}
                onChange={e => handleChange('what_learned', e.target.value)}
                className={inputClass + ' resize-none'}
                style={attempted && form.what_learned.trim().length < MIN_CHARS ? { borderColor: '#f87171' } : {}}
              />
              <CharCounter count={form.what_learned.trim().length} min={MIN_CHARS} />
              {attempted && form.what_learned.trim().length < MIN_CHARS && (
                <p className="text-xs text-[#f87171] mt-1">Please write at least {MIN_CHARS} characters.</p>
              )}
            </div>

            {/* Source Type */}
            <div>
              <label className={labelClass}>Source Type *</label>
              <Select
                options={SOURCE_TYPES.map(s => ({ value: s, label: s }))}
                value={form.source_type ? { value: form.source_type, label: form.source_type } : null}
                onChange={opt => handleChange('source_type', opt ? opt.value : '')}
                placeholder="Where did you learn this?"
                styles={{
                  ...selectStyles,
                  control: (base, state) => ({
                    ...selectStyles.control(base, state),
                    ...(attempted && !form.source_type ? { borderColor: '#f87171' } : {}),
                  }),
                }}
              />
              {attempted && !form.source_type && (
                <p className="text-xs text-[#f87171] mt-1">Please select a source type.</p>
              )}
            </div>

            {/* Source Detail */}
            <div>
              <label className={labelClass}>Source Detail <span className="text-[#8a8680] font-normal">(optional)</span></label>
              <input
                type="text"
                placeholder="URL, book title, course name, person's name…"
                value={form.source_detail}
                onChange={e => handleChange('source_detail', e.target.value)}
                className={inputClass}
              />
              <p className={hintClass}>e.g. "https://article.com", "Clean Code by Robert C. Martin", "Sarah from the Dev team"</p>
            </div>

            {/* How to apply */}
            <div>
              <label className={labelClass}>How will you apply this? *</label>
              <BulletTextarea
                rows={4}
                placeholder="Describe specifically how you plan to apply this knowledge in your work…"
                value={form.how_to_apply}
                onChange={e => handleChange('how_to_apply', e.target.value)}
                className={inputClass + ' resize-none'}
                style={attempted && !form.how_to_apply.trim() ? { borderColor: '#f87171' } : {}}
              />
              {attempted && !form.how_to_apply.trim() && (
                <p className="text-xs text-[#f87171] mt-1">This field is required.</p>
              )}
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => navigate('/learning')}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-[#c5c1b9] transition-colors"
                style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#575ECF'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors"
                style={{ backgroundColor: '#575ECF' }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#6B72D8' }}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#575ECF'}
              >
                {submitting ? 'Submitting…' : 'Submit Learning Entry'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
