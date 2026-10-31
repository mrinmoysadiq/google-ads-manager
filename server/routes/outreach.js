const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { Parser } = require('json2csv');
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

// Every outreach route requires a valid login; the app_users row is kept on req.user
router.use((req, res, next) => {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  req.user = user;
  next();
});

// Configuration routes (stages, fields, cards, settings, trash) are admin-only
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// Non-admins may only touch leads they are assigned to. Sends the error response and
// returns false when access is denied.
function checkLeadAccess(req, res, leadId) {
  const lead = db.prepare('SELECT id FROM outreach_leads WHERE id = ?').get(leadId);
  if (!lead) { res.status(404).json({ error: 'Lead not found' }); return false; }
  const specId = resolveSpecialistForUser(req.user);
  if (specId === null) return true;
  const assigned = specId !== -1 && db.prepare(
    'SELECT 1 FROM outreach_lead_specialists WHERE lead_id = ? AND specialist_id = ?'
  ).get(leadId, specId);
  if (!assigned) { res.status(403).json({ error: 'Access denied' }); return false; }
  return true;
}

function getMaxTouchpoints() {
  try {
    const setting = db.prepare("SELECT value FROM outreach_settings WHERE key = 'max_touchpoints'").get();
    return setting ? Math.max(1, Math.min(20, parseInt(setting.value) || 5)) : 5;
  } catch { return 5; }
}

// ─── Stage types ──────────────────────────────────────────────────────────────
// Stages can be renamed freely; what a stage *means* — for metrics, overdue rules and
// which logger opens when a lead moves there — comes from its type.

const STAGE_TYPES = [
  'new', 'touchpoint', 'in_progress', 'interested', 'not_interested',
  'booked', 'no_show', 'meeting_lost', 'trial', 'won', 'dead',
];

const TYPE_GROUPS = {
  responded:  ['interested', 'not_interested', 'booked', 'no_show', 'meeting_lost', 'trial', 'won'],
  interested: ['interested', 'booked', 'no_show', 'meeting_lost', 'trial', 'won'],
  booked:     ['booked', 'no_show', 'meeting_lost', 'trial', 'won'],
  closed:     ['won', 'dead', 'meeting_lost', 'not_interested'], // finished — never overdue
};

function getStages() {
  return db.prepare('SELECT * FROM outreach_pipeline_stages ORDER BY order_index ASC, id ASC').all();
}

function stageNamesOfTypes(types, stages = getStages()) {
  return stages.filter(s => types.includes(s.stage_type)).map(s => s.name);
}

// SQL fragment excluding leads in finished stages (safe when there are none)
function notClosedClause(column) {
  const closed = stageNamesOfTypes(TYPE_GROUPS.closed);
  if (!closed.length) return { sql: '1 = 1', params: [] };
  return { sql: `${column} NOT IN (${closed.map(() => '?').join(',')})`, params: closed };
}

// New leads start in the first active "new" stage (or the first active stage)
function defaultStageName() {
  const active = getStages().filter(s => s.active);
  return (active.find(s => s.stage_type === 'new') || active[0] || { name: 'New Lead' }).name;
}

// Touchpoint stages are numbered 1..n in pipeline order; inactive ones keep their number
function withTouchpointNumbers(stages) {
  let n = 0;
  return stages.map(s => ({ ...s, touchpoint_number: s.stage_type === 'touchpoint' ? ++n : null }));
}

// ─── Duplicate lead detection (by email / phone / Facebook page) ────────────────

function normalizeEmail(v) { return (v || '').trim().toLowerCase(); }
function normalizePhone(v) {
  const digits = (v || '').replace(/\D/g, '');
  // Strip a leading US/Canada country code so "+1 (555) 123-4567" matches "555.123.4567"
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
}
function normalizeUrlForMatch(v) {
  return (v || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
}

// Returns { field, lead } for the first active lead that shares a normalized
// email, phone, or Facebook page URL with the given values, or null.
function findDuplicateLead({ email, phone, fb_page_url, excludeId }) {
  const nEmail = normalizeEmail(email);
  const nPhone = normalizePhone(phone);
  const nFb = normalizeUrlForMatch(fb_page_url);
  if (!nEmail && !nPhone && !nFb) return null;

  const params = [];
  let query = 'SELECT id, company_name, email, phone, fb_page_url FROM outreach_leads WHERE deleted_at IS NULL';
  if (excludeId) { query += ' AND id != ?'; params.push(excludeId); }
  const candidates = db.prepare(query).all(...params);

  for (const lead of candidates) {
    if (nEmail && normalizeEmail(lead.email) === nEmail) return { field: 'email address', lead };
    if (nPhone && normalizePhone(lead.phone) === nPhone) return { field: 'phone number', lead };
    if (nFb && normalizeUrlForMatch(lead.fb_page_url) === nFb) return { field: 'Facebook page', lead };
  }
  return null;
}

function duplicateErrorMessage(dup) {
  return `Duplicate lead: this ${dup.field} is already used by "${dup.lead.company_name}" (lead #${dup.lead.id}).`;
}

// ─── SPECIALISTS ──────────────────────────────────────────────────────────────

router.get('/specialists', (req, res) => {
  try {
    const specialists = db.prepare(`
      SELECT s.*, m.name as manager_name
      FROM outreach_specialists s
      LEFT JOIN outreach_specialists m ON m.id = s.manager_id
      ORDER BY s.name ASC
    `).all();
    res.json(specialists);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch specialists' });
  }
});

router.post('/specialists', (req, res) => {
  try {
    const { name, manager_id } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    // Non-admins may only create their own specialist record (done automatically on first visit)
    if (req.user.role !== 'admin' && name.trim().toLowerCase() !== (req.user.name || '').trim().toLowerCase()) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const result = db.prepare(
      'INSERT INTO outreach_specialists (name, manager_id) VALUES (?, ?)'
    ).run(name.trim(), manager_id || null);
    const created = db.prepare('SELECT * FROM outreach_specialists WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A specialist with this name already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create specialist' });
  }
});

router.patch('/specialists/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { name, manager_id, active } = req.body;
    const existing = db.prepare('SELECT * FROM outreach_specialists WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Specialist not found' });
    db.prepare(`
      UPDATE outreach_specialists SET
        name = COALESCE(?, name),
        manager_id = ?,
        active = COALESCE(?, active)
      WHERE id = ?
    `).run(name || null, manager_id !== undefined ? (manager_id || null) : existing.manager_id, active !== undefined ? active : null, id);
    const updated = db.prepare('SELECT * FROM outreach_specialists WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update specialist' });
  }
});

router.get('/specialists/:id/is-manager', (req, res) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT COUNT(*) as cnt FROM outreach_specialists WHERE manager_id = ?').get(id);
    res.json({ isManager: row.cnt > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check manager status' });
  }
});

// ─── INDUSTRIES ───────────────────────────────────────────────────────────────

router.get('/industries', (req, res) => {
  try {
    const industries = db.prepare('SELECT * FROM outreach_industries ORDER BY name ASC').all();
    res.json(industries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch industries' });
  }
});

router.post('/industries', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const result = db.prepare('INSERT INTO outreach_industries (name) VALUES (?)').run(name.trim());
    const created = db.prepare('SELECT * FROM outreach_industries WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Industry already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create industry' });
  }
});

router.patch('/industries/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { name, active } = req.body;
    db.prepare('UPDATE outreach_industries SET name = COALESCE(?, name), active = COALESCE(?, active) WHERE id = ?')
      .run(name || null, active !== undefined ? active : null, id);
    const updated = db.prepare('SELECT * FROM outreach_industries WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update industry' });
  }
});

router.delete('/industries/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const used = db.prepare('SELECT COUNT(*) as cnt FROM outreach_leads WHERE industry_id = ?').get(id);
    if (used.cnt > 0) {
      return res.status(409).json({ error: `Cannot delete: ${used.cnt} lead(s) reference this industry` });
    }
    db.prepare('DELETE FROM outreach_industries WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete industry' });
  }
});

// ─── LEAD SOURCES ─────────────────────────────────────────────────────────────
// Where a lead came from (manual, cold email, Facebook ads…). Each has a colour that
// tints the lead's pipeline card.

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function sourceExists(id) {
  return !!db.prepare('SELECT 1 FROM outreach_lead_sources WHERE id = ?').get(id);
}

router.get('/sources', (req, res) => {
  try {
    const sources = db.prepare(`
      SELECT src.*,
        (SELECT COUNT(*) FROM outreach_leads l WHERE l.source_id = src.id AND l.deleted_at IS NULL) as lead_count
      FROM outreach_lead_sources src
      ORDER BY src.name COLLATE NOCASE ASC
    `).all();
    res.json(sources);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch lead sources' });
  }
});

router.post('/sources', requireAdmin, (req, res) => {
  try {
    const { name, color = '#8a8680' } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!HEX_COLOR.test(color)) return res.status(400).json({ error: 'Colour must be a hex value like #3b82f6' });
    const result = db.prepare('INSERT INTO outreach_lead_sources (name, color) VALUES (?, ?)').run(name.trim(), color);
    res.status(201).json({ ...db.prepare('SELECT * FROM outreach_lead_sources WHERE id = ?').get(result.lastInsertRowid), lead_count: 0 });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return res.status(409).json({ error: 'A source with this name already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create lead source' });
  }
});

