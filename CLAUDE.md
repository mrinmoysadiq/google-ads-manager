# Google Ads Manager — Project Intelligence

This file is read automatically by Claude Code at the start of every session.
It contains everything needed to work on this project safely without breaking anything.

---

## 1. What This App Is

An internal agency operations platform with multiple modules:

| Module | Route | Purpose |
|--------|-------|---------|
| **Google Ads Audit** | `/audit` | Checklist-based session tracker for Google Ads account changes |
| **Outreach CRM** | `/outreach` | Lead pipeline management (Kanban + Table) with dashboard analytics |
| **LMS** | `/learning` | Learning management system — topics, assessments, notes |
| **Facebook/Meta Ads** | `/facebook` | Meta ads audit checklist sessions |
| **Tracking Audit** | `/tracking` | GA4, Google Ads, Meta pixel audit checklists |
| **Change Log** | `/changelog` | History of all Google Ads changes |
| **Admin** | `/admin` | Manage accounts & team members (Google Ads module) |
| **App Admin** | `/admin-panel` | Manage app users (JWT auth) |

All routes are protected by JWT auth. Login at `/login`. Default superadmin: `admin` / `admin123`.

---

## 2. Tech Stack

### Frontend (`client/`)
- **React 18** + **Vite** + **React Router v6**
- **Tailwind CSS v3** (utility classes)
- **react-hot-toast** for notifications
- **react-select** for styled dropdowns
- **axios** for API calls (configured in `client/src/utils/`)
- **jspdf** + **jspdf-autotable** for client-side PDF export

### Backend (`server/`)
- **Node.js** + **Express**
- **better-sqlite3** — synchronous SQLite driver (no async/await needed for DB queries)
- **jsonwebtoken** — JWT auth, secret: `process.env.JWT_SECRET || 'infinix_secret_key'`
- **bcryptjs** — password hashing
- **json2csv** — CSV export

### Database
- Single SQLite file: `server/db/ads_manager.db`
- On Render: stored at `/var/data/ads_manager.db` (persistent disk)
- Local dev: stored at `server/db/ads_manager.db`
- WAL mode enabled, foreign keys ON

---

## 3. Project Structure

```
google-ads-manager/
├── CLAUDE.md                    ← you are here
├── package.json                 ← root scripts (dev, install:all)
├── render.yaml                  ← Render deployment config
├── server/
│   ├── index.js                 ← Express app entry point, mounts all routers
│   ├── package.json
│   ├── db/
│   │   ├── database.js          ← ALL table creation + seeding (initializeDatabase)
│   │   └── ads_manager.db       ← SQLite database (local)
│   └── routes/
│       ├── auth.js              ← Login, register, profile (JWT)
│       ├── app-admin.js         ← Manage app_users
│       ├── outreach.js          ← ⭐ Outreach CRM (most complex — see section 6)
│       ├── lms.js               ← LMS topics, assessments, notes
│       ├── sessions.js          ← Google Ads audit sessions
│       ├── slides.js            ← Slide responses (Google Ads checklist)
│       ├── changelog.js         ← Change log entries
│       ├── admin.js             ← Accounts & team members
│       ├── facebook.js          ← Facebook/Meta ads sessions
│       ├── tracking.js          ← Tracking audit sessions
│       └── learning.js          ← Weekly learning tracker
└── client/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx              ← Routes, ProtectedRoute, AdminRoute, ErrorBoundary
        ├── index.css
        ├── components/          ← Shared: Navbar, Avatar, AutoSaveIndicator, etc.
        ├── hooks/
        │   ├── useDebounce.js   ← Debounce hook (350ms used for search)
        │   └── useAutoSave.js
        ├── utils/
        │   ├── auth.js          ← getToken(), getUser(), isAdmin() helpers
        │   ├── api.js           ← Base axios instance for Google Ads module
        │   ├── outreachApi.js   ← ⭐ All outreach API calls
        │   ├── lmsApi.js
        │   ├── learningApi.js
        │   └── pdfGenerator.js
        └── pages/
            ├── outreach/        ← ⭐ Most recently worked on
            │   ├── OutreachHome.jsx         ← Main page (pipeline + dashboard tabs)
            │   ├── OutreachAdmin.jsx        ← Admin settings for outreach
            │   └── components/
            │       ├── Dashboard.jsx        ← Metric cards, funnel, overdue list
            │       ├── PipelineTable.jsx    ← Table view with filters/sort
            │       ├── PipelineKanban.jsx   ← Kanban board view
            │       ├── LeadDrawer.jsx       ← Slide-in detail panel for a lead
            │       ├── TouchpointQuickModal.jsx  ← Quick touchpoint logger
            │       └── ResponseQuickModal.jsx    ← Quick response logger
            ├── auth/
            ├── lms/
            ├── facebook/
            ├── tracking/
            └── slides/
```

