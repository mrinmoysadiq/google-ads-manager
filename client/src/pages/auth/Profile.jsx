import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { logout } from '../../utils/auth'
import Avatar from '../../components/Avatar'

function Field({ label, value, onChange, placeholder, type = 'text', readOnly = false, suffix }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#8a8680] mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          readOnly={readOnly}
          className="w-full bg-[#1b1b1b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-[#c5c1b9] outline-none focus:border-[#575ECF] placeholder-[#8a8680]/50 transition-colors"
          style={readOnly ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
        />
        {suffix && (
          <button type="button" onClick={suffix.onClick} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8680] hover:text-[#c5c1b9]">
            {suffix.icon}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Profile form
  const [name, setName] = useState('')
  const [designation, setDesignation] = useState('')
  const [saving, setSaving] = useState(false)

  // Password form
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  // Fetch fresh user data from API (fixes the localStorage-missing redirect bug)
  useEffect(() => {
    axios.get('/api/auth/me')
      .then(({ data }) => {
        setUser(data)
        setName(data.name || '')
        setDesignation(data.designation || '')
        localStorage.setItem('app_user', JSON.stringify(data))
      })
      .catch(() => logout())
      .finally(() => setLoading(false))
  }, [])

  async function saveProfile(e) {
    e.preventDefault()
    if (!name.trim()) return toast.error('Name is required')
    setSaving(true)
    try {
      const { data } = await axios.patch('/api/auth/profile', { name: name.trim(), designation: designation.trim() })
      setUser(data)
      localStorage.setItem('app_user', JSON.stringify(data))
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save')
    }
    setSaving(false)
  }

  async function savePassword(e) {
    e.preventDefault()
    if (!newPw) return toast.error('Enter a new password')
    if (newPw.length < 6) return toast.error('Password must be at least 6 characters')
    if (newPw !== confirmPw) return toast.error('Passwords do not match')
    setSavingPw(true)
    try {
      await axios.patch('/api/auth/profile', { password: newPw })
      toast.success('Password updated')
      setNewPw('')
      setConfirmPw('')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update password')
    }
    setSavingPw(false)
  }

  const eyeIcon = (show) => show
    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>

  if (loading) return (
    <div className="min-h-screen bg-[#1b1b1b] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#575ECF] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#1b1b1b] px-4 py-12">
      <div className="w-full max-w-lg mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate(-1)} className="text-[#8a8680] hover:text-[#c5c1b9] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-[#c5c1b9]">My Profile</h1>
        </div>

        {/* Avatar + identity card */}
        <div className="bg-[#242424] border border-white/8 rounded-2xl p-6 flex items-center gap-5">
          <Avatar name={user?.name} avatarUrl={user?.avatar_url} size={64} />
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-[#c5c1b9] truncate">{user?.name}</p>
            <p className="text-sm text-[#8a8680] truncate">@{user?.username}</p>
            <span
              className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mt-1.5"
              style={{
                backgroundColor: user?.role === 'admin' ? '#575ECF20' : 'rgba(255,255,255,0.06)',
                color: user?.role === 'admin' ? '#818cf8' : '#8a8680',
              }}
            >
              {user?.role === 'admin' ? 'Admin' : 'User'}
            </span>
          </div>
        </div>

        {/* Edit profile */}
        <div className="bg-[#242424] border border-white/8 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-[#c5c1b9] mb-4">Edit Profile</h2>
          <form onSubmit={saveProfile} className="space-y-4">
            <Field label="Full Name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
            <Field
              label="Username"
              value={user?.username || ''}
              readOnly
              placeholder=""
            />
            <Field label="Designation / Role Title" value={designation} onChange={e => setDesignation(e.target.value)} placeholder="e.g. Digital Marketing Specialist" />
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ backgroundColor: saving ? 'rgba(87,94,207,0.5)' : '#575ECF', cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Change password */}
        <div className="bg-[#242424] border border-white/8 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-[#c5c1b9] mb-4">Change Password</h2>
          <form onSubmit={savePassword} className="space-y-4">
            <Field
              label="New Password"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              placeholder="Min. 6 characters"
              type={showNewPw ? 'text' : 'password'}
              suffix={{ icon: eyeIcon(showNewPw), onClick: () => setShowNewPw(p => !p) }}
            />
            <Field
              label="Confirm New Password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="Repeat new password"
              type={showConfirmPw ? 'text' : 'password'}
              suffix={{ icon: eyeIcon(showConfirmPw), onClick: () => setShowConfirmPw(p => !p) }}
            />
            <button
              type="submit"
              disabled={savingPw}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ backgroundColor: savingPw ? 'rgba(87,94,207,0.5)' : '#575ECF', cursor: savingPw ? 'not-allowed' : 'pointer' }}
            >
              {savingPw ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Sign out */}
        <button
          onClick={logout}
          className="w-full py-2.5 rounded-xl text-sm font-semibold border transition-colors"
          style={{ borderColor: '#ef444440', color: '#ef4444', backgroundColor: 'transparent' }}
        >
          Sign Out
        </button>

      </div>
    </div>
  )
}
