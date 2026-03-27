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

module.exports = router;