---

## 4. How to Deploy to Live (Render)

**Deployment is 100% automatic via git push.**

```bash
git add <files>
git commit -m "your message"
git push
```

That's it. Render auto-deploys on every push to `main` because `render.yaml` is committed.

### What Render does automatically:
- **Backend** (`google-ads-manager-api`): runs `npm install` then `node index.js` in `server/`
- **Frontend** (`google-ads-manager-ui`): runs `npm install && npm run build` in `client/`, serves `dist/`

### Render environment variables (set in Render dashboard, NOT in code):
- `CORS_ORIGIN` — backend service: set to the frontend URL (e.g. `https://google-ads-manager-ui.onrender.com`)
- `VITE_API_URL` — frontend service: set to `https://google-ads-manager-api.onrender.com/api`
- `JWT_SECRET` — backend: set to a strong secret (optional, defaults to `infinix_secret_key`)

### Git remote:
```
origin  git@github.com:mrinmoysadiq/google-ads-manager.git
```

### Safe deploy checklist:
1. Test locally if possible (`npm run dev` from root)
2. Never modify `render.yaml` unless you know what you're doing
3. Database migrations are handled automatically at startup via `columnMigrations` in `database.js`
4. Never add `DROP TABLE` or destructive SQL to `database.js` — always use `ALTER TABLE ADD COLUMN` with try/catch

---

## 5. Authentication System

- JWT stored in `localStorage` as `app_token`
- User info stored in `localStorage` as `app_user` (JSON: `{ id, name, role, username, designation }`)
- Token payload: `{ id, username, role }`
- Roles: `'admin'` (full access) or `'user'` (restricted)
- Helper functions in `client/src/utils/auth.js`:
  - `getToken()` — returns JWT string
  - `getUser()` — returns parsed user object
  - `isAdmin()` — returns boolean

### Server-side enforcement in Outreach CRM:
Non-admin users are automatically scoped to their own leads. The server matches the JWT user's `name` to an `outreach_specialists` record and enforces `specialist_id` filtering on all queries — clients cannot override this.

```js
// In outreach.js routes
function getRequestUser(req) { /* decodes JWT */ }
function resolveSpecialistForUser(reqUser) {
  // admin → null (no restriction)
  // non-admin with matching specialist → specialist.id
  // non-admin with no specialist → -1 (return empty results)
}
```

---

## 6. Outreach CRM — Full Detail

This is the most complex and most recently worked-on module.

### Data Model

```
outreach_specialists     — sales reps (name, manager_id, active)
outreach_industries      — industry categories
outreach_leads           — core lead record (specialist_id=primary, status, etc.)
outreach_lead_specialists — junction table: many leads ↔ many specialists
outreach_touchpoints     — up to N touchpoints per lead (UNIQUE lead_id + touchpoint_number)
outreach_status_history  — log of every status change
outreach_lead_responses  — logged responses from leads (Interested/Not Interested moves)
outreach_pipeline_stages — stage definitions (seeded with 14 default stages)
outreach_settings        — key/value settings (e.g. max_touchpoints=5)
outreach_dashboard_cards — custom metric card definitions (formula-based)
```

### Lead Fields
`id, specialist_id (primary), company_name, contact_name, job_title, website, industry_id, location, status, next_followup_date, status_updated_at, created_at, source_url, source_image (base64 — heavy!), email, phone, fb_page_url, ig_url`

⚠️ **IMPORTANT**: `source_image` is excluded from the `/leads` list endpoint to keep bulk loads fast. It is only returned by `GET /leads/:id`.

### Pipeline Stages (seeded defaults, DB-driven)
```
New Lead → Touchpoint 1 → Touchpoint 2 → Touchpoint 3 → Touchpoint 4 → Touchpoint 5
→ Responded → Interested → Appointment Booked → No Show
→ Meeting Done - Not Interested → Started Trial → Closed / Booked as Client
→ Disqualified / Dead
```

### "Responded" Definition (CRITICAL)
"Responded" does NOT include the "Responded" pipeline stage. It means:
```js
const RESPONDED_CURRENT = [
  'Interested', 'Not Interested', 'Not interested',
  'Appointment Booked', 'No Show', 'Meeting Done - Not Interested',
  'Started Trial', 'Closed / Booked as Client'
];
```
This is used in dashboard calculations and the `by_status` map.

