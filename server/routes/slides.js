const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

// POST / — upsert slide response
router.post('/', (req, res) => {
  try {
    const { session_id, slide_number, section_name, field_key, field_value } = req.body;
    if (!session_id || slide_number === undefined || !section_name || !field_key) {
      return res.status(400).json({ error: 'session_id, slide_number, section_name, and field_key are required' });
    }

    const existing = db.prepare(
      'SELECT id FROM slide_responses WHERE session_id = ? AND slide_number = ? AND field_key = ?'
    ).get(session_id, slide_number, field_key);

    if (existing) {
      db.prepare(
        'UPDATE slide_responses SET field_value = ?, section_name = ?, saved_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(field_value, section_name, existing.id);
      const updated = db.prepare('SELECT * FROM slide_responses WHERE id = ?').get(existing.id);
      return res.json(updated);
    } else {
      const result = db.prepare(
        'INSERT INTO slide_responses (session_id, slide_number, section_name, field_key, field_value) VALUES (?, ?, ?, ?, ?)'
      ).run(session_id, slide_number, section_name, field_key, field_value);
      const inserted = db.prepare('SELECT * FROM slide_responses WHERE id = ?').get(result.lastInsertRowid);
      return res.status(201).json(inserted);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save slide response' });
  }
});

// GET /:sessionId — get all responses for session grouped by slide_number
router.get('/:sessionId', (req, res) => {
  try {
    const responses = db.prepare(
      'SELECT * FROM slide_responses WHERE session_id = ? ORDER BY slide_number, field_key'
    ).all(req.params.sessionId);

    // Group by slide_number
    const grouped = {};
    for (const row of responses) {
      if (!grouped[row.slide_number]) {
        grouped[row.slide_number] = [];
      }
      grouped[row.slide_number].push(row);
    }

    res.json(grouped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get slide responses' });
  }
});

module.exports = router;
