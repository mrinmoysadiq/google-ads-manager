import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../../utils/lmsApi'
import { getUser } from '../../utils/auth'

export default function LmsStart() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // 'loading' | 'not_found'

  useEffect(() => {
    async function init() {
      const appUser = getUser()
      if (!appUser) {
        navigate('/login', { replace: true })
        return
      }
      try {
        const { data: lmsUsers } = await api.get('/lms/users')

        // Try to find the LMS user by name match
        const match = lmsUsers.find(u => u.name.toLowerCase() === appUser.name.toLowerCase())

        if (!match && appUser.role === 'admin') {
          // App admin but not in lms_users — go to lms admin panel
          localStorage.setItem('lms_user_role', 'admin')
          localStorage.setItem('lms_user_name', appUser.name)
          navigate('/learning/admin', { replace: true })
          return
        }

        if (!match) {
          // Auto-create as employee so they can use the module immediately
          const { data: created } = await api.post('/lms/users', { name: appUser.name, role: 'employee' })
          localStorage.setItem('lms_user_id', created.id)
          localStorage.setItem('lms_user_role', 'employee')
          localStorage.setItem('lms_user_name', created.name)
          navigate(`/learning/employee/${created.id}`, { replace: true })
          return
        }

        // Found in lms_users
        localStorage.setItem('lms_user_id', match.id)
        localStorage.setItem('lms_user_role', match.role)
        localStorage.setItem('lms_user_name', match.name)

        if (match.role === 'employee') navigate(`/learning/employee/${match.id}`, { replace: true })
        else if (match.role === 'manager') navigate('/learning/manager', { replace: true })
        else navigate('/learning/admin', { replace: true })
      } catch {
        setStatus('not_found')
      }
    }
    init()
  }, [])

  if (status === 'loading') {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-[#1b1b1b] flex items-center justify-center">
        <svg className="w-8 h-8 animate-spin text-[#575ECF]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  // not_found state
  const appUser = getUser()
  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#1b1b1b] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#575ECF18', border: '1px solid #575ECF30' }}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#575ECF" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        </div>
        <h1 className="text-xl font-bold text-[#c5c1b9] mb-2">Not Set Up Yet</h1>
        <p className="text-sm text-[#8a8680] mb-1">
          Your account <span className="text-[#c5c1b9] font-medium">{appUser?.name}</span> is not set up in the Learning Management System.
        </p>
        <p className="text-sm text-[#8a8680] mb-8">Please ask an admin to add you as a learner.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate(-1)} className="px-5 py-2.5 rounded-xl text-sm text-[#8a8680] border border-white/10 hover:text-[#c5c1b9] transition-colors">
            ← Back
          </button>
          <Link to="/learning/admin" className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors" style={{ backgroundColor: '#575ECF' }}>
            Admin Panel
          </Link>
        </div>
      </div>
    </div>
  )
}
