const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Use persistent disk path on Render (/var/data), fallback to local for development
const dbDir = process.env.RENDER ? '/var/data' : path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'ads_manager.db');
console.log(`Database path: ${dbPath}`);
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_member TEXT NOT NULL,
      account_name TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT DEFAULT 'in_progress',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS slide_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      slide_number INTEGER NOT NULL,
      section_name TEXT NOT NULL,
      field_key TEXT NOT NULL,
      field_value TEXT,
      saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS change_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      team_member TEXT NOT NULL,
      account_name TEXT NOT NULL,
      date TEXT NOT NULL,
      section TEXT NOT NULL,
      change_type TEXT NOT NULL,
      changes_made_note TEXT,
      keywords_paused TEXT,
      pause_reason TEXT,
      keywords_added TEXT,
      add_match_type TEXT,
      add_reason TEXT,
      ads_paused TEXT,
      ads_created TEXT,
      ad_change_reason TEXT,
      audiences_adjusted TEXT,
      bid_changes TEXT,
      other_targeting TEXT,
      targeting_reason TEXT,
      disapproved_asset_type TEXT,
      disapproved_asset_issue TEXT,
      disapproved_asset_action TEXT,
      account_sitelink_issues TEXT,
      account_sitelink_action TEXT,
      campaign_sitelink_issues TEXT,
      campaign_sitelink_action TEXT,
      lp_issue_description TEXT,
      lp_escalated_to TEXT,
      lp_issue_status TEXT,
      asset_status_snapshot TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add new columns to change_log if they don't exist (for existing deployments)
  const newCols = [
    'disapproved_asset_type TEXT',
    'disapproved_asset_issue TEXT',
    'disapproved_asset_action TEXT',
    'account_sitelink_issues TEXT',
    'account_sitelink_action TEXT',
    'campaign_sitelink_issues TEXT',
    'campaign_sitelink_action TEXT',
    'lp_issue_description TEXT',
    'lp_escalated_to TEXT',
    'lp_issue_status TEXT',
    'asset_status_snapshot TEXT',
  ];
  newCols.forEach(col => {
    const colName = col.split(' ')[0];
    try {
      db.exec(`ALTER TABLE change_log ADD COLUMN ${col}`);
    } catch(e) {
      // Column already exists, ignore
    }
  });

  // Seed accounts if empty
  const accountCount = db.prepare('SELECT COUNT(*) as cnt FROM accounts').get();
  if (accountCount.cnt === 0) {
    const insertAccount = db.prepare('INSERT INTO accounts (name) VALUES (?)');
    ['Client Alpha', 'Client Beta', 'Client Gamma', 'Client Delta', 'Client Epsilon'].forEach(name => {
      insertAccount.run(name);
    });
    console.log('Seeded accounts');
  }

  // Seed team members if empty
  const memberCount = db.prepare('SELECT COUNT(*) as cnt FROM team_members').get();
  if (memberCount.cnt === 0) {
    const insertMember = db.prepare('INSERT INTO team_members (name) VALUES (?)');
    ['Alex', 'Maria', 'James', 'Sara', 'David'].forEach(name => {
      insertMember.run(name);
    });
    console.log('Seeded team members');
  }
}

module.exports = { db, initializeDatabase };
