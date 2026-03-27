const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

// POST / — create session
router.post('/', (req, res) => {
  try {
    const { team_member, account_name, date } = req.body;
    if (!team_member || !account_name || !date) {
      return res.status(400).json({ error: 'team_member, account_name, and date are required' });
    }
    const stmt = db.prepare(
      'INSERT INTO sessions (team_member, account_name, date, status) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(team_member, account_name, date, 'in_progress');
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET /:id — get session by id
router.get('/:id', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// PATCH /:id/complete — set status='completed'
router.patch('/:id/complete', (req, res) => {
  try {
    const result = db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run('completed', req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

// GET /:id/responses — get all slide_responses for session
router.get('/:id/responses', (req, res) => {
  try {
    const responses = db.prepare(
      'SELECT * FROM slide_responses WHERE session_id = ? ORDER BY slide_number, field_key'
    ).all(req.params.id);
    res.json(responses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get responses' });
  }
});

module.exports = router;
