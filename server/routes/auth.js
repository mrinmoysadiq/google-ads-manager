const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const { db } = require('../db/database');
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

module.exports = router;
