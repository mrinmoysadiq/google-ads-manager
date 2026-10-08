const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const { db } = require('../db/database');
const { generateToken, hashToken } = require('../mcp/tokens');
const SECRET = process.env.JWT_SECRET || 'infinix_secret_key_v2';

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const user = db.prepare('SELECT * FROM app_users WHERE username = ? AND active = 1').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!bcryptjs.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET, { expiresIn: '24h' });
  const { password_hash, ...userOut } = user;
  res.json({ token, user: userOut });
});

router.get('/me', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT id,name,username,designation,role,avatar_url,active,created_at FROM app_users WHERE id=?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json(user);
  } catch { res.status(401).json({ error: 'Invalid token' }); }
});

// Self-service profile update (name, designation, password)
router.patch('/profile', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT * FROM app_users WHERE id=?').get(payload.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { name, designation, password, avatar_url } = req.body;
    const newName = (name || '').trim() || user.name;
    const newDesig = designation !== undefined ? (designation || '').trim() : user.designation;
    const newAvatar = avatar_url !== undefined ? (avatar_url || null) : user.avatar_url;
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      const hash = bcryptjs.hashSync(password, 10);
      db.prepare('UPDATE app_users SET name=?,designation=?,password_hash=?,avatar_url=? WHERE id=?').run(newName, newDesig, hash, newAvatar, payload.id);
    } else {
      db.prepare('UPDATE app_users SET name=?,designation=?,avatar_url=? WHERE id=?').run(newName, newDesig, newAvatar, payload.id);
    }
    const updated = db.prepare('SELECT id,name,username,designation,role,avatar_url,active,created_at FROM app_users WHERE id=?').get(payload.id);
    res.json(updated);
  } catch { res.status(401).json({ error: 'Invalid token' }); }
});

// ─── MCP connector tokens ─────────────────────────────────────────────────────
// Each token gives the Claude app access to the Outreach CRM as this user,
// via the connector URL /mcp/<token>. Only the hash is stored.

function requireUser(req, res) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) { res.status(401).json({ error: 'No token' }); return null; }
  try {
    const payload = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT id, name, role FROM app_users WHERE id = ? AND active = 1').get(payload.id);
    if (!user) { res.status(401).json({ error: 'User not found' }); return null; }
    return user;
  } catch { res.status(401).json({ error: 'Invalid token' }); return null; }
}

router.get('/mcp-tokens', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const tokens = db.prepare(`
    SELECT id, label, created_at, last_used_at FROM mcp_tokens
    WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC
  `).all(user.id);
  res.json(tokens);
});

router.post('/mcp-tokens', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const raw = generateToken();
  const label = (req.body?.label || '').trim() || 'Claude';
  const result = db.prepare('INSERT INTO mcp_tokens (user_id, token_hash, label) VALUES (?, ?, ?)')
    .run(user.id, hashToken(raw), label);
  const proto = (req.headers['x-forwarded-proto'] || req.protocol).split(',')[0].trim();
  const url = `${proto}://${req.get('host')}/mcp/${raw}`;
  res.status(201).json({ id: result.lastInsertRowid, label, url });
});

router.delete('/mcp-tokens/:id', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const result = db.prepare(`
    UPDATE mcp_tokens SET revoked_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND revoked_at IS NULL
  `).run(req.params.id, user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Token not found' });
  res.json({ success: true });
});

module.exports = router;
