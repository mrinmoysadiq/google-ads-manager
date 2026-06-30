import { useState, useEffect, useCallback } from 'react';
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
  { label: 'Daily Checklist', path: '/facebook' },
  { label: 'Accounts', path: '/facebook/accounts' },
  { label: 'Audit Log', path: '/facebook/audit-log' },
  { label: 'Change Log', path: '/facebook/changelog' },
  { label: 'Admin', path: '/facebook/admin' },
];

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text', icon: 'T' },
  { value: 'textarea', label: 'Long Text', icon: '¶' },
  { value: 'number', label: 'Number', icon: '#' },
  { value: 'currency', label: 'Currency ($)', icon: '$' },
  { value: 'url', label: 'URL / Link', icon: '🔗' },
  { value: 'date', label: 'Date', icon: '📅' },
  { value: 'checkbox', label: 'Checkbox (Yes/No)', icon: '✓' },
  { value: 'tags', label: 'Tags (multi-select)', icon: '🏷' },
];

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
  if (type === 'currency') return <span style={{ color: '#c5c1b9' }}>${parseFloat(value).toLocaleString()}</span>;
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
  return (
    <input
      type={field_type === 'number' || field_type === 'currency' ? 'number' : field_type === 'url' ? 'url' : 'text'}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={field_type === 'currency' ? '0.00' : field_type === 'url' ? 'https://' : `Enter ${label}…`}
      style={inputStyle}
    />
  );
}

// ─── Account Drawer ───────────────────────────────────────────────────────────
function AccountDrawer({ accountId, fields, onClose }) {
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
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#8a8680', cursor: 'pointer', fontSize: 16, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
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
            <DrawerInfo data={data} fields={fields} />
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

function DrawerInfo({ data, fields }) {
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

      {/* Built-in fields */}
      {data.notes && (
        <div>
          <p style={sectionLabel}>Notes</p>
          <p style={{ color: '#c5c1b9', fontSize: 14, margin: 0, lineHeight: 1.6, background: '#242424', borderRadius: 8, padding: '10px 14px' }}>{data.notes}</p>
        </div>
      )}

      {/* Custom fields */}
      {fields.length > 0 && (
        <div>
          <p style={sectionLabel}>Custom Fields</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fields.map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 14px', background: '#242424', borderRadius: 8 }}>
                <span style={{ color: '#8a8680', fontSize: 13, fontWeight: 500 }}>{f.label}</span>
                <span style={{ maxWidth: 240, textAlign: 'right', fontSize: 13 }}>
                  <FieldValue value={data.custom_fields?.[f.field_key]} type={f.field_type} options={f.options} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
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

// ─── Settings Modal ───────────────────────────────────────────────────────────
function SettingsModal({ fields, accounts, onClose, onSaved }) {
  const [tab, setTab] = useState('fields');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, width: 640, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ color: '#c5c1b9', margin: 0, fontSize: 17, fontWeight: 700 }}>⚙ Settings</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8a8680', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 24px' }}>
          {[['fields', 'Manage Fields'], ['accounts', 'Manage Accounts']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ background: 'none', border: 'none', padding: '12px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: tab === key ? '#575ECF' : '#8a8680', borderBottom: `2px solid ${tab === key ? '#575ECF' : 'transparent'}` }}>{label}</button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {tab === 'fields' ? (
            <ManageFields fields={fields} onSaved={onSaved} />
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

  return (
    <div>
      {/* Existing fields */}
      {list.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {list.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#2a2a2a', borderRadius: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
      <div style={{ background: '#1e1e1e', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 28px', display: 'flex', alignItems: 'center', gap: 2 }}>
        {NAV_LINKS.map(link => (
          <button key={link.path} onClick={() => navigate(link.path)}
            style={{ background: 'none', border: 'none', padding: '16px 14px', cursor: 'pointer', fontSize: 14, fontWeight: 500, borderBottom: link.path === '/facebook/accounts' ? '2px solid #575ECF' : '2px solid transparent', color: link.path === '/facebook/accounts' ? '#575ECF' : '#8a8680', transition: 'color 0.15s' }}>
            {link.label}
          </button>
        ))}
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
                  <th style={th}>Last Audit</th>
                  {pinnedFields.map(f => <th key={f.id} style={th}>{f.label}</th>)}
                  <th style={th}>Notes</th>
                  <th style={{ ...th, width: 32 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((acct, idx) => {
                  const health = getHealth(acct.last_audit_date);
                  const isMyAccount = currentUserName && (acct.assigned_buyers || []).includes(currentUserName);
                  return (
                    <tr key={acct.id}
                      onClick={() => setDrawerAccountId(acct.id)}
                      style={{ borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', cursor: 'pointer', transition: 'background 0.12s', background: isMyAccount ? 'rgba(87,94,207,0.04)' : 'transparent', borderLeft: isMyAccount ? '3px solid rgba(87,94,207,0.5)' : '3px solid transparent' }}
                      onMouseEnter={e => e.currentTarget.style.background = isMyAccount ? 'rgba(87,94,207,0.08)' : 'rgba(255,255,255,0.03)'}
                      onMouseLeave={e => e.currentTarget.style.background = isMyAccount ? 'rgba(87,94,207,0.04)' : 'transparent'}>
                      <td style={td}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ color: '#c5c1b9', fontWeight: 600, fontSize: 14 }}>{acct.name}</span>
                          {acct.website && <a href={acct.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#575ECF', textDecoration: 'none', fontSize: 12 }}>{acct.website.replace(/^https?:\/\//, '')}</a>}
                        </div>
                      </td>
                      <td style={td}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: health.bg, color: health.color, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: health.dot, display: 'inline-block' }} />
                          {health.label}
                        </span>
                      </td>
                      {pinnedFields.map(f => (
                        <td key={f.id} style={td}>
                          <FieldValue value={acct.custom_fields?.[f.field_key]} type={f.field_type} options={f.options} compact />
                        </td>
                      ))}
                      <td style={{ ...td, maxWidth: 220 }}>
                        {acct.notes
                          ? <span style={{ color: '#8a8680', fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }} title={acct.notes}>{acct.notes}</span>
                          : <span style={{ color: '#3a3835' }}>—</span>}
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>
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
        />
      )}

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          fields={fields}
          accounts={accounts}
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
