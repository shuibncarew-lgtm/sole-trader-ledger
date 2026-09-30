import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <>
      <main className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {user?.email}
          </span>
          <button
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Log out
          </button>
        </div>
        <Outlet />
      </main>
      <nav className="tab-bar">
        <NavLink to="/" end className={({ isActive }) => 'tab-item' + (isActive ? ' active' : '')}>
          <span className="tab-icon">🏠</span>
          Home
        </NavLink>
        <NavLink to="/add" className={({ isActive }) => 'tab-item' + (isActive ? ' active' : '')}>
          <span className="tab-icon">➕</span>
          Add
        </NavLink>
        <NavLink to="/transactions" className={({ isActive }) => 'tab-item' + (isActive ? ' active' : '')}>
          <span className="tab-icon">📋</span>
          Transactions
        </NavLink>
        <NavLink to="/statements" className={({ isActive }) => 'tab-item' + (isActive ? ' active' : '')}>
          <span className="tab-icon">📊</span>
          Statements
        </NavLink>
      </nav>
    </>
  )
}
