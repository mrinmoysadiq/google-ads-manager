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
      borderColor: state.isFocused ? '#2563eb' : '#d1d5db',
      boxShadow: state.isFocused ? '0 0 0 1px #2563eb' : 'none',
      '&:hover': { borderColor: '#2563eb' },
      borderRadius: '8px',
      minHeight: '42px',
      fontSize: '14px',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? '#eff6ff' : 'white',
      color: state.isSelected ? 'white' : '#111827',
      fontSize: '14px',
    }),
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Start Your Daily Session</h1>
          <p className="text-gray-500 mt-2 text-sm">Complete your daily Google Ads review checklist</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-100 border border-gray-100 p-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="w-8 h-8 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Your Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Your Name <span className="text-red-400">*</span>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Ad Account */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ad Account <span className="text-red-400">*</span>
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
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-200 hover:-translate-y-0.5'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
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
        <div className="text-center mt-6 flex justify-center gap-6 text-sm text-gray-400">
          <a href="/changelog" className="hover:text-blue-600 transition-colors">View Change Log</a>
          <a href="/admin" className="hover:text-blue-600 transition-colors">Admin Panel</a>
        </div>
      </div>
    </div>
  )
}
