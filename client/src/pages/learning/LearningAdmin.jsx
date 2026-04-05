import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Select from 'react-select'
import toast from 'react-hot-toast'
import {
  getSettings, updateSetting,
  getRoles, createRole, deleteRole,
  getLearningUsers, createLearningUser, updateLearningUser,
} from '../../utils/learningApi'
import { getISOWeek, weekLabel } from '../../utils/weekUtils'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const cardClass = 'rounded-xl p-6 bg-[#242424] border border-white/8'
const inputClass = 'w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#575ECF]'
const labelClass = 'block text-sm font-medium text-[#8a8680] mb-1.5'

// Shared react-select styles (dark theme)
const selectStyles = {
  control: (base, { isFocused }) => ({
    ...base,
    backgroundColor: '#2a2a2a',
    borderColor: isFocused ? '#575ECF' : 'rgba(255,255,255,0.1)',
    boxShadow: 'none',
    '&:hover': { borderColor: '#575ECF' },
    minHeight: '42px',
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: '#2a2a2a',
    border: '1px solid rgba(255,255,255,0.12)',
    zIndex: 100,
  }),
  option: (base, { isSelected, isFocused }) => ({
    ...base,
    backgroundColor: isSelected ? '#575ECF' : isFocused ? 'rgba(87,94,207,0.15)' : 'transparent',
    color: '#c5c1b9',
    cursor: 'pointer',
    fontSize: '14px',
  }),
  singleValue: (base) => ({ ...base, color: '#c5c1b9' }),
  placeholder: (base) => ({ ...base, color: '#8a8680' }),
  input: (base) => ({ ...base, color: '#c5c1b9' }),
  dropdownIndicator: (base) => ({ ...base, color: '#8a8680' }),
  indicatorSeparator: (base) => ({ ...base, backgroundColor: 'rgba(255,255,255,0.1)' }),
  clearIndicator: (base) => ({ ...base, color: '#8a8680', '&:hover': { color: '#c5c1b9' } }),
}

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

// ── Roles Section — receives shared roles state from parent ───────────────────
function RolesSection({ roles, setRoles }) {
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)

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