### Status Change Flow (OutreachHome.jsx)
```
handleStatusChange(leadId, newStatus)
  ├── Touchpoint stage (e.g. "Touchpoint 2") → opens TouchpointQuickModal
  │     → on save: upsertTouchpoint + updateLead + bumpDashboard()
  ├── Response-required stage (Interested/Not Interested/Meeting Done - Not Interested)
  │     → opens ResponseQuickModal
  │     → on save: createLeadResponse + updateLead + bumpDashboard()
  └── All other stages → optimistic update + updateLead + bumpDashboard()
```

### Dashboard Refresh Pattern (bumpDashboard)
```js
// In OutreachHome.jsx
const bumpDashboard = () => setDashboardRefreshKey(k => k + 1)
// Dashboard.jsx re-fetches when refreshKey prop changes
useEffect(() => { fetchData(); }, [refreshKey]);
```
`bumpDashboard()` must be called after EVERY lead status change, save, or delete.

### Kanban vs Table Fetch Difference
```js
// Kanban: loads up to 500 leads (no pagination, needs all leads for columns)
limit: isKanban ? 500 : 25
// Table: paginated at 25/page
```
This is intentional — Kanban needs all leads to populate columns correctly.

### Default Sort
```js
sort_by: 'status_updated_at', sort_dir: 'DESC'
```
This ensures recently-moved leads appear at the top (not buried by `created_at` order).

### Custom Dashboard Metric Cards
Cards are stored in `outreach_dashboard_cards`:
- `card_type`: `'count'` or `'rate'`
- `numerator_statuses`: JSON array of pipeline stages to count
- `denominator`: `'total'` or JSON array of stages
- Values are computed CLIENT-SIDE in `Dashboard.jsx` from `by_status` map returned by `/dashboard`
- Edit/Delete UI: click ✏️ on hover → opens CardModal → Delete Card button is inside the modal footer (not on the card itself — moved to prevent accidental deletion)

### Search
Search is debounced (350ms) in a global search bar above the pipeline.
Server searches 7 fields: `company_name, contact_name, email, phone, location, job_title, website`

### API Endpoints (all under `/api/outreach/`)
```
GET    /specialists
POST   /specialists
PATCH  /specialists/:id
GET    /specialists/:id/is-manager

GET    /industries
POST   /industries
PATCH  /industries/:id
DELETE /industries/:id

GET    /leads                    ← paginated, many filters, excludes source_image
POST   /leads
GET    /leads/:id                ← includes source_image, touchpoints, history, responses
PATCH  /leads/:id
DELETE /leads/:id

GET    /leads/:leadId/touchpoints
PUT    /leads/:leadId/touchpoints/:number   ← upsert

GET    /leads/:leadId/responses
POST   /leads/:leadId/responses
DELETE /leads/:leadId/responses/:id

GET    /dashboard                ← metrics + by_status map
GET    /overdue                  ← overdue follow-up leads
GET    /dashboard/cards          ← custom metric card definitions
POST   /dashboard/cards
PATCH  /dashboard/cards/:id
DELETE /dashboard/cards/:id

GET    /export/csv
GET    /export/pdf               ← returns HTML page for browser printing

GET    /pipeline-stages
POST   /pipeline-stages
PATCH  /pipeline-stages/:id
DELETE /pipeline-stages/:id

GET    /settings
PATCH  /settings
```

---

## 7. Database Schema Quick Reference

### App Users (JWT auth)
```sql
app_users: id, name, username, password_hash, designation, role, avatar_url, active, created_at
```

### Google Ads Audit
```sql
sessions: id, team_member, account_name, date, status, created_at
slide_responses: id, session_id, slide_number, section_name, field_key, field_value, saved_at
change_log: id, session_id, team_member, account_name, date, section, change_type, ...many fields
accounts: id, name, active, created_at
team_members: id, name, active, created_at
```

### LMS
```sql
lms_users: id, name, role (admin/manager/employee), active
lms_templates, lms_topics, lms_notes, lms_questions, lms_assessments
lms_stage_history, lms_comments, lms_stages
```

### Facebook/Meta
```sql
fb_media_buyers: id, name, active
fb_ad_accounts: id, name, active
```

### Tracking Audit
```sql
tracking_clients: id, name, website, active
```

### Migrations
New columns are added safely at startup:
```js
// In database.js — wrap every ALTER TABLE in try/catch
try { db.exec(`ALTER TABLE outreach_leads ADD COLUMN email TEXT`); } catch(e) { /* already exists */ }
```
**Always use this pattern when adding new columns.** Never use `DROP TABLE` or `DROP COLUMN`.

