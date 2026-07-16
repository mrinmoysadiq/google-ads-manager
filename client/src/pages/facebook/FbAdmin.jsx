import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { fmtDate } from '../../utils/dates'

const fb = {
  get: (path, cfg) => api.get(`/facebook${path}`, cfg),
  post: (path, data) => api.post(`/facebook${path}`, data),
  patch: (path, data) => api.patch(`/facebook${path}`, data),
  delete: (path, data) => api.delete(`/facebook${path}`, { data }),
}

const inputClass = 'w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#575ECF] transition-colors'
const s = { background: '#1b1b1b', border: '1px solid rgba(255,255,255,0.08)', color: '#c5c1b9', borderRadius: 8, padding: '6px 10px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }
const inputStyle = { width: '100%', background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 12px', color: '#c5c1b9', fontSize: 14, boxSizing: 'border-box' }
const labelStyle = { color: '#8a8680', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6, letterSpacing: '0.05em' }
const smallBtn = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 10px', color: '#c5c1b9', cursor: 'pointer', fontSize: 12 }

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text', icon: 'T' },
  { value: 'textarea', label: 'Long Text', icon: '¶' },
  { value: 'number', label: 'Number', icon: '#' },
  { value: 'currency', label: 'Currency', icon: '$' },
  { value: 'url', label: 'URL / Link', icon: '🔗' },
  { value: 'date', label: 'Date', icon: '📅' },
  { value: 'checkbox', label: 'Checkbox (Yes/No)', icon: '✓' },
  { value: 'tags', label: 'Tags (multi-select)', icon: '🏷' },
]

const CURRENCIES = [
  { code: 'USD', symbol: '$',    label: 'USD — US Dollar' },
  { code: 'EUR', symbol: '€',    label: 'EUR — Euro' },
  { code: 'GBP', symbol: '£',    label: 'GBP — British Pound' },
  { code: 'AED', symbol: 'AED ', label: 'AED — UAE Dirham' },
  { code: 'CAD', symbol: 'CA$',  label: 'CAD — Canadian Dollar' },
  { code: 'AUD', symbol: 'A$',   label: 'AUD — Australian Dollar' },
]

const BUILTIN_COLS = [
  { key: '__last_audit__', label: 'Last Audit', icon: '📅' },
  { key: '__7d_cpl__',    label: '7D CPL',     icon: '📊' },
  { key: '__3d_cpl__',   label: '3D CPL',     icon: '📊' },
  { key: '__notes__',    label: 'Notes',      icon: '📝' },
]

function parseCurrency(raw) {
  if (!raw) return { currency: 'USD', amount: '' }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return { currency: parsed.currency || 'USD', amount: parsed.amount ?? '' }
  } catch { /* legacy plain number */ }
  return { currency: 'USD', amount: raw }
}

function Spinner() {
  return <svg className="animate-spin h-5 w-5 text-[#575ECF]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
}

function AdminCard({ id, title, subtitle, children }) {
  return (
    <div id={id} className="bg-[#242424] border border-white/[0.08] rounded-xl p-6 scroll-mt-6">
      <h2 className="text-base font-semibold text-[#c5c1b9] mb-1">{title}</h2>
      {subtitle && <p className="text-xs text-[#8a8680] mb-5">{subtitle}</p>}
      {children}
    </div>
  )
}

// ─── Field input component (for custom account field values) ────────────────
function FieldInput({ field, value, onChange }) {
  const { field_type, label, options = [] } = field

  if (field_type === 'checkbox') {
    const checked = value === '1' || value === 'true'
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked ? '1' : '0')} style={{ accentColor: '#575ECF', width: 16, height: 16 }} />
        <span style={{ color: '#c5c1b9', fontSize: 14 }}>{checked ? 'Yes' : 'No'}</span>
      </label>
    )
  }
  if (field_type === 'tags') {
    const selected = (() => { try { return JSON.parse(value || '[]') } catch { return [] } })()
    const toggle = tag => {
      const next = selected.includes(tag) ? selected.filter(t => t !== tag) : [...selected, tag]
      onChange(JSON.stringify(next))
    }
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map(tag => (
          <button key={tag} onClick={() => toggle(tag)} style={{ background: selected.includes(tag) ? 'rgba(87,94,207,0.3)' : 'rgba(255,255,255,0.05)', border: `1px solid ${selected.includes(tag) ? '#575ECF' : 'rgba(255,255,255,0.1)'}`, color: selected.includes(tag) ? '#a5aaee' : '#8a8680', borderRadius: 20, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
            {tag}
          </button>
        ))}
        {options.length === 0 && <span style={{ color: '#8a8680', fontSize: 13 }}>No tag options defined — add them above.</span>}
      </div>
    )
  }
  if (field_type === 'textarea') {
    return <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={3} placeholder={`Enter ${label}…`} style={inputStyle} />
  }
  if (field_type === 'date') {
    return <input type="date" value={value || ''} onChange={e => onChange(e.target.value)} style={inputStyle} />
  }
  if (field_type === 'currency') {
    const { currency, amount } = parseCurrency(value)
    const update = (c, a) => onChange(JSON.stringify({ currency: c, amount: a }))
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={currency} onChange={e => update(e.target.value, amount)}
          style={{ background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 10px', color: '#c5c1b9', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <input type="number" value={amount} onChange={e => update(currency, e.target.value)}
          placeholder="0.00" style={{ ...inputStyle, flex: 1 }} />
      </div>
    )
  }
  return (
    <input
      type={field_type === 'number' ? 'number' : field_type === 'url' ? 'url' : 'text'}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={field_type === 'url' ? 'https://' : `Enter ${label}…`}
      style={inputStyle}
    />
  )
}

