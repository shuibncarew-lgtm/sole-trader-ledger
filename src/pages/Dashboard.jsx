import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatLe, formatDate } from '../lib/format'

export default function Dashboard() {
  const { user } = useAuth()
  const [moneyIn, setMoneyIn] = useState(0)
  const [moneyOut, setMoneyOut] = useState(0)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    Promise.all([
      supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('direction', 'money_in')
        .gte('date', monthStart),
      supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('direction', 'money_out')
        .gte('date', monthStart),
      supabase
        .from('transactions')
        .select('id, date, amount, direction, description, category')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(8),
    ]).then(([inRes, outRes, recentRes]) => {
      setMoneyIn((inRes.data || []).reduce((s, t) => s + Number(t.amount), 0))
      setMoneyOut((outRes.data || []).reduce((s, t) => s + Number(t.amount), 0))
      setRecent(recentRes.data || [])
      setLoading(false)
    })
  }, [user.id])

  const profit = moneyIn - moneyOut

  return (
    <div>
      <h1 className="section-title">Dashboard</h1>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Money In (this month)</div>
          <div className="stat-value green">{formatLe(moneyIn)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Money Out (this month)</div>
          <div className="stat-value red">{formatLe(moneyOut)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Profit (this month)</div>
          <div className={'stat-value ' + (profit >= 0 ? 'green' : 'red')}>
            {formatLe(profit)}
          </div>
        </div>
      </div>

      <Link to="/add/money_in" className="btn btn-green" style={{ marginBottom: '0.5rem' }}>
        + Record money in
      </Link>
      <Link to="/add/money_out" className="btn btn-red">
        + Record money out
      </Link>

      <div style={{ marginTop: '1.5rem' }}>
        <h2 className="section-title">Recent Transactions</h2>
        <div className="card">
          {loading ? (
            <div className="empty">Loading...</div>
          ) : recent.length === 0 ? (
            <div className="empty">No transactions yet. Add your first one above.</div>
          ) : (
            recent.map(tx => (
              <div key={tx.id} className="tx-item">
                <div>
                  <div className="tx-desc">{tx.description}</div>
                  <div className="tx-meta">
                    {formatDate(tx.date)} · {tx.category}
                  </div>
                </div>
                <div className={'tx-amount ' + (tx.direction === 'money_in' ? 'in' : 'out')}>
                  {tx.direction === 'money_in' ? '+' : '-'}{formatLe(tx.amount)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
