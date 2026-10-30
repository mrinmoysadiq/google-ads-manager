import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { isAdmin } from '../../../utils/auth'
import { createChannel, updateChannel, deleteChannel } from '../../../utils/outreachApi'
import { useChannels, setChannels, refreshChannels, CHANNEL_PALETTE } from '../channels'
import { inputClass } from './LeadFields'

export function ColorSwatch({ value, onChange, title = 'Change colour', disabled = false }) {
  return (
    <label
      className={`relative inline-block w-6 h-6 rounded-md shrink-0 border border-white/20 ${disabled ? '' : 'cursor-pointer'}`}
      style={{ backgroundColor: value }}
      title={disabled ? undefined : title}
    >
      {!disabled && (
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
      )}
    </label>
  )
}

const errorOf = (err, fallback) => err.response?.data?.error || fallback

// Add, rename, recolour and delete channels. Anyone can add; the rest is admin-only
// because a rename rewrites every touchpoint and reply logged on that channel.
export function ChannelList() {
  const channels = useChannels()
  const admin = isAdmin()
  const [addName, setAddName] = useState('')
  const [addColor, setAddColor] = useState(CHANNEL_PALETTE[0])
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const colorTimers = useRef({})

  // Fresh usage counts each time the list is shown
  useEffect(() => { refreshChannels() }, [])

  const handleAdd = async () => {
    const name = addName.trim()
    if (!name) return
    try {
      const created = await createChannel({ name, color: addColor })
      setChannels(list => [...list, created])
      setAddName('')
      setAddColor(CHANNEL_PALETTE[(channels.length + 1) % CHANNEL_PALETTE.length])
      toast.success(`Channel "${created.name}" added`)
    } catch (err) {
      toast.error(errorOf(err, 'Failed to add channel'))
    }
  }

  const update = async (channel, data, message) => {
    const prev = channels
    setChannels(list => list.map(c => (c.id === channel.id ? { ...c, ...data } : c)))
    try {
      const updated = await updateChannel(channel.id, data)
      setChannels(list => list.map(c => (c.id === channel.id ? updated : c)))
      if (message) toast.success(message)
    } catch (err) {
      setChannels(prev)
      toast.error(errorOf(err, 'Failed to update channel'))
    }
  }

  // The native colour input fires on every drag step — save once the user settles
  const changeColor = (channel, color) => {
    setChannels(list => list.map(c => (c.id === channel.id ? { ...c, color } : c)))
    clearTimeout(colorTimers.current[channel.id])
    colorTimers.current[channel.id] = setTimeout(() => update(channel, { color }), 400)
  }

  const commitRename = (channel) => {
    const name = renameValue.trim()
    setRenamingId(null)
    if (name && name !== channel.name) update(channel, { name }, `Renamed to "${name}"`)
  }

  const handleDelete = async (channel) => {
    const uses = channel.usage_count || 0
    const warning = uses > 0
      ? `\n\n${uses} touchpoint${uses === 1 ? '' : 's'}/repl${uses === 1 ? 'y' : 'ies'} already logged on it will keep the name, but it won't be offered any more.`
      : ''
    if (!window.confirm(`Delete channel "${channel.name}"?${warning}`)) return
    try {
      await deleteChannel(channel.id)
      setChannels(list => list.filter(c => c.id !== channel.id))
      toast.success('Channel deleted')
    } catch (err) {
      toast.error(errorOf(err, 'Failed to delete channel'))
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <ColorSwatch value={addColor} onChange={setAddColor} title="Colour for the new channel" />
        <input
          className={inputClass}
          placeholder="New channel, e.g. Phone Call"
          value={addName}
          onChange={e => setAddName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!addName.trim()}
          className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#575ECF' }}
        >
          + Add
        </button>
      </div>

      <ul className="divide-y divide-white/[0.04]">
        {channels.map(channel => (
          <li key={channel.id} className="flex items-center gap-3 py-2 px-1">
            <ColorSwatch value={channel.color} onChange={c => changeColor(channel, c)} disabled={!admin} />
            <div className="flex-1 min-w-0">
              {renamingId === channel.id ? (
                <input
                  className={inputClass}
                  value={renameValue}
                  autoFocus
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(channel)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(channel)
                    if (e.key === 'Escape') { e.stopPropagation(); setRenamingId(null) }
                  }}
                />
              ) : admin ? (
                <button
                  type="button"
                  className="text-sm text-left truncate max-w-full font-medium hover:brightness-125"
                  style={{ color: channel.color }}
                  title="Click to rename"
                  onClick={() => { setRenamingId(channel.id); setRenameValue(channel.name) }}
                >
                  {channel.name}
                </button>
              ) : (
                <span className="text-sm font-medium truncate" style={{ color: channel.color }}>{channel.name}</span>
              )}
            </div>
            {channel.usage_count !== undefined && (
              <span className="text-xs shrink-0" style={{ color: '#8a8680' }}>
                {channel.usage_count} use{channel.usage_count === 1 ? '' : 's'}
              </span>
            )}
            {admin && (
              <button
                type="button"
                onClick={() => handleDelete(channel)}
                className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium"
                style={{ color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
                title="Delete channel"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
      {!admin && (
        <p className="text-xs mt-3" style={{ color: '#8a8680' }}>Only admins can rename or delete channels.</p>
      )}
    </div>
  )
}

export default function ChannelManagerModal({ onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-label="Manage channels"
        className="w-full rounded-xl flex flex-col"
        style={{ maxWidth: 440, maxHeight: '80vh', backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h3 className="text-base font-semibold" style={{ color: '#c5c1b9' }}>Channels</h3>
            <p className="text-xs mt-0.5" style={{ color: '#8a8680' }}>Where touchpoints and replies happen. Click a name to rename it, a swatch to recolour it.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-lg leading-none" style={{ color: '#8a8680' }}>✕</button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">
          <ChannelList />
        </div>
      </div>
    </div>,
    document.body,
  )
}
