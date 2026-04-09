import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import { getUser } from '../../utils/auth'
import Avatar from '../../components/Avatar'

const EMPTY = { name: '', username: '', password: '', designation: '', role: 'user', avatar_url: '', active: 1 }

function Toggle({ checked, onChange, disabled }) {
  return (
    <button type="button" onClick={() => !disabled && onChange(!checked)} disabled={disabled}
      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0"
      style={{ backgroundColor: checked ? '#22c55e' : 'rgba(255,255,255,0.12)', cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform" style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }} />
    </button>
  )
}

export default function AppAdminPanel() {
  const navigate = useNavigate()
  const me = getUser()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { const { data } = await api.get('/app-admin/users'); setUsers(data) }
    catch { toast.error('Failed to load users') }
    setLoading(false)
  }

  function startEdit(u) {
    setEditId(u.id)
    setForm({ name: u.name, username: u.username, password: '', designation: u.designation || '', role: u.role, avatar_url: u.avatar_url || '', active: u.active })
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50)
  }

  function cancel() { setEditId(null); setForm(EMPTY) }

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.username.trim()) return toast.error('Name and username required')
    if (!editId && !form.password) return toast.error('Password required for new users')
    setSaving(true)
    try {
      const payload = { ...form, avatar_url: form.avatar_url || null }
      if (editId && !payload.password) delete payload.password
      if (editId) { await api.patch(`/app-admin/users/${editId}`, payload); toast.success('User updated') }
      else { await api.post('/app-admin/users', payload); toast.success('User created') }
      await load(); cancel()
    } catch (err) { toast.error(err.response?.data?.error || 'Error saving user') }
    setSaving(false)
  }

  async function del(id) {
    try { await api.delete(`/app-admin/users/${id}`); toast.success('User deleted'); setDeleteConfirm(null); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Error') }
  }

  async function toggleActive(u) {
    if (u.id === 1 || u.id === me?.id) return toast.error(u.id === 1 ? 'Cannot deactivate super-admin' : 'Cannot deactivate your own account')
    try { await api.patch(`/app-admin/users/${u.id}`, { active: u.active ? 0 : 1 }); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Error') }
  }

  const inp = 'w-full bg-[#1b1b1b] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-[#c5c1b9] outline-none focus:border-[#575ECF] placeholder-[#8a8680] transition-colors'

  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-[#8a8680] hover:text-[#c5c1b9] mb-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Back
          </button>
          <h1 className="text-2xl font-bold text-[#c5c1b9]">Admin Panel</h1>
          <p className="text-sm text-[#8a8680] mt-1">Manage team members, credentials and roles</p>
        </div>

        <div className="bg-[#242424] border border-white/8 rounded-2xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#c5c1b9]">Team Members</h2>
            <span className="text-xs text-[#8a8680]">{users.length} members</span>
          </div>
          {loading ? <div className="py-12 text-center text-[#8a8680] text-sm">Loading...</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Member', 'Username', 'Designation', 'Role', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-6 py-3 text-xs font-medium text-[#8a8680]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: u.active ? 1 : 0.45 }}>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} avatarUrl={u.avatar_url} size={32} />
                          <span className="font-medium text-[#c5c1b9]">{u.name}</span>
                          {u.id === me?.id && <span className="text-[10px] text-[#575ECF] bg-[#575ECF]/10 px-1.5 py-0.5 rounded-full">You</span>}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-[#8a8680]">@{u.username}</td>
                      <td className="px-6 py-3 text-[#8a8680]">{u.designation || '—'}</td>
                      <td className="px-6 py-3">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: u.role === 'admin' ? '#575ECF20' : 'rgba(255,255,255,0.06)', color: u.role === 'admin' ? '#818cf8' : '#8a8680' }}>
                          {u.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <Toggle checked={!!u.active} onChange={() => toggleActive(u)} disabled={u.id === 1 || u.id === me?.id} />
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => startEdit(u)} className="text-xs px-3 py-1.5 rounded-lg text-[#575ECF] hover:bg-[#575ECF]/10 transition-colors">Edit</button>
                          {u.id !== 1 && (
                            deleteConfirm === u.id
                              ? <div className="flex gap-1">
                                  <button onClick={() => del(u.id)} className="text-xs px-2 py-1 rounded-lg bg-[#ef4444] text-white">Confirm</button>
                                  <button onClick={() => setDeleteConfirm(null)} className="text-xs px-2 py-1 rounded-lg bg-white/8 text-[#8a8680]">Cancel</button>
                                </div>
                              : <button onClick={() => setDeleteConfirm(u.id)} className="text-xs px-3 py-1.5 rounded-lg text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors">Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-[#242424] border border-white/8 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-[#c5c1b9] mb-5">{editId ? 'Edit Team Member' : 'Add New Team Member'}</h2>
          <form onSubmit={submit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#8a8680] mb-1.5">Full Name *</label>
                <input className={inp} placeholder="e.g. John Smith" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-[#8a8680] mb-1.5">Username *</label>
                <input className={inp} placeholder="e.g. johnsmith" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g,'') }))} />
              </div>
              <div>
                <label className="block text-xs text-[#8a8680] mb-1.5">{editId ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                <div className="relative">
                  <input className={inp + ' pr-10'} type={showPw ? 'text' : 'password'} placeholder={editId ? 'Leave blank to keep current' : 'Set a password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                  <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8680]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {showPw ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        : <><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>}
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#8a8680] mb-1.5">Designation</label>
                <input className={inp} placeholder="e.g. Google Ads Specialist" value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-[#8a8680] mb-1.5">Role</label>
                <select className={inp} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#8a8680] mb-1.5">Profile Photo (optional)</label>
                <div className="flex gap-3 items-center">
                  <label className="cursor-pointer flex-shrink-0">
                    <Avatar name={form.name || 'User'} avatarUrl={form.avatar_url || null} size={44} />
                    <input type="file" accept="image/*" className="hidden" onChange={async e => {
                      const file = e.target.files[0]; if (!file) return;
                      if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
                      const reader = new FileReader();
                      reader.onload = ev => {
                        const img = new Image();
                        img.onload = () => {
                          const MAX = 200; let w = img.width, h = img.height;
                          if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
                          else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
                          const c = document.createElement('canvas'); c.width = w; c.height = h;
                          c.getContext('2d').drawImage(img, 0, 0, w, h);
                          setForm(f => ({ ...f, avatar_url: c.toDataURL('image/jpeg', 0.85) }));
                        };
                        img.src = ev.target.result;
                      };
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#8a8680] mb-1">Click photo to upload (or paste URL below)</p>
                    <input className={inp} placeholder="https://... or leave blank for initials" value={form.avatar_url} onChange={e => setForm(f => ({ ...f, avatar_url: e.target.value }))} />
                  </div>
                  {form.avatar_url && (
                    <button type="button" onClick={() => setForm(f => ({ ...f, avatar_url: '' }))} className="text-xs text-[#8a8680] hover:text-[#ef4444] flex-shrink-0">✕</button>
                  )}
                </div>
              </div>
              {editId && (
                <div className="flex items-center gap-3 pt-1">
                  <label className="text-xs text-[#8a8680]">Active</label>
                  <Toggle checked={!!form.active} onChange={v => setForm(f => ({ ...f, active: v ? 1 : 0 }))} disabled={editId === 1 || editId === me?.id} />
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all" style={{ backgroundColor: saving ? 'rgba(87,94,207,0.4)' : '#575ECF' }}>
                {saving ? 'Saving...' : editId ? 'Update Team Member' : 'Add Team Member'}
              </button>
              {editId && <button type="button" onClick={cancel} className="px-5 py-2.5 rounded-xl text-sm text-[#8a8680] bg-white/6 hover:bg-white/10 transition-colors">Cancel</button>}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
