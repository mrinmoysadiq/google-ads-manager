# Google Ads Daily Manager

A full-stack web application for tracking daily Google Ads management activities, changes, and performance notes.

## Setup Instructions

### Prerequisites
- Node.js 18+ installed
- npm 8+

### Installation

1. Navigate to the project directory:
   ```bash
   cd google-ads-manager
   ```

2. Install root dependencies (concurrently):
   ```bash
   npm install
   ```

3. Install server and client dependencies:
   ```bash
   npm run install:all
   ```

4. Start both servers (frontend + backend):
   ```bash
   npm run dev
   ```

   This starts:
   - **Frontend** (React/Vite) at http://localhost:3000
   - **Backend** (Express API) at http://localhost:5001

5. The SQLite database auto-creates at `server/db/ads_manager.db` on first run, with seed data:
   - **Accounts**: Client Alpha, Client Beta, Client Gamma, Client Delta, Client Epsilon
   - **Team Members**: Alex, Maria, James, Sara, David

## Usage

1. Open http://localhost:3000 in your browser
2. On the **Session Start** page, select your name, today's date, and the ad account you're reviewing
3. Work through the 4-slide daily checklist:
   - **Slide 1**: Spend & Conversions — enter performance numbers and notes
   - **Slide 2**: Keyword Analysis — review keywords, log pauses/additions
   - **Slide 3**: Ad Copy Review — review ads, log creative changes
   - **Slide 4**: Audience & Targeting — review audiences and bid adjustments
4. All changes auto-save as you type (1-second debounce)
5. Use the **Change Log** page to review historical changes with filters and CSV export
6. Use the **Admin** page to manage accounts and team members

## Architecture

- **Frontend**: React 18 + Vite (port 3000), Tailwind CSS, React Router v6
- **Backend**: Node.js + Express (port 5000), better-sqlite3
- **Database**: SQLite (file-based, no setup required)
- **Proxy**: Vite proxies all `/api/*` requests to the Express backend
