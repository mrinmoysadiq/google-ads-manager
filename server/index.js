const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./db/database');

const sessionsRouter = require('./routes/sessions');
const slidesRouter = require('./routes/slides');
const changelogRouter = require('./routes/changelog');
const adminRouter = require('./routes/admin');
const lmsRouter = require('./routes/lms');
const outreachRouter = require('./routes/outreach');
const facebookRouter = require('./routes/facebook');
const authRouter = require('./routes/auth');
const appAdminRouter = require('./routes/app-admin');
const trackingRouter = require('./routes/tracking');

const app = express();
const PORT = process.env.PORT || 5001;

// CORS_ORIGIN env var is set in Render to the frontend's *.onrender.com URL.
// Falls back to localhost for local development.
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '20mb' }));

// Initialize database on startup
initializeDatabase();
console.log('Database initialized');

// Mount routes
app.use('/api/sessions', sessionsRouter);
app.use('/api/slides', slidesRouter);
app.use('/api/changelog', changelogRouter);
app.use('/api/admin', adminRouter);
app.use('/api/lms', lmsRouter);
app.use('/api/outreach', outreachRouter);
app.use('/api/facebook', facebookRouter);
app.use('/api/auth', authRouter);
app.use('/api/app-admin', appAdminRouter);
app.use('/api/tracking', trackingRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
