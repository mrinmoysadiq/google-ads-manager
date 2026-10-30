import React, { useState, useEffect, useRef, useCallback } from 'react';
import Select from 'react-select';
import { fmtDate as formatDate } from '../../../utils/dates';
import { stageColor, isClosedStatus } from '../stageTypes';
import { useChannelColors, DEFAULT_CHANNEL_COLOR } from '../channels';

// ─── Constants ────────────────────────────────────────────────────────────────

// Complete default stage list — used when stages prop is not yet loaded
const DEFAULT_STAGES = [
  'New Lead',
  'Touchpoint 1', 'Touchpoint 2', 'Touchpoint 3', 'Touchpoint 4', 'Touchpoint 5',
  'Responded', 'Interested', 'Not Interested', 'Appointment Booked',
  'No Show', 'Meeting Done - Not Interested', 'Started Trial',
  'Closed / Booked as Client', 'Disqualified / Dead',
];


function SourceLabel({ name, color }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: color, flexShrink: 0 }} />
      {name}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFollowupColor(dateStr, status, stages) {
  if (!dateStr || isClosedStatus(stages, status)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  if (d >= today) return null;
  const diffDays = Math.floor((today - d) / 86400000);
  return diffDays < 3 ? '#f59e0b' : '#ef4444';
}


// ─── react-select shared dark theme ──────────────────────────────────────────

const selectStyles = {
  control: (base, state) => ({
    ...base,
    background: '#2a2a2a',
    borderColor: state.isFocused ? '#575ECF' : 'rgba(255,255,255,0.08)',
    boxShadow: 'none',
    minHeight: 36,
    fontSize: 13,
    '&:hover': { borderColor: 'rgba(255,255,255,0.2)' },
  }),
  menu: (base) => ({
    ...base,
    background: '#2a2a2a',
    border: '1px solid rgba(255,255,255,0.08)',
    zIndex: 50,
  }),
  option: (base, state) => ({
    ...base,
    background: state.isSelected ? '#575ECF' : state.isFocused ? 'rgba(255,255,255,0.05)' : 'transparent',
    color: state.isSelected ? '#fff' : '#c5c1b9',
    fontSize: 13,
    cursor: 'pointer',
  }),
  multiValue: (base) => ({
    ...base,
    background: 'rgba(87,94,207,0.2)',
    borderRadius: 4,
  }),
  multiValueLabel: (base) => ({ ...base, color: '#c5c1b9', fontSize: 12 }),
  multiValueRemove: (base) => ({
    ...base,
    color: '#8a8680',
    ':hover': { background: 'rgba(255,255,255,0.1)', color: '#fff' },
  }),
  singleValue: (base) => ({ ...base, color: '#c5c1b9' }),
  placeholder: (base) => ({ ...base, color: '#8a8680', fontSize: 13 }),
  input: (base) => ({ ...base, color: '#c5c1b9' }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base) => ({ ...base, color: '#8a8680', padding: '0 6px' }),
  clearIndicator: (base) => ({ ...base, color: '#8a8680', padding: '0 4px' }),
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChannelPills({ channels }) {
  const channelColors = useChannelColors();
  if (!channels || channels.length === 0) return <span style={{ color: '#8a8680' }}>—</span>;
  const visible = channels.slice(0, 3);
  const extra = channels.length - 3;
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {visible.map((ch) => {
        const color = channelColors[ch] || DEFAULT_CHANNEL_COLOR;
        return (
          <span
            key={ch}
            style={{
              fontSize: 11,
              padding: '2px 6px',
              borderRadius: 3,
              background: `${color}22`,
              color,
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            {ch}
          </span>
        );
      })}
      {extra > 0 && (
        <span style={{ fontSize: 11, color: '#8a8680' }}>+{extra} more</span>
      )}
    </div>
  );
}

function StatusDropdown({ currentStatus, leadId, stageNames, stages, onStatusChange, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        zIndex: 999,
        background: '#242424',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8,
        padding: 4,
        minWidth: 220,
        maxHeight: 320,
        overflowY: 'auto',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {stageNames.map((s) => {
        const { color } = stageColor(stages, s);
        const isActive = s === currentStatus;
        return (
          <div
            key={s}
            onClick={() => { onStatusChange(leadId, s); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', borderRadius: 5, cursor: 'pointer',
              background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: isActive ? '#fff' : '#c5c1b9' }}>{s}</span>
            {isActive && <span style={{ marginLeft: 'auto', fontSize: 11, color }}>✓</span>}
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ lead, stageNames, stages, onStatusChange }) {
  const [open, setOpen] = useState(false);
  const { bg, color } = stageColor(stages, lead.status);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <span
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        title="Click to change status"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 9px', borderRadius: 20, background: bg, color,
          fontSize: 11, fontWeight: 600, cursor: 'pointer',
          whiteSpace: 'nowrap', userSelect: 'none',
          border: `1px solid ${color}33`, transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        {lead.status}
      </span>
      {open && (
        <StatusDropdown
          currentStatus={lead.status}
          leadId={lead.id}
          stageNames={stageNames}
          stages={stages}
          onStatusChange={onStatusChange}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function SortIcon({ column, sortBy, sortDir }) {
  if (sortBy !== column) {
    return <span style={{ color: '#8a8680', marginLeft: 4, fontSize: 10 }}>↕</span>;
  }
  return (
    <span style={{ color: '#575ECF', marginLeft: 4, fontSize: 11 }}>
      {sortDir === 'ASC' ? '↑' : '↓'}
    </span>
  );
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 }}>
      <div
        style={{
          width: 36,
          height: 36,
          border: '3px solid rgba(255,255,255,0.08)',
          borderTopColor: '#575ECF',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PipelineTable({
  leads = [],
  loading = false,
  pagination = { page: 1, total: 0, totalPages: 1 },
  filters = {},
  onFiltersChange,
  onPageChange,
  onLeadClick,
  onStatusChange,
  specialists = [],
  industries = [],
  sources = [],
  stages = [],
  showSpecialistColumn = false,
}) {
  // Use active pipeline stages from DB; fall back to the default list if not yet loaded
  const stageNames = stages.length > 0 ? stages.map(s => s.name) : DEFAULT_STAGES;

  const sortBy = filters.sort_by || 'status_updated_at';
  const sortDir = filters.sort_dir || 'DESC';

  function handleSort(col) {
    if (sortBy === col) {
      onFiltersChange?.({ ...filters, sort_dir: sortDir === 'ASC' ? 'DESC' : 'ASC' });
    } else {
      onFiltersChange?.({ ...filters, sort_by: col, sort_dir: 'DESC' });
    }
  }

  const statusOptions = stageNames.map((s) => ({ value: s, label: s }));
  const industryOptions = industries.map((i) => ({ value: i.id, label: i.name }));

  const selectedStatuses = (filters.status ? filters.status.split(',') : [])
    .map((s) => ({ value: s, label: s }));
  const selectedIndustry = industryOptions.find((o) => String(o.value) === String(filters.industry_id)) || null;
  const sourceOptions = [
    ...sources.map((src) => ({ value: src.id, label: src.name, color: src.color })),
    { value: 'none', label: 'No source', color: '#555555' },
  ];
  const selectedSource = sourceOptions.find((o) => String(o.value) === String(filters.source_id)) || null;

  const hasActiveFilters =
    filters.search ||
    filters.status ||
    filters.industry_id ||
    filters.source_id ||
    filters.date_from ||
    filters.date_to ||
    filters.followup_overdue;

  function clearFilters() {
    onFiltersChange?.({
      status: '',
      industry_id: '',
      source_id: '',
      search: '',
      followup_overdue: false,
      date_from: '',
      date_to: '',
      sort_by: 'status_updated_at',
      sort_dir: 'DESC',
    });
  }

  // ── Column definitions ─────────────────────────────────────────────────────
  const columns = [
    { key: 'index',            label: '#',              sortable: false, width: 40 },
    { key: 'company_name',     label: 'Company',        sortable: true,  width: 160 },
    { key: 'source_name',      label: 'Source',         sortable: true,  width: 130 },
    { key: 'contact_name',     label: 'Contact',        sortable: true,  width: 140 },
    { key: 'job_title',        label: 'Job Title',      sortable: false, width: 130 },
    { key: 'industry_name',    label: 'Industry',       sortable: true,  width: 110 },
    { key: 'location',         label: 'Location',       sortable: false, width: 110 },
    { key: 'status',           label: 'Status',         sortable: true,  width: 190 },
    { key: 'channels_used',    label: 'Channels',       sortable: false, width: 160 },
    { key: 'touchpoint_count', label: 'TPs',            sortable: true,  width: 60  },
    { key: 'next_followup_date', label: 'Next Follow-up', sortable: true, width: 130 },
    { key: 'last_touchpoint_date', label: 'Last Activity', sortable: true, width: 120 },
    ...(showSpecialistColumn ? [{ key: 'specialist_name', label: 'Specialist', sortable: true, width: 120 }] : []),
  ];

  const thStyle = (col) => ({
    padding: '10px 12px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    color: '#8a8680',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    cursor: col.sortable ? 'pointer' : 'default',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: '#242424',
    width: col.width,
    minWidth: col.width,
  });

  const tdStyle = {
    padding: '10px 12px',
    fontSize: 13,
    color: '#c5c1b9',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    verticalAlign: 'middle',
  };

  const rowStyle = (idx) => ({
    background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
    cursor: 'pointer',
    transition: 'background 0.15s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Filters bar ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          padding: '14px 16px',
          background: '#242424',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          alignItems: 'center',
        }}
      >
        {/* Status multi-select */}
        <div style={{ minWidth: 200 }}>
          <Select
            isMulti
            placeholder="All statuses"
            options={statusOptions}
            value={selectedStatuses}
            styles={selectStyles}
            onChange={(opts) =>
              onFiltersChange?.({
                ...filters,
                status: opts ? opts.map((o) => o.value).join(',') : '',
                page: 1,
              })
            }
          />
        </div>

        {/* Industry */}
        <div style={{ minWidth: 160 }}>
          <Select
            isClearable
            placeholder="All industries"
            options={industryOptions}
            value={selectedIndustry}
            styles={selectStyles}
            onChange={(opt) =>
              onFiltersChange?.({ ...filters, industry_id: opt ? opt.value : '', page: 1 })
            }
          />
        </div>

        {/* Lead source */}
        <div style={{ minWidth: 160 }}>
          <Select
            isClearable
            placeholder="All sources"
            options={sourceOptions}
            value={selectedSource}
            styles={selectStyles}
            formatOptionLabel={(o) => <SourceLabel name={o.label} color={o.color} />}
            onChange={(opt) =>
              onFiltersChange?.({ ...filters, source_id: opt ? opt.value : '', page: 1 })
            }
          />
        </div>

        {/* Date from */}
        <input
          type="date"
          value={filters.date_from || ''}
          onChange={(e) => onFiltersChange?.({ ...filters, date_from: e.target.value, page: 1 })}
          style={{
            background: '#2a2a2a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
            padding: '6px 10px',
            color: filters.date_from ? '#c5c1b9' : '#8a8680',
            fontSize: 13,
            outline: 'none',
            colorScheme: 'dark',
          }}
          title="Date from"
        />

        {/* Date to */}
        <input
          type="date"
          value={filters.date_to || ''}
          onChange={(e) => onFiltersChange?.({ ...filters, date_to: e.target.value, page: 1 })}
          style={{
            background: '#2a2a2a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
            padding: '6px 10px',
            color: filters.date_to ? '#c5c1b9' : '#8a8680',
            fontSize: 13,
            outline: 'none',
            colorScheme: 'dark',
          }}
          title="Date to"
        />

        {/* Overdue toggle */}
        <button
          onClick={() =>
            onFiltersChange?.({ ...filters, followup_overdue: !filters.followup_overdue, page: 1 })
          }
          style={{
            background: filters.followup_overdue ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${filters.followup_overdue ? '#ef4444' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 6,
            padding: '6px 12px',
            color: filters.followup_overdue ? '#ef4444' : '#8a8680',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
          }}
        >
          ⚠ Overdue only
        </button>

        {/* Clear */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6,
              padding: '6px 12px',
              color: '#8a8680',
              fontSize: 12,
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#c5c1b9')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#8a8680')}
          >
            ✕ Clear filters
          </button>
        )}

        {/* Result count */}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8a8680' }}>
          {pagination.total ?? 0} result{pagination.total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Table ── */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={thStyle(col)}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  {col.label}
                  {col.sortable && <SortIcon column={col.key} sortBy={sortBy} sortDir={sortDir} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={{ ...tdStyle, textAlign: 'center', padding: 0 }}>
                  <Spinner />
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ ...tdStyle, textAlign: 'center', padding: 60, color: '#8a8680' }}
                >
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                  <div style={{ fontSize: 15, marginBottom: 6, color: '#c5c1b9' }}>No leads found</div>
                  <div style={{ fontSize: 13 }}>
                    {hasActiveFilters
                      ? 'Try adjusting your filters to see more results.'
                      : 'Add your first lead to get started.'}
                  </div>
                </td>
              </tr>
            ) : (
              leads.map((lead, idx) => {
                const followupColor = getFollowupColor(lead.next_followup_date, lead.status, stages);
                const rowNum = ((pagination.page || 1) - 1) * 25 + idx + 1;

                return (
                  <tr
                    key={lead.id}
                    style={rowStyle(idx)}
                    onClick={() => onLeadClick?.(lead.id)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(87,94,207,0.06)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = rowStyle(idx).background)}
                  >
                    {/* # — left edge coloured by lead source */}
                    <td style={{ ...tdStyle, color: '#8a8680', fontSize: 12, boxShadow: lead.source_color ? `inset 3px 0 0 ${lead.source_color}` : undefined }}>{rowNum}</td>

                    {/* Company */}
                    <td style={{ ...tdStyle, fontWeight: 600, color: '#e8e5df' }}>
                      <div
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 150,
                        }}
                        title={lead.company_name}
                      >
                        {lead.company_name || '—'}
                      </div>
                    </td>

                    {/* Source */}
                    <td style={tdStyle}>
                      {lead.source_name ? (
                        <span
                          style={{
                            display: 'inline-block', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                            backgroundColor: `${lead.source_color}26`, color: lead.source_color,
                          }}
                          title={lead.source_name}
                        >
                          {lead.source_name}
                        </span>
                      ) : (
                        <span style={{ color: '#555' }}>—</span>
                      )}
                    </td>

                    {/* Contact */}
                    <td style={tdStyle}>
                      <div
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 130,
                        }}
                        title={lead.contact_name}
                      >
                        {lead.contact_name || '—'}
                      </div>
                    </td>

                    {/* Job Title */}
                    <td style={{ ...tdStyle, color: '#8a8680' }}>
                      <div
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 120,
                        }}
                        title={lead.job_title}
                      >
                        {lead.job_title || '—'}
                      </div>
                    </td>

                    {/* Industry */}
                    <td style={{ ...tdStyle, color: '#8a8680' }}>
                      <div
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 100,
                        }}
                        title={lead.industry_name}
                      >
                        {lead.industry_name || '—'}
                      </div>
                    </td>

                    {/* Location */}
                    <td style={{ ...tdStyle, color: '#8a8680' }}>
                      <div
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 100,
                        }}
                        title={lead.location}
                      >
                        {lead.location || '—'}
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ ...tdStyle }} onClick={(e) => e.stopPropagation()}>
                      <StatusBadge lead={lead} stageNames={stageNames} stages={stages} onStatusChange={onStatusChange} />
                    </td>

                    {/* Channels */}
                    <td style={tdStyle}>
                      <ChannelPills channels={lead.channels_used} />
                    </td>

                    {/* TPs */}
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#8a8680' }}>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ color: '#c5c1b9', fontWeight: 600 }}>
                          {lead.touchpoint_count ?? 0}
                        </span>
                        /5
                      </span>
                    </td>

                    {/* Next Follow-up */}
                    <td
                      style={{
                        ...tdStyle,
                        color: followupColor || '#c5c1b9',
                        fontWeight: followupColor ? 600 : 400,
                      }}
                    >
                      {formatDate(lead.next_followup_date)}
                    </td>

                    {/* Last Activity */}
                    <td style={{ ...tdStyle, color: '#8a8680' }}>
                      {formatDate(lead.last_touchpoint_date)}
                    </td>

                    {/* Specialist (conditional) */}
                    {showSpecialistColumn && (
                      <td style={{ ...tdStyle, color: '#8a8680' }}>
                        <div
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 110,
                          }}
                          title={lead.specialist_name}
                        >
                          {lead.specialist_name || '—'}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {!loading && pagination.totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: '#242424',
          }}
        >
          <span style={{ fontSize: 12, color: '#8a8680' }}>
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
          </span>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              disabled={pagination.page <= 1}
              onClick={() => onPageChange?.(pagination.page - 1)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6,
                padding: '5px 12px',
                color: pagination.page <= 1 ? '#8a8680' : '#c5c1b9',
                fontSize: 13,
                cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                opacity: pagination.page <= 1 ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
            >
              ← Prev
            </button>

            {/* Page number buttons (show up to 5 around current) */}
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter((p) => {
                const cur = pagination.page;
                return p === 1 || p === pagination.totalPages || Math.abs(p - cur) <= 2;
              })
              .reduce((acc, p, i, arr) => {
                if (i > 0 && p - arr[i - 1] > 1) {
                  acc.push('...');
                }
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} style={{ padding: '5px 4px', color: '#8a8680', fontSize: 13 }}>
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => onPageChange?.(p)}
                    style={{
                      background: p === pagination.page ? '#575ECF' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${p === pagination.page ? '#575ECF' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 6,
                      padding: '5px 10px',
                      color: p === pagination.page ? '#fff' : '#c5c1b9',
                      fontSize: 13,
                      cursor: 'pointer',
                      fontWeight: p === pagination.page ? 700 : 400,
                      minWidth: 34,
                    }}
                  >
                    {p}
                  </button>
                )
              )}

            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange?.(pagination.page + 1)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6,
                padding: '5px 12px',
                color: pagination.page >= pagination.totalPages ? '#8a8680' : '#c5c1b9',
                fontSize: 13,
                cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                opacity: pagination.page >= pagination.totalPages ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
