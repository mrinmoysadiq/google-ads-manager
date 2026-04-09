import { useNavigate } from 'react-router-dom'
import { getUser, logout } from '../../utils/auth'
import Avatar from '../../components/Avatar'

function formatDate(str) {
  if (!str) return ''
  return new Date(str).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function Profile() {
  const navigate = useNavigate()
  const user = getUser()
  if (!user) { navigate('/login'); return null }
  return (
    <div className="min-h-screen bg-[#1b1b1b] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-[#242424] border border-white/8 rounded-2xl p-8 text-center">
          <div className="flex justify-center mb-4"><Avatar name={user.name} avatarUrl={user.avatar_url} size={80} /></div>
          <h1 className="text-xl font-bold text-[#c5c1b9] mb-1">{user.name}</h1>
          <p className="text-sm text-[#8a8680] mb-1">@{user.username}</p>
          {user.designation && <p className="text-sm text-[#c5c1b9] mb-4">{user.designation}</p>}
          <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-6" style={{ backgroundColor: user.role === 'admin' ? '#575ECF20' : 'rgba(255,255,255,0.06)', color: user.role === 'admin' ? '#818cf8' : '#8a8680' }}>
            {user.role === 'admin' ? 'Admin' : 'User'}
          </span>
          {user.created_at && <p className="text-xs text-[#8a8680] mb-8">Member since {formatDate(user.created_at)}</p>}
          <button onClick={logout} className="w-full py-2.5 rounded-xl text-sm font-semibold border transition-colors" style={{ borderColor: '#ef444440', color: '#ef4444', backgroundColor: 'transparent' }}>Sign Out</button>
          <button onClick={() => navigate(-1)} className="w-full py-2.5 rounded-xl text-sm text-[#8a8680] mt-2 hover:text-[#c5c1b9]">← Back</button>
        </div>
      </div>
    </div>
  )
}
