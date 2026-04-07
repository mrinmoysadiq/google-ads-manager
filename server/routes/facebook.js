const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

// ─── MEDIA BUYERS ─────────────────────────────────────────────────────────────

router.get('/media-buyers', (req, res) => {
  try {
    const buyers = db.prepare('SELECT * FROM fb_media_buyers WHERE active = 1 ORDER BY name ASC').all();
    res.json(buyers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch media buyers' });
  }
});

router.post('/media-buyers', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const result = db.prepare('INSERT INTO fb_media_buyers (name) VALUES (?)').run(name.trim());
    const created = db.prepare('SELECT * FROM fb_media_buyers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A media buyer with this name already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create media buyer' });
  }
});

router.patch('/media-buyers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, active } = req.body;
    const existing = db.prepare('SELECT * FROM fb_media_buyers WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Media buyer not found' });
    db.prepare('UPDATE fb_media_buyers SET name = COALESCE(?, name), active = COALESCE(?, active) WHERE id = ?')
      .run(name || null, active !== undefined ? active : null, id);
    const updated = db.prepare('SELECT * FROM fb_media_buyers WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A media buyer with this name already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update media buyer' });
  }
});

router.delete('/media-buyers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM fb_media_buyers WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Media buyer not found' });
    db.prepare('DELETE FROM fb_media_buyers WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete media buyer' });
  }
});

// ─── AD ACCOUNTS ──────────────────────────────────────────────────────────────

router.get('/ad-accounts', (req, res) => {
  try {
    const accounts = db.prepare('SELECT * FROM fb_ad_accounts WHERE active = 1 ORDER BY name ASC').all();
    res.json(accounts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch ad accounts' });
  }
});

router.post('/ad-accounts', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const result = db.prepare('INSERT INTO fb_ad_accounts (name) VALUES (?)').run(name.trim());
    const created = db.prepare('SELECT * FROM fb_ad_accounts WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'An ad account with this name already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create ad account' });
  }
});

router.patch('/ad-accounts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, active } = req.body;
    const existing = db.prepare('SELECT * FROM fb_ad_accounts WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Ad account not found' });
    db.prepare('UPDATE fb_ad_accounts SET name = COALESCE(?, name), active = COALESCE(?, active) WHERE id = ?')
      .run(name || null, active !== undefined ? active : null, id);
    const updated = db.prepare('SELECT * FROM fb_ad_accounts WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'An ad account with this name already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update ad account' });
  }
});

router.delete('/ad-accounts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM fb_ad_accounts WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Ad account not found' });
    db.prepare('DELETE FROM fb_ad_accounts WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete ad account' });
  }
});

module.exports = router;
