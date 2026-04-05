const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

// ── Week calculation helpers ─────────────────────────────────────────────────

/** Returns ISO week string for a given date, e.g. "2026-W14" */
function getISOWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** Returns Monday Date of the given ISO week string */
function getWeekStart(isoWeek) {
  const [year, w] = isoWeek.split('-W').map(Number);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // Mon=1..Sun=7
  const weekStart = new Date(jan4);
  weekStart.setDate(jan4.getDate() - dayOfWeek + 1 + (w - 1) * 7);
  return weekStart;
}

/** Returns true if current date is after Friday 23:59:59 of the given ISO week */
function isLate(week) {
  const start = getWeekStart(week);
  const friday = new Date(start);
  friday.setDate(start.getDate() + 4);
  friday.setHours(23, 59, 59, 999);
  return new Date() > friday;
}

/** Returns all ISO week strings from joinedWeek up to and including currentWeek */
function getWeekRange(joinedWeek, currentWeek) {
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

/** Calculates streak, total_submissions, missed_weeks for a user */
function calculateStats(userId) {
  const user = db.prepare('SELECT joined_week FROM learning_users WHERE id = ?').get(userId);
  if (!user) return { streak: 0, total_submissions: 0, missed_weeks: 0, last_submission_week: null };

  const currentWeek = getISOWeek();
  const allWeeks = getWeekRange(user.joined_week, currentWeek);

  const submittedRows = db.prepare('SELECT DISTINCT week FROM learning_entries WHERE user_id = ?').all(userId);
  const submittedSet = new Set(submittedRows.map(r => r.week));

  const lastRow = db.prepare(
    'SELECT week FROM learning_entries WHERE user_id = ? ORDER BY week DESC LIMIT 1'
  ).get(userId);
  const lastSubmissionWeek = lastRow ? lastRow.week : null;

  const totalSubmissions = submittedSet.size;

  // Missed = past weeks where Friday has passed and no entry exists
  let missedWeeks = 0;
  for (const week of allWeeks) {
    if (week === currentWeek && !isLate(week)) continue; // grace period for current week
    if (!submittedSet.has(week)) missedWeeks++;
  }

  // Streak = consecutive submitted weeks counting backwards from current
  let streak = 0;
  const reversedWeeks = [...allWeeks].reverse();
  for (const week of reversedWeeks) {
    if (week === currentWeek && !isLate(week)) continue; // don't break streak for current open week
    if (submittedSet.has(week)) {
      streak++;
    } else {
      break;
    }
  }

  return { streak, total_submissions: totalSubmissions, missed_weeks: missedWeeks, last_submission_week: lastSubmissionWeek };
}

// ── Settings ─────────────────────────────────────────────────────────────────

router.get('/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM learning_settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/settings', (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
    db.prepare(
      'INSERT INTO learning_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(key, String(value));
    res.json({ key, value: String(value) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Roles ─────────────────────────────────────────────────────────────────────

router.get('/roles', (req, res) => {
  try {
    const roles = db.prepare('SELECT * FROM learning_roles ORDER BY name').all();
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/roles', (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const result = db.prepare('INSERT INTO learning_roles (name) VALUES (?)').run(name.trim());
    res.json({ id: result.lastInsertRowid, name: name.trim(), created_at: new Date().toISOString() });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Role already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/roles/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const inUse = db.prepare('SELECT COUNT(*) as cnt FROM learning_users WHERE role_id = ?').get(id);
    if (inUse.cnt > 0) return res.status(409).json({ error: 'Role is assigned to users and cannot be deleted' });
    db.prepare('DELETE FROM learning_roles WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Users ─────────────────────────────────────────────────────────────────────

router.get('/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.*, r.name as role_name, m.name as manager_name
      FROM learning_users u
      LEFT JOIN learning_roles r ON u.role_id = r.id
      LEFT JOIN learning_users m ON u.manager_id = m.id
      ORDER BY u.name
    `).all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', (req, res) => {
  try {
    const { name, role_id, manager_id } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const joined_week = getISOWeek();
    const result = db.prepare(
      'INSERT INTO learning_users (name, role_id, manager_id, joined_week) VALUES (?, ?, ?, ?)'
    ).run(name.trim(), role_id || null, manager_id || null, joined_week);
    const user = db.prepare(`
      SELECT u.*, r.name as role_name, m.name as manager_name
      FROM learning_users u
      LEFT JOIN learning_roles r ON u.role_id = r.id
      LEFT JOIN learning_users m ON u.manager_id = m.id
      WHERE u.id = ?
    `).get(result.lastInsertRowid);
    res.json(user);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'User already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.patch('/users/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, role_id, manager_id, active } = req.body;
    const user = db.prepare('SELECT * FROM learning_users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    db.prepare(`
      UPDATE learning_users
      SET name = ?, role_id = ?, manager_id = ?, active = ?
      WHERE id = ?
    `).run(
      name !== undefined ? name.trim() : user.name,
      role_id !== undefined ? (role_id || null) : user.role_id,
      manager_id !== undefined ? (manager_id || null) : user.manager_id,
      active !== undefined ? (active ? 1 : 0) : user.active,
      id
    );

    const updated = db.prepare(`
      SELECT u.*, r.name as role_name, m.name as manager_name
      FROM learning_users u
      LEFT JOIN learning_roles r ON u.role_id = r.id
      LEFT JOIN learning_users m ON u.manager_id = m.id
      WHERE u.id = ?
    `).get(id);
    res.json(updated);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Name already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/:id/stats', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const stats = calculateStats(id);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Entries ───────────────────────────────────────────────────────────────────

router.get('/entries', (req, res) => {
  try {
    const { user_id, week } = req.query;
    let query = `
      SELECT e.*,
        (SELECT COUNT(*) FROM learning_threads t WHERE t.entry_id = e.id) as thread_count
      FROM learning_entries e
      WHERE 1=1
    `;
    const params = [];
    if (user_id) { query += ' AND e.user_id = ?'; params.push(user_id); }
    if (week) { query += ' AND e.week = ?'; params.push(week); }
    query += ' ORDER BY e.created_at DESC';
    const entries = db.prepare(query).all(...params);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/entries', (req, res) => {
  try {
    const { user_id, week, what_learned, source_type, source_detail, how_to_apply } = req.body;
    if (!user_id || !week || !what_learned || !source_type || !how_to_apply) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const late = isLate(week) ? 1 : 0;
    const result = db.prepare(`
      INSERT INTO learning_entries (user_id, week, what_learned, source_type, source_detail, how_to_apply, is_late)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(user_id, week, what_learned, source_type, source_detail || null, how_to_apply, late);
    const entry = db.prepare(`
      SELECT e.*,
        (SELECT COUNT(*) FROM learning_threads t WHERE t.entry_id = e.id) as thread_count
      FROM learning_entries e WHERE e.id = ?
    `).get(result.lastInsertRowid);
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/entries/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { what_learned, source_type, source_detail, how_to_apply } = req.body;
    const entry = db.prepare('SELECT * FROM learning_entries WHERE id = ?').get(id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    db.prepare(`
      UPDATE learning_entries
      SET what_learned = ?, source_type = ?, source_detail = ?, how_to_apply = ?
      WHERE id = ?
    `).run(
      what_learned ?? entry.what_learned,
      source_type ?? entry.source_type,
      source_detail !== undefined ? source_detail : entry.source_detail,
      how_to_apply ?? entry.how_to_apply,
      id
    );
    const updated = db.prepare(`
      SELECT e.*,
        (SELECT COUNT(*) FROM learning_threads t WHERE t.entry_id = e.id) as thread_count
      FROM learning_entries e WHERE e.id = ?
    `).get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/entries/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    db.prepare('DELETE FROM learning_threads WHERE entry_id = ?').run(id);
    db.prepare('DELETE FROM learning_entries WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Manager views ─────────────────────────────────────────────────────────────

router.get('/manager/:manager_id/overview', (req, res) => {
  try {
    const managerId = parseInt(req.params.manager_id);
    const directReports = db.prepare(`
      SELECT u.*, r.name as role_name
      FROM learning_users u
      LEFT JOIN learning_roles r ON u.role_id = r.id
      WHERE u.manager_id = ? AND u.active = 1
      ORDER BY u.name
    `).all(managerId);

    const overview = directReports.map(user => ({
      user,
      ...calculateStats(user.id),
    }));
    res.json(overview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/manager/:manager_id/feed', (req, res) => {
  try {
    const managerId = parseInt(req.params.manager_id);
    const { user_id, week } = req.query;

    let query = `
      SELECT e.*, u.name as user_name, r.name as role_name,
        (SELECT COUNT(*) FROM learning_threads t WHERE t.entry_id = e.id) as thread_count
      FROM learning_entries e
      JOIN learning_users u ON e.user_id = u.id
      LEFT JOIN learning_roles r ON u.role_id = r.id
      WHERE u.manager_id = ?
    `;
    const params = [managerId];
    if (user_id) { query += ' AND e.user_id = ?'; params.push(user_id); }
    if (week) { query += ' AND e.week = ?'; params.push(week); }
    query += ' ORDER BY e.created_at DESC';

    const entries = db.prepare(query).all(...params);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Threads ───────────────────────────────────────────────────────────────────

router.get('/threads/:entry_id', (req, res) => {
  try {
    const entryId = parseInt(req.params.entry_id);
    const threads = db.prepare(`
      SELECT t.*, u.name as author_name
      FROM learning_threads t
      JOIN learning_users u ON t.author_id = u.id
      WHERE t.entry_id = ?
      ORDER BY t.created_at ASC
    `).all(entryId);
    res.json(threads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/threads', (req, res) => {
  try {
    const { entry_id, author_id, message } = req.body;
    if (!entry_id || !author_id || !message?.trim()) {
      return res.status(400).json({ error: 'entry_id, author_id, and message required' });
    }
    const result = db.prepare(
      'INSERT INTO learning_threads (entry_id, author_id, message) VALUES (?, ?, ?)'
    ).run(entry_id, author_id, message.trim());
    const thread = db.prepare(`
      SELECT t.*, u.name as author_name
      FROM learning_threads t
      JOIN learning_users u ON t.author_id = u.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);
    res.json(thread);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
