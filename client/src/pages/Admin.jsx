import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  getAccounts, createAccount, updateAccount, deleteAccount,
  getTeamMembers, createTeamMember, updateTeamMember,
  getDataStats, cleanupOldData
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

  const inputClass = 'flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors text-[#c5c1b9]'

  return (
    <div>
      {/* Add Button */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[#8a8680]">{items.length} {items.length === 1 ? 'entry' : 'entries'}</p>
        <button
          onClick={() => { setShowAddForm(v => !v); setNewName('') }}
          className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-all"
          style={{ backgroundColor: '#575ECF' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#6B72D8'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#575ECF'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add New
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="rounded-lg p-4 mb-4 flex gap-3 items-center" style={{ backgroundColor: 'rgba(87,94,207,0.08)', border: '1px solid rgba(87,94,207,0.2)' }}>
          <input
            type="text"
            placeholder={`Enter ${type === 'account' ? 'account' : 'team member'} name...`}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className={inputClass}
            style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)' }}
            onFocus={e => e.target.style.borderColor = '#575ECF'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            autoFocus
          />
          <button
            onClick={handleAdd}
            disabled={loading || !newName.trim()}
            className="px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-all"
            style={{ backgroundColor: '#575ECF' }}
            onMouseEnter={e => { if (!loading && newName.trim()) e.currentTarget.style.backgroundColor = '#6B72D8' }}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#575ECF'}
          >
            Save
          </button>
          <button
            onClick={() => { setShowAddForm(false); setNewName('') }}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all text-[#c5c1b9]"
            style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#575ECF'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: '#1b1b1b', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#8a8680' }}>Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#8a8680' }}>Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: '#8a8680' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm italic" style={{ color: '#8a8680' }}>
                  No entries yet. Add one above.
                </td>
              </tr>
            ) : (
              items.map((item, i) => (
                <tr key={item.id} style={{ backgroundColor: i % 2 === 0 ? '#242424' : '#2a2a2a', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
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
                        className="w-full rounded-lg px-3 py-1.5 text-sm focus:outline-none text-[#c5c1b9]"
                        style={{ backgroundColor: '#2a2a2a', border: '1px solid #575ECF' }}
                        autoFocus
                      />
                    ) : (
                      <span className={`font-medium ${item.active ? 'text-[#c5c1b9]' : 'text-[#8a8680] line-through'}`}>
                        {item.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={item.active
                        ? { backgroundColor: 'rgba(74,222,128,0.1)', color: '#4ade80' }
                        : { color: '#8a8680' }
                      }
                    >
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
                            className="text-xs font-medium transition-colors"
                            style={{ color: '#4ade80' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#86efac'}
                            onMouseLeave={e => e.currentTarget.style.color = '#4ade80'}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setEditingId(null); setEditingName('') }}
                            className="text-xs font-medium transition-colors"
                            style={{ color: '#8a8680' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#c5c1b9'}
                            onMouseLeave={e => e.currentTarget.style.color = '#8a8680'}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditingId(item.id); setEditingName(item.name) }}
                            className="text-xs font-medium transition-colors"
                            style={{ color: '#575ECF' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#6B72D8'}
                            onMouseLeave={e => e.currentTarget.style.color = '#575ECF'}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggle(item)}
                            className="text-xs font-medium transition-colors"
                            style={{ color: item.active ? '#fbbf24' : '#4ade80' }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                          >
                            {item.active ? 'Deactivate' : 'Activate'}
                          </button>
                          {onDelete && (
                            <button
                              onClick={() => handleDelete(item)}
                              className="text-xs font-medium transition-colors"
                              style={{ color: '#f87171' }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
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

function DataManagementTab() {
  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [cleaning, setCleaning] = useState(false)
  const [lastResult, setLastResult] = useState(null)

  const fetchStats = () => {
    setLoadingStats(true)
    getDataStats()
      .then(data => { setStats(data); setLoadingStats(false) })
      .catch(err => { console.error(err); setLoadingStats(false) })
  }

  useEffect(() => { fetchStats() }, [])

  const handleCleanup = async () => {
    if (!window.confirm(
      `This will permanently delete all sessions, change logs, and slide responses older than 90 days (before ${stats?.cutoffDate}).\n\nDisk space will be reclaimed immediately.\n\nThis cannot be undone. Continue?`
    )) return

    setCleaning(true)
    try {
      const result = await cleanupOldData()
      setLastResult(result)
      toast.success(`Cleanup complete! Deleted ${result.deleted.sessions} sessions, ${result.deleted.changeLogs} change log entries.`)
      fetchStats()
    } catch (err) {
      console.error(err)
      toast.error('Cleanup failed')
    } finally {
      setCleaning(false)
    }
  }

  const statCard = (label, value, sub) => (
    <div className="rounded-xl p-5 flex flex-col gap-1" style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#8a8680' }}>{label}</p>
      <p className="text-3xl font-bold text-[#c5c1b9]">{value}</p>
      {sub && <p className="text-xs" style={{ color: '#8a8680' }}>{sub}</p>}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="rounded-xl p-4 flex gap-3" style={{ backgroundColor: 'rgba(87,94,207,0.08)', border: '1px solid rgba(87,94,207,0.2)' }}>
        <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#575ECF' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-[#c5c1b9]">Data Retention Policy</p>
          <p className="text-sm mt-0.5" style={{ color: '#8a8680' }}>
            Running cleanup removes all sessions, slide responses, and change log entries older than <strong className="text-[#c5c1b9]">90 days</strong> from the database and reclaims disk space immediately using SQLite VACUUM. Accounts and team members are never deleted.
          </p>
        </div>
      </div>

      {/* Stats */}
      {loadingStats ? (
        <div className="flex justify-center py-8">
          <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: '#575ECF' }}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : stats ? (
        <>
          <div>
            <p className="text-sm font-semibold text-[#c5c1b9] mb-3">Current Database</p>
            <div className="grid grid-cols-3 gap-3">
              {statCard('Sessions', stats.total.sessions)}
              {statCard('Change Logs', stats.total.changeLogs)}
              {statCard('Slide Responses', stats.total.slideResponses)}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-[#c5c1b9] mb-3">Older Than 90 Days <span className="font-normal text-[#8a8680]">(eligible for deletion — before {stats.cutoffDate})</span></p>
            <div className="grid grid-cols-2 gap-3">
              {statCard('Sessions', stats.olderThan90Days.sessions, stats.olderThan90Days.sessions > 0 ? 'Will be deleted' : 'Nothing to delete')}
              {statCard('Change Logs', stats.olderThan90Days.changeLogs, stats.olderThan90Days.changeLogs > 0 ? 'Will be deleted' : 'Nothing to delete')}
            </div>
          </div>

          {stats.oldestRecord && (
            <p className="text-xs" style={{ color: '#8a8680' }}>
              Oldest record: <span className="text-[#c5c1b9]">{stats.oldestRecord.split('T')[0]}</span>
            </p>
          )}
        </>
      ) : null}

      {/* Last Result */}
      {lastResult && (
        <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.2)' }}>
          <p className="text-sm font-medium" style={{ color: '#4ade80' }}>✓ Last cleanup result</p>
          <p className="text-sm mt-1" style={{ color: '#8a8680' }}>
            Deleted <strong className="text-[#c5c1b9]">{lastResult.deleted.sessions}</strong> sessions,{' '}
            <strong className="text-[#c5c1b9]">{lastResult.deleted.slideResponses}</strong> slide responses,{' '}
            <strong className="text-[#c5c1b9]">{lastResult.deleted.changeLogs}</strong> change log entries.
            Disk space reclaimed.
          </p>
        </div>
      )}

      {/* Action */}
      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div>
          <p className="text-sm font-medium text-[#c5c1b9]">Delete data older than 90 days</p>
          <p className="text-xs mt-0.5" style={{ color: '#8a8680' }}>Disk space is reclaimed immediately after deletion</p>
        </div>
        <button
          onClick={handleCleanup}
          disabled={cleaning || loadingStats || (stats && stats.olderThan90Days.sessions === 0 && stats.olderThan90Days.changeLogs === 0)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed text-white"
          style={{ backgroundColor: '#dc2626' }}
          onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#b91c1c' }}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#dc2626'}
        >
          {cleaning ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Cleaning up...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Run Cleanup
            </>
          )}
        </button>
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
    { id: 'data', label: 'Data Management', count: null },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#c5c1b9]">Admin Panel</h1>
        <p className="text-[#8a8680] text-sm mt-1">Manage accounts, team members and data retention</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
            style={activeTab === tab.id
              ? { backgroundColor: '#575ECF', color: '#fff' }
              : { color: '#8a8680' }
            }
            onMouseEnter={e => { if (activeTab !== tab.id) e.currentTarget.style.color = '#c5c1b9' }}
            onMouseLeave={e => { if (activeTab !== tab.id) e.currentTarget.style.color = '#8a8680' }}
          >
            {tab.label}
            {tab.count !== null && (
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold"
                style={activeTab === tab.id
                  ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }
                  : { backgroundColor: 'rgba(255,255,255,0.08)', color: '#8a8680' }
                }
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-xl p-6" style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}>
        {activeTab === 'data' ? (
          <DataManagementTab />
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: '#575ECF' }}>
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
