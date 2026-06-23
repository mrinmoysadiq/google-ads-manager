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

// ─── CHANGE LOG ───────────────────────────────────────────────────────────────

function buildChangeLogFilter(query, forCount = false) {
  const { ad_account, media_buyer, date_from, date_to, change_level, changes_made_to, search } = query;
  const conditions = [];
  const params = [];

  if (ad_account) { conditions.push('ad_account = ?'); params.push(ad_account); }
  if (media_buyer) { conditions.push('media_buyer = ?'); params.push(media_buyer); }
  if (date_from) { conditions.push('date >= ?'); params.push(date_from); }
  if (date_to) { conditions.push('date <= ?'); params.push(date_to); }
  if (change_level) { conditions.push('change_level = ?'); params.push(change_level); }
  if (changes_made_to) { conditions.push('changes_made_to = ?'); params.push(changes_made_to); }
  if (search) {
    const like = `%${search}%`;
    conditions.push('(campaign_name LIKE ? OR ad_set_name LIKE ? OR ad_name LIKE ? OR what_changed LIKE ? OR why_changed LIKE ?)');
    params.push(like, like, like, like, like);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  if (forCount) return { sql: `SELECT COUNT(*) as total FROM fb_change_log ${where}`, params };
  return { where, params };
}

router.get('/change-log/stats', (req, res) => {
  try {
    const rows = db.prepare(
      `SELECT change_level, changes_made_to, COUNT(*) as cnt FROM fb_change_log GROUP BY change_level, changes_made_to`
    ).all();
    const total = db.prepare('SELECT COUNT(*) as cnt FROM fb_change_log').get().cnt;
    const byLevel = {};
    const byType = {};
    rows.forEach(r => {
      byLevel[r.change_level] = (byLevel[r.change_level] || 0) + r.cnt;
      if (r.changes_made_to) byType[r.changes_made_to] = (byType[r.changes_made_to] || 0) + r.cnt;
    });
    res.json({ total, byLevel, byType });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/change-log', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;
    const { where, params } = buildChangeLogFilter(req.query);
    const { sql: countSql, params: countParams } = buildChangeLogFilter(req.query, true);
    const total = db.prepare(countSql).get(...countParams).total;
    const data = db.prepare(
      `SELECT * FROM fb_change_log ${where} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);
    res.json({ data, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch change log' });
  }
});

router.post('/change-log', (req, res) => {
  try {
    const { date, change_level, media_buyer, ad_account, campaign_name, ad_set_name, ad_name, changes_made_to, what_changed, why_changed } = req.body;
    if (!date || !change_level) return res.status(400).json({ error: 'date and change_level are required' });
    const result = db.prepare(`
      INSERT INTO fb_change_log (date, change_level, media_buyer, ad_account, campaign_name, ad_set_name, ad_name, changes_made_to, what_changed, why_changed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(date, change_level, media_buyer || null, ad_account || null, campaign_name || null, ad_set_name || null, ad_name || null, changes_made_to || null, what_changed || null, why_changed || null);
    const inserted = db.prepare('SELECT * FROM fb_change_log WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(inserted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create change log entry' });
  }
});

router.patch('/change-log/:id', (req, res) => {
  try {
    const { id } = req.params;
    const entry = db.prepare('SELECT * FROM fb_change_log WHERE id = ?').get(id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    const { date, change_level, media_buyer, ad_account, campaign_name, ad_set_name, ad_name, changes_made_to, what_changed, why_changed } = req.body;
    db.prepare(`
      UPDATE fb_change_log SET
        date = COALESCE(?, date), change_level = COALESCE(?, change_level),
        media_buyer = ?, ad_account = ?, campaign_name = ?, ad_set_name = ?,
        ad_name = ?, changes_made_to = ?, what_changed = ?, why_changed = ?
      WHERE id = ?
    `).run(date || null, change_level || null, media_buyer ?? entry.media_buyer, ad_account ?? entry.ad_account, campaign_name ?? entry.campaign_name, ad_set_name ?? entry.ad_set_name, ad_name ?? entry.ad_name, changes_made_to ?? entry.changes_made_to, what_changed ?? entry.what_changed, why_changed ?? entry.why_changed, id);
    const updated = db.prepare('SELECT * FROM fb_change_log WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update change log entry' });
  }
});

router.delete('/change-log/:id', (req, res) => {
  try {
    const { id } = req.params;
    const entry = db.prepare('SELECT id FROM fb_change_log WHERE id = ?').get(id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    db.prepare('DELETE FROM fb_change_log WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete change log entry' });
  }
});

router.get('/change-log/export', (req, res) => {
  try {
    const { Parser } = require('json2csv');
    const { where, params } = buildChangeLogFilter(req.query);
    const data = db.prepare(
      `SELECT id, date, change_level, media_buyer, ad_account, campaign_name, ad_set_name, ad_name, changes_made_to, what_changed, why_changed, created_at FROM fb_change_log ${where} ORDER BY date DESC, created_at DESC`
    ).all(...params);
    if (data.length === 0) return res.status(204).send();
    const parser = new Parser({ fields: ['id','date','change_level','media_buyer','ad_account','campaign_name','ad_set_name','ad_name','changes_made_to','what_changed','why_changed','created_at'] });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=fb-change-log.csv');
    res.send(parser.parse(data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export' });
  }
});

module.exports = router;
