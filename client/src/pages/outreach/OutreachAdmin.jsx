import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Select from 'react-select';
import {
  getSpecialists,
  createSpecialist,
  updateSpecialist,
  getIndustries,
  createIndustry,
  updateIndustry,
  deleteIndustry,
} from '../../utils/outreachApi';

// ─── Design tokens ────────────────────────────────────────────────────────────

const selectStyles = {
  control: (base, { isFocused }) => ({
    ...base,
    backgroundColor: '#2a2a2a',
    borderColor: isFocused ? '#575ECF' : 'rgba(255,255,255,0.1)',
    boxShadow: 'none',
    '&:hover': { borderColor: '#575ECF' },
    minHeight: '38px',
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: '#2a2a2a',
    border: '1px solid rgba(255,255,255,0.12)',
    zIndex: 50,
  }),
  option: (base, { isSelected, isFocused }) => ({
    ...base,
    backgroundColor: isSelected
      ? '#575ECF'
      : isFocused
      ? 'rgba(87,94,207,0.15)'
      : 'transparent',
    color: '#c5c1b9',
    cursor: 'pointer',
  }),
  singleValue: (base) => ({ ...base, color: '#c5c1b9' }),
  placeholder: (base) => ({ ...base, color: '#8a8680' }),
  input: (base) => ({ ...base, color: '#c5c1b9' }),
};

const inputClass =
  'w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-[#2a2a2a] border border-white/10 text-[#c5c1b9] focus:border-[#575ECF]';

// ─── Small reusable primitives ────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-[#575ECF]"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
  );
}

function Badge({ active }) {
  return active ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/15 text-[#22c55e]">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/5 text-[#8a8680]">
      Inactive
    </span>
  );
}

function Btn({ variant = 'ghost', size = 'sm', className = '', ...props }) {
  const variants = {
    primary:
      'bg-[#575ECF] hover:bg-[#6B72D8] text-white border-transparent',
    ghost:
      'bg-white/5 hover:bg-white/10 text-[#c5c1b9] border-white/10',
    danger:
      'bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30',
    warning:
      'bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
  };
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-lg border font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}

// ─── Section: Specialists ─────────────────────────────────────────────────────

