import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  getDashboard, getOverdueLeads, exportCsv, getExportPdfUrl,
  getDashboardCards, createDashboardCard, updateDashboardCard, deleteDashboardCard,
  getActivity,
} from '../../../utils/outreachApi';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_KNOWN_STATUSES = [
  'New Lead',
  'Touchpoint 1', 'Touchpoint 2', 'Touchpoint 3', 'Touchpoint 4', 'Touchpoint 5',
  'Responded', 'Interested', 'Not Interested', 'Appointment Booked',
  'No Show', 'Meeting Done - Not Interested', 'Started Trial',
  'Closed / Booked as Client', 'Disqualified / Dead',
];

const PRESET_COLORS = [
  '#575ECF', '#3b82f6', '#a855f7', '#f59e0b', '#22c55e',
  '#ef4444', '#06b6d4', '#8a8680', '#ec4899', '#f97316',
];

const FUNNEL_STAGES = [
  { key: 'total_contacted', label: 'Contacted', color: '#8a8680' },
  { key: 'responded',       label: 'Responded', color: '#3b82f6' },
  { key: 'interested',      label: 'Interested', color: '#a855f7' },
  { key: 'appointments_booked', label: 'Booked', color: '#f59e0b' },
  { key: 'closed',          label: 'Closed', color: '#22c55e' },
];

const CHANNEL_COLORS = {
  LinkedIn: '#0a66c2', Email: '#575ECF', WhatsApp: '#25d366',
  Facebook: '#1877f2', Instagram: '#e1306c', SMS: '#8a8680',
  'Website Form': '#06b6d4', Other: '#6b7280',
};

