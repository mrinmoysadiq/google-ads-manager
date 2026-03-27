import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  getAccounts, createAccount, updateAccount, deleteAccount,
  getTeamMembers, createTeamMember, updateTeamMember
} from '../utils/api'

function AdminTab({ type, items, setItems, onAdd, onUpdate, onToggle, onDelete }) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    if (!newName.trim()) return
    setLoading(true)
    try {
      const created = await onAdd(newName.trim())
      setItems(prev => [...prev, created])
      setNewName('')
      setShowAddForm(false)
      toast.success(`${type === 'account' ? 'Account' : 'Team member'} added!`)
    } catch (err) {
      console.error(err)
      if (err.response?.status === 409) {
        toast.error('Name already exists')
      } else {
        toast.error('Failed to add')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleEditSave = async (id) => {
    if (!editingName.trim()) return
    setLoading(true)
    try {
      const updated = await onUpdate(id, { name: editingName.trim() })
      setItems(prev => prev.map(item => item.id === id ? updated : item))
      setEditingId(null)
      setEditingName('')
      toast.success('Updated!')
    } catch (err) {
      console.error(err)
      if (err.response?.status === 409) {
        toast.error('Name already exists')
      } else {
        toast.error('Failed to update')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (item) => {
    try {
      const updated = await onUpdate(item.id, { active: !item.active })
      setItems(prev => prev.map(i => i.id === item.id ? updated : i))
      toast.success(`${updated.active ? 'Activated' : 'Deactivated'}!`)
    } catch (err) {
      console.error(err)
      toast.error('Failed to update status')
    }
  }

  const handleDelete = async (item) => {
    if (!onDelete) return
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    try {
      await onDelete(item.id)
      setItems(prev => prev.filter(i => i.id !== item.id))
      toast.success('Deleted!')
    } catch (err) {
      console.error(err)
      if (err.response?.status === 409) {
        toast.error('Cannot delete: referenced in sessions or change log entries')
      } else {
        toast.error('Failed to delete')
      }
    }
  }

  return (
    <div>
      {/* Add Button */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{items.length} {items.length === 1 ? 'entry' : 'entries'}</p>
        <button
          onClick={() => { setShowAddForm(v => !v); setNewName('') }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add New
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex gap-3 items-center">
          <input
            type="text"
            placeholder={`Enter ${type === 'account' ? 'account' : 'team member'} name...`}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />
          <button
            onClick={handleAdd}
            disabled={loading || !newName.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-all"
          >
            Save
          </button>
          <button
            onClick={() => { setShowAddForm(false); setNewName('') }}
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-all"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400 text-sm italic">
                  No entries yet. Add one above.
                </td>
              </tr>
            ) : (
              items.map((item, i) => (
                <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3">
                    {editingId === item.id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleEditSave(item.id)
                          if (e.key === 'Escape') { setEditingId(null); setEditingName('') }
                        }}
                        className="w-full border border-blue-400 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <span className={`font-medium ${item.active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                        {item.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      item.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {item.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {editingId === item.id ? (
                        <>
                          <button
                            onClick={() => handleEditSave(item.id)}
                            disabled={loading}
                            className="text-green-600 hover:text-green-800 text-xs font-medium"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setEditingId(null); setEditingName('') }}
                            className="text-gray-500 hover:text-gray-700 text-xs font-medium"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditingId(item.id); setEditingName(item.name) }}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggle(item)}
                            className={`text-xs font-medium ${
                              item.active ? 'text-orange-500 hover:text-orange-700' : 'text-green-600 hover:text-green-800'
                            }`}
                          >
                            {item.active ? 'Deactivate' : 'Activate'}
                          </button>
                          {onDelete && (
                            <button
                              onClick={() => handleDelete(item)}
                              className="text-red-500 hover:text-red-700 text-xs font-medium"
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState('accounts')
  const [accounts, setAccounts] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getAccounts(), getTeamMembers()])
      .then(([accts, members]) => {
        setAccounts(accts)
        setTeamMembers(members)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        toast.error('Failed to load data')
        setLoading(false)
      })
  }, [])

  const tabs = [
    { id: 'accounts', label: 'Accounts', count: accounts.length },
    { id: 'team-members', label: 'Team Members', count: teamMembers.length },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-gray-500 text-sm mt-1">Manage accounts and team members</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab.label}
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold ${
              activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="w-8 h-8 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : activeTab === 'accounts' ? (
          <AdminTab
            type="account"
            items={accounts}
            setItems={setAccounts}
            onAdd={createAccount}
            onUpdate={updateAccount}
            onDelete={deleteAccount}
          />
        ) : (
          <AdminTab
            type="team-member"
            items={teamMembers}
            setItems={setTeamMembers}
            onAdd={createTeamMember}
            onUpdate={updateTeamMember}
            onDelete={null}
          />
        )}
      </div>
    </div>
  )
}
