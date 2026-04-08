import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import Select from 'react-select'

const ROLE_OPTIONS = [
  { value: 'employee', label: 'Employee' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
]

const selectStyles = {
  control: (b, s) => ({
    ...b,
    backgroundColor: '#1b1b1b',
    borderColor: s.isFocused ? '#575ECF' : 'rgba(255,255,255,0.12)',
    borderRadius: '8px',
    boxShadow: 'none',
    '&:hover': { borderColor: '#575ECF' },
    minHeight: '38px',
  }),
  menu: b => ({ ...b, backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }),
  option: (b, s) => ({ ...b, backgroundColor: s.isSelected ? '#575ECF' : s.isFocused ? 'rgba(87,94,207,0.15)' : 'transparent', color: '#c5c1b9', cursor: 'pointer' }),
  singleValue: b => ({ ...b, color: '#c5c1b9' }),
  input: b => ({ ...b, color: '#c5c1b9' }),
  placeholder: b => ({ ...b, color: '#8a8680' }),
}

function inputCls() {
  return 'w-full bg-[#1b1b1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#c5c1b9] outline-none focus:border-[#575ECF] placeholder-[#8a8680]'
}

// ── Users Section ─────────────────────────────────────────────────────────────
function UsersSection() {
  const [users, setUsers] = useState([])
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState(ROLE_OPTIONS[0])
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState(null)

  useEffect(() => { fetchUsers() }, [])
  async function fetchUsers() {
    const { data } = await axios.get('/api/lms/users/all')
    setUsers(data)
  }

  async function addUser() {
    if (!newName.trim()) return
    try {
      await axios.post('/api/lms/users', { name: newName.trim(), role: newRole.value })
      setNewName('')
      fetchUsers()
      toast.success('User added')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error adding user')
    }
  }

  async function saveEdit(id) {
    try {
      await axios.patch(`/api/lms/users/${id}`, { name: editName.trim(), role: editRole.value })
      setEditId(null)
      fetchUsers()
      toast.success('User updated')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error updating user')
    }
  }

  async function toggleActive(user) {
    try {
      await axios.patch(`/api/lms/users/${user.id}`, { active: user.active ? 0 : 1 })
      fetchUsers()
      toast.success(user.active ? 'User deactivated' : 'User activated')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Cannot deactivate user with active topics')
    }
  }

  const roleBadge = role => {
    const colors = { employee: '#575ECF', manager: '#f59e0b', admin: '#22c55e' }
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${colors[role]}20`, color: colors[role] }}>
        {role}
      </span>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#c5c1b9] mb-4">Users</h2>

      {/* Add user */}
      <div className="bg-[#242424] border border-white/8 rounded-xl p-4 mb-4">
        <p className="text-sm text-[#8a8680] mb-3">Add new user</p>
        <div className="flex gap-2 flex-wrap">
          <input
            className={inputCls() + ' flex-1 min-w-[160px]'}
            placeholder="Full name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addUser()}
          />
          <div className="w-40">
            <Select
              options={ROLE_OPTIONS}
              value={newRole}
              onChange={setNewRole}
              styles={selectStyles}
              isSearchable={false}
            />
          </div>
          <button
            onClick={addUser}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#575ECF' }}
          >
            Add User
          </button>
        </div>
      </div>

      {/* User list */}
      <div className="bg-[#242424] border border-white/8 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8">
              <th className="text-left px-4 py-3 text-[#8a8680] font-medium">Name</th>
              <th className="text-left px-4 py-3 text-[#8a8680] font-medium">Role</th>
              <th className="text-left px-4 py-3 text-[#8a8680] font-medium">Status</th>
              <th className="text-right px-4 py-3 text-[#8a8680] font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-white/5 hover:bg-white/2">
                <td className="px-4 py-3">
                  {editId === u.id ? (
                    <input
                      className={inputCls()}
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <span className="text-[#c5c1b9]">{u.name}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editId === u.id ? (
                    <div className="w-36">
                      <Select options={ROLE_OPTIONS} value={editRole} onChange={setEditRole} styles={selectStyles} isSearchable={false} />
                    </div>
                  ) : roleBadge(u.role)}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${u.active ? 'text-[#22c55e]' : 'text-[#8a8680]'}`}>
                    {u.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    {editId === u.id ? (
                      <>
                        <button onClick={() => saveEdit(u.id)} className="text-xs px-3 py-1 rounded-lg bg-[#575ECF] text-white">Save</button>
                        <button onClick={() => setEditId(null)} className="text-xs px-3 py-1 rounded-lg bg-white/8 text-[#8a8680]">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditId(u.id); setEditName(u.name); setEditRole(ROLE_OPTIONS.find(r => r.value === u.role)) }}
                          className="text-xs px-3 py-1 rounded-lg bg-white/8 text-[#c5c1b9] hover:bg-white/12"
                        >Edit</button>
                        <button
                          onClick={() => toggleActive(u)}
                          className={`text-xs px-3 py-1 rounded-lg ${u.active ? 'bg-[#ef4444]/20 text-[#ef4444]' : 'bg-[#22c55e]/20 text-[#22c55e]'}`}
                        >
                          {u.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="text-center py-8 text-[#8a8680] text-sm">No users yet</p>
        )}
      </div>
    </div>
  )
}

