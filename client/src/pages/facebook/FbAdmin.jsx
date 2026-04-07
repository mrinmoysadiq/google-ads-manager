import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'

const API = (import.meta.env.VITE_API_URL || '/api')

const inputClass = 'w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#575ECF] transition-colors'

function Spinner() {
  return <svg className="animate-spin h-5 w-5 text-[#575ECF]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
}

function EntitySection({ title, subtitle, items, setItems, endpoint }) {
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')

  const handleAdd = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const { data } = await axios.post(`${API}${endpoint}`, { name: newName.trim() })
      setItems(prev => [...prev, data])
      setNewName('')
      toast.success(`${title.slice(0, -1)} added`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add')
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (item) => {
    try {
      const { data } = await axios.patch(`${API}${endpoint}/${item.id}`, { active: item.active ? 0 : 1 })
      setItems(prev => prev.map(i => i.id === item.id ? data : i))
    } catch {
      toast.error('Failed to update')
    }
  }

  const handleEditSave = async (item) => {
    if (!editName.trim() || editName.trim() === item.name) { setEditId(null); return }
    try {
      const { data } = await axios.patch(`${API}${endpoint}/${item.id}`, { name: editName.trim() })
      setItems(prev => prev.map(i => i.id === item.id ? data : i))
      setEditId(null)
      toast.success('Renamed')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to rename')
    }
  }

  const handleDelete = async (item) => {
    const activeCount = items.filter(i => i.active).length
    if (item.active && activeCount <= 1) {
      toast.error('Cannot delete the only active entry')
      return
    }
    try {
      await axios.delete(`${API}${endpoint}/${item.id}`)
      setItems(prev => prev.filter(i => i.id !== item.id))
      toast.success('Deleted')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete')
    }
  }

  return (
    <div className="bg-[#242424] border border-white/[0.08] rounded-xl p-6">
      <h2 className="text-base font-semibold text-[#c5c1b9] mb-1">{title}</h2>
      {subtitle && <p className="text-xs text-[#8a8680] mb-5">{subtitle}</p>}

      <div className="flex gap-2 mb-5">
        <input
          className={inputClass}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder={`New ${title.toLowerCase().slice(0, -1)} name…`}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newName.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#575ECF] hover:bg-[#6B72D8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
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
                  <input
                    autoFocus
                    className={inputClass + ' py-1'}
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => handleEditSave(item)}
                    onKeyDown={e => { if (e.key === 'Enter') handleEditSave(item); if (e.key === 'Escape') setEditId(null) }}
                  />
                ) : (
                  <span
                    className="text-sm text-[#c5c1b9] cursor-pointer hover:text-white"
                    onClick={() => { setEditId(item.id); setEditName(item.name) }}
                    title="Click to rename"
                  >{item.name}</span>
                )}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.active ? 'bg-green-500/15 text-[#22c55e]' : 'bg-white/5 text-[#8a8680]'}`}>
                {item.active ? 'Active' : 'Inactive'}
              </span>
              <button
                onClick={() => handleToggle(item)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${item.active ? 'bg-[#575ECF]' : 'bg-white/10'}`}
                role="switch"
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${item.active ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
              <button
                onClick={() => handleDelete(item)}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30 transition-colors"
              >Delete</button>
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
        axios.get(`${API}/facebook/media-buyers`),
        axios.get(`${API}/facebook/ad-accounts`),
      ])
      setBuyers(b.data)
      setAccounts(a.data)
    } catch {
      toast.error('Failed to load admin data')
    } finally {
      setLoading(false)
    }
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
          <p className="text-sm text-[#8a8680] mt-1">Manage media buyers and ad accounts.</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-24"><Spinner /></div>
        ) : (
          <div className="flex flex-col gap-6">
            <EntitySection
              title="Media Buyers"
              subtitle="People who manage Facebook/Meta ad accounts"
              items={buyers}
              setItems={setBuyers}
              endpoint="/facebook/media-buyers"
            />
            <EntitySection
              title="Ad Accounts"
              subtitle="Facebook/Meta ad accounts to review"
              items={accounts}
              setItems={setAccounts}
              endpoint="/facebook/ad-accounts"
            />
          </div>
        )}
      </div>
    </div>
  )
}
