import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import infinixLogo from '../../assets/infinix-logo.svg'

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await axios.post('/api/auth/login', { username, password })
      localStorage.setItem('app_token', data.token)
      localStorage.setItem('app_user', JSON.stringify(data.user))
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid username or password')
    }
    setLoading(false)
  }

  const inputCls = 'w-full bg-[#1b1b1b] border border-white/10 rounded-xl px-4 py-3 text-sm text-[#c5c1b9] outline-none focus:border-[#575ECF] placeholder-[#8a8680] transition-colors'

  return (
    <div className="min-h-screen bg-[#1b1b1b] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src={infinixLogo} alt="Infinix" style={{ height: '44px', width: 'auto' }} />
        </div>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#c5c1b9] mb-1">Welcome Back</h1>
          <p className="text-sm text-[#8a8680]">Sign in to Infinix Online Ads Manager</p>
        </div>
        <div className="bg-[#242424] border border-white/8 rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#8a8680] mb-1.5">Username</label>
              <input className={inputCls} placeholder="Enter your username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8a8680] mb-1.5">Password</label>
              <div className="relative">
                <input className={inputCls + ' pr-10'} type={showPw ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
                <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8680] hover:text-[#c5c1b9]">
                  {showPw
                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-[#ef4444]">{error}</p>}
            <button type="submit" disabled={loading || !username || !password} className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all mt-2"
              style={{ backgroundColor: loading || !username || !password ? 'rgba(87,94,207,0.4)' : '#575ECF', cursor: loading || !username || !password ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
