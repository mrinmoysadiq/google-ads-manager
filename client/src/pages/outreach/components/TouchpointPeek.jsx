import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getTouchpoints, getLeadResponses } from '../../../utils/outreachApi'
import { fmtDate } from '../../../utils/dates'
import { useAnchoredPosition, useDismiss } from './kanban/useAnchored'

const WIDTH = 380

function hasContent(tp) {
  return tp.date || tp.channel || tp.message_body || tp.notes || tp.loom_url
}

function ChannelTag({ channel, colors }) {
  if (!channel) return null
  const c = colors[channel] || '#6b7280'
  return (
    <span className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${c}22`, color: c }}>
      {channel}
    </span>
  )
}

function Block({ label, children }) {
  return (
    <div className="mt-1.5">
      {label && <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: '#8a8680' }}>{label}</p>}
      <p className="text-xs leading-relaxed whitespace-pre-wrap break-words" style={{ color: '#c5c1b9' }}>{children}</p>
    </div>
  )
}

// Read-only popover with a lead's touchpoints (date, channel, message, notes, Loom) and
// replies, anchored to the button that opened it. It stays open while you read, scroll or
// move the mouse away, following its card; it closes on ✕, Escape or a click outside.
export default function TouchpointPeek({ lead, anchor, channelColors = {}, onClose, onOpenLead }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getTouchpoints(lead.id), getLeadResponses(lead.id)])
      .then(([touchpoints, responses]) => {
        if (!cancelled) setData({ touchpoints: touchpoints.filter(hasContent), responses })
      })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [lead.id])

  const pos = useAnchoredPosition(anchor, WIDTH)
  useDismiss(ref, onClose)

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`Touchpoints for ${lead.company_name}`}
      className="fixed z-[60] rounded-xl flex flex-col"
      style={{
        width: WIDTH, left: pos.left, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight,
        backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
      }}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-sm font-semibold truncate" style={{ color: '#e8e5df' }}>{lead.company_name}</p>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => { onClose(); onOpenLead(lead.id) }} className="text-xs font-medium hover:underline" style={{ color: '#575ECF' }}>
            Open lead
          </button>
          <button onClick={onClose} aria-label="Close" className="text-base leading-none" style={{ color: '#8a8680' }}>✕</button>
        </div>
      </div>

      <div className="overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {error ? (
          <p className="text-xs" style={{ color: '#ef4444' }}>Couldn't load touchpoints.</p>
        ) : !data ? (
          <p className="text-xs" style={{ color: '#8a8680' }}>Loading…</p>
        ) : (
          <>
            {data.touchpoints.length === 0 ? (
              <p className="text-xs" style={{ color: '#8a8680' }}>No touchpoints logged yet.</p>
            ) : (
              data.touchpoints.map(tp => (
                <div key={tp.id} className="rounded-lg px-3 py-2.5" style={{ backgroundColor: '#2a2a2a' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color: '#14b8a6' }}>TP {tp.touchpoint_number}</span>
                    <ChannelTag channel={tp.channel} colors={channelColors} />
                    {tp.date && <span className="text-[11px] ml-auto" style={{ color: '#8a8680' }}>{fmtDate(tp.date)}</span>}
                  </div>
                  {tp.message_body && <Block label="Message">{tp.message_body}</Block>}
                  {tp.notes && <Block label="Notes">{tp.notes}</Block>}
                  {tp.loom_url && (
                    <a href={tp.loom_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-1.5 text-xs hover:underline" style={{ color: '#575ECF' }}>
                      ▶ Loom video
                    </a>
                  )}
                </div>
              ))
            )}

            {data.responses.length > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-wide font-semibold mt-1" style={{ color: '#8a8680' }}>Their replies</p>
                {data.responses.map(r => (
                  <div key={r.id} className="rounded-lg px-3 py-2.5" style={{ backgroundColor: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <ChannelTag channel={r.channel} colors={channelColors} />
                      {(r.date || r.created_at) && <span className="text-[11px] ml-auto" style={{ color: '#8a8680' }}>{fmtDate(r.date || r.created_at)}</span>}
                    </div>
                    {r.message_body && <Block>{r.message_body}</Block>}
                    {r.notes && <Block label="Notes">{r.notes}</Block>}
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
