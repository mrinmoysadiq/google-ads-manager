import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../utils/api'

const fb = (path, cfg) => api.get(`/facebook${path}`, cfg)

const inputClass = 'w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#575ECF] transition-colors'
const s = { background: '#1b1b1b', border: '1px solid rgba(255,255,255,0.08)', color: '#c5c1b9', borderRadius: 8, padding: '6px 10px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }

function Spinner() {
  return <svg className="animate-spin h-5 w-5 text-[#575ECF]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
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
      const { data } = await api.post(`${endpoint}`, { name: newName.trim() })
      setItems(prev => [...prev, data])
      setNewName('')
      toast.success(`${title.slice(0, -1)} added`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add')
    } finally { setAdding(false) }
  }

  const handleToggle = async (item) => {
    try {
      const { data } = await api.patch(`${endpoint}/${item.id}`, { active: item.active ? 0 : 1 })
      setItems(prev => prev.map(i => i.id === item.id ? data : i))
    } catch { toast.error('Failed to update') }
  }

  const handleEditSave = async (item) => {
    if (!editName.trim() || editName.trim() === item.name) { setEditId(null); return }
    try {
      const { data } = await api.patch(`${endpoint}/${item.id}`, { name: editName.trim() })
      setItems(prev => prev.map(i => i.id === item.id ? data : i))
      setEditId(null)
      toast.success('Renamed')
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to rename') }
  }

  const handleDelete = async (item) => {
    const activeCount = items.filter(i => i.active).length
    if (item.active && activeCount <= 1) { toast.error('Cannot delete the only active entry'); return }
    try {
      await api.delete(`${endpoint}/${item.id}`)
      setItems(prev => prev.filter(i => i.id !== item.id))
      toast.success('Deleted')
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to delete') }
  }

  return (
    <div className="bg-[#242424] border border-white/[0.08] rounded-xl p-6">
      <h2 className="text-base font-semibold text-[#c5c1b9] mb-1">{title}</h2>
      {subtitle && <p className="text-xs text-[#8a8680] mb-5">{subtitle}</p>}
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
    </div>
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
    const { data } = await api.get(`/facebook/ad-accounts/${account.id}/campaign-groups`)
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
      const { data } = await api.post(`/facebook/ad-accounts/${account.id}/campaign-groups`, {
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
      const { data } = await api.patch(`/facebook/campaign-groups/${g.id}`, {
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
    await api.delete(`/facebook/campaign-groups/${g.id}`)
    setGroups(prev => prev.filter(x => x.id !== g.id))
    toast.success('Deleted')
  }

  const handleToggle = async (g) => {
    const { data } = await api.patch(`/facebook/campaign-groups/${g.id}`, { active: g.active ? 0 : 1 })
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

          {/* Existing groups */}
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

          {/* Add new */}
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

// ── Ad Accounts section (with campaign groups per account) ────────────────────
function AdAccountsSection({ accounts, setAccounts }) {
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')

  const handleAdd = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const { data } = await api.post('/facebook/ad-accounts', { name: newName.trim() })
      setAccounts(prev => [...prev, data])
      setNewName('')
      toast.success('Ad account added')
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add') }
    finally { setAdding(false) }
  }

  const handleToggle = async (item) => {
    try {
      const { data } = await api.patch(`/facebook/ad-accounts/${item.id}`, { active: item.active ? 0 : 1 })
      setAccounts(prev => prev.map(i => i.id === item.id ? data : i))
    } catch { toast.error('Failed to update') }
  }

  const handleEditSave = async (item) => {
    if (!editName.trim() || editName.trim() === item.name) { setEditId(null); return }
    try {
      const { data } = await api.patch(`/facebook/ad-accounts/${item.id}`, { name: editName.trim() })
      setAccounts(prev => prev.map(i => i.id === item.id ? data : i))
      setEditId(null)
      toast.success('Renamed')
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to rename') }
  }

  const handleDelete = async (item) => {
    try {
      await api.delete(`/facebook/ad-accounts/${item.id}`)
      setAccounts(prev => prev.filter(i => i.id !== item.id))
      toast.success('Deleted')
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to delete') }
  }

  return (
    <div className="bg-[#242424] border border-white/[0.08] rounded-xl p-6">
      <h2 className="text-base font-semibold text-[#c5c1b9] mb-1">Ad Accounts</h2>
      <p className="text-xs text-[#8a8680] mb-5">Facebook/Meta ad accounts to review. Expand any account to add campaign groups with per-group target CPLs.</p>
      <div className="flex gap-2 mb-5">
        <input className={inputClass} value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="New ad account name…" onKeyDown={e => { if (e.key === 'Enter') handleAdd() }} />
        <button onClick={handleAdd} disabled={adding || !newName.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#575ECF] hover:bg-[#6B72D8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
          {adding ? <Spinner /> : 'Add'}
        </button>
      </div>
      {accounts.length === 0 ? (
        <p className="text-sm text-[#8a8680] text-center py-4">No ad accounts yet</p>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {accounts.map(item => (
            <li key={item.id} className={`py-3 ${!item.active ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-3">
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
              </div>
              <CampaignGroupsPanel account={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function FbAdmin() {
  const [buyers, setBuyers] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [b, a] = await Promise.all([
        api.get('/facebook/media-buyers'),
        api.get('/facebook/ad-accounts'),
      ])
      setBuyers(b.data)
      setAccounts(a.data)
    } catch { toast.error('Failed to load admin data') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

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
          <p className="text-sm text-[#8a8680] mt-1">Manage media buyers, ad accounts and campaign groups.</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-24"><Spinner /></div>
        ) : (
          <div className="flex flex-col gap-6">
            <EntitySection title="Media Buyers" subtitle="People who manage Facebook/Meta ad accounts"
              items={buyers} setItems={setBuyers} endpoint="/facebook/media-buyers" />
            <AdAccountsSection accounts={accounts} setAccounts={setAccounts} />
          </div>
        )}
      </div>
    </div>
  )
}
