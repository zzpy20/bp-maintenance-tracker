import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Issues } from './pages/Issues'
import { IssueDetail } from './pages/IssueDetail'
import { IssueForm } from './pages/IssueForm'
import { Properties } from './pages/Properties'
import { Suppliers } from './pages/Suppliers'

function ProtectedRoutes() {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="issues" element={<Issues />} />
        <Route path="issues/new" element={<IssueForm mode="new" />} />
        <Route path="issues/:id" element={<IssueDetail />} />
        <Route path="issues/:id/edit" element={<IssueForm mode="edit" />} />
        <Route path="properties" element={<Properties />} />
        <Route path="suppliers" element={<Suppliers />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

function LoginPage() {
  const { token } = useAuth()
  if (token) return <Navigate to="/" replace />
  return <Login />
}
