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

function enrichAccountWithFieldValues(account) {
  const values = db.prepare('SELECT field_key, value FROM fb_account_field_values WHERE account_id = ?').all(account.id);
  const custom = {};
  values.forEach(v => { custom[v.field_key] = v.value; });
  return { ...account, custom_fields: custom };
}

router.get('/ad-accounts', (req, res) => {
  try {
    const { all } = req.query;
    const whereClause = all === '1' ? '' : 'WHERE a.active = 1';
    const accounts = db.prepare(`
      SELECT a.*,
        (SELECT MAX(s.date) FROM fb_audit_sessions s WHERE s.ad_account = a.name) AS last_audit_date
      FROM fb_ad_accounts a
      ${whereClause}
      ORDER BY a.name ASC
    `).all().map(enrichAccountWithFieldValues);

    // Attach assigned buyers (auto-matched from audit history) — single query for all accounts
    const buyerRows = db.prepare('SELECT DISTINCT ad_account, media_buyer FROM fb_audit_sessions WHERE media_buyer IS NOT NULL').all();
    const buyerMap = {};
    buyerRows.forEach(r => {
      if (!buyerMap[r.ad_account]) buyerMap[r.ad_account] = [];
      if (!buyerMap[r.ad_account].includes(r.media_buyer)) buyerMap[r.ad_account].push(r.media_buyer);
    });

    res.json(accounts.map(a => ({ ...a, assigned_buyers: buyerMap[a.name] || [] })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch ad accounts' });
  }
});

router.post('/ad-accounts', (req, res) => {
  try {
    const { name, website, notes } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const result = db.prepare('INSERT INTO fb_ad_accounts (name, website, notes) VALUES (?, ?, ?)').run(name.trim(), website || null, notes || null);
    const created = enrichAccountWithFieldValues(db.prepare('SELECT * FROM fb_ad_accounts WHERE id = ?').get(result.lastInsertRowid));
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
    const { name, active, website, notes, custom_fields } = req.body;
    const existing = db.prepare('SELECT * FROM fb_ad_accounts WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Ad account not found' });
    db.prepare('UPDATE fb_ad_accounts SET name = COALESCE(?, name), active = COALESCE(?, active), website = COALESCE(?, website), notes = COALESCE(?, notes) WHERE id = ?')
      .run(name || null, active !== undefined ? active : null, website !== undefined ? (website || null) : null, notes !== undefined ? (notes || null) : null, id);
    if (custom_fields && typeof custom_fields === 'object') {
      const upsert = db.prepare('INSERT INTO fb_account_field_values (account_id, field_key, value) VALUES (?, ?, ?) ON CONFLICT(account_id, field_key) DO UPDATE SET value = excluded.value');
      Object.entries(custom_fields).forEach(([key, val]) => upsert.run(id, key, val || null));
    }
    const updated = enrichAccountWithFieldValues(db.prepare('SELECT * FROM fb_ad_accounts WHERE id = ?').get(id));
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

// ─── ACCOUNT CUSTOM FIELDS ────────────────────────────────────────────────────

router.get('/account-fields', (req, res) => {
  try {
    const { all } = req.query;
    const query = all === '1'
      ? 'SELECT * FROM fb_account_fields ORDER BY sort_order ASC, id ASC'
      : 'SELECT * FROM fb_account_fields WHERE active = 1 ORDER BY sort_order ASC, id ASC';
    const fields = db.prepare(query).all().map(parseField);
    res.json(fields);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch account fields' });
  }
});

function parseField(f) {
  if (!f) return f;
  return { ...f, options: f.options ? JSON.parse(f.options) : [] };
}

router.post('/account-fields', (req, res) => {
  try {
    const { label, field_type = 'text', options = [], pinned = 0 } = req.body;
    if (!label || !label.trim()) return res.status(400).json({ error: 'Label is required' });
    const field_key = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM fb_account_fields').get();
    const sort_order = (maxOrder.m || 0) + 1;
    const result = db.prepare('INSERT INTO fb_account_fields (label, field_key, field_type, sort_order, options, pinned) VALUES (?, ?, ?, ?, ?, ?)').run(label.trim(), field_key, field_type, sort_order, JSON.stringify(options), pinned ? 1 : 0);
    const created = parseField(db.prepare('SELECT * FROM fb_account_fields WHERE id = ?').get(result.lastInsertRowid));
    res.status(201).json(created);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A field with this key already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create account field' });
  }
});

router.patch('/account-fields/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { label, field_type, sort_order, active, options, pinned } = req.body;
    const existing = db.prepare('SELECT * FROM fb_account_fields WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Field not found' });
    db.prepare('UPDATE fb_account_fields SET label = COALESCE(?, label), field_type = COALESCE(?, field_type), sort_order = COALESCE(?, sort_order), active = COALESCE(?, active), options = COALESCE(?, options), pinned = COALESCE(?, pinned) WHERE id = ?')
      .run(label || null, field_type || null, sort_order !== undefined ? sort_order : null, active !== undefined ? active : null, options !== undefined ? JSON.stringify(options) : null, pinned !== undefined ? (pinned ? 1 : 0) : null, id);
    const updated = parseField(db.prepare('SELECT * FROM fb_account_fields WHERE id = ?').get(id));
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update account field' });
  }
});

router.delete('/account-fields/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM fb_account_fields WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Field not found' });
    db.prepare('DELETE FROM fb_account_field_values WHERE field_key = ?').run(existing.field_key);
    db.prepare('DELETE FROM fb_account_fields WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete account field' });
  }
});

