const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { Parser } = require('json2csv');

// POST / — upsert change log entry by (session_id, section, change_type)
router.post('/', (req, res) => {
  try {
    const {
      session_id,
      team_member,
      account_name,
      date,
      section,
      change_type,
      changes_made_note,
      keywords_paused,
      pause_reason,
      keywords_added,
      add_match_type,
      add_reason,
      ads_paused,
      ads_created,
      ad_change_reason,
      audiences_adjusted,
      bid_changes,
      other_targeting,
      targeting_reason
    } = req.body;

    if (!session_id || !section || !change_type) {
      return res.status(400).json({ error: 'session_id, section, and change_type are required' });
    }

    const existing = db.prepare(
      'SELECT id FROM change_log WHERE session_id = ? AND section = ? AND change_type = ?'
    ).get(session_id, section, change_type);

    if (existing) {
      db.prepare(`
        UPDATE change_log SET
          team_member = COALESCE(?, team_member),
          account_name = COALESCE(?, account_name),
          date = COALESCE(?, date),
          changes_made_note = ?,
          keywords_paused = ?,
          pause_reason = ?,
          keywords_added = ?,
          add_match_type = ?,
          add_reason = ?,
          ads_paused = ?,
          ads_created = ?,
          ad_change_reason = ?,
          audiences_adjusted = ?,
          bid_changes = ?,
          other_targeting = ?,
          targeting_reason = ?
        WHERE id = ?
      `).run(
        team_member, account_name, date,
        changes_made_note, keywords_paused, pause_reason,
        keywords_added, add_match_type, add_reason,
        ads_paused, ads_created, ad_change_reason,
        audiences_adjusted, bid_changes, other_targeting, targeting_reason,
        existing.id
      );
      const updated = db.prepare('SELECT * FROM change_log WHERE id = ?').get(existing.id);
      return res.json(updated);
    } else {
      const result = db.prepare(`
        INSERT INTO change_log (
          session_id, team_member, account_name, date, section, change_type,
          changes_made_note, keywords_paused, pause_reason,
          keywords_added, add_match_type, add_reason,
          ads_paused, ads_created, ad_change_reason,
          audiences_adjusted, bid_changes, other_targeting, targeting_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        session_id, team_member, account_name, date, section, change_type,
        changes_made_note, keywords_paused, pause_reason,
        keywords_added, add_match_type, add_reason,
        ads_paused, ads_created, ad_change_reason,
        audiences_adjusted, bid_changes, other_targeting, targeting_reason
      );
      const inserted = db.prepare('SELECT * FROM change_log WHERE id = ?').get(result.lastInsertRowid);
      return res.status(201).json(inserted);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save change log' });
  }
});

// Build filter query helper
function buildFilterQuery(queryParams, forCount = false) {
  const { account, team_member, date_from, date_to, change_type, section } = queryParams;

  const conditions = [];
  const params = [];

  if (account) {
    conditions.push('account_name = ?');
    params.push(account);
  }
  if (team_member) {
    conditions.push('team_member = ?');
    params.push(team_member);
  }
  if (date_from) {
    conditions.push('date >= ?');
    params.push(date_from);
  }
  if (date_to) {
    conditions.push('date <= ?');
    params.push(date_to);
  }
  if (change_type) {
    const types = change_type.split(',').map(t => t.trim()).filter(Boolean);
    if (types.length > 0) {
      conditions.push(`change_type IN (${types.map(() => '?').join(',')})`);
      params.push(...types);
    }
  }
  if (section && section !== 'All') {
    conditions.push('section = ?');
    params.push(section);
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  if (forCount) {
    return { sql: `SELECT COUNT(*) as total FROM change_log ${whereClause}`, params };
  }
  return { whereClause, params };
}

// GET / — filtered paginated query
router.get('/', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const { whereClause, params } = buildFilterQuery(req.query);
    const { sql: countSql, params: countParams } = buildFilterQuery(req.query, true);

    const total = db.prepare(countSql).get(...countParams).total;
    const data = db.prepare(
      `SELECT * FROM change_log ${whereClause} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    res.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get change logs' });
  }
});

// GET /export — CSV export
router.get('/export', (req, res) => {
  try {
    const { whereClause, params } = buildFilterQuery(req.query);
    const data = db.prepare(
      `SELECT * FROM change_log ${whereClause} ORDER BY date DESC, created_at DESC`
    ).all(...params);

    if (data.length === 0) {
      return res.status(204).send();
    }

    const fields = [
      'id', 'session_id', 'team_member', 'account_name', 'date', 'section', 'change_type',
      'changes_made_note', 'keywords_paused', 'pause_reason', 'keywords_added', 'add_match_type',
      'add_reason', 'ads_paused', 'ads_created', 'ad_change_reason', 'audiences_adjusted',
      'bid_changes', 'other_targeting', 'targeting_reason', 'created_at'
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(data);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=change-log-export.csv');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export change logs' });
  }
});

// GET /last-action — most recent change log for account+section
router.get('/last-action', (req, res) => {
  try {
    const { account, section } = req.query;
    if (!account || !section) {
      return res.status(400).json({ error: 'account and section are required' });
    }

    const entry = db.prepare(
      'SELECT * FROM change_log WHERE account_name = ? AND section = ? ORDER BY date DESC, created_at DESC LIMIT 1'
    ).get(account, section);

    if (!entry) {
      return res.json(null);
    }
    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get last action' });
  }
});

module.exports = router;
