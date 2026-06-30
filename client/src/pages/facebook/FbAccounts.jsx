import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { getUser } from '../../utils/auth';

const fb = {
  get: (path, cfg) => api.get(`/facebook${path}`, cfg),
  post: (path, data) => api.post(`/facebook${path}`, data),
  patch: (path, data) => api.patch(`/facebook${path}`, data),
  delete: (path) => api.delete(`/facebook${path}`),
};

const NAV_LINKS = [
  { label: '← Hub', path: '/facebook' },
  { label: 'Daily Checklist', path: '/facebook/start' },
  { label: 'Accounts', path: '/facebook/accounts' },
  { label: 'Audit Log', path: '/facebook/audit-log' },
  { label: 'Change Log', path: '/facebook/changelog' },
  { label: 'Admin', path: '/facebook/admin' },
  { label: '🗑 Trash', path: '/facebook/trash' },
];

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text', icon: 'T' },
  { value: 'textarea', label: 'Long Text', icon: '¶' },
  { value: 'number', label: 'Number', icon: '#' },
  { value: 'currency', label: 'Currency', icon: '$' },
  { value: 'url', label: 'URL / Link', icon: '🔗' },
  { value: 'date', label: 'Date', icon: '📅' },
  { value: 'checkbox', label: 'Checkbox (Yes/No)', icon: '✓' },
  { value: 'tags', label: 'Tags (multi-select)', icon: '🏷' },
];

const CURRENCIES = [
  { code: 'USD', symbol: '$',    label: 'USD — US Dollar' },
  { code: 'EUR', symbol: '€',    label: 'EUR — Euro' },
  { code: 'GBP', symbol: '£',    label: 'GBP — British Pound' },
  { code: 'AED', symbol: 'AED ', label: 'AED — UAE Dirham' },
  { code: 'CAD', symbol: 'CA$',  label: 'CAD — Canadian Dollar' },
  { code: 'AUD', symbol: 'A$',   label: 'AUD — Australian Dollar' },
];

// ─── Column order helpers ─────────────────────────────────────────────────────
const BUILTIN_COLS = [
  { key: '__last_audit__', label: 'Last Audit', icon: '📅' },
  { key: '__7d_cpl__',    label: '7D CPL',     icon: '📊' },
  { key: '__3d_cpl__',   label: '3D CPL',     icon: '📊' },
  { key: '__notes__',    label: 'Notes',      icon: '📝' },
];
const BUILTIN_KEYS = BUILTIN_COLS.map(c => c.key);

function defaultColOrder(pinnedFields) {
  return ['__last_audit__', '__7d_cpl__', '__3d_cpl__', ...pinnedFields.map(f => f.field_key), '__notes__'];
}

function reconcileColOrder(saved, pinnedFields) {
  const valid = new Set([...BUILTIN_KEYS, ...pinnedFields.map(f => f.field_key)]);
  const filtered = (saved || []).filter(k => valid.has(k));
  // Add any valid keys missing from saved order
  for (const k of valid) {
    if (!filtered.includes(k)) {
      // Insert custom fields before __notes__, builtins at start
      const notesIdx = filtered.indexOf('__notes__');
      if (BUILTIN_KEYS.includes(k)) filtered.unshift(k);
      else if (notesIdx >= 0) filtered.splice(notesIdx, 0, k);
      else filtered.push(k);
    }
  }
  return filtered.length ? filtered : defaultColOrder(pinnedFields);
}

function loadColOrder() {
  try { return JSON.parse(localStorage.getItem('fb_column_order') || 'null'); } catch { return null; }
}
function saveColOrder(order) {
  localStorage.setItem('fb_column_order', JSON.stringify(order));
}

function parseCurrency(raw) {
  if (!raw) return { currency: 'USD', amount: '' };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return { currency: parsed.currency || 'USD', amount: parsed.amount ?? '' };
  } catch { /* legacy plain number */ }
  return { currency: 'USD', amount: raw };
}

function formatCurrency(currency, amount) {
  if (!amount && amount !== 0) return null;
  const sym = CURRENCIES.find(c => c.code === currency)?.symbol || currency + ' ';
  return `${sym}${parseFloat(amount).toLocaleString()}`;
}

// ─── Field value renderer ──────────────────────────────────────────────────────
function FieldValue({ value, type, options = [], compact = false }) {
  if (value === null || value === undefined || value === '') {
    return <span style={{ color: '#3a3835' }}>—</span>;
  }
  if (type === 'checkbox') {
    const checked = value === '1' || value === 'true' || value === true;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: checked ? '#22c55e' : '#8a8680', fontSize: 12 }}>
        <span style={{ fontSize: 14 }}>{checked ? '✓' : '✗'}</span>
        {!compact && (checked ? 'Yes' : 'No')}
      </span>
    );
  }
  if (type === 'tags') {
    const tags = (() => { try { return JSON.parse(value); } catch { return []; } })();
    if (!tags.length) return <span style={{ color: '#3a3835' }}>—</span>;
    const shown = compact ? tags.slice(0, 2) : tags;
    return (
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {shown.map(t => (
          <span key={t} style={{ background: 'rgba(87,94,207,0.15)', color: '#a5aaee', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 500 }}>{t}</span>
        ))}
        {compact && tags.length > 2 && <span style={{ color: '#8a8680', fontSize: 11 }}>+{tags.length - 2}</span>}
      </span>
    );
  }
  if (type === 'url') {
    return <a href={value} target="_blank" rel="noopener noreferrer" style={{ color: '#575ECF', textDecoration: 'none', fontSize: 13 }}>{value.replace(/^https?:\/\//, '')}</a>;
  }
  if (type === 'currency') {
    const { currency, amount } = parseCurrency(value);
    const formatted = formatCurrency(currency, amount);
    return formatted ? <span style={{ color: '#c5c1b9' }}>{formatted}</span> : <span style={{ color: '#3a3835' }}>—</span>;
  }
  return <span style={{ color: '#c5c1b9' }}>{value}</span>;
}

// ─── Field input component ────────────────────────────────────────────────────
function FieldInput({ field, value, onChange }) {
  const { field_type, field_key, label, options = [] } = field;

  if (field_type === 'checkbox') {
    const checked = value === '1' || value === 'true';
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked ? '1' : '0')} style={{ accentColor: '#575ECF', width: 16, height: 16 }} />
        <span style={{ color: '#c5c1b9', fontSize: 14 }}>{checked ? 'Yes' : 'No'}</span>
      </label>
    );
  }
  if (field_type === 'tags') {
    const selected = (() => { try { return JSON.parse(value || '[]'); } catch { return []; } })();
    const toggle = tag => {
      const next = selected.includes(tag) ? selected.filter(t => t !== tag) : [...selected, tag];
      onChange(JSON.stringify(next));
    };
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map(tag => (
          <button key={tag} onClick={() => toggle(tag)} style={{ background: selected.includes(tag) ? 'rgba(87,94,207,0.3)' : 'rgba(255,255,255,0.05)', border: `1px solid ${selected.includes(tag) ? '#575ECF' : 'rgba(255,255,255,0.1)'}`, color: selected.includes(tag) ? '#a5aaee' : '#8a8680', borderRadius: 20, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
            {tag}
          </button>
        ))}
        {options.length === 0 && <span style={{ color: '#8a8680', fontSize: 13 }}>No tag options defined — add them in field settings.</span>}
      </div>
    );
  }
  if (field_type === 'textarea') {
    return <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={3} placeholder={`Enter ${label}…`} style={inputStyle} />;
  }
  if (field_type === 'date') {
    return <input type="date" value={value || ''} onChange={e => onChange(e.target.value)} style={inputStyle} />;
  }
  if (field_type === 'currency') {
    const { currency, amount } = parseCurrency(value);
    const update = (c, a) => onChange(JSON.stringify({ currency: c, amount: a }));
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={currency} onChange={e => update(e.target.value, amount)}
          style={{ background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 10px', color: '#c5c1b9', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <input type="number" value={amount} onChange={e => update(currency, e.target.value)}
          placeholder="0.00" style={{ ...inputStyle, flex: 1 }} />
      </div>
    );
  }
  return (
    <input
      type={field_type === 'number' ? 'number' : field_type === 'url' ? 'url' : 'text'}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={field_type === 'url' ? 'https://' : `Enter ${label}…`}
      style={inputStyle}
    />
  );
}