// ─── ACCOUNT DETAIL ───────────────────────────────────────────────────────────

router.get('/ad-accounts/:id/detail', (req, res) => {
  try {
    const { id } = req.params;
    const account = db.prepare('SELECT * FROM fb_ad_accounts WHERE id = ?').get(id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const enriched = enrichAccountWithFieldValues(account);

    // Auto-match: distinct media buyers who have audited this account
    const buyers = db.prepare(
      'SELECT DISTINCT media_buyer FROM fb_audit_sessions WHERE ad_account = ? AND media_buyer IS NOT NULL ORDER BY media_buyer ASC'
    ).all(account.name).map(r => r.media_buyer);

    // Recent audit sessions (last 20)
    const auditSessions = db.prepare(
      'SELECT * FROM fb_audit_sessions WHERE ad_account = ? ORDER BY date DESC, created_at DESC LIMIT 20'
    ).all(account.name).map(r => ({ ...r, answers: JSON.parse(r.answers) }));

    // Recent change log entries (last 20)
    const changeLog = db.prepare(
      'SELECT * FROM fb_change_log WHERE ad_account = ? ORDER BY date DESC, created_at DESC LIMIT 20'
    ).all(account.name);

    res.json({ ...enriched, assigned_buyers: buyers, audit_sessions: auditSessions, change_log: changeLog });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch account detail' });
  }
});

// ─── AUDIT SESSIONS ───────────────────────────────────────────────────────────

router.post('/audit-sessions', (req, res) => {
  try {
    const { date, media_buyer, ad_account, answers, issue_count } = req.body;
    if (!date || !ad_account || !answers) return res.status(400).json({ error: 'date, ad_account, and answers are required' });
    const result = db.prepare(`
      INSERT INTO fb_audit_sessions (date, media_buyer, ad_account, answers, issue_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(date, media_buyer || null, ad_account, JSON.stringify(answers), issue_count || 0);
    const row = db.prepare('SELECT * FROM fb_audit_sessions WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ ...row, answers: JSON.parse(row.answers) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save audit session' });
  }
});

router.patch('/audit-sessions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM fb_audit_sessions WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Session not found' });
    const { date, media_buyer, ad_account, answers, issue_count } = req.body;
    db.prepare(`
      UPDATE fb_audit_sessions SET
        date = COALESCE(?, date), media_buyer = ?, ad_account = COALESCE(?, ad_account),
        answers = COALESCE(?, answers), issue_count = COALESCE(?, issue_count)
      WHERE id = ?
    `).run(date || null, media_buyer ?? row.media_buyer, ad_account || null, answers ? JSON.stringify(answers) : null, issue_count ?? null, id);
    const updated = db.prepare('SELECT * FROM fb_audit_sessions WHERE id = ?').get(id);
    res.json({ ...updated, answers: JSON.parse(updated.answers) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update audit session' });
  }
});

router.get('/audit-sessions', (req, res) => {
  try {
    const { ad_account, media_buyer, date_from, date_to, page: pg, limit: lm } = req.query;
    const page = parseInt(pg) || 1;
    const limit = parseInt(lm) || 50;
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    if (ad_account) { conditions.push('ad_account = ?'); params.push(ad_account); }
    if (media_buyer) { conditions.push('media_buyer = ?'); params.push(media_buyer); }
    if (date_from) { conditions.push('date >= ?'); params.push(date_from); }
    if (date_to) { conditions.push('date <= ?'); params.push(date_to); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const total = db.prepare(`SELECT COUNT(*) as cnt FROM fb_audit_sessions ${where}`).get(...params).cnt;
    const rows = db.prepare(`SELECT * FROM fb_audit_sessions ${where} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    res.json({ data: rows.map(r => ({ ...r, answers: JSON.parse(r.answers) })), total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit sessions' });
  }
});

router.get('/audit-sessions/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM fb_audit_sessions WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ ...row, answers: JSON.parse(row.answers) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch session' });
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
