import { Routes, Route, Navigate } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import UserSelect from '@/pages/UserSelect'
import Home from '@/pages/Home'
import NewMeeting from '@/pages/NewMeeting'
import MeetingCapture from '@/pages/MeetingCapture'
import MeetingEmail from '@/pages/MeetingEmail'
import SupplierDetail from '@/pages/SupplierDetail'
import Settings from '@/pages/Settings'

export default function App() {
  const { currentUser, setCurrentUser, clearUser } = useCurrentUser()

  if (!currentUser) {
    return <UserSelect onSelect={setCurrentUser} />
  }

  return (
    <Routes>
      <Route path="/" element={<Home currentUser={currentUser} onLogout={clearUser} />} />
      <Route path="/meeting/new" element={<NewMeeting currentUser={currentUser} />} />
      <Route path="/meeting/:id" element={<MeetingCapture currentUser={currentUser} />} />
      <Route path="/meeting/:id/email" element={<MeetingEmail currentUser={currentUser} />} />
      <Route path="/supplier/:id" element={<SupplierDetail currentUser={currentUser} />} />
      <Route path="/settings" element={<Settings currentUser={currentUser} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
