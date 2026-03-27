import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Select from 'react-select'
import toast from 'react-hot-toast'
import { getAccounts, getTeamMembers, createSession } from '../utils/api'

const today = () => {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function SessionStart() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [selectedMember, setSelectedMember] = useState(null)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [date, setDate] = useState(today())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([getAccounts(), getTeamMembers()])
      .then(([accts, members]) => {
        setAccounts(accts.filter(a => a.active).map(a => ({ value: a.name, label: a.name })))
        setTeamMembers(members.filter(m => m.active).map(m => ({ value: m.name, label: m.name })))
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        toast.error('Failed to load data. Is the server running?')
        setLoading(false)
      })
  }, [])

  const canSubmit = selectedMember && selectedAccount && date && !submitting

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    try {
      const session = await createSession({
        team_member: selectedMember.value,
        account_name: selectedAccount.value,
        date,
      })
      toast.success('Session started!')
      navigate(`/checklist/${session.id}`)
    } catch (err) {
      console.error(err)
      toast.error('Failed to create session')
      setSubmitting(false)
    }
  }

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: '#2a2a2a',
      borderColor: state.isFocused ? '#575ECF' : 'rgba(255,255,255,0.12)',
      boxShadow: state.isFocused ? '0 0 0 1px #575ECF' : 'none',
      '&:hover': { borderColor: '#575ECF' },
      borderRadius: '8px',
      minHeight: '42px',
      fontSize: '14px',
      color: '#c5c1b9',
    }),
    menu: (base) => ({ ...base, backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)' }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected ? '#575ECF' : state.isFocused ? '#333' : '#2a2a2a',
      color: '#c5c1b9',
      fontSize: '14px',
    }),
    singleValue: (base) => ({ ...base, color: '#c5c1b9' }),
    placeholder: (base) => ({ ...base, color: '#8a8680' }),
    input: (base) => ({ ...base, color: '#c5c1b9' }),
    multiValue: (base) => ({ ...base, backgroundColor: 'rgba(87,94,207,0.13)' }),
    multiValueLabel: (base) => ({ ...base, color: '#c5c1b9' }),
  }

  return (
    <div className="min-h-screen bg-[#1b1b1b] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#242424] rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="text-[#575ECF] font-bold text-2xl leading-none">IO</span>
          </div>
          <h1 className="text-3xl font-bold text-[#c5c1b9]">Start Your Daily Session</h1>
          <p className="text-[#8a8680] mt-2 text-sm">Complete your daily Google Ads review checklist</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: '#575ECF' }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Your Name */}
              <div>
                <label className="block text-sm font-semibold text-[#8a8680] mb-2">
                  Your Name <span className="text-[#f87171]">*</span>
                </label>
                <Select
                  options={teamMembers}
                  value={selectedMember}
                  onChange={setSelectedMember}
                  placeholder="Select team member..."
                  styles={selectStyles}
                  isSearchable
                  classNamePrefix="react-select"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-semibold text-[#8a8680] mb-2">
                  Date <span className="text-[#f87171]">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors text-[#c5c1b9]"
                  style={{
                    backgroundColor: '#2a2a2a',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                  onFocus={e => e.target.style.borderColor = '#575ECF'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                />
              </div>

              {/* Ad Account */}
              <div>
                <label className="block text-sm font-semibold text-[#8a8680] mb-2">
                  Ad Account <span className="text-[#f87171]">*</span>
                </label>
                <Select
                  options={accounts}
                  value={selectedAccount}
                  onChange={setSelectedAccount}
                  placeholder="Search and select account..."
                  styles={selectStyles}
                  isSearchable
                  classNamePrefix="react-select"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!canSubmit}
                className={`w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all ${
                  canSubmit
                    ? 'text-white hover:-translate-y-0.5'
                    : 'cursor-not-allowed'
                }`}
                style={canSubmit
                  ? { backgroundColor: '#575ECF' }
                  : { backgroundColor: '#333', color: '#555' }
                }
                onMouseEnter={e => { if (canSubmit) e.currentTarget.style.backgroundColor = '#6B72D8' }}
                onMouseLeave={e => { if (canSubmit) e.currentTarget.style.backgroundColor = '#575ECF' }}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Starting...
                  </span>
                ) : (
                  'Start Checklist →'
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer links */}
        <div className="text-center mt-6 flex justify-center gap-6 text-sm text-[#8a8680]">
          <a href="/changelog" className="transition-colors hover:text-[#575ECF]">View Change Log</a>
          <a href="/admin" className="transition-colors hover:text-[#575ECF]">Admin Panel</a>
        </div>
      </div>
    </div>
  )
}
