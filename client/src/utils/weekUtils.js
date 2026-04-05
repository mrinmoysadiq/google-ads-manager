/** Returns ISO week string for a given date, e.g. "2026-W14" */
export function getISOWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** Returns Monday Date of the given ISO week string */
export function getWeekStart(isoWeek) {
  const [year, w] = isoWeek.split('-W').map(Number);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const weekStart = new Date(jan4);
  weekStart.setDate(jan4.getDate() - dayOfWeek + 1 + (w - 1) * 7);
  return weekStart;
}

/** Returns human-readable label e.g. "Week of Apr 7, 2026" */
export function weekLabel(isoWeek) {
  const start = getWeekStart(isoWeek);
  return 'Week of ' + start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Returns true if current date is after Friday 23:59:59 of the given ISO week */
export function isFridayPassed(isoWeek) {
  const start = getWeekStart(isoWeek);
  const friday = new Date(start);
  friday.setDate(start.getDate() + 4);
  friday.setHours(23, 59, 59, 999);
  return new Date() > friday;
}

/** Returns all ISO week strings from joinedWeek up to and including currentWeek */
export function getWeekRange(joinedWeek, currentWeek) {
  const weeks = [];
  const start = getWeekStart(joinedWeek);
  const end = getWeekStart(currentWeek);
  const cur = new Date(start);
  while (cur <= end) {
    weeks.push(getISOWeek(cur));
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

/** Formats a datetime string as "Apr 5 at 2:30 PM" */
export function formatDateTime(dt) {
  const d = new Date(dt);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
