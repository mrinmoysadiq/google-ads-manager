const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'infinix_secret_key_v2';

// Decode the JWT from Authorization header and return the app_user row
function getRequestUser(req) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return null;
    const payload = jwt.verify(token, SECRET);
    return db.prepare('SELECT id, name, role FROM app_users WHERE id = ? AND active = 1').get(payload.id) || null;
  } catch { return null; }
}

// For non-admin users: return their specialist id, or null if admin, or -1 if no specialist found
function resolveSpecialistForUser(reqUser) {
  if (!reqUser || reqUser.role === 'admin') return null; // admin = no restriction
  const spec = db.prepare('SELECT id FROM outreach_specialists WHERE LOWER(name) = LOWER(?)').get(reqUser.name);
  return spec ? spec.id : -1; // -1 = no specialist found → return no leads
}

const TERMINAL_STATUSES = ['Closed / Booked as Client', 'Disqualified', 'No Response / Dead'];
const CONNECTION_STATUSES = ['Not Connected', 'Request Sent', 'Connected'];

function getSetting(key, fallback) {
  try {
    const row = db.prepare('SELECT value FROM linkedin_settings WHERE key = ?').get(key);
    return row ? row.value : fallback;
  } catch { return fallback; }
}

// The pipeline's locked default stage — used as the status for new leads
// instead of a hardcoded name, since stages are otherwise user-editable.
function getFirstStageName() {
  const def = db.prepare('SELECT name FROM linkedin_pipeline_stages WHERE is_default = 1 LIMIT 1').get();
  if (def) return def.name;
  const stage = db.prepare('SELECT name FROM linkedin_pipeline_stages WHERE active = 1 ORDER BY order_index ASC, id ASC LIMIT 1').get();
  return stage ? stage.name : 'Identified';
}

// ─── LEADS ────────────────────────────────────────────────────────────────────

