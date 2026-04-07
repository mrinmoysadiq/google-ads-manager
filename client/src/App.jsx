import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Navbar from './components/Navbar'
import ModuleHome from './pages/ModuleHome'
import SessionStart from './pages/SessionStart'
import ChecklistWrapper from './pages/ChecklistWrapper'
import SessionComplete from './pages/SessionComplete'
import ChangeLog from './pages/ChangeLog'
import Admin from './pages/Admin'
import LearningHome from './pages/learning/LearningHome'
import LearningSubmit from './pages/learning/LearningSubmit'
import LearningHistory from './pages/learning/LearningHistory'
import LearningManagerDashboard from './pages/learning/LearningManagerDashboard'
import LearningAdmin from './pages/learning/LearningAdmin'
import OutreachHome from './pages/outreach/OutreachHome'
import OutreachAdmin from './pages/outreach/OutreachAdmin'
import FbSessionStart from './pages/facebook/FbSessionStart'
import FbChecklist from './pages/facebook/FbChecklist'
import FbComplete from './pages/facebook/FbComplete'
import FbAdmin from './pages/facebook/FbAdmin'

export default function App() {
  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <Navbar />
      <main className="pt-0">
        <Routes>
          {/* ── Hub ───────────────────────────────────────────────────── */}
          <Route path="/" element={<ModuleHome />} />

          {/* ── Google Ads Audit module ────────────────────────────────── */}
          <Route path="/audit" element={<SessionStart />} />
          <Route path="/checklist/:sessionId" element={<ChecklistWrapper />} />
          <Route path="/complete/:sessionId" element={<SessionComplete />} />
          <Route path="/changelog" element={<ChangeLog />} />
          <Route path="/admin" element={<Admin />} />

          {/* ── Weekly Learning module ─────────────────────────────────── */}
          <Route path="/learning" element={<LearningHome />} />
          <Route path="/learning/submit" element={<LearningSubmit />} />
          <Route path="/learning/history/:userId" element={<LearningHistory />} />
          <Route path="/learning/manager/:managerId" element={<LearningManagerDashboard />} />
          <Route path="/learning/admin" element={<LearningAdmin />} />

          {/* ── Outreach CRM module ────────────────────────────────────── */}
          <Route path="/outreach" element={<OutreachHome />} />
          <Route path="/outreach/admin" element={<OutreachAdmin />} />

          {/* ── Facebook/Meta Ads module ───────────────────────────────── */}
          <Route path="/facebook" element={<FbSessionStart />} />
          <Route path="/facebook/checklist" element={<FbChecklist />} />
          <Route path="/facebook/complete" element={<FbComplete />} />
          <Route path="/facebook/admin" element={<FbAdmin />} />
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