// ── Template Section ──────────────────────────────────────────────────────────
function TemplatesSection() {
  const [templates, setTemplates] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', resources: [], suggested_days: '' })

  useEffect(() => { fetchTemplates() }, [])
  async function fetchTemplates() {
    const { data } = await axios.get('/api/lms/templates')
    setTemplates(data)
  }

  function resetForm() { setForm({ title: '', description: '', resources: [], suggested_days: '' }) }

  async function saveTemplate() {
    if (!form.title.trim()) return toast.error('Title required')
    try {
      if (editId) {
        await axios.patch(`/api/lms/templates/${editId}`, { ...form, suggested_days: form.suggested_days ? Number(form.suggested_days) : null })
        toast.success('Template updated')
      } else {
        await axios.post('/api/lms/templates', { ...form, suggested_days: form.suggested_days ? Number(form.suggested_days) : null })
        toast.success('Template created')
      }
      setShowForm(false)
      setEditId(null)
      resetForm()
      fetchTemplates()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error saving template')
    }
  }

  async function deleteTemplate(id) {
    if (!confirm('Delete this template?')) return
    await axios.delete(`/api/lms/templates/${id}`)
    fetchTemplates()
    toast.success('Template deleted')
  }

  function addResource() { setForm(f => ({ ...f, resources: [...f.resources, { label: '', url: '' }] })) }
  function updateResource(i, field, val) {
    setForm(f => {
      const res = [...f.resources]
      res[i] = { ...res[i], [field]: val }
      return { ...f, resources: res }
    })
  }
  function removeResource(i) { setForm(f => ({ ...f, resources: f.resources.filter((_, j) => j !== i) })) }

  function startEdit(t) {
    setForm({ title: t.title, description: t.description || '', resources: t.resources || [], suggested_days: t.suggested_days || '' })
    setEditId(t.id)
    setShowForm(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#c5c1b9]">Topic Template Library</h2>
        <button
          onClick={() => { resetForm(); setEditId(null); setShowForm(true) }}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#575ECF' }}
        >
          + New Template
        </button>
      </div>

      {showForm && (
        <div className="bg-[#242424] border border-white/8 rounded-xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-[#c5c1b9] mb-4">{editId ? 'Edit Template' : 'New Template'}</h3>
          <div className="space-y-3">
            <input
              className={inputCls()}
              placeholder="Template title *"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
            <textarea
              className={inputCls() + ' resize-none h-20'}
              placeholder="Description (optional)"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
            <input
              className={inputCls()}
              type="number"
              placeholder="Suggested days to complete"
              value={form.suggested_days}
              onChange={e => setForm(f => ({ ...f, suggested_days: e.target.value }))}
            />

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-[#8a8680]">Resources</p>
                <button onClick={addResource} className="text-xs text-[#575ECF] hover:text-[#6B72D8]">+ Add Resource</button>
              </div>
              <div className="space-y-2">
                {form.resources.map((r, i) => (
                  <div key={i} className="flex gap-2">
                    <input className={inputCls() + ' flex-1'} placeholder="Label" value={r.label} onChange={e => updateResource(i, 'label', e.target.value)} />
                    <input className={inputCls() + ' flex-1'} placeholder="URL" value={r.url} onChange={e => updateResource(i, 'url', e.target.value)} />
                    <button onClick={() => removeResource(i)} className="text-[#ef4444] text-sm px-2">✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={saveTemplate} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#575ECF' }}>
                {editId ? 'Update Template' : 'Create Template'}
              </button>
              <button onClick={() => { setShowForm(false); setEditId(null); resetForm() }} className="px-4 py-2 rounded-lg text-sm text-[#8a8680] bg-white/8">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {templates.map(t => (
          <div key={t.id} className="bg-[#242424] border border-white/8 rounded-xl p-4 flex gap-4 items-start">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-[#c5c1b9] text-sm">{t.title}</h3>
                {t.suggested_days && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/8 text-[#8a8680]">{t.suggested_days}d</span>
                )}
              </div>
              {t.description && <p className="text-xs text-[#8a8680] mb-2 line-clamp-2">{t.description}</p>}
              {t.resources && t.resources.length > 0 && (
                <p className="text-xs text-[#575ECF]">{t.resources.length} resource{t.resources.length > 1 ? 's' : ''}</p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => startEdit(t)} className="text-xs px-3 py-1.5 rounded-lg bg-white/8 text-[#c5c1b9] hover:bg-white/12">Edit</button>
              <button onClick={() => deleteTemplate(t.id)} className="text-xs px-3 py-1.5 rounded-lg bg-[#ef4444]/20 text-[#ef4444]">Delete</button>
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <p className="text-center py-8 text-[#8a8680] text-sm">No templates yet. Create one to speed up topic assignments.</p>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LmsAdmin() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('users')

  useEffect(() => {
    const role = localStorage.getItem('lms_user_role')
    if (role !== 'admin') navigate('/learning')
  }, [])

  const tabs = [
    { id: 'users', label: 'Users' },
    { id: 'templates', label: 'Template Library' },
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#c5c1b9]">LMS Admin Panel</h1>
          <button onClick={() => navigate('/learning')} className="text-sm text-[#8a8680] hover:text-[#c5c1b9]">
            ← Back
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[#242424] border border-white/8 rounded-lg p-1 w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
              style={{
                backgroundColor: activeTab === t.id ? '#575ECF' : 'transparent',
                color: activeTab === t.id ? '#fff' : '#8a8680',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'users' && <UsersSection />}
        {activeTab === 'templates' && <TemplatesSection />}
        {activeTab === 'settings' && (
          <div className="bg-[#242424] border border-white/8 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-[#c5c1b9] mb-3">Pipeline Stages</h2>
            <p className="text-sm text-[#8a8680] mb-4">Learning pipeline stages are fixed and cannot be modified.</p>
            <div className="flex flex-wrap gap-2">
              {['Assigned', 'In Progress', 'Notes Submitted', 'Assessed', 'Needs Revision', 'Completed'].map((s, i, arr) => (
                <div key={s} className="flex items-center gap-2">
                  <span className="text-sm px-3 py-1.5 rounded-full border border-white/12 text-[#c5c1b9]">{s}</span>
                  {i < arr.length - 1 && <span className="text-[#8a8680]">→</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
