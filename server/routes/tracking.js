const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

// ── Clients ──────────────────────────────────────────────────────────────────

router.get('/clients', (req, res) => {
  try {
    const clients = db.prepare('SELECT * FROM tracking_clients WHERE active = 1 ORDER BY name ASC').all();
    res.json(clients);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

router.get('/clients/all', (req, res) => {
  try {
    const clients = db.prepare('SELECT * FROM tracking_clients ORDER BY name ASC').all();
    res.json(clients);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

router.post('/clients', (req, res) => {
  const { name, website } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    const result = db.prepare('INSERT INTO tracking_clients (name, website) VALUES (?, ?)').run(name.trim(), website || null);
    const created = db.prepare('SELECT * FROM tracking_clients WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'A client with this name already exists' });
    res.status(500).json({ error: 'Failed to create client' });
  }
});

router.patch('/clients/:id', (req, res) => {
  const { name, website, active } = req.body;
  const client = db.prepare('SELECT * FROM tracking_clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  try {
    db.prepare('UPDATE tracking_clients SET name=?, website=?, active=? WHERE id=?').run(
      name !== undefined ? name.trim() : client.name,
      website !== undefined ? (website || null) : client.website,
      active !== undefined ? active : client.active,
      req.params.id
    );
    const updated = db.prepare('SELECT * FROM tracking_clients WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'A client with this name already exists' });
    res.status(500).json({ error: 'Failed to update client' });
  }
});

router.delete('/clients/:id', (req, res) => {
  const client = db.prepare('SELECT * FROM tracking_clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  try {
    db.prepare('DELETE FROM tracking_clients WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

module.exports = router;