router.get('/leads', (req, res) => {
  try {
    let {
      specialist_id, status, search,
      date_from, date_to, hot, unread,
      page = 1, limit = 25,
      sort_by = 'created_at', sort_dir = 'DESC',
    } = req.query;

    // ── Server-side access enforcement ──────────────────────────────────────
    const reqUser = getRequestUser(req);
    const enforcedSpecId = resolveSpecialistForUser(reqUser);
    if (enforcedSpecId === -1) {
      return res.json({ data: [], total: 0, page: 1, totalPages: 0 });
    }
    if (enforcedSpecId !== null) {
      specialist_id = String(enforcedSpecId);
    }
    // ────────────────────────────────────────────────────────────────────────

    const conditions = ['l.deleted_at IS NULL'];
    const params = [];

    if (specialist_id) { conditions.push('l.specialist_id = ?'); params.push(specialist_id); }
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length > 0) {
        conditions.push(`l.status IN (${statuses.map(() => '?').join(',')})`);
        params.push(...statuses);
      }
    }
    if (search) {
      conditions.push('(l.lead_name LIKE ? OR l.company_name LIKE ? OR l.job_title LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (date_from) { conditions.push("date(l.created_at) >= ?"); params.push(date_from); }
    if (date_to) { conditions.push("date(l.created_at) <= ?"); params.push(date_to); }
    if (hot === '1' || hot === 'true') { conditions.push('l.is_hot_lead = 1'); }
    if (unread === '1' || unread === 'true') {
      conditions.push('EXISTS (SELECT 1 FROM linkedin_lead_comments c WHERE c.lead_id = l.id AND c.is_read = 0)');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const allowedSort = ['lead_name', 'company_name', 'status', 'created_at', 'status_updated_at', 'follower_count'];
    const safeSortBy = allowedSort.includes(sort_by) ? `l.${sort_by}` : 'l.created_at';
    const safeSortDir = sort_dir === 'ASC' ? 'ASC' : 'DESC';

    const total = db.prepare(`SELECT COUNT(*) as cnt FROM linkedin_leads l ${whereClause}`).get(...params).cnt;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const leads = db.prepare(`
      SELECT
        l.id, l.specialist_id, l.lead_name, l.linkedin_profile_url, l.activity_url,
        l.company_name, l.job_title, l.follower_count,
        l.status, l.connection_status, l.created_at, l.status_updated_at,
        l.is_hot_lead,
        s.name as specialist_name,
        (SELECT COUNT(*) FROM linkedin_engagements WHERE lead_id = l.id) as engagement_count,
        (SELECT MAX(date) FROM linkedin_engagements WHERE lead_id = l.id) as last_engagement_date,
        (SELECT COUNT(*) FROM linkedin_lead_replies WHERE lead_id = l.id) as reply_count,
        (SELECT COUNT(*) FROM linkedin_lead_comments WHERE lead_id = l.id) as comment_count,
        (SELECT COUNT(*) FROM linkedin_lead_comments WHERE lead_id = l.id AND is_read = 0) as unread_comment_count,
        (SELECT json_group_object(stage_key, json_object('is_seen', is_seen))
           FROM linkedin_followups WHERE lead_id = l.id) as followups_summary
      FROM linkedin_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortDir}
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    leads.forEach(l => {
      l.followups_summary = l.followups_summary ? JSON.parse(l.followups_summary) : {};
    });

    res.json({ data: leads, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

router.post('/leads', (req, res) => {
  try {
    const {
      specialist_id, lead_name, linkedin_profile_url, activity_url,
      company_name, job_title, website, email, phone, follower_count, notes, connection_status, performed_by,
      source_image,
    } = req.body;

    if (!specialist_id) return res.status(400).json({ error: 'A specialist is required' });
    if (!lead_name || !lead_name.trim()) return res.status(400).json({ error: 'lead_name is required' });

    const initialConnectionStatus = CONNECTION_STATUSES.includes(connection_status) ? connection_status : 'Not Connected';

    const result = db.prepare(`
      INSERT INTO linkedin_leads
        (specialist_id, lead_name, linkedin_profile_url, activity_url, company_name, job_title, website, email, phone, follower_count, notes, connection_status, source_image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      specialist_id,
      lead_name.trim(),
      linkedin_profile_url || null,
      activity_url || null,
      company_name || null,
      job_title || null,
      website || null,
      email || null,
      phone || null,
      follower_count || null,
      notes || null,
      initialConnectionStatus,
      source_image || null,
    );

    const leadId = result.lastInsertRowid;
    const initialStatus = getFirstStageName();

    db.prepare('INSERT INTO linkedin_status_history (lead_id, old_status, new_status, performed_by) VALUES (?, ?, ?, ?)')
      .run(leadId, null, initialStatus, performed_by || null);
    db.prepare('UPDATE linkedin_leads SET status = ? WHERE id = ?').run(initialStatus, leadId);

    const created = db.prepare(`
      SELECT l.*, s.name as specialist_name
      FROM linkedin_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      WHERE l.id = ?
    `).get(leadId);
    created.engagement_count = 0;
    created.last_engagement_date = null;
    created.reply_count = 0;
    created.followups_summary = {};
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Normalized-URL comparison (trim, strip trailing slash, case-insensitive) so
// "https://linkedin.com/in/foo/" and "https://LinkedIn.com/in/foo" match.
const NORMALIZE_URL_SQL = "LOWER(RTRIM(TRIM(linkedin_profile_url), '/'))";

// Registered before /leads/:id so "duplicate-check"/"duplicates" aren't swallowed by the :id param.
router.get('/leads/duplicate-check', (req, res) => {
  try {
    const { specialist_id, linkedin_profile_url, exclude_lead_id } = req.query;
    if (!specialist_id || !linkedin_profile_url || !linkedin_profile_url.trim()) {
      return res.json({ duplicate: null });
    }
    const duplicate = db.prepare(`
      SELECT id, lead_name, status
      FROM linkedin_leads
      WHERE specialist_id = ?
        AND deleted_at IS NULL
        AND id != ?
        AND ${NORMALIZE_URL_SQL} = LOWER(RTRIM(TRIM(?), '/'))
      LIMIT 1
    `).get(specialist_id, exclude_lead_id || -1, linkedin_profile_url);
    res.json({ duplicate: duplicate || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check for duplicates' });
  }
});

router.get('/leads/duplicates', (req, res) => {
  try {
    const reqUser = getRequestUser(req);
    const enforcedSpecId = resolveSpecialistForUser(reqUser);
    if (enforcedSpecId === -1) return res.json([]);

    const specCond = enforcedSpecId !== null ? 'AND specialist_id = ?' : '';
    const specParams = enforcedSpecId !== null ? [enforcedSpecId] : [];

    const groups = db.prepare(`
      SELECT specialist_id, ${NORMALIZE_URL_SQL} as norm_url, COUNT(*) as cnt
      FROM linkedin_leads
      WHERE deleted_at IS NULL
        AND linkedin_profile_url IS NOT NULL
        AND TRIM(linkedin_profile_url) != ''
        ${specCond}
      GROUP BY specialist_id, norm_url
      HAVING COUNT(*) > 1
    `).all(...specParams);

    const leadsStmt = db.prepare(`
      SELECT l.id, l.lead_name, l.status, l.linkedin_profile_url, l.created_at, s.name as specialist_name
      FROM linkedin_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      WHERE l.specialist_id = ? AND ${NORMALIZE_URL_SQL} = ? AND l.deleted_at IS NULL
      ORDER BY l.created_at ASC
    `);

    const result = groups.map(g => {
      const leads = leadsStmt.all(g.specialist_id, g.norm_url);
      return {
        specialist_id: g.specialist_id,
        specialist_name: leads[0]?.specialist_name || 'Unassigned',
        linkedin_profile_url: leads[0]?.linkedin_profile_url || '',
        leads: leads.map(({ id, lead_name, status, created_at }) => ({ id, lead_name, status, created_at })),
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch duplicate leads' });
  }
});

router.get('/leads/:id', (req, res) => {
  try {
    const { id } = req.params;
    const lead = db.prepare(`
      SELECT l.*, s.name as specialist_name
      FROM linkedin_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      WHERE l.id = ?
    `).get(id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const reqUser = getRequestUser(req);
    const enforcedSpecId = resolveSpecialistForUser(reqUser);
    if (enforcedSpecId === -1) return res.status(403).json({ error: 'Access denied' });
    if (enforcedSpecId !== null && lead.specialist_id !== enforcedSpecId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const engagements = db.prepare(
      'SELECT * FROM linkedin_engagements WHERE lead_id = ? ORDER BY date DESC, id DESC'
    ).all(id);

    const history = db.prepare(
      'SELECT * FROM linkedin_status_history WHERE lead_id = ? ORDER BY changed_at DESC'
    ).all(id);

    const followups = db.prepare(
      'SELECT * FROM linkedin_followups WHERE lead_id = ?'
    ).all(id);

    const replies = db.prepare(
      'SELECT * FROM linkedin_lead_replies WHERE lead_id = ? ORDER BY created_at DESC'
    ).all(id);

    const comments = db.prepare(
      'SELECT * FROM linkedin_lead_comments WHERE lead_id = ? ORDER BY created_at ASC'
    ).all(id);

    res.json({ ...lead, engagements, history, followups, replies, comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

router.patch('/leads/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM linkedin_leads WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Lead not found' });

    const {
      specialist_id, lead_name, linkedin_profile_url, activity_url,
      company_name, job_title, website, email, phone, follower_count, status, notes, connection_status, performed_by,
      source_image, is_hot_lead, conversation_summary,
    } = req.body;

    const statusChanged = status && status !== existing.status;
    const nextConnectionStatus = connection_status !== undefined
      ? (CONNECTION_STATUSES.includes(connection_status) ? connection_status : existing.connection_status)
      : existing.connection_status;

    db.prepare(`
      UPDATE linkedin_leads SET
        specialist_id = COALESCE(?, specialist_id),
        lead_name = COALESCE(?, lead_name),
        linkedin_profile_url = ?,
        activity_url = ?,
        company_name = ?,
        job_title = ?,
        website = ?,
        email = ?,
        phone = ?,
        follower_count = ?,
        status = COALESCE(?, status),
        notes = ?,
        connection_status = ?,
        source_image = ?,
        is_hot_lead = ?,
        conversation_summary = ?,
        status_updated_at = CASE WHEN ? IS NOT NULL AND ? != status THEN CURRENT_TIMESTAMP ELSE status_updated_at END
      WHERE id = ?
    `).run(
      specialist_id || null,
      lead_name || null,
      linkedin_profile_url !== undefined ? (linkedin_profile_url || null) : existing.linkedin_profile_url,
      activity_url !== undefined ? (activity_url || null) : existing.activity_url,
      company_name !== undefined ? (company_name || null) : existing.company_name,
      job_title !== undefined ? (job_title || null) : existing.job_title,
      website !== undefined ? (website || null) : existing.website,
      email !== undefined ? (email || null) : existing.email,
      phone !== undefined ? (phone || null) : existing.phone,
      follower_count !== undefined ? (follower_count || null) : existing.follower_count,
      status || null,
      notes !== undefined ? (notes || null) : existing.notes,
      nextConnectionStatus,
      source_image !== undefined ? (source_image || null) : existing.source_image,
      is_hot_lead !== undefined ? (is_hot_lead ? 1 : 0) : existing.is_hot_lead,
      conversation_summary !== undefined ? (conversation_summary || null) : existing.conversation_summary,
      status || null, status || null,
      id,
    );

    if (statusChanged) {
      db.prepare('INSERT INTO linkedin_status_history (lead_id, old_status, new_status, performed_by) VALUES (?, ?, ?, ?)')
        .run(id, existing.status, status, performed_by || null);
    }

    const updated = db.prepare(`
      SELECT l.*, s.name as specialist_name
      FROM linkedin_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      WHERE l.id = ?
    `).get(id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

router.delete('/leads/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT id FROM linkedin_leads WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Lead not found' });
    db.prepare("UPDATE linkedin_leads SET deleted_at = datetime('now') WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

router.get('/trash', (req, res) => {
  try {
    const leads = db.prepare(`
      SELECT l.id, l.lead_name, l.company_name, l.status, l.deleted_at,
        s.name as specialist_name
      FROM linkedin_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      WHERE l.deleted_at IS NOT NULL ORDER BY l.deleted_at DESC
    `).all();
    res.json({ leads });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch trash' });
  }
});

router.post('/trash/restore/:id', (req, res) => {
  try {
    db.prepare('UPDATE linkedin_leads SET deleted_at = NULL WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to restore lead' });
  }
});

router.delete('/trash/permanent/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM linkedin_engagements WHERE lead_id = ?').run(id);
    db.prepare('DELETE FROM linkedin_status_history WHERE lead_id = ?').run(id);
    db.prepare('DELETE FROM linkedin_followups WHERE lead_id = ?').run(id);
    db.prepare('DELETE FROM linkedin_lead_replies WHERE lead_id = ?').run(id);
    db.prepare('DELETE FROM linkedin_lead_comments WHERE lead_id = ?').run(id);
    db.prepare('DELETE FROM linkedin_leads WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to permanently delete lead' });
  }
});

// ─── ENGAGEMENTS ──────────────────────────────────────────────────────────────

router.get('/leads/:leadId/engagements', (req, res) => {
  try {
    const { leadId } = req.params;
    const engagements = db.prepare(
      'SELECT * FROM linkedin_engagements WHERE lead_id = ? ORDER BY date DESC, id DESC'
    ).all(leadId);
    res.json(engagements);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch engagements' });
  }
});

router.post('/leads/:leadId/engagements', (req, res) => {
  try {
    const { leadId } = req.params;
    const { date, post_url, liked, commented, comment_text } = req.body;
    const lead = db.prepare('SELECT id FROM linkedin_leads WHERE id = ?').get(leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!liked && !commented) return res.status(400).json({ error: 'Log at least a like or a comment' });

    const result = db.prepare(`
      INSERT INTO linkedin_engagements (lead_id, date, post_url, liked, commented, comment_text)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(leadId, date || new Date().toISOString().slice(0, 10), post_url || null, liked ? 1 : 0, commented ? 1 : 0, comment_text || null);

    const created = db.prepare('SELECT * FROM linkedin_engagements WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save engagement' });
  }
});

router.delete('/leads/:leadId/engagements/:id', (req, res) => {
  try {
    const { leadId, id } = req.params;
    const existing = db.prepare('SELECT id FROM linkedin_engagements WHERE id = ? AND lead_id = ?').get(id, leadId);
    if (!existing) return res.status(404).json({ error: 'Engagement not found' });
    db.prepare('DELETE FROM linkedin_engagements WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete engagement' });
  }
});

// ─── FOLLOW-UPS & REPLIES ─────────────────────────────────────────────────────
// Follow-up 1-4 and Emailed are hardcoded stage keys (not derived from the
// DB-driven linkedin_pipeline_stages table) with one upsertable record per lead.
// Replied is an append-only log (a lead can reply more than once over time).

const FOLLOWUP_STAGE_KEYS = ['Messaged', 'Follow-up 1', 'Follow-up 2', 'Follow-up 3', 'Follow-up 4', 'Emailed'];
const REPLY_CHANNELS = ['LinkedIn', 'Email'];

router.get('/leads/:leadId/followups', (req, res) => {
  try {
    const { leadId } = req.params;
    const followups = db.prepare('SELECT * FROM linkedin_followups WHERE lead_id = ?').all(leadId);
    res.json(followups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch follow-ups' });
  }
});

router.put('/leads/:leadId/followups/:stageKey', (req, res) => {
  try {
    const { leadId, stageKey } = req.params;
    if (!FOLLOWUP_STAGE_KEYS.includes(stageKey)) return res.status(400).json({ error: 'Invalid stage key' });
    const { date, message_body } = req.body;

    db.prepare(`
      INSERT INTO linkedin_followups (lead_id, stage_key, date, message_body)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(lead_id, stage_key) DO UPDATE SET
        date = excluded.date,
        message_body = excluded.message_body,
        updated_at = CURRENT_TIMESTAMP
    `).run(leadId, stageKey, date || null, message_body || null);

    const row = db.prepare('SELECT * FROM linkedin_followups WHERE lead_id = ? AND stage_key = ?').get(leadId, stageKey);
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save follow-up' });
  }
});

router.patch('/leads/:leadId/followups/:stageKey/seen', (req, res) => {
  try {
    const { leadId, stageKey } = req.params;
    const { is_seen } = req.body;
    const existing = db.prepare('SELECT id FROM linkedin_followups WHERE lead_id = ? AND stage_key = ?').get(leadId, stageKey);
    if (!existing) return res.status(404).json({ error: 'Follow-up record not found' });

    db.prepare(`
      UPDATE linkedin_followups SET
        is_seen = ?,
        seen_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END,
        updated_at = CURRENT_TIMESTAMP
      WHERE lead_id = ? AND stage_key = ?
    `).run(is_seen ? 1 : 0, is_seen ? 1 : 0, leadId, stageKey);

    const row = db.prepare('SELECT * FROM linkedin_followups WHERE lead_id = ? AND stage_key = ?').get(leadId, stageKey);
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update seen status' });
  }
});

router.get('/leads/:leadId/replies', (req, res) => {
  try {
    const { leadId } = req.params;
    const replies = db.prepare('SELECT * FROM linkedin_lead_replies WHERE lead_id = ? ORDER BY created_at DESC').all(leadId);
    res.json(replies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch replies' });
  }
});

router.post('/leads/:leadId/replies', (req, res) => {
  try {
    const { leadId } = req.params;
    const lead = db.prepare('SELECT id FROM linkedin_leads WHERE id = ?').get(leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const { date, channel, screenshot, notes } = req.body;
    const finalChannel = REPLY_CHANNELS.includes(channel) ? channel : 'LinkedIn';

    const result = db.prepare(`
      INSERT INTO linkedin_lead_replies (lead_id, date, channel, screenshot, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(leadId, date || null, finalChannel, screenshot || null, notes || null);

    const created = db.prepare('SELECT * FROM linkedin_lead_replies WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save reply' });
  }
});

router.delete('/leads/:leadId/replies/:id', (req, res) => {
  try {
    const { leadId, id } = req.params;
    const existing = db.prepare('SELECT id FROM linkedin_lead_replies WHERE id = ? AND lead_id = ?').get(id, leadId);
    if (!existing) return res.status(404).json({ error: 'Reply not found' });
    db.prepare('DELETE FROM linkedin_lead_replies WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete reply' });
  }
});

// ─── COMMENTS ─────────────────────────────────────────────────────────────────
// A lightweight team discussion thread per lead (status questions, updates,
// "did we hear back yet" etc). Posting a comment marks the thread's prior
// comments as read (you've just engaged with it); the new comment itself
// starts unread so it flags as needing attention until someone replies again
// or explicitly marks the thread read.

router.get('/leads/:leadId/comments', (req, res) => {
  try {
    const { leadId } = req.params;
    const comments = db.prepare('SELECT * FROM linkedin_lead_comments WHERE lead_id = ? ORDER BY created_at ASC').all(leadId);
    res.json(comments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

router.post('/leads/:leadId/comments', (req, res) => {
  try {
    const { leadId } = req.params;
    const { message, screenshot } = req.body;
    if (!(message && message.trim()) && !screenshot) {
      return res.status(400).json({ error: 'Comment message or screenshot required' });
    }
    const lead = db.prepare('SELECT id FROM linkedin_leads WHERE id = ?').get(leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const reqUser = getRequestUser(req);

    db.prepare('UPDATE linkedin_lead_comments SET is_read = 1 WHERE lead_id = ?').run(leadId);

    const result = db.prepare(`
      INSERT INTO linkedin_lead_comments (lead_id, author_name, message, screenshot, is_read)
      VALUES (?, ?, ?, ?, 0)
    `).run(leadId, reqUser?.name || null, message ? message.trim() : null, screenshot || null);

    const created = db.prepare('SELECT * FROM linkedin_lead_comments WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

router.patch('/leads/:leadId/comments/mark-read', (req, res) => {
  try {
    const { leadId } = req.params;
    db.prepare('UPDATE linkedin_lead_comments SET is_read = 1 WHERE lead_id = ?').run(leadId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark comments read' });
  }
});

router.patch('/leads/:leadId/comments/:id/read', (req, res) => {
  try {
    const { leadId, id } = req.params;
    const { is_read } = req.body;
    const existing = db.prepare('SELECT id FROM linkedin_lead_comments WHERE id = ? AND lead_id = ?').get(id, leadId);
    if (!existing) return res.status(404).json({ error: 'Comment not found' });
    db.prepare('UPDATE linkedin_lead_comments SET is_read = ? WHERE id = ?').run(is_read ? 1 : 0, id);
    const row = db.prepare('SELECT * FROM linkedin_lead_comments WHERE id = ?').get(id);
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update comment read status' });
  }
});

router.delete('/leads/:leadId/comments/:id', (req, res) => {
  try {
    const { leadId, id } = req.params;
    const existing = db.prepare('SELECT id FROM linkedin_lead_comments WHERE id = ? AND lead_id = ?').get(id, leadId);
    if (!existing) return res.status(404).json({ error: 'Comment not found' });
    db.prepare('DELETE FROM linkedin_lead_comments WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// ─── DASHBOARD METRIC CARDS (CRUD) ───────────────────────────────────────────

function parseCard(c) {
  if (!c) return c;
  let numerator_statuses = [];
  try { numerator_statuses = JSON.parse(c.numerator_statuses || '[]'); } catch { numerator_statuses = []; }
  let denominator = 'total';
  try {
    const d = JSON.parse(c.denominator);
    denominator = Array.isArray(d) ? d : c.denominator;
  } catch { denominator = c.denominator || 'total'; }
  return { ...c, numerator_statuses, denominator };
}

function serializeDenominator(den) {
  if (den === 'total') return 'total';
  if (Array.isArray(den)) return JSON.stringify(den);
  if (typeof den === 'string' && den.trim().startsWith('[')) return den;
  return den || 'total';
}

router.get('/dashboard/cards', (req, res) => {
  try {
    const cards = db.prepare('SELECT * FROM linkedin_dashboard_cards ORDER BY sort_order ASC, id ASC').all();
    res.json(cards.map(parseCard));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard cards' });
  }
});

router.post('/dashboard/cards', (req, res) => {
  try {
    const { label, card_type = 'count', numerator_statuses = [], denominator = 'total', color = '#0a66c2', sort_order = 0 } = req.body;
    if (!label || !label.trim()) return res.status(400).json({ error: 'Label is required' });
    const result = db.prepare(
      'INSERT INTO linkedin_dashboard_cards (label, card_type, numerator_statuses, denominator, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(label.trim(), card_type, JSON.stringify(numerator_statuses), serializeDenominator(denominator), color, sort_order);
    const created = db.prepare('SELECT * FROM linkedin_dashboard_cards WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(parseCard(created));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create card' });
  }
});

router.patch('/dashboard/cards/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM linkedin_dashboard_cards WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Card not found' });
    const { label, card_type, numerator_statuses, denominator, color, sort_order } = req.body;
    db.prepare(`
      UPDATE linkedin_dashboard_cards SET
        label = COALESCE(?, label),
        card_type = COALESCE(?, card_type),
        numerator_statuses = COALESCE(?, numerator_statuses),
        denominator = COALESCE(?, denominator),
        color = COALESCE(?, color),
        sort_order = COALESCE(?, sort_order)
      WHERE id = ?
    `).run(
      label !== undefined ? label.trim() : null,
      card_type !== undefined ? card_type : null,
      numerator_statuses !== undefined ? JSON.stringify(numerator_statuses) : null,
      denominator !== undefined ? serializeDenominator(denominator) : null,
      color !== undefined ? color : null,
      sort_order !== undefined ? sort_order : null,
      id
    );
    const updated = db.prepare('SELECT * FROM linkedin_dashboard_cards WHERE id = ?').get(id);
    res.json(parseCard(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

router.delete('/dashboard/cards/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM linkedin_dashboard_cards WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

router.get('/dashboard', (req, res) => {
  try {
    let { specialist_id, date_from, date_to } = req.query;

    const reqUser = getRequestUser(req);
    const enforcedSpecId = resolveSpecialistForUser(reqUser);
    if (enforcedSpecId === -1) {
      return res.json({
        total_leads: 0, connected: 0, connection_rate: 0, messaged: 0, replied: 0,
        reply_rate: 0, meetings_booked: 0, closed: 0, stale_engagement_count: 0,
        by_status: {}, by_specialist: [],
      });
    }
    if (enforcedSpecId !== null) specialist_id = String(enforcedSpecId);

    const conditions = [];
    const params = [];
    if (specialist_id) { conditions.push('l.specialist_id = ?'); params.push(specialist_id); }
    if (date_from) { conditions.push("date(l.status_updated_at) >= ?"); params.push(date_from); }
    if (date_to) { conditions.push("date(l.status_updated_at) <= ?"); params.push(date_to); }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const leads = db.prepare(`
      SELECT l.id, l.status, l.connection_status, l.specialist_id, s.name as specialist_name
      FROM linkedin_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      ${whereClause}
    `).all(...params);

    const total_leads = leads.length;

    const FOLLOWUP_STAGES = ['Follow-up 1', 'Follow-up 2', 'Follow-up 3', 'Follow-up 4'];
    const MESSAGED_CURRENT  = [...FOLLOWUP_STAGES, 'Replied', 'Meeting Booked', 'Started Trial', 'Closed / Booked as Client'];
    const REPLIED_CURRENT   = ['Replied', 'Meeting Booked', 'Started Trial', 'Closed / Booked as Client'];
    const BOOKED_CURRENT    = ['Meeting Booked', 'Started Trial', 'Closed / Booked as Client'];

    // "Connected" is driven by the explicit connection_status field, not the pipeline stage —
    // the two are tracked independently now.
    const connected       = leads.filter(l => l.connection_status === 'Connected').length;
    const messaged        = leads.filter(l => MESSAGED_CURRENT.includes(l.status)).length;
    const replied          = leads.filter(l => REPLIED_CURRENT.includes(l.status)).length;
    const meetings_booked = leads.filter(l => BOOKED_CURRENT.includes(l.status)).length;
    const closed           = leads.filter(l => l.status === 'Closed / Booked as Client').length;

    const fmt = (n, d) => d > 0 ? parseFloat((n / d * 100).toFixed(1)) : 0;
    const connection_rate = fmt(connected, total_leads);
    const reply_rate      = fmt(replied, messaged);

    // Stale engagement — connected leads with no like/comment logged within engagement_reminder_days
    const reminderDays = parseInt(getSetting('engagement_reminder_days', '14')) || 14;
    const cutoff = new Date(Date.now() - reminderDays * 86400000).toISOString().slice(0, 10);
    const leadIds = leads.map(l => l.id);
    let lastEngagementByLead = {};
    if (leadIds.length > 0) {
      db.prepare(`
        SELECT lead_id, MAX(date) as last_date FROM linkedin_engagements
        WHERE lead_id IN (${leadIds.map(() => '?').join(',')})
        GROUP BY lead_id
      `).all(...leadIds).forEach(r => { lastEngagementByLead[r.lead_id] = r.last_date; });
    }
    const stale_engagement_count = leads.filter(l => {
      if (l.connection_status !== 'Connected' || TERMINAL_STATUSES.includes(l.status)) return false;
      const lastDate = lastEngagementByLead[l.id];
      return !lastDate || lastDate < cutoff;
    }).length;

    const by_status = {};
    leads.forEach(l => { if (l.status) by_status[l.status] = (by_status[l.status] || 0) + 1; });

    const specialistMap = {};
    leads.forEach(l => {
      const key = l.specialist_id;
      if (!specialistMap[key]) specialistMap[key] = { name: l.specialist_name || 'Unknown', total: 0, connected: 0, closed: 0 };
      specialistMap[key].total++;
      if (l.connection_status === 'Connected') specialistMap[key].connected++;
      if (l.status === 'Closed / Booked as Client') specialistMap[key].closed++;
    });
    const by_specialist = Object.values(specialistMap).sort((a, b) => b.total - a.total);

    res.json({
      total_leads, connected, connection_rate, messaged, replied, reply_rate,
      meetings_booked, closed, stale_engagement_count,
      by_status, by_specialist,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// ─── DUE FOR ENGAGEMENT (dashboard widget) ───────────────────────────────────

router.get('/stale-engagement', (req, res) => {
  try {
    let { specialist_id } = req.query;
    const reqUser = getRequestUser(req);
    const enforcedSpecId = resolveSpecialistForUser(reqUser);
    if (enforcedSpecId === -1) return res.json([]);
    if (enforcedSpecId !== null) specialist_id = String(enforcedSpecId);

    const reminderDays = parseInt(getSetting('engagement_reminder_days', '14')) || 14;
    const cutoff = new Date(Date.now() - reminderDays * 86400000).toISOString().slice(0, 10);

    const conditions = ['l.deleted_at IS NULL', `l.status NOT IN (${TERMINAL_STATUSES.map(() => '?').join(',')})`, "l.connection_status = 'Connected'"];
    const params = [...TERMINAL_STATUSES];
    if (specialist_id) { conditions.push('l.specialist_id = ?'); params.push(specialist_id); }

    const leads = db.prepare(`
      SELECT l.id, l.lead_name, l.company_name, l.status, s.name as specialist_name,
        (SELECT MAX(date) FROM linkedin_engagements WHERE lead_id = l.id) as last_engagement_date
      FROM linkedin_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      WHERE ${conditions.join(' AND ')}
    `).all(...params);

    const stale = leads
      .filter(l => !l.last_engagement_date || l.last_engagement_date < cutoff)
      .sort((a, b) => (a.last_engagement_date || '').localeCompare(b.last_engagement_date || ''));

    res.json(stale);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stale engagement leads' });
  }
});

// ─── DAILY ACTIVITY ───────────────────────────────────────────────────────────
// Returns new leads created + stage moves in a date range, broken down by stage
// and by specialist. Used by the "Daily Activity" section on the dashboard.

router.get('/activity', (req, res) => {
  try {
    let { date_from, date_to, specialist_id } = req.query;

    const reqUser = getRequestUser(req);
    const enforcedSpecId = resolveSpecialistForUser(reqUser);
    if (enforcedSpecId === -1) {
      return res.json({
        new_leads_total: 0, new_leads_by_specialist: [],
        stage_moves_by_stage: [], activity_by_specialist: [],
        engagement_totals: { likes: 0, comments: 0 }, followups_sent_total: 0,
      });
    }
    if (enforcedSpecId !== null) specialist_id = String(enforcedSpecId);

    // Default to yesterday when no range provided
    const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const from = date_from || yest;
    const to   = date_to   || yest;

    // ── 1. New leads created ─────────────────────────────────────────────────
    const nlCond   = ['date(l.created_at) >= ?', 'date(l.created_at) <= ?'];
    const nlParams = [from, to];
    if (specialist_id) { nlCond.push('l.specialist_id = ?'); nlParams.push(specialist_id); }

    const newLeadsBySpec = db.prepare(`
      SELECT COALESCE(s.name, 'Unassigned') as specialist_name, l.specialist_id,
             COUNT(l.id) as count
      FROM linkedin_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      WHERE ${nlCond.join(' AND ')}
      GROUP BY l.specialist_id
      ORDER BY count DESC
    `).all(...nlParams);

    const new_leads_total = newLeadsBySpec.reduce((sum, r) => sum + r.count, 0);

    // ── 2. Stage moves from status_history ───────────────────────────────────
    const mvCond   = ['date(sh.changed_at) >= ?', 'date(sh.changed_at) <= ?'];
    const mvParams = [from, to];
    if (specialist_id) { mvCond.push('l.specialist_id = ?'); mvParams.push(specialist_id); }

    const stage_moves_by_stage = db.prepare(`
      SELECT sh.new_status as stage,
             COUNT(DISTINCT sh.lead_id) as leads_count,
             COUNT(*) as moves_count
      FROM linkedin_status_history sh
      JOIN linkedin_leads l ON l.id = sh.lead_id
      WHERE ${mvCond.join(' AND ')}
      GROUP BY sh.new_status
      ORDER BY moves_count DESC
    `).all(...mvParams);

    // ── 3. Per-specialist: new leads + stage moves ────────────────────────────
    const specMovesRows = db.prepare(`
      SELECT COALESCE(s.name, 'Unassigned') as specialist_name,
             COUNT(DISTINCT sh.lead_id) as leads_worked,
             COUNT(*) as stage_moves
      FROM linkedin_status_history sh
      JOIN linkedin_leads l ON l.id = sh.lead_id
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      WHERE ${mvCond.join(' AND ')}
      GROUP BY l.specialist_id
      ORDER BY stage_moves DESC
    `).all(...mvParams);

    const specMovesMap = {};
    specMovesRows.forEach(r => {
      specMovesMap[r.specialist_name] = { leads_worked: r.leads_worked, stage_moves: r.stage_moves };
    });

    // ── 4. Engagements (likes/comments) from linkedin_engagements ────────────
    const engCond   = ['date(e.date) >= ?', 'date(e.date) <= ?'];
    const engParams = [from, to];
    if (specialist_id) { engCond.push('l.specialist_id = ?'); engParams.push(specialist_id); }

    const engagementsBySpec = db.prepare(`
      SELECT COALESCE(s.name, 'Unassigned') as specialist_name,
             SUM(CASE WHEN e.liked = 1 THEN 1 ELSE 0 END) as likes,
             SUM(CASE WHEN e.commented = 1 THEN 1 ELSE 0 END) as comments
      FROM linkedin_engagements e
      JOIN linkedin_leads l ON l.id = e.lead_id
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      WHERE ${engCond.join(' AND ')}
      GROUP BY l.specialist_id
    `).all(...engParams);

    const engagementsMap = {};
    let likes_total = 0, comments_total = 0;
    engagementsBySpec.forEach(r => {
      engagementsMap[r.specialist_name] = { likes: r.likes || 0, comments: r.comments || 0 };
      likes_total += r.likes || 0;
      comments_total += r.comments || 0;
    });

    // ── 5. Follow-ups / DMs sent from linkedin_followups ─────────────────────
    const fuCond   = ['f.date IS NOT NULL', 'date(f.date) >= ?', 'date(f.date) <= ?'];
    const fuParams = [from, to];
    if (specialist_id) { fuCond.push('l.specialist_id = ?'); fuParams.push(specialist_id); }

    const followupsBySpec = db.prepare(`
      SELECT COALESCE(s.name, 'Unassigned') as specialist_name,
             COUNT(*) as followups_sent
      FROM linkedin_followups f
      JOIN linkedin_leads l ON l.id = f.lead_id
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      WHERE ${fuCond.join(' AND ')}
      GROUP BY l.specialist_id
    `).all(...fuParams);

    const followupsMap = {};
    let followups_sent_total = 0;
    followupsBySpec.forEach(r => {
      followupsMap[r.specialist_name] = r.followups_sent || 0;
      followups_sent_total += r.followups_sent || 0;
    });

    const allNames = new Set([
      ...newLeadsBySpec.map(r => r.specialist_name),
      ...Object.keys(specMovesMap),
      ...Object.keys(engagementsMap),
      ...Object.keys(followupsMap),
    ]);

    const activity_by_specialist = [...allNames].map(name => ({
      name,
      new_leads:    newLeadsBySpec.find(r => r.specialist_name === name)?.count || 0,
      leads_worked: specMovesMap[name]?.leads_worked || 0,
      stage_moves:  specMovesMap[name]?.stage_moves  || 0,
      likes:        engagementsMap[name]?.likes    || 0,
      comments:     engagementsMap[name]?.comments || 0,
      followups_sent: followupsMap[name] || 0,
    })).sort((a, b) => (b.new_leads + b.stage_moves) - (a.new_leads + a.stage_moves));

    res.json({
      date_from: from, date_to: to,
      new_leads_total,
      new_leads_by_specialist: newLeadsBySpec,
      stage_moves_by_stage,
      activity_by_specialist,
      engagement_totals: { likes: likes_total, comments: comments_total },
      followups_sent_total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch activity data' });
  }
});

// ─── ACTIVITY LEADS (drill-through for Daily Activity section) ───────────────
// filter_type: 'new_leads' | 'stage_moves'
// stage:            (stage_moves only) filter to a specific destination stage
// specialist_name:  filter to leads whose primary specialist has this name
// distinct_leads:   '1' = deduplicate by lead_id (one row per lead, latest move)

router.get('/activity/leads', (req, res) => {
  try {
    let { date_from, date_to, filter_type, stage, specialist_name, distinct_leads } = req.query;

    const reqUser = getRequestUser(req);
    const enforcedSpecId = resolveSpecialistForUser(reqUser);
    if (enforcedSpecId === -1) return res.json([]);

    const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const from = date_from || yest;
    const to   = date_to   || yest;

    // ── New leads created ────────────────────────────────────────────────────
    if (filter_type === 'new_leads') {
      const cond   = ['date(l.created_at) >= ?', 'date(l.created_at) <= ?'];
      const params = [from, to];
      if (specialist_name) { cond.push('s.name = ?'); params.push(specialist_name); }
      if (enforcedSpecId !== null) { cond.push('l.specialist_id = ?'); params.push(enforcedSpecId); }

      const leads = db.prepare(`
        SELECT l.id, l.lead_name, l.company_name, l.status, l.created_at,
               COALESCE(s.name, 'Unassigned') as specialist_name
        FROM linkedin_leads l
        LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
        WHERE ${cond.join(' AND ')}
        ORDER BY l.created_at DESC
      `).all(...params);
      return res.json(leads);
    }

    // ── Engagements — likes / comments ───────────────────────────────────────
    if (filter_type === 'engagement_likes' || filter_type === 'engagement_comments') {
      const col = filter_type === 'engagement_likes' ? 'liked' : 'commented';
      const cond   = ['date(e.date) >= ?', 'date(e.date) <= ?', `e.${col} = 1`];
      const params = [from, to];
      if (specialist_name) { cond.push('s.name = ?'); params.push(specialist_name); }
      if (enforcedSpecId !== null) { cond.push('l.specialist_id = ?'); params.push(enforcedSpecId); }

      const rows = db.prepare(`
        SELECT e.id as move_id, l.id, l.lead_name, l.company_name, l.status, e.date as changed_at,
               COALESCE(s.name, 'Unassigned') as specialist_name
        FROM linkedin_engagements e
        JOIN linkedin_leads l ON l.id = e.lead_id
        LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
        WHERE ${cond.join(' AND ')}
        ORDER BY e.date DESC, e.id DESC
      `).all(...params);
      return res.json(rows);
    }

    // ── Follow-ups / DMs sent ─────────────────────────────────────────────────
    if (filter_type === 'followups') {
      const cond   = ['f.date IS NOT NULL', 'date(f.date) >= ?', 'date(f.date) <= ?'];
      const params = [from, to];
      if (specialist_name) { cond.push('s.name = ?'); params.push(specialist_name); }
      if (enforcedSpecId !== null) { cond.push('l.specialist_id = ?'); params.push(enforcedSpecId); }

      const rows = db.prepare(`
        SELECT f.id as move_id, l.id, l.lead_name, l.company_name, l.status,
               f.date as changed_at, f.stage_key as new_status,
               COALESCE(s.name, 'Unassigned') as specialist_name
        FROM linkedin_followups f
        JOIN linkedin_leads l ON l.id = f.lead_id
        LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
        WHERE ${cond.join(' AND ')}
        ORDER BY f.date DESC, f.id DESC
      `).all(...params);
      return res.json(rows);
    }

    // ── Stage moves (default) ────────────────────────────────────────────────
    const cond   = ['date(sh.changed_at) >= ?', 'date(sh.changed_at) <= ?'];
    const params = [from, to];
    if (stage)            { cond.push('sh.new_status = ?');  params.push(stage); }
    if (specialist_name)  { cond.push('s.name = ?');          params.push(specialist_name); }
    if (enforcedSpecId !== null) { cond.push('l.specialist_id = ?'); params.push(enforcedSpecId); }

    if (distinct_leads === '1') {
      // One row per lead — take the latest move per lead in the period
      const rows = db.prepare(`
        SELECT l.id, l.lead_name, l.company_name, l.status,
               sh.old_status, sh.new_status, sh.changed_at,
               COALESCE(s.name, 'Unassigned') as specialist_name
        FROM linkedin_status_history sh
        JOIN linkedin_leads l ON l.id = sh.lead_id
        LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
        WHERE ${cond.join(' AND ')}
        ORDER BY sh.changed_at DESC
      `).all(...params);

      // Dedup — keep first occurrence per lead (already sorted latest first)
      const seen = new Set();
      const deduped = rows.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
      return res.json(deduped);
    }

    // All move events
    const rows = db.prepare(`
      SELECT sh.id as move_id, l.id, l.lead_name, l.company_name, l.status,
             sh.old_status, sh.new_status, sh.changed_at,
             COALESCE(s.name, 'Unassigned') as specialist_name
      FROM linkedin_status_history sh
      JOIN linkedin_leads l ON l.id = sh.lead_id
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      WHERE ${cond.join(' AND ')}
      ORDER BY sh.changed_at DESC
    `).all(...params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch activity leads' });
  }
});

// ─── PIPELINE STAGES ──────────────────────────────────────────────────────────

router.get('/pipeline-stages', (req, res) => {
  try {
    const stages = db.prepare('SELECT * FROM linkedin_pipeline_stages ORDER BY order_index ASC, id ASC').all();
    res.json(stages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch pipeline stages' });
  }
});

router.post('/pipeline-stages', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const maxOrder = db.prepare('SELECT MAX(order_index) as mx FROM linkedin_pipeline_stages').get();
    const nextOrder = (maxOrder.mx || 0) + 1;
    const result = db.prepare('INSERT INTO linkedin_pipeline_stages (name, order_index) VALUES (?, ?)').run(name.trim(), nextOrder);
    const created = db.prepare('SELECT * FROM linkedin_pipeline_stages WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A stage with this name already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create stage' });
  }
});

router.patch('/pipeline-stages/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, order_index, active } = req.body;
    const existing = db.prepare('SELECT * FROM linkedin_pipeline_stages WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Stage not found' });
    if (existing.is_default && active === 0) {
      return res.status(409).json({ error: 'The default stage cannot be deactivated' });
    }
    db.prepare(`
      UPDATE linkedin_pipeline_stages SET
        name = COALESCE(?, name),
        order_index = COALESCE(?, order_index),
        active = COALESCE(?, active)
      WHERE id = ?
    `).run(
      name !== undefined ? (name || null) : null,
      order_index !== undefined ? order_index : null,
      active !== undefined ? active : null,
      id
    );
    const updated = db.prepare('SELECT * FROM linkedin_pipeline_stages WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A stage with this name already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update stage' });
  }
});

router.delete('/pipeline-stages/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stage = db.prepare('SELECT * FROM linkedin_pipeline_stages WHERE id = ?').get(id);
    if (!stage) return res.status(404).json({ error: 'Stage not found' });
    if (stage.is_default) {
      return res.status(409).json({ error: 'The default stage cannot be deleted' });
    }
    const used = db.prepare('SELECT COUNT(*) as cnt FROM linkedin_leads WHERE status = ?').get(stage.name);
    if (used.cnt > 0) {
      return res.status(409).json({ error: `Cannot delete: ${used.cnt} lead(s) are in this stage` });
    }
    db.prepare('DELETE FROM linkedin_pipeline_stages WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete stage' });
  }
});

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

router.get('/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM linkedin_settings').all();
    const result = {};
    rows.forEach(s => { result[s.key] = s.value; });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.patch('/settings', (req, res) => {
  try {
    const updates = req.body;
    const stmt = db.prepare('INSERT OR REPLACE INTO linkedin_settings (key, value) VALUES (?, ?)');
    Object.entries(updates).forEach(([key, value]) => stmt.run(key, String(value)));
    const rows = db.prepare('SELECT * FROM linkedin_settings').all();
    const result = {};
    rows.forEach(s => { result[s.key] = s.value; });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