// ── Simple name-only entity section (buyers) ──────────────────────────────────
function EntitySection({ title, subtitle, items, setItems, endpoint }) {
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')

  const handleAdd = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const { data } = await fb.post(endpoint, { name: newName.trim() })
      setItems(prev => [...prev, data])
      setNewName('')
      toast.success(`${title.slice(0, -1)} added`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add')
    } finally { setAdding(false) }
  }

  const handleToggle = async (item) => {
    try {
      const { data } = await fb.patch(`${endpoint}/${item.id}`, { active: item.active ? 0 : 1 })
      setItems(prev => prev.map(i => i.id === item.id ? data : i))
    } catch { toast.error('Failed to update') }
  }

  const handleEditSave = async (item) => {
    if (!editName.trim() || editName.trim() === item.name) { setEditId(null); return }
    try {
      const { data } = await fb.patch(`${endpoint}/${item.id}`, { name: editName.trim() })
      setItems(prev => prev.map(i => i.id === item.id ? data : i))
      setEditId(null)
      toast.success('Renamed')
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to rename') }
  }

  const handleDelete = async (item) => {
    const activeCount = items.filter(i => i.active).length
    if (item.active && activeCount <= 1) { toast.error('Cannot delete the only active entry'); return }
    try {
      await fb.delete(`${endpoint}/${item.id}`)
      setItems(prev => prev.filter(i => i.id !== item.id))
      toast.success('Deleted')
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to delete') }
  }

  return (
    <>
      <div className="flex gap-2 mb-5">
        <input className={inputClass} value={newName} onChange={e => setNewName(e.target.value)}
          placeholder={`New ${title.toLowerCase().slice(0, -1)} name…`}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }} />
        <button onClick={handleAdd} disabled={adding || !newName.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#575ECF] hover:bg-[#6B72D8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
          {adding ? <Spinner /> : 'Add'}
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-[#8a8680] text-center py-4">No entries yet</p>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {items.map(item => (
            <li key={item.id} className={`flex items-center gap-3 py-3 ${!item.active ? 'opacity-50' : ''}`}>
              <div className="flex-1 min-w-0">
                {editId === item.id ? (
                  <input autoFocus className={inputClass + ' py-1'} value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => handleEditSave(item)}
                    onKeyDown={e => { if (e.key === 'Enter') handleEditSave(item); if (e.key === 'Escape') setEditId(null) }} />
                ) : (
                  <span className="text-sm text-[#c5c1b9] cursor-pointer hover:text-white"
                    onClick={() => { setEditId(item.id); setEditName(item.name) }}
                    title="Click to rename">{item.name}</span>
                )}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.active ? 'bg-green-500/15 text-[#22c55e]' : 'bg-white/5 text-[#8a8680]'}`}>
                {item.active ? 'Active' : 'Inactive'}
              </span>
              <button onClick={() => handleToggle(item)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${item.active ? 'bg-[#575ECF]' : 'bg-white/10'}`}
                role="switch">
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${item.active ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
              <button onClick={() => handleDelete(item)}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30 transition-colors">
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

// ── Campaign Groups for one account ──────────────────────────────────────────
function CampaignGroupsPanel({ account }) {
  const [groups, setGroups] = useState(null)
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCpl, setNewCpl] = useState('')
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editCpl, setEditCpl] = useState('')

  const load = useCallback(async () => {
    const { data } = await fb.get(`/ad-accounts/${account.id}/campaign-groups`)
    setGroups(data)
  }, [account.id])

  const toggle = async () => {
    if (!open && groups === null) await load()
    setOpen(o => !o)
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const { data } = await fb.post(`/ad-accounts/${account.id}/campaign-groups`, {
        name: newName.trim(), target_cpl: newCpl ? parseFloat(newCpl) : null, sort_order: groups?.length ?? 0
      })
      setGroups(prev => [...prev, data])
      setNewName(''); setNewCpl('')
      toast.success('Campaign group added')
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add') }
    finally { setAdding(false) }
  }

  const handleEditSave = async (g) => {
    try {
      const { data } = await fb.patch(`/campaign-groups/${g.id}`, {
        name: editName.trim() || g.name,
        target_cpl: editCpl !== '' ? (editCpl ? parseFloat(editCpl) : null) : g.target_cpl,
      })
      setGroups(prev => prev.map(x => x.id === g.id ? data : x))
      setEditId(null)
      toast.success('Updated')
    } catch { toast.error('Failed to update') }
  }

  const handleDelete = async (g) => {
    if (!window.confirm(`Delete "${g.name}"?`)) return
    await fb.delete(`/campaign-groups/${g.id}`)
    setGroups(prev => prev.filter(x => x.id !== g.id))
    toast.success('Deleted')
  }

  const handleToggle = async (g) => {
    const { data } = await fb.patch(`/campaign-groups/${g.id}`, { active: g.active ? 0 : 1 })
    setGroups(prev => prev.map(x => x.id === g.id ? data : x))
  }

  return (
    <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
      <button onClick={toggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#575ECF', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
        <span>{open ? '▾' : '▸'}</span>
        Campaign Groups {groups !== null && groups.length > 0 ? `(${groups.length})` : ''}
        {groups === null && <span style={{ color: '#555', fontWeight: 400 }}>— click to manage</span>}
      </button>

      {open && (
        <div style={{ marginTop: 10, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ color: '#8a8680', fontSize: 11, marginBottom: 10 }}>
            Define named campaign groups with individual target CPLs. The daily checklist will collect per-group performance for this account.
          </p>

          {groups && groups.length > 0 && (
            <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {groups.map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#1b1b1b', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', opacity: g.active ? 1 : 0.5 }}>
                  {editId === g.id ? (
                    <>
                      <input autoFocus value={editName} onChange={e => setEditName(e.target.value)} placeholder="Group name" style={{ ...s, flex: 2 }} />
                      <input value={editCpl} onChange={e => setEditCpl(e.target.value)} placeholder="Target CPL" type="number" min="0" step="0.01" style={{ ...s, flex: 1 }} />
                      <button onClick={() => handleEditSave(g)} style={{ background: '#575ECF', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Save</button>
                      <button onClick={() => setEditId(null)} style={{ background: 'none', border: 'none', color: '#8a8680', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, color: '#c5c1b9', fontSize: 13 }}>{g.name}</span>
                      {g.target_cpl != null && <span style={{ fontSize: 11, color: '#8a8680', background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: '2px 6px' }}>Target: {g.target_cpl}</span>}
                      <button onClick={() => { setEditId(g.id); setEditName(g.name); setEditCpl(g.target_cpl != null ? String(g.target_cpl) : '') }} style={{ background: 'none', border: 'none', color: '#575ECF', fontSize: 11, cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => handleToggle(g)} style={{ background: 'none', border: 'none', color: '#8a8680', fontSize: 11, cursor: 'pointer' }}>{g.active ? 'Disable' : 'Enable'}</button>
                      <button onClick={() => handleDelete(g)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}>✕</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Campaign group name (e.g. Residential – Dubai)" style={{ ...s, flex: 2 }} onKeyDown={e => { if (e.key === 'Enter') handleAdd() }} />
            <input value={newCpl} onChange={e => setNewCpl(e.target.value)} placeholder="Target CPL" type="number" min="0" step="0.01" style={{ ...s, flex: 1 }} />
            <button onClick={handleAdd} disabled={adding || !newName.trim()} style={{ background: adding || !newName.trim() ? '#2a2a2a' : '#575ECF', border: 'none', borderRadius: 8, padding: '6px 14px', color: adding || !newName.trim() ? '#555' : '#fff', fontSize: 13, cursor: newName.trim() ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
              {adding ? '…' : '+ Add'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Ad Accounts (full CRUD: name, website, notes, custom fields) + nested campaign groups ──
function ManageAccounts({ accounts, fields, onSaved }) {
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  function openAdd() {
    setEditingId('new')
    setForm({ name: '', website: '', notes: '', custom_fields: {} })
  }

  function openEdit(a) {
    setEditingId(a.id)
    setForm({ name: a.name, website: a.website || '', notes: a.notes || '', custom_fields: a.custom_fields || {} })
  }

  function close() { setEditingId(null); setForm(null) }

  async function save() {
    if (!form?.name?.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      if (editingId === 'new') {
        await fb.post('/ad-accounts', form)
        toast.success('Account created')
      } else {
        await fb.patch(`/ad-accounts/${editingId}`, form)
        toast.success('Account updated')
      }
      onSaved()
      close()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save') }
    finally { setSaving(false) }
  }

  async function toggleActive(a) {
    try {
      await fb.patch(`/ad-accounts/${a.id}`, { active: a.active ? 0 : 1 })
      toast.success(a.active ? 'Deactivated' : 'Reactivated')
      onSaved()
    } catch { toast.error('Failed to update') }
  }

  async function del(a) {
    if (!confirm(`Move "${a.name}" to trash? You can restore it within 7 days.`)) return
    try {
      await fb.delete(`/ad-accounts/${a.id}`)
      toast.success('Moved to trash')
      onSaved()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to delete') }
  }

  const visible = accounts.filter(a => showInactive || a.active)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8a8680', fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} style={{ accentColor: '#575ECF' }} /> Show inactive
        </label>
        <button onClick={openAdd} style={{ background: '#575ECF', border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>+ Add Account</button>
      </div>

      {editingId && form && (
        <div style={{ background: '#1b1b1b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 20, marginBottom: 16 }}>
          <p style={{ color: '#c5c1b9', fontWeight: 600, margin: '0 0 16px' }}>{editingId === 'new' ? 'New Account' : 'Edit Account'}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>ACCOUNT NAME *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Acme Corp" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>WEBSITE</label>
              <input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://example.com" style={inputStyle} />
            </div>
            {fields.map(f => (
              <div key={f.id}>
                <label style={labelStyle}>{f.label.toUpperCase()}</label>
                <FieldInput field={f} value={form.custom_fields[f.field_key] || ''} onChange={val => setForm(p => ({ ...p, custom_fields: { ...p.custom_fields, [f.field_key]: val } }))} />
              </div>
            ))}
            <div>
              <label style={labelStyle}>NOTES</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Any notes…" style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={close} style={{ ...smallBtn, padding: '8px 16px', fontSize: 13 }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ background: '#575ECF', border: 'none', borderRadius: 8, padding: '8px 20px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              {saving ? 'Saving…' : editingId === 'new' ? 'Create' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <p style={{ color: '#8a8680', textAlign: 'center', padding: 20 }}>No accounts yet.</p>
      ) : visible.map(a => (
        <div key={a.id} style={{ background: '#2a2a2a', borderRadius: 8, marginBottom: 8, padding: '10px 14px', opacity: a.active ? 1 : 0.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ color: '#c5c1b9', fontWeight: 500 }}>{a.name}</span>
              {!a.active && <span style={{ color: '#8a8680', fontSize: 11, marginLeft: 8 }}>inactive</span>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => openEdit(a)} style={smallBtn}>Edit</button>
              <button onClick={() => toggleActive(a)} style={smallBtn}>{a.active ? 'Deactivate' : 'Activate'}</button>
              <button onClick={() => del(a)} style={{ ...smallBtn, color: '#ef4444', borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)' }}>Delete</button>
            </div>
          </div>
          <CampaignGroupsPanel account={a} />
        </div>
      ))}
    </div>
  )
}

// ── Custom account fields (label, type, options, pin, reorder) ────────────────
function ManageFields({ fields, onSaved }) {
  const [list, setList] = useState(fields)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ label: '', field_type: 'text', options: [], pinned: false })
  const [tagInput, setTagInput] = useState('')
  const dragIdx = useRef(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)

  useEffect(() => { setList(fields) }, [fields])

  function resetForm() { setForm({ label: '', field_type: 'text', options: [], pinned: false }); setTagInput(''); setAdding(false); setEditingId(null) }

  function startEdit(f) {
    setEditingId(f.id)
    setForm({ label: f.label, field_type: f.field_type, options: f.options || [], pinned: !!f.pinned })
    setAdding(true)
  }

  function addTag() {
    if (!tagInput.trim()) return
    if (!form.options.includes(tagInput.trim())) setForm(p => ({ ...p, options: [...p.options, tagInput.trim()] }))
    setTagInput('')
  }

  async function save() {
    if (!form.label.trim()) return
    try {
      if (editingId) {
        const res = await fb.patch(`/account-fields/${editingId}`, form)
        setList(prev => prev.map(f => f.id === editingId ? res.data : f))
        toast.success('Field updated')
      } else {
        const res = await fb.post('/account-fields', form)
        setList(prev => [...prev, res.data])
        toast.success('Field added')
      }
      onSaved()
      resetForm()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save field') }
  }

  async function del(f) {
    if (!confirm(`Delete field "${f.label}"? All stored values will be lost.`)) return
    try {
      await fb.delete(`/account-fields/${f.id}`)
      setList(prev => prev.filter(x => x.id !== f.id))
      toast.success('Field deleted')
      onSaved()
    } catch { toast.error('Failed to delete field') }
  }

  async function togglePinned(f) {
    try {
      const res = await fb.patch(`/account-fields/${f.id}`, { pinned: !f.pinned ? 1 : 0 })
      setList(prev => prev.map(x => x.id === f.id ? res.data : x))
      onSaved()
    } catch { toast.error('Failed to update field') }
  }

  async function move(idx, dir) {
    const next = [...list]
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= next.length) return
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    await persistOrder(next)
  }

  async function persistOrder(newList) {
    setList(newList)
    try {
      await fb.post('/account-fields/reorder', { order: newList.map((f, i) => ({ id: f.id, sort_order: i + 1 })) })
      onSaved()
    } catch { toast.error('Failed to save order') }
  }

  function onDragStart(idx) { dragIdx.current = idx }
  function onDragEnter(idx) { setDragOverIdx(idx) }
  function onDragEnd() {
    if (dragIdx.current !== null && dragOverIdx !== null && dragIdx.current !== dragOverIdx) {
      const next = [...list]
      const [moved] = next.splice(dragIdx.current, 1)
      next.splice(dragOverIdx, 0, moved)
      persistOrder(next)
    }
    dragIdx.current = null
    setDragOverIdx(null)
  }

  return (
    <div>
      {list.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {list.map((f, idx) => (
            <div key={f.id}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragEnter={() => onDragEnter(idx)}
              onDragOver={e => e.preventDefault()}
              onDragEnd={onDragEnd}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: dragOverIdx === idx ? 'rgba(87,94,207,0.12)' : '#2a2a2a', borderRadius: 8, marginBottom: 8, border: `1px solid ${dragOverIdx === idx ? 'rgba(87,94,207,0.4)' : 'transparent'}`, transition: 'background 0.12s, border-color 0.12s', cursor: 'grab' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#444', fontSize: 14, cursor: 'grab', userSelect: 'none', padding: '0 2px' }} title="Drag to reorder">⠿</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', color: idx === 0 ? '#333' : '#8a8680', cursor: idx === 0 ? 'default' : 'pointer', fontSize: 10, lineHeight: 1, padding: '1px 3px' }}>▲</button>
                  <button onClick={() => move(idx, 1)} disabled={idx === list.length - 1} style={{ background: 'none', border: 'none', color: idx === list.length - 1 ? '#333' : '#8a8680', cursor: idx === list.length - 1 ? 'default' : 'pointer', fontSize: 10, lineHeight: 1, padding: '1px 3px' }}>▼</button>
                </div>
                <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{FIELD_TYPES.find(t => t.value === f.field_type)?.icon}</span>
                <div>
                  <span style={{ color: '#c5c1b9', fontWeight: 500, fontSize: 14 }}>{f.label}</span>
                  <span style={{ color: '#8a8680', fontSize: 12, marginLeft: 8 }}>{FIELD_TYPES.find(t => t.value === f.field_type)?.label}</span>
                  {f.pinned ? <span style={{ color: '#575ECF', fontSize: 11, marginLeft: 8, fontWeight: 600 }}>📌 pinned</span> : null}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => togglePinned(f)} title={f.pinned ? 'Unpin from table' : 'Pin to table'} style={{ ...smallBtn, color: f.pinned ? '#575ECF' : '#8a8680' }}>📌</button>
                <button onClick={() => startEdit(f)} style={smallBtn}>Edit</button>
                <button onClick={() => del(f)} style={{ ...smallBtn, color: '#ef4444', borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!adding ? (
        <button onClick={() => setAdding(true)} style={{ width: '100%', background: 'rgba(87,94,207,0.1)', border: '1px dashed rgba(87,94,207,0.4)', borderRadius: 8, padding: '12px 0', color: '#575ECF', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          + Add New Field
        </button>
      ) : (
        <div style={{ background: '#1b1b1b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 20 }}>
          <p style={{ color: '#c5c1b9', fontWeight: 600, marginBottom: 16, margin: '0 0 16px' }}>{editingId ? 'Edit Field' : 'New Field'}</p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>FIELD LABEL</label>
              <input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Target CPL" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>FIELD TYPE</label>
              <select value={form.field_type} onChange={e => setForm(p => ({ ...p, field_type: e.target.value, options: [] }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
          </div>

          {form.field_type === 'tags' && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>TAG OPTIONS</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="Type a tag and press Enter" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={addTag} style={{ background: '#575ECF', border: 'none', borderRadius: 8, padding: '0 16px', color: '#fff', cursor: 'pointer' }}>Add</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {form.options.map(t => (
                  <span key={t} style={{ background: 'rgba(87,94,207,0.2)', color: '#a5aaee', borderRadius: 20, padding: '3px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {t}
                    <button onClick={() => setForm(p => ({ ...p, options: p.options.filter(x => x !== t) }))} style={{ background: 'none', border: 'none', color: '#8a8680', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 16 }}>
            <input type="checkbox" checked={!!form.pinned} onChange={e => setForm(p => ({ ...p, pinned: e.target.checked }))} style={{ accentColor: '#575ECF' }} />
            <span style={{ color: '#c5c1b9', fontSize: 13 }}>📌 Pin this field as a column in the overview table</span>
          </label>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={resetForm} style={{ ...smallBtn, padding: '8px 16px', fontSize: 13 }}>Cancel</button>
            <button onClick={save} disabled={!form.label.trim()} style={{ background: '#575ECF', border: 'none', borderRadius: 8, padding: '8px 20px', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: !form.label.trim() ? 0.5 : 1, fontSize: 13 }}>
              {editingId ? 'Save Changes' : 'Add Field'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Column Order (drag/arrow reorder of the accounts table columns) ─────────
function ColumnOrderTab({ columnOrder, pinnedFields, onChange }) {
  const [list, setList] = useState(columnOrder)
  const dragIdx = useRef(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)

  useEffect(() => { setList(columnOrder) }, [columnOrder])

  function getLabel(key) {
    const b = BUILTIN_COLS.find(c => c.key === key)
    if (b) return { label: b.label, icon: b.icon, builtin: true }
    const f = pinnedFields.find(f => f.field_key === key)
    if (f) return { label: f.label, icon: FIELD_TYPES.find(t => t.value === f.field_type)?.icon || '□', builtin: false }
    return null
  }

  function move(idx, dir) {
    const next = [...list]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setList(next)
    onChange(next)
  }

  function onDragStart(idx) { dragIdx.current = idx }
  function onDragEnter(idx) { setDragOverIdx(idx) }
  function onDragEnd() {
    if (dragIdx.current !== null && dragOverIdx !== null && dragIdx.current !== dragOverIdx) {
      const next = [...list]
      const [moved] = next.splice(dragIdx.current, 1)
      next.splice(dragOverIdx, 0, moved)
      setList(next)
      onChange(next)
    }
    dragIdx.current = null
    setDragOverIdx(null)
  }

  return (
    <div>
      <p style={{ color: '#8a8680', fontSize: 13, marginBottom: 16 }}>Drag or use arrows to reorder columns on the Ad Accounts table. The Account column is always first.</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#2a2a2a', borderRadius: 8, marginBottom: 8, opacity: 0.5 }}>
        <span style={{ color: '#444', fontSize: 14 }}>⠿</span>
        <span style={{ color: '#c5c1b9', fontSize: 14, fontWeight: 500 }}>Account</span>
        <span style={{ color: '#8a8680', fontSize: 11, marginLeft: 4 }}>— always first</span>
      </div>
      {list.map((key, idx) => {
        const meta = getLabel(key)
        if (!meta) return null
        return (
          <div key={key}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragEnter={() => onDragEnter(idx)}
            onDragOver={e => e.preventDefault()}
            onDragEnd={onDragEnd}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: dragOverIdx === idx ? 'rgba(87,94,207,0.12)' : '#2a2a2a', borderRadius: 8, marginBottom: 8, border: `1px solid ${dragOverIdx === idx ? 'rgba(87,94,207,0.4)' : 'transparent'}`, cursor: 'grab', transition: 'background 0.12s' }}>
            <span style={{ color: '#444', fontSize: 14, userSelect: 'none' }}>⠿</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <button onClick={() => move(idx, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', color: idx === 0 ? '#333' : '#8a8680', cursor: idx === 0 ? 'default' : 'pointer', fontSize: 10, lineHeight: 1, padding: '1px 3px' }}>▲</button>
              <button onClick={() => move(idx, 1)} disabled={idx === list.length - 1} style={{ background: 'none', border: 'none', color: idx === list.length - 1 ? '#333' : '#8a8680', cursor: idx === list.length - 1 ? 'default' : 'pointer', fontSize: 10, lineHeight: 1, padding: '1px 3px' }}>▼</button>
            </div>
            <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{meta.icon}</span>
            <span style={{ color: '#c5c1b9', fontWeight: 500, fontSize: 14 }}>{meta.label}</span>
            {meta.builtin && <span style={{ color: '#555', fontSize: 11, marginLeft: 4 }}>built-in</span>}
          </div>
        )
      })}
    </div>
  )
}

// ─── Trash (soft-deleted audit sessions + ad accounts) ───────────────────────
function daysLeft(deletedAt) {
  const del = new Date(deletedAt)
  const expiry = new Date(del.getTime() + 7 * 24 * 60 * 60 * 1000)
  const diff = Math.ceil((expiry - Date.now()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}

function TrashSection({ sessions, accounts, onRestore, onPermanentDelete }) {
  const empty = sessions.length === 0 && accounts.length === 0
  if (empty) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
        <p style={{ color: '#8a8680', fontSize: 14, margin: 0 }}>Trash is empty</p>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {sessions.length > 0 && (
        <TrashGroup title={`Audit Sessions (${sessions.length})`}>
          {sessions.map(sess => (
            <TrashRow
              key={sess.id}
              label={`${sess.ad_account} — ${fmtDate(sess.date)}`}
              sublabel={sess.media_buyer ? `Media buyer: ${sess.media_buyer}` : null}
              daysLeft={daysLeft(sess.deleted_at)}
              onRestore={() => onRestore('session', sess.id, `${sess.ad_account} audit`)}
              onDelete={() => onPermanentDelete('session', sess.id, `${sess.ad_account} audit`)}
            />
          ))}
        </TrashGroup>
      )}
      {accounts.length > 0 && (
        <TrashGroup title={`Ad Accounts (${accounts.length})`}>
          {accounts.map(a => (
            <TrashRow
              key={a.id}
              label={a.name}
              daysLeft={daysLeft(a.deleted_at)}
              onRestore={() => onRestore('account', a.id, a.name)}
              onDelete={() => onPermanentDelete('account', a.id, a.name)}
            />
          ))}
        </TrashGroup>
      )}
    </div>
  )
}

function TrashGroup({ title, children }) {
  return (
    <div style={{ background: '#1b1b1b', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ color: '#8a8680', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function TrashRow({ label, sublabel, daysLeft: days, onRestore, onDelete }) {
  const urgent = days <= 2
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: '#c5c1b9', fontSize: 14, margin: 0, fontWeight: 500 }}>{label}</p>
        {sublabel && <p style={{ color: '#8a8680', fontSize: 12, margin: '2px 0 0' }}>{sublabel}</p>}
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, padding: '3px 8px', borderRadius: 6, flexShrink: 0, background: urgent ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)', color: urgent ? '#ef4444' : '#f59e0b' }}>
        {days === 0 ? 'Expiring today' : `${days}d left`}
      </span>
      <button onClick={onRestore} style={{ background: 'rgba(87,94,207,0.12)', border: '1px solid rgba(87,94,207,0.3)', borderRadius: 8, padding: '6px 14px', color: '#a5aaee', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
        Restore
      </button>
      <button onClick={onDelete} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '6px 14px', color: '#ef4444', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
        Delete forever
      </button>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function FbAdmin() {
  const [searchParams] = useSearchParams()
  const [buyers, setBuyers] = useState([])
  const [accounts, setAccounts] = useState([])
  const [fields, setFields] = useState([])
  const [trashSessions, setTrashSessions] = useState([])
  const [trashAccounts, setTrashAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [b, a, f, t] = await Promise.all([
        fb.get('/media-buyers'),
        fb.get('/ad-accounts?all=1'),
        fb.get('/account-fields?all=1'),
        fb.get('/trash'),
      ])
      setBuyers(b.data)
      setAccounts(Array.isArray(a.data) ? a.data : [])
      setFields(Array.isArray(f.data) ? f.data : [])
      setTrashSessions(t.data?.sessions || [])
      setTrashAccounts(t.data?.accounts || [])
    } catch { toast.error('Failed to load admin data') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    if (loading) return
    const section = searchParams.get('section')
    if (!section) return
    const el = document.getElementById(section)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [loading, searchParams])

  async function restoreTrash(type, id, label) {
    try {
      await fb.post('/trash/restore', { type, id })
      toast.success(`"${label}" restored`)
      if (type === 'session') setTrashSessions(prev => prev.filter(s => s.id !== id))
      else setTrashAccounts(prev => prev.filter(a => a.id !== id))
      if (type === 'account') fetchAll()
    } catch { toast.error('Failed to restore') }
  }

  async function permanentDeleteTrash(type, id, label) {
    if (!window.confirm(`Permanently delete "${label}"? This cannot be undone.`)) return
    try {
      await fb.delete('/trash/permanent', { type, id })
      toast.success('Permanently deleted')
      if (type === 'session') setTrashSessions(prev => prev.filter(s => s.id !== id))
      else setTrashAccounts(prev => prev.filter(a => a.id !== id))
    } catch { toast.error('Failed to delete') }
  }

  const activeFields = fields.filter(f => f.active)
  const pinnedFields = activeFields.filter(f => f.pinned)

  function defaultColOrder(pf) {
    return ['__last_audit__', '__7d_cpl__', '__3d_cpl__', ...pf.map(f => f.field_key), '__notes__']
  }
  function reconcileColOrder(saved, pf) {
    const validKeys = new Set([...BUILTIN_COLS.map(c => c.key), ...pf.map(f => f.field_key)])
    const filtered = (saved || []).filter(k => validKeys.has(k))
    for (const k of validKeys) {
      if (!filtered.includes(k)) {
        const notesIdx = filtered.indexOf('__notes__')
        if (BUILTIN_COLS.map(c => c.key).includes(k)) filtered.unshift(k)
        else if (notesIdx >= 0) filtered.splice(notesIdx, 0, k)
        else filtered.push(k)
      }
    }
    return filtered.length ? filtered : defaultColOrder(pf)
  }
  function loadColOrder() {
    try { return JSON.parse(localStorage.getItem('fb_column_order') || 'null') } catch { return null }
  }
  function saveColOrder(order) {
    localStorage.setItem('fb_column_order', JSON.stringify(order))
  }

  const [columnOrder, setColumnOrder] = useState(() => reconcileColOrder(loadColOrder(), []))
  useEffect(() => {
    setColumnOrder(prev => {
      const next = reconcileColOrder(prev, pinnedFields)
      saveColOrder(next)
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pinnedFields.map(f => f.field_key))])

  return (
    <div className="min-h-screen bg-[#1b1b1b] text-[#c5c1b9]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <nav className="flex items-center gap-2 text-sm text-[#8a8680] mb-6">
          <Link to="/facebook" className="hover:text-[#c5c1b9] transition-colors">Facebook Ads</Link>
          <span className="text-white/20">/</span>
          <span className="text-[#c5c1b9] font-medium">Admin</span>
        </nav>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#c5c1b9] tracking-tight">Facebook Ads Admin</h1>
          <p className="text-sm text-[#8a8680] mt-1">Manage media buyers, ad accounts, custom fields, columns and trash.</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-24"><Spinner /></div>
        ) : (
          <div className="flex flex-col gap-6">
            <AdminCard id="media-buyers" title="Media Buyers" subtitle="People who manage Facebook/Meta ad accounts">
              <EntitySection title="Media Buyers" subtitle={null}
                items={buyers} setItems={setBuyers} endpoint="/media-buyers" />
            </AdminCard>

            <AdminCard id="ad-accounts" title="Ad Accounts" subtitle="Facebook/Meta ad accounts to review. Expand any account to manage its campaign groups and target CPLs.">
              <ManageAccounts accounts={accounts} fields={activeFields} onSaved={fetchAll} />
            </AdminCard>

            <AdminCard id="custom-fields" title="Custom Fields" subtitle="Define extra fields tracked per ad account, and pin any of them as a column in the accounts table.">
              <ManageFields fields={fields} onSaved={fetchAll} />
            </AdminCard>

            <AdminCard id="column-order" title="Column Order" subtitle="Choose which order columns appear in on the Ad Accounts table.">
              <ColumnOrderTab columnOrder={columnOrder} pinnedFields={pinnedFields}
                onChange={next => { setColumnOrder(next); saveColOrder(next) }} />
            </AdminCard>

            <AdminCard id="trash" title="Trash" subtitle="Items are permanently deleted after 7 days. Restore them before then.">
              <TrashSection sessions={trashSessions} accounts={trashAccounts}
                onRestore={restoreTrash} onPermanentDelete={permanentDeleteTrash} />
            </AdminCard>
          </div>
        )}
      </div>
    </div>
  )
}
