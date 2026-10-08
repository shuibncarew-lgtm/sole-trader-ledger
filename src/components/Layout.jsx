import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

function HomeIcon() {
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-6h6v6" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="3.5" cy="6" r="1" fill="currentColor" />
      <circle cx="3.5" cy="12" r="1" fill="currentColor" />
      <circle cx="3.5" cy="18" r="1" fill="currentColor" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="6" rx="0.5" />
      <rect x="12" y="8" width="3" height="10" rx="0.5" />
      <rect x="17" y="5" width="3" height="13" rx="0.5" />
    </svg>
  )
}

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
            style={{ background: 'none', border: 'none', color: 'var(--rust)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Log out
          </button>
        </div>
        <Outlet />
      </main>
      <nav className="tab-bar">
        <NavLink to="/" end className={({ isActive }) => 'tab-item' + (isActive ? ' active' : '')}>
          <HomeIcon />
          Home
        </NavLink>
        <NavLink to="/add" className={({ isActive }) => 'tab-item' + (isActive ? ' active' : '')}>
          <PlusIcon />
          Add
        </NavLink>
        <NavLink to="/transactions" className={({ isActive }) => 'tab-item' + (isActive ? ' active' : '')}>
          <ListIcon />
          Transactions
        </NavLink>
        <NavLink to="/statements" className={({ isActive }) => 'tab-item' + (isActive ? ' active' : '')}>
          <ChartIcon />
          Statements
        </NavLink>
      </nav>
    </>
  )
}
