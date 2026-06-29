import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({ baseURL: '/api/facebook' });
const setAuth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('app_token')}` } });

const NAV_LINKS = [
  { label: 'Daily Checklist', path: '/facebook' },
  { label: 'Accounts', path: '/facebook/accounts' },
  { label: 'Audit Log', path: '/facebook/audit-log' },
  { label: 'Change Log', path: '/facebook/changelog' },
  { label: 'Admin', path: '/facebook/admin' },
];

// ─── Field type options ───────────────────────────────────────────────────────
const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'url', label: 'URL' },
  { value: 'currency', label: 'Currency' },
];

function formatFieldValue(value, type) {
  if (!value && value !== 0) return <span style={{ color: '#4a4845' }}>—</span>;
  if (type === 'currency') return `$${parseFloat(value).toLocaleString()}`;
  if (type === 'url') return (
    <a href={value} target="_blank" rel="noopener noreferrer" style={{ color: '#575ECF', textDecoration: 'none' }}>
      {value.replace(/^https?:\/\//, '')}
    </a>
  );
  return value;
}

// ─── Manage Fields Modal ──────────────────────────────────────────────────────
function ManageFieldsModal({ fields, onClose, onSaved }) {
  const [list, setList] = useState(fields);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('text');
  const [adding, setAdding] = useState(false);

  async function addField() {
    if (!newLabel.trim()) return;
    setAdding(true);
    try {
      const res = await api.post('/account-fields', { label: newLabel.trim(), field_type: newType }, setAuth());
      setList(prev => [...prev, res.data]);
      setNewLabel('');
      setNewType('text');
      toast.success('Field added');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add field');
    } finally { setAdding(false); }
  }

  async function deleteField(field) {
    if (!confirm(`Delete field "${field.label}"? All stored values will be lost.`)) return;
    try {
      await api.delete(`/account-fields/${field.id}`, setAuth());
      setList(prev => prev.filter(f => f.id !== field.id));
      toast.success('Field deleted');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete field');
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#242424', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 28, width: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: '#c5c1b9', margin: 0, fontSize: 18, fontWeight: 600 }}>Manage Custom Fields</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8a8680', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 20 }}>
          {list.length === 0 && (
            <p style={{ color: '#8a8680', textAlign: 'center', padding: '20px 0' }}>No custom fields yet</p>
          )}
          {list.map(field => (
            <div key={field.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#2a2a2a', borderRadius: 8, marginBottom: 8 }}>
              <div>
                <span style={{ color: '#c5c1b9', fontWeight: 500 }}>{field.label}</span>
                <span style={{ color: '#8a8680', fontSize: 12, marginLeft: 8 }}>{FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}</span>
              </div>
              <button onClick={() => deleteField(field)} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>
                Delete
              </button>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
          <p style={{ color: '#8a8680', fontSize: 13, marginBottom: 12 }}>Add new field</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addField()}
              placeholder="Field label (e.g. Target CPL)"
              style={{ flex: 1, background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: '#c5c1b9', fontSize: 14 }}
            />
            <select
              value={newType}
              onChange={e => setNewType(e.target.value)}
              style={{ background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: '#c5c1b9', fontSize: 14 }}
            >
              {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <button onClick={addField} disabled={adding || !newLabel.trim()} style={{ width: '100%', background: '#575ECF', border: 'none', borderRadius: 8, padding: '10px 0', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: (adding || !newLabel.trim()) ? 0.5 : 1 }}>
            {adding ? 'Adding…' : 'Add Field'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Account Modal (add / edit) ───────────────────────────────────────────────
function AccountModal({ account, fields, onClose, onSaved }) {
  const isEdit = !!account;
  const [form, setForm] = useState({
    name: account?.name || '',
    website: account?.website || '',
    notes: account?.notes || '',
    custom_fields: account?.custom_fields || {},
  });
  const [saving, setSaving] = useState(false);

  function setCustom(key, val) {
    setForm(prev => ({ ...prev, custom_fields: { ...prev.custom_fields, [key]: val } }));
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Account name is required'); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/ad-accounts/${account.id}`, form, setAuth());
        toast.success('Account updated');
      } else {
        await api.post('/ad-accounts', form, setAuth());
        toast.success('Account created');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save account');
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#242424', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 28, width: 520, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ color: '#c5c1b9', margin: 0, fontSize: 18, fontWeight: 600 }}>{isEdit ? 'Edit Account' : 'Add Account'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8a8680', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ color: '#8a8680', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>ACCOUNT NAME *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Acme Corp — Meta Ads"
              style={{ width: '100%', background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', color: '#c5c1b9', fontSize: 14, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ color: '#8a8680', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>WEBSITE</label>
            <input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://example.com"
              style={{ width: '100%', background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', color: '#c5c1b9', fontSize: 14, boxSizing: 'border-box' }} />
          </div>
          {fields.map(field => (
            <div key={field.id}>
              <label style={{ color: '#8a8680', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>{field.label.toUpperCase()}</label>
              <input
                type={field.field_type === 'number' || field.field_type === 'currency' ? 'number' : 'text'}
                value={form.custom_fields[field.field_key] || ''}
                onChange={e => setCustom(field.field_key, e.target.value)}
                placeholder={field.field_type === 'currency' ? '0.00' : field.field_type === 'url' ? 'https://' : ''}
                style={{ width: '100%', background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', color: '#c5c1b9', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
          ))}
          <div>
            <label style={{ color: '#8a8680', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>NOTES</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Any notes about this account…"
              style={{ width: '100%', background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', color: '#c5c1b9', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 20px', color: '#c5c1b9', cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ background: '#575ECF', border: 'none', borderRadius: 8, padding: '10px 24px', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FbAccounts() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [accountModal, setAccountModal] = useState(null); // null | 'new' | account object
  const [manageFields, setManageFields] = useState(false);
  const [search, setSearch] = useState('');

  async function fetchAll() {
    try {
      const [acctRes, fieldRes] = await Promise.all([
        api.get('/ad-accounts?all=1', setAuth()),
        api.get('/account-fields', setAuth()),
      ]);
      setAccounts(acctRes.data);
      setFields(fieldRes.data);
    } catch (err) {
      toast.error('Failed to load accounts');
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchAll(); }, []);

  async function toggleActive(account) {
    try {
      await api.patch(`/ad-accounts/${account.id}`, { active: account.active ? 0 : 1 }, setAuth());
      toast.success(account.active ? 'Account deactivated' : 'Account reactivated');
      fetchAll();
    } catch (err) {
      toast.error('Failed to update account');
    }
  }

  async function deleteAccount(account) {
    if (!confirm(`Delete "${account.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/ad-accounts/${account.id}`, setAuth());
      toast.success('Account deleted');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete account');
    }
  }

  const filtered = accounts.filter(a => {
    if (!showInactive && !a.active) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.name.toLowerCase().includes(q) || (a.website || '').toLowerCase().includes(q) || (a.notes || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#1b1b1b' }}>
      {/* Nav */}
      <div style={{ background: '#242424', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 4 }}>
        {NAV_LINKS.map(link => (
          <button key={link.path} onClick={() => navigate(link.path)}
            style={{ background: 'none', border: 'none', padding: '16px 14px', cursor: 'pointer', fontSize: 14, fontWeight: 500, borderBottom: link.path === '/facebook/accounts' ? '2px solid #575ECF' : '2px solid transparent', color: link.path === '/facebook/accounts' ? '#575ECF' : '#8a8680', transition: 'color 0.15s' }}>
            {link.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h1 style={{ color: '#c5c1b9', margin: 0, fontSize: 24, fontWeight: 700 }}>Facebook Ad Accounts</h1>
            <p style={{ color: '#8a8680', margin: '6px 0 0', fontSize: 14 }}>Master list — single source of truth for all Facebook modules</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setManageFields(true)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 16px', color: '#c5c1b9', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              ⚙ Manage Fields
            </button>
            <button onClick={() => setAccountModal('new')} style={{ background: '#575ECF', border: 'none', borderRadius: 8, padding: '10px 20px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
              + Add Account
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts…"
            style={{ flex: 1, maxWidth: 320, background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '9px 14px', color: '#c5c1b9', fontSize: 14 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8a8680', fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} style={{ accentColor: '#575ECF' }} />
            Show inactive
          </label>
          <span style={{ color: '#8a8680', fontSize: 13, marginLeft: 'auto' }}>{filtered.length} account{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#8a8680' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#8a8680' }}>
            {accounts.length === 0 ? 'No accounts yet — click "Add Account" to get started.' : 'No accounts match your filter.'}
          </div>
        ) : (
          <div style={{ background: '#242424', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#2a2a2a', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={thStyle}>Account Name</th>
                    <th style={thStyle}>Website</th>
                    {fields.map(f => <th key={f.id} style={thStyle}>{f.label}</th>)}
                    <th style={thStyle}>Notes</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((acct, idx) => (
                    <tr key={acct.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', opacity: acct.active ? 1 : 0.5 }}>
                      <td style={tdStyle}>
                        <span style={{ color: '#c5c1b9', fontWeight: 500 }}>{acct.name}</span>
                      </td>
                      <td style={tdStyle}>
                        {acct.website ? (
                          <a href={acct.website} target="_blank" rel="noopener noreferrer" style={{ color: '#575ECF', textDecoration: 'none', fontSize: 13 }}>
                            {acct.website.replace(/^https?:\/\//, '')}
                          </a>
                        ) : <span style={{ color: '#4a4845' }}>—</span>}
                      </td>
                      {fields.map(f => (
                        <td key={f.id} style={tdStyle}>
                          <span style={{ color: '#c5c1b9', fontSize: 13 }}>
                            {formatFieldValue(acct.custom_fields?.[f.field_key], f.field_type)}
                          </span>
                        </td>
                      ))}
                      <td style={{ ...tdStyle, maxWidth: 200 }}>
                        {acct.notes ? (
                          <span style={{ color: '#8a8680', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: 200 }} title={acct.notes}>{acct.notes}</span>
                        ) : <span style={{ color: '#4a4845' }}>—</span>}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ background: acct.active ? 'rgba(34,197,94,0.12)' : 'rgba(138,134,128,0.12)', color: acct.active ? '#22c55e' : '#8a8680', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                          {acct.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => setAccountModal(acct)} style={actionBtnStyle}>Edit</button>
                          <button onClick={() => toggleActive(acct)} style={actionBtnStyle}>{acct.active ? 'Deactivate' : 'Activate'}</button>
                          <button onClick={() => deleteAccount(acct)} style={{ ...actionBtnStyle, color: '#ef4444', borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)' }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {manageFields && (
        <ManageFieldsModal
          fields={fields}
          onClose={() => setManageFields(false)}
          onSaved={fetchAll}
        />
      )}

      {accountModal && (
        <AccountModal
          account={accountModal === 'new' ? null : accountModal}
          fields={fields}
          onClose={() => setAccountModal(null)}
          onSaved={fetchAll}
        />
      )}
    </div>
  );
}

const thStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  color: '#8a8680',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '14px 16px',
  verticalAlign: 'middle',
};

const actionBtnStyle = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
  padding: '5px 10px',
  color: '#c5c1b9',
  cursor: 'pointer',
  fontSize: 12,
};
