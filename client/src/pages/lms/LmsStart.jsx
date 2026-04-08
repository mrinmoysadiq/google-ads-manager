import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import Select from 'react-select'

const selectStyles = {
  control: (b, s) => ({
    ...b,
    backgroundColor: '#1b1b1b',
    borderColor: s.isFocused ? '#575ECF' : 'rgba(255,255,255,0.12)',
    borderRadius: '10px',
    boxShadow: 'none',
    padding: '4px 2px',
    fontSize: '15px',
    '&:hover': { borderColor: '#575ECF' },
  }),
  menu: b => ({ ...b, backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' }),
  option: (b, s) => ({ ...b, backgroundColor: s.isSelected ? '#575ECF' : s.isFocused ? 'rgba(87,94,207,0.15)' : 'transparent', color: '#c5c1b9', cursor: 'pointer' }),
  singleValue: b => ({ ...b, color: '#c5c1b9' }),
  input: b => ({ ...b, color: '#c5c1b9' }),
  placeholder: b => ({ ...b, color: '#8a8680' }),
}

export default function LmsStart() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    axios.get('/api/lms/users').then(({ data }) => setUsers(data))
  }, [])

  const options = users.map(u => ({ value: u.id, label: u.name, role: u.role }))

  async function handleContinue() {
    if (!selected) return
    setLoading(true)
    localStorage.setItem('lms_user_id', selected.value)
    localStorage.setItem('lms_user_role', selected.role)
    localStorage.setItem('lms_user_name', selected.label)

    if (selected.role === 'employee') navigate(`/learning/employee/${selected.value}`)
    else if (selected.role === 'manager') navigate('/learning/manager')
    else navigate('/learning/admin')
    setLoading(false)
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#1b1b1b] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#575ECF18', border: '1px solid #575ECF30' }}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#575ECF" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#c5c1b9] mb-2">Learning & Training</h1>
          <p className="text-[#8a8680] text-sm">Select your name to continue</p>
        </div>

        {/* Card */}
        <div className="bg-[#242424] border border-white/8 rounded-2xl p-6 mb-4">
          <label className="block text-sm font-medium text-[#8a8680] mb-2">Your Name</label>
          <Select
            options={options}
            value={selected}
            onChange={setSelected}
            styles={selectStyles}
            placeholder="Select your name..."
            isClearable
          />

          <button
            onClick={handleContinue}
            disabled={!selected || loading}
            className="mt-5 w-full py-3 rounded-xl text-sm font-semibold transition-all"
            style={{
              backgroundColor: selected ? '#575ECF' : 'rgba(87,94,207,0.3)',
              color: selected ? '#fff' : '#8a8680',
              cursor: selected ? 'pointer' : 'not-allowed',
            }}
          >
            Continue →
          </button>
        </div>

        <p className="text-center text-xs text-[#8a8680]">
          Not listed?{' '}
          <Link to="/learning/admin" className="text-[#575ECF] hover:text-[#6B72D8]">
            Admin Panel
          </Link>
        </p>
      </div>
    </div>
  )
}
