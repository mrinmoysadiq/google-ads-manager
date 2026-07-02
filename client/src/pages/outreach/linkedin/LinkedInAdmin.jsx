import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  getLinkedInPipelineStages, createLinkedInPipelineStage, updateLinkedInPipelineStage, deleteLinkedInPipelineStage,
  getLinkedInSettings, updateLinkedInSettings,
  getLinkedInTrash, restoreLinkedInTrashLead, permanentDeleteLinkedInLead,
} from '../../../utils/linkedinApi'

const inputClass =
  'w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#0a66c2]'

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-[#0a66c2]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

function Badge({ active }) {
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: active ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)', color: active ? '#22c55e' : '#8a8680' }}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function Btn({ variant = 'ghost', size = 'sm', className = '', ...props }) {
  const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
  const variantClass = variant === 'primary'
    ? 'bg-[#0a66c2] text-white hover:bg-[#0e7cd8]'
    : variant === 'danger'
      ? 'text-[#ef4444] border border-[#ef4444]/30 hover:bg-[#ef4444]/10'
      : 'text-[#8a8680] border border-white/10 hover:text-[#c5c1b9] hover:border-white/20'
  return <button className={`rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sizeClass} ${variantClass} ${className}`} {...props} />
}

// ─── Section: Pipeline Stages ─────────────────────────────────────────────────

