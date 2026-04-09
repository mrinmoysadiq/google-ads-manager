import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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

// ── Topics Section (Admin Kanban) ─────────────────────────────────────────────
const STAGE_COLORS = {
  'Assigned': '#8a8680', 'In Progress': '#575ECF', 'Notes Submitted': '#f59e0b',
  'Assessed': '#3b82f6', 'Needs Revision': '#ef4444', 'Completed': '#22c55e',
}

function formatDate(str) {
  if (!str) return ''
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isOverdue(topic) {
  if (!topic.due_date || topic.stage === 'Completed') return false
  return topic.due_date < new Date().toISOString().split('T')[0]
}

function AdminTopicCard({ topic, onDragStart }) {
  const overdue = isOverdue(topic)
  return (
    <Link
      to={`/learning/topic/${topic.id}`}
      draggable
      onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData('topic_id', topic.id); e.dataTransfer.setData('from_stage', topic.stage); onDragStart && onDragStart() }}
      onClick={e => e.stopPropagation()}
      className="group block rounded-xl p-3.5 cursor-grab active:cursor-grabbing transition-all duration-150 select-none"
      style={{ backgroundColor: '#252525', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }}
    >
      <p className="text-[13px] font-semibold leading-snug text-[#d4cfc7] group-hover:text-white line-clamp-2 mb-2.5">
        {topic.title}
      </p>
      {topic.assignee_name && (
        <div className="flex items-center gap-1.5 mb-2">
          <svg className="w-3 h-3 text-[#8a8680] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-[11px] text-[#8a8680] truncate">{topic.assignee_name}</span>
        </div>
      )}
      <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {topic.comment_count > 0 ? (
          <span className="text-[11px] text-[#8a8680]">💬 {topic.comment_count}</span>
        ) : <span />}
        {topic.due_date ? (
          <span className="text-[11px] font-medium" style={{ color: overdue ? '#f87171' : '#6b7280' }}>
            {formatDate(topic.due_date)}{overdue && ' ⚠'}
          </span>
        ) : <span className="text-[11px] text-[#8a8680]/30">No deadline</span>}
      </div>
    </Link>
  )
}

function AdminKanbanColumn({ stage, color, topics, onDrop }) {
  const [dragOver, setDragOver] = useState(false)
  return (
    <div
      className="flex-shrink-0 w-60 flex flex-col rounded-2xl"
      style={{
        backgroundColor: '#1a1a1a',
        border: dragOver ? `1.5px dashed ${color}70` : '1.5px solid rgba(255,255,255,0.05)',
        boxShadow: dragOver ? `0 0 0 3px ${color}15` : 'none',
        transition: 'all 0.15s',
      }}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { setDragOver(false); onDrop(e, stage) }}
    >
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[13px] font-semibold" style={{ color }}>{stage}</span>
        </div>
        <span className="text-xs font-semibold text-[#8a8680] bg-white/6 rounded-full px-2 py-0.5 min-w-[22px] text-center">{topics.length}</span>
      </div>
      <div className="flex-1 p-3 space-y-2 min-h-[100px] rounded-b-2xl" style={{ backgroundColor: dragOver ? `${color}06` : 'transparent' }}>
        {topics.map(t => <AdminTopicCard key={t.id} topic={t} />)}
        {topics.length === 0 && (
          <div className="flex items-center justify-center h-14 rounded-xl" style={{ border: '1px dashed rgba(255,255,255,0.06)' }}>
            <p className="text-[11px] text-[#8a8680]/50">Drop here</p>
          </div>
        )}
      </div>
    </div>
  )
}

