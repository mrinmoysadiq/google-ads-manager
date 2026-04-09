import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import toast from 'react-hot-toast'

const inp = 'w-full bg-[#1b1b1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#c5c1b9] outline-none focus:border-[#575ECF] placeholder-[#8a8680] transition-colors'

export default function TrackingAdmin() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newWebsite, setNewWebsite] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editWebsite, setEditWebsite] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => { loadClients() }, [])

  async function loadClients() {
    setLoading(true)
    try {
      const { data } = await api.get('/tracking/clients/all')
      setClients(data)
    } catch { toast.error('Failed to load clients') }
    setLoading(false)
  }

  async function addClient() {
    if (!newName.trim()) return toast.error('Client name is required')
    setAdding(true)
    try {
      await api.post('/tracking/clients', { name: newName.trim(), website: newWebsite.trim() || null })
      setNewName('')
      setNewWebsite('')
      toast.success('Client added')
      loadClients()
    } catch (e) { toast.error(e.response?.data?.error || 'Error adding client') }
    setAdding(false)
  }

  async function saveEdit(id) {
    if (!editName.trim()) return toast.error('Name is required')
    try {
      await api.patch(`/tracking/clients/${id}`, { name: editName.trim(), website: editWebsite.trim() || null })
      setEditId(null)
      toast.success('Client updated')
      loadClients()
    } catch (e) { toast.error(e.response?.data?.error || 'Error updating client') }
  }

  async function toggleActive(c) {
    try {
      await api.patch(`/tracking/clients/${c.id}`, { active: c.active ? 0 : 1 })
      loadClients()
    } catch { toast.error('Error updating client') }
  }

  async function deleteClient(id) {
    try {
      await api.delete(`/tracking/clients/${id}`)
      setDeleteConfirm(null)
      toast.success('Client deleted')
      loadClients()
    } catch (e) { toast.error(e.response?.data?.error || 'Error deleting client') }
  }

  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#c5c1b9]">Tracking Admin</h1>
            <p className="text-sm text-[#8a8680] mt-1">Manage clients for tracking audits</p>
          </div>
          <button
            onClick={() => navigate('/tracking')}
            className="text-sm text-[#8a8680] hover:text-[#c5c1b9] transition-colors"
          >
            ← Back
          </button>
        </div>

        {/* Clients section */}
        <div>
          <h2 className="text-base font-semibold text-[#c5c1b9] mb-4">Clients</h2>

          {/* Add client */}
          <div className="bg-[#242424] border border-white/8 rounded-xl p-4 mb-4">
            <p className="text-xs text-[#8a8680] mb-3">Add new client</p>
            <div className="flex gap-2 flex-wrap">
              <input
                className={inp + ' flex-1 min-w-[160px]'}
                placeholder="Client name *"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addClient()}
              />
              <input
                className={inp + ' flex-1 min-w-[160px]'}
                placeholder="Website (optional)"
                value={newWebsite}
                onChange={e => setNewWebsite(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addClient()}
              />
              <button
                onClick={addClient}
                disabled={adding}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors flex-shrink-0"
                style={{ backgroundColor: adding ? 'rgba(87,94,207,0.4)' : '#575ECF' }}
              >
                {adding ? 'Adding…' : 'Add Client'}
              </button>
            </div>
          </div>

          {/* Client table */}
          <div className="bg-[#242424] border border-white/8 rounded-xl overflow-hidden">
            {loading ? (
              <div className="py-10 text-center text-[#8a8680] text-sm">Loading…</div>
            ) : clients.length === 0 ? (
              <p className="text-center py-8 text-[#8a8680] text-sm">No clients yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Name', 'Website', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-medium text-[#8a8680]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: c.active ? 1 : 0.45 }}>
                      <td className="px-5 py-3">
                        {editId === c.id ? (
                          <input
                            className={inp}
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            autoFocus
                          />
                        ) : (
                          <span className="text-[#c5c1b9] font-medium">{c.name}</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {editId === c.id ? (
                          <input
                            className={inp}
                            placeholder="https://..."
                            value={editWebsite}
                            onChange={e => setEditWebsite(e.target.value)}
                          />
                        ) : (
                          <span className="text-[#8a8680] text-xs truncate max-w-[200px] block">
                            {c.website || '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs ${c.active ? 'text-[#22c55e]' : 'text-[#8a8680]'}`}>
                          {c.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          {editId === c.id ? (
                            <>
                              <button onClick={() => saveEdit(c.id)} className="text-xs px-3 py-1.5 rounded-lg bg-[#575ECF] text-white">Save</button>
                              <button onClick={() => setEditId(null)} className="text-xs px-3 py-1.5 rounded-lg bg-white/8 text-[#8a8680]">Cancel</button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => { setEditId(c.id); setEditName(c.name); setEditWebsite(c.website || '') }}
                                className="text-xs px-3 py-1.5 rounded-lg bg-white/8 text-[#c5c1b9] hover:bg-white/12 transition-colors"
                              >Edit</button>
                              <button
                                onClick={() => toggleActive(c)}
                                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${c.active ? 'bg-[#ef4444]/15 text-[#ef4444]' : 'bg-[#22c55e]/15 text-[#22c55e]'}`}
                              >{c.active ? 'Deactivate' : 'Activate'}</button>
                              {deleteConfirm === c.id ? (
                                <div className="flex gap-1">
                                  <button onClick={() => deleteClient(c.id)} className="text-xs px-2 py-1 rounded-lg bg-[#ef4444] text-white">Confirm</button>
                                  <button onClick={() => setDeleteConfirm(null)} className="text-xs px-2 py-1 rounded-lg bg-white/8 text-[#8a8680]">Cancel</button>
                                </div>
                              ) : (
                                <button onClick={() => setDeleteConfirm(c.id)} className="text-xs px-3 py-1.5 rounded-lg bg-[#ef4444]/15 text-[#ef4444] hover:bg-[#ef4444]/25 transition-colors">Delete</button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