// ── Users Section — receives shared roles + users state from parent ───────────
function UsersSection({ roles, users, setUsers }) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [newUser, setNewUser] = useState({ name: '', role_id: null, manager_id: null })
  const [editUser, setEditUser] = useState({})
  const [saving, setSaving] = useState(false)

  const currentWeek = getISOWeek()

  // Build react-select option lists from shared state
  const roleOptions = [
    { value: null, label: '— No role —' },
    ...roles.map(r => ({ value: r.id, label: r.name })),
  ]

  const managerOptions = (excludeId) => [
    { value: null, label: '— No manager —' },
    ...users.filter(u => u.active && u.id !== excludeId).map(u => ({ value: u.id, label: u.name + (u.role_name ? ` · ${u.role_name}` : '') })),
  ]

  const handleAdd = async () => {
    if (!newUser.name.trim()) return toast.error('Name is required')
    setSaving(true)
    try {
      const user = await createLearningUser({
        name: newUser.name.trim(),
        role_id: newUser.role_id || null,
        manager_id: newUser.manager_id || null,
      })
      // Keep form open with cleared name/role so user can immediately add more
      // users and pick the newly added person as a manager
      setUsers(prev => [...prev, user].sort((a, b) => a.name.localeCompare(b.name)))
      setNewUser(prev => ({ name: '', role_id: null, manager_id: prev.manager_id }))
      toast.success(`${user.name} added! You can now assign them as a manager below.`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add user')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (user) => {
    setEditingId(user.id)
    setEditUser({ role_id: user.role_id || null, manager_id: user.manager_id || null })
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

  const inlineSelectStyles = {
    ...selectStyles,
    control: (base, { isFocused }) => ({
      ...selectStyles.control(base, { isFocused }),
      minHeight: '34px',
      fontSize: '13px',
    }),
    singleValue: (base) => ({ ...base, color: '#c5c1b9', fontSize: '13px' }),
    placeholder: (base) => ({ ...base, color: '#8a8680', fontSize: '13px' }),
    option: (base, state) => ({ ...selectStyles.option(base, state), fontSize: '13px' }),
  }

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
        <div className="rounded-xl p-5 mb-5 border" style={{ backgroundColor: 'rgba(87,94,207,0.06)', borderColor: 'rgba(87,94,207,0.2)' }}>
          <p className="text-sm font-semibold text-[#c5c1b9] mb-1">
            New User — joined week will be set to <span style={{ color: '#575ECF' }}>{weekLabel(currentWeek)}</span>
          </p>
          {users.filter(u => u.active).length === 0 && (
            <div className="flex items-center gap-2 mb-4 text-xs rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)', color: '#fbbf24' }}>
              <span>💡</span>
              <span>Tip: Add the manager first (no manager needed), then add team members and assign the manager.</span>
            </div>
          )}
          {users.filter(u => u.active).length > 0 && <div className="mb-4" />}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={labelClass}>Name *</label>
              <input
                type="text"
                placeholder="Full name"
                value={newUser.name}
                onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                className={inputClass}
                autoFocus
              />
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <Select
                options={roleOptions}
                value={roleOptions.find(o => o.value === newUser.role_id) || roleOptions[0]}
                onChange={opt => setNewUser(p => ({ ...p, role_id: opt ? opt.value : null }))}
                styles={selectStyles}
                isSearchable={false}
              />
            </div>
            <div>
              <label className={labelClass}>Manager</label>
              {users.filter(u => u.active).length === 0 ? (
                <div
                  className="w-full rounded-lg px-3 py-2.5 text-sm border flex items-center gap-2"
                  style={{ backgroundColor: '#1b1b1b', borderColor: 'rgba(255,255,255,0.06)', color: '#8a8680' }}
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs italic">Add a user first, then assign as manager</span>
                </div>
              ) : (
                <Select
                  options={managerOptions(null)}
                  value={managerOptions(null).find(o => o.value === newUser.manager_id) || managerOptions(null)[0]}
                  onChange={opt => setNewUser(p => ({ ...p, manager_id: opt ? opt.value : null }))}
                  styles={selectStyles}
                  isSearchable={false}
                />
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowAddForm(false); setNewUser({ name: '', role_id: null, manager_id: null }) }}
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
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#6B72D8' }}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#575ECF'}
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
                  <td className="px-4 py-3" style={{ minWidth: '170px' }}>
                    {editingId === user.id ? (
                      <Select
                        options={roleOptions}
                        value={roleOptions.find(o => o.value === editUser.role_id) || roleOptions[0]}
                        onChange={opt => setEditUser(p => ({ ...p, role_id: opt ? opt.value : null }))}
                        styles={inlineSelectStyles}
                        isSearchable={false}
                        menuPosition="fixed"
                      />
                    ) : (
                      <span className="text-[#8a8680]">{user.role_name || <span className="italic opacity-50">None</span>}</span>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ minWidth: '200px' }}>
                    {editingId === user.id ? (
                      <Select
                        options={managerOptions(user.id)}
                        value={managerOptions(user.id).find(o => o.value === editUser.manager_id) || managerOptions(user.id)[0]}
                        onChange={opt => setEditUser(p => ({ ...p, manager_id: opt ? opt.value : null }))}
                        styles={inlineSelectStyles}
                        isSearchable={false}
                        menuPosition="fixed"
                      />
                    ) : (
                      <span className="text-[#8a8680]">{user.manager_name || <span className="italic opacity-50">None</span>}</span>
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

// ── Main Page — owns shared roles + users state ───────────────────────────────
export default function LearningAdmin() {
  const [roles, setRoles] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getLearningUsers(), getRoles()])
      .then(([u, r]) => {
        setUsers(u)
        setRoles(r)
        setLoading(false)
      })
      .catch(() => {
        toast.error('Failed to load data')
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-3 mb-8">
          <Link to="/learning" className="text-sm text-[#8a8680] hover:text-[#c5c1b9] transition-colors">← Learning</Link>
          <span className="text-[#8a8680]">/</span>
          <span className="text-sm text-[#c5c1b9] font-medium">Admin</span>
        </div>

        <div className="mb-7">
          <h1 className="text-2xl font-bold text-[#c5c1b9]">Learning Tracker Admin</h1>
          <p className="text-[#8a8680] text-sm mt-1">Manage settings, roles, and users for the weekly learning tracker</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <svg className="w-8 h-8 animate-spin text-[#575ECF]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <div className="space-y-6">
            <SettingsSection />
            {/* Roles and Users share the same roles/users state so dropdowns stay in sync */}
            <RolesSection roles={roles} setRoles={setRoles} />
            <UsersSection roles={roles} users={users} setUsers={setUsers} />
          </div>
        )}
      </div>
    </div>
  )
}
