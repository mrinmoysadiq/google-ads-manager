import { useState, useCallback, useEffect, useRef } from 'react'
import CreatableSelect from 'react-select/creatable'
import { components } from 'react-select'
import toast from 'react-hot-toast'
import { createChannel } from '../../../utils/outreachApi'
import { useChannels, setChannels, CHANNEL_PALETTE, DEFAULT_CHANNEL_COLOR } from '../channels'
import { selectStyles } from './LeadFields'
import ChannelManagerModal from './ChannelManager'

function ChannelLabel({ label, color }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: color, flexShrink: 0 }} />
      {label}
    </span>
  )
}

// Dropdown footer: open the channel manager without leaving the form
function MenuList(props) {
  return (
    <components.MenuList {...props}>
      {props.children}
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); props.selectProps.onManage() }}
        style={{
          display: 'block', width: '100%', textAlign: 'left', marginTop: 4, padding: '7px 10px',
          borderTop: '1px solid rgba(255,255,255,0.08)', color: '#575ECF', fontSize: 12, fontWeight: 600,
          background: 'transparent', cursor: 'pointer',
        }}
      >
        ✎ Manage channels…
      </button>
    </components.MenuList>
  )
}

// Channel picker for touchpoints and replies. Type a new name to add a channel;
// the pencil (or the dropdown footer) opens the manager to rename, recolour or delete.
export default function ChannelSelect({ value, onChange, error = false, placeholder = 'Select or type to add…' }) {
  const channels = useChannels()
  const [managing, setManaging] = useState(false)
  const [creating, setCreating] = useState(false)
  const openManager = useCallback(() => setManaging(true), [])
  const closeManager = useCallback(() => setManaging(false), [])

  // If the selected channel is renamed in the manager, follow it to its new name
  const prevChannels = useRef(channels)
  useEffect(() => {
    const before = prevChannels.current.find(c => c.name === value)
    prevChannels.current = channels
    if (!before || channels.some(c => c.name === value)) return
    const renamed = channels.find(c => c.id === before.id)
    if (renamed) onChange(renamed.name)
  }, [channels, value, onChange])

  const options = channels
    .filter(c => c.active || c.name === value)
    .map(c => ({ value: c.name, label: c.name, color: c.color }))
  // A channel that was deleted after this touchpoint was logged still shows its name
  if (value && !options.some(o => o.value === value)) {
    options.push({ value, label: value, color: DEFAULT_CHANNEL_COLOR })
  }

  const handleCreate = async (input) => {
    const name = input.trim()
    if (!name) return
    setCreating(true)
    try {
      const created = await createChannel({ name, color: CHANNEL_PALETTE[channels.length % CHANNEL_PALETTE.length] })
      setChannels(list => [...list, created])
      onChange(created.name)
      toast.success(`Channel "${created.name}" added`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add channel')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <CreatableSelect
            styles={{
              ...selectStyles,
              control: (base, state) => ({
                ...selectStyles.control(base, state),
                borderColor: error ? '#ef4444' : state.isFocused ? '#575ECF' : 'rgba(255,255,255,0.1)',
              }),
            }}
            menuPortalTarget={document.body}
            components={{ MenuList }}
            onManage={openManager}
            options={options}
            value={options.find(o => o.value === value) || null}
            onChange={opt => onChange(opt?.value || '')}
            onCreateOption={handleCreate}
            formatCreateLabel={input => `+ Add channel "${input.trim()}"`}
            formatOptionLabel={o => (o.__isNew__ ? o.label : <ChannelLabel label={o.label} color={o.color} />)}
            isLoading={creating}
            isDisabled={creating}
            placeholder={placeholder}
            isClearable
          />
        </div>
        <button
          type="button"
          onClick={openManager}
          title="Add, rename or delete channels"
          aria-label="Manage channels"
          style={{
            flexShrink: 0, width: 36, height: 36, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)', color: '#8a8680', cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#c5c1b9'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#8a8680'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.732-6.732a2.5 2.5 0 113.536 3.536L12.536 16.536 8 18l1.464-4.536z" />
          </svg>
        </button>
      </div>
      {managing && <ChannelManagerModal onClose={closeManager} />}
    </>
  )
}
