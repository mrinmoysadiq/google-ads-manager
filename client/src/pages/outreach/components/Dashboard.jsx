import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getDashboard, getOverdueLeads, exportCsv, getExportPdfUrl } from '../../../utils/outreachApi';

const FUNNEL_STAGES = [
  { key: 'total_contacted', label: 'Contacted', color: '#8a8680' },
  { key: 'responded', label: 'Responded', color: '#3b82f6' },
  { key: 'interested', label: 'Interested', color: '#a855f7' },
  { key: 'appointments_booked', label: 'Booked', color: '#f59e0b' },
  { key: 'closed', label: 'Closed', color: '#22c55e' },
];

const CHANNEL_COLORS = {
  LinkedIn: '#0a66c2',
  Email: '#575ECF',
  WhatsApp: '#25d366',
  Facebook: '#1877f2',
  Instagram: '#e1306c',
  SMS: '#8a8680',
  'Website Form': '#06b6d4',
  Other: '#6b7280',
};

function getDateParams(dateRange, customFrom, customTo) {
  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);

  switch (dateRange) {
    case 'week': {
      const day = today.getDay();
      const mon = new Date(today);
      mon.setDate(today.getDate() - ((day + 6) % 7));
      return { from: fmt(mon), to: fmt(today) };
    }
    case 'month': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: fmt(from), to: fmt(today) };
    }
    case 'last30': {
      const from = new Date(today);
      from.setDate(today.getDate() - 30);
      return { from: fmt(from), to: fmt(today) };
    }
    case 'last90': {
      const from = new Date(today);
      from.setDate(today.getDate() - 90);
      return { from: fmt(from), to: fmt(today) };
    }
    case 'alltime':
      return {};
    case 'custom':
      return { from: customFrom || undefined, to: customTo || undefined };
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

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
      <div
        style={{
          width: 36,
          height: 36,
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#575ECF',
          borderRadius: '50%',
          animation: 'spin 0.75s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function MetricCard({ label, value, sub }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <p
        style={{
          color: '#8a8680',
          fontSize: '0.65rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 8,
          fontWeight: 600,
        }}
      >
        {label}
      </p>
      <p style={{ color: '#ffffff', fontSize: '1.875rem', fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>
        {value ?? '—'}
      </p>
      {sub && <p style={{ color: '#8a8680', fontSize: '0.75rem', marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function pct(num, den) {
  if (!den || den === 0) return '0%';
  return (((num || 0) / den) * 100).toFixed(1) + '%';
}

export default function Dashboard({ specialistId, specialists, onLeadClick }) {
  const [dateRange, setDateRange] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [metrics, setMetrics] = useState(null);
  const [overdueLeads, setOverdueLeads] = useState([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (dateRange === 'custom' && (!customFrom || !customTo)) return;
    fetchData();
  }, [fetchData, dateRange, customFrom, customTo]);

  async function handleExportCsv() {
    try {
      const dateParams = getDateParams(dateRange, customFrom, customTo);
      const params = { ...dateParams };
      if (specialistId) params.specialist_id = specialistId;
      const blob = await exportCsv(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'outreach-export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('CSV export failed');
    }
  }

  function handleExportPdf() {
    const dateParams = getDateParams(dateRange, customFrom, customTo);
    const params = { ...dateParams };
    if (specialistId) params.specialist_id = specialistId;
    const url = getExportPdfUrl(params);
    window.open(url, '_blank');
  }

  const DATE_RANGE_OPTIONS = [
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'last30', label: 'Last 30 Days' },
    { value: 'last90', label: 'Last 90 Days' },
    { value: 'alltime', label: 'All Time' },
    { value: 'custom', label: 'Custom' },
  ];

  const m = metrics || {};
  const totalLeads = m.total_leads || 0;
  const responded = m.responded || 0;
  const interested = m.interested || 0;
  const apptBooked = m.appointments_booked || 0;
  const noShows = m.no_shows || 0;
  const closed = m.closed || 0;
  const startedTrial = m.started_trial || 0;
  const totalContacted = m.total_contacted || totalLeads;

  // Server returns by_channel as { LinkedIn: 3, Email: 2, ... } — convert to array
  const byChannel = m.by_channel
    ? Object.entries(m.by_channel).map(([channel, count]) => ({ channel, count }))
    : [];
  const bySpecialist = m.by_specialist || [];

  const sortedChannels = [...byChannel].sort((a, b) => (b.count || 0) - (a.count || 0));
  const maxChannelCount = sortedChannels.length > 0 ? sortedChannels[0].count : 1;

  const cardStyle = { backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.08)' };
  const mutedText = { color: '#8a8680' };
  const primaryText = { color: '#c5c1b9' };

  return (
    <div style={{ color: '#c5c1b9' }}>
      {/* Top bar: date range + exports */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
          justifyContent: 'space-between',
        }}
      >
        {/* Date range pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {DATE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateRange(opt.value)}
              style={{
                padding: '5px 14px',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.12)',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor: dateRange === opt.value ? '#575ECF' : 'transparent',
                color: dateRange === opt.value ? '#ffffff' : '#8a8680',
              }}
            >
              {opt.label}
            </button>
          ))}
          {dateRange === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                style={{
                  backgroundColor: '#2a2a2a',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6,
                  color: '#c5c1b9',
                  padding: '4px 8px',
                  fontSize: '0.8rem',
                }}
              />
              <span style={mutedText}>–</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                style={{
                  backgroundColor: '#2a2a2a',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6,
                  color: '#c5c1b9',
                  padding: '4px 8px',
                  fontSize: '0.8rem',
                }}
              />
            </div>
          )}
        </div>

        {/* Export buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleExportCsv}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              backgroundColor: 'transparent',
              color: '#c5c1b9',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ↓ Export CSV
          </button>
          <button
            onClick={handleExportPdf}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              backgroundColor: 'transparent',
              color: '#c5c1b9',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ↗ Export PDF
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* Metric Cards Row 1 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <MetricCard label="Total Leads" value={totalLeads} sub="in selected period" />
            <MetricCard label="Responded" value={responded} sub={`of ${totalContacted} contacted`} />
            <MetricCard
              label="Response Rate"
              value={pct(responded, totalContacted)}
              sub="responded / contacted"
            />
            <MetricCard label="Interested" value={interested} sub={`of ${responded} responded`} />
            <MetricCard
              label="Interested Rate"
              value={pct(interested, responded)}
              sub="interested / responded"
            />
          </div>

          {/* Metric Cards Row 2 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 12,
              marginBottom: 24,
            }}
          >
            <MetricCard label="Appts Booked" value={apptBooked} sub={`of ${interested} interested`} />
            <MetricCard
              label="Lead → Appt %"
              value={pct(apptBooked, totalLeads)}
              sub="booked / total leads"
            />
            <MetricCard label="No Shows" value={noShows} sub={`of ${apptBooked} booked`} />
            <MetricCard
              label="No Show Rate"
              value={pct(noShows, apptBooked)}
              sub="no shows / booked"
            />
            <MetricCard label="Closed" value={closed} sub={`of ${apptBooked} booked`} />
            <MetricCard
              label="Closed Rate"
              value={pct(closed, totalLeads)}
              sub="closed / total leads"
            />
            <MetricCard label="Started Trial" value={startedTrial} sub="trial started" />
          </div>

          {/* Funnel + Channel row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
              marginBottom: 24,
            }}
          >
            {/* Conversion Funnel */}
            <div className="rounded-xl p-6" style={cardStyle}>
              <h3
                style={{
                  ...primaryText,
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  marginBottom: 20,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Conversion Funnel
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {FUNNEL_STAGES.map((stage, idx) => {
                  const count = m[stage.key] || 0;
                  const barWidth = totalLeads > 0 ? Math.max((count / totalLeads) * 100, 2) : 2;
                  const prevStage = idx > 0 ? FUNNEL_STAGES[idx - 1] : null;
                  const prevCount = prevStage ? (m[prevStage.key] || 0) : null;
                  const ofPrev =
                    prevCount != null && prevCount > 0
                      ? ((count / prevCount) * 100).toFixed(0) + '% of prev'
                      : null;

                  return (
                    <div key={stage.key}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: 4,
                          fontSize: '0.75rem',
                        }}
                      >
                        <span style={{ color: stage.color, fontWeight: 600 }}>{stage.label}</span>
                        <span style={mutedText}>
                          {count.toLocaleString()}
                          {ofPrev && (
                            <span style={{ marginLeft: 6, color: 'rgba(255,255,255,0.3)' }}>
                              ({ofPrev})
                            </span>
                          )}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 8,
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          borderRadius: 999,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${barWidth}%`,
                            backgroundColor: stage.color,
                            borderRadius: 999,
                            transition: 'width 0.6s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Activity by Channel */}
            <div className="rounded-xl p-6" style={cardStyle}>
              <h3
                style={{
                  ...primaryText,
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  marginBottom: 20,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Activity by Channel
              </h3>
              {sortedChannels.length === 0 ? (
                <p style={{ ...mutedText, fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
                  No channel data available
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sortedChannels.map((ch) => {
                    const color = CHANNEL_COLORS[ch.channel] || CHANNEL_COLORS.Other;
                    const barPct = maxChannelCount > 0 ? Math.max((ch.count / maxChannelCount) * 100, 2) : 2;
                    return (
                      <div key={ch.channel} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            ...mutedText,
                            fontSize: '0.75rem',
                            width: 90,
                            flexShrink: 0,
                            textAlign: 'right',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {ch.channel}
                        </span>
                        <div
                          style={{
                            flex: 1,
                            height: 8,
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            borderRadius: 999,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${barPct}%`,
                              backgroundColor: color,
                              borderRadius: 999,
                              transition: 'width 0.6s ease',
                            }}
                          />
                        </div>
                        <span
                          style={{
                            ...mutedText,
                            fontSize: '0.75rem',
                            width: 32,
                            flexShrink: 0,
                            textAlign: 'right',
                          }}
                        >
                          {ch.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Team Performance (only if manager view) */}
          {!specialistId && bySpecialist.length > 0 && (
            <div className="rounded-xl p-6" style={{ ...cardStyle, marginBottom: 24 }}>
              <h3
                style={{
                  ...primaryText,
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  marginBottom: 16,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Team Performance
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      {['Specialist', 'Total Leads', 'Responded', 'Booked', 'Closed', 'Closed Rate'].map(
                        (col) => (
                          <th
                            key={col}
                            style={{
                              ...mutedText,
                              textAlign: col === 'Specialist' ? 'left' : 'right',
                              padding: '6px 12px',
                              fontWeight: 600,
                              fontSize: '0.7rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.07em',
                              borderBottom: '1px solid rgba(255,255,255,0.06)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {col}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {bySpecialist.map((sp, idx) => {
                      const closedRate =
                        (sp.total || 0) > 0
                          ? (((sp.closed || 0) / (sp.total || 0)) * 100).toFixed(1) + '%'
                          : '0%';
                      return (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                          }}
                        >
                          <td style={{ ...primaryText, padding: '8px 12px' }}>{sp.name || '—'}</td>
                          <td style={{ ...mutedText, padding: '8px 12px', textAlign: 'right' }}>
                            {sp.total || 0}
                          </td>
                          <td style={{ ...mutedText, padding: '8px 12px', textAlign: 'right' }}>
                            {sp.responded || 0}
                          </td>
                          <td style={{ ...mutedText, padding: '8px 12px', textAlign: 'right' }}>
                            {sp.booked || 0}
                          </td>
                          <td style={{ ...mutedText, padding: '8px 12px', textAlign: 'right' }}>
                            {sp.closed || 0}
                          </td>
                          <td
                            style={{
                              padding: '8px 12px',
                              textAlign: 'right',
                              color: '#22c55e',
                              fontWeight: 600,
                            }}
                          >
                            {closedRate}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Overdue Follow-ups */}
          <div className="rounded-xl p-6" style={cardStyle}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  ...primaryText,
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  margin: 0,
                }}
              >
                ⚠ Overdue Follow-ups
              </h3>
              {overdueLeads.length > 0 && (
                <span
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 999,
                    border: '1px solid rgba(245,158,11,0.3)',
                  }}
                >
                  {overdueLeads.length}
                </span>
              )}
            </div>

            {overdueLeads.length === 0 ? (
              <p
                style={{
                  ...mutedText,
                  fontSize: '0.85rem',
                  textAlign: 'center',
                  padding: '24px 0',
                }}
              >
                No overdue follow-ups 🎉
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Header */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr',
                    gap: 12,
                    padding: '4px 10px',
                    fontSize: '0.68rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    color: '#8a8680',
                    fontWeight: 600,
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    marginBottom: 4,
                  }}
                >
                  <span>Company</span>
                  <span>Contact</span>
                  <span>Specialist</span>
                  <span style={{ textAlign: 'right' }}>Overdue</span>
                </div>
                {overdueLeads.map((lead) => {
                  const days = daysOverdue(lead.next_followup_date);
                  const specialistName =
                    (specialists || []).find((s) => s.id === lead.specialist_id)?.name ||
                    lead.specialist_name ||
                    '—';
                  return (
                    <div
                      key={lead.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr',
                        gap: 12,
                        padding: '8px 10px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        fontSize: '0.82rem',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)')
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      onClick={() => onLeadClick && onLeadClick(lead.id)}
                    >
                      <span
                        style={{
                          color: '#575ECF',
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {lead.company_name || lead.company || '—'}
                      </span>
                      <span
                        style={{
                          ...mutedText,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {lead.contact_name || lead.contact || '—'}
                      </span>
                      <span
                        style={{
                          ...mutedText,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {specialistName}
                      </span>
                      <span
                        style={{
                          textAlign: 'right',
                          fontWeight: 600,
                          color: days >= 7 ? '#ef4444' : days >= 3 ? '#f59e0b' : '#c5c1b9',
                          whiteSpace: 'nowrap',
                        }}
                      >
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
    </div>
  );
}
