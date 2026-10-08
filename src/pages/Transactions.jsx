import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatLe, formatDate } from '../lib/format'

function groupByDate(transactions) {
  const groups = []
  const map = {}
  for (const tx of transactions) {
    if (!map[tx.date]) {
      map[tx.date] = { date: tx.date, items: [] }
      groups.push(map[tx.date])
    }
    map[tx.date].items.push(tx)
  }
  return groups
}

export default function Transactions() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryTotals, setCategoryTotals] = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    supabase
      .from('category_account_map')
      .select('category_name')
      .eq('direction', 'money_out')
      .then(({ data }) => setCategories(data || []))
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    let query = supabase
      .from('transactions')
      .select('id, date, amount, direction, description, category')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (categoryFilter) query = query.eq('category', categoryFilter)
    if (dateFrom) query = query.gte('date', dateFrom)
    if (dateTo) query = query.lte('date', dateTo)
    if (search.trim()) query = query.ilike('description', `%${search.trim()}%`)

    query.then(({ data }) => {
      setTransactions(data || [])
      setLoading(false)
    })
  }, [user.id, categoryFilter, dateFrom, dateTo, search])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    let query = supabase
      .from('transactions')
      .select('category, amount')
      .eq('user_id', user.id)
      .eq('direction', 'money_out')

    if (categoryFilter) query = query.eq('category', categoryFilter)
    if (dateFrom) query = query.gte('date', dateFrom)
    if (dateTo) query = query.lte('date', dateTo)

    query.then(({ data }) => {
      const totals = {}
      for (const tx of data || []) {
        totals[tx.category] = (totals[tx.category] || 0) + Number(tx.amount)
      }
      setCategoryTotals(
        Object.entries(totals)
          .map(([name, total]) => ({ name, total }))
          .sort((a, b) => b.total - a.total)
      )
    })
  }, [user.id, categoryFilter, dateFrom, dateTo])

  const groups = groupByDate(transactions)

  return (
    <div>
      <div className="filter-group">
        <div className="filter-row">
          <input
            className="input"
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-row">
          <select
            className="select"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map(c => (
              <option key={c.category_name} value={c.category_name}>
                {c.category_name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-row">
          <input
            className="input"
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            placeholder="From"
          />
          <input
            className="input"
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            placeholder="To"
          />
        </div>
      </div>

      {categoryTotals.length > 0 && (
        <div className="card">
          <h2 className="section-title">Spending by Category</h2>
          {categoryTotals.map(ct => (
            <div key={ct.name} className="category-bar">
              <span>{ct.name}</span>
              <span>{formatLe(ct.total)}</span>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="empty">Loading...</div>
      ) : transactions.length === 0 ? (
        <div className="empty">No transactions found.</div>
      ) : (
        groups.map(group => (
          <div key={group.date}>
            <div className="date-header">{formatDate(group.date)}</div>
            <div className="tx-list">
              {group.items.map(tx => (
                <div key={tx.id} className="tx-item">
                  <div className={'tx-dot ' + (tx.direction === 'money_in' ? 'in' : 'out')} />
                  <div className="tx-body">
                    <div className="tx-desc">{tx.description}</div>
                    <div className="tx-meta">{tx.category}</div>
                  </div>
                  <div className={'tx-amount ' + (tx.direction === 'money_in' ? 'in' : 'out')}>
                    {tx.direction === 'money_in' ? '+' : '-'}{formatLe(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
