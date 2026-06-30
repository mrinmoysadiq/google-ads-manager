import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Component } from 'react'
import { Toaster } from 'react-hot-toast'
import Navbar from './components/Navbar'
import ModuleHome from './pages/ModuleHome'
import SessionStart from './pages/SessionStart'
import ChecklistWrapper from './pages/ChecklistWrapper'
import SessionComplete from './pages/SessionComplete'
import ChangeLog from './pages/ChangeLog'
import Admin from './pages/Admin'
import LmsStart from './pages/lms/LmsStart'
import LmsEmployee from './pages/lms/LmsEmployee'
import LmsManager from './pages/lms/LmsManager'
import LmsAdmin from './pages/lms/LmsAdmin'
import LmsTopicDetail from './pages/lms/LmsTopicDetail'
import OutreachHome from './pages/outreach/OutreachHome'
import OutreachAdmin from './pages/outreach/OutreachAdmin'
import FbHome from './pages/facebook/FbHome'
import FbSessionStart from './pages/facebook/FbSessionStart'
import FbChecklist from './pages/facebook/FbChecklist'
import FbComplete from './pages/facebook/FbComplete'
import FbAdmin from './pages/facebook/FbAdmin'
import FbChangeLog from './pages/facebook/FbChangeLog'
import FbAuditLog from './pages/facebook/FbAuditLog'
import FbAccounts from './pages/facebook/FbAccounts'
import Login from './pages/auth/Login'
import Profile from './pages/auth/Profile'
import AppAdminPanel from './pages/auth/AppAdminPanel'
import TrackingHome from './pages/tracking/TrackingHome'
import TrackingAdmin from './pages/tracking/TrackingAdmin'
import GoogleAdsTrackingStart from './pages/tracking/googleAds/GoogleAdsTrackingStart'
import GoogleAdsTrackingChecklist from './pages/tracking/googleAds/GoogleAdsTrackingChecklist'
import GoogleAdsTrackingComplete from './pages/tracking/googleAds/GoogleAdsTrackingComplete'
import MetaAuditStart from './pages/tracking/meta/MetaAuditStart'
import MetaAuditChecklist from './pages/tracking/meta/MetaAuditChecklist'
import MetaAuditComplete from './pages/tracking/meta/MetaAuditComplete'
import GA4AuditStart from './pages/tracking/ga4/GA4AuditStart'
import GA4AuditChecklist from './pages/tracking/ga4/GA4AuditChecklist'
import GA4AuditComplete from './pages/tracking/ga4/GA4AuditComplete'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('App error:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', background: '#1b1b1b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '24px' }}>
          <div style={{ color: '#ef4444', fontSize: '48px' }}>⚠</div>
          <h2 style={{ color: '#c5c1b9', fontSize: '18px', fontWeight: 700, margin: 0 }}>Something went wrong</h2>
          <p style={{ color: '#8a8680', fontSize: '13px', margin: 0, textAlign: 'center', maxWidth: '360px' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
            style={{ marginTop: '8px', padding: '10px 24px', borderRadius: '10px', background: '#575ECF', color: '#fff', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
          >
            Go to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('app_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const token = localStorage.getItem('app_token');
  let user = {};
  try { user = JSON.parse(localStorage.getItem('app_user') || '{}'); } catch { /* ignore */ }
  if (!token) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-[#1b1b1b]">
      {!isLogin && <Navbar />}
      <main className="pt-0">
        <Routes>
          {/* ── Public ────────────────────────────────────────────────── */}
          <Route path="/login" element={<Login />} />

          {/* ── Hub ───────────────────────────────────────────────────── */}
          <Route path="/" element={<ProtectedRoute><ModuleHome /></ProtectedRoute>} />

          {/* ── Google Ads Audit module ────────────────────────────────── */}
          <Route path="/audit" element={<ProtectedRoute><SessionStart /></ProtectedRoute>} />
          <Route path="/checklist/:sessionId" element={<ProtectedRoute><ChecklistWrapper /></ProtectedRoute>} />
          <Route path="/complete/:sessionId" element={<ProtectedRoute><SessionComplete /></ProtectedRoute>} />
          <Route path="/changelog" element={<ProtectedRoute><ChangeLog /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />

          {/* ── LMS module ─────────────────────────────────────────────── */}
          <Route path="/learning" element={<ProtectedRoute><LmsStart /></ProtectedRoute>} />
          <Route path="/learning/employee/:userId" element={<ProtectedRoute><LmsEmployee /></ProtectedRoute>} />
          <Route path="/learning/manager" element={<ProtectedRoute><LmsManager /></ProtectedRoute>} />
          <Route path="/learning/admin" element={<ProtectedRoute><LmsAdmin /></ProtectedRoute>} />
          <Route path="/learning/topic/:topicId" element={<ProtectedRoute><LmsTopicDetail /></ProtectedRoute>} />

          {/* ── Outreach CRM module ────────────────────────────────────── */}
          <Route path="/outreach" element={<ProtectedRoute><OutreachHome /></ProtectedRoute>} />
          <Route path="/outreach/admin" element={<ProtectedRoute><OutreachAdmin /></ProtectedRoute>} />

          {/* ── Facebook/Meta Ads module ───────────────────────────────── */}
          <Route path="/facebook" element={<ProtectedRoute><FbHome /></ProtectedRoute>} />
          <Route path="/facebook/start" element={<ProtectedRoute><FbSessionStart /></ProtectedRoute>} />
          <Route path="/facebook/checklist" element={<ProtectedRoute><FbChecklist /></ProtectedRoute>} />
          <Route path="/facebook/complete" element={<ProtectedRoute><FbComplete /></ProtectedRoute>} />
          <Route path="/facebook/admin" element={<ProtectedRoute><FbAdmin /></ProtectedRoute>} />
          <Route path="/facebook/changelog" element={<ProtectedRoute><FbChangeLog /></ProtectedRoute>} />
          <Route path="/facebook/audit-log" element={<ProtectedRoute><FbAuditLog /></ProtectedRoute>} />
          <Route path="/facebook/accounts" element={<ProtectedRoute><FbAccounts /></ProtectedRoute>} />

          {/* ── Tracking Audit module ─────────────────────────────────── */}
          <Route path="/tracking" element={<ProtectedRoute><TrackingHome /></ProtectedRoute>} />
          <Route path="/tracking/admin" element={<ProtectedRoute><TrackingAdmin /></ProtectedRoute>} />
          <Route path="/tracking/google-ads" element={<ProtectedRoute><GoogleAdsTrackingStart /></ProtectedRoute>} />
          <Route path="/tracking/google-ads/checklist" element={<ProtectedRoute><GoogleAdsTrackingChecklist /></ProtectedRoute>} />
          <Route path="/tracking/google-ads/complete" element={<ProtectedRoute><GoogleAdsTrackingComplete /></ProtectedRoute>} />
          <Route path="/tracking/meta" element={<ProtectedRoute><MetaAuditStart /></ProtectedRoute>} />
          <Route path="/tracking/meta/checklist" element={<ProtectedRoute><MetaAuditChecklist /></ProtectedRoute>} />
          <Route path="/tracking/meta/complete" element={<ProtectedRoute><MetaAuditComplete /></ProtectedRoute>} />
          <Route path="/tracking/ga4" element={<ProtectedRoute><GA4AuditStart /></ProtectedRoute>} />
          <Route path="/tracking/ga4/checklist" element={<ProtectedRoute><GA4AuditChecklist /></ProtectedRoute>} />
          <Route path="/tracking/ga4/complete" element={<ProtectedRoute><GA4AuditComplete /></ProtectedRoute>} />

          {/* ── Auth pages ─────────────────────────────────────────────── */}
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/admin-panel" element={<AdminRoute><AppAdminPanel /></AdminRoute>} />
        </Routes>
      </main>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1f2937',
            color: '#f9fafb',
            borderRadius: '8px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#22c55e', secondary: '#f9fafb' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#f9fafb' },
          },
        }}
      />
    </div>
    </ErrorBoundary>
  )
}
