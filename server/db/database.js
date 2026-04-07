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

  // ── Weekly Learning Tracker tables ──────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS learning_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS learning_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      role_id INTEGER REFERENCES learning_roles(id),
      manager_id INTEGER REFERENCES learning_users(id),
      joined_week TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS learning_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES learning_users(id),
      week TEXT NOT NULL,
      what_learned TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_detail TEXT,
      how_to_apply TEXT NOT NULL,
      is_late INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS learning_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL REFERENCES learning_entries(id),
      author_id INTEGER NOT NULL REFERENCES learning_users(id),
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS learning_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL
    );
  `);

  // Seed default learning settings
  db.prepare("INSERT OR IGNORE INTO learning_settings (key, value) VALUES ('deadline_day', 'Friday')").run();
  console.log('Learning tables initialized');

  // ── Outreach CRM tables ──────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS outreach_specialists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      manager_id INTEGER REFERENCES outreach_specialists(id),
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS outreach_industries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS outreach_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      specialist_id INTEGER NOT NULL REFERENCES outreach_specialists(id),
      company_name TEXT NOT NULL,
      contact_name TEXT,
      job_title TEXT,
      website TEXT,
      industry_id INTEGER REFERENCES outreach_industries(id),
      location TEXT,
      status TEXT NOT NULL DEFAULT 'Contacted',
      next_followup_date TEXT,
      status_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS outreach_touchpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES outreach_leads(id) ON DELETE CASCADE,
      touchpoint_number INTEGER NOT NULL,
      date TEXT,
      channel TEXT,
      message_body TEXT,
      loom_url TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(lead_id, touchpoint_number)
    );

    CREATE TABLE IF NOT EXISTS outreach_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES outreach_leads(id) ON DELETE CASCADE,
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS outreach_pipeline_stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS outreach_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS outreach_lead_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES outreach_leads(id) ON DELETE CASCADE,
      date TEXT,
      channel TEXT NOT NULL,
      message_body TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default industries if empty
  const industryCount = db.prepare('SELECT COUNT(*) as cnt FROM outreach_industries').get();
  if (industryCount.cnt === 0) {
    const insertIndustry = db.prepare('INSERT INTO outreach_industries (name) VALUES (?)');
    [
      'Home Services', 'HVAC', 'Plumbing', 'Roofing', 'Landscaping',
      'Dental Clinic', 'Chiropractic', 'Med Spa', 'Legal Services',
      'Real Estate', 'Financial Services', 'E-commerce', 'SaaS',
      'Fitness & Wellness', 'Education', 'Automotive', 'Other'
    ].forEach(name => insertIndustry.run(name));
    console.log('Seeded outreach industries');
  }
  // Seed pipeline stages if empty
  const stageCount = db.prepare('SELECT COUNT(*) as cnt FROM outreach_pipeline_stages').get();
  if (stageCount.cnt === 0) {
    const insertStage = db.prepare('INSERT INTO outreach_pipeline_stages (name, order_index) VALUES (?, ?)');
    [
      'New Lead', 'Touchpoint 1', 'Touchpoint 2', 'Touchpoint 3', 'Touchpoint 4', 'Touchpoint 5',
      'Responded', 'Interested', 'Appointment Booked', 'No Show',
      'Meeting Done - Not Interested', 'Started Trial',
      'Closed / Booked as Client', 'Disqualified / Dead',
    ].forEach((name, i) => insertStage.run(name, i + 1));
    console.log('Seeded outreach pipeline stages');
  }

  // Seed default outreach settings
  db.prepare("INSERT OR IGNORE INTO outreach_settings (key, value) VALUES ('max_touchpoints', '5')").run();

  console.log('Outreach tables initialized');

  // Column migrations — safe to run every startup (errors ignored if column exists)
  const columnMigrations = [
    'ALTER TABLE outreach_leads ADD COLUMN source_url TEXT',
    'ALTER TABLE outreach_leads ADD COLUMN source_image TEXT',
  ];
  // Migrate old 'Contacted' status to 'New Lead' (one-time)
  try { db.exec("UPDATE outreach_leads SET status = 'New Lead' WHERE status = 'Contacted'"); } catch (e) { /* ignore */ }
  try { db.exec("UPDATE outreach_status_history SET new_status = 'New Lead' WHERE new_status = 'Contacted'"); } catch (e) { /* ignore */ }
  columnMigrations.forEach(sql => {
    try { db.exec(sql); } catch (e) { /* column already exists */ }
  });

  // ── Facebook/Meta Ads tables ─────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS fb_media_buyers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fb_ad_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed fb_media_buyers from existing team_members if empty
  const fbBuyerCount = db.prepare('SELECT COUNT(*) as cnt FROM fb_media_buyers').get();
  if (fbBuyerCount.cnt === 0) {
    const members = db.prepare('SELECT name FROM team_members').all();
    const insertBuyer = db.prepare('INSERT OR IGNORE INTO fb_media_buyers (name) VALUES (?)');
    members.forEach(m => insertBuyer.run(m.name));
    console.log('Seeded fb_media_buyers');
  }

  // Seed fb_ad_accounts if empty
  const fbAcctCount = db.prepare('SELECT COUNT(*) as cnt FROM fb_ad_accounts').get();
  if (fbAcctCount.cnt === 0) {
    const insertAcct = db.prepare('INSERT INTO fb_ad_accounts (name) VALUES (?)');
    ['FB Account Alpha', 'FB Account Beta'].forEach(n => insertAcct.run(n));
    console.log('Seeded fb_ad_accounts');
  }
}

module.exports = { db, initializeDatabase };