function AdminNewTopicModal({ users, onCreated, onClose }) {
  const [form, setForm] = useState({ title: '', description: '', due_date: '', assignee_id: '' })
  const [saving, setSaving] = useState(false)
  const inp = 'w-full bg-[#1b1b1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#c5c1b9] outline-none focus:border-[#575ECF] placeholder-[#8a8680]'
  const userOpts = users.map(u => ({ value: u.id, label: u.name }))

  async function submit() {
    if (!form.title.trim()) return toast.error('Title required')
    if (!form.assignee_id) return toast.error('Select an assignee')
    setSaving(true)
    try {
      await api.post('/lms/topics', {
        title: form.title.trim(),
        description: form.description,
        assignee_id: form.assignee_id,
        due_date: form.due_date || null,
      })
      toast.success('Topic created!')
      onCreated()
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error creating topic')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#242424] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-bold text-[#c5c1b9] mb-4">New Topic</h3>
        <div className="space-y-3">
          <input className={inp} placeholder="Topic title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
          <textarea className={inp + ' resize-none h-20'} placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div>
            <p className="text-xs text-[#8a8680] mb-1">Assign to *</p>
            <Select
              options={userOpts}
              onChange={opt => setForm(f => ({ ...f, assignee_id: opt?.value || '' }))}
              placeholder="Select team member…"
              styles={selectStyles}
            />
          </div>
          <div>
            <p className="text-xs text-[#8a8680] mb-1">Due Date (optional)</p>
            <input className={inp} type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={submit} disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: '#575ECF' }}>
              {saving ? 'Creating…' : 'Create Topic'}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm text-[#8a8680] bg-white/8">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TopicsSection() {
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null) // null = All
  const [topics, setTopics] = useState([])
  const [stages, setStages] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewTopic, setShowNewTopic] = useState(false)

  useEffect(() => {
    Promise.all([api.get('/lms/users'), api.get('/lms/stages')])
      .then(([u, s]) => {
        setUsers(u.data.filter(x => x.active))
        setStages(s.data.filter(x => x.active))
      })
  }, [])

  useEffect(() => { fetchTopics() }, [selectedUser]) // eslint-disable-line

  async function fetchTopics() {
    setLoading(true)
    try {
      const url = selectedUser ? `/lms/topics?assignee_id=${selectedUser}` : '/lms/topics'
      const { data } = await api.get(url)
      setTopics(data)
    } catch { toast.error('Failed to load topics') }
    setLoading(false)
  }

  const stageList = stages.length > 0 ? stages : Object.keys(STAGE_COLORS).map(name => ({ name, color: STAGE_COLORS[name] }))

  function getColor(name) {
    const found = stages.find(s => s.name === name)
    return found?.color || STAGE_COLORS[name] || '#8a8680'
  }

  async function handleDrop(e, targetStage) {
    const topicId = e.dataTransfer.getData('topic_id')
    if (!topicId) return
    try {
      await api.patch(`/lms/topics/${topicId}/stage`, { new_stage: targetStage, role: 'admin' })
      setTopics(prev => prev.map(t => String(t.id) === String(topicId) ? { ...t, stage: targetStage } : t))
      toast.success(`Moved to ${targetStage}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error moving topic')
    }
  }

  const userOptions = [
    { value: null, label: 'All Users' },
    ...users.map(u => ({ value: u.id, label: u.name })),
  ]

  const selectedOpt = userOptions.find(o => o.value === selectedUser) || userOptions[0]
  const topicCount = topics.length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-[#c5c1b9]">Learning Topics</h2>
          <p className="text-xs text-[#8a8680] mt-0.5">{topicCount} topic{topicCount !== 1 ? 's' : ''}{selectedUser ? ` for ${selectedOpt?.label}` : ' across all users'}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* User filter dropdown */}
          <div style={{ width: 200 }}>
            <Select
              options={userOptions}
              value={selectedOpt}
              onChange={opt => setSelectedUser(opt?.value ?? null)}
              styles={{
                ...selectStyles,
                control: (b, s) => ({ ...selectStyles.control(b, s), minHeight: '36px' }),
              }}
              isSearchable={false}
            />
          </div>
          <button
            onClick={() => setShowNewTopic(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#575ECF' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            New Topic
          </button>
        </div>
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="w-6 h-6 animate-spin text-[#575ECF]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4 -mx-4 px-4">
          <div className="flex gap-3 min-w-max">
            {stageList.map(s => (
              <AdminKanbanColumn
                key={s.name}
                stage={s.name}
                color={getColor(s.name)}
                topics={topics.filter(t => t.stage === s.name)}
                onDrop={handleDrop}
              />
            ))}
          </div>
          {topics.length === 0 && !loading && (
            <div className="text-center py-16">
              <p className="text-[#8a8680] text-sm">No topics found{selectedUser ? ' for this user' : ''}.</p>
            </div>
          )}
        </div>
      )}

      {showNewTopic && (
        <AdminNewTopicModal
          users={users}
          onCreated={fetchTopics}
          onClose={() => setShowNewTopic(false)}
        />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LmsAdmin() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('topics')

  useEffect(() => {
    const role = localStorage.getItem('lms_user_role')
    if (role !== 'admin') navigate('/learning')
  }, [])

  const tabs = [
    { id: 'topics', label: 'Topics' },
    { id: 'users', label: 'Users' },
    { id: 'templates', label: 'Template Library' },
    { id: 'stages', label: 'Pipeline Stages' },
  ]

  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <div className="max-w-7xl mx-auto px-4 py-8">
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

        {activeTab === 'topics' && <TopicsSection />}
        {activeTab === 'users' && <UsersSection />}
        {activeTab === 'templates' && <TemplatesSection />}
        {activeTab === 'stages' && <PipelineStagesSection />}
      </div>
    </div>
  )
}
