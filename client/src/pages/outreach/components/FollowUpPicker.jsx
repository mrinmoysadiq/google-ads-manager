import { addDays } from './kanban/boardModel'
import { fmtDate } from '../../../utils/dates'

const PRESETS = [['Tomorrow', 1], ['3 days', 3], ['1 week', 7], ['2 weeks', 14]]

// Next follow-up: one-click presets, any date, or none
export default function FollowUpPicker({ value, onChange, inputClass }) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
      {PRESETS.map(([label, n]) => {
        const date = addDays(n)
        const active = value === date
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(date)}
            title={fmtDate(date)}
            style={{
              padding: '5px 10px', borderRadius: '999px', fontSize: '12px', cursor: 'pointer',
              color: active ? '#fff' : '#c5c1b9',
              backgroundColor: active ? '#575ECF' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${active ? '#575ECF' : 'rgba(255,255,255,0.1)'}`,
            }}
          >
            {label}
          </button>
        )
      })}
      <input
        type="date"
        aria-label="Next follow-up date"
        className={inputClass}
        value={value || ''}
        onChange={e => onChange(e.target.value || null)}
        style={{ width: 'auto', flex: '1 1 140px', colorScheme: 'dark' }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          style={{ fontSize: '12px', color: '#8a8680', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          None
        </button>
      )}
    </div>
  )
}
