import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { logout, getUser, decodeToken } from '../../utils/auth'
import Avatar from '../../components/Avatar'

// Resize an image File to a base64 JPEG (max 200×200 px)
async function resizeImage(file) {
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be under 5MB')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = ev => {
      const img = new Image()
      img.onload = () => {
        const MAX = 200
        let w = img.width, h = img.height
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX } }
        else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX } }
        const c = document.createElement('canvas')
        c.width = w; c.height = h
        c.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(c.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = reject
      img.src = ev.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function Profile() {
  const navigate = useNavigate()
  const avatarInputRef = useRef(null)

  // Seed immediately from localStorage so the page isn't blank while the API loads.
  // Fall back to decoded JWT token for the role if localStorage is stale.
  const cached = getUser()
  const tokenPayload = decodeToken()
  const initialUser = cached?.id ? cached : null

  const [user, setUser] = useState(initialUser)
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState(false)

  // Profile fields — pre-filled from cache so they're never blank
  const [name, setName] = useState(initialUser?.name || '')
  const [designation, setDesignation] = useState(initialUser?.designation || '')
  const [avatarPreview, setAvatarPreview] = useState(initialUser?.avatar_url || null)
  const [avatarData, setAvatarData] = useState(null)
  const [saving, setSaving] = useState(false)

  // Password fields
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  // Determine role from best available source
  const role = user?.role || tokenPayload?.role || 'user'
  const isAdmin = role === 'admin'

  useEffect(() => {
    axios.get('/api/auth/me')
      .then(({ data }) => {
        // Validate it's a real user object (not an HTML page returned by nginx)
        if (!data || typeof data !== 'object' || !data.id) {
          setApiError(true)
          return
        }
        setUser(data)
        setName(data.name || '')
        setDesignation(data.designation || '')
        setAvatarPreview(data.avatar_url || null)
        localStorage.setItem('app_user', JSON.stringify(data))
      })
      .catch(() => {
        // Keep whatever state we have from localStorage; don't redirect
        setApiError(true)
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const b64 = await resizeImage(file)
      setAvatarPreview(b64)
      setAvatarData(b64)
    } catch (err) {
      toast.error(err.message || 'Failed to process image')
    }
  }

  function removeAvatar() {
    setAvatarPreview(null)
    setAvatarData('')
    if (avatarInputRef.current) avatarInputRef.current.value = ''
  }

  async function saveProfile(e) {
    e.preventDefault()
    if (!name.trim()) return toast.error('Name is required')
    setSaving(true)
    try {
      const body = { name: name.trim(), designation: designation.trim() }
      if (avatarData !== null) body.avatar_url = avatarData
      const { data } = await axios.patch('/api/auth/profile', body)
      if (!data || typeof data !== 'object' || !data.id) {
        throw new Error('Server returned an unexpected response — changes may not have been saved.')
      }
      setUser(data)
      setAvatarData(null)
      localStorage.setItem('app_user', JSON.stringify(data))
      window.dispatchEvent(new Event('profile-updated'))
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err.message || err.response?.data?.error || 'Failed to save')
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
      const { data } = await axios.patch('/api/auth/profile', { password: newPw })
      if (!data || typeof data !== 'object' || !data.id) {
        throw new Error('Server returned an unexpected response.')
      }
      toast.success('Password updated')
      setNewPw(''); setConfirmPw('')
    } catch (err) {
      toast.error(err.message || err.response?.data?.error || 'Failed to update password')
    }
    setSavingPw(false)
  }

  const eyeIcon = show => show
    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>

  const inp = 'w-full bg-[#1b1b1b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-[#c5c1b9] outline-none focus:border-[#575ECF] placeholder-[#8a8680]/50 transition-colors'
  const displayName = user?.name || name || (tokenPayload?.username ? `@${tokenPayload.username}` : 'Your Account')

  return (
    <div className="min-h-screen bg-[#1b1b1b] px-4 py-12">
      <div className="w-full max-w-lg mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate(-1)} className="text-[#8a8680] hover:text-[#c5c1b9] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-lg font-bold text-[#c5c1b9]">My Profile</h1>
          {loading && <div className="w-4 h-4 border-2 border-[#575ECF] border-t-transparent rounded-full animate-spin ml-1" />}
        </div>

        {/* API error banner */}
        {apiError && !loading && (
          <div className="rounded-xl px-4 py-3 text-sm flex items-center gap-3" style={{ backgroundColor: '#f59e0b18', border: '1px solid #f59e0b30', color: '#f59e0b' }}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
            Could not reach the server. Showing cached data — saves may not work until backend reconnects.
          </div>
        )}

        {/* Avatar + identity */}
        <div className="bg-[#242424] border border-white/8 rounded-2xl p-6">
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <div className="cursor-pointer group relative" onClick={() => avatarInputRef.current?.click()} title="Click to change photo">
                <Avatar name={displayName} avatarUrl={avatarPreview} size={72} />
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
              </div>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-[#c5c1b9] truncate">{displayName}</p>
              <p className="text-sm text-[#8a8680] truncate">@{user?.username || tokenPayload?.username || '—'}</p>
              <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mt-1.5"
                style={{ backgroundColor: isAdmin ? '#575ECF20' : 'rgba(255,255,255,0.06)', color: isAdmin ? '#818cf8' : '#8a8680' }}>
                {isAdmin ? 'Admin' : 'Team Member'}
              </span>
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => avatarInputRef.current?.click()} className="text-xs text-[#575ECF] hover:underline">Upload photo</button>
                {avatarPreview && <><span className="text-[#8a8680]/40">·</span><button onClick={removeAvatar} className="text-xs text-[#8a8680] hover:text-[#ef4444]">Remove</button></>}
              </div>
            </div>
          </div>
        </div>

        {/* Edit profile */}
        <div className="bg-[#242424] border border-white/8 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-[#c5c1b9] mb-4">Edit Profile</h2>
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#8a8680] mb-1.5">Full Name</label>
              <input className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8a8680] mb-1.5">Username</label>
              <input className={inp} value={user?.username || tokenPayload?.username || ''} readOnly style={{ opacity: 0.5, cursor: 'not-allowed' }} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8a8680] mb-1.5">Designation</label>
              <input className={inp} value={designation} onChange={e => setDesignation(e.target.value)} placeholder="e.g. Digital Marketing Specialist" />
            </div>
            <button type="submit" disabled={saving}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ backgroundColor: saving ? 'rgba(87,94,207,0.5)' : '#575ECF', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Change password — admins only */}
        {isAdmin && (
          <div className="bg-[#242424] border border-white/8 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-[#c5c1b9] mb-1">Change Password</h2>
            <p className="text-xs text-[#8a8680] mb-4">Admin only — use User Management to reset passwords for team members.</p>
            <form onSubmit={savePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#8a8680] mb-1.5">New Password</label>
                <div className="relative">
                  <input className={inp + ' pr-10'} type={showNewPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 6 characters" />
                  <button type="button" onClick={() => setShowNewPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8680] hover:text-[#c5c1b9]">{eyeIcon(showNewPw)}</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#8a8680] mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <input className={inp + ' pr-10'} type={showConfirmPw ? 'text' : 'password'} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" />
                  <button type="button" onClick={() => setShowConfirmPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8680] hover:text-[#c5c1b9]">{eyeIcon(showConfirmPw)}</button>
                </div>
              </div>
              <button type="submit" disabled={savingPw}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ backgroundColor: savingPw ? 'rgba(87,94,207,0.5)' : '#575ECF', cursor: savingPw ? 'not-allowed' : 'pointer' }}>
                {savingPw ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          </div>
        )}

        {/* Sign out */}
        <button onClick={logout}
          className="w-full py-2.5 rounded-xl text-sm font-semibold border transition-colors"
          style={{ borderColor: '#ef444440', color: '#ef4444', backgroundColor: 'transparent' }}>
          Sign Out
        </button>

      </div>
    </div>
  )
}
