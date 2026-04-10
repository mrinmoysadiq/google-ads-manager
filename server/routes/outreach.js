const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { Parser } = require('json2csv');
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'infinix_secret_key';

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

const STATUSES = [
  'New Lead',
  'Touchpoint 1', 'Touchpoint 2', 'Touchpoint 3', 'Touchpoint 4', 'Touchpoint 5',
  'Responded', 'Interested', 'Appointment Booked',
  'No Show', 'Meeting Done - Not Interested', 'Started Trial',
  'Closed / Booked as Client', 'Disqualified / Dead',
];

function getMaxTouchpoints() {
  try {
    const setting = db.prepare("SELECT value FROM outreach_settings WHERE key = 'max_touchpoints'").get();
    return setting ? Math.max(1, Math.min(20, parseInt(setting.value) || 5)) : 5;
  } catch { return 5; }
}

const RESPONDED_OR_BEYOND = [
  'Responded', 'Interested', 'Appointment Booked', 'No Show',
  'Meeting Done - Not Interested', 'Started Trial', 'Closed / Booked as Client',
];

const INTERESTED_OR_BEYOND = [
  'Interested', 'Appointment Booked', 'No Show',
  'Meeting Done - Not Interested', 'Started Trial', 'Closed / Booked as Client',
];

const APPOINTMENT_OR_BEYOND = [
  'Appointment Booked', 'No Show', 'Meeting Done - Not Interested',
  'Started Trial', 'Closed / Booked as Client',
];

const NOT_OVERDUE_STATUSES = ['Closed / Booked as Client', 'Disqualified / Dead', 'Meeting Done - Not Interested'];

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