const DATE_RANGE_OPTIONS = [
  { value: 'today',     label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week',      label: 'This Week' },
  { value: 'month',     label: 'This Month' },
  { value: 'last30',    label: 'Last 30 Days' },
  { value: 'last90',    label: 'Last 90 Days' },
  { value: 'alltime',   label: 'All Time' },
  { value: 'custom',    label: 'Custom' },
];

const ACTIVITY_DATE_RANGE_OPTIONS = [
  { value: 'today',     label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week',      label: 'This Week' },
  { value: 'last30',    label: 'Last 30 Days' },
  { value: 'custom',    label: 'Custom' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDateParams(dateRange, customFrom, customTo) {
  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  switch (dateRange) {
    case 'today':
      return { date_from: fmt(today), date_to: fmt(today) };
    case 'yesterday': {
      const yest = new Date(today);
      yest.setDate(today.getDate() - 1);
      return { date_from: fmt(yest), date_to: fmt(yest) };
    }
    case 'week': {
      const day = today.getDay();
      const mon = new Date(today);
      mon.setDate(today.getDate() - ((day + 6) % 7));
      return { date_from: fmt(mon), date_to: fmt(today) };
    }
    case 'month': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { date_from: fmt(from), date_to: fmt(today) };
    }
    case 'last30': {
      const from = new Date(today);
      from.setDate(today.getDate() - 30);
      return { date_from: fmt(from), date_to: fmt(today) };
    }
    case 'last90': {
      const from = new Date(today);
      from.setDate(today.getDate() - 90);
      return { date_from: fmt(from), date_to: fmt(today) };
    }
    case 'alltime':
      return {};
    case 'custom':
      return {
        ...(customFrom ? { date_from: customFrom } : {}),
        ...(customTo   ? { date_to:   customTo   } : {}),
      };
    default:
      return {};
  }
}

function daysOverdue(nextFollowupDate) {
  if (!nextFollowupDate) return null;
  const due = new Date(nextFollowupDate);
  const now = new Date();
  const diff = Math.floor((now - due) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

// Compute the numeric value (or percent string) for a card from by_status map + total
function computeCardValue(card, byStatus, totalLeads) {
  if (!byStatus) return '—';
  const numStatuses = card.numerator_statuses || [];

  // Empty numerator = total leads
  if (numStatuses.length === 0) {
    if (card.card_type === 'rate') return '0%';
    return totalLeads;
  }

  const numCount = numStatuses.reduce((sum, s) => sum + (byStatus[s] || 0), 0);

  if (card.card_type === 'count') return numCount;

  // rate
  let denCount = 0;
  if (card.denominator === 'total') {
    denCount = totalLeads;
  } else if (Array.isArray(card.denominator)) {
    denCount = card.denominator.reduce((sum, s) => sum + (byStatus[s] || 0), 0);
  } else {
    denCount = totalLeads;
  }
  if (!denCount) return '0%';
  return ((numCount / denCount) * 100).toFixed(1) + '%';
}

function computeCardSub(card, byStatus, totalLeads) {
  if (!byStatus) return '';
  const numStatuses = card.numerator_statuses || [];
  if (numStatuses.length === 0) return 'total leads in period';

  const numCount = numStatuses.reduce((sum, s) => sum + (byStatus[s] || 0), 0);

  if (card.card_type === 'count') {
    if (card.denominator === 'total') return `of ${totalLeads} total leads`;
    if (Array.isArray(card.denominator)) {
      const denCount = card.denominator.reduce((sum, s) => sum + (byStatus[s] || 0), 0);
      return `of ${denCount}`;
    }
    return '';
  }

  // rate
  let denCount = 0;
  if (card.denominator === 'total') {
    denCount = totalLeads;
    return `${numCount} of ${totalLeads} total`;
  } else if (Array.isArray(card.denominator)) {
    denCount = card.denominator.reduce((sum, s) => sum + (byStatus[s] || 0), 0);
    return `${numCount} of ${denCount}`;
  }
  return '';
}

// ─── Small components ─────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
      <div style={{
        width: 36, height: 36,
        border: '3px solid rgba(255,255,255,0.1)',
        borderTopColor: '#575ECF',
        borderRadius: '50%',
        animation: 'spin 0.75s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function MetricCard({ label, value, sub, color, onEdit }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: '#242424',
        border: `1px solid ${hovered ? (color || '#575ECF') : 'rgba(255,255,255,0.08)'}`,
        position: 'relative',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Edit button — appears on hover */}
      {hovered && (
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <button
            onClick={onEdit}
            title="Edit card"
            style={{
              background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 5,
              color: '#c5c1b9', cursor: 'pointer', width: 24, height: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem',
            }}
          >✏️</button>
        </div>
      )}

      {/* Color accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        borderRadius: '12px 12px 0 0',
        backgroundColor: color || '#575ECF',
        opacity: 0.7,
      }} />

      <p style={{
        color: '#8a8680', fontSize: '0.65rem', textTransform: 'uppercase',
        letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600,
        paddingTop: 4,
      }}>
        {label}
      </p>
      <p style={{ color: '#ffffff', fontSize: '1.875rem', fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>
        {value ?? '—'}
      </p>
      {sub && <p style={{ color: '#8a8680', fontSize: '0.72rem', marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

// ─── Card Edit Modal ──────────────────────────────────────────────────────────

const BLANK_CARD = {
  label: '',
  card_type: 'count',
  numerator_statuses: [],
  denominator: 'total',
  denominator_type: 'total',  // 'total' | 'custom'
  denominator_custom: [],
  color: '#575ECF',
};

function CardModal({ card, allStatuses, onClose, onSave, onDelete }) {
  const isEdit = !!card?.id;
  const [form, setForm] = useState(() => {
    if (!card) return { ...BLANK_CARD };
    const denominatorType = card.denominator === 'total' ? 'total' : 'custom';
    const denominatorCustom = Array.isArray(card.denominator) ? card.denominator : [];
    return {
      label: card.label || '',
      card_type: card.card_type || 'count',
      numerator_statuses: card.numerator_statuses || [],
      denominator: card.denominator || 'total',
      denominator_type: denominatorType,
      denominator_custom: denominatorCustom,
      color: card.color || '#575ECF',
    };
  });
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleStatus = (key, status) => {
    setForm(f => {
      const arr = f[key] || [];
      return {
        ...f,
        [key]: arr.includes(status) ? arr.filter(s => s !== status) : [...arr, status],
      };
    });
  };

  async function handleSave() {
    if (!form.label.trim()) { toast.error('Label is required'); return; }
    setSaving(true);
    try {
      const denominator = form.card_type === 'rate'
        ? (form.denominator_type === 'total' ? 'total' : form.denominator_custom)
        : 'total';
      await onSave({
        label: form.label.trim(),
        card_type: form.card_type,
        numerator_statuses: form.numerator_statuses,
        denominator,
        color: form.color,
      });
      onClose();
    } catch (err) {
      toast.error('Failed to save card');
    } finally {
      setSaving(false);
    }
  }

  const overlay = {
    position: 'fixed', inset: 0, zIndex: 9999,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
  };
  const modal = {
    backgroundColor: '#1a1a1a', borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.1)',
    width: '100%', maxWidth: 560,
    maxHeight: '90vh', overflowY: 'auto',
    padding: 28,
    color: '#c5c1b9',
  };
  const label = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8a8680', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' };
  const input = {
    width: '100%', boxSizing: 'border-box',
    backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, color: '#c5c1b9', padding: '8px 12px', fontSize: '0.9rem',
  };
  const section = { marginBottom: 20 };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
            {isEdit ? 'Edit Metric Card' : 'Add Metric Card'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8a8680', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Label */}
        <div style={section}>
          <label style={label}>Card Name</label>
          <input style={input} value={form.label} onChange={e => set('label', e.target.value)} placeholder="e.g. Response Rate" />
        </div>

        {/* Card type */}
        <div style={section}>
          <label style={label}>Card Type</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {[['count', 'Count (#)'], ['rate', 'Rate (%)']].map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => set('card_type', val)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                  fontSize: '0.85rem', border: '1px solid',
                  borderColor: form.card_type === val ? '#575ECF' : 'rgba(255,255,255,0.12)',
                  backgroundColor: form.card_type === val ? 'rgba(87,94,207,0.15)' : 'transparent',
                  color: form.card_type === val ? '#575ECF' : '#8a8680',
                }}
              >{lbl}</button>
            ))}
          </div>
        </div>

        {/* Numerator statuses */}
        <div style={section}>
          <label style={label}>
            {form.card_type === 'rate' ? 'Numerator — count leads in these stages' : 'Count leads in these stages'}
            <span style={{ color: '#575ECF', marginLeft: 6, textTransform: 'none', fontWeight: 400 }}>
              {form.numerator_statuses.length === 0 ? '(empty = total leads)' : `(${form.numerator_statuses.length} selected)`}
            </span>
          </label>
          <div style={{
            backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '10px 12px',
            display: 'flex', flexWrap: 'wrap', gap: 6,
            maxHeight: 160, overflowY: 'auto',
          }}>
            {allStatuses.map(s => {
              const active = form.numerator_statuses.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleStatus('numerator_statuses', s)}
                  style={{
                    padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem',
                    cursor: 'pointer', border: '1px solid',
                    borderColor: active ? form.color : 'rgba(255,255,255,0.1)',
                    backgroundColor: active ? `${form.color}22` : 'transparent',
                    color: active ? form.color : '#8a8680',
                    fontWeight: active ? 600 : 400,
                    transition: 'all 0.12s',
                  }}
                >{s}</button>
              );
            })}
          </div>
        </div>

        {/* Denominator — only for rate cards */}
        {form.card_type === 'rate' && (
          <div style={section}>
            <label style={label}>Denominator — divide by</label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              {[['total', 'Total Leads'], ['custom', 'Custom Stages']].map(([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => set('denominator_type', val)}
                  style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                    fontSize: '0.82rem', border: '1px solid',
                    borderColor: form.denominator_type === val ? '#575ECF' : 'rgba(255,255,255,0.12)',
                    backgroundColor: form.denominator_type === val ? 'rgba(87,94,207,0.15)' : 'transparent',
                    color: form.denominator_type === val ? '#575ECF' : '#8a8680',
                  }}
                >{lbl}</button>
              ))}
            </div>
            {form.denominator_type === 'custom' && (
              <div style={{
                backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '10px 12px',
                display: 'flex', flexWrap: 'wrap', gap: 6,
                maxHeight: 140, overflowY: 'auto',
              }}>
                {allStatuses.map(s => {
                  const active = form.denominator_custom.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggleStatus('denominator_custom', s)}
                      style={{
                        padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem',
                        cursor: 'pointer', border: '1px solid',
                        borderColor: active ? '#f59e0b' : 'rgba(255,255,255,0.1)',
                        backgroundColor: active ? 'rgba(245,158,11,0.12)' : 'transparent',
                        color: active ? '#f59e0b' : '#8a8680',
                        fontWeight: active ? 600 : 400,
                        transition: 'all 0.12s',
                      }}
                    >{s}</button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Color */}
        <div style={section}>
          <label style={label}>Color</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => set('color', c)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', backgroundColor: c,
                  border: form.color === c ? '2px solid #fff' : '2px solid transparent',
                  cursor: 'pointer', transition: 'border 0.1s',
                }}
                title={c}
              />
            ))}
            <input
              type="color"
              value={form.color}
              onChange={e => set('color', e.target.value)}
              style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0 }}
              title="Custom color"
            />
          </div>
        </div>

        {/* Formula preview */}
        <div style={{
          backgroundColor: '#242424', borderRadius: 8, padding: '10px 14px',
          fontSize: '0.78rem', color: '#8a8680', marginBottom: 20,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ color: form.color, fontWeight: 600 }}>Formula: </span>
          {form.card_type === 'count' ? (
            form.numerator_statuses.length === 0
              ? 'Total leads in period'
              : `Count of leads in [${form.numerator_statuses.join(', ')}]`
          ) : (
            `( Count of [${form.numerator_statuses.join(', ') || 'all leads'}] ) ÷ (${
              form.denominator_type === 'total'
                ? 'Total Leads'
                : form.denominator_custom.length > 0
                  ? `Count of [${form.denominator_custom.join(', ')}]`
                  : 'Custom stages (none selected)'
            }) × 100%`
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Delete — only shown when editing an existing card */}
          {isEdit && onDelete ? (
            <button
              onClick={onDelete}
              style={{
                padding: '8px 16px', borderRadius: 8,
                border: '1px solid rgba(239,68,68,0.3)',
                backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444',
                cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500,
              }}
            >Delete Card</button>
          ) : <span />}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 20px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.12)',
                backgroundColor: 'transparent', color: '#8a8680',
                cursor: 'pointer', fontSize: '0.875rem',
              }}
            >Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '8px 24px', borderRadius: 8,
                border: 'none', backgroundColor: '#575ECF',
                color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem', fontWeight: 600, opacity: saving ? 0.7 : 1,
              }}
            >{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Card'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard({ specialistId, specialists, onLeadClick, refreshKey }) {
  const [dateRange, setDateRange] = useState('alltime');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [metrics, setMetrics] = useState(null);
  const [cards, setCards] = useState([]);
  const [overdueLeads, setOverdueLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalCard, setModalCard] = useState(null);   // null = closed, {} = new, {...card} = edit
  const [modalOpen, setModalOpen] = useState(false);

  // Activity section — independent date filter, defaults to yesterday
  const [actDateRange, setActDateRange] = useState('yesterday');
  const [actCustomFrom, setActCustomFrom] = useState('');
  const [actCustomTo, setActCustomTo] = useState('');
  const [activity, setActivity] = useState(null);
  const [actLoading, setActLoading] = useState(true);

  // Collect all statuses for the formula builder (from by_status + known statuses)
  const allStatuses = metrics?.by_status
    ? [...new Set([...ALL_KNOWN_STATUSES, ...Object.keys(metrics.by_status)])]
    : ALL_KNOWN_STATUSES;

  const fetchCards = useCallback(async () => {
    try {
      const data = await getDashboardCards();
      setCards(data);
    } catch (err) {
      console.error('Failed to load dashboard cards', err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const dateParams = getDateParams(dateRange, customFrom, customTo);
      const params = { ...dateParams };
      if (specialistId) params.specialist_id = specialistId;

      const [dashRes, overdueRes] = await Promise.all([
        getDashboard(params),
        getOverdueLeads(params),
      ]);

      setMetrics(dashRes);
      setOverdueLeads(overdueRes || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [dateRange, customFrom, customTo, specialistId]);

  // Initial load
  useEffect(() => {
    fetchCards();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when date/specialist changes
  useEffect(() => {
    if (dateRange === 'custom' && (!customFrom || !customTo)) return;
    fetchData();
  }, [fetchData, dateRange, customFrom, customTo]);

  // Re-fetch when parent bumps refreshKey (lead saved/deleted/moved)
  useEffect(() => {
    if (refreshKey === undefined) return;
    fetchData();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchActivity = useCallback(async () => {
    setActLoading(true);
    try {
      const dateParams = getDateParams(actDateRange, actCustomFrom, actCustomTo);
      const params = { ...dateParams };
      if (specialistId) params.specialist_id = specialistId;
      const data = await getActivity(params);
      setActivity(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load activity data');
    } finally {
      setActLoading(false);
    }
  }, [actDateRange, actCustomFrom, actCustomTo, specialistId]);

  useEffect(() => {
    if (actDateRange === 'custom' && (!actCustomFrom || !actCustomTo)) return;
    fetchActivity();
  }, [fetchActivity]);

  // Re-fetch activity when refreshKey bumps too
  useEffect(() => {
    if (refreshKey === undefined) return;
    fetchActivity();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Export handlers ──────────────────────────────────────────────────────

  async function handleExportCsv() {
    try {
      const params = { ...getDateParams(dateRange, customFrom, customTo) };
      if (specialistId) params.specialist_id = specialistId;
      const blob = await exportCsv(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'outreach-export.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('CSV export failed'); }
  }

  function handleExportPdf() {
    const params = { ...getDateParams(dateRange, customFrom, customTo) };
    if (specialistId) params.specialist_id = specialistId;
    window.open(getExportPdfUrl(params), '_blank');
  }

  // ── Card CRUD handlers ───────────────────────────────────────────────────

  async function handleCardSave(data) {
    if (modalCard?.id) {
      const updated = await updateDashboardCard(modalCard.id, data);
      setCards(prev => prev.map(c => c.id === modalCard.id ? updated : c));
      toast.success('Card updated');
    } else {
      const created = await createDashboardCard({ ...data, sort_order: cards.length });
      setCards(prev => [...prev, created]);
      toast.success('Card added');
    }
  }

  async function handleCardDelete(cardId) {
    try {
      await deleteDashboardCard(cardId);
      setCards(prev => prev.filter(c => c.id !== cardId));
      toast.success('Card deleted');
    } catch { toast.error('Failed to delete card'); }
  }

  // ── Derived values ───────────────────────────────────────────────────────

  const m = metrics || {};
  const byStatus = m.by_status || {};
  const totalLeads = m.total_leads || 0;
  const byChannel = m.by_channel ? Object.entries(m.by_channel).map(([ch, cnt]) => ({ channel: ch, count: cnt })) : [];
  const bySpecialist = m.by_specialist || [];
  const sortedChannels = [...byChannel].sort((a, b) => (b.count || 0) - (a.count || 0));
  const maxChannelCount = sortedChannels.length > 0 ? sortedChannels[0].count : 1;

  const cardStyle  = { backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' };
  const mutedText  = { color: '#8a8680' };
  const primaryText = { color: '#c5c1b9' };

  return (
    <div style={{ color: '#c5c1b9' }}>

      {/* ── Top bar: date range + exports ─────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        gap: 12, marginBottom: 24, justifyContent: 'space-between',
      }}>
        {/* Date range pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {DATE_RANGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDateRange(opt.value)}
              style={{
                padding: '5px 14px', borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.12)',
                fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor: dateRange === opt.value ? '#575ECF' : 'transparent',
                color: dateRange === opt.value ? '#ffffff' : '#8a8680',
              }}
            >{opt.label}</button>
          ))}
          {dateRange === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#c5c1b9', padding: '4px 8px', fontSize: '0.8rem' }} />
              <span style={mutedText}>–</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#c5c1b9', padding: '4px 8px', fontSize: '0.8rem' }} />
            </div>
          )}
        </div>

        {/* Export buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleExportCsv} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'transparent', color: '#c5c1b9', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            ↓ Export CSV
          </button>
          <button onClick={handleExportPdf} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'transparent', color: '#c5c1b9', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            ↗ Export PDF
          </button>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* ── Custom Metric Cards ───────────────────────────────────── */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ color: '#8a8680', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, margin: 0 }}>
                Metrics
              </p>
              <button
                onClick={() => { setModalCard({}); setModalOpen(true); }}
                style={{
                  padding: '4px 14px', borderRadius: 999,
                  border: '1px solid rgba(87,94,207,0.4)',
                  backgroundColor: 'rgba(87,94,207,0.1)',
                  color: '#575ECF', fontSize: '0.78rem', fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                }}
              >+ Add Card</button>
            </div>

            {cards.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '32px 0',
                border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12,
                color: '#8a8680', fontSize: '0.85rem',
              }}>
                No metric cards yet.{' '}
                <button
                  onClick={() => { setModalCard({}); setModalOpen(true); }}
                  style={{ color: '#575ECF', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
                >Add your first card →</button>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 12,
              }}>
                {cards.map(card => (
                  <MetricCard
                    key={card.id}
                    label={card.label}
                    value={computeCardValue(card, byStatus, totalLeads)}
                    sub={computeCardSub(card, byStatus, totalLeads)}
                    color={card.color}
                    onEdit={() => { setModalCard(card); setModalOpen(true); }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Funnel + Channel ──────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {/* Conversion Funnel */}
            <div className="rounded-xl p-6" style={cardStyle}>
              <h3 style={{ ...primaryText, fontWeight: 600, fontSize: '0.9rem', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Conversion Funnel
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {FUNNEL_STAGES.map((stage, idx) => {
                  const count = m[stage.key] || 0;
                  const barWidth = totalLeads > 0 ? Math.max((count / totalLeads) * 100, 2) : 2;
                  const prevStage = idx > 0 ? FUNNEL_STAGES[idx - 1] : null;
                  const prevCount = prevStage ? (m[prevStage.key] || 0) : null;
                  const ofPrev = prevCount != null && prevCount > 0
                    ? ((count / prevCount) * 100).toFixed(0) + '% of prev'
                    : null;
                  return (
                    <div key={stage.key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.75rem' }}>
                        <span style={{ color: stage.color, fontWeight: 600 }}>{stage.label}</span>
                        <span style={mutedText}>
                          {count.toLocaleString()}
                          {ofPrev && <span style={{ marginLeft: 6, color: 'rgba(255,255,255,0.3)' }}>({ofPrev})</span>}
                        </span>
                      </div>
                      <div style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${barWidth}%`, backgroundColor: stage.color, borderRadius: 999, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Activity by Channel */}
            <div className="rounded-xl p-6" style={cardStyle}>
              <h3 style={{ ...primaryText, fontWeight: 600, fontSize: '0.9rem', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Activity by Channel
              </h3>
              {sortedChannels.length === 0 ? (
                <p style={{ ...mutedText, fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>No channel data available</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sortedChannels.map(ch => {
                    const color = CHANNEL_COLORS[ch.channel] || CHANNEL_COLORS.Other;
                    const barPct = maxChannelCount > 0 ? Math.max((ch.count / maxChannelCount) * 100, 2) : 2;
                    return (
                      <div key={ch.channel} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ ...mutedText, fontSize: '0.75rem', width: 90, flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.channel}</span>
                        <div style={{ flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${barPct}%`, backgroundColor: color, borderRadius: 999, transition: 'width 0.6s ease' }} />
                        </div>
                        <span style={{ ...mutedText, fontSize: '0.75rem', width: 32, flexShrink: 0, textAlign: 'right' }}>{ch.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Team Performance (admin only) ─────────────────────────── */}
          {!specialistId && bySpecialist.length > 0 && (
            <div className="rounded-xl p-6" style={{ ...cardStyle, marginBottom: 24 }}>
              <h3 style={{ ...primaryText, fontWeight: 600, fontSize: '0.9rem', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Team Performance
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      {['Specialist', 'Total Leads', 'Responded', 'Booked', 'Closed', 'Closed Rate'].map(col => (
                        <th key={col} style={{ ...mutedText, textAlign: col === 'Specialist' ? 'left' : 'right', padding: '6px 12px', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bySpecialist.map((sp, idx) => {
                      const closedRate = (sp.total || 0) > 0 ? (((sp.closed || 0) / (sp.total || 0)) * 100).toFixed(1) + '%' : '0%';
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ ...primaryText, padding: '8px 12px' }}>{sp.name || '—'}</td>
                          <td style={{ ...mutedText, padding: '8px 12px', textAlign: 'right' }}>{sp.total || 0}</td>
                          <td style={{ ...mutedText, padding: '8px 12px', textAlign: 'right' }}>{sp.responded || 0}</td>
                          <td style={{ ...mutedText, padding: '8px 12px', textAlign: 'right' }}>{sp.booked || 0}</td>
                          <td style={{ ...mutedText, padding: '8px 12px', textAlign: 'right' }}>{sp.closed || 0}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#22c55e', fontWeight: 600 }}>{closedRate}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Daily Activity ────────────────────────────────────────── */}
          <div style={{ marginBottom: 24 }}>
            {/* Section header + date filter */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center',
              justifyContent: 'space-between', gap: 12, marginBottom: 16,
            }}>
              <h3 style={{ color: '#c5c1b9', fontWeight: 700, fontSize: '1rem', margin: 0 }}>
                Daily Activity
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {ACTIVITY_DATE_RANGE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setActDateRange(opt.value)}
                    style={{
                      padding: '4px 12px', borderRadius: 999,
                      border: '1px solid rgba(255,255,255,0.12)',
                      fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer',
                      transition: 'all 0.15s',
                      backgroundColor: actDateRange === opt.value ? '#575ECF' : 'transparent',
                      color: actDateRange === opt.value ? '#ffffff' : '#8a8680',
                    }}
                  >{opt.label}</button>
                ))}
                {actDateRange === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="date" value={actCustomFrom} onChange={e => setActCustomFrom(e.target.value)}
                      style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#c5c1b9', padding: '3px 8px', fontSize: '0.78rem' }} />
                    <span style={{ color: '#8a8680' }}>–</span>
                    <input type="date" value={actCustomTo} onChange={e => setActCustomTo(e.target.value)}
                      style={{ backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#c5c1b9', padding: '3px 8px', fontSize: '0.78rem' }} />
                  </div>
                )}
              </div>
            </div>

            {actLoading ? <Spinner /> : activity && (
              <>
                {/* Summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'New Leads Created', value: activity.new_leads_total, color: '#22c55e' },
                    { label: 'Stage Movements',   value: activity.stage_moves_by_stage.reduce((s, r) => s + r.moves_count, 0), color: '#575ECF' },
                    { label: 'Leads Worked On',   value: activity.stage_moves_by_stage.reduce((s, r) => s + r.leads_count, 0), color: '#f59e0b' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl p-5" style={{
                      backgroundColor: '#242424',
                      border: '1px solid rgba(255,255,255,0.08)',
                      position: 'relative',
                    }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '12px 12px 0 0', backgroundColor: color, opacity: 0.7 }} />
                      <p style={{ color: '#8a8680', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600, paddingTop: 4 }}>{label}</p>
                      <p style={{ color: '#ffffff', fontSize: '1.875rem', fontWeight: 700, lineHeight: 1 }}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Stage breakdown + Team activity side by side */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                  {/* Stage movement breakdown */}
                  <div className="rounded-xl p-6" style={cardStyle}>
                    <h4 style={{ ...primaryText, fontWeight: 600, fontSize: '0.85rem', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Stage Movements
                    </h4>
                    {activity.stage_moves_by_stage.length === 0 ? (
                      <p style={{ ...mutedText, fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>No stage movements in this period</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px', gap: 8, padding: '4px 8px', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#8a8680', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 4 }}>
                          <span>Stage</span>
                          <span style={{ textAlign: 'right' }}>Leads</span>
                          <span style={{ textAlign: 'right' }}>Moves</span>
                        </div>
                        {activity.stage_moves_by_stage.map(row => (
                          <div key={row.stage} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px', gap: 8, padding: '6px 8px', borderRadius: 6, fontSize: '0.82rem' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <span style={{ color: '#c5c1b9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.stage}</span>
                            <span style={{ color: '#8a8680', textAlign: 'right' }}>{row.leads_count}</span>
                            <span style={{ color: '#575ECF', fontWeight: 600, textAlign: 'right' }}>{row.moves_count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Team activity */}
                  <div className="rounded-xl p-6" style={cardStyle}>
                    <h4 style={{ ...primaryText, fontWeight: 600, fontSize: '0.85rem', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Team Activity
                    </h4>
                    {activity.activity_by_specialist.length === 0 ? (
                      <p style={{ ...mutedText, fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>No activity in this period</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px', gap: 8, padding: '4px 8px', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#8a8680', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 4 }}>
                          <span>Specialist</span>
                          <span style={{ textAlign: 'right' }}>New</span>
                          <span style={{ textAlign: 'right' }}>Worked</span>
                          <span style={{ textAlign: 'right' }}>Moves</span>
                        </div>
                        {activity.activity_by_specialist.map(sp => (
                          <div key={sp.name} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px', gap: 8, padding: '6px 8px', borderRadius: 6, fontSize: '0.82rem' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <span style={{ color: '#c5c1b9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sp.name}</span>
                            <span style={{ color: '#22c55e', fontWeight: 600, textAlign: 'right' }}>{sp.new_leads || 0}</span>
                            <span style={{ color: '#f59e0b', fontWeight: 500, textAlign: 'right' }}>{sp.leads_worked || 0}</span>
                            <span style={{ color: '#575ECF', fontWeight: 600, textAlign: 'right' }}>{sp.stage_moves || 0}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </>
            )}
          </div>

          {/* ── Overdue Follow-ups ────────────────────────────────────── */}
          <div className="rounded-xl p-6" style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <h3 style={{ ...primaryText, fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                ⚠ Overdue Follow-ups
              </h3>
              {overdueLeads.length > 0 && (
                <span style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(245,158,11,0.3)' }}>
                  {overdueLeads.length}
                </span>
              )}
            </div>
            {overdueLeads.length === 0 ? (
              <p style={{ ...mutedText, fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>No overdue follow-ups 🎉</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr', gap: 12, padding: '4px 10px', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#8a8680', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 4 }}>
                  <span>Company</span><span>Contact</span><span>Specialist</span><span style={{ textAlign: 'right' }}>Overdue</span>
                </div>
                {overdueLeads.map(lead => {
                  const days = daysOverdue(lead.next_followup_date);
                  const specialistName = (specialists || []).find(s => s.id === lead.specialist_id)?.name || lead.specialist_name || '—';
                  return (
                    <div
                      key={lead.id}
                      style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr', gap: 12, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s', fontSize: '0.82rem' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      onClick={() => onLeadClick && onLeadClick(lead.id)}
                    >
                      <span style={{ color: '#575ECF', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.company_name || lead.company || '—'}</span>
                      <span style={{ ...mutedText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.contact_name || lead.contact || '—'}</span>
                      <span style={{ ...mutedText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{specialistName}</span>
                      <span style={{ textAlign: 'right', fontWeight: 600, color: days >= 7 ? '#ef4444' : days >= 3 ? '#f59e0b' : '#c5c1b9', whiteSpace: 'nowrap' }}>
                        {days != null ? `${days}d` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Card Add/Edit Modal ──────────────────────────────────────── */}
      {modalOpen && (
        <CardModal
          card={modalCard}
          allStatuses={allStatuses}
          onClose={() => { setModalOpen(false); setModalCard(null); }}
          onSave={handleCardSave}
          onDelete={modalCard?.id ? async () => {
            await handleCardDelete(modalCard.id);
            setModalOpen(false);
            setModalCard(null);
          } : undefined}
        />
      )}
    </div>
  );
}
