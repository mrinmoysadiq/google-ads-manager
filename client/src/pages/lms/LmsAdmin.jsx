import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/lmsApi'
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
    const { data } = await api.get('/lms/users/all')
    setUsers(data)
  }

  async function addUser() {
    if (!newName.trim()) return
    try {
      await api.post('/lms/users', { name: newName.trim(), role: newRole.value })
      setNewName('')
      fetchUsers()
      toast.success('User added')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error adding user')
    }
  }

  async function saveEdit(id) {
    try {
      await api.patch(`/lms/users/${id}`, { name: editName.trim(), role: editRole.value })
      setEditId(null)
      fetchUsers()
      toast.success('User updated')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error updating user')
    }
  }

  async function toggleActive(user) {
    try {
      await api.patch(`/lms/users/${user.id}`, { active: user.active ? 0 : 1 })
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
    const { data } = await api.get('/lms/templates')
    setTemplates(data)
  }

  function resetForm() { setForm({ title: '', description: '', resources: [], suggested_days: '' }) }

  async function saveTemplate() {
    if (!form.title.trim()) return toast.error('Title required')
    try {
      if (editId) {
        await api.patch(`/lms/templates/${editId}`, { ...form, suggested_days: form.suggested_days ? Number(form.suggested_days) : null })
        toast.success('Template updated')
      } else {
        await api.post('/lms/templates', { ...form, suggested_days: form.suggested_days ? Number(form.suggested_days) : null })
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
    await api.delete(`/lms/templates/${id}`)
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

// ── Pipeline Stages Section ───────────────────────────────────────────────────
const COLOR_PRESETS = ['#8a8680', '#575ECF', '#f59e0b', '#3b82f6', '#ef4444', '#22c55e', '#14b8a6', '#a855f7', '#f97316', '#ec4899']

function PipelineStagesSection() {
  const [stages, setStages] = useState([])
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#8a8680')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

  useEffect(() => { fetchStages() }, [])
  async function fetchStages() {
    const { data } = await api.get('/lms/stages')
    setStages(data)
  }

  async function addStage() {
    if (!newName.trim()) return
    try {
      await api.post('/lms/stages', { name: newName.trim(), color: newColor })
      setNewName('')
      setNewColor('#8a8680')
      fetchStages()
      toast.success('Stage added')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error adding stage')
    }
  }

  async function saveEdit(id) {
    try {
      await api.patch(`/lms/stages/${id}`, { name: editName.trim(), color: editColor })
      setEditId(null)
      fetchStages()
      toast.success('Stage updated')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error updating stage')
    }
  }

  async function moveStage(id, direction) {
    const idx = stages.findIndex(s => s.id === id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= stages.length) return
    const current = stages[idx]
    const swap = stages[swapIdx]
    await Promise.all([
      api.patch(`/lms/stages/${current.id}`, { order_index: swap.order_index }),
      api.patch(`/lms/stages/${swap.id}`, { order_index: current.order_index }),
    ])
    fetchStages()
  }

  async function deleteStage(id) {
    if (!confirm('Delete this stage? This cannot be undone.')) return
    try {
      await api.delete(`/lms/stages/${id}`)
      fetchStages()
      toast.success('Stage deleted')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error deleting stage')
    }
  }

  async function toggleActive(stage) {
    await api.patch(`/lms/stages/${stage.id}`, { active: stage.active ? 0 : 1 })
    fetchStages()
  }

  function ColorPicker({ value, onChange }) {
    return (
      <div className="flex gap-1.5 flex-wrap">
        {COLOR_PRESETS.map(c => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
            style={{ backgroundColor: c, borderColor: value === c ? '#fff' : 'transparent' }}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#c5c1b9] mb-4">Pipeline Stages</h2>
      <p className="text-xs text-[#8a8680] mb-4">Stages appear as kanban columns. Drag order is determined by the order here.</p>

      {/* Add stage */}
      <div className="bg-[#242424] border border-white/8 rounded-xl p-4 mb-4">
        <p className="text-sm text-[#8a8680] mb-3">Add new stage</p>
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[160px]">
            <input
              className={inputCls()}
              placeholder="Stage name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addStage()}
            />
          </div>
          <div>
            <p className="text-xs text-[#8a8680] mb-1">Color</p>
            <ColorPicker value={newColor} onChange={setNewColor} />
          </div>
          <button
            onClick={addStage}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white self-end"
            style={{ backgroundColor: '#575ECF' }}
          >
            Add Stage
          </button>
        </div>
      </div>

      {/* Stage list */}
      <div className="space-y-2">
        {stages.map((s, i) => (
          <div key={s.id} className="bg-[#242424] border border-white/8 rounded-xl p-4">
            {editId === s.id ? (
              <div className="space-y-3">
                <input className={inputCls()} value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
                <div>
                  <p className="text-xs text-[#8a8680] mb-1">Color</p>
                  <ColorPicker value={editColor} onChange={setEditColor} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(s.id)} className="text-xs px-3 py-1.5 rounded-lg bg-[#575ECF] text-white">Save</button>
                  <button onClick={() => setEditId(null)} className="text-xs px-3 py-1.5 rounded-lg bg-white/8 text-[#8a8680]">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {/* Color dot + name */}
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-sm font-medium text-[#c5c1b9] flex-1">{s.name}</span>
                {!s.active && <span className="text-xs text-[#8a8680]">Hidden</span>}

                {/* Actions */}
                <div className="flex gap-1.5 items-center">
                  <button onClick={() => moveStage(s.id, 'up')} disabled={i === 0} className="text-[#8a8680] hover:text-[#c5c1b9] disabled:opacity-30 px-1">↑</button>
                  <button onClick={() => moveStage(s.id, 'down')} disabled={i === stages.length - 1} className="text-[#8a8680] hover:text-[#c5c1b9] disabled:opacity-30 px-1">↓</button>
                  <button
                    onClick={() => { setEditId(s.id); setEditName(s.name); setEditColor(s.color) }}
                    className="text-xs px-2.5 py-1 rounded-lg bg-white/8 text-[#c5c1b9] hover:bg-white/12"
                  >Edit</button>
                  <button
                    onClick={() => toggleActive(s)}
                    className={`text-xs px-2.5 py-1 rounded-lg ${s.active ? 'bg-white/8 text-[#8a8680]' : 'bg-[#575ECF]/20 text-[#575ECF]'}`}
                  >{s.active ? 'Hide' : 'Show'}</button>
                  <button onClick={() => deleteStage(s.id)} className="text-xs px-2.5 py-1 rounded-lg bg-[#ef4444]/20 text-[#ef4444]">Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {stages.length === 0 && <p className="text-center py-8 text-[#8a8680] text-sm">No stages yet</p>}
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
    { id: 'stages', label: 'Pipeline Stages' },
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
        {activeTab === 'stages' && <PipelineStagesSection />}
      </div>
    </div>
  )
}
