const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// "1 Jul 26" from "2026-07-01" or ISO datetime string
export function fmtDate(str) {
  if (!str) return '';
  try {
    let d;
    if (typeof str === 'string' && !str.includes('T') && !str.includes(' ')) {
      const [y, m, day] = str.split('-');
      d = new Date(parseInt(y), parseInt(m) - 1, parseInt(day));
    } else {
      d = new Date(str);
    }
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
  } catch { return String(str); }
}

// "1 Jul 26 · 3:45 PM"
export function fmtDateTime(str) {
  if (!str) return '';
  try {
    const d = new Date(str);
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)} · ${time}`;
  } catch { return String(str); }
}

function ordinalSuffix(day) {
  if (day % 10 === 1 && day !== 11) return 'st';
  if (day % 10 === 2 && day !== 12) return 'nd';
  if (day % 10 === 3 && day !== 13) return 'rd';
  return 'th';
}

// "12th Sep, 2026" — used by the LinkedIn tracker (kept separate from fmtDate,
// which is the "1 Jul 26" convention used everywhere else in the app).
export function fmtDateLong(str) {
  if (!str) return '';
  try {
    let d;
    if (typeof str === 'string' && !str.includes('T') && !str.includes(' ')) {
      const [y, m, day] = str.split('-');
      d = new Date(parseInt(y), parseInt(m) - 1, parseInt(day));
    } else {
      d = new Date(str);
    }
    const day = d.getDate();
    return `${day}${ordinalSuffix(day)} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
  } catch { return String(str); }
}

// "12th Sep, 2026 · 3:45 PM"
export function fmtDateTimeLong(str) {
  if (!str) return '';
  try {
    const d = new Date(str);
    const day = d.getDate();
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${day}${ordinalSuffix(day)} ${MONTHS[d.getMonth()]}, ${d.getFullYear()} · ${time}`;
  } catch { return String(str); }
}

// Local today as "YYYY-MM-DD" — avoids UTC vs local timezone mismatch
export function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// N days ago as "YYYY-MM-DD" using local date
export function daysAgoLocal(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
