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

    CREATE TABLE IF NOT EXISTS outreach_lead_specialists (
      lead_id INTEGER NOT NULL REFERENCES outreach_leads(id) ON DELETE CASCADE,
      specialist_id INTEGER NOT NULL REFERENCES outreach_specialists(id) ON DELETE CASCADE,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (lead_id, specialist_id)
    );

    CREATE TABLE IF NOT EXISTS outreach_dashboard_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      card_type TEXT NOT NULL DEFAULT 'count',
      numerator_statuses TEXT NOT NULL DEFAULT '[]',
      denominator TEXT NOT NULL DEFAULT 'total',
      color TEXT DEFAULT '#575ECF',
      sort_order INTEGER DEFAULT 0
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

  // Seed default dashboard metric cards if none exist
  const dashCardCount = db.prepare('SELECT COUNT(*) as cnt FROM outreach_dashboard_cards').get();
  if (dashCardCount.cnt === 0) {
    const RESPONDED_S    = JSON.stringify(['Interested','Not Interested','Not interested','Appointment Booked','No Show','Meeting Done - Not Interested','Started Trial','Closed / Booked as Client']);
    const INTERESTED_S   = JSON.stringify(['Interested','Appointment Booked','No Show','Meeting Done - Not Interested','Started Trial','Closed / Booked as Client']);
    const APPOINTMENT_S  = JSON.stringify(['Appointment Booked','No Show','Meeting Done - Not Interested','Started Trial','Closed / Booked as Client']);
    const NO_SHOW_S      = JSON.stringify(['No Show']);
    const CLOSED_S       = JSON.stringify(['Closed / Booked as Client']);
    const TRIAL_S        = JSON.stringify(['Started Trial']);
    const insertCard = db.prepare('INSERT INTO outreach_dashboard_cards (label, card_type, numerator_statuses, denominator, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
    [
      ['Total Leads',     'count', '[]',          'total',         '#8a8680',  0],
      ['Responded',       'count', RESPONDED_S,   'total',         '#3b82f6',  1],
      ['Response Rate',   'rate',  RESPONDED_S,   'total',         '#3b82f6',  2],
      ['Interested',      'count', INTERESTED_S,  RESPONDED_S,     '#a855f7',  3],
      ['Interest Rate',   'rate',  INTERESTED_S,  RESPONDED_S,     '#a855f7',  4],
      ['Appts Booked',    'count', APPOINTMENT_S, INTERESTED_S,    '#f59e0b',  5],
      ['Appt Rate',       'rate',  APPOINTMENT_S, INTERESTED_S,    '#f59e0b',  6],
      ['No Shows',        'count', NO_SHOW_S,     APPOINTMENT_S,   '#ef4444',  7],
      ['No Show Rate',    'rate',  NO_SHOW_S,     APPOINTMENT_S,   '#ef4444',  8],
      ['Closed',          'count', CLOSED_S,      APPOINTMENT_S,   '#22c55e',  9],
      ['Close Rate',      'rate',  CLOSED_S,      APPOINTMENT_S,   '#22c55e', 10],
      ['Started Trial',   'count', TRIAL_S,       'total',         '#06b6d4', 11],
    ].forEach(([label, card_type, numerator_statuses, denominator, color, sort_order]) => {
      insertCard.run(label, card_type, numerator_statuses, denominator, color, sort_order);
    });
    console.log('Seeded default dashboard cards');
  }

  // Seed default outreach settings
  db.prepare("INSERT OR IGNORE INTO outreach_settings (key, value) VALUES ('max_touchpoints', '5')").run();

  console.log('Outreach tables initialized');

  // ── LinkedIn Reach Out Tracker tables ────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS linkedin_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      specialist_id INTEGER NOT NULL REFERENCES outreach_specialists(id),
      lead_name TEXT NOT NULL,
      linkedin_profile_url TEXT,
      activity_url TEXT,
      company_name TEXT,
      job_title TEXT,
      industry_id INTEGER REFERENCES outreach_industries(id),
      location TEXT,
      follower_count INTEGER,
      connection_degree TEXT,
      status TEXT NOT NULL DEFAULT 'Identified',
      last_connected_date TEXT,
      next_action_date TEXT,
      notes TEXT,
      source_url TEXT,
      source_image TEXT,
      status_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS linkedin_engagements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES linkedin_leads(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      post_url TEXT,
      liked INTEGER DEFAULT 0,
      commented INTEGER DEFAULT 0,
      comment_text TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS linkedin_pipeline_stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      active INTEGER DEFAULT 1,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS linkedin_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES linkedin_leads(id) ON DELETE CASCADE,
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      performed_by TEXT
    );

    CREATE TABLE IF NOT EXISTS linkedin_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS linkedin_dashboard_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      card_type TEXT NOT NULL DEFAULT 'count',
      numerator_statuses TEXT NOT NULL DEFAULT '[]',
      denominator TEXT NOT NULL DEFAULT 'total',
      color TEXT DEFAULT '#0a66c2',
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS linkedin_followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES linkedin_leads(id) ON DELETE CASCADE,
      stage_key TEXT NOT NULL,
      date TEXT,
      message_body TEXT,
      is_seen INTEGER DEFAULT 0,
      seen_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(lead_id, stage_key)
    );

    CREATE TABLE IF NOT EXISTS linkedin_lead_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES linkedin_leads(id) ON DELETE CASCADE,
      date TEXT,
      channel TEXT NOT NULL DEFAULT 'LinkedIn',
      screenshot TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default LinkedIn pipeline stages
  const liStageCount = db.prepare('SELECT COUNT(*) as cnt FROM linkedin_pipeline_stages').get();
  if (liStageCount.cnt === 0) {
    const insertLiStage = db.prepare('INSERT INTO linkedin_pipeline_stages (name, order_index, is_default) VALUES (?, ?, ?)');
    [
      'Identified', 'Connection Request Sent', 'Connected', 'Engaging (Warming Up)',
      'Ready to Message', 'Follow-up 1', 'Follow-up 2', 'Follow-up 3', 'Follow-up 4',
      'Emailed', 'Replied', 'Meeting Booked', 'Started Trial', 'Closed / Booked as Client',
      'No Response / Dead', 'Disqualified',
    ].forEach((name, i) => insertLiStage.run(name, i + 1, name === 'Identified' ? 1 : 0));
    console.log('Seeded LinkedIn pipeline stages');
  }

  // One-time migration: replace old single 'Message Sent' stage with 4 follow-up stages
  try {
    const oldStage = db.prepare("SELECT * FROM linkedin_pipeline_stages WHERE name = 'Message Sent'").get();
    const alreadyMigrated = db.prepare("SELECT 1 FROM linkedin_pipeline_stages WHERE name = 'Follow-up 1'").get();
    if (oldStage && !alreadyMigrated) {
      // Shift every stage after 'Message Sent' down by 3 to make room for 4 stages in its place
      db.prepare('UPDATE linkedin_pipeline_stages SET order_index = order_index + 3 WHERE order_index > ?').run(oldStage.order_index);
      db.prepare("UPDATE linkedin_pipeline_stages SET name = 'Follow-up 1' WHERE id = ?").run(oldStage.id);
      const insertFollowup = db.prepare('INSERT INTO linkedin_pipeline_stages (name, order_index) VALUES (?, ?)');
      insertFollowup.run('Follow-up 2', oldStage.order_index + 1);
      insertFollowup.run('Follow-up 3', oldStage.order_index + 2);
      insertFollowup.run('Follow-up 4', oldStage.order_index + 3);
      // Move any leads already on the old stage onto Follow-up 1
      db.exec("UPDATE linkedin_leads SET status = 'Follow-up 1' WHERE status = 'Message Sent'");
      db.exec("UPDATE linkedin_status_history SET new_status = 'Follow-up 1' WHERE new_status = 'Message Sent'");
      console.log('Migrated LinkedIn "Message Sent" stage into 4 follow-up stages');
    }
    // Fix up any dashboard cards whose formula referenced the old stage name
    const cards = db.prepare('SELECT * FROM linkedin_dashboard_cards').all();
    const updateCard = db.prepare('UPDATE linkedin_dashboard_cards SET numerator_statuses = ?, denominator = ? WHERE id = ?');
    const replaceStage = (arr) => arr.flatMap(s => s === 'Message Sent' ? ['Follow-up 1', 'Follow-up 2', 'Follow-up 3', 'Follow-up 4'] : [s]);
    cards.forEach(c => {
      let num, den, changed = false;
      try { num = JSON.parse(c.numerator_statuses || '[]'); } catch { num = []; }
      if (num.includes('Message Sent')) { num = replaceStage(num); changed = true; }
      try { den = JSON.parse(c.denominator); } catch { den = c.denominator; }
      if (Array.isArray(den) && den.includes('Message Sent')) { den = replaceStage(den); changed = true; }
      if (changed) updateCard.run(JSON.stringify(num), Array.isArray(den) ? JSON.stringify(den) : (den || 'total'), c.id);
    });
  } catch (e) { /* ignore */ }

  // One-time migration: insert 'Emailed' stage right before 'Replied' (existing installs only)
  try {
    const repliedStage = db.prepare("SELECT * FROM linkedin_pipeline_stages WHERE name = 'Replied'").get();
    const alreadyHasEmailed = db.prepare("SELECT 1 FROM linkedin_pipeline_stages WHERE name = 'Emailed'").get();
    if (repliedStage && !alreadyHasEmailed) {
      db.prepare('UPDATE linkedin_pipeline_stages SET order_index = order_index + 1 WHERE order_index >= ?').run(repliedStage.order_index);
      db.prepare('INSERT INTO linkedin_pipeline_stages (name, order_index) VALUES (?, ?)').run('Emailed', repliedStage.order_index);
      console.log('Inserted LinkedIn "Emailed" stage before "Replied"');
    }
  } catch (e) { /* ignore */ }

  // Seed default LinkedIn settings
  db.prepare("INSERT OR IGNORE INTO linkedin_settings (key, value) VALUES ('warmup_threshold', '3')").run();
  db.prepare("INSERT OR IGNORE INTO linkedin_settings (key, value) VALUES ('engagement_reminder_days', '14')").run();

  // Seed default LinkedIn dashboard cards
  const liCardCount = db.prepare('SELECT COUNT(*) as cnt FROM linkedin_dashboard_cards').get();
  if (liCardCount.cnt === 0) {
    const FOLLOWUP_STAGES = ['Follow-up 1', 'Follow-up 2', 'Follow-up 3', 'Follow-up 4'];
    const CONNECTED_S = JSON.stringify(['Connected', 'Engaging (Warming Up)', 'Ready to Message', ...FOLLOWUP_STAGES, 'Replied', 'Meeting Booked', 'Started Trial', 'Closed / Booked as Client']);
    const MESSAGED_S  = JSON.stringify([...FOLLOWUP_STAGES, 'Replied', 'Meeting Booked', 'Started Trial', 'Closed / Booked as Client']);
    const REPLIED_S   = JSON.stringify(['Replied', 'Meeting Booked', 'Started Trial', 'Closed / Booked as Client']);
    const BOOKED_S    = JSON.stringify(['Meeting Booked', 'Started Trial', 'Closed / Booked as Client']);
    const CLOSED_S    = JSON.stringify(['Closed / Booked as Client']);
    const insertLiCard = db.prepare('INSERT INTO linkedin_dashboard_cards (label, card_type, numerator_statuses, denominator, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
    [
      ['Total Leads',     'count', '[]',         'total',      '#8a8680', 0],
      ['Connected',       'count', CONNECTED_S,  'total',      '#0a66c2', 1],
      ['Connection Rate', 'rate',  CONNECTED_S,  'total',      '#0a66c2', 2],
      ['Messaged',        'count', MESSAGED_S,   CONNECTED_S,  '#3b82f6', 3],
      ['Reply Rate',      'rate',  REPLIED_S,    MESSAGED_S,   '#a855f7', 4],
      ['Meetings Booked', 'count', BOOKED_S,     REPLIED_S,    '#f59e0b', 5],
      ['Closed',          'count', CLOSED_S,     BOOKED_S,     '#22c55e', 6],
    ].forEach(([label, card_type, numerator_statuses, denominator, color, sort_order]) => {
      insertLiCard.run(label, card_type, numerator_statuses, denominator, color, sort_order);
    });
    console.log('Seeded LinkedIn dashboard cards');
  }

  console.log('LinkedIn tracker tables initialized');

  // ── Facebook custom fields tables ────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS fb_account_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      field_key TEXT NOT NULL UNIQUE,
      field_type TEXT NOT NULL DEFAULT 'text',
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fb_account_field_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES fb_ad_accounts(id) ON DELETE CASCADE,
      field_key TEXT NOT NULL,
      value TEXT,
      UNIQUE(account_id, field_key)
    );
  `);

  // Column migrations — safe to run every startup (errors ignored if column exists)
  const columnMigrations = [
    'ALTER TABLE outreach_leads ADD COLUMN source_url TEXT',
    'ALTER TABLE outreach_leads ADD COLUMN source_image TEXT',
    'ALTER TABLE outreach_leads ADD COLUMN email TEXT',
    'ALTER TABLE outreach_leads ADD COLUMN phone TEXT',
    'ALTER TABLE outreach_leads ADD COLUMN fb_page_url TEXT',
    'ALTER TABLE outreach_leads ADD COLUMN ig_url TEXT',
    'ALTER TABLE outreach_status_history ADD COLUMN performed_by TEXT',
    'ALTER TABLE fb_ad_accounts ADD COLUMN website TEXT',
    'ALTER TABLE fb_ad_accounts ADD COLUMN notes TEXT',
    'ALTER TABLE fb_account_fields ADD COLUMN options TEXT',
    'ALTER TABLE fb_account_fields ADD COLUMN pinned INTEGER DEFAULT 0',
    'ALTER TABLE fb_account_fields ADD COLUMN sort_order INTEGER DEFAULT 0',
    'ALTER TABLE fb_audit_sessions ADD COLUMN performance_data TEXT',
    'ALTER TABLE fb_audit_sessions ADD COLUMN flagged_ads TEXT',
    'ALTER TABLE fb_audit_sessions ADD COLUMN deleted_at TEXT DEFAULT NULL',
    'ALTER TABLE fb_ad_accounts ADD COLUMN deleted_at TEXT DEFAULT NULL',
    'ALTER TABLE outreach_leads ADD COLUMN deleted_at TEXT DEFAULT NULL',
    'ALTER TABLE linkedin_pipeline_stages ADD COLUMN is_default INTEGER DEFAULT 0',
    "ALTER TABLE linkedin_leads ADD COLUMN connection_status TEXT DEFAULT 'Not Connected'",
    'ALTER TABLE linkedin_leads ADD COLUMN website TEXT',
    'ALTER TABLE linkedin_leads ADD COLUMN email TEXT',
    'ALTER TABLE linkedin_leads ADD COLUMN phone TEXT',
    'ALTER TABLE linkedin_leads ADD COLUMN is_hot_lead INTEGER DEFAULT 0',
    'ALTER TABLE linkedin_leads ADD COLUMN conversation_summary TEXT',
  ];

  // Explicit buyer-account assignment table
  db.exec(`
    CREATE TABLE IF NOT EXISTS fb_account_buyers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES fb_ad_accounts(id) ON DELETE CASCADE,
      buyer_id INTEGER NOT NULL REFERENCES fb_media_buyers(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, buyer_id)
    );
  `);
  // Seed fb_account_buyers from audit history (one-time migration)
  try {
    const pairs = db.prepare(`
      SELECT DISTINCT a.id AS account_id, b.id AS buyer_id
      FROM fb_audit_sessions s
      JOIN fb_ad_accounts a ON a.name = s.ad_account
      JOIN fb_media_buyers b ON b.name = s.media_buyer
      WHERE s.media_buyer IS NOT NULL
    `).all();
    const ins = db.prepare('INSERT OR IGNORE INTO fb_account_buyers (account_id, buyer_id) VALUES (?, ?)');
    for (const p of pairs) ins.run(p.account_id, p.buyer_id);
  } catch (e) { /* ignore */ }

  // Campaign groups table (per-account, optional)
  db.exec(`
    CREATE TABLE IF NOT EXISTS fb_campaign_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES fb_ad_accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      target_cpl REAL,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // Migrate old 'Contacted' status to 'New Lead' (one-time)
  try { db.exec("UPDATE outreach_leads SET status = 'New Lead' WHERE status = 'Contacted'"); } catch (e) { /* ignore */ }
  try { db.exec("UPDATE outreach_status_history SET new_status = 'New Lead' WHERE new_status = 'Contacted'"); } catch (e) { /* ignore */ }
  columnMigrations.forEach(sql => {
    try { db.exec(sql); } catch (e) { /* column already exists */ }
  });
  // Ensure exactly one locked, un-deletable default LinkedIn stage exists — new leads
  // always land here. Re-creates it if it was deleted before this protection existed.
  try {
    const hasDefault = db.prepare('SELECT 1 FROM linkedin_pipeline_stages WHERE is_default = 1').get();
    if (!hasDefault) {
      const existing = db.prepare("SELECT * FROM linkedin_pipeline_stages WHERE name = 'Identified'").get();
      if (existing) {
        db.prepare('UPDATE linkedin_pipeline_stages SET is_default = 1 WHERE id = ?').run(existing.id);
      } else {
        const minOrder = db.prepare('SELECT MIN(order_index) as mn FROM linkedin_pipeline_stages').get();
        db.prepare('INSERT INTO linkedin_pipeline_stages (name, order_index, active, is_default) VALUES (?, ?, 1, 1)')
          .run('Identified', (minOrder.mn || 1) - 1);
        console.log('Restored locked default LinkedIn stage "Identified"');
      }
    }
  } catch (e) { /* ignore */ }
  // Auto-purge trash items older than 7 days
  try {
    db.exec(`DELETE FROM fb_audit_sessions WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-7 days')`);
    db.exec(`DELETE FROM fb_ad_accounts WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-7 days')`);
    db.exec(`DELETE FROM outreach_leads WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-7 days')`);
    db.exec(`DELETE FROM linkedin_leads WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-7 days')`);
  } catch (e) { /* ignore */ }
  // Migrate existing specialist_id data into junction table (one-time, safe to re-run)
  try {
    db.exec(`
      INSERT OR IGNORE INTO outreach_lead_specialists (lead_id, specialist_id)
      SELECT id, specialist_id FROM outreach_leads WHERE specialist_id IS NOT NULL
    `);
  } catch (e) { /* ignore */ }

  // ── LMS (Learning Management System) tables ─────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS lms_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'employee',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lms_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      resources TEXT,
      suggested_days INTEGER,
      created_by INTEGER REFERENCES lms_users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lms_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      resources TEXT,
      assignee_id INTEGER NOT NULL REFERENCES lms_users(id),
      assigned_by INTEGER REFERENCES lms_users(id),
      template_id INTEGER REFERENCES lms_templates(id),
      stage TEXT NOT NULL DEFAULT 'Assigned',
      is_sequential INTEGER DEFAULT 0,
      due_date TEXT,
      stage_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lms_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL UNIQUE REFERENCES lms_topics(id) ON DELETE CASCADE,
      key_takeaways TEXT,
      how_to_apply TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lms_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES lms_topics(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      manager_answer TEXT,
      answered_at DATETIME,
      answered_by INTEGER REFERENCES lms_users(id),
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lms_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES lms_topics(id) ON DELETE CASCADE,
      assessor_id INTEGER NOT NULL REFERENCES lms_users(id),
      star_rating INTEGER NOT NULL CHECK(star_rating BETWEEN 1 AND 5),
      feedback TEXT NOT NULL,
      decision TEXT NOT NULL,
      assessed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lms_stage_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES lms_topics(id) ON DELETE CASCADE,
      old_stage TEXT,
      new_stage TEXT NOT NULL,
      changed_by INTEGER REFERENCES lms_users(id),
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lms_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES lms_topics(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES lms_users(id),
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // LMS pipeline stages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS lms_stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#8a8680',
      order_index INTEGER NOT NULL DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed one admin user if lms_users is empty
  const lmsUserCount = db.prepare('SELECT COUNT(*) as cnt FROM lms_users').get();
  if (lmsUserCount.cnt === 0) {
    db.prepare("INSERT INTO lms_users (name, role) VALUES ('Admin', 'admin')").run();
    console.log('Seeded default LMS admin user');
  }

  // Seed default stages if empty
  const lmsStageCount = db.prepare('SELECT COUNT(*) as cnt FROM lms_stages').get();
  if (lmsStageCount.cnt === 0) {
    const insertStage = db.prepare('INSERT INTO lms_stages (name, color, order_index) VALUES (?, ?, ?)');
    [
      ['Assigned', '#8a8680', 1],
      ['In Progress', '#575ECF', 2],
      ['Notes Submitted', '#f59e0b', 3],
      ['Assessed', '#3b82f6', 4],
      ['Needs Revision', '#ef4444', 5],
      ['Completed', '#22c55e', 6],
    ].forEach(([name, color, order]) => insertStage.run(name, color, order));
    console.log('Seeded LMS stages');
  }
  console.log('LMS tables initialized');

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

  // ── Facebook Audit Sessions ──────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS fb_audit_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      media_buyer TEXT,
      ad_account TEXT NOT NULL,
      answers TEXT NOT NULL,
      issue_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Facebook Change Log ──────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS fb_change_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      change_level TEXT NOT NULL,
      media_buyer TEXT,
      ad_account TEXT,
      campaign_name TEXT,
      ad_set_name TEXT,
      ad_name TEXT,
      changes_made_to TEXT,
      what_changed TEXT,
      why_changed TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── App Users (JWT auth) ─────────────────────────────────────────────────
  db.prepare(`CREATE TABLE IF NOT EXISTS app_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    designation TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    avatar_url TEXT,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();

  // Seed super-admin
  const bcryptjs = require('bcryptjs');
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM app_users').get();
  if (userCount.cnt === 0) {
    const hash = bcryptjs.hashSync('admin123', 10);
    db.prepare('INSERT INTO app_users (name, username, password_hash, designation, role) VALUES (?, ?, ?, ?, ?)').run('Admin', 'admin', hash, 'Super Admin', 'admin');
    console.log('Seeded super-admin: admin / admin123');
  }

  // ── Tracking Audit clients ───────────────────────────────────────────────
  db.prepare(`CREATE TABLE IF NOT EXISTS tracking_clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    website TEXT,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();

  const trackingClientCount = db.prepare('SELECT COUNT(*) as cnt FROM tracking_clients').get();
  if (trackingClientCount.cnt === 0) {
    const insertTrackingClient = db.prepare('INSERT INTO tracking_clients (name) VALUES (?)');
    ['Client Alpha', 'Client Beta'].forEach(n => insertTrackingClient.run(n));
    console.log('Seeded tracking_clients');
  }
}

module.exports = { db, initializeDatabase };
