const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

// --- ACCOUNTS ---

// GET /accounts
router.get('/accounts', (req, res) => {
  try {
    const accounts = db.prepare('SELECT * FROM accounts ORDER BY name ASC').all();
    res.json(accounts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get accounts' });
  }
});

// POST /accounts
router.post('/accounts', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const result = db.prepare('INSERT INTO accounts (name) VALUES (?)').run(name.trim());
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(account);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Account name already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// PATCH /accounts/:id
router.patch('/accounts/:id', (req, res) => {
  try {
    const { name, active } = req.body;
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const newName = name !== undefined ? name.trim() : account.name;
    const newActive = active !== undefined ? (active ? 1 : 0) : account.active;

    db.prepare('UPDATE accounts SET name = ?, active = ? WHERE id = ?').run(newName, newActive, req.params.id);
    const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Account name already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// DELETE /accounts/:id
router.delete('/accounts/:id', (req, res) => {
  try {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Check if referenced in sessions or change_log
    const sessionRef = db.prepare('SELECT id FROM sessions WHERE account_name = ? LIMIT 1').get(account.name);
    const changeRef = db.prepare('SELECT id FROM change_log WHERE account_name = ? LIMIT 1').get(account.name);

    if (sessionRef || changeRef) {
      return res.status(409).json({
        error: 'Cannot delete account: it is referenced in sessions or change log entries'
      });
    }

    db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// --- TEAM MEMBERS ---

// GET /team-members
router.get('/team-members', (req, res) => {
  try {
    const members = db.prepare('SELECT * FROM team_members ORDER BY name ASC').all();
    res.json(members);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get team members' });
  }
});

// POST /team-members
router.post('/team-members', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const result = db.prepare('INSERT INTO team_members (name) VALUES (?)').run(name.trim());
    const member = db.prepare('SELECT * FROM team_members WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(member);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Team member name already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create team member' });
  }
});

// PATCH /team-members/:id
router.patch('/team-members/:id', (req, res) => {
  try {
    const { name, active } = req.body;
    const member = db.prepare('SELECT * FROM team_members WHERE id = ?').get(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    const newName = name !== undefined ? name.trim() : member.name;
    const newActive = active !== undefined ? (active ? 1 : 0) : member.active;

    db.prepare('UPDATE team_members SET name = ?, active = ? WHERE id = ?').run(newName, newActive, req.params.id);
    const updated = db.prepare('SELECT * FROM team_members WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Team member name already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update team member' });
  }
});

// --- DATA MANAGEMENT ---

// GET /data-stats — return record counts and how many are older than 90 days
router.get('/data-stats', (req, res) => {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const totalSessions = db.prepare('SELECT COUNT(*) as cnt FROM sessions').get().cnt;
    const totalChangeLogs = db.prepare('SELECT COUNT(*) as cnt FROM change_log').get().cnt;
    const totalSlideResponses = db.prepare('SELECT COUNT(*) as cnt FROM slide_responses').get().cnt;

    const oldSessions = db.prepare('SELECT COUNT(*) as cnt FROM sessions WHERE date(created_at) < ?').get(cutoffStr).cnt;
    const oldChangeLogs = db.prepare('SELECT COUNT(*) as cnt FROM change_log WHERE date < ?').get(cutoffStr).cnt;

    // Get oldest record date
    const oldestSession = db.prepare('SELECT MIN(created_at) as oldest FROM sessions').get().oldest;
    const oldestChangeLog = db.prepare('SELECT MIN(date) as oldest FROM change_log').get().oldest;
    const oldest = [oldestSession, oldestChangeLog].filter(Boolean).sort()[0] || null;

    res.json({
      total: { sessions: totalSessions, changeLogs: totalChangeLogs, slideResponses: totalSlideResponses },
      olderThan90Days: { sessions: oldSessions, changeLogs: oldChangeLogs },
      oldestRecord: oldest,
      cutoffDate: cutoffStr
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get data stats' });
  }
});

// DELETE /cleanup — delete all data older than 90 days and reclaim disk space
router.delete('/cleanup', (req, res) => {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    // Find old session IDs first
    const oldSessionIds = db.prepare('SELECT id FROM sessions WHERE date(created_at) < ?').all(cutoffStr).map(r => r.id);

    let deletedSessions = 0;
    let deletedSlideResponses = 0;
    let deletedChangeLogs = 0;

    if (oldSessionIds.length > 0) {
      const placeholders = oldSessionIds.map(() => '?').join(',');
      deletedSlideResponses = db.prepare(`DELETE FROM slide_responses WHERE session_id IN (${placeholders})`).run(...oldSessionIds).changes;
      deletedSessions = db.prepare(`DELETE FROM sessions WHERE id IN (${placeholders})`).run(...oldSessionIds).changes;
    }

    // Delete old change_log entries (by date field)
    deletedChangeLogs = db.prepare('DELETE FROM change_log WHERE date < ?').run(cutoffStr).changes;

    // Run VACUUM to reclaim disk space on the persistent disk
    db.exec('VACUUM');

    console.log(`Cleanup: removed ${deletedSessions} sessions, ${deletedSlideResponses} slide responses, ${deletedChangeLogs} change log entries. VACUUM complete.`);

    res.json({
      success: true,
      deleted: {
        sessions: deletedSessions,
        slideResponses: deletedSlideResponses,
        changeLogs: deletedChangeLogs
      },
      cutoffDate: cutoffStr,
      message: `Deleted all records older than ${cutoffStr} and reclaimed disk space.`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clean up old data' });
  }
});

module.exports = router;
