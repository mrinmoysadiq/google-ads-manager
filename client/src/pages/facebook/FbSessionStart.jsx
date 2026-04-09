import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Select from 'react-select'
import toast from 'react-hot-toast'
import axios from 'axios'
import Navbar from '../../components/Navbar'
import { fbState, resetFbState } from './fbState'
import { getUser } from '../../utils/auth'

const API = import.meta.env.VITE_API_URL || '/api'

const selectStyles = {
  control: (base, { isFocused }) => ({
    ...base, backgroundColor: '#2a2a2a',
    borderColor: isFocused ? '#575ECF' : 'rgba(255,255,255,0.1)',
    boxShadow: 'none', minHeight: '44px', fontSize: '14px',
    '&:hover': { borderColor: '#575ECF' },
  }),
  menu: (base) => ({ ...base, backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', zIndex: 100 }),
  option: (base, { isSelected, isFocused }) => ({
    ...base,
    backgroundColor: isSelected ? '#575ECF' : isFocused ? 'rgba(87,94,207,0.15)' : 'transparent',
    color: '#c5c1b9', cursor: 'pointer',
  }),
  singleValue: (base) => ({ ...base, color: '#c5c1b9' }),
  placeholder: (base) => ({ ...base, color: '#8a8680' }),
  input: (base) => ({ ...base, color: '#c5c1b9' }),
  indicatorSeparator: () => ({ display: 'none' }),
}

const inputClass = 'w-full rounded-lg px-4 py-3 text-sm focus:outline-none bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#575ECF] transition-colors'

export default function FbSessionStart() {
  const navigate = useNavigate()
  const today = new Date().toISOString().slice(0, 10)

  const [buyers, setBuyers] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  const [buyer, setBuyer] = useState(fbState.buyer ? { value: fbState.buyer, label: fbState.buyer } : null)
  const [date, setDate] = useState(fbState.date || today)
  const [account, setAccount] = useState(fbState.account ? { value: fbState.account, label: fbState.account } : null)
  const [buyerNotFound, setBuyerNotFound] = useState(false)

  useEffect(() => {
    const appUser = getUser()
    Promise.all([
      axios.get(`${API}/facebook/media-buyers`),
      axios.get(`${API}/facebook/ad-accounts`),
    ]).then(([b, a]) => {
      setBuyers(b.data)
      setAccounts(a.data)
      // Pre-fill from logged-in user
      if (appUser && !fbState.buyer) {
        const match = b.data.find(m => m.name.toLowerCase() === appUser.name.toLowerCase())
        if (match) {
          setBuyer({ value: match.name, label: match.name })
          setBuyerNotFound(false)
        } else {
          setBuyerNotFound(true)
        }
      }
    }).catch(() => toast.error('Failed to load data'))
    .finally(() => setLoading(false))
  }, [])

  const buyerOptions = buyers.map(b => ({ value: b.name, label: b.name }))
  const accountOptions = accounts.map(a => ({ value: a.name, label: a.name }))

  const canStart = buyer && date && account

  const handleStart = () => {
    if (!canStart) return
    resetFbState()
    fbState.buyer = buyer.value
    fbState.date = date
    fbState.account = account.value
    fbState.currentQuestion = 0
    navigate('/facebook/checklist')
  }

  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <Navbar />
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo badge */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-3 bg-[#242424] border border-white/[0.08] rounded-2xl px-6 py-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#1877f2' }}>
                <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              <span className="text-[#c5c1b9] font-semibold text-sm">Facebook & Meta Ads</span>
            </div>
          </div>

          {/* Card */}
          <div className="bg-[#242424] border border-white/[0.08] rounded-xl p-8">
            <h1 className="text-2xl font-bold text-[#c5c1b9] mb-1">Start Your Daily Session</h1>
            <p className="text-[#8a8680] text-sm mb-8">Complete your daily Facebook & Meta Ads review checklist.</p>

            {loading ? (
              <div className="flex justify-center py-8">
                <svg className="animate-spin h-6 w-6 text-[#575ECF]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-[#8a8680] uppercase tracking-wider mb-2">Media Buyer</label>
                  <Select
                    styles={selectStyles}
                    options={buyerOptions}
                    value={buyer}
                    onChange={setBuyer}
                    placeholder="Select media buyer…"
                    isClearable
                    isDisabled
                  />
                  {buyerNotFound && (
                    <p className="mt-1.5 text-xs text-[#f59e0b]">Your account ({getUser()?.name}) was not found in media buyers. Please ask an admin to add you.</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8a8680] uppercase tracking-wider mb-2">Date</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={date}
                    onChange={e => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8a8680] uppercase tracking-wider mb-2">Ad Account</label>
                  <Select
                    styles={selectStyles}
                    options={accountOptions}
                    value={account}
                    onChange={setAccount}
                    placeholder="Select ad account…"
                    isClearable
                  />
                </div>
                <button
                  onClick={handleStart}
                  disabled={!canStart}
                  className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-all mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: canStart ? '#575ECF' : '#575ECF' }}
                  onMouseEnter={e => { if (canStart) e.currentTarget.style.backgroundColor = '#6B72D8' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#575ECF' }}
                >
                  Start Checklist →
                </button>
              </div>
            )}
          </div>

          <div className="text-center mt-6">
            <Link to="/facebook/admin" className="text-xs text-[#8a8680] hover:text-[#c5c1b9] transition-colors">
              Admin Panel →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