router.patch('/sources/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, active } = req.body;
    if (!sourceExists(id)) return res.status(404).json({ error: 'Source not found' });
    if (color !== undefined && !HEX_COLOR.test(color)) return res.status(400).json({ error: 'Colour must be a hex value like #3b82f6' });
    db.prepare(`
      UPDATE outreach_lead_sources SET
        name = COALESCE(?, name), color = COALESCE(?, color), active = COALESCE(?, active)
      WHERE id = ?
    `).run(name && name.trim() ? name.trim() : null, color || null, active !== undefined ? (active ? 1 : 0) : null, id);
    res.json(db.prepare(`
      SELECT src.*, (SELECT COUNT(*) FROM outreach_leads l WHERE l.source_id = src.id AND l.deleted_at IS NULL) as lead_count
      FROM outreach_lead_sources src WHERE id = ?
    `).get(id));
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return res.status(409).json({ error: 'A source with this name already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update lead source' });
  }
});

// Only unused sources can be deleted (trashed leads count) — otherwise turn them off
router.delete('/sources/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const used = db.prepare('SELECT COUNT(*) as cnt FROM outreach_leads WHERE source_id = ?').get(id).cnt;
    if (used > 0) {
      return res.status(409).json({ error: `${used} lead(s) use this source — turn it off instead, or move those leads first` });
    }
    db.prepare('DELETE FROM outreach_lead_sources WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete lead source' });
  }
});

// ─── CHANNELS ─────────────────────────────────────────────────────────────────
// Where a touchpoint or reply happened (LinkedIn, Email, Phone call…). Touchpoints and
// responses store the channel by name, so a rename rewrites those rows too. Anyone can
// add a channel from the lead form; renaming and deleting are admin-only.

const CHANNEL_SELECT = `
  SELECT ch.*,
    (SELECT COUNT(*) FROM outreach_touchpoints t WHERE t.channel = ch.name) +
    (SELECT COUNT(*) FROM outreach_lead_responses r WHERE r.channel = ch.name) as usage_count
  FROM outreach_channels ch
`;

