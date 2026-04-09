import { Routes, Route, Navigate } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import UserSelect from '@/pages/UserSelect'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import NewMeeting from '@/pages/NewMeeting'
import MeetingCapture from '@/pages/MeetingCapture'
import MeetingEmail from '@/pages/MeetingEmail'
import SupplierDetail from '@/pages/SupplierDetail'
import Settings from '@/pages/Settings'
import SearchedProducts from '@/pages/SearchedProducts'
import CapturedProducts from '@/pages/CapturedProducts'
import RoutePlanner from '@/pages/RoutePlanner'

export default function App() {
  const { currentUser, setCurrentUser, clearUser } = useCurrentUser()

  if (!currentUser) {
    return <UserSelect onSelect={setCurrentUser} />
  }

  return (
    <Routes>
      <Route element={<Layout currentUser={currentUser} onLogout={clearUser} />}>
        <Route path="/" element={<Home currentUser={currentUser} />} />
        <Route path="/meeting/new" element={<NewMeeting currentUser={currentUser} />} />
        <Route path="/meeting/:id" element={<MeetingCapture currentUser={currentUser} />} />
        <Route path="/meeting/:id/email" element={<MeetingEmail currentUser={currentUser} />} />
        <Route path="/supplier/:id" element={<SupplierDetail currentUser={currentUser} />} />
        <Route path="/searched-products" element={<SearchedProducts />} />
        <Route path="/captured-products" element={<CapturedProducts />} />
        <Route path="/settings" element={<Settings currentUser={currentUser} />} />
      </Route>
      <Route path="/route-planner" element={<RoutePlanner />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