---

## 8. Critical Patterns & Gotchas

### ❌ Never Do This
- Don't add `DROP TABLE` anywhere in `database.js`
- Don't change the `CORS_ORIGIN` or `VITE_API_URL` in `render.yaml` — they're set manually in Render dashboard
- Don't include `source_image` in bulk lead list queries (it's a base64 string that makes responses huge)
- Don't hardcode pipeline stage names in the frontend — always derive from DB via `getPipelineStages()`

### ✅ Always Do This
- Call `bumpDashboard()` after any lead status change, create, or delete
- Use `status_updated_at` (not `created_at`) as the default sort for leads
- For Kanban view, fetch with `limit: 500` to get all leads for all columns
- Wrap new DB column additions in try/catch
- Use `parseCard()` helper when reading dashboard cards from DB (parses JSON fields)
- Use `serializeDenominator()` when writing denominator to DB

### Date filter param names
Frontend sends `date_from` / `date_to`. Server expects `date_from` / `date_to`.
(Was a bug previously where frontend sent `from`/`to` — already fixed.)

### React: Dashboard tab doesn't remount
The Dashboard component stays mounted when switching tabs (tab state controlled in OutreachHome). The `refreshKey` prop is used to trigger re-fetch rather than remounting.

### STATUS_COLORS in PipelineTable
Uses a `DEFAULT_STATUS_COLOR` fallback for any unknown status:
```js
const DEFAULT_STATUS_COLOR = { bg: 'rgba(138,134,128,0.15)', color: '#8a8680' };
function getStatusColor(status) {
  return STATUS_COLORS[status] || DEFAULT_STATUS_COLOR;
}
```

### old 'Contacted' status
Old data had `status = 'Contacted'`. This was migrated to `'New Lead'` at startup:
```js
db.exec("UPDATE outreach_leads SET status = 'New Lead' WHERE status = 'Contacted'");
```
Don't add 'Contacted' back anywhere.

---

## 9. Local Development

```bash
# Install all dependencies
npm run install:all

# Start both server and client
npm run dev

# Server runs on: http://localhost:5001
# Client runs on: http://localhost:5173
# API base URL: http://localhost:5173/api (proxied via Vite to :5001)
```

Vite proxies `/api` requests to the server in dev mode (configured in `client/vite.config.js`).

---

## 10. Recent Changes (Latest First)

| Commit | What Changed |
|--------|-------------|
| `4d47271` | Delete button moved from MetricCard hover overlay into Edit modal footer (prevent accidental deletion) |
| `217acdc` | Kanban now loads 500 leads; status dropdown uses DB stages; STATUS_COLORS has safe fallback |
| `0d9d7d5` | Dashboard now refreshes on ALL lead changes (added bumpDashboard to touchpoint/response/update handlers) |
| `d6b2528` | Global search bar added above pipeline (debounced, 7 fields, result count) |
| `ac65f94` | Custom editable dashboard metric cards with formula builder (DB-stored, computed client-side) |
| `3d8ed8f` | Dashboard metrics fixed: accurate current-status-based metrics, date filter fixed (date_from/date_to) |
| `a0df01f` | Server-side JWT enforcement: non-admins only see their own leads |

---

## 11. Design System

Dark theme throughout. Key colors:
- Background: `#1b1b1b` (page), `#242424` (cards), `#2a2a2a` (inputs)
- Brand/accent: `#575ECF` (indigo/purple)
- Text primary: `#c5c1b9`
- Text muted: `#8a8680`
- Borders: `rgba(255,255,255,0.08)` (cards), `rgba(255,255,255,0.12)` (inputs)
- Success: `#22c55e`, Warning: `#f59e0b`, Error: `#ef4444`, Info: `#3b82f6`

All inline styles (no Tailwind for most components built after the initial scaffold). Use the color values above to stay consistent.

---

## 12. How to Make Changes Safely

1. **Read the relevant file(s) first** before editing
2. **Make targeted edits** using the Edit tool — never rewrite a whole file unless truly necessary
3. **Check for `bumpDashboard()` calls** when touching lead save/update/delete flows
4. **Test the logic** by tracing through the code mentally before committing
5. **Commit with a clear message** and `git push` — Render deploys automatically
6. **New DB columns**: always use `ALTER TABLE ADD COLUMN` wrapped in try/catch inside `database.js`
7. **New API routes**: add to `server/routes/outreach.js` (or relevant route file) AND add API helper function to `client/src/utils/outreachApi.js`
