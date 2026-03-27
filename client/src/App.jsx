import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Navbar from './components/Navbar'
import SessionStart from './pages/SessionStart'
import ChecklistWrapper from './pages/ChecklistWrapper'
import SessionComplete from './pages/SessionComplete'
import ChangeLog from './pages/ChangeLog'
import Admin from './pages/Admin'

export default function App() {
  return (
    <div className="min-h-screen bg-[#1b1b1b]">
      <Navbar />
      <main className="pt-0">
        <Routes>
          <Route path="/" element={<SessionStart />} />
          <Route path="/checklist/:sessionId" element={<ChecklistWrapper />} />
          <Route path="/complete/:sessionId" element={<SessionComplete />} />
          <Route path="/changelog" element={<ChangeLog />} />
          <Route path="/admin" element={<Admin />} />
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
