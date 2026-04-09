const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const { db } = require('../db/database');
const SECRET = process.env.JWT_SECRET || 'infinix_secret_key';

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const user = db.prepare('SELECT * FROM app_users WHERE username = ? AND active = 1').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!bcryptjs.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET, { expiresIn: '100y' });
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

module.exports = router;