router.get('/channels', (req, res) => {
  try {
    res.json(db.prepare(`${CHANNEL_SELECT} ORDER BY ch.sort_order ASC, ch.id ASC`).all());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

router.post('/channels', (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const color = req.body.color || '#6b7280';
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!HEX_COLOR.test(color)) return res.status(400).json({ error: 'Colour must be a hex value like #3b82f6' });
    const { next } = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM outreach_channels').get();
    const result = db.prepare('INSERT INTO outreach_channels (name, color, sort_order) VALUES (?, ?, ?)').run(name, color, next);
    res.status(201).json(db.prepare(`${CHANNEL_SELECT} WHERE ch.id = ?`).get(result.lastInsertRowid));
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return res.status(409).json({ error: 'A channel with this name already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

router.patch('/channels/:id', requireAdmin, (req, res) => {
  try {
    const channel = db.prepare('SELECT * FROM outreach_channels WHERE id = ?').get(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const name = req.body.name !== undefined ? String(req.body.name).trim() : undefined;
    const { color, active } = req.body;
    if (name === '') return res.status(400).json({ error: 'Name is required' });
    if (color !== undefined && !HEX_COLOR.test(color)) return res.status(400).json({ error: 'Colour must be a hex value like #3b82f6' });

    db.transaction(() => {
      db.prepare(`
        UPDATE outreach_channels SET
          name = COALESCE(?, name), color = COALESCE(?, color), active = COALESCE(?, active)
        WHERE id = ?
      `).run(name || null, color || null, active !== undefined ? (active ? 1 : 0) : null, channel.id);
      if (name && name !== channel.name) {
        db.prepare('UPDATE outreach_touchpoints SET channel = ? WHERE channel = ?').run(name, channel.name);
        db.prepare('UPDATE outreach_lead_responses SET channel = ? WHERE channel = ?').run(name, channel.name);
      }
    })();
    res.json(db.prepare(`${CHANNEL_SELECT} WHERE ch.id = ?`).get(channel.id));
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return res.status(409).json({ error: 'A channel with this name already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

// Touchpoints and replies already logged with this channel keep its name as text
router.delete('/channels/:id', requireAdmin, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM outreach_channels WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Channel not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

// ─── LEADS ────────────────────────────────────────────────────────────────────

router.get('/leads', (req, res) => {
  try {
    let {
      specialist_id, status, industry_id, source_id, search,
      followup_overdue, date_from, date_to,
      page = 1, limit = 25,
      sort_by = 'created_at', sort_dir = 'DESC',
    } = req.query;

    // ── Server-side access enforcement ──────────────────────────────────────
    const reqUser = req.user;
    const enforcedSpecId = resolveSpecialistForUser(reqUser);
    if (enforcedSpecId === -1) {
      // Non-admin with no specialist record — return empty
      return res.json({ data: [], total: 0, page: 1, totalPages: 0 });
    }
    if (enforcedSpecId !== null) {
      // Non-admin: force their own specialist_id, ignore client param
      specialist_id = String(enforcedSpecId);
    }
    // ────────────────────────────────────────────────────────────────────────

    const conditions = ['l.deleted_at IS NULL'];
    const params = [];

    if (specialist_id) {
      conditions.push('EXISTS (SELECT 1 FROM outreach_lead_specialists ols WHERE ols.lead_id = l.id AND ols.specialist_id = ?)');
      params.push(specialist_id);
    }
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length > 0) {
        conditions.push(`l.status IN (${statuses.map(() => '?').join(',')})`);
        params.push(...statuses);
      }
    }
    if (industry_id) { conditions.push('l.industry_id = ?'); params.push(industry_id); }
    if (source_id === 'none') conditions.push('l.source_id IS NULL');
    else if (source_id) { conditions.push('l.source_id = ?'); params.push(source_id); }
    if (search) {
      conditions.push('(l.company_name LIKE ? OR l.contact_name LIKE ? OR l.email LIKE ? OR l.phone LIKE ? OR l.location LIKE ? OR l.job_title LIKE ? OR l.website LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s);
    }
    if (followup_overdue === 'true') {
      const today = new Date().toISOString().slice(0, 10);
      const notClosed = notClosedClause('l.status');
      conditions.push(`(l.next_followup_date < ? AND ${notClosed.sql})`);
      params.push(today, ...notClosed.params);
    }
    if (date_from) { conditions.push("date(l.created_at) >= ?"); params.push(date_from); }
    if (date_to) { conditions.push("date(l.created_at) <= ?"); params.push(date_to); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Maps every sortable table column to its SQL expression (some are SELECT aliases)
    const sortColumns = {
      company_name: 'l.company_name', contact_name: 'l.contact_name', status: 'l.status',
      next_followup_date: 'l.next_followup_date', created_at: 'l.created_at',
      status_updated_at: 'l.status_updated_at', industry_name: 'industry_name',
      specialist_name: 'specialist_name', source_name: 'source_name', touchpoint_count: 'touchpoint_count',
      last_touchpoint_date: 'last_touchpoint_date',
    };
    const safeSortBy = sortColumns[sort_by] || 'l.created_at';
    const safeSortDir = sort_dir === 'ASC' ? 'ASC' : 'DESC';

    const total = db.prepare(`SELECT COUNT(*) as cnt FROM outreach_leads l ${whereClause}`).get(...params).cnt;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const leads = db.prepare(`
      SELECT
        l.id, l.specialist_id, l.company_name, l.contact_name, l.job_title,
        l.website, l.industry_id, l.source_id, l.location, l.status, l.next_followup_date,
        l.source_url, l.email, l.phone, l.fb_page_url, l.ig_url, l.linkedin_url,
        l.created_at, l.status_updated_at,
        s.name as specialist_name,
        i.name as industry_name,
        src.name as source_name, src.color as source_color,
        (SELECT GROUP_CONCAT(s2.name, ', ') FROM outreach_lead_specialists ols2
         JOIN outreach_specialists s2 ON s2.id = ols2.specialist_id
         WHERE ols2.lead_id = l.id ORDER BY s2.name ASC) as specialist_names,
        (SELECT GROUP_CONCAT(ols2.specialist_id, ',') FROM outreach_lead_specialists ols2
         WHERE ols2.lead_id = l.id) as specialist_ids_csv,
        (SELECT COUNT(*) FROM outreach_touchpoints WHERE lead_id = l.id AND date IS NOT NULL) as touchpoint_count,
        (SELECT MAX(date) FROM outreach_touchpoints WHERE lead_id = l.id AND date IS NOT NULL) as last_touchpoint_date,
        (SELECT channel FROM outreach_touchpoints WHERE lead_id = l.id AND date IS NOT NULL
         ORDER BY date DESC, touchpoint_number DESC LIMIT 1) as last_touchpoint_channel,
        (SELECT MAX(touchpoint_number) FROM outreach_touchpoints WHERE lead_id = l.id AND date IS NOT NULL) as last_touchpoint_number,
        (SELECT MAX(COALESCE(date, substr(created_at, 1, 10))) FROM outreach_lead_responses WHERE lead_id = l.id) as last_response_date
      FROM outreach_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      LEFT JOIN outreach_industries i ON i.id = l.industry_id
      LEFT JOIN outreach_lead_sources src ON src.id = l.source_id
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortDir}, l.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    // Parse specialist_ids_csv into array
    leads.forEach(l => {
      l.specialist_ids = l.specialist_ids_csv ? l.specialist_ids_csv.split(',').map(Number) : (l.specialist_id ? [l.specialist_id] : []);
      delete l.specialist_ids_csv;
    });

    // Attach channels used per lead
    if (leads.length > 0) {
      const leadIds = leads.map(l => l.id);
      const channels = db.prepare(`
        SELECT lead_id, channel FROM outreach_touchpoints
        WHERE lead_id IN (${leadIds.map(() => '?').join(',')})
        AND channel IS NOT NULL AND channel != ''
        GROUP BY lead_id, channel
      `).all(...leadIds);
      const byLead = {};
      channels.forEach(c => {
        if (!byLead[c.lead_id]) byLead[c.lead_id] = [];
        if (!byLead[c.lead_id].includes(c.channel)) byLead[c.lead_id].push(c.channel);
      });
      leads.forEach(l => { l.channels_used = byLead[l.id] || []; });
    } else {
      leads.forEach(l => { l.channels_used = []; });
    }

    res.json({ data: leads, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

router.post('/leads', (req, res) => {
  try {
    const {
      specialist_ids, specialist_id: single_specialist_id,
      company_name, contact_name, job_title,
      website, industry_id, source_id, location,
      next_followup_date, next_followup,
      source_url, source_image, email, phone, fb_page_url, ig_url, linkedin_url,
      custom_fields,
      performed_by,
    } = req.body;
    const followupDate = next_followup_date || next_followup || null;

    // Normalize specialist_ids — accept array or single id
    const specIds = Array.isArray(specialist_ids) && specialist_ids.length > 0
      ? [...specialist_ids]
      : (single_specialist_id ? [single_specialist_id] : []);

    // Non-admins always stay assigned to leads they create, otherwise they'd lose access to them
    const ownSpecId = resolveSpecialistForUser(req.user);
    if (ownSpecId === -1) return res.status(403).json({ error: 'No specialist profile is linked to your account' });
    if (ownSpecId !== null && !specIds.map(Number).includes(ownSpecId)) specIds.unshift(ownSpecId);

    if (!specIds.length) return res.status(400).json({ error: 'At least one specialist is required' });
    if (!company_name || !company_name.trim()) return res.status(400).json({ error: 'company_name is required' });
    const missing = missingRequiredField(req.body, false);
    if (missing) return res.status(400).json({ error: missing });

    if (source_id && !sourceExists(source_id)) return res.status(400).json({ error: 'Unknown lead source' });

    const dup = findDuplicateLead({ email, phone, fb_page_url });
    if (dup) return res.status(409).json({ error: duplicateErrorMessage(dup) });

    const initialStage = defaultStageName();
    const leadId = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO outreach_leads
          (specialist_id, company_name, contact_name, job_title, website, industry_id, source_id, location, next_followup_date, source_url, source_image, email, phone, fb_page_url, ig_url, linkedin_url, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        specIds[0],
        company_name.trim(),
        contact_name || null,
        job_title || null,
        website || null,
        industry_id || null,
        source_id || null,
        location || null,
        followupDate,
        source_url || null,
        source_image || null,
        email || null,
        phone || null,
        fb_page_url || null,
        ig_url || null,
        linkedin_url || null,
        initialStage,
      );

      const id = result.lastInsertRowid;

      if (custom_fields && typeof custom_fields === 'object') {
        const upsertVal = db.prepare('INSERT INTO outreach_lead_custom_values (lead_id, field_key, value) VALUES (?, ?, ?) ON CONFLICT(lead_id, field_key) DO UPDATE SET value = excluded.value');
        Object.entries(custom_fields).forEach(([key, val]) => upsertVal.run(id, key, serializeCustomValue(val)));
      }

      // Insert all specialists into junction table
      const insertSpec = db.prepare('INSERT OR IGNORE INTO outreach_lead_specialists (lead_id, specialist_id) VALUES (?, ?)');
      for (const sid of specIds) { insertSpec.run(id, sid); }

      // Seed status history entry
      db.prepare('INSERT INTO outreach_status_history (lead_id, old_status, new_status, performed_by) VALUES (?, ?, ?, ?)')
        .run(id, null, initialStage, performed_by || null);
      return id;
    })();

    const created = db.prepare(`
      SELECT l.*, s.name as specialist_name, i.name as industry_name,
        src.name as source_name, src.color as source_color
      FROM outreach_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      LEFT JOIN outreach_industries i ON i.id = l.industry_id
      LEFT JOIN outreach_lead_sources src ON src.id = l.source_id
      WHERE l.id = ?
    `).get(leadId);
    const specialists = db.prepare(`
      SELECT s.id, s.name FROM outreach_lead_specialists ols
      JOIN outreach_specialists s ON s.id = ols.specialist_id WHERE ols.lead_id = ?
    `).all(leadId);
    created.channels_used = [];
    created.touchpoint_count = 0;
    created.specialists = specialists;
    created.specialist_ids = specialists.map(s => s.id);
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

router.get('/leads/:id', (req, res) => {
  try {
    const { id } = req.params;
    const lead = db.prepare(`
      SELECT l.*, s.name as specialist_name, i.name as industry_name,
        src.name as source_name, src.color as source_color
      FROM outreach_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      LEFT JOIN outreach_industries i ON i.id = l.industry_id
      LEFT JOIN outreach_lead_sources src ON src.id = l.source_id
      WHERE l.id = ?
    `).get(id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // ── Server-side access enforcement ──────────────────────────────────────
    const reqUser = req.user;
    const enforcedSpecId = resolveSpecialistForUser(reqUser);
    if (enforcedSpecId === -1) return res.status(403).json({ error: 'Access denied' });
    if (enforcedSpecId !== null) {
      const hasAccess = db.prepare(
        'SELECT 1 FROM outreach_lead_specialists WHERE lead_id = ? AND specialist_id = ?'
      ).get(id, enforcedSpecId);
      if (!hasAccess) return res.status(403).json({ error: 'Access denied' });
    }
    // ────────────────────────────────────────────────────────────────────────

    const touchpoints = db.prepare(
      'SELECT * FROM outreach_touchpoints WHERE lead_id = ? ORDER BY touchpoint_number ASC'
    ).all(id);

    const history = db.prepare(
      'SELECT * FROM outreach_status_history WHERE lead_id = ? ORDER BY changed_at DESC'
    ).all(id);

    const responses = db.prepare(
      'SELECT * FROM outreach_lead_responses WHERE lead_id = ? ORDER BY created_at DESC'
    ).all(id);

    const specialists = db.prepare(`
      SELECT s.id, s.name FROM outreach_lead_specialists ols
      JOIN outreach_specialists s ON s.id = ols.specialist_id
      WHERE ols.lead_id = ? ORDER BY s.name ASC
    `).all(id);

    const customValues = db.prepare('SELECT field_key, value FROM outreach_lead_custom_values WHERE lead_id = ?').all(id);
    const custom_fields = {};
    customValues.forEach(v => { custom_fields[v.field_key] = v.value; });

    res.json({ ...lead, touchpoints, history, responses, specialists, custom_fields });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

router.patch('/leads/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (!checkLeadAccess(req, res, id)) return;
    const existing = db.prepare('SELECT * FROM outreach_leads WHERE id = ?').get(id);

    const {
      specialist_id, specialist_ids, company_name, contact_name, job_title,
      website, industry_id, source_id, location, status,
      next_followup_date, next_followup,
      source_url, source_image, email, phone, fb_page_url, ig_url, linkedin_url,
      custom_fields,
      performed_by,
    } = req.body;

    // Accept both next_followup_date and next_followup field names
    const hasFollowupField = next_followup_date !== undefined || next_followup !== undefined;
    const followupValue = hasFollowupField ? (next_followup_date || next_followup || null) : undefined;

    const statusChanged = status && status !== existing.status;
    if (Array.isArray(specialist_ids) && specialist_ids.length === 0) {
      return res.status(400).json({ error: 'At least one specialist is required' });
    }
    if (company_name !== undefined && !String(company_name || '').trim()) {
      return res.status(400).json({ error: '"Company Name" is required' });
    }
    const missing = missingRequiredField(req.body, true);
    if (missing) return res.status(400).json({ error: missing });
    if (source_id && !sourceExists(source_id)) return res.status(400).json({ error: 'Unknown lead source' });

    const dup = findDuplicateLead({
      email: email !== undefined ? email : existing.email,
      phone: phone !== undefined ? phone : existing.phone,
      fb_page_url: fb_page_url !== undefined ? fb_page_url : existing.fb_page_url,
      excludeId: id,
    });
    if (dup) return res.status(409).json({ error: duplicateErrorMessage(dup) });

    db.transaction(() => {
      db.prepare(`
        UPDATE outreach_leads SET
          specialist_id = COALESCE(?, specialist_id),
          company_name = COALESCE(?, company_name),
          contact_name = ?,
          job_title = ?,
          website = ?,
          industry_id = ?,
          source_id = ?,
          location = ?,
          status = COALESCE(?, status),
          next_followup_date = ?,
          source_url = ?,
          source_image = ?,
          email = ?,
          phone = ?,
          fb_page_url = ?,
          ig_url = ?,
          linkedin_url = ?,
          status_updated_at = CASE WHEN ? IS NOT NULL AND ? != status THEN CURRENT_TIMESTAMP ELSE status_updated_at END
        WHERE id = ?
      `).run(
        specialist_id || null,
        company_name || null,
        contact_name !== undefined ? (contact_name || null) : existing.contact_name,
        job_title !== undefined ? (job_title || null) : existing.job_title,
        website !== undefined ? (website || null) : existing.website,
        industry_id !== undefined ? (industry_id || null) : existing.industry_id,
        source_id !== undefined ? (source_id || null) : existing.source_id,
        location !== undefined ? (location || null) : existing.location,
        status || null,
        followupValue !== undefined ? followupValue : existing.next_followup_date,
        source_url !== undefined ? (source_url || null) : existing.source_url,
        source_image !== undefined ? (source_image || null) : existing.source_image,
        email !== undefined ? (email || null) : existing.email,
        phone !== undefined ? (phone || null) : existing.phone,
        fb_page_url !== undefined ? (fb_page_url || null) : existing.fb_page_url,
        ig_url !== undefined ? (ig_url || null) : existing.ig_url,
        linkedin_url !== undefined ? (linkedin_url || null) : existing.linkedin_url,
        status || null, status || null,
        id,
      );

      if (statusChanged) {
        db.prepare('INSERT INTO outreach_status_history (lead_id, old_status, new_status, performed_by) VALUES (?, ?, ?, ?)')
          .run(id, existing.status, status, performed_by || null);
      }

      if (custom_fields && typeof custom_fields === 'object') {
        const upsertVal = db.prepare('INSERT INTO outreach_lead_custom_values (lead_id, field_key, value) VALUES (?, ?, ?) ON CONFLICT(lead_id, field_key) DO UPDATE SET value = excluded.value');
        Object.entries(custom_fields).forEach(([key, val]) => upsertVal.run(id, key, serializeCustomValue(val)));
      }

      // Update specialist assignments if specialist_ids array provided
      if (Array.isArray(specialist_ids)) {
        db.prepare('DELETE FROM outreach_lead_specialists WHERE lead_id = ?').run(id);
        const insertSpec = db.prepare('INSERT OR IGNORE INTO outreach_lead_specialists (lead_id, specialist_id) VALUES (?, ?)');
        for (const sid of specialist_ids) { insertSpec.run(id, sid); }
        // Update primary specialist_id
        if (specialist_ids.length > 0) {
          db.prepare('UPDATE outreach_leads SET specialist_id = ? WHERE id = ?').run(specialist_ids[0], id);
        }
      }
    })();

    const updated = db.prepare(`
      SELECT l.*, s.name as specialist_name, i.name as industry_name,
        src.name as source_name, src.color as source_color
      FROM outreach_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      LEFT JOIN outreach_industries i ON i.id = l.industry_id
      LEFT JOIN outreach_lead_sources src ON src.id = l.source_id
      WHERE l.id = ?
    `).get(id);
    const updatedSpecialists = db.prepare(`
      SELECT s.id, s.name FROM outreach_lead_specialists ols
      JOIN outreach_specialists s ON s.id = ols.specialist_id WHERE ols.lead_id = ?
      ORDER BY s.name ASC
    `).all(id);
    updated.specialists = updatedSpecialists;
    updated.specialist_ids = updatedSpecialists.map(s => s.id);
    updated.specialist_names = updatedSpecialists.map(s => s.name).join(', ');

    if (custom_fields && typeof custom_fields === 'object') {
      const customValues = db.prepare('SELECT field_key, value FROM outreach_lead_custom_values WHERE lead_id = ?').all(id);
      updated.custom_fields = {};
      customValues.forEach(v => { updated.custom_fields[v.field_key] = v.value; });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

router.delete('/leads/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (!checkLeadAccess(req, res, id)) return;
    db.prepare("UPDATE outreach_leads SET deleted_at = datetime('now') WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

router.get('/trash', requireAdmin, (req, res) => {
  try {
    const leads = db.prepare(`
      SELECT l.id, l.company_name, l.contact_name, l.status, l.deleted_at,
        s.name as specialist_name
      FROM outreach_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      WHERE l.deleted_at IS NOT NULL ORDER BY l.deleted_at DESC
    `).all();
    res.json({ leads });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch trash' });
  }
});

router.post('/trash/restore/:id', requireAdmin, (req, res) => {
  try {
    db.prepare('UPDATE outreach_leads SET deleted_at = NULL WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to restore lead' });
  }
});

router.delete('/trash/permanent/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    db.transaction(() => {
      db.prepare('DELETE FROM outreach_lead_specialists WHERE lead_id = ?').run(id);
      db.prepare('DELETE FROM outreach_touchpoints WHERE lead_id = ?').run(id);
      db.prepare('DELETE FROM outreach_status_history WHERE lead_id = ?').run(id);
      db.prepare('DELETE FROM outreach_lead_responses WHERE lead_id = ?').run(id);
      db.prepare('DELETE FROM outreach_lead_custom_values WHERE lead_id = ?').run(id);
      db.prepare('DELETE FROM outreach_leads WHERE id = ?').run(id);
    })();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to permanently delete lead' });
  }
});

// ─── TOUCHPOINTS ──────────────────────────────────────────────────────────────

router.get('/leads/:leadId/touchpoints', (req, res) => {
  try {
    const { leadId } = req.params;
    if (!checkLeadAccess(req, res, leadId)) return;
    const touchpoints = db.prepare(
      'SELECT * FROM outreach_touchpoints WHERE lead_id = ? ORDER BY touchpoint_number ASC'
    ).all(leadId);
    res.json(touchpoints);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch touchpoints' });
  }
});

router.put('/leads/:leadId/touchpoints/:number', (req, res) => {
  try {
    const { leadId, number } = req.params;
    if (!checkLeadAccess(req, res, leadId)) return;
    const { date, channel, message_body, loom_url, notes } = req.body;
    const num = parseInt(number);
    const maxTp = Math.max(getMaxTouchpoints(), stageNamesOfTypes(['touchpoint']).length);
    if (num < 1 || num > maxTp) return res.status(400).json({ error: `Touchpoint number must be 1–${maxTp}` });

    db.prepare(`
      INSERT INTO outreach_touchpoints (lead_id, touchpoint_number, date, channel, message_body, loom_url, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(lead_id, touchpoint_number) DO UPDATE SET
        date = excluded.date,
        channel = excluded.channel,
        message_body = excluded.message_body,
        loom_url = excluded.loom_url,
        notes = excluded.notes
    `).run(leadId, num, date || null, channel || null, message_body || null, loom_url || null, notes || null);

    const tp = db.prepare(
      'SELECT * FROM outreach_touchpoints WHERE lead_id = ? AND touchpoint_number = ?'
    ).get(leadId, num);
    res.json(tp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save touchpoint' });
  }
});

// ─── LEAD FIELDS ──────────────────────────────────────────────────────────────
// One ordered list (outreach_custom_fields) drives the lead form. Built-in fields
// (is_builtin = 1) store values in outreach_leads columns and have a fixed type;
// custom fields store values in outreach_lead_custom_values. `active = 0` means a
// built-in is hidden or a custom field is archived (values are kept).

const CUSTOM_FIELD_TYPES = [
  'text', 'short_text', 'number', 'email', 'phone', 'link',
  'date', 'dropdown', 'multiselect', 'checkbox', 'image',
];
// Values of these types are plain strings, so a field can switch between them safely
const TEXT_LIKE_TYPES = ['text', 'short_text', 'email', 'phone', 'link'];
// Built-ins that every lead needs — always shown and required
const LOCKED_BUILTINS = ['company_name', 'specialist_ids'];

function parseCustomField(f) {
  if (!f) return f;
  let options = [];
  try { options = JSON.parse(f.options || '[]'); } catch { options = []; }
  return { ...f, options, is_builtin: !!f.is_builtin, required: !!f.required, locked: LOCKED_BUILTINS.includes(f.field_key) };
}

function getField(id) {
  return parseCustomField(db.prepare('SELECT * FROM outreach_custom_fields WHERE id = ?').get(id));
}

// Custom values are stored as text: multi-select as a JSON array, checkbox as '1'/'0'
function serializeCustomValue(v) {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  return String(v);
}

function isEmptyValue(v) {
  return v === undefined || v === null || v === '[]' || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
}

// Message for the first required (and visible) field that `body` leaves empty, or null.
// With `partial` (PATCH) only fields actually present in the body are checked.
function missingRequiredField(body, partial) {
  const custom = body.custom_fields && typeof body.custom_fields === 'object' ? body.custom_fields : {};
  const required = db.prepare('SELECT * FROM outreach_custom_fields WHERE active = 1 AND required = 1').all();
  for (const f of required) {
    if (LOCKED_BUILTINS.includes(f.field_key)) continue; // validated by the lead routes themselves
    let key = f.field_key;
    if (f.is_builtin && key === 'next_followup_date' && body.next_followup !== undefined) key = 'next_followup';
    const source = f.is_builtin ? body : custom;
    if (partial && !(key in source)) continue;
    if (isEmptyValue(source[key])) return `"${f.label}" is required`;
  }
  return null;
}

// Custom fields only (kept for the Claude connector and older clients)
router.get('/custom-fields', (req, res) => {
  try {
    const { all } = req.query;
    const query = all === '1'
      ? 'SELECT * FROM outreach_custom_fields WHERE is_builtin = 0 ORDER BY sort_order ASC, id ASC'
      : 'SELECT * FROM outreach_custom_fields WHERE is_builtin = 0 AND active = 1 ORDER BY sort_order ASC, id ASC';
    res.json(db.prepare(query).all().map(parseCustomField));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch custom fields' });
  }
});

// Full form layout: built-in + custom fields in order. Admins can pass all=1 to also get
// hidden/archived fields and how many leads have a value in each custom field.
router.get('/fields', (req, res) => {
  try {
    const includeAll = req.query.all === '1' && req.user.role === 'admin';
    const fields = db.prepare(`
      SELECT * FROM outreach_custom_fields ${includeAll ? '' : 'WHERE active = 1'}
      ORDER BY sort_order ASC, id ASC
    `).all().map(parseCustomField);
    if (includeAll) {
      const counts = {};
      db.prepare(`
        SELECT v.field_key, COUNT(*) as cnt FROM outreach_lead_custom_values v
        JOIN outreach_leads l ON l.id = v.lead_id AND l.deleted_at IS NULL
        WHERE v.value IS NOT NULL AND v.value != '' AND v.value != '[]'
        GROUP BY v.field_key
      `).all().forEach(r => { counts[r.field_key] = r.cnt; });
      fields.forEach(f => { f.value_count = f.is_builtin ? null : (counts[f.field_key] || 0); });
    }
    res.json(fields);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch fields' });
  }
});

// Sets the form order from a full list of field ids
router.patch('/fields/order', requireAdmin, (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids must be a non-empty array' });
    const setOrder = db.prepare('UPDATE outreach_custom_fields SET sort_order = ? WHERE id = ?');
    db.transaction(() => { ids.forEach((id, i) => setOrder.run(i + 1, id)); })();
    res.json(db.prepare('SELECT * FROM outreach_custom_fields ORDER BY sort_order ASC, id ASC').all().map(parseCustomField));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reorder fields' });
  }
});

router.post('/custom-fields', requireAdmin, (req, res) => {
  try {
    const { label, field_type = 'text', options = [], width = 'half', help_text = null, required = false } = req.body;
    if (!label || !label.trim()) return res.status(400).json({ error: 'Label is required' });
    if (!CUSTOM_FIELD_TYPES.includes(field_type)) return res.status(400).json({ error: 'Unknown field type' });
    const field_key = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (!field_key) return res.status(400).json({ error: 'Label must contain at least one letter or number' });
    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM outreach_custom_fields').get();
    const sort_order = (maxOrder.m || 0) + 1;
    const result = db.prepare(`
      INSERT INTO outreach_custom_fields (label, field_key, field_type, sort_order, options, width, help_text, required)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      label.trim(), field_key, field_type, sort_order, JSON.stringify(Array.isArray(options) ? options : []),
      width === 'full' ? 'full' : 'half', help_text ? String(help_text).trim() || null : null, required ? 1 : 0,
    );
    res.status(201).json(getField(result.lastInsertRowid));
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A field with this name already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create custom field' });
  }
});

router.patch('/custom-fields/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { label, field_type, sort_order, active, options, width, width_px, height_px, help_text, required } = req.body;
    const existing = db.prepare('SELECT * FROM outreach_custom_fields WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Field not found' });

    if (existing.is_builtin) {
      if (field_type !== undefined && field_type !== existing.field_type) {
        return res.status(400).json({ error: "A built-in field's type can't be changed" });
      }
      if (LOCKED_BUILTINS.includes(existing.field_key) && ((active !== undefined && !active) || (required !== undefined && !required))) {
        return res.status(400).json({ error: `"${existing.label}" is always shown and required` });
      }
    } else if (field_type !== undefined && field_type !== existing.field_type) {
      if (!CUSTOM_FIELD_TYPES.includes(field_type)) return res.status(400).json({ error: 'Unknown field type' });
      const compatible = TEXT_LIKE_TYPES.includes(existing.field_type) && TEXT_LIKE_TYPES.includes(field_type);
      if (!compatible) {
        const used = db.prepare(`
          SELECT COUNT(*) as cnt FROM outreach_lead_custom_values
          WHERE field_key = ? AND value IS NOT NULL AND value != '' AND value != '[]'
        `).get(existing.field_key).cnt;
        if (used > 0) {
          return res.status(409).json({ error: `Can't change the type: ${used} lead(s) already have a value. Create a new field instead.` });
        }
      }
    }

    db.prepare(`
      UPDATE outreach_custom_fields SET
        label = COALESCE(?, label),
        field_type = COALESCE(?, field_type),
        sort_order = COALESCE(?, sort_order),
        active = COALESCE(?, active),
        options = COALESCE(?, options),
        width = COALESCE(?, width),
        width_px = CASE WHEN ? THEN ? ELSE width_px END,
        height_px = CASE WHEN ? THEN ? ELSE height_px END,
        help_text = CASE WHEN ? THEN ? ELSE help_text END,
        required = COALESCE(?, required)
      WHERE id = ?
    `).run(
      label && label.trim() ? label.trim() : null,
      existing.is_builtin ? null : (field_type || null),
      sort_order !== undefined ? sort_order : null,
      active !== undefined ? (active ? 1 : 0) : null,
      options !== undefined && !existing.is_builtin ? JSON.stringify(Array.isArray(options) ? options : []) : null,
      width !== undefined ? (width === 'full' ? 'full' : 'half') : null,
      width_px !== undefined ? 1 : 0, width_px !== undefined && width_px !== null ? Math.round(width_px) : null,
      height_px !== undefined ? 1 : 0, height_px !== undefined && height_px !== null ? Math.round(height_px) : null,
      help_text !== undefined ? 1 : 0, help_text ? String(help_text).trim() || null : null,
      required !== undefined ? (required ? 1 : 0) : null,
      id,
    );
    res.json(getField(id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update custom field' });
  }
});

// Permanent delete — only for archived custom fields, so values are never lost by one click
router.delete('/custom-fields/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM outreach_custom_fields WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Field not found' });
    if (existing.is_builtin) return res.status(400).json({ error: "Built-in fields can't be deleted — hide them instead" });
    if (existing.active) return res.status(409).json({ error: 'Archive the field before deleting it' });
    db.transaction(() => {
      db.prepare('DELETE FROM outreach_lead_custom_values WHERE field_key = ?').run(existing.field_key);
      db.prepare('DELETE FROM outreach_custom_fields WHERE id = ?').run(id);
    })();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete custom field' });
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
  // If it's a JSON string that starts with '[', keep as-is
  if (typeof den === 'string' && den.trim().startsWith('[')) return den;
  return den || 'total';
}

router.get('/dashboard/cards', (req, res) => {
  try {
    const cards = db.prepare('SELECT * FROM outreach_dashboard_cards ORDER BY sort_order ASC, id ASC').all();
    res.json(cards.map(parseCard));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard cards' });
  }
});

router.post('/dashboard/cards', requireAdmin, (req, res) => {
  try {
    const { label, card_type = 'count', numerator_statuses = [], denominator = 'total', color = '#575ECF', sort_order = 0 } = req.body;
    if (!label || !label.trim()) return res.status(400).json({ error: 'Label is required' });
    const result = db.prepare(
      'INSERT INTO outreach_dashboard_cards (label, card_type, numerator_statuses, denominator, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(label.trim(), card_type, JSON.stringify(numerator_statuses), serializeDenominator(denominator), color, sort_order);
    const created = db.prepare('SELECT * FROM outreach_dashboard_cards WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(parseCard(created));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create card' });
  }
});

router.patch('/dashboard/cards/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM outreach_dashboard_cards WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Card not found' });
    const { label, card_type, numerator_statuses, denominator, color, sort_order } = req.body;
    db.prepare(`
      UPDATE outreach_dashboard_cards SET
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
    const updated = db.prepare('SELECT * FROM outreach_dashboard_cards WHERE id = ?').get(id);
    res.json(parseCard(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

router.delete('/dashboard/cards/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM outreach_dashboard_cards WHERE id = ?').run(id);
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

    // ── Server-side access enforcement ──────────────────────────────────────
    const reqUser = req.user;
    const enforcedSpecId = resolveSpecialistForUser(reqUser);
    if (enforcedSpecId === -1) {
      return res.json({ total_leads: 0, responded: 0, interested: 0, appointments_booked: 0,
        no_shows: 0, closed: 0, started_trial: 0, disqualified: 0, meetings_happened: 0,
        response_rate: 0, interested_rate: 0, appointment_rate: 0, no_show_rate: 0, closed_rate: 0,
        avg_touchpoints_before_response: 0, overdue_followups: 0,
        by_status: {}, by_channel: {}, by_specialist: [], by_source: [] });
    }
    if (enforcedSpecId !== null) specialist_id = String(enforcedSpecId);
    // ────────────────────────────────────────────────────────────────────────

    const conditions = ['l.deleted_at IS NULL'];
    const params = [];

    if (specialist_id) {
      conditions.push('EXISTS (SELECT 1 FROM outreach_lead_specialists ols WHERE ols.lead_id = l.id AND ols.specialist_id = ?)');
      params.push(specialist_id);
    }
    if (date_from) { conditions.push("date(l.status_updated_at) >= ?"); params.push(date_from); }
    if (date_to) { conditions.push("date(l.status_updated_at) <= ?"); params.push(date_to); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const leads = db.prepare(`
      SELECT l.id, l.status, l.specialist_id, l.next_followup_date, s.name as specialist_name,
        src.name as source_name, src.color as source_color
      FROM outreach_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      LEFT JOIN outreach_lead_sources src ON src.id = l.source_id
      ${whereClause}
    `).all(...params);

    const leadIds = leads.map(l => l.id);
    const total_leads = leads.length;

    // ── Metrics based on CURRENT status only (no history accumulation) ─────
    // "Responded" = lead is in Interested OR Not Interested stage (or beyond)
    // using current status prevents inflated rates from historical stage passes.

    const stages = getStages();
    const namesOf = (...types) => stageNamesOfTypes(types, stages);
    const RESPONDED_CURRENT   = namesOf(...TYPE_GROUPS.responded);
    const INTERESTED_CURRENT  = namesOf(...TYPE_GROUPS.interested);
    const APPOINTMENT_CURRENT = namesOf(...TYPE_GROUPS.booked);
    const WON = namesOf('won');
    const CLOSED_OUT = namesOf(...TYPE_GROUPS.closed);

    const respondedLeads          = leads.filter(l => RESPONDED_CURRENT.includes(l.status));
    const responded               = respondedLeads.length;
    const interested              = leads.filter(l => INTERESTED_CURRENT.includes(l.status)).length;
    const appointments_booked     = leads.filter(l => APPOINTMENT_CURRENT.includes(l.status)).length;
    const countIn = names => leads.filter(l => names.includes(l.status)).length;
    const no_shows                = countIn(namesOf('no_show'));
    const meetings_done_ni        = countIn(namesOf('meeting_lost'));
    const started_trial           = countIn(namesOf('trial'));
    const closed                  = countIn(WON);
    const disqualified            = countIn(namesOf('dead'));
    const meetings_happened       = no_shows + meetings_done_ni + started_trial + closed;

    // Rates
    const fmt = (n, d) => d > 0 ? parseFloat((n / d * 100).toFixed(1)) : 0;
    const response_rate    = fmt(responded, total_leads);         // responded / total leads
    const interested_rate  = fmt(interested, responded);          // interested / responded
    const appointment_rate = fmt(appointments_booked, interested);// booked / interested
    const no_show_rate     = fmt(no_shows, appointments_booked);  // no shows / booked
    const closed_rate      = fmt(closed, appointments_booked);    // closed / all booked (clean close rate)

    // Avg touchpoints before response
    let avg_touchpoints_before_response = 0;
    if (respondedLeads.length > 0) {
      const rIds = respondedLeads.map(l => l.id);
      const tpCounts = db.prepare(`
        SELECT lead_id, COUNT(*) as cnt FROM outreach_touchpoints
        WHERE lead_id IN (${rIds.map(() => '?').join(',')}) AND date IS NOT NULL
        GROUP BY lead_id
      `).all(...rIds);
      if (tpCounts.length > 0) {
        avg_touchpoints_before_response = parseFloat((tpCounts.reduce((s, r) => s + r.cnt, 0) / tpCounts.length).toFixed(1));
      }
    }

    // Overdue follow-ups count
    const today = new Date().toISOString().slice(0, 10);
    const overdue_followups = leads.filter(l =>
      l.next_followup_date && l.next_followup_date < today &&
      !CLOSED_OUT.includes(l.status)
    ).length;

    // by_status (current status distribution — includes ALL actual statuses, not just hardcoded list)
    const by_status = {};
    stages.filter(s => s.active).forEach(s => { by_status[s.name] = 0; }); // initialize active stages to 0
    leads.forEach(l => {
      if (l.status) by_status[l.status] = (by_status[l.status] || 0) + 1;
    });

    // by_channel (touchpoint channels used)
    const by_channel = {};
    if (leadIds.length > 0) {
      db.prepare(`
        SELECT channel, COUNT(*) as cnt FROM outreach_touchpoints
        WHERE lead_id IN (${leadIds.map(() => '?').join(',')}) AND channel IS NOT NULL AND channel != ''
        GROUP BY channel ORDER BY cnt DESC
      `).all(...leadIds).forEach(r => { by_channel[r.channel] = r.cnt; });
    }

    // by_specialist — uses junction table for accurate multi-specialist attribution
    const specialistMap = {};
    if (leadIds.length > 0) {
      const assignments = db.prepare(`
        SELECT ols.lead_id, ols.specialist_id, s.name as specialist_name
        FROM outreach_lead_specialists ols
        JOIN outreach_specialists s ON s.id = ols.specialist_id
        WHERE ols.lead_id IN (${leadIds.map(() => '?').join(',')})
      `).all(...leadIds);

      const leadStatusMap = {};
      leads.forEach(l => { leadStatusMap[l.id] = l.status; });

      assignments.forEach(a => {
        if (!specialistMap[a.specialist_id]) {
          specialistMap[a.specialist_id] = { name: a.specialist_name || 'Unknown', total: 0, closed: 0, responded: 0, booked: 0 };
        }
        const status = leadStatusMap[a.lead_id];
        specialistMap[a.specialist_id].total++;
        if (WON.includes(status)) specialistMap[a.specialist_id].closed++;
        if (RESPONDED_CURRENT.includes(status)) specialistMap[a.specialist_id].responded++;
        if (APPOINTMENT_CURRENT.includes(status)) specialistMap[a.specialist_id].booked++;
      });
    }
    const by_specialist = Object.values(specialistMap).sort((a, b) => b.total - a.total);

    // by_source — volume and outcomes per lead source
    const sourceMap = {};
    leads.forEach(l => {
      const name = l.source_name || 'No source';
      if (!sourceMap[name]) sourceMap[name] = { name, color: l.source_color || '#555555', total: 0, responded: 0, booked: 0, closed: 0 };
      const row = sourceMap[name];
      row.total++;
      if (RESPONDED_CURRENT.includes(l.status)) row.responded++;
      if (APPOINTMENT_CURRENT.includes(l.status)) row.booked++;
      if (WON.includes(l.status)) row.closed++;
    });
    const by_source = Object.values(sourceMap).sort((a, b) => b.total - a.total);

    res.json({
      total_leads, total_contacted: total_leads,
      responded, response_rate,
      interested, interested_rate,
      appointments_booked, appointment_rate, leads_to_appointment_ratio: appointment_rate,
      no_shows, no_show_rate,
      meetings_happened, closed, closed_rate,
      started_trial, disqualified,
      avg_touchpoints_before_response, overdue_followups,
      by_status, by_channel, by_specialist, by_source,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// ─── DAILY ACTIVITY ───────────────────────────────────────────────────────────
// Returns new leads created + stage moves in a date range, broken down by stage
// and by specialist. Used by the "Daily Activity" section on the dashboard.

router.get('/activity', (req, res) => {
  try {
    let { date_from, date_to, specialist_id } = req.query;

    const reqUser = req.user;
    const enforcedSpecId = resolveSpecialistForUser(reqUser);
    if (enforcedSpecId === -1) {
      return res.json({
        new_leads_total: 0, new_leads_by_specialist: [],
        stage_moves_by_stage: [], activity_by_specialist: [],
      });
    }
    if (enforcedSpecId !== null) specialist_id = String(enforcedSpecId);

    // Default to yesterday when no range provided
    const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const from = date_from || yest;
    const to   = date_to   || yest;

    // ── 1. New leads created ─────────────────────────────────────────────────
    const nlCond   = ['l.deleted_at IS NULL', 'date(l.created_at) >= ?', 'date(l.created_at) <= ?'];
    const nlParams = [from, to];
    if (specialist_id) { nlCond.push('l.specialist_id = ?'); nlParams.push(specialist_id); }

    const newLeadsBySpec = db.prepare(`
      SELECT COALESCE(s.name, 'Unassigned') as specialist_name, l.specialist_id,
             COUNT(l.id) as count
      FROM outreach_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      WHERE ${nlCond.join(' AND ')}
      GROUP BY l.specialist_id
      ORDER BY count DESC
    `).all(...nlParams);

    const new_leads_total = newLeadsBySpec.reduce((sum, r) => sum + r.count, 0);

    // ── 2. Stage moves from status_history ───────────────────────────────────
    const mvCond   = ['l.deleted_at IS NULL', 'date(sh.changed_at) >= ?', 'date(sh.changed_at) <= ?'];
    const mvParams = [from, to];
    if (specialist_id) { mvCond.push('l.specialist_id = ?'); mvParams.push(specialist_id); }

    const stage_moves_by_stage = db.prepare(`
      SELECT sh.new_status as stage,
             COUNT(DISTINCT sh.lead_id) as leads_count,
             COUNT(*) as moves_count
      FROM outreach_status_history sh
      JOIN outreach_leads l ON l.id = sh.lead_id
      WHERE ${mvCond.join(' AND ')}
      GROUP BY sh.new_status
      ORDER BY moves_count DESC
    `).all(...mvParams);

    // ── 3. Per-specialist: new leads + stage moves ────────────────────────────
    const specMovesRows = db.prepare(`
      SELECT COALESCE(s.name, 'Unassigned') as specialist_name,
             COUNT(DISTINCT sh.lead_id) as leads_worked,
             COUNT(*) as stage_moves
      FROM outreach_status_history sh
      JOIN outreach_leads l ON l.id = sh.lead_id
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      WHERE ${mvCond.join(' AND ')}
      GROUP BY l.specialist_id
      ORDER BY stage_moves DESC
    `).all(...mvParams);

    const specMovesMap = {};
    specMovesRows.forEach(r => {
      specMovesMap[r.specialist_name] = { leads_worked: r.leads_worked, stage_moves: r.stage_moves };
    });

    const allNames = new Set([
      ...newLeadsBySpec.map(r => r.specialist_name),
      ...Object.keys(specMovesMap),
    ]);

    const activity_by_specialist = [...allNames].map(name => ({
      name,
      new_leads:    newLeadsBySpec.find(r => r.specialist_name === name)?.count || 0,
      leads_worked: specMovesMap[name]?.leads_worked || 0,
      stage_moves:  specMovesMap[name]?.stage_moves  || 0,
    })).sort((a, b) => (b.new_leads + b.stage_moves) - (a.new_leads + a.stage_moves));

    res.json({
      date_from: from, date_to: to,
      new_leads_total,
      new_leads_by_specialist: newLeadsBySpec,
      stage_moves_by_stage,
      activity_by_specialist,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch activity data' });
  }
});

// ─── ACTIVITY LEADS (drill-through for Daily Activity section) ───────────────
// Returns the individual leads/move-events behind a Daily Activity number.
// filter_type: 'new_leads' | 'stage_moves'
// stage:            (stage_moves only) filter to a specific destination stage
// specialist_name:  filter to leads whose primary specialist has this name
// distinct_leads:   '1' = deduplicate by lead_id (one row per lead, latest move)

router.get('/activity/leads', (req, res) => {
  try {
    let { date_from, date_to, filter_type, stage, specialist_name, distinct_leads } = req.query;

    const reqUser = req.user;
    const enforcedSpecId = resolveSpecialistForUser(reqUser);
    if (enforcedSpecId === -1) return res.json([]);

    const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const from = date_from || yest;
    const to   = date_to   || yest;

    // ── New leads created ────────────────────────────────────────────────────
    if (filter_type === 'new_leads') {
      const cond   = ['l.deleted_at IS NULL', 'date(l.created_at) >= ?', 'date(l.created_at) <= ?'];
      const params = [from, to];
      if (specialist_name) { cond.push('s.name = ?'); params.push(specialist_name); }
      if (enforcedSpecId !== null) { cond.push('l.specialist_id = ?'); params.push(enforcedSpecId); }

      const leads = db.prepare(`
        SELECT l.id, l.company_name, l.contact_name, l.status, l.created_at,
               COALESCE(s.name, 'Unassigned') as specialist_name
        FROM outreach_leads l
        LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
        WHERE ${cond.join(' AND ')}
        ORDER BY l.created_at DESC
      `).all(...params);
      return res.json(leads);
    }

    // ── Stage moves (default) ────────────────────────────────────────────────
    const cond   = ['l.deleted_at IS NULL', 'date(sh.changed_at) >= ?', 'date(sh.changed_at) <= ?'];
    const params = [from, to];
    if (stage)            { cond.push('sh.new_status = ?');  params.push(stage); }
    if (specialist_name)  { cond.push('s.name = ?');          params.push(specialist_name); }
    if (enforcedSpecId !== null) { cond.push('l.specialist_id = ?'); params.push(enforcedSpecId); }

    if (distinct_leads === '1') {
      // One row per lead — take the latest move per lead in the period
      const rows = db.prepare(`
        SELECT l.id, l.company_name, l.contact_name, l.status,
               sh.old_status, sh.new_status, sh.changed_at,
               COALESCE(s.name, 'Unassigned') as specialist_name
        FROM outreach_status_history sh
        JOIN outreach_leads l ON l.id = sh.lead_id
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
      SELECT sh.id as move_id, l.id, l.company_name, l.contact_name, l.status,
             sh.old_status, sh.new_status, sh.changed_at,
             COALESCE(s.name, 'Unassigned') as specialist_name
      FROM outreach_status_history sh
      JOIN outreach_leads l ON l.id = sh.lead_id
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

// ─── OVERDUE LEADS (for dashboard list) ──────────────────────────────────────

router.get('/overdue', (req, res) => {
  try {
    let { specialist_id } = req.query;
    const reqUser = req.user;
    const enforcedSpecId = resolveSpecialistForUser(reqUser);
    if (enforcedSpecId === -1) return res.json([]);
    if (enforcedSpecId !== null) specialist_id = String(enforcedSpecId);

    const today = new Date().toISOString().slice(0, 10);
    const notClosed = notClosedClause('l.status');
    const conditions = ['l.deleted_at IS NULL', 'l.next_followup_date < ?', notClosed.sql];
    const params = [today, ...notClosed.params];
    if (specialist_id) {
      conditions.push('EXISTS (SELECT 1 FROM outreach_lead_specialists ols WHERE ols.lead_id = l.id AND ols.specialist_id = ?)');
      params.push(specialist_id);
    }

    const leads = db.prepare(`
      SELECT l.id, l.company_name, l.contact_name, l.status, l.next_followup_date, s.name as specialist_name
      FROM outreach_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY l.next_followup_date ASC
    `).all(...params);
    res.json(leads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch overdue leads' });
  }
});

// ─── EXPORT CSV ───────────────────────────────────────────────────────────────

router.get('/export/csv', (req, res) => {
  try {
    let { specialist_id, date_from, date_to, status } = req.query;
    const enforcedSpecId = resolveSpecialistForUser(req.user);
    if (enforcedSpecId === -1) return res.status(204).send();
    if (enforcedSpecId !== null) specialist_id = String(enforcedSpecId);
    const conditions = ['l.deleted_at IS NULL'];
    const params = [];
    if (specialist_id) {
      conditions.push('EXISTS (SELECT 1 FROM outreach_lead_specialists ols WHERE ols.lead_id = l.id AND ols.specialist_id = ?)');
      params.push(specialist_id);
    }
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length > 0) {
        conditions.push(`l.status IN (${statuses.map(() => '?').join(',')})`);
        params.push(...statuses);
      }
    }
    if (date_from) { conditions.push("date(l.created_at) >= ?"); params.push(date_from); }
    if (date_to) { conditions.push("date(l.created_at) <= ?"); params.push(date_to); }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const leads = db.prepare(`
      SELECT l.*, s.name as specialist_name, i.name as industry_name,
        src.name as source_name, src.color as source_color
      FROM outreach_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      LEFT JOIN outreach_industries i ON i.id = l.industry_id
      LEFT JOIN outreach_lead_sources src ON src.id = l.source_id
      ${whereClause}
      ORDER BY l.created_at DESC
    `).all(...params);

    if (leads.length === 0) return res.status(204).send();

    const leadIds = leads.map(l => l.id);
    const allTp = db.prepare(
      `SELECT * FROM outreach_touchpoints WHERE lead_id IN (${leadIds.map(() => '?').join(',')}) ORDER BY lead_id, touchpoint_number`
    ).all(...leadIds);
    const tpByLead = {};
    allTp.forEach(tp => {
      if (!tpByLead[tp.lead_id]) tpByLead[tp.lead_id] = {};
      tpByLead[tp.lead_id][tp.touchpoint_number] = tp;
    });

    const rows = leads.map(l => {
      const row = {
        ID: l.id,
        Company: l.company_name,
        Contact: l.contact_name || '',
        'Job Title': l.job_title || '',
        Website: l.website || '',
        Industry: l.industry_name || '',
        Source: l.source_name || '',
        Location: l.location || '',
        Status: l.status,
        Specialist: l.specialist_name || '',
        'Next Follow-up': l.next_followup_date || '',
        'Created At': l.created_at,
      };
      for (let i = 1; i <= 5; i++) {
        const tp = tpByLead[l.id] && tpByLead[l.id][i];
        row[`TP${i} Date`] = tp ? (tp.date || '') : '';
        row[`TP${i} Channel`] = tp ? (tp.channel || '') : '';
        row[`TP${i} Loom URL`] = tp ? (tp.loom_url || '') : '';
        row[`TP${i} Notes`] = tp ? (tp.notes || '') : '';
      }
      return row;
    });

    const parser = new Parser({ fields: Object.keys(rows[0]) });
    const csv = parser.parse(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=outreach-export.csv');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// ─── EXPORT PDF (HTML print page) ────────────────────────────────────────────

router.get('/export/pdf', (req, res) => {
  try {
    let { specialist_id, date_from, date_to } = req.query;
    const enforcedSpecId = resolveSpecialistForUser(req.user);
    if (enforcedSpecId === -1) specialist_id = '-1';
    else if (enforcedSpecId !== null) specialist_id = String(enforcedSpecId);
    const conditions = ['l.deleted_at IS NULL'];
    const params = [];
    if (specialist_id) {
      conditions.push('EXISTS (SELECT 1 FROM outreach_lead_specialists ols WHERE ols.lead_id = l.id AND ols.specialist_id = ?)');
      params.push(specialist_id);
    }
    if (date_from) { conditions.push("date(l.created_at) >= ?"); params.push(date_from); }
    if (date_to) { conditions.push("date(l.created_at) <= ?"); params.push(date_to); }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const leads = db.prepare(`
      SELECT l.*, s.name as specialist_name, i.name as industry_name,
        src.name as source_name, src.color as source_color
      FROM outreach_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      LEFT JOIN outreach_industries i ON i.id = l.industry_id
      LEFT JOIN outreach_lead_sources src ON src.id = l.source_id
      ${whereClause} ORDER BY l.created_at DESC
    `).all(...params);

    // Active stages in pipeline order, plus any status leads are still sitting in
    const byStatus = {};
    getStages().filter(s => s.active).forEach(s => { byStatus[s.name] = 0; });
    leads.forEach(l => { byStatus[l.status] = (byStatus[l.status] || 0) + 1; });
    const statusNames = Object.keys(byStatus);

    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const rows = statusNames.map(s => `<tr><td>${esc(s)}</td><td style="text-align:right">${byStatus[s]}</td></tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Outreach Report</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111; padding: 40px; }
      h1 { font-size: 22px; margin-bottom: 4px; }
      .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #ddd; padding: 8px 12px; font-size: 13px; text-align: left; }
      th { background: #f4f4f4; font-weight: 600; }
      .total { font-weight: bold; background: #f9f9f9; }
      @media print { button { display: none; } }
    </style></head><body>
    <h1>Outreach CRM — Pipeline Report</h1>
    <p class="sub">Generated: ${today}${date_from ? ` · From: ${date_from}` : ''}${date_to ? ` · To: ${date_to}` : ''}</p>
    <table><thead><tr><th>Status</th><th style="text-align:right">Count</th></tr></thead>
    <tbody>${rows}<tr class="total"><td>Total Leads</td><td style="text-align:right">${leads.length}</td></tr></tbody></table>
    <br/><button onclick="window.print()">🖨 Print / Save as PDF</button>
    </body></html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ─── PIPELINE STAGES ──────────────────────────────────────────────────────────

router.get('/pipeline-stages', (req, res) => {
  try {
    res.json(withTouchpointNumbers(getStages()));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch pipeline stages' });
  }
});

router.post('/pipeline-stages', requireAdmin, (req, res) => {
  try {
    const { name, stage_type = 'in_progress' } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!STAGE_TYPES.includes(stage_type)) return res.status(400).json({ error: 'Unknown stage type' });
    const maxOrder = db.prepare('SELECT MAX(order_index) as mx FROM outreach_pipeline_stages').get();
    const nextOrder = (maxOrder.mx || 0) + 1;
    const result = db.prepare('INSERT INTO outreach_pipeline_stages (name, order_index, stage_type) VALUES (?, ?, ?)').run(name.trim(), nextOrder, stage_type);
    res.status(201).json(withTouchpointNumbers(getStages()).find(s => s.id === Number(result.lastInsertRowid)));
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A stage with this name already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create stage' });
  }
});

// Lead status, status history and dashboard cards store stage *names*, so a rename has to
// carry them along — otherwise leads are left in a stage that no longer exists.
function renameStageReferences(oldName, newName) {
  db.prepare('UPDATE outreach_leads SET status = ? WHERE status = ?').run(newName, oldName);
  db.prepare('UPDATE outreach_status_history SET new_status = ? WHERE new_status = ?').run(newName, oldName);
  db.prepare('UPDATE outreach_status_history SET old_status = ? WHERE old_status = ?').run(newName, oldName);
  const swap = list => list.map(s => (s === oldName ? newName : s));
  const updateCard = db.prepare('UPDATE outreach_dashboard_cards SET numerator_statuses = ?, denominator = ? WHERE id = ?');
  db.prepare('SELECT * FROM outreach_dashboard_cards').all().map(parseCard).forEach(card => {
    const numerator = swap(card.numerator_statuses);
    const denominator = Array.isArray(card.denominator) ? swap(card.denominator) : card.denominator;
    updateCard.run(JSON.stringify(numerator), serializeDenominator(denominator), card.id);
  });
}

// Statuses that leads are sitting in but that have no active stage (renamed/deleted before
// renames carried leads along, or deactivated). These leads don't show on the Kanban board.
router.get('/pipeline-stages/orphaned', requireAdmin, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT l.status, COUNT(*) as count, MAX(ps.id IS NOT NULL) as inactive_stage
      FROM outreach_leads l
      LEFT JOIN outreach_pipeline_stages ps ON ps.name = l.status
      WHERE l.deleted_at IS NULL AND (ps.id IS NULL OR ps.active = 0)
      GROUP BY l.status
      ORDER BY count DESC
    `).all();
    res.json(rows.map(r => ({ status: r.status, count: r.count, inactive_stage: !!r.inactive_stage })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch orphaned stages' });
  }
});

// Moves every lead in status `from` into the existing stage `to`, logging it in status history
router.post('/pipeline-stages/remap', requireAdmin, (req, res) => {
  try {
    const { from, to } = req.body;
    if (!from || !to || from === to) return res.status(400).json({ error: 'Pick a different target stage' });
    const target = db.prepare('SELECT * FROM outreach_pipeline_stages WHERE name = ? AND active = 1').get(to);
    if (!target) return res.status(400).json({ error: 'Target stage not found or inactive' });

    const moved = db.transaction(() => {
      const ids = db.prepare('SELECT id FROM outreach_leads WHERE status = ?').all(from).map(r => r.id);
      const logMove = db.prepare('INSERT INTO outreach_status_history (lead_id, old_status, new_status, performed_by) VALUES (?, ?, ?, ?)');
      ids.forEach(leadId => logMove.run(leadId, from, to, `${req.user.name} (stage cleanup)`));
      db.prepare('UPDATE outreach_leads SET status = ? WHERE status = ?').run(to, from);
      return ids.length;
    })();
    res.json({ moved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to move leads' });
  }
});

router.patch('/pipeline-stages/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { name, order_index, active, stage_type } = req.body;
    const existing = db.prepare('SELECT * FROM outreach_pipeline_stages WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Stage not found' });
    if (stage_type !== undefined && !STAGE_TYPES.includes(stage_type)) return res.status(400).json({ error: 'Unknown stage type' });
    const newName = typeof name === 'string' && name.trim() ? name.trim() : null;
    db.transaction(() => {
      db.prepare(`
        UPDATE outreach_pipeline_stages SET
          name = COALESCE(?, name),
          order_index = COALESCE(?, order_index),
          active = COALESCE(?, active),
          stage_type = COALESCE(?, stage_type)
        WHERE id = ?
      `).run(
        newName,
        order_index !== undefined ? order_index : null,
        active !== undefined ? active : null,
        stage_type || null,
        id
      );
      if (newName && newName !== existing.name) renameStageReferences(existing.name, newName);
    })();
    res.json(withTouchpointNumbers(getStages()).find(s => s.id === Number(id)));
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A stage with this name already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update stage' });
  }
});

router.delete('/pipeline-stages/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const stage = db.prepare('SELECT * FROM outreach_pipeline_stages WHERE id = ?').get(id);
    if (!stage) return res.status(404).json({ error: 'Stage not found' });
    const used = db.prepare('SELECT COUNT(*) as cnt FROM outreach_leads WHERE status = ?').get(stage.name);
    if (used.cnt > 0) {
      return res.status(409).json({ error: `Cannot delete: ${used.cnt} lead(s) are in this stage` });
    }
    db.prepare('DELETE FROM outreach_pipeline_stages WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete stage' });
  }
});

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

router.get('/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM outreach_settings').all();
    const result = {};
    rows.forEach(s => { result[s.key] = s.value; });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.patch('/settings', requireAdmin, (req, res) => {
  try {
    const updates = req.body;
    const stmt = db.prepare('INSERT OR REPLACE INTO outreach_settings (key, value) VALUES (?, ?)');
    Object.entries(updates).forEach(([key, value]) => stmt.run(key, String(value)));
    const rows = db.prepare('SELECT * FROM outreach_settings').all();
    const result = {};
    rows.forEach(s => { result[s.key] = s.value; });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ─── LEAD RESPONSES ───────────────────────────────────────────────────────────

router.get('/leads/:leadId/responses', (req, res) => {
  try {
    const { leadId } = req.params;
    if (!checkLeadAccess(req, res, leadId)) return;
    const responses = db.prepare(
      'SELECT * FROM outreach_lead_responses WHERE lead_id = ? ORDER BY created_at DESC'
    ).all(leadId);
    res.json(responses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch responses' });
  }
});

router.post('/leads/:leadId/responses', (req, res) => {
  try {
    const { leadId } = req.params;
    const { date, channel, message_body, notes } = req.body;
    if (!channel || !channel.trim()) return res.status(400).json({ error: 'Channel is required' });
    if (!message_body || !message_body.trim()) return res.status(400).json({ error: 'Message body is required' });
    if (!checkLeadAccess(req, res, leadId)) return;
    const result = db.prepare(
      'INSERT INTO outreach_lead_responses (lead_id, date, channel, message_body, notes) VALUES (?, ?, ?, ?, ?)'
    ).run(leadId, date || null, channel.trim(), message_body.trim(), notes || null);
    const created = db.prepare('SELECT * FROM outreach_lead_responses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save response' });
  }
});

router.delete('/leads/:leadId/responses/:id', (req, res) => {
  try {
    const { leadId, id } = req.params;
    if (!checkLeadAccess(req, res, leadId)) return;
    const existing = db.prepare('SELECT id FROM outreach_lead_responses WHERE id = ? AND lead_id = ?').get(id, leadId);
    if (!existing) return res.status(404).json({ error: 'Response not found' });
    db.prepare('DELETE FROM outreach_lead_responses WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete response' });
  }
});

module.exports = router;
