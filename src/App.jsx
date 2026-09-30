import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Layout from './components/Layout'
import AddTransaction from './pages/AddTransaction'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Statements from './pages/Statements'
import Login from './pages/Login'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="page"><div className="empty">Loading...</div></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Protected><Layout /></Protected>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/add" element={<AddTransaction />} />
          <Route path="/add/:direction" element={<AddTransaction />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/statements" element={<Statements />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