function SpecialistsSection({ specialists, setSpecialists }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', manager_id: null, active: 1 });
  const [saving, setSaving] = useState(false);

  const [addName, setAddName] = useState('');
  const [addManagerId, setAddManagerId] = useState(null);
  const [adding, setAdding] = useState(false);

  const activeSpecialists = specialists.filter((s) => s.active);

  function managerOptions(excludeId = null) {
    return activeSpecialists
      .filter((s) => s.id !== excludeId)
      .map((s) => ({ value: s.id, label: s.name }));
  }

  function startEdit(specialist) {
    setEditingId(specialist.id);
    setEditForm({
      name: specialist.name,
      manager_id: specialist.manager_id,
      active: specialist.active,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ name: '', manager_id: null, active: 1 });
  }

  async function saveEdit(id) {
    if (!editForm.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    const prev = specialists.find((s) => s.id === id);
    // Optimistic update
    setSpecialists((prev_) =>
      prev_.map((s) =>
        s.id === id
          ? {
              ...s,
              name: editForm.name.trim(),
              manager_id: editForm.manager_id,
              manager_name:
                specialists.find((x) => x.id === editForm.manager_id)?.name || null,
              active: editForm.active,
            }
          : s
      )
    );
    cancelEdit();
    try {
      await updateSpecialist(id, {
        name: editForm.name.trim(),
        manager_id: editForm.manager_id,
        active: editForm.active,
      });
      toast.success('Specialist updated');
    } catch (err) {
      // Revert
      setSpecialists((prev_) => prev_.map((s) => (s.id === id ? prev : s)));
      toast.error(err?.response?.data?.error || 'Failed to update specialist');
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(specialist) {
    const prev = { ...specialist };
    setSpecialists((prev_) =>
      prev_.map((s) => (s.id === specialist.id ? { ...s, active: 0 } : s))
    );
    try {
      await updateSpecialist(specialist.id, { active: 0 });
      toast.success(`${specialist.name} deactivated`);
    } catch (err) {
      setSpecialists((prev_) =>
        prev_.map((s) => (s.id === specialist.id ? prev : s))
      );
      toast.error(err?.response?.data?.error || 'Failed to deactivate');
    }
  }

  async function handleAdd() {
    if (!addName.trim()) {
      toast.error('Name is required');
      return;
    }
    setAdding(true);
    try {
      const created = await createSpecialist({
        name: addName.trim(),
        manager_id: addManagerId,
      });
      setSpecialists((prev_) => [...prev_, created]);
      setAddName('');
      setAddManagerId(null);
      toast.success('Specialist added');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to add specialist');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="bg-[#242424] border border-white/[0.08] rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-[#c5c1b9]">Specialists</h2>
      </div>

      {specialists.length === 0 ? (
        <p className="text-sm text-[#8a8680] py-4 text-center">
          No specialists yet. Add one below.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-2 px-3 text-xs font-medium text-[#8a8680] uppercase tracking-wide">
                  Name
                </th>
                <th className="text-left py-2 px-3 text-xs font-medium text-[#8a8680] uppercase tracking-wide">
                  Manager
                </th>
                <th className="text-left py-2 px-3 text-xs font-medium text-[#8a8680] uppercase tracking-wide">
                  Status
                </th>
                <th className="text-right py-2 px-3 text-xs font-medium text-[#8a8680] uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {specialists.map((specialist) =>
                editingId === specialist.id ? (
                  <tr
                    key={specialist.id}
                    className="border-b border-white/[0.04] bg-[#2a2a2a]"
                  >
                    <td className="py-2 px-3">
                      <input
                        className={inputClass}
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, name: e.target.value }))
                        }
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit(specialist.id)}
                        autoFocus
                      />
                    </td>
                    <td className="py-2 px-3 min-w-[180px]">
                      <Select
                        styles={selectStyles}
                        isClearable
                        placeholder="No manager"
                        options={managerOptions(specialist.id)}
                        value={
                          editForm.manager_id
                            ? {
                                value: editForm.manager_id,
                                label:
                                  specialists.find(
                                    (s) => s.id === editForm.manager_id
                                  )?.name || '',
                              }
                            : null
                        }
                        onChange={(opt) =>
                          setEditForm((f) => ({
                            ...f,
                            manager_id: opt ? opt.value : null,
                          }))
                        }
                      />
                    </td>
                    <td className="py-2 px-3">
                      <button
                        onClick={() =>
                          setEditForm((f) => ({ ...f, active: f.active ? 0 : 1 }))
                        }
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                          editForm.active ? 'bg-[#575ECF]' : 'bg-white/10'
                        }`}
                        role="switch"
                        aria-checked={!!editForm.active}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            editForm.active ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center justify-end gap-2">
                        <Btn
                          variant="primary"
                          onClick={() => saveEdit(specialist.id)}
                          disabled={saving}
                        >
                          Save
                        </Btn>
                        <Btn variant="ghost" onClick={cancelEdit} disabled={saving}>
                          Cancel
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={specialist.id}
                    className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${
                      !specialist.active ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 text-[#c5c1b9] font-medium">
                      {specialist.name}
                    </td>
                    <td className="py-2.5 px-3 text-[#8a8680]">
                      {specialist.manager_name || (
                        <span className="text-white/20 italic">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge active={specialist.active} />
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center justify-end gap-2">
                        <Btn variant="ghost" onClick={() => startEdit(specialist)}>
                          Edit
                        </Btn>
                        {specialist.active ? (
                          <Btn
                            variant="warning"
                            onClick={() => deactivate(specialist)}
                          >
                            Deactivate
                          </Btn>
                        ) : (
                          <Btn
                            variant="ghost"
                            onClick={async () => {
                              const prev = { ...specialist };
                              setSpecialists((prev_) =>
                                prev_.map((s) =>
                                  s.id === specialist.id ? { ...s, active: 1 } : s
                                )
                              );
                              try {
                                await updateSpecialist(specialist.id, { active: 1 });
                                toast.success(`${specialist.name} reactivated`);
                              } catch (err) {
                                setSpecialists((prev_) =>
                                  prev_.map((s) =>
                                    s.id === specialist.id ? prev : s
                                  )
                                );
                                toast.error('Failed to reactivate');
                              }
                            }}
                          >
                            Reactivate
                          </Btn>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add form */}
      <div className="mt-5 pt-5 border-t border-white/[0.06]">
        <p className="text-xs font-medium text-[#8a8680] uppercase tracking-wide mb-3">
          Add Specialist
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-[#8a8680] mb-1">Name</label>
            <input
              className={inputClass}
              placeholder="Specialist name"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-[#8a8680] mb-1">
              Manager (optional)
            </label>
            <Select
              styles={selectStyles}
              isClearable
              placeholder="No manager"
              options={managerOptions()}
              value={
                addManagerId
                  ? {
                      value: addManagerId,
                      label:
                        specialists.find((s) => s.id === addManagerId)?.name || '',
                    }
                  : null
              }
              onChange={(opt) => setAddManagerId(opt ? opt.value : null)}
            />
          </div>
          <Btn variant="primary" size="md" onClick={handleAdd} disabled={adding}>
            {adding ? 'Adding…' : '+ Add'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Section: Industries ──────────────────────────────────────────────────────

function IndustriesSection({ industries, setIndustries }) {
  const [addName, setAddName] = useState('');
  const [adding, setAdding] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  async function handleAdd() {
    if (!addName.trim()) {
      toast.error('Industry name is required');
      return;
    }
    setAdding(true);
    try {
      const created = await createIndustry({ name: addName.trim() });
      setIndustries((prev) => [...prev, created]);
      setAddName('');
      toast.success('Industry added');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to add industry');
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(industry) {
    const prev = { ...industry };
    const newActive = industry.active ? 0 : 1;
    setIndustries((prev_) =>
      prev_.map((i) => (i.id === industry.id ? { ...i, active: newActive } : i))
    );
    try {
      await updateIndustry(industry.id, { active: newActive });
      toast.success(`${industry.name} ${newActive ? 'activated' : 'deactivated'}`);
    } catch (err) {
      setIndustries((prev_) =>
        prev_.map((i) => (i.id === industry.id ? prev : i))
      );
      toast.error(err?.response?.data?.error || 'Failed to update industry');
    }
  }

  async function handleDelete(industry) {
    const prevList = [...industries];
    setIndustries((prev) => prev.filter((i) => i.id !== industry.id));
    try {
      await deleteIndustry(industry.id);
      toast.success(`${industry.name} deleted`);
    } catch (err) {
      setIndustries(prevList);
      toast.error(
        err?.response?.data?.error || err?.message || 'Failed to delete industry'
      );
    }
  }

  function startRename(industry) {
    setRenamingId(industry.id);
    setRenameValue(industry.name);
  }

  async function commitRename(industry) {
    const trimmed = renameValue.trim();
    setRenamingId(null);
    if (!trimmed || trimmed === industry.name) return;
    const prev = { ...industry };
    setIndustries((prev_) =>
      prev_.map((i) => (i.id === industry.id ? { ...i, name: trimmed } : i))
    );
    try {
      await updateIndustry(industry.id, { name: trimmed });
      toast.success('Industry renamed');
    } catch (err) {
      setIndustries((prev_) =>
        prev_.map((i) => (i.id === industry.id ? prev : i))
      );
      toast.error(err?.response?.data?.error || 'Failed to rename industry');
    }
  }

  return (
    <div className="bg-[#242424] border border-white/[0.08] rounded-xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="text-base font-semibold text-[#c5c1b9]">
          Industries / Niches
        </h2>
        <div className="flex items-center gap-2">
          <input
            className={inputClass + ' !w-48'}
            placeholder="New industry…"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Btn variant="primary" onClick={handleAdd} disabled={adding}>
            {adding ? 'Adding…' : '+ Add'}
          </Btn>
        </div>
      </div>

      {industries.length === 0 ? (
        <p className="text-sm text-[#8a8680] py-4 text-center">
          No industries yet. Add one above.
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.04]">
          {industries.map((industry) => (
            <li
              key={industry.id}
              className={`flex items-center justify-between gap-3 py-2.5 px-1 transition-opacity ${
                !industry.active ? 'opacity-40' : ''
              }`}
            >
              {/* Name / rename */}
              <div className="flex-1 min-w-0">
                {renamingId === industry.id ? (
                  <input
                    className={inputClass}
                    value={renameValue}
                    autoFocus
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(industry)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(industry);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                  />
                ) : (
                  <button
                    className="text-sm text-[#c5c1b9] hover:text-white transition-colors text-left truncate max-w-full group"
                    title="Click to rename"
                    onClick={() => startRename(industry)}
                  >
                    {industry.name}
                    <span className="ml-1.5 text-[#8a8680] opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                      ✎
                    </span>
                  </button>
                )}
              </div>

              {/* Active toggle */}
              <button
                onClick={() => handleToggle(industry)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                  industry.active ? 'bg-[#575ECF]' : 'bg-white/10'
                }`}
                role="switch"
                aria-checked={!!industry.active}
                title={industry.active ? 'Deactivate' : 'Activate'}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    industry.active ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>

              {/* Delete */}
              <Btn
                variant="danger"
                size="sm"
                onClick={() => handleDelete(industry)}
                title="Delete industry"
              >
                Delete
              </Btn>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Section: Settings ────────────────────────────────────────────────────────

function SettingsSection() {
  return (
    <div className="bg-[#242424] border border-white/[0.08] rounded-xl p-6">
      <h2 className="text-base font-semibold text-[#c5c1b9] mb-5">Settings</h2>
      <div className="divide-y divide-white/[0.06]">
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-[#8a8680]">Max touchpoints per lead</span>
          <span className="text-sm text-[#c5c1b9] font-medium">5 (fixed)</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-[#8a8680]">Status options</span>
          <span className="text-sm text-[#c5c1b9] font-medium">
            9 predefined stages
          </span>
        </div>
        <div className="py-3">
          <p className="text-xs text-[#8a8680] italic">
            Additional settings coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Page root ────────────────────────────────────────────────────────────────

export default function OutreachAdmin() {
  const [specialists, setSpecialists] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [specs, inds] = await Promise.all([getSpecialists(), getIndustries()]);
      setSpecialists(specs || []);
      setIndustries(inds || []);
    } catch (err) {
      setLoadError('Failed to load admin data. Please try again.');
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-[#1b1b1b] text-[#c5c1b9]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-[#8a8680] mb-6">
          <Link
            to="/outreach"
            className="hover:text-[#c5c1b9] transition-colors"
          >
            Outreach
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-[#c5c1b9] font-medium">Admin</span>
        </nav>

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#c5c1b9] tracking-tight">
            Outreach Admin
          </h1>
          <p className="text-sm text-[#8a8680] mt-1">
            Manage specialists, industries, and system settings.
          </p>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Spinner />
            <p className="text-sm text-[#8a8680]">Loading admin data…</p>
          </div>
        ) : loadError ? (
          <div className="bg-[#242424] border border-white/[0.08] rounded-xl p-8 text-center">
            <p className="text-sm text-[#ef4444] mb-4">{loadError}</p>
            <Btn variant="ghost" size="md" onClick={fetchData}>
              Retry
            </Btn>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <SpecialistsSection
              specialists={specialists}
              setSpecialists={setSpecialists}
            />
            <IndustriesSection
              industries={industries}
              setIndustries={setIndustries}
            />
            <SettingsSection />
          </div>
        )}
      </div>
    </div>
  );
}
