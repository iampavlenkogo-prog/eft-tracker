import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import SupervisionsPage from './pages/SupervisionsPage'
import SeminarsPage from './pages/SeminarsPage'
import ReportsPage from './pages/ReportsPage'
import ProfilePage from './pages/ProfilePage'
import SupervisorPage from './pages/SupervisorPage'
import AdminPage from './pages/AdminPage'
import SlotsPage from './pages/SlotsPage'
import MyEventsPage from './pages/MyEventsPage'
import MyBookingsPage from './pages/MyBookingsPage'
import GroupSupervisionPage from './pages/GroupSupervisionPage'
import EventsPage from './pages/EventsPage'
import EventDetailPage from './pages/EventDetailPage'
import CalendarPage from './pages/CalendarPage'
import TherapistRequestsPage from './pages/TherapistRequestsPage'
import TherapistRequestDetailPage from './pages/TherapistRequestDetailPage'
import CommunityPage from './pages/CommunityPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/supervisions" element={<ProtectedRoute><SupervisionsPage /></ProtectedRoute>} />
          <Route path="/seminars" element={<ProtectedRoute><SeminarsPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

          <Route path="/slots" element={<ProtectedRoute><SlotsPage /></ProtectedRoute>} />
          <Route path="/my-events" element={<ProtectedRoute><MyEventsPage /></ProtectedRoute>} />
          <Route path="/my-bookings" element={<ProtectedRoute><MyBookingsPage /></ProtectedRoute>} />
          <Route path="/group-supervisions/:id" element={<ProtectedRoute><GroupSupervisionPage /></ProtectedRoute>} />
          <Route path="/events" element={<ProtectedRoute><EventsPage /></ProtectedRoute>} />
          <Route path="/events/:id" element={<ProtectedRoute><EventDetailPage /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
          <Route path="/therapist-requests" element={<ProtectedRoute><TherapistRequestsPage /></ProtectedRoute>} />
          <Route path="/therapist-requests/:id" element={<ProtectedRoute><TherapistRequestDetailPage /></ProtectedRoute>} />
          <Route path="/community" element={<ProtectedRoute><CommunityPage /></ProtectedRoute>} />

          <Route path="/supervisor" element={
            <ProtectedRoute roles={['SUPERVISOR', 'SUPERVISOR_CANDIDATE']}>
              <SupervisorPage />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminPage />
            </ProtectedRoute>
          } />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
