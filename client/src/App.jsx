import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
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
import FbSessionStart from './pages/facebook/FbSessionStart'
import FbChecklist from './pages/facebook/FbChecklist'
import FbComplete from './pages/facebook/FbComplete'
import FbAdmin from './pages/facebook/FbAdmin'
import Login from './pages/auth/Login'
import Profile from './pages/auth/Profile'
import AppAdminPanel from './pages/auth/AppAdminPanel'

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('app_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const token = localStorage.getItem('app_token');
  const user = JSON.parse(localStorage.getItem('app_user') || '{}');
  if (!token) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  return (
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
          <Route path="/facebook" element={<ProtectedRoute><FbSessionStart /></ProtectedRoute>} />
          <Route path="/facebook/checklist" element={<ProtectedRoute><FbChecklist /></ProtectedRoute>} />
          <Route path="/facebook/complete" element={<ProtectedRoute><FbComplete /></ProtectedRoute>} />
          <Route path="/facebook/admin" element={<ProtectedRoute><FbAdmin /></ProtectedRoute>} />

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
  )
}