// ─── Campaign Breakdown Modal ─────────────────────────────────────────────────
function CampaignBreakdownModal({ account, data, onClose }) {
  const campaigns = data?.campaigns || [];
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }} onClick={onClose}>
      <div style={{ background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, width: '100%', maxWidth: 680, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <p style={{ color: '#c5c1b9', fontWeight: 700, margin: 0, fontSize: 15 }}>Campaign Performance</p>
            <p style={{ color: '#8a8680', fontSize: 12, margin: '3px 0 0' }}>{account.name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8a8680', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {campaigns.map((c, i) => {
            const over7 = c.target_cpl && c.days7?.cpl && parseFloat(c.days7.cpl) >= c.target_cpl * 2;
            const over3 = c.target_cpl && c.days3?.cpl && parseFloat(c.days3.cpl) >= c.target_cpl * 2;
            return (
              <div key={i} style={{ background: '#242424', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <p style={{ color: '#c5c1b9', fontWeight: 600, fontSize: 14, margin: 0, flex: 1 }}>{c.name}</p>
                  {c.target_cpl != null && (
                    <span style={{ fontSize: 11, color: '#8a8680', background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: '2px 7px' }}>Target CPL: {c.target_cpl}</span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[['Last 7 Days', c.days7, over7], ['Last 3 Days', c.days3, over3]].map(([label, d, overTarget]) => (
                    <div key={label} style={{ background: '#2a2a2a', borderRadius: 8, padding: 12 }}>
                      <p style={{ color: '#8a8680', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px' }}>{label}</p>
                      {d?.from && <p style={{ color: '#444', fontSize: 10, margin: '0 0 8px' }}>{d.from} → {d.to}</p>}
                      <div style={{ display: 'flex', gap: 16 }}>
                        <div>
                          <p style={{ color: '#8a8680', fontSize: 10, margin: '0 0 2px' }}>Leads</p>
                          <p style={{ color: '#c5c1b9', fontWeight: 700, fontSize: 16, margin: 0 }}>{d?.leads || '—'}</p>
                        </div>
                        <div>
                          <p style={{ color: '#8a8680', fontSize: 10, margin: '0 0 2px' }}>CPL</p>
                          <p style={{ color: overTarget ? '#ef4444' : (d?.cpl ? '#22c55e' : '#555'), fontWeight: 700, fontSize: 16, margin: 0 }}>
                            {d?.cpl ? `$${parseFloat(d.cpl).toFixed(2)}` : '—'}
                          </p>
                          {overTarget && <p style={{ color: '#ef4444', fontSize: 10, margin: '2px 0 0' }}>⚠ 2× target</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Cell Edit Modal (single custom field) ───────────────────────────────────
function CellEditModal({ fieldDef, value, onSave, onClose }) {
  const [val, setVal] = useState(value ?? '');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }} onClick={onClose}>
      <div style={{ background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 24, width: 340, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ color: '#c5c1b9', fontWeight: 600, margin: 0, fontSize: 15 }}>{fieldDef.label}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8a8680', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <FieldInput field={fieldDef} value={val} onChange={setVal} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ ...smallBtn, padding: '8px 16px', fontSize: 13 }}>Cancel</button>
          <button onClick={() => onSave(val)} style={{ background: '#575ECF', border: 'none', borderRadius: 8, padding: '8px 20px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── Perf Edit Modal (7d/3d performance data) ─────────────────────────────────
function PerfEditModal({ sessionId, initialData, onSave, onClose }) {
  const [form, setForm] = useState({
    days7: { leads: initialData?.days7?.leads ?? '', cpl: initialData?.days7?.cpl ?? '', from: initialData?.days7?.from ?? '', to: initialData?.days7?.to ?? '' },
    days3: { leads: initialData?.days3?.leads ?? '', cpl: initialData?.days3?.cpl ?? '', from: initialData?.days3?.from ?? '', to: initialData?.days3?.to ?? '' },
  });
  const [saving, setSaving] = useState(false);

  const set = (period, field, val) => setForm(p => ({ ...p, [period]: { ...p[period], [field]: val } }));

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/facebook/audit-sessions/${sessionId}`, { performance_data: form });
      onSave(form);
      toast.success('Performance data updated');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }} onClick={onClose}>
      <div style={{ background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 24, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <p style={{ color: '#c5c1b9', fontWeight: 700, margin: 0, fontSize: 16 }}>📊 Edit Performance Data</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8a8680', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        {[['days7', 'Last 7 Days'], ['days3', 'Last 3 Days']].map(([key, label]) => (
          <div key={key} style={{ background: '#242424', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
            <p style={{ color: '#8a8680', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>{label}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>LEADS</label>
                <input type="number" min="0" value={form[key].leads} onChange={e => set(key, 'leads', e.target.value)} placeholder="e.g. 24" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>CPL</label>
                <input type="number" min="0" step="0.01" value={form[key].cpl} onChange={e => set(key, 'cpl', e.target.value)} placeholder="e.g. 12.50" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>FROM DATE</label>
                <input type="date" value={form[key].from} onChange={e => set(key, 'from', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>TO DATE</label>
                <input type="date" value={form[key].to} onChange={e => set(key, 'to', e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onClose} style={{ ...smallBtn, padding: '8px 16px', fontSize: 13 }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ background: '#575ECF', border: 'none', borderRadius: 8, padding: '8px 20px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Account Drawer ───────────────────────────────────────────────────────────
function AccountDrawer({ accountId, fields, onClose, onFieldsSaved, onDelete }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('info');

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    fb.get(`/ad-accounts/${accountId}/detail`)
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load account details'))
      .finally(() => setLoading(false));
  }, [accountId]);

  if (!accountId) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 900 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 520, background: '#1e1e1e', borderLeft: '1px solid rgba(255,255,255,0.08)', zIndex: 901, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.4)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {loading ? <div style={{ color: '#8a8680' }}>Loading…</div> : (
              <>
                <h2 style={{ color: '#c5c1b9', margin: 0, fontSize: 18, fontWeight: 700 }}>{data?.name}</h2>
                {data?.website && <a href={data.website} target="_blank" rel="noopener noreferrer" style={{ color: '#575ECF', fontSize: 13, textDecoration: 'none' }}>{data.website.replace(/^https?:\/\//, '')}</a>}
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {data && onDelete && (
              <button onClick={() => onDelete(data)} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', cursor: 'pointer', fontSize: 13, padding: '6px 12px', fontWeight: 500 }}>🗑 Delete</button>
            )}
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#8a8680', cursor: 'pointer', fontSize: 16, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 24px' }}>
          {[['info', 'Info'], ['audit', 'Audit Log'], ['changes', 'Change Log']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ background: 'none', border: 'none', padding: '12px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: tab === key ? '#575ECF' : '#8a8680', borderBottom: `2px solid ${tab === key ? '#575ECF' : 'transparent'}`, transition: 'color 0.15s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#8a8680' }}>Loading…</div>
          ) : !data ? null : tab === 'info' ? (
            <DrawerInfo data={data} fields={fields} onFieldsSaved={onFieldsSaved} />
          ) : tab === 'audit' ? (
            <DrawerAudit sessions={data.audit_sessions} />
          ) : (
            <DrawerChangelog entries={data.change_log} />
          )}
        </div>
      </div>
    </>
  );
}

function DrawerInfo({ data, fields, onFieldsSaved }) {
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ notes: data.notes || '', custom_fields: { ...(data.custom_fields || {}) } });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fb.patch(`/ad-accounts/${data.id}`, form);
      toast.success('Saved');
      setEditMode(false);
      onFieldsSaved?.();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  }

  function cancel() {
    setForm({ notes: data.notes || '', custom_fields: { ...(data.custom_fields || {}) } });
    setEditMode(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Assigned buyers */}
      <div>
        <p style={sectionLabel}>Assigned Media Buyers</p>
        {data.assigned_buyers?.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.assigned_buyers.map(b => (
              <span key={b} style={{ background: 'rgba(87,94,207,0.12)', color: '#a5aaee', border: '1px solid rgba(87,94,207,0.25)', borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 500 }}>{b}</span>
            ))}
          </div>
        ) : <p style={{ color: '#8a8680', fontSize: 13, margin: 0 }}>No audit sessions yet — buyers will appear here after they run their first daily checklist for this account.</p>}
      </div>

      {/* Latest performance data */}
      {(() => {
        const latest = data.audit_sessions?.find(s => s.performance_data);
        if (!latest) return null;
        const pd = latest.performance_data;
        return (
          <div>
            <p style={sectionLabel}>Latest Performance <span style={{ fontWeight: 400, textTransform: 'none', color: '#555', marginLeft: 4 }}>{latest.date}</span></p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[{ label: 'Last 7 Days', d: pd.days7 }, { label: 'Last 3 Days', d: pd.days3 }].map(({ label, d }) => d && (
                <div key={label} style={{ background: '#242424', borderRadius: 8, padding: '12px 14px' }}>
                  <p style={{ color: '#8a8680', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>{label}</p>
                  {(d.from && d.to) && <p style={{ color: '#555', fontSize: 11, margin: '0 0 10px' }}>{d.from} → {d.to}</p>}
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div>
                      <p style={{ color: '#8a8680', fontSize: 11, margin: '0 0 2px' }}>Leads</p>
                      <p style={{ color: '#c5c1b9', fontWeight: 600, fontSize: 18, margin: 0 }}>{d.leads || '—'}</p>
                    </div>
                    <div>
                      <p style={{ color: '#8a8680', fontSize: 11, margin: '0 0 2px' }}>CPL</p>
                      <p style={{ color: '#22c55e', fontWeight: 600, fontSize: 18, margin: 0 }}>{d.cpl ? `$${parseFloat(d.cpl).toFixed(2)}` : '—'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Notes + custom fields with edit toggle */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <p style={{ ...sectionLabel, margin: 0 }}>Fields</p>
          {!editMode
            ? <button onClick={() => setEditMode(true)} style={{ ...smallBtn, fontSize: 12 }}>✏️ Edit</button>
            : <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={cancel} style={{ ...smallBtn, fontSize: 12 }}>Cancel</button>
                <button onClick={save} disabled={saving} style={{ background: '#575ECF', border: 'none', borderRadius: 6, padding: '5px 14px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 12, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
          }
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Notes */}
          <div style={{ padding: '10px 14px', background: '#242424', borderRadius: 8 }}>
            <span style={{ color: '#8a8680', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: editMode ? 6 : 0 }}>Notes</span>
            {editMode
              ? <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Any notes…" style={{ ...inputStyle, marginTop: 4, resize: 'vertical', fontSize: 13 }} />
              : <p style={{ color: form.notes ? '#c5c1b9' : '#3a3835', fontSize: 13, margin: '4px 0 0', lineHeight: 1.6 }}>{form.notes || '—'}</p>
            }
          </div>

          {/* Custom fields */}
          {fields.map(f => (
            <div key={f.id} style={{ padding: '10px 14px', background: '#242424', borderRadius: 8 }}>
              {editMode
                ? <>
                    <span style={{ color: '#8a8680', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>{f.label}</span>
                    <FieldInput field={f} value={form.custom_fields[f.field_key] ?? ''} onChange={val => setForm(p => ({ ...p, custom_fields: { ...p.custom_fields, [f.field_key]: val } }))} />
                  </>
                : <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ color: '#8a8680', fontSize: 13, fontWeight: 500 }}>{f.label}</span>
                    <span style={{ maxWidth: 240, textAlign: 'right', fontSize: 13 }}>
                      <FieldValue value={form.custom_fields[f.field_key]} type={f.field_type} options={f.options} />
                    </span>
                  </div>
              }
            </div>
          ))}

          {fields.length === 0 && !editMode && (
            <p style={{ color: '#8a8680', fontSize: 13, margin: 0 }}>No custom fields yet — add them in Settings.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DrawerAudit({ sessions }) {
  if (!sessions?.length) return <p style={{ color: '#8a8680', fontSize: 13 }}>No audit sessions recorded for this account yet.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sessions.map(s => (
        <div key={s.id} style={{ background: '#242424', borderRadius: 8, padding: '12px 16px', borderLeft: `3px solid ${s.issue_count > 0 ? '#f59e0b' : '#22c55e'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ color: '#c5c1b9', fontWeight: 500, fontSize: 14 }}>{s.date}</span>
            <span style={{ color: s.issue_count > 0 ? '#f59e0b' : '#22c55e', fontSize: 12, fontWeight: 600 }}>
              {s.issue_count > 0 ? `${s.issue_count} issue${s.issue_count > 1 ? 's' : ''}` : '✓ Clean'}
            </span>
          </div>
          {s.media_buyer && <span style={{ color: '#8a8680', fontSize: 12 }}>by {s.media_buyer}</span>}
          {s.performance_data && (
            <div style={{ display: 'flex', gap: 16, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              {[{ label: '7d', d: s.performance_data.days7 }, { label: '3d', d: s.performance_data.days3 }].map(({ label, d }) => d && (
                <span key={label} style={{ fontSize: 12, color: '#8a8680' }}>
                  <span style={{ color: '#555' }}>{label}: </span>
                  <span style={{ color: '#c5c1b9' }}>{d.leads || '0'} leads</span>
                  {d.cpl && <span style={{ color: '#22c55e' }}> · ${parseFloat(d.cpl).toFixed(2)} CPL</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DrawerChangelog({ entries }) {
  if (!entries?.length) return <p style={{ color: '#8a8680', fontSize: 13 }}>No change log entries recorded for this account yet.</p>;
  const levelColor = { Account: '#3b82f6', Campaign: '#8b5cf6', 'Ad Set': '#f59e0b', Ad: '#22c55e' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.map(e => (
        <div key={e.id} style={{ background: '#242424', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ color: '#c5c1b9', fontWeight: 500, fontSize: 14 }}>{e.date}</span>
            <span style={{ background: `${levelColor[e.change_level] || '#8a8680'}22`, color: levelColor[e.change_level] || '#8a8680', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>{e.change_level}</span>
          </div>
          {e.what_changed && <p style={{ color: '#c5c1b9', fontSize: 13, margin: '4px 0', lineHeight: 1.5 }}>{e.what_changed}</p>}
          {e.why_changed && <p style={{ color: '#8a8680', fontSize: 12, margin: 0 }}>Why: {e.why_changed}</p>}
          {e.media_buyer && <p style={{ color: '#8a8680', fontSize: 12, margin: '4px 0 0' }}>by {e.media_buyer}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Column Order Tab ─────────────────────────────────────────────────────────
function ColumnOrderTab({ columnOrder, pinnedFields, onChange }) {
  const [list, setList] = useState(columnOrder);
  const dragIdx = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  useEffect(() => { setList(columnOrder); }, [columnOrder]);

  function getLabel(key) {
    const b = BUILTIN_COLS.find(c => c.key === key);
    if (b) return { label: b.label, icon: b.icon, builtin: true };
    const f = pinnedFields.find(f => f.field_key === key);
    if (f) return { label: f.label, icon: FIELD_TYPES.find(t => t.value === f.field_type)?.icon || '□', builtin: false };
    return null;
  }

  function move(idx, dir) {
    const next = [...list];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setList(next);
    saveColOrder(next);
    onChange(next);
  }

  function onDragStart(idx) { dragIdx.current = idx; }
  function onDragEnter(idx) { setDragOverIdx(idx); }
  function onDragEnd() {
    if (dragIdx.current !== null && dragOverIdx !== null && dragIdx.current !== dragOverIdx) {
      const next = [...list];
      const [moved] = next.splice(dragIdx.current, 1);
      next.splice(dragOverIdx, 0, moved);
      setList(next);
      saveColOrder(next);
      onChange(next);
    }
    dragIdx.current = null;
    setDragOverIdx(null);
  }

  return (
    <div>
      <p style={{ color: '#8a8680', fontSize: 13, marginBottom: 16 }}>Drag or use arrows to reorder columns. The Account column is always first.</p>
      {/* Fixed first column */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#2a2a2a', borderRadius: 8, marginBottom: 8, opacity: 0.5 }}>
        <span style={{ color: '#444', fontSize: 14 }}>⠿</span>
        <span style={{ color: '#c5c1b9', fontSize: 14, fontWeight: 500 }}>Account</span>
        <span style={{ color: '#8a8680', fontSize: 11, marginLeft: 4 }}>— always first</span>
      </div>
      {list.map((key, idx) => {
        const meta = getLabel(key);
        if (!meta) return null;
        return (
          <div key={key}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragEnter={() => onDragEnter(idx)}
            onDragOver={e => e.preventDefault()}
            onDragEnd={onDragEnd}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: dragOverIdx === idx ? 'rgba(87,94,207,0.12)' : '#2a2a2a', borderRadius: 8, marginBottom: 8, border: `1px solid ${dragOverIdx === idx ? 'rgba(87,94,207,0.4)' : 'transparent'}`, cursor: 'grab', transition: 'background 0.12s' }}>
            <span style={{ color: '#444', fontSize: 14, userSelect: 'none' }}>⠿</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <button onClick={() => move(idx, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', color: idx === 0 ? '#333' : '#8a8680', cursor: idx === 0 ? 'default' : 'pointer', fontSize: 10, lineHeight: 1, padding: '1px 3px' }}>▲</button>
              <button onClick={() => move(idx, 1)} disabled={idx === list.length - 1} style={{ background: 'none', border: 'none', color: idx === list.length - 1 ? '#333' : '#8a8680', cursor: idx === list.length - 1 ? 'default' : 'pointer', fontSize: 10, lineHeight: 1, padding: '1px 3px' }}>▼</button>
            </div>
            <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{meta.icon}</span>
            <span style={{ color: '#c5c1b9', fontWeight: 500, fontSize: 14 }}>{meta.label}</span>
            {meta.builtin && <span style={{ color: '#555', fontSize: 11, marginLeft: 4 }}>built-in</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Settings Modal ───────────────────────────────────────────────────────────
function SettingsModal({ fields, accounts, pinnedFields, columnOrder, onColumnOrderChange, onClose, onSaved }) {
  const [tab, setTab] = useState('fields');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, width: 640, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ color: '#c5c1b9', margin: 0, fontSize: 17, fontWeight: 700 }}>⚙ Settings</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8a8680', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 24px' }}>
          {[['fields', 'Manage Fields'], ['columns', 'Column Order'], ['accounts', 'Manage Accounts']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ background: 'none', border: 'none', padding: '12px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: tab === key ? '#575ECF' : '#8a8680', borderBottom: `2px solid ${tab === key ? '#575ECF' : 'transparent'}` }}>{label}</button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {tab === 'fields' ? (
            <ManageFields fields={fields} onSaved={onSaved} />
          ) : tab === 'columns' ? (
            <ColumnOrderTab columnOrder={columnOrder} pinnedFields={pinnedFields} onChange={onColumnOrderChange} />
          ) : (
            <ManageAccounts accounts={accounts} fields={fields} onSaved={onSaved} />
          )}
        </div>
      </div>
    </div>
  );
}

function ManageFields({ fields, onSaved }) {
  const [list, setList] = useState(fields);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ label: '', field_type: 'text', options: [], pinned: false });
  const [tagInput, setTagInput] = useState('');
  const dragIdx = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  useEffect(() => { setList(fields); }, [fields]);

  function resetForm() { setForm({ label: '', field_type: 'text', options: [], pinned: false }); setTagInput(''); setAdding(false); setEditingId(null); }

  function startEdit(f) {
    setEditingId(f.id);
    setForm({ label: f.label, field_type: f.field_type, options: f.options || [], pinned: !!f.pinned });
    setAdding(true);
  }

  function addTag() {
    if (!tagInput.trim()) return;
    if (!form.options.includes(tagInput.trim())) setForm(p => ({ ...p, options: [...p.options, tagInput.trim()] }));
    setTagInput('');
  }

  async function save() {
    if (!form.label.trim()) return;
    try {
      if (editingId) {
        const res = await fb.patch(`/account-fields/${editingId}`, form);
        setList(prev => prev.map(f => f.id === editingId ? res.data : f));
        toast.success('Field updated');
      } else {
        const res = await fb.post('/account-fields', form);
        setList(prev => [...prev, res.data]);
        toast.success('Field added');
      }
      onSaved();
      resetForm();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save field'); }
  }

  async function del(f) {
    if (!confirm(`Delete field "${f.label}"? All stored values will be lost.`)) return;
    try {
      await fb.delete(`/account-fields/${f.id}`);
      setList(prev => prev.filter(x => x.id !== f.id));
      toast.success('Field deleted');
      onSaved();
    } catch { toast.error('Failed to delete field'); }
  }

  async function togglePinned(f) {
    try {
      const res = await fb.patch(`/account-fields/${f.id}`, { pinned: !f.pinned ? 1 : 0 });
      setList(prev => prev.map(x => x.id === f.id ? res.data : x));
      onSaved();
    } catch { toast.error('Failed to update field'); }
  }

  async function move(idx, dir) {
    const next = [...list];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    await persistOrder(next);
  }

  async function persistOrder(newList) {
    setList(newList);
    try {
      await fb.post('/account-fields/reorder', { order: newList.map((f, i) => ({ id: f.id, sort_order: i + 1 })) });
      onSaved();
    } catch { toast.error('Failed to save order'); }
  }

  function onDragStart(idx) { dragIdx.current = idx; }
  function onDragEnter(idx) { setDragOverIdx(idx); }
  function onDragEnd() {
    if (dragIdx.current !== null && dragOverIdx !== null && dragIdx.current !== dragOverIdx) {
      const next = [...list];
      const [moved] = next.splice(dragIdx.current, 1);
      next.splice(dragOverIdx, 0, moved);
      persistOrder(next);
    }
    dragIdx.current = null;
    setDragOverIdx(null);
  }

  return (
    <div>
      {/* Existing fields */}
      {list.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {list.map((f, idx) => (
            <div key={f.id}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragEnter={() => onDragEnter(idx)}
              onDragOver={e => e.preventDefault()}
              onDragEnd={onDragEnd}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: dragOverIdx === idx ? 'rgba(87,94,207,0.12)' : '#2a2a2a', borderRadius: 8, marginBottom: 8, border: `1px solid ${dragOverIdx === idx ? 'rgba(87,94,207,0.4)' : 'transparent'}`, transition: 'background 0.12s, border-color 0.12s', cursor: 'grab' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Drag handle */}
                <span style={{ color: '#444', fontSize: 14, cursor: 'grab', userSelect: 'none', padding: '0 2px' }} title="Drag to reorder">⠿</span>
                {/* Up/down buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', color: idx === 0 ? '#333' : '#8a8680', cursor: idx === 0 ? 'default' : 'pointer', fontSize: 10, lineHeight: 1, padding: '1px 3px' }}>▲</button>
                  <button onClick={() => move(idx, 1)} disabled={idx === list.length - 1} style={{ background: 'none', border: 'none', color: idx === list.length - 1 ? '#333' : '#8a8680', cursor: idx === list.length - 1 ? 'default' : 'pointer', fontSize: 10, lineHeight: 1, padding: '1px 3px' }}>▼</button>
                </div>
                <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{FIELD_TYPES.find(t => t.value === f.field_type)?.icon}</span>
                <div>
                  <span style={{ color: '#c5c1b9', fontWeight: 500, fontSize: 14 }}>{f.label}</span>
                  <span style={{ color: '#8a8680', fontSize: 12, marginLeft: 8 }}>{FIELD_TYPES.find(t => t.value === f.field_type)?.label}</span>
                  {f.pinned ? <span style={{ color: '#575ECF', fontSize: 11, marginLeft: 8, fontWeight: 600 }}>📌 pinned</span> : null}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => togglePinned(f)} title={f.pinned ? 'Unpin from table' : 'Pin to table'} style={{ ...smallBtn, color: f.pinned ? '#575ECF' : '#8a8680' }}>📌</button>
                <button onClick={() => startEdit(f)} style={smallBtn}>Edit</button>
                <button onClick={() => del(f)} style={{ ...smallBtn, color: '#ef4444', borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit form */}
      {!adding ? (
        <button onClick={() => setAdding(true)} style={{ width: '100%', background: 'rgba(87,94,207,0.1)', border: '1px dashed rgba(87,94,207,0.4)', borderRadius: 8, padding: '12px 0', color: '#575ECF', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          + Add New Field
        </button>
      ) : (
        <div style={{ background: '#242424', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 20 }}>
          <p style={{ color: '#c5c1b9', fontWeight: 600, marginBottom: 16, margin: '0 0 16px' }}>{editingId ? 'Edit Field' : 'New Field'}</p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>FIELD LABEL</label>
              <input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Target CPL" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>FIELD TYPE</label>
              <select value={form.field_type} onChange={e => setForm(p => ({ ...p, field_type: e.target.value, options: [] }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
          </div>

          {form.field_type === 'tags' && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>TAG OPTIONS</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="Type a tag and press Enter" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={addTag} style={{ background: '#575ECF', border: 'none', borderRadius: 8, padding: '0 16px', color: '#fff', cursor: 'pointer' }}>Add</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {form.options.map(t => (
                  <span key={t} style={{ background: 'rgba(87,94,207,0.2)', color: '#a5aaee', borderRadius: 20, padding: '3px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {t}
                    <button onClick={() => setForm(p => ({ ...p, options: p.options.filter(x => x !== t) }))} style={{ background: 'none', border: 'none', color: '#8a8680', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 16 }}>
            <input type="checkbox" checked={!!form.pinned} onChange={e => setForm(p => ({ ...p, pinned: e.target.checked }))} style={{ accentColor: '#575ECF' }} />
            <span style={{ color: '#c5c1b9', fontSize: 13 }}>📌 Pin this field as a column in the overview table</span>
          </label>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={resetForm} style={{ ...smallBtn, padding: '8px 16px', fontSize: 13 }}>Cancel</button>
            <button onClick={save} disabled={!form.label.trim()} style={{ background: '#575ECF', border: 'none', borderRadius: 8, padding: '8px 20px', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: !form.label.trim() ? 0.5 : 1, fontSize: 13 }}>
              {editingId ? 'Save Changes' : 'Add Field'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ManageAccounts({ accounts, fields, onSaved }) {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  function openAdd() {
    setEditingId('new');
    setForm({ name: '', website: '', notes: '', custom_fields: {} });
  }

  function openEdit(a) {
    setEditingId(a.id);
    setForm({ name: a.name, website: a.website || '', notes: a.notes || '', custom_fields: a.custom_fields || {} });
  }

  function close() { setEditingId(null); setForm(null); }

  async function save() {
    if (!form?.name?.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (editingId === 'new') {
        await fb.post('/ad-accounts', form);
        toast.success('Account created');
      } else {
        await fb.patch(`/ad-accounts/${editingId}`, form);
        toast.success('Account updated');
      }
      onSaved();
      close();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  }

  async function toggleActive(a) {
    try {
      await fb.patch(`/ad-accounts/${a.id}`, { active: a.active ? 0 : 1 });
      toast.success(a.active ? 'Deactivated' : 'Reactivated');
      onSaved();
    } catch { toast.error('Failed to update'); }
  }

  async function del(a) {
    if (!confirm(`Delete "${a.name}"? This cannot be undone.`)) return;
    try {
      await fb.delete(`/ad-accounts/${a.id}`);
      toast.success('Deleted');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  }

  const visible = accounts.filter(a => showInactive || a.active);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8a8680', fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} style={{ accentColor: '#575ECF' }} /> Show inactive
        </label>
        <button onClick={openAdd} style={{ background: '#575ECF', border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>+ Add Account</button>
      </div>

      {/* Edit / Add form */}
      {editingId && form && (
        <div style={{ background: '#242424', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 20, marginBottom: 16 }}>
          <p style={{ color: '#c5c1b9', fontWeight: 600, margin: '0 0 16px' }}>{editingId === 'new' ? 'New Account' : 'Edit Account'}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>ACCOUNT NAME *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Acme Corp" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>WEBSITE</label>
              <input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://example.com" style={inputStyle} />
            </div>
            {fields.map(f => (
              <div key={f.id}>
                <label style={labelStyle}>{f.label.toUpperCase()}</label>
                <FieldInput field={f} value={form.custom_fields[f.field_key] || ''} onChange={val => setForm(p => ({ ...p, custom_fields: { ...p.custom_fields, [f.field_key]: val } }))} />
              </div>
            ))}
            <div>
              <label style={labelStyle}>NOTES</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Any notes…" style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={close} style={{ ...smallBtn, padding: '8px 16px', fontSize: 13 }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ background: '#575ECF', border: 'none', borderRadius: 8, padding: '8px 20px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              {saving ? 'Saving…' : editingId === 'new' ? 'Create' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Account list */}
      {visible.length === 0 ? (
        <p style={{ color: '#8a8680', textAlign: 'center', padding: 20 }}>No accounts yet.</p>
      ) : visible.map(a => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#2a2a2a', borderRadius: 8, marginBottom: 8, opacity: a.active ? 1 : 0.5 }}>
          <div>
            <span style={{ color: '#c5c1b9', fontWeight: 500 }}>{a.name}</span>
            {!a.active && <span style={{ color: '#8a8680', fontSize: 11, marginLeft: 8 }}>inactive</span>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => openEdit(a)} style={smallBtn}>Edit</button>
            <button onClick={() => toggleActive(a)} style={smallBtn}>{a.active ? 'Deactivate' : 'Activate'}</button>
            <button onClick={() => del(a)} style={{ ...smallBtn, color: '#ef4444', borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)' }}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Health status helper ─────────────────────────────────────────────────────
function getHealth(lastAuditDate) {
  if (!lastAuditDate) return { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'Never', dot: '#ef4444' };
  const today = new Date().toISOString().slice(0, 10);
  const days = Math.floor((new Date(today) - new Date(lastAuditDate)) / 86400000);
  if (days === 0) return { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', label: 'Today', dot: '#22c55e' };
  if (days === 1) return { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', label: 'Yesterday', dot: '#22c55e' };
  if (days <= 7) return { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: `${days}d ago`, dot: '#f59e0b' };
  return { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: `${days}d ago`, dot: '#ef4444' };
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FbAccounts() {
  const navigate = useNavigate();
  const currentUser = getUser();
  const [accounts, setAccounts] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [buyerFilter, setBuyerFilter] = useState('');
  const [drawerAccountId, setDrawerAccountId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [cellEdit, setCellEdit] = useState(null); // { accountId, fieldDef, value }
  const [perfEdit, setPerfEdit] = useState(null); // { sessionId, data, accountId }
  const [campaignBreakdown, setCampaignBreakdown] = useState(null); // { account, data }

  const fetchAll = useCallback(async () => {
    try {
      const [acctRes, fieldRes] = await Promise.all([
        fb.get('/ad-accounts?all=1'),
        fb.get('/account-fields?all=1'),
      ]);
      setAccounts(Array.isArray(acctRes.data) ? acctRes.data : []);
      setFields(Array.isArray(fieldRes.data) ? fieldRes.data : []);
    } catch {
      toast.error('Failed to load accounts');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const activeFields = fields.filter(f => f.active);
  const pinnedFields = activeFields.filter(f => f.pinned);

  const [columnOrder, setColumnOrder] = useState(() => reconcileColOrder(loadColOrder(), []));

  // Sync column order whenever pinned fields change
  useEffect(() => {
    setColumnOrder(prev => {
      const next = reconcileColOrder(prev, pinnedFields);
      saveColOrder(next);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pinnedFields.map(f => f.field_key))]);

  // Collect all unique tags from pinned tag-type fields across all accounts
  const tagFields = pinnedFields.filter(f => f.field_type === 'tags');
  const allTags = [...new Set(
    accounts.flatMap(a =>
      tagFields.flatMap(f => {
        try { return JSON.parse(a.custom_fields?.[f.field_key] || '[]'); } catch { return []; }
      })
    )
  )].sort();

  // Collect all unique buyers across all accounts (from assigned_buyers)
  const allBuyers = [...new Set(accounts.flatMap(a => a.assigned_buyers || []))].sort();

  const filtered = accounts.filter(a => {
    if (!a.active) return false;
    // Search
    if (search) {
      const q = search.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !(a.website || '').toLowerCase().includes(q) && !(a.notes || '').toLowerCase().includes(q)) return false;
    }
    // Tag filter — account must have ALL selected tags
    if (selectedTags.length > 0) {
      const acctTags = tagFields.flatMap(f => {
        try { return JSON.parse(a.custom_fields?.[f.field_key] || '[]'); } catch { return []; }
      });
      if (!selectedTags.every(t => acctTags.includes(t))) return false;
    }
    // Buyer filter
    if (buyerFilter && !(a.assigned_buyers || []).includes(buyerFilter)) return false;
    return true;
  });

  function toggleTag(tag) {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  const currentUserName = currentUser?.name || '';

  return (
    <div style={{ minHeight: '100vh', background: '#1b1b1b' }}>
      {/* Nav */}
      <div style={{ background: '#1e1e1e', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 28px', display: 'flex', alignItems: 'center', gap: 2 }}>
          {NAV_LINKS.map(link => (
            <button key={link.path} onClick={() => navigate(link.path)}
              style={{ background: 'none', border: 'none', padding: '16px 14px', cursor: 'pointer', fontSize: 14, fontWeight: 500, borderBottom: link.path === '/facebook/accounts' ? '2px solid #575ECF' : '2px solid transparent', color: link.path === '/facebook/accounts' ? '#575ECF' : link.path === '/facebook' ? '#555' : '#8a8680', transition: 'color 0.15s' }}>
              {link.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 28px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ color: '#c5c1b9', margin: 0, fontSize: 22, fontWeight: 700 }}>Facebook Ad Accounts</h1>
            <p style={{ color: '#8a8680', margin: '5px 0 0', fontSize: 14 }}>Click any row to view details, audit history, and change log</p>
          </div>
          <button onClick={() => setShowSettings(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 18px', color: '#c5c1b9', cursor: 'pointer', fontSize: 14 }}>
            <span>⚙</span> Settings
          </button>
        </div>

        {/* Filters row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', width: 280 }}>
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#8a8680', fontSize: 13, pointerEvents: 'none' }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts…"
              style={{ width: '100%', background: '#242424', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px 8px 32px', color: '#c5c1b9', fontSize: 13, boxSizing: 'border-box' }} />
          </div>

          {/* Media buyer filter */}
          {allBuyers.length > 0 && (
            <select value={buyerFilter} onChange={e => setBuyerFilter(e.target.value)}
              style={{ background: buyerFilter ? 'rgba(87,94,207,0.15)' : '#242424', border: `1px solid ${buyerFilter ? '#575ECF' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, padding: '8px 12px', color: buyerFilter ? '#a5aaee' : '#8a8680', fontSize: 13, cursor: 'pointer' }}>
              <option value="">All media buyers</option>
              {allBuyers.map(b => <option key={b} value={b}>{b}{b === currentUserName ? ' (you)' : ''}</option>)}
            </select>
          )}

          {/* Result count */}
          <span style={{ color: '#8a8680', fontSize: 13, marginLeft: 'auto' }}>
            {filtered.length} account{filtered.length !== 1 ? 's' : ''}
            {(search || selectedTags.length || buyerFilter) && <button onClick={() => { setSearch(''); setSelectedTags([]); setBuyerFilter(''); }} style={{ marginLeft: 10, background: 'none', border: 'none', color: '#575ECF', cursor: 'pointer', fontSize: 12 }}>Clear filters</button>}
          </span>
        </div>

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {allTags.map(tag => {
              const active = selectedTags.includes(tag);
              return (
                <button key={tag} onClick={() => toggleTag(tag)}
                  style={{ background: active ? 'rgba(87,94,207,0.25)' : 'rgba(255,255,255,0.04)', border: `1px solid ${active ? '#575ECF' : 'rgba(255,255,255,0.08)'}`, borderRadius: 20, padding: '4px 12px', color: active ? '#a5aaee' : '#8a8680', fontSize: 12, cursor: 'pointer', fontWeight: active ? 600 : 400, transition: 'all 0.12s' }}>
                  {tag}
                </button>
              );
            })}
            {selectedTags.length > 0 && <button onClick={() => setSelectedTags([])} style={{ background: 'none', border: 'none', color: '#8a8680', fontSize: 12, cursor: 'pointer', padding: '4px 8px' }}>✕ clear</button>}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#8a8680' }}>Loading accounts…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#8a8680' }}>
            {accounts.filter(a => a.active).length === 0
              ? 'No active accounts yet — open Settings → Manage Accounts to add one.'
              : 'No accounts match your filters.'}
          </div>
        ) : (
          <div style={{ background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#242424', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <th style={th}>Account</th>
                  {columnOrder.map(key => {
                    const builtin = BUILTIN_COLS.find(c => c.key === key);
                    if (builtin) return <th key={key} style={th}>{builtin.label}</th>;
                    const f = pinnedFields.find(f => f.field_key === key);
                    return f ? <th key={key} style={th}>{f.label}</th> : null;
                  })}
                  <th style={{ ...th, width: 32 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((acct, idx) => {
                  const health = getHealth(acct.last_audit_date);
                  const isMyAccount = currentUserName && (acct.assigned_buyers || []).includes(currentUserName);
                  const pd = acct.last_performance_data;
                  const sessId = acct.last_performance_session_id;
                  return (
                    <tr key={acct.id}
                      onClick={() => setDrawerAccountId(acct.id)}
                      style={{ borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', cursor: 'pointer', transition: 'background 0.12s', background: isMyAccount ? 'rgba(87,94,207,0.04)' : 'transparent', borderLeft: isMyAccount ? '3px solid rgba(87,94,207,0.5)' : '3px solid transparent' }}
                      onMouseEnter={e => e.currentTarget.style.background = isMyAccount ? 'rgba(87,94,207,0.08)' : 'rgba(255,255,255,0.03)'}
                      onMouseLeave={e => e.currentTarget.style.background = isMyAccount ? 'rgba(87,94,207,0.04)' : 'transparent'}>
                      {/* Fixed: Account name */}
                      <td style={td}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ color: '#c5c1b9', fontWeight: 600, fontSize: 14 }}>{acct.name}</span>
                          {acct.website && <a href={acct.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#575ECF', textDecoration: 'none', fontSize: 12 }}>{acct.website.replace(/^https?:\/\//, '')}</a>}
                        </div>
                      </td>
                      {/* Dynamic ordered columns */}
                      {columnOrder.map(key => {
                        if (key === '__last_audit__') return (
                          <td key={key} style={td}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: health.bg, color: health.color, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: health.dot, display: 'inline-block' }} />
                              {health.label}
                            </span>
                          </td>
                        );
                        if (key === '__7d_cpl__' || key === '__3d_cpl__') {
                          const isMulti = pd?.type === 'multi' && pd?.campaigns?.length > 0;
                          const period = key === '__7d_cpl__' ? 'days7' : 'days3';
                          if (isMulti) {
                            return (
                              <td key={key} style={{ ...td, cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setCampaignBreakdown({ account: acct, data: pd }); }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(87,94,207,0.12)', border: '1px solid rgba(87,94,207,0.25)', borderRadius: 6, padding: '3px 8px', color: '#a5aaee', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>
                                  📊 {pd.campaigns.length} campaigns →
                                </span>
                              </td>
                            );
                          }
                          const d = pd?.[period];
                          return (
                            <td key={key} style={{ ...td, cursor: 'pointer' }} onClick={e => { e.stopPropagation(); if (sessId) setPerfEdit({ sessionId: sessId, data: pd, accountId: acct.id }); else toast('No performance session yet — complete a checklist first.'); }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ color: d?.cpl ? '#22c55e' : '#3a3835', fontSize: 13, fontWeight: d?.cpl ? 600 : 400 }}>
                                  {d?.cpl ? `$${parseFloat(d.cpl).toFixed(2)}` : '—'}
                                </span>
                                {d?.from && d?.to && <span style={{ color: '#555', fontSize: 10 }}>{d.from} → {d.to}</span>}
                              </div>
                            </td>
                          );
                        }
                        if (key === '__notes__') return (
                          <td key={key} style={{ ...td, maxWidth: 220, cursor: 'pointer' }}
                            onClick={e => { e.stopPropagation(); setCellEdit({ accountId: acct.id, fieldDef: { field_key: '__notes__', label: 'Notes', field_type: 'textarea', options: [] }, value: acct.notes || '' }); }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {acct.notes
                                ? <span style={{ color: '#8a8680', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }} title={acct.notes}>{acct.notes}</span>
                                : <span style={{ color: '#3a3835' }}>—</span>}
                              <span style={{ color: '#575ECF', fontSize: 10, opacity: 0.5, flexShrink: 0 }}>✏</span>
                            </div>
                          </td>
                        );
                        // Custom pinned field
                        const f = pinnedFields.find(f => f.field_key === key);
                        if (!f) return null;
                        return (
                          <td key={key} style={{ ...td, cursor: 'pointer' }}
                            onClick={e => { e.stopPropagation(); setCellEdit({ accountId: acct.id, fieldDef: f, value: acct.custom_fields?.[f.field_key] ?? '' }); }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                              <FieldValue value={acct.custom_fields?.[f.field_key]} type={f.field_type} options={f.options} compact />
                              <span style={{ color: '#575ECF', fontSize: 10, opacity: 0.5 }}>✏</span>
                            </div>
                          </td>
                        );
                      })}
                      <td style={{ ...td, textAlign: 'right' }}>
                        <span style={{ color: '#575ECF', fontSize: 16 }}>→</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Account drawer */}
      {drawerAccountId && (
        <AccountDrawer
          accountId={drawerAccountId}
          fields={activeFields}
          onClose={() => setDrawerAccountId(null)}
          onFieldsSaved={fetchAll}
          onDelete={(acct) => {
            if (!window.confirm(`Move "${acct.name}" to trash? You can restore it within 7 days.`)) return;
            fb.delete(`/ad-accounts/${acct.id}`)
              .then(() => { setAccounts(prev => prev.filter(a => a.id !== acct.id)); setDrawerAccountId(null); toast.success('Moved to trash'); })
              .catch(() => toast.error('Failed'));
          }}
        />
      )}

      {/* Cell edit modal */}
      {cellEdit && (
        <CellEditModal
          fieldDef={cellEdit.fieldDef}
          value={cellEdit.value}
          onClose={() => setCellEdit(null)}
          onSave={async (val) => {
            try {
              const acct = accounts.find(a => a.id === cellEdit.accountId);
              const payload = cellEdit.fieldDef.field_key === '__notes__'
                ? { notes: val }
                : { custom_fields: { ...(acct?.custom_fields || {}), [cellEdit.fieldDef.field_key]: val } };
              await fb.patch(`/ad-accounts/${cellEdit.accountId}`, payload);
              toast.success('Saved');
              setCellEdit(null);
              fetchAll();
            } catch { toast.error('Failed to save'); }
          }}
        />
      )}

      {/* Perf edit modal */}
      {perfEdit && (
        <PerfEditModal
          sessionId={perfEdit.sessionId}
          initialData={perfEdit.data}
          onClose={() => setPerfEdit(null)}
          onSave={() => { setPerfEdit(null); fetchAll(); }}
        />
      )}

      {campaignBreakdown && (
        <CampaignBreakdownModal
          account={campaignBreakdown.account}
          data={campaignBreakdown.data}
          onClose={() => setCampaignBreakdown(null)}
        />
      )}

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          fields={fields}
          accounts={accounts}
          pinnedFields={pinnedFields}
          columnOrder={columnOrder}
          onColumnOrderChange={next => { setColumnOrder(next); saveColOrder(next); }}
          onClose={() => setShowSettings(false)}
          onSaved={() => { fetchAll(); }}
        />
      )}
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const th = { padding: '11px 16px', textAlign: 'left', color: '#8a8680', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' };
const td = { padding: '14px 16px', verticalAlign: 'middle' };
const inputStyle = { width: '100%', background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 12px', color: '#c5c1b9', fontSize: 14, boxSizing: 'border-box' };
const labelStyle = { color: '#8a8680', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6, letterSpacing: '0.05em' };
const smallBtn = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 10px', color: '#c5c1b9', cursor: 'pointer', fontSize: 12 };
const sectionLabel = { color: '#8a8680', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' };
