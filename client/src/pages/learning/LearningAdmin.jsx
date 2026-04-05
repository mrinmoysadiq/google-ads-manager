import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  getSettings, updateSetting,
  getRoles, createRole, deleteRole,
  getLearningUsers, createLearningUser, updateLearningUser,
} from '../../utils/learningApi'
import { getISOWeek, weekLabel } from '../../utils/weekUtils'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const SOURCE_TYPES = ['Article', 'Video/YouTube', 'Course', 'Book', 'Colleague/Mentor', 'On-the-job experience', 'Other']

const cardClass = 'rounded-xl p-6 bg-[#242424] border border-white/8'
const inputClass = 'w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#575ECF]'
const labelClass = 'block text-sm font-medium text-[#8a8680] mb-1.5'

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-bold text-[#c5c1b9]">{title}</h2>
      {subtitle && <p className="text-sm text-[#8a8680] mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ── Settings Section ──────────────────────────────────────────────────────────
function SettingsSection() {
  const [deadlineDay, setDeadlineDay] = useState('Friday')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSettings()
      .then(s => { if (s.deadline_day) setDeadlineDay(s.deadline_day) })
      .catch(() => toast.error('Failed to load settings'))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSetting('deadline_day', deadlineDay)
      toast.success('Settings saved!')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cardClass}>
      <SectionHeader title="Settings" subtitle="Configure weekly submission rules" />
      <div className="max-w-xs">
        <label className={labelClass}>Weekly Deadline Day</label>
        <select
          value={deadlineDay}
          onChange={e => setDeadlineDay(e.target.value)}
          className={inputClass}
          style={{ backgroundColor: '#2a2a2a' }}
        >
          {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <p className="text-xs text-[#8a8680] mt-2">Entries submitted after this day are marked as late.</p>
      </div>
      <div className="mt-5 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
          style={{ backgroundColor: '#575ECF' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#6B72D8'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#575ECF'}
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

// ── Roles Section ─────────────────────────────────────────────────────────────
function RolesSection() {
  const [roles, setRoles] = useState([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getRoles().then(setRoles).catch(() => toast.error('Failed to load roles'))
  }, [])

  const handleAdd = async () => {
    if (!newName.trim()) return
    setLoading(true)
    try {
      const role = await createRole(newName.trim())
      setRoles(prev => [...prev, role].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
      toast.success('Role added!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add role')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (role) => {
    if (!window.confirm(`Delete role "${role.name}"?`)) return
    try {
      await deleteRole(role.id)
      setRoles(prev => prev.filter(r => r.id !== role.id))
      toast.success('Role deleted!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete role')
    }
  }

  return (
    <div className={cardClass}>
      <SectionHeader title="Roles" subtitle="Roles are assigned to users for context in the manager view" />

      <div className="flex gap-3 mb-5">
        <input
          type="text"
          placeholder="New role name (e.g. PPC Specialist)"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className={inputClass}
        />
        <button
          onClick={handleAdd}
          disabled={loading || !newName.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors whitespace-nowrap"
          style={{ backgroundColor: '#575ECF' }}
          onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#6B72D8' }}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#575ECF'}
        >
          Add Role
        </button>
      </div>

      {roles.length === 0 ? (
        <p className="text-sm italic text-[#8a8680]">No roles yet. Add one above.</p>
      ) : (
        <div className="rounded-xl overflow-hidden border border-white/8">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: '#1b1b1b' }}>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#8a8680]">Role Name</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#8a8680]">Action</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role, i) => (
                <tr key={role.id} style={{ backgroundColor: i % 2 === 0 ? '#242424' : '#2a2a2a' }}>
                  <td className="px-4 py-3 text-[#c5c1b9] font-medium">{role.name}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(role)}
                      className="text-xs font-medium text-[#f87171] hover:opacity-75 transition-opacity"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Users Section ─────────────────────────────────────────────────────────────
function UsersSection() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [newUser, setNewUser] = useState({ name: '', role_id: '', manager_id: '' })
  const [editUser, setEditUser] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([getLearningUsers(), getRoles()])
      .then(([u, r]) => { setUsers(u); setRoles(r); setLoading(false) })
      .catch(() => { toast.error('Failed to load users'); setLoading(false) })
  }, [])

  const handleAdd = async () => {
    if (!newUser.name.trim()) return toast.error('Name is required')
    setSaving(true)
    try {
      const user = await createLearningUser({
        name: newUser.name.trim(),
        role_id: newUser.role_id || null,
        manager_id: newUser.manager_id || null,
      })
      setUsers(prev => [...prev, user].sort((a, b) => a.name.localeCompare(b.name)))
      setNewUser({ name: '', role_id: '', manager_id: '' })
      setShowAddForm(false)
      toast.success('User added! Joined week: ' + weekLabel(user.joined_week))
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add user')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (user) => {
    setEditingId(user.id)
    setEditUser({ role_id: user.role_id || '', manager_id: user.manager_id || '' })
  }

  const handleEditSave = async (user) => {
    setSaving(true)
    try {
      const updated = await updateLearningUser(user.id, {
        role_id: editUser.role_id || null,
        manager_id: editUser.manager_id || null,
      })
      setUsers(prev => prev.map(u => u.id === user.id ? updated : u))
      setEditingId(null)
      toast.success('Updated!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (user) => {
    try {
      const updated = await updateLearningUser(user.id, { active: !user.active })
      setUsers(prev => prev.map(u => u.id === user.id ? updated : u))
      toast.success(updated.active ? 'User activated!' : 'User deactivated!')
    } catch {
      toast.error('Failed to update status')
    }
  }

  const currentWeek = getISOWeek()

  if (loading) return (
    <div className={cardClass}>
      <div className="flex items-center justify-center py-10">
        <svg className="w-7 h-7 animate-spin text-[#575ECF]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    </div>
  )

  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between mb-5">
        <SectionHeader title="Users" subtitle="Manage learning tracker participants" />
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: '#575ECF' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#6B72D8'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#575ECF'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="rounded-xl p-4 mb-5 border" style={{ backgroundColor: 'rgba(87,94,207,0.06)', borderColor: 'rgba(87,94,207,0.2)' }}>
          <p className="text-sm font-semibold text-[#c5c1b9] mb-4">New User — joined week will be set to current week ({weekLabel(currentWeek)})</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className={labelClass}>Name *</label>
              <input
                type="text"
                placeholder="Full name"
                value={newUser.name}
                onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <select
                value={newUser.role_id}
                onChange={e => setNewUser(p => ({ ...p, role_id: e.target.value }))}
                className={inputClass}
                style={{ backgroundColor: '#2a2a2a' }}
              >
                <option value="">— No role —</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Manager</label>
              <select
                value={newUser.manager_id}
                onChange={e => setNewUser(p => ({ ...p, manager_id: e.target.value }))}
                className={inputClass}
                style={{ backgroundColor: '#2a2a2a' }}
              >
                <option value="">— No manager —</option>
                {users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowAddForm(false); setNewUser({ name: '', role_id: '', manager_id: '' }) }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[#c5c1b9] transition-colors"
              style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving || !newUser.name.trim()}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#575ECF' }}
            >
              {saving ? 'Adding…' : 'Add User'}
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      {users.length === 0 ? (
        <p className="text-sm italic text-[#8a8680]">No users yet. Add one above.</p>
      ) : (
        <div className="rounded-xl overflow-hidden border border-white/8">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: '#1b1b1b' }}>
              <tr>
                {['Name', 'Role', 'Manager', 'Joined', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#8a8680]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => (
                <tr key={user.id} style={{ backgroundColor: i % 2 === 0 ? '#242424' : '#2a2a2a', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${user.active ? 'text-[#c5c1b9]' : 'line-through text-[#8a8680]'}`}>{user.name}</span>
                  </td>
                  <td className="px-4 py-3 text-[#8a8680]">
                    {editingId === user.id ? (
                      <select
                        value={editUser.role_id}
                        onChange={e => setEditUser(p => ({ ...p, role_id: e.target.value }))}
                        className="rounded-lg px-2 py-1 text-xs bg-[#1b1b1b] border border-white/10 text-[#c5c1b9] focus:outline-none focus:border-[#575ECF]"
                      >
                        <option value="">— None —</option>
                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    ) : (
                      user.role_name || <span className="text-[#8a8680]/50 italic">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#8a8680]">
                    {editingId === user.id ? (
                      <select
                        value={editUser.manager_id}
                        onChange={e => setEditUser(p => ({ ...p, manager_id: e.target.value }))}
                        className="rounded-lg px-2 py-1 text-xs bg-[#1b1b1b] border border-white/10 text-[#c5c1b9] focus:outline-none focus:border-[#575ECF]"
                      >
                        <option value="">— None —</option>
                        {users.filter(u => u.id !== user.id && u.active).map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    ) : (
                      user.manager_name || <span className="text-[#8a8680]/50 italic">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#8a8680] text-xs">{user.joined_week}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      style={user.active
                        ? { backgroundColor: 'rgba(74,222,128,0.1)', color: '#4ade80' }
                        : { backgroundColor: 'rgba(255,255,255,0.05)', color: '#8a8680' }
                      }
                    >
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {editingId === user.id ? (
                        <>
                          <button onClick={() => handleEditSave(user)} disabled={saving} className="text-xs font-medium text-[#4ade80] hover:opacity-75">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-xs font-medium text-[#8a8680] hover:text-[#c5c1b9]">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(user)} className="text-xs font-medium text-[#575ECF] hover:text-[#6B72D8]">Edit</button>
                          <button onClick={() => handleToggleActive(user)} className={`text-xs font-medium ${user.active ? 'text-[#fbbf24]' : 'text-[#4ade80]'} hover:opacity-75`}>
                            {user.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </>
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
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LearningAdmin() {
  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link
            to="/learning"
            className="text-sm text-[#8a8680] hover:text-[#c5c1b9] transition-colors"
          >
            ← Learning
          </Link>
          <span className="text-[#8a8680]">/</span>
          <span className="text-sm text-[#c5c1b9] font-medium">Admin</span>
        </div>

        <div className="mb-7">
          <h1 className="text-2xl font-bold text-[#c5c1b9]">Learning Tracker Admin</h1>
          <p className="text-[#8a8680] text-sm mt-1">Manage settings, roles, and users for the weekly learning tracker</p>
        </div>

        <div className="space-y-6">
          <SettingsSection />
          <RolesSection />
          <UsersSection />
        </div>
      </div>
    </div>
  )
}
