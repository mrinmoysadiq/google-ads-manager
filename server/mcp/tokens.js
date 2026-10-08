const crypto = require('crypto');
const { db } = require('../db/database');

function generateToken() {
  return 'gam_' + crypto.randomBytes(32).toString('hex');
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Returns the active app_user for a raw connector token, or null.
function resolveTokenUser(raw) {
  if (!raw || !raw.startsWith('gam_')) return null;
  const row = db.prepare(`
    SELECT t.id as token_id, u.id, u.name, u.username, u.role
    FROM mcp_tokens t JOIN app_users u ON u.id = t.user_id
    WHERE t.token_hash = ? AND t.revoked_at IS NULL AND u.active = 1
  `).get(hashToken(raw));
  if (!row) return null;
  db.prepare('UPDATE mcp_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.token_id);
  return row;
}

module.exports = { generateToken, hashToken, resolveTokenUser };