router.patch('/specialists/:id', (req, res) => {
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

router.patch('/industries/:id', (req, res) => {
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

router.delete('/industries/:id', (req, res) => {
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

// ─── LEADS ────────────────────────────────────────────────────────────────────

router.get('/leads', (req, res) => {
  try {
    let {
      specialist_id, status, industry_id, search,
      followup_overdue, date_from, date_to,
      page = 1, limit = 25,
      sort_by = 'created_at', sort_dir = 'DESC',
    } = req.query;

    // ── Server-side access enforcement ──────────────────────────────────────
    const reqUser = getRequestUser(req);
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

    const conditions = [];
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
    if (search) {
      conditions.push('(l.company_name LIKE ? OR l.contact_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (followup_overdue === 'true') {
      const today = new Date().toISOString().slice(0, 10);
      const notOverdueList = NOT_OVERDUE_STATUSES.map(() => '?').join(',');
      conditions.push(`(l.next_followup_date < ? AND l.status NOT IN (${notOverdueList}))`);
      params.push(today, ...NOT_OVERDUE_STATUSES);
    }
    if (date_from) { conditions.push("date(l.created_at) >= ?"); params.push(date_from); }
    if (date_to) { conditions.push("date(l.created_at) <= ?"); params.push(date_to); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const allowedSort = ['company_name', 'contact_name', 'status', 'next_followup_date', 'created_at', 'status_updated_at'];
    const safeSortBy = allowedSort.includes(sort_by) ? `l.${sort_by}` : 'l.created_at';
    const safeSortDir = sort_dir === 'ASC' ? 'ASC' : 'DESC';

    const total = db.prepare(`SELECT COUNT(*) as cnt FROM outreach_leads l ${whereClause}`).get(...params).cnt;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const leads = db.prepare(`
      SELECT
        l.*,
        s.name as specialist_name,
        i.name as industry_name,
        (SELECT GROUP_CONCAT(s2.name, ', ') FROM outreach_lead_specialists ols2
         JOIN outreach_specialists s2 ON s2.id = ols2.specialist_id
         WHERE ols2.lead_id = l.id ORDER BY s2.name ASC) as specialist_names,
        (SELECT GROUP_CONCAT(ols2.specialist_id, ',') FROM outreach_lead_specialists ols2
         WHERE ols2.lead_id = l.id) as specialist_ids_csv,
        (SELECT COUNT(*) FROM outreach_touchpoints WHERE lead_id = l.id AND date IS NOT NULL) as touchpoint_count,
        (SELECT MAX(date) FROM outreach_touchpoints WHERE lead_id = l.id AND date IS NOT NULL) as last_touchpoint_date
      FROM outreach_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      LEFT JOIN outreach_industries i ON i.id = l.industry_id
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortDir}
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
      website, industry_id, location,
      next_followup_date, next_followup,
      source_url, source_image, email, phone, fb_page_url, ig_url,
      performed_by,
    } = req.body;
    const followupDate = next_followup_date || next_followup || null;

    // Normalize specialist_ids — accept array or single id
    const specIds = Array.isArray(specialist_ids) && specialist_ids.length > 0
      ? specialist_ids
      : (single_specialist_id ? [single_specialist_id] : []);
    if (!specIds.length) return res.status(400).json({ error: 'At least one specialist is required' });
    if (!company_name || !company_name.trim()) return res.status(400).json({ error: 'company_name is required' });

    const result = db.prepare(`
      INSERT INTO outreach_leads
        (specialist_id, company_name, contact_name, job_title, website, industry_id, location, next_followup_date, source_url, source_image, email, phone, fb_page_url, ig_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      specIds[0],
      company_name.trim(),
      contact_name || null,
      job_title || null,
      website || null,
      industry_id || null,
      location || null,
      followupDate,
      source_url || null,
      source_image || null,
      email || null,
      phone || null,
      fb_page_url || null,
      ig_url || null,
    );

    const leadId = result.lastInsertRowid;

    // Insert all specialists into junction table
    const insertSpec = db.prepare('INSERT OR IGNORE INTO outreach_lead_specialists (lead_id, specialist_id) VALUES (?, ?)');
    for (const sid of specIds) { insertSpec.run(leadId, sid); }

    // Seed status history entry
    db.prepare('INSERT INTO outreach_status_history (lead_id, old_status, new_status, performed_by) VALUES (?, ?, ?, ?)')
      .run(leadId, null, 'New Lead', performed_by || null);
    // Set initial status to 'New Lead'
    db.prepare("UPDATE outreach_leads SET status = 'New Lead' WHERE id = ?").run(leadId);

    const created = db.prepare(`
      SELECT l.*, s.name as specialist_name, i.name as industry_name
      FROM outreach_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      LEFT JOIN outreach_industries i ON i.id = l.industry_id
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
      SELECT l.*, s.name as specialist_name, i.name as industry_name
      FROM outreach_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      LEFT JOIN outreach_industries i ON i.id = l.industry_id
      WHERE l.id = ?
    `).get(id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // ── Server-side access enforcement ──────────────────────────────────────
    const reqUser = getRequestUser(req);
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

    res.json({ ...lead, touchpoints, history, responses, specialists });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

router.patch('/leads/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM outreach_leads WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Lead not found' });

    const {
      specialist_id, specialist_ids, company_name, contact_name, job_title,
      website, industry_id, location, status,
      next_followup_date, next_followup,
      source_url, source_image, email, phone, fb_page_url, ig_url,
      performed_by,
    } = req.body;

    // Accept both next_followup_date and next_followup field names
    const hasFollowupField = next_followup_date !== undefined || next_followup !== undefined;
    const followupValue = hasFollowupField ? (next_followup_date || next_followup || null) : undefined;

    const statusChanged = status && status !== existing.status;

    db.prepare(`
      UPDATE outreach_leads SET
        specialist_id = COALESCE(?, specialist_id),
        company_name = COALESCE(?, company_name),
        contact_name = ?,
        job_title = ?,
        website = ?,
        industry_id = ?,
        location = ?,
        status = COALESCE(?, status),
        next_followup_date = ?,
        source_url = ?,
        source_image = ?,
        email = ?,
        phone = ?,
        fb_page_url = ?,
        ig_url = ?,
        status_updated_at = CASE WHEN ? IS NOT NULL AND ? != status THEN CURRENT_TIMESTAMP ELSE status_updated_at END
      WHERE id = ?
    `).run(
      specialist_id || null,
      company_name || null,
      contact_name !== undefined ? (contact_name || null) : existing.contact_name,
      job_title !== undefined ? (job_title || null) : existing.job_title,
      website !== undefined ? (website || null) : existing.website,
      industry_id !== undefined ? (industry_id || null) : existing.industry_id,
      location !== undefined ? (location || null) : existing.location,
      status || null,
      followupValue !== undefined ? followupValue : existing.next_followup_date,
      source_url !== undefined ? (source_url || null) : existing.source_url,
      source_image !== undefined ? (source_image || null) : existing.source_image,
      email !== undefined ? (email || null) : existing.email,
      phone !== undefined ? (phone || null) : existing.phone,
      fb_page_url !== undefined ? (fb_page_url || null) : existing.fb_page_url,
      ig_url !== undefined ? (ig_url || null) : existing.ig_url,
      status || null, status || null,
      id,
    );

    if (statusChanged) {
      db.prepare('INSERT INTO outreach_status_history (lead_id, old_status, new_status, performed_by) VALUES (?, ?, ?, ?)')
        .run(id, existing.status, status, performed_by || null);
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

    const updated = db.prepare(`
      SELECT l.*, s.name as specialist_name, i.name as industry_name
      FROM outreach_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      LEFT JOIN outreach_industries i ON i.id = l.industry_id
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
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

router.delete('/leads/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT id FROM outreach_leads WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Lead not found' });
    db.prepare('DELETE FROM outreach_touchpoints WHERE lead_id = ?').run(id);
    db.prepare('DELETE FROM outreach_status_history WHERE lead_id = ?').run(id);
    db.prepare('DELETE FROM outreach_leads WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// ─── TOUCHPOINTS ──────────────────────────────────────────────────────────────

router.get('/leads/:leadId/touchpoints', (req, res) => {
  try {
    const { leadId } = req.params;
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
    const { date, channel, message_body, loom_url, notes } = req.body;
    const num = parseInt(number);
    const maxTp = getMaxTouchpoints();
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

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

router.get('/dashboard', (req, res) => {
  try {
    const { specialist_id, date_from, date_to } = req.query;
    const conditions = [];
    const params = [];

    if (specialist_id) { conditions.push('l.specialist_id = ?'); params.push(specialist_id); }
    if (date_from) { conditions.push("date(l.created_at) >= ?"); params.push(date_from); }
    if (date_to) { conditions.push("date(l.created_at) <= ?"); params.push(date_to); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const leads = db.prepare(`
      SELECT l.id, l.status, l.specialist_id, l.next_followup_date, s.name as specialist_name
      FROM outreach_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      ${whereClause}
    `).all(...params);

    const leadIds = leads.map(l => l.id);

    // Build per-lead status sets (current + history)
    const leadStatusSets = {};
    leads.forEach(l => { leadStatusSets[l.id] = new Set([l.status]); });

    if (leadIds.length > 0) {
      const history = db.prepare(
        `SELECT lead_id, new_status FROM outreach_status_history WHERE lead_id IN (${leadIds.map(() => '?').join(',')})`
      ).all(...leadIds);
      history.forEach(h => {
        if (leadStatusSets[h.lead_id]) leadStatusSets[h.lead_id].add(h.new_status);
      });
    }

    const hasAny = (leadId, statuses) => statuses.some(s => leadStatusSets[leadId] && leadStatusSets[leadId].has(s));

    const total_leads = leads.length;
    const total_contacted = total_leads;

    const respondedLeads = leads.filter(l => hasAny(l.id, RESPONDED_OR_BEYOND));
    const responded = respondedLeads.length;

    const interestedLeads = leads.filter(l => hasAny(l.id, INTERESTED_OR_BEYOND));
    const interested = interestedLeads.length;

    const appointmentLeads = leads.filter(l => hasAny(l.id, APPOINTMENT_OR_BEYOND));
    const appointments_booked = appointmentLeads.length;

    const no_shows = leads.filter(l => leadStatusSets[l.id] && leadStatusSets[l.id].has('No Show')).length;
    const meetings_done_not_interested = leads.filter(l => leadStatusSets[l.id] && leadStatusSets[l.id].has('Meeting Done - Not Interested')).length;
    const started_trial = leads.filter(l => leadStatusSets[l.id] && leadStatusSets[l.id].has('Started Trial')).length;
    const closed = leads.filter(l => leadStatusSets[l.id] && leadStatusSets[l.id].has('Closed / Booked as Client')).length;
    const disqualified = leads.filter(l => leadStatusSets[l.id] && leadStatusSets[l.id].has('Disqualified / Dead')).length;
    const meetings_happened = meetings_done_not_interested + started_trial + closed;

    const response_rate = total_leads > 0 ? parseFloat((responded / total_leads * 100).toFixed(1)) : 0;
    const interested_rate = responded > 0 ? parseFloat((interested / responded * 100).toFixed(1)) : 0;
    const leads_to_appointment_ratio = total_leads > 0 ? parseFloat((appointments_booked / total_leads * 100).toFixed(1)) : 0;
    const no_show_rate = appointments_booked > 0 ? parseFloat((no_shows / appointments_booked * 100).toFixed(1)) : 0;
    const closedDenominator = closed + meetings_done_not_interested + no_shows;
    const closed_rate = closedDenominator > 0 ? parseFloat((closed / closedDenominator * 100).toFixed(1)) : 0;

    // avg touchpoints for responded leads
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

    // Overdue
    const today = new Date().toISOString().slice(0, 10);
    const overdue_followups = leads.filter(l =>
      l.next_followup_date && l.next_followup_date < today &&
      !NOT_OVERDUE_STATUSES.includes(l.status)
    ).length;

    // by_status (current)
    const by_status = {};
    STATUSES.forEach(s => { by_status[s] = 0; });
    leads.forEach(l => { if (by_status.hasOwnProperty(l.status)) by_status[l.status]++; });

    // by_channel
    const by_channel = {};
    if (leadIds.length > 0) {
      db.prepare(`
        SELECT channel, COUNT(*) as cnt FROM outreach_touchpoints
        WHERE lead_id IN (${leadIds.map(() => '?').join(',')}) AND channel IS NOT NULL AND channel != ''
        GROUP BY channel ORDER BY cnt DESC
      `).all(...leadIds).forEach(r => { by_channel[r.channel] = r.cnt; });
    }

    // by_specialist
    const specialistMap = {};
    leads.forEach(l => {
      if (!specialistMap[l.specialist_id]) {
        specialistMap[l.specialist_id] = { name: l.specialist_name || 'Unknown', total: 0, closed: 0, responded: 0, booked: 0 };
      }
      specialistMap[l.specialist_id].total++;
      if (leadStatusSets[l.id] && leadStatusSets[l.id].has('Closed / Booked as Client')) specialistMap[l.specialist_id].closed++;
      if (hasAny(l.id, RESPONDED_OR_BEYOND)) specialistMap[l.specialist_id].responded++;
      if (hasAny(l.id, APPOINTMENT_OR_BEYOND)) specialistMap[l.specialist_id].booked++;
    });
    const by_specialist = Object.values(specialistMap).sort((a, b) => b.total - a.total);

    res.json({
      total_leads, total_contacted, responded, response_rate,
      interested, interested_rate,
      appointments_booked, leads_to_appointment_ratio,
      no_shows, no_show_rate,
      meetings_happened, closed, closed_rate,
      started_trial, disqualified,
      avg_touchpoints_before_response, overdue_followups,
      by_status, by_channel, by_specialist,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// ─── OVERDUE LEADS (for dashboard list) ──────────────────────────────────────

router.get('/overdue', (req, res) => {
  try {
    const { specialist_id } = req.query;
    const today = new Date().toISOString().slice(0, 10);
    const conditions = [`l.next_followup_date < ?`, `l.status NOT IN ('Closed / Booked as Client','Disqualified / Dead','Meeting Done - Not Interested')`];
    const params = [today];
    if (specialist_id) { conditions.push('l.specialist_id = ?'); params.push(specialist_id); }

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
    const { specialist_id, date_from, date_to, status } = req.query;
    const conditions = [];
    const params = [];
    if (specialist_id) { conditions.push('l.specialist_id = ?'); params.push(specialist_id); }
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
      SELECT l.*, s.name as specialist_name, i.name as industry_name
      FROM outreach_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      LEFT JOIN outreach_industries i ON i.id = l.industry_id
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
    const { specialist_id, date_from, date_to } = req.query;
    const conditions = [];
    const params = [];
    if (specialist_id) { conditions.push('l.specialist_id = ?'); params.push(specialist_id); }
    if (date_from) { conditions.push("date(l.created_at) >= ?"); params.push(date_from); }
    if (date_to) { conditions.push("date(l.created_at) <= ?"); params.push(date_to); }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const leads = db.prepare(`
      SELECT l.*, s.name as specialist_name, i.name as industry_name
      FROM outreach_leads l
      LEFT JOIN outreach_specialists s ON s.id = l.specialist_id
      LEFT JOIN outreach_industries i ON i.id = l.industry_id
      ${whereClause} ORDER BY l.created_at DESC
    `).all(...params);

    const byStatus = {};
    STATUSES.forEach(s => { byStatus[s] = 0; });
    leads.forEach(l => { if (byStatus.hasOwnProperty(l.status)) byStatus[l.status]++; });

    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const rows = STATUSES.map(s => `<tr><td>${s}</td><td style="text-align:right">${byStatus[s]}</td></tr>`).join('');

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
    const stages = db.prepare('SELECT * FROM outreach_pipeline_stages ORDER BY order_index ASC, id ASC').all();
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
    const maxOrder = db.prepare('SELECT MAX(order_index) as mx FROM outreach_pipeline_stages').get();
    const nextOrder = (maxOrder.mx || 0) + 1;
    const result = db.prepare('INSERT INTO outreach_pipeline_stages (name, order_index) VALUES (?, ?)').run(name.trim(), nextOrder);
    const created = db.prepare('SELECT * FROM outreach_pipeline_stages WHERE id = ?').get(result.lastInsertRowid);
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
    const existing = db.prepare('SELECT * FROM outreach_pipeline_stages WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Stage not found' });
    db.prepare(`
      UPDATE outreach_pipeline_stages SET
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
    const updated = db.prepare('SELECT * FROM outreach_pipeline_stages WHERE id = ?').get(id);
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

router.patch('/settings', (req, res) => {
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
    const lead = db.prepare('SELECT id FROM outreach_leads WHERE id = ?').get(leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
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
