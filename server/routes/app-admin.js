const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const { db } = require('../db/database');
const SECRET = process.env.JWT_SECRET || 'infinix_secret_key_v2';

function adminOnly(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, SECRET);
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    req.user = payload;
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

router.get('/users', adminOnly, (req, res) => {
  const users = db.prepare('SELECT id,name,username,designation,role,avatar_url,active,created_at FROM app_users ORDER BY id ASC').all();
  res.json(users);
});

router.post('/users', adminOnly, (req, res) => {
  const { name, username, password, designation, role = 'user', avatar_url } = req.body;
  if (!name || !username || !password) return res.status(400).json({ error: 'name, username, password required' });
  if (db.prepare('SELECT id FROM app_users WHERE username=?').get(username)) return res.status(409).json({ error: 'Username already taken' });
  const hash = bcryptjs.hashSync(password, 10);
  const r = db.prepare('INSERT INTO app_users (name,username,password_hash,designation,role,avatar_url) VALUES (?,?,?,?,?,?)').run(name, username, hash, designation||null, role, avatar_url||null);
  const user = db.prepare('SELECT id,name,username,designation,role,avatar_url,active,created_at FROM app_users WHERE id=?').get(r.lastInsertRowid);
  res.status(201).json(user);
});

router.patch('/users/:id', adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const { name, username, password, designation, role, avatar_url, active } = req.body;
  const user = db.prepare('SELECT * FROM app_users WHERE id=?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (id === req.user.id && active === 0) return res.status(400).json({ error: 'Cannot deactivate your own account' });
  if (username && username !== user.username && db.prepare('SELECT id FROM app_users WHERE username=? AND id!=?').get(username, id)) return res.status(409).json({ error: 'Username already taken' });
  const n = name ?? user.name, u = username ?? user.username, d = designation !== undefined ? designation : user.designation;
  const ro = role ?? user.role, av = avatar_url !== undefined ? avatar_url : user.avatar_url, ac = active !== undefined ? active : user.active;
  if (password) {
    db.prepare('UPDATE app_users SET name=?,username=?,password_hash=?,designation=?,role=?,avatar_url=?,active=? WHERE id=?').run(n,u,bcryptjs.hashSync(password,10),d,ro,av,ac,id);
  } else {
    db.prepare('UPDATE app_users SET name=?,username=?,designation=?,role=?,avatar_url=?,active=? WHERE id=?').run(n,u,d,ro,av,ac,id);
  }
  res.json(db.prepare('SELECT id,name,username,designation,role,avatar_url,active,created_at FROM app_users WHERE id=?').get(id));
});

router.delete('/users/:id', adminOnly, (req, res) => {
  const id = Number(req.params.id);
  if (id === 1) return res.status(400).json({ error: 'Cannot delete super-admin' });
  if (!db.prepare('SELECT id FROM app_users WHERE id=?').get(id)) return res.status(404).json({ error: 'User not found' });
  db.prepare('DELETE FROM app_users WHERE id=?').run(id);
  res.json({ success: true });
});

module.exports = router;
