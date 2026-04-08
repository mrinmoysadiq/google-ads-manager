const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

const DEFAULT_STAGES = ['Assigned', 'In Progress', 'Notes Submitted', 'Assessed', 'Needs Revision', 'Completed'];

function getStages() {
  try {
    const rows = db.prepare('SELECT name FROM lms_stages WHERE active = 1 ORDER BY order_index ASC').all();
    return rows.length > 0 ? rows.map(r => r.name) : DEFAULT_STAGES;
  } catch { return DEFAULT_STAGES; }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseResources(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

// Convert stored notes content to HTML string (handles both old JSON array and new HTML format)
function parseNotesContent(raw) {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const items = parsed.filter(s => s && s.trim());
      if (items.length === 0) return '';
      return '<ul>' + items.map(s => `<li>${s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</li>`).join('') + '</ul>';
    }
  } catch {}
  return raw; // Already an HTML string
}

// Check if notes content is non-empty (handles both formats)
function hasNotesContent(raw) {
  if (!raw) return false;
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.some(s => s && s.trim());
  } catch {}
  return raw.replace(/<[^>]*>/g, '').trim().length > 0;
}

function today() {
  return new Date().toISOString().split('T')[0];
}

// ── Users ────────────────────────────────────────────────────────────────────

router.get('/users', (req, res) => {
  try {
    const users = db.prepare('SELECT * FROM lms_users WHERE active = 1 ORDER BY name ASC').all();
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/users/all', (req, res) => {
  try {
    const users = db.prepare('SELECT * FROM lms_users ORDER BY name ASC').all();
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/users/:id', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM lms_users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/users', (req, res) => {
  const { name, role = 'employee' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  if (!['employee', 'manager', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  try {
    const result = db.prepare('INSERT INTO lms_users (name, role) VALUES (?, ?)').run(name, role);
    res.json(db.prepare('SELECT * FROM lms_users WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Name already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.patch('/users/:id', (req, res) => {
  const { name, role, active } = req.body;
  const user = db.prepare('SELECT * FROM lms_users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (active === 0 || active === false) {
    const activeTopics = db.prepare(
      "SELECT COUNT(*) as cnt FROM lms_topics WHERE assignee_id = ? AND stage NOT IN ('Completed')"
    ).get(req.params.id);
    if (activeTopics.cnt > 0) {
      return res.status(400).json({ error: 'Cannot deactivate user with active topics' });
    }
  }

  try {
    db.prepare('UPDATE lms_users SET name = ?, role = ?, active = ? WHERE id = ?').run(
      name ?? user.name,
      role ?? user.role,
      active !== undefined ? (active ? 1 : 0) : user.active,
      req.params.id
    );
    res.json(db.prepare('SELECT * FROM lms_users WHERE id = ?').get(req.params.id));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Name already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/users/:id', (req, res) => {
  try {
    db.prepare('UPDATE lms_users SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Templates ─────────────────────────────────────────────────────────────────

router.get('/templates', (req, res) => {
  try {
    const templates = db.prepare('SELECT * FROM lms_templates ORDER BY created_at DESC').all();
    res.json(templates.map(t => ({ ...t, resources: parseResources(t.resources) })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/templates', (req, res) => {
  const { title, description, resources, suggested_days, created_by } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const result = db.prepare(
      'INSERT INTO lms_templates (title, description, resources, suggested_days, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(title, description || null, JSON.stringify(resources || []), suggested_days || null, created_by || null);
    const tpl = db.prepare('SELECT * FROM lms_templates WHERE id = ?').get(result.lastInsertRowid);
    res.json({ ...tpl, resources: parseResources(tpl.resources) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/templates/:id', (req, res) => {
  const tpl = db.prepare('SELECT * FROM lms_templates WHERE id = ?').get(req.params.id);
  if (!tpl) return res.status(404).json({ error: 'Template not found' });
  const { title, description, resources, suggested_days } = req.body;
  try {
    db.prepare(
      'UPDATE lms_templates SET title = ?, description = ?, resources = ?, suggested_days = ? WHERE id = ?'
    ).run(
      title ?? tpl.title,
      description !== undefined ? description : tpl.description,
      resources !== undefined ? JSON.stringify(resources) : tpl.resources,
      suggested_days !== undefined ? suggested_days : tpl.suggested_days,
      req.params.id
    );
    const updated = db.prepare('SELECT * FROM lms_templates WHERE id = ?').get(req.params.id);
    res.json({ ...updated, resources: parseResources(updated.resources) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/templates/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM lms_templates WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Topics ────────────────────────────────────────────────────────────────────

router.get('/topics', (req, res) => {
  const { assignee_id, stage, overdue } = req.query;
  let sql = `
    SELECT
      t.*,
      u1.name AS assignee_name,
      u2.name AS assigned_by_name,
      CASE WHEN n.id IS NOT NULL THEN 1 ELSE 0 END AS has_notes,
      a.star_rating AS latest_rating
    FROM lms_topics t
    LEFT JOIN lms_users u1 ON t.assignee_id = u1.id
    LEFT JOIN lms_users u2 ON t.assigned_by = u2.id
    LEFT JOIN lms_notes n ON n.topic_id = t.id
    LEFT JOIN (
      SELECT topic_id, star_rating FROM lms_assessments
      WHERE id IN (SELECT MAX(id) FROM lms_assessments GROUP BY topic_id)
    ) a ON a.topic_id = t.id
    WHERE 1=1
  `;
  const params = [];
  if (assignee_id) { sql += ' AND t.assignee_id = ?'; params.push(assignee_id); }
  if (stage) { sql += ' AND t.stage = ?'; params.push(stage); }
  if (overdue === 'true') { sql += " AND t.due_date < ? AND t.stage != 'Completed'"; params.push(today()); }
  sql += ' ORDER BY t.created_at DESC';
  try {
    const topics = db.prepare(sql).all(...params);
    res.json(topics.map(t => ({ ...t, resources: parseResources(t.resources) })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/topics/:id', (req, res) => {
  try {
    const topic = db.prepare(`
      SELECT t.*, u1.name AS assignee_name, u2.name AS assigned_by_name
      FROM lms_topics t
      LEFT JOIN lms_users u1 ON t.assignee_id = u1.id
      LEFT JOIN lms_users u2 ON t.assigned_by = u2.id
      WHERE t.id = ?
    `).get(req.params.id);
    if (!topic) return res.status(404).json({ error: 'Topic not found' });

    const notes = db.prepare('SELECT * FROM lms_notes WHERE topic_id = ?').get(req.params.id);
    const questions = db.prepare(`
      SELECT q.*, u.name AS answered_by_name
      FROM lms_questions q
      LEFT JOIN lms_users u ON q.answered_by = u.id
      WHERE q.topic_id = ? ORDER BY q.sort_order ASC, q.created_at ASC
    `).all(req.params.id);
    const assessments = db.prepare(`
      SELECT a.*, u.name AS assessor_name
      FROM lms_assessments a
      LEFT JOIN lms_users u ON a.assessor_id = u.id
      WHERE a.topic_id = ? ORDER BY a.assessed_at DESC
    `).all(req.params.id);
    const stageHistory = db.prepare(`
      SELECT h.*, u.name AS changed_by_name
      FROM lms_stage_history h
      LEFT JOIN lms_users u ON h.changed_by = u.id
      WHERE h.topic_id = ? ORDER BY h.changed_at DESC
    `).all(req.params.id);
    const comments = db.prepare(`
      SELECT c.*, u.name AS author_name, u.role AS author_role
      FROM lms_comments c
      LEFT JOIN lms_users u ON c.author_id = u.id
      WHERE c.topic_id = ? ORDER BY c.created_at ASC
    `).all(req.params.id);

    res.json({
      ...topic,
      resources: parseResources(topic.resources),
      notes: notes ? {
        ...notes,
        key_takeaways: parseNotesContent(notes.key_takeaways),
        how_to_apply: parseNotesContent(notes.how_to_apply),
      } : null,
      questions,
      assessments,
      stage_history: stageHistory,
      comments,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/topics', (req, res) => {
  const { title, description, resources, assignee_id, assigned_by, template_id, is_sequential, due_date } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  if (!assignee_id) return res.status(400).json({ error: 'assignee_id required' });
  try {
    const result = db.prepare(`
      INSERT INTO lms_topics (title, description, resources, assignee_id, assigned_by, template_id, is_sequential, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, description || null, JSON.stringify(resources || []), assignee_id,
           assigned_by || null, template_id || null, is_sequential ? 1 : 0, due_date || null);

    // Log initial stage
    db.prepare('INSERT INTO lms_stage_history (topic_id, old_stage, new_stage, changed_by) VALUES (?, ?, ?, ?)')
      .run(result.lastInsertRowid, null, 'Assigned', assigned_by || null);

    const topic = db.prepare('SELECT * FROM lms_topics WHERE id = ?').get(result.lastInsertRowid);
    res.json({ ...topic, resources: parseResources(topic.resources) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/topics/:id', (req, res) => {
  const topic = db.prepare('SELECT * FROM lms_topics WHERE id = ?').get(req.params.id);
  if (!topic) return res.status(404).json({ error: 'Topic not found' });
  const { title, description, resources, due_date, is_sequential } = req.body;
  try {
    db.prepare(`
      UPDATE lms_topics SET title=?, description=?, resources=?, due_date=?, is_sequential=? WHERE id=?
    `).run(
      title ?? topic.title,
      description !== undefined ? description : topic.description,
      resources !== undefined ? JSON.stringify(resources) : topic.resources,
      due_date !== undefined ? due_date : topic.due_date,
      is_sequential !== undefined ? (is_sequential ? 1 : 0) : topic.is_sequential,
      req.params.id
    );
    const updated = db.prepare('SELECT * FROM lms_topics WHERE id = ?').get(req.params.id);
    res.json({ ...updated, resources: parseResources(updated.resources) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/topics/:id/stage', (req, res) => {
  const { new_stage, changed_by, role } = req.body;
  const STAGES = getStages();
  if (!new_stage || !STAGES.includes(new_stage)) return res.status(400).json({ error: 'Invalid stage' });

  const topic = db.prepare('SELECT * FROM lms_topics WHERE id = ?').get(req.params.id);
  if (!topic) return res.status(404).json({ error: 'Topic not found' });

  // Employee stage transition rules
  if (role === 'employee') {
    const allowed = [
      ['Assigned', 'In Progress'],
      ['In Progress', 'Notes Submitted'],
    ];
    const isAllowed = allowed.some(([from, to]) => from === topic.stage && to === new_stage);
    if (!isAllowed) return res.status(403).json({ error: 'Employees can only advance one stage at a time' });
  }

  // Notes required for Notes Submitted
  if (new_stage === 'Notes Submitted') {
    const notes = db.prepare('SELECT * FROM lms_notes WHERE topic_id = ?').get(req.params.id);
    if (!notes || !hasNotesContent(notes.key_takeaways)) {
      return res.status(400).json({ error: 'Add at least one key takeaway before submitting' });
    }
  }

  try {
    db.prepare("UPDATE lms_topics SET stage=?, stage_updated_at=CURRENT_TIMESTAMP WHERE id=?").run(new_stage, req.params.id);
    db.prepare('INSERT INTO lms_stage_history (topic_id, old_stage, new_stage, changed_by) VALUES (?, ?, ?, ?)')
      .run(req.params.id, topic.stage, new_stage, changed_by || null);
    res.json(db.prepare('SELECT * FROM lms_topics WHERE id = ?').get(req.params.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/topics/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM lms_topics WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Notes ─────────────────────────────────────────────────────────────────────

router.get('/notes/:topicId', (req, res) => {
  try {
    const notes = db.prepare('SELECT * FROM lms_notes WHERE topic_id = ?').get(req.params.topicId);
    if (!notes) return res.json(null);
    res.json({
      ...notes,
      key_takeaways: parseNotesContent(notes.key_takeaways),
      how_to_apply: parseNotesContent(notes.how_to_apply),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/notes/:topicId', (req, res) => {
  const { key_takeaways, how_to_apply } = req.body;
  // Store as raw string (HTML or JSON) — let client decide format
  const ktStr = typeof key_takeaways === 'string' ? key_takeaways : JSON.stringify(key_takeaways || []);
  const htaStr = typeof how_to_apply === 'string' ? how_to_apply : JSON.stringify(how_to_apply || []);
  try {
    const existing = db.prepare('SELECT id FROM lms_notes WHERE topic_id = ?').get(req.params.topicId);
    if (existing) {
      db.prepare('UPDATE lms_notes SET key_takeaways=?, how_to_apply=?, updated_at=CURRENT_TIMESTAMP WHERE topic_id=?')
        .run(ktStr, htaStr, req.params.topicId);
    } else {
      db.prepare('INSERT INTO lms_notes (topic_id, key_takeaways, how_to_apply) VALUES (?, ?, ?)')
        .run(req.params.topicId, ktStr, htaStr);
    }
    const notes = db.prepare('SELECT * FROM lms_notes WHERE topic_id = ?').get(req.params.topicId);
    res.json({
      ...notes,
      key_takeaways: parseNotesContent(notes.key_takeaways),
      how_to_apply: parseNotesContent(notes.how_to_apply),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Questions ─────────────────────────────────────────────────────────────────

router.get('/questions/:topicId', (req, res) => {
  try {
    const questions = db.prepare(`
      SELECT q.*, u.name AS answered_by_name
      FROM lms_questions q
      LEFT JOIN lms_users u ON q.answered_by = u.id
      WHERE q.topic_id = ? ORDER BY q.sort_order ASC, q.created_at ASC
    `).all(req.params.topicId);
    res.json(questions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/questions/:topicId', (req, res) => {
  const { question_text, sort_order = 0 } = req.body;
  if (!question_text) return res.status(400).json({ error: 'question_text required' });
  try {
    const result = db.prepare('INSERT INTO lms_questions (topic_id, question_text, sort_order) VALUES (?, ?, ?)')
      .run(req.params.topicId, question_text, sort_order);
    res.json(db.prepare('SELECT * FROM lms_questions WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/questions/:questionId', (req, res) => {
  const q = db.prepare('SELECT * FROM lms_questions WHERE id = ?').get(req.params.questionId);
  if (!q) return res.status(404).json({ error: 'Question not found' });
  const { question_text, manager_answer, answered_by } = req.body;
  try {
    if (manager_answer !== undefined) {
      db.prepare('UPDATE lms_questions SET manager_answer=?, answered_at=CURRENT_TIMESTAMP, answered_by=? WHERE id=?')
        .run(manager_answer, answered_by || null, req.params.questionId);
    } else {
      db.prepare('UPDATE lms_questions SET question_text=? WHERE id=?').run(question_text ?? q.question_text, req.params.questionId);
    }
    const updated = db.prepare(`
      SELECT q.*, u.name AS answered_by_name FROM lms_questions q
      LEFT JOIN lms_users u ON q.answered_by = u.id WHERE q.id = ?
    `).get(req.params.questionId);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/questions/:questionId', (req, res) => {
  try {
    db.prepare('DELETE FROM lms_questions WHERE id = ?').run(req.params.questionId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Assessments ───────────────────────────────────────────────────────────────

router.get('/assessments/:topicId', (req, res) => {
  try {
    const assessments = db.prepare(`
      SELECT a.*, u.name AS assessor_name FROM lms_assessments a
      LEFT JOIN lms_users u ON a.assessor_id = u.id
      WHERE a.topic_id = ? ORDER BY a.assessed_at DESC
    `).all(req.params.topicId);
    res.json(assessments);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/assessments', (req, res) => {
  const { topic_id, assessor_id, star_rating, feedback, decision } = req.body;
  if (!topic_id || !assessor_id || !star_rating || !feedback || !decision)
    return res.status(400).json({ error: 'All fields required' });
  if (!['completed', 'needs_revision'].includes(decision))
    return res.status(400).json({ error: 'Invalid decision' });

  const topic = db.prepare('SELECT * FROM lms_topics WHERE id = ?').get(topic_id);
  if (!topic) return res.status(404).json({ error: 'Topic not found' });

  const newStage = decision === 'completed' ? 'Completed' : 'Needs Revision';

  try {
    const result = db.prepare(
      'INSERT INTO lms_assessments (topic_id, assessor_id, star_rating, feedback, decision) VALUES (?, ?, ?, ?, ?)'
    ).run(topic_id, assessor_id, star_rating, feedback, decision);

    db.prepare("UPDATE lms_topics SET stage=?, stage_updated_at=CURRENT_TIMESTAMP WHERE id=?").run(newStage, topic_id);
    db.prepare('INSERT INTO lms_stage_history (topic_id, old_stage, new_stage, changed_by) VALUES (?, ?, ?, ?)')
      .run(topic_id, topic.stage, newStage, assessor_id);

    res.json(db.prepare('SELECT * FROM lms_assessments WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Comments ──────────────────────────────────────────────────────────────────

router.get('/comments/:topicId', (req, res) => {
  try {
    const topic = db.prepare('SELECT stage FROM lms_topics WHERE id = ?').get(req.params.topicId);
    if (!topic) return res.status(404).json({ error: 'Topic not found' });
    if (['Assigned', 'In Progress'].includes(topic.stage)) {
      return res.status(403).json({ error: 'Discussion locked until notes are submitted' });
    }
    const comments = db.prepare(`
      SELECT c.*, u.name AS author_name, u.role AS author_role
      FROM lms_comments c
      LEFT JOIN lms_users u ON c.author_id = u.id
      WHERE c.topic_id = ? ORDER BY c.created_at ASC
    `).all(req.params.topicId);
    res.json(comments);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/comments', (req, res) => {
  const { topic_id, author_id, message } = req.body;
  if (!topic_id || !author_id || !message) return res.status(400).json({ error: 'All fields required' });
  try {
    const result = db.prepare('INSERT INTO lms_comments (topic_id, author_id, message) VALUES (?, ?, ?)')
      .run(topic_id, author_id, message);
    const comment = db.prepare(`
      SELECT c.*, u.name AS author_name, u.role AS author_role
      FROM lms_comments c LEFT JOIN lms_users u ON c.author_id = u.id WHERE c.id = ?
    `).get(result.lastInsertRowid);
    res.json(comment);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

router.get('/dashboard', (req, res) => {
  const { user_id } = req.query;
  const todayStr = today();

  try {
    function getStatsForUser(uid) {
      const filter = uid ? 'WHERE t.assignee_id = ?' : 'WHERE 1=1';
      const params = uid ? [uid] : [];

      const rows = db.prepare(`SELECT t.*, u.name as assignee_name FROM lms_topics t LEFT JOIN lms_users u ON t.assignee_id = u.id ${filter}`).all(...params);

      const total = rows.length;
      const completed = rows.filter(r => r.stage === 'Completed').length;
      const in_progress = rows.filter(r => r.stage === 'In Progress').length;
      const overdue = rows.filter(r => r.due_date && r.due_date < todayStr && r.stage !== 'Completed').length;
      const needs_revision = rows.filter(r => r.stage === 'Needs Revision').length;

      const topicIds = rows.map(r => r.id);
      let avgRating = 0;
      let revisionRate = 0;
      if (topicIds.length > 0) {
        const placeholders = topicIds.map(() => '?').join(',');
        const ratings = db.prepare(`SELECT AVG(star_rating) as avg FROM lms_assessments WHERE topic_id IN (${placeholders})`).get(...topicIds);
        avgRating = ratings.avg ? Math.round(ratings.avg * 10) / 10 : 0;

        const totalAssessed = db.prepare(`SELECT COUNT(DISTINCT topic_id) as cnt FROM lms_assessments WHERE topic_id IN (${placeholders})`).get(...topicIds).cnt;
        const revisedCount = db.prepare(`SELECT COUNT(DISTINCT topic_id) as cnt FROM lms_stage_history WHERE topic_id IN (${placeholders}) AND new_stage = 'Needs Revision'`).get(...topicIds).cnt;
        revisionRate = totalAssessed > 0 ? Math.round((revisedCount / totalAssessed) * 100) : 0;
      }

      const byStage = {};
      const STAGES = getStages();
      STAGES.forEach(s => { byStage[s] = rows.filter(r => r.stage === s).length; });

      const overdueTopics = rows
        .filter(r => r.due_date && r.due_date < todayStr && r.stage !== 'Completed')
        .map(r => ({ id: r.id, title: r.title, due_date: r.due_date, stage: r.stage, assignee_name: r.assignee_name }));

      return {
        total_assigned: total,
        completed,
        completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
        in_progress,
        overdue,
        needs_revision,
        avg_star_rating: avgRating,
        revision_rate: revisionRate,
        by_stage: byStage,
        overdue_topics: overdueTopics,
      };
    }

    if (user_id) {
      return res.json(getStatsForUser(user_id));
    }

    // Manager view — aggregate + per-employee
    const aggregate = getStatsForUser(null);
    const employees = db.prepare("SELECT * FROM lms_users WHERE role = 'employee' AND active = 1").all();
    const employeeStats = employees.map(emp => {
      const s = getStatsForUser(emp.id);
      return {
        user_id: emp.id,
        name: emp.name,
        total: s.total_assigned,
        completed: s.completed,
        completion_rate: s.completion_rate,
        overdue: s.overdue,
        avg_rating: s.avg_star_rating,
        revision_rate: s.revision_rate,
      };
    });

    res.json({ ...aggregate, employees: employeeStats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Pipeline Stages ───────────────────────────────────────────────────────────

router.get('/stages', (req, res) => {
  try {
    const stages = db.prepare('SELECT * FROM lms_stages ORDER BY order_index ASC').all();
    res.json(stages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/stages', (req, res) => {
  const { name, color = '#8a8680' } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });
  try {
    const maxOrder = db.prepare('SELECT MAX(order_index) as m FROM lms_stages').get().m || 0;
    const result = db.prepare('INSERT INTO lms_stages (name, color, order_index) VALUES (?, ?, ?)').run(name.trim(), color, maxOrder + 1);
    res.json(db.prepare('SELECT * FROM lms_stages WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Stage name already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.patch('/stages/:id', (req, res) => {
  const stage = db.prepare('SELECT * FROM lms_stages WHERE id = ?').get(req.params.id);
  if (!stage) return res.status(404).json({ error: 'Stage not found' });
  const { name, color, order_index, active } = req.body;
  try {
    db.prepare('UPDATE lms_stages SET name=?, color=?, order_index=?, active=? WHERE id=?').run(
      name !== undefined ? name : stage.name,
      color !== undefined ? color : stage.color,
      order_index !== undefined ? order_index : stage.order_index,
      active !== undefined ? (active ? 1 : 0) : stage.active,
      req.params.id
    );
    res.json(db.prepare('SELECT * FROM lms_stages WHERE id = ?').get(req.params.id));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Stage name already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/stages/:id', (req, res) => {
  const stage = db.prepare('SELECT * FROM lms_stages WHERE id = ?').get(req.params.id);
  if (!stage) return res.status(404).json({ error: 'Stage not found' });
  const topicsInStage = db.prepare('SELECT COUNT(*) as cnt FROM lms_topics WHERE stage = ?').get(stage.name);
  if (topicsInStage.cnt > 0) return res.status(400).json({ error: `Cannot delete stage with ${topicsInStage.cnt} active topic(s)` });
  try {
    db.prepare('DELETE FROM lms_stages WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
