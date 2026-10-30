import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import Select from 'react-select'
import toast from 'react-hot-toast'
import ImagePasteZone from '../../../components/ImagePasteZone'

// ─── Shared styles ────────────────────────────────────────────────────────────

export const inputClass =
  'w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#575ECF] transition-colors'

export const selectStyles = {
  control: (base, { isFocused }) => ({
    ...base,
    backgroundColor: '#2a2a2a',
    borderColor: isFocused ? '#575ECF' : 'rgba(255,255,255,0.1)',
    boxShadow: 'none',
    minHeight: '36px',
    fontSize: '13px',
    '&:hover': { borderColor: isFocused ? '#575ECF' : 'rgba(255,255,255,0.2)' },
  }),
  menu: (base) => ({ ...base, backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)', zIndex: 100 }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  menuList: (base) => ({ ...base, padding: '4px' }),
  option: (base, { isFocused, isSelected }) => ({
    ...base,
    backgroundColor: isSelected ? '#575ECF' : isFocused ? 'rgba(87,94,207,0.15)' : 'transparent',
    color: '#c5c1b9',
    fontSize: '13px',
    borderRadius: '6px',
    cursor: 'pointer',
  }),
  singleValue: (base) => ({ ...base, color: '#c5c1b9' }),
  placeholder: (base) => ({ ...base, color: '#8a8680' }),
  input: (base) => ({ ...base, color: '#c5c1b9' }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base) => ({ ...base, color: '#8a8680', padding: '0 8px' }),
  clearIndicator: (base) => ({ ...base, color: '#8a8680' }),
  multiValue: (base) => ({ ...base, backgroundColor: 'rgba(87,94,207,0.25)', borderRadius: '4px' }),
  multiValueLabel: (base) => ({ ...base, color: '#c5c1b9', fontSize: '12px', padding: '1px 4px' }),
  multiValueRemove: (base) => ({ ...base, color: '#8a8680', borderRadius: '0 4px 4px 0', ':hover': { backgroundColor: 'rgba(239,68,68,0.2)', color: '#ef4444' } }),
}

// Types an admin can pick for a custom field (built-ins have their own fixed types)
export const CUSTOM_FIELD_TYPES = [
  { value: 'short_text',  label: 'Short text',   icon: 'T' },
  { value: 'text',        label: 'Long text',    icon: '¶' },
  { value: 'number',      label: 'Number',       icon: '#' },
  { value: 'email',       label: 'Email',        icon: '@' },
  { value: 'phone',       label: 'Phone',        icon: '☎' },
  { value: 'link',        label: 'Link',         icon: '🔗' },
  { value: 'date',        label: 'Date',         icon: '📅' },
  { value: 'dropdown',    label: 'Dropdown',     icon: '▾' },
  { value: 'multiselect', label: 'Multi-select', icon: '☰' },
  { value: 'checkbox',    label: 'Checkbox',     icon: '☑' },
  { value: 'image',       label: 'Image',        icon: '🖼' },
]

const BUILTIN_TYPE_LABELS = { industry: 'Industry list', specialists: 'Specialists' }

export function fieldTypeLabel(type) {
  return CUSTOM_FIELD_TYPES.find(t => t.value === type)?.label || BUILTIN_TYPE_LABELS[type] || type
}

const PLACEHOLDERS = {
  company_name: 'Acme Corp',
  contact_name: 'Jane Smith',
  job_title: 'CEO',
  website: 'example.com or https://example.com',
  location: 'New York, NY',
  email: 'contact@example.com',
  phone: '+1 (555) 000-0000',
  fb_page_url: 'https://facebook.com/…',
  ig_url: 'https://instagram.com/…',
  linkedin_url: 'https://linkedin.com/in/…',
  source_url: 'LinkedIn profile, website, etc.',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Bare domains like "example.com" would otherwise resolve as a relative link
export function normalizeUrl(url) {
  if (!url) return ''
  const trimmed = url.trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

// Multi-select values are stored as a JSON array string
function parseList(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
}

export function isEmptyFieldValue(value) {
  return value === undefined || value === null || value === '[]' ||
    (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)
}

// Key used for the "Saved ✓" flash next to a field label
export function savedKeyFor(field) {
  return field.is_builtin ? field.field_key : `custom_${field.field_key}`
}

function SavedIndicator({ show }) {
  if (!show) return null
  return <span style={{ color: '#22c55e', fontSize: '11px', marginLeft: '6px' }}>Saved ✓</span>
}

const labelStyle = { display: 'block', fontSize: '11px', color: '#8a8680', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }

// ─── One field's input ────────────────────────────────────────────────────────

// `live` (create form): commit on every change. Otherwise (edit): commit on blur/select,
// only when the value actually changed. Required fields refuse to be cleared in edit mode.
function FieldControl({ field, value, onCommit, live, specialists, industries, onResizeHeight }) {
  const [nonce, setNonce] = useState(0)
  const textareaRef = useRef(null)
  const { field_type: type, field_key: key } = field

  const commit = (next) => {
    if (!live && field.required && isEmptyFieldValue(next)) {
      toast.error(`${field.label} is required`)
      setNonce(n => n + 1) // re-mount the input so it shows the saved value again
      return
    }
    onCommit(next)
  }

  // Plain inputs (text-like, number, date)
  const textInput = (inputType) => {
    const shown = inputType === 'date' && value ? String(value).slice(0, 10) : (value ?? '')
    return live ? (
      <input
        type={inputType}
        className={inputClass}
        value={shown}
        onChange={e => commit(e.target.value)}
        placeholder={PLACEHOLDERS[key] || ''}
      />
    ) : (
      <input
        key={`${value}-${nonce}`}
        type={inputType}
        className={inputClass}
        defaultValue={shown}
        onBlur={e => { if (e.target.value !== String(shown)) commit(e.target.value || null) }}
        placeholder="—"
      />
    )
  }

  switch (type) {
    case 'short_text':
    case 'phone':
      return textInput('text')
    case 'email':
      return textInput('email')
    case 'number':
      return textInput('number')
    case 'date':
      return textInput('date')

    case 'link':
      return (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>{textInput('text')}</div>
          {value && (
            <a href={normalizeUrl(value)} target="_blank" rel="noopener noreferrer" title={`Open ${field.label}`}
              style={{ color: '#575ECF', fontSize: '16px', textDecoration: 'none', flexShrink: 0, lineHeight: 1 }}>↗</a>
          )}
        </div>
      )

    case 'text': {
      const height = field.height_px || 80
      // Admins can drag the corner to set the height for everyone
      const handleMouseUp = () => {
        const el = textareaRef.current
        if (el && onResizeHeight && Math.round(el.offsetHeight) !== height) onResizeHeight(Math.round(el.offsetHeight))
      }
      return live ? (
        <textarea ref={textareaRef} className={inputClass} value={value ?? ''} onChange={e => commit(e.target.value)}
          onMouseUp={handleMouseUp} style={{ height, resize: 'vertical' }} />
      ) : (
        <textarea
          ref={textareaRef}
          key={`${value}-${nonce}`}
          className={inputClass}
          defaultValue={value ?? ''}
          onBlur={e => { if (e.target.value !== (value ?? '')) commit(e.target.value || null) }}
          onMouseUp={handleMouseUp}
          placeholder="—"
          style={{ height, resize: 'vertical' }}
        />
      )
    }

    case 'dropdown': {
      // Keep showing a value whose option was later removed
      const names = [...(field.options || [])]
      if (value && !names.includes(value)) names.push(value)
      const opts = names.map(o => ({ value: o, label: o }))
      return (
        <Select
          key={nonce}
          styles={selectStyles}
          menuPortalTarget={document.body}
          options={opts}
          value={opts.find(o => o.value === value) || null}
          onChange={opt => commit(opt?.value || null)}
          placeholder="Select…"
          isClearable
        />
      )
    }

    case 'multiselect': {
      const selected = parseList(value)
      const names = [...new Set([...(field.options || []), ...selected])]
      const opts = names.map(o => ({ value: o, label: o }))
      return (
        <Select
          key={nonce}
          isMulti
          styles={selectStyles}
          menuPortalTarget={document.body}
          options={opts}
          value={opts.filter(o => selected.includes(o.value))}
          onChange={list => commit(list.map(o => o.value))}
          placeholder="Select…"
          closeMenuOnSelect={false}
        />
      )
    }

    case 'checkbox': {
      const checked = value === '1' || value === true
      return (
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => commit(checked ? '0' : '1')}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${checked ? 'bg-[#575ECF]' : 'bg-white/10'}`}
        >
          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      )
    }

    case 'image':
      return <ImagePasteZone value={value || null} onChange={v => commit(v)} maxHeight={400} />

    case 'industry': {
      const opts = industries
        .filter(i => i.active || i.id === value)
        .map(i => ({ value: i.id, label: i.name }))
      return (
        <Select
          key={nonce}
          styles={selectStyles}
          menuPortalTarget={document.body}
          options={opts}
          value={opts.find(o => o.value === value) || null}
          onChange={opt => commit(opt?.value || null)}
          placeholder="Select industry…"
          isClearable
        />
      )
    }

    case 'specialists': {
      const opts = specialists.map(s => ({ value: s.id, label: s.name }))
      const ids = Array.isArray(value) ? value : []
      return (
        <Select
          key={nonce}
          isMulti
          styles={selectStyles}
          menuPortalTarget={document.body}
          options={opts}
          value={opts.filter(o => ids.includes(o.value))}
          onChange={list => commit(list.map(o => o.value))}
          placeholder="Assign specialist(s)…"
          closeMenuOnSelect={false}
        />
      )
    }

    default:
      return textInput('text')
  }
}

// ─── The whole form ───────────────────────────────────────────────────────────

// Renders lead fields in the admin-configured order and widths.
// `values` holds built-in values (keyed like the lead columns, specialist_ids as an array);
// `customValues` holds custom field values. `onCommit(field, value)` saves one field.
export default function LeadFields({
  fields, values, customValues, onCommit, live = false, saved = {},
  specialists = [], industries = [], canManage = false, onResizeHeight,
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      {canManage && (
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginBottom: '-8px' }}>
          <Link to="/outreach/admin#fields" style={{ color: '#575ECF', fontSize: '12px', fontWeight: 500, textDecoration: 'none' }}>
            ⚙ Edit fields
          </Link>
        </div>
      )}
      {fields.map(field => {
        const value = field.is_builtin ? values?.[field.field_key] : customValues?.[field.field_key]
        return (
          <div key={field.id} style={{ gridColumn: field.width === 'full' ? '1 / -1' : 'auto', minWidth: 0 }}>
            <label style={labelStyle}>
              {field.label}
              {field.required && <span style={{ color: '#ef4444' }}> *</span>}
              <SavedIndicator show={saved[savedKeyFor(field)]} />
            </label>
            <FieldControl
              field={field}
              value={value}
              live={live}
              specialists={specialists}
              industries={industries}
              onCommit={v => onCommit(field, v)}
              onResizeHeight={onResizeHeight ? h => onResizeHeight(field, h) : undefined}
            />
            {field.help_text && (
              <p style={{ color: '#666', fontSize: '11px', margin: '4px 0 0' }}>{field.help_text}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