function PipelineStagesSection({ stages, setStages }) {
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  const handleAdd = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const created = await createLinkedInPipelineStage({ name: newName.trim() })
      setStages(prev => [...prev, created])
      setNewName('')
      toast.success('Stage added')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add stage')
    } finally { setAdding(false) }
  }

  const handleEditSave = async (stage) => {
    if (!editName.trim() || editName.trim() === stage.name) { setEditingId(null); return }
    try {
      const updated = await updateLinkedInPipelineStage(stage.id, { name: editName.trim() })
      setStages(prev => prev.map(s => s.id === stage.id ? updated : s))
      setEditingId(null)
      toast.success('Stage renamed')
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to rename stage') }
  }

  const handleToggleActive = async (stage) => {
    try {
      const updated = await updateLinkedInPipelineStage(stage.id, { active: stage.active ? 0 : 1 })
      setStages(prev => prev.map(s => s.id === stage.id ? updated : s))
    } catch { toast.error('Failed to update stage') }
  }

  const handleDelete = async (stage) => {
    try {
      await deleteLinkedInPipelineStage(stage.id)
      setStages(prev => prev.filter(s => s.id !== stage.id))
      toast.success('Stage deleted')
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to delete stage') }
  }

  const handleMove = async (stage, direction) => {
    const sorted = [...stages].sort((a, b) => a.order_index - b.order_index)
    const idx = sorted.findIndex(s => s.id === stage.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const other = sorted[swapIdx]
    try {
      const [a, b] = await Promise.all([
        updateLinkedInPipelineStage(stage.id, { order_index: other.order_index }),
        updateLinkedInPipelineStage(other.id, { order_index: stage.order_index }),
      ])
      setStages(prev => prev.map(s => s.id === stage.id ? a : s.id === other.id ? b : s))
    } catch { toast.error('Failed to reorder stages') }
  }

  const sorted = [...stages].sort((a, b) => a.order_index - b.order_index)

  return (
    <div className="bg-[#242424] border border-white/[0.08] rounded-xl p-6">
      <h2 className="text-base font-semibold text-[#c5c1b9] mb-1">LinkedIn Pipeline Stages</h2>
      <p className="text-xs text-[#8a8680] mb-5">Manage the stages in your LinkedIn outreach pipeline. Stages in use cannot be deleted.</p>

      <div className="flex gap-2 mb-5">
        <input className={inputClass} value={newName} onChange={e => setNewName(e.target.value)} placeholder="New stage name…" onKeyDown={e => { if (e.key === 'Enter') handleAdd() }} />
        <Btn variant="primary" size="sm" onClick={handleAdd} disabled={adding || !newName.trim()}>{adding ? <Spinner /> : 'Add'}</Btn>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-[#8a8680] text-center py-4">No stages yet</p>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {sorted.map((stage, idx) => (
            <li key={stage.id} className={`flex items-center gap-3 py-3 ${!stage.active ? 'opacity-50' : ''}`}>
              <div className="flex flex-col gap-0.5">
                <button onClick={() => handleMove(stage, 'up')} disabled={idx === 0} className="text-[#8a8680] hover:text-[#c5c1b9] disabled:opacity-20 disabled:cursor-not-allowed text-xs leading-none" title="Move up">▲</button>
                <button onClick={() => handleMove(stage, 'down')} disabled={idx === sorted.length - 1} className="text-[#8a8680] hover:text-[#c5c1b9] disabled:opacity-20 disabled:cursor-not-allowed text-xs leading-none" title="Move down">▼</button>
              </div>

              <div className="flex-1 min-w-0">
                {editingId === stage.id ? (
                  <input autoFocus className={inputClass + ' py-1'} value={editName} onChange={e => setEditName(e.target.value)} onBlur={() => handleEditSave(stage)}
                    onKeyDown={e => { if (e.key === 'Enter') handleEditSave(stage); if (e.key === 'Escape') setEditingId(null) }} />
                ) : (
                  <span className="text-sm text-[#c5c1b9] cursor-pointer hover:text-white" onClick={() => { setEditingId(stage.id); setEditName(stage.name) }} title="Click to rename">
                    {stage.name}
                  </span>
                )}
              </div>

              {!!stage.is_default && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(10,102,194,0.15)', color: '#0a66c2' }}>
                  Default
                </span>
              )}

              <Badge active={!!stage.active} />

              <button
                onClick={() => handleToggleActive(stage)}
                disabled={!!stage.is_default}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed ${stage.active ? 'bg-[#0a66c2]' : 'bg-white/10'}`}
                role="switch"
                aria-checked={!!stage.active}
                title={stage.is_default ? 'The default stage is always active' : (stage.active ? 'Deactivate' : 'Activate')}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${stage.active ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>

              {stage.is_default ? (
                <Btn variant="ghost" size="sm" disabled title="The default stage cannot be deleted">Locked</Btn>
              ) : (
                <Btn variant="danger" size="sm" onClick={() => handleDelete(stage)} title="Delete stage">Delete</Btn>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Section: Settings ────────────────────────────────────────────────────────

function SettingsSection({ settings, setSettings }) {
  const [warmupThreshold, setWarmupThreshold] = useState(settings.warmup_threshold || '3')
  const [reminderDays, setReminderDays] = useState(settings.engagement_reminder_days || '14')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const wt = parseInt(warmupThreshold)
    const rd = parseInt(reminderDays)
    if (isNaN(wt) || wt < 1 || wt > 50) { toast.error('Warm-up threshold must be between 1 and 50'); return }
    if (isNaN(rd) || rd < 1 || rd > 365) { toast.error('Reminder days must be between 1 and 365'); return }
    setSaving(true)
    try {
      const updated = await updateLinkedInSettings({ warmup_threshold: wt, engagement_reminder_days: rd })
      setSettings(updated)
      toast.success('Settings saved')
    } catch { toast.error('Failed to save settings') } finally { setSaving(false) }
  }

  return (
    <div className="bg-[#242424] border border-white/[0.08] rounded-xl p-6">
      <h2 className="text-base font-semibold text-[#c5c1b9] mb-5">Settings</h2>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm text-[#8a8680] mb-1">Warm-up threshold</label>
            <p className="text-xs text-[#555] mb-2">Number of logged engagements before a lead is flagged "warmed up" (1–50)</p>
            <input type="number" min="1" max="50" className={inputClass} value={warmupThreshold} onChange={e => setWarmupThreshold(e.target.value)} style={{ maxWidth: '120px' }} />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm text-[#8a8680] mb-1">Engagement reminder (days)</label>
            <p className="text-xs text-[#555] mb-2">Leads with no like/comment logged in this many days show up under "Due for Engagement" (1–365)</p>
            <input type="number" min="1" max="365" className={inputClass} value={reminderDays} onChange={e => setReminderDays(e.target.value)} style={{ maxWidth: '120px' }} />
          </div>
        </div>
        <div>
          <Btn variant="primary" size="md" onClick={handleSave} disabled={saving}>{saving ? <Spinner /> : 'Save'}</Btn>
        </div>
      </div>
    </div>
  )
}

// ─── Section: Trash ───────────────────────────────────────────────────────────

function daysLeft(deletedAt) {
  const del = new Date(deletedAt)
  const expiry = new Date(del.getTime() + 7 * 24 * 60 * 60 * 1000)
  return Math.max(0, Math.ceil((expiry - Date.now()) / (1000 * 60 * 60 * 24)))
}

function LeadsTrashSection() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLinkedInTrash().then(d => setLeads(d.leads || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const restore = async (lead) => {
    try {
      await restoreLinkedInTrashLead(lead.id)
      setLeads(prev => prev.filter(l => l.id !== lead.id))
      toast.success(`"${lead.lead_name}" restored`)
    } catch { toast.error('Failed to restore') }
  }

  const deletePermanent = async (lead) => {
    if (!window.confirm(`Permanently delete "${lead.lead_name}"? This cannot be undone.`)) return
    try {
      await permanentDeleteLinkedInLead(lead.id)
      setLeads(prev => prev.filter(l => l.id !== lead.id))
      toast.success('Permanently deleted')
    } catch { toast.error('Failed to delete') }
  }

  return (
    <div className="bg-[#242424] border border-white/[0.08] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#1e1e1e' }}>
        <div>
          <h2 className="text-sm font-semibold text-[#c5c1b9]">Leads Trash</h2>
          <p className="text-xs text-[#8a8680] mt-0.5">Deleted leads are permanently removed after 7 days.</p>
        </div>
        <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: leads.length ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)', color: leads.length ? '#ef4444' : '#555' }}>{leads.length} item{leads.length !== 1 ? 's' : ''}</span>
      </div>
      {loading ? (
        <div className="px-6 py-6 text-sm text-[#8a8680]">Loading…</div>
      ) : leads.length === 0 ? (
        <div className="px-6 py-8 text-sm text-center text-[#555]">No deleted leads</div>
      ) : (
        <div>
          {leads.map(lead => {
            const days = daysLeft(lead.deleted_at)
            return (
              <div key={lead.id} className="flex items-center gap-4 px-6 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="text-sm font-medium text-[#c5c1b9]">{lead.lead_name}</p>
                  <p className="text-xs text-[#8a8680]">{lead.company_name || ''}{lead.specialist_name ? ` · ${lead.specialist_name}` : ''} · {lead.status}</p>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: days <= 2 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)', color: days <= 2 ? '#ef4444' : '#f59e0b' }}>{days === 0 ? 'Expiring today' : `${days}d left`}</span>
                <button onClick={() => restore(lead)} className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all" style={{ background: 'rgba(10,102,194,0.12)', border: '1px solid rgba(10,102,194,0.3)', color: '#5aa8e8' }}>Restore</button>
                <button onClick={() => deletePermanent(lead)} className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>Delete forever</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Page root ────────────────────────────────────────────────────────────────

export default function LinkedInAdmin() {
  const [stages, setStages] = useState([])
  const [settings, setSettings] = useState({ warmup_threshold: '3', engagement_reminder_days: '14' })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [stgs, setts] = await Promise.all([getLinkedInPipelineStages(), getLinkedInSettings()])
      setStages(stgs || [])
      setSettings(setts || { warmup_threshold: '3', engagement_reminder_days: '14' })
    } catch (err) {
      setLoadError('Failed to load admin data. Please try again.')
      toast.error('Failed to load admin data')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="min-h-screen bg-[#1b1b1b] text-[#c5c1b9]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <nav className="flex items-center gap-2 text-sm text-[#8a8680] mb-6">
          <Link to="/outreach/linkedin" className="hover:text-[#c5c1b9] transition-colors">LinkedIn Tracker</Link>
          <span className="text-white/20">/</span>
          <span className="text-[#c5c1b9] font-medium">Admin</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#c5c1b9] tracking-tight">LinkedIn Tracker Admin</h1>
          <p className="text-sm text-[#8a8680] mt-1">
            Manage LinkedIn pipeline stages and engagement settings. Specialists and industries are shared with{' '}
            <Link to="/outreach/admin" className="text-[#0a66c2] hover:underline">Outreach Admin</Link>.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Spinner />
            <p className="text-sm text-[#8a8680]">Loading admin data…</p>
          </div>
        ) : loadError ? (
          <div className="bg-[#242424] border border-white/[0.08] rounded-xl p-8 text-center">
            <p className="text-sm text-[#ef4444] mb-4">{loadError}</p>
            <Btn variant="ghost" size="md" onClick={fetchData}>Retry</Btn>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <PipelineStagesSection stages={stages} setStages={setStages} />
            <SettingsSection settings={settings} setSettings={setSettings} />
            <LeadsTrashSection />
          </div>
        )}
      </div>
    </div>
  )
}
