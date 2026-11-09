import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FieldGrid, GroupHeading, groupFields, fieldValue, isEmptyFieldValue } from '../LeadFields'

const MUTED = '#8a8680'

// What you need to get a lead into the pipeline; everything else can wait. Laid out in pairs:
// who + company, how to reach them, where they came from + when to follow up, then owners.
const ESSENTIAL_LAYOUT = [
  ['contact_name', 'half'], ['company_name', 'half'],
  ['email', 'half'], ['phone', 'half'],
  ['source_id', 'half'], ['next_followup_date', 'half'],
  ['specialist_ids', 'full'],
]
const ESSENTIAL_KEYS = ESSENTIAL_LAYOUT.map(([k]) => k)

// A group of optional fields, folded until needed (open when it already holds a value)
function MoreGroup({ group, values, customValues, gridProps }) {
  const hasValue = group.fields.some(f => !isEmptyFieldValue(fieldValue(f, values, customValues)))
  const [open, setOpen] = useState(hasValue)
  const names = group.fields.map(f => f.label).join(', ')
  return (
    <section aria-label={group.title}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-white/[0.04]"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <span className="text-xs font-semibold" style={{ color: '#c5c1b9' }}>{open ? '−' : '+'} {group.title}</span>
        {!open && <span className="text-[11px] truncate" style={{ color: '#666' }}>{names}</span>}
      </button>
      {open && (
        <div style={{ padding: '14px 2px 4px' }}>
          <FieldGrid fields={group.fields} values={values} customValues={customValues} live {...gridProps} />
        </div>
      )}
    </section>
  )
}

export default function NewLeadForm({
  fields, values, customValues, onCommit, specialists, industries, sources, canManage, onResizeHeight,
  creating, error, onSubmit, onCancel,
}) {
  // Required fields always sit with the essentials, so nothing required hides in a folded group
  const essentialFields = ESSENTIAL_LAYOUT
    .map(([k, width]) => {
      const f = fields.find(x => x.is_builtin && x.field_key === k)
      return f && { ...f, width }
    })
    .filter(Boolean)
  const requiredExtras = fields.filter(f => f.required && !ESSENTIAL_KEYS.includes(f.field_key))
  const essentials = [...essentialFields, ...requiredExtras]
  const rest = groupFields(fields.filter(f => !ESSENTIAL_KEYS.includes(f.field_key) && !requiredExtras.includes(f)))
  const gridProps = { onCommit, specialists, industries, sources, onResizeHeight }

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit(false) }}
      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSubmit(e.shiftKey) } }}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <section aria-label="Essentials">
          <GroupHeading title="Who is this?">
            {canManage && (
              <Link to="/outreach/admin#fields" style={{ color: '#575ECF', fontSize: '12px', fontWeight: 500, textDecoration: 'none' }}>⚙ Edit fields</Link>
            )}
          </GroupHeading>
          <p className="text-[11px] -mt-1 mb-3" style={{ color: '#666' }}>Add at least a name, company, email or phone — the rest can come later.</p>
          <FieldGrid fields={essentials} values={values} customValues={customValues} live {...gridProps} />
        </section>

        {rest.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: MUTED }}>Optional</p>
            {rest.map(group => (
              <MoreGroup key={group.key} group={group} values={values} customValues={customValues} gridProps={gridProps} />
            ))}
          </div>
        )}
      </div>

      {/* Footer stays put while the form scrolls */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#1e1e1e', padding: '12px 20px' }}>
        {error && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 mb-3 text-[13px] font-medium"
            style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444' }}>
            <span className="shrink-0">⚠</span><span>{error}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-sm" style={{ color: MUTED }}>Cancel</button>
          <span className="flex-1 text-[10px] text-right" style={{ color: '#555' }}>⌘↵ create · ⇧⌘↵ & add another</span>
          <button
            type="button"
            onClick={() => onSubmit(true)}
            disabled={creating}
            title="Create this lead and start a new one (keeps source and specialists)"
            className="rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-60 hover:bg-white/[0.06]"
            style={{ color: '#575ECF', border: '1px solid rgba(87,94,207,0.45)' }}
          >
            Create & add another
          </button>
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: '#575ECF' }}
          >
            {creating ? 'Creating…' : 'Create lead'}
          </button>
        </div>
      </div>
    </form>
  )
}
