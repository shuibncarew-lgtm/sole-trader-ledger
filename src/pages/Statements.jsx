import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatLe } from '../lib/format'

export default function Statements() {
  const { user } = useAuth()
  const [tab, setTab] = useState('pnl')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [pnl, setPnl] = useState(null)
  const [balanceSheet, setBalanceSheet] = useState(null)

  const loadPnl = useCallback(() => {
    setLoading(true)
    let query = supabase
      .from('journal_entry_lines')
      .select(`
        debit_amount,
        credit_amount,
        account:chart_of_accounts!inner(name, type),
        entry:journal_entries!inner(user_id, status, entry_date)
      `)
      .eq('entry.user_id', user.id)
      .eq('entry.status', 'posted')

    if (dateFrom) query = query.gte('entry.entry_date', dateFrom)
    if (dateTo) query = query.lte('entry.entry_date', dateTo)

    query.then(({ data }) => {
      const revenue = {}
      const expenses = {}
      for (const line of data || []) {
        const account = line.account
        if (account.type === 'revenue') {
          const val = Number(line.credit_amount) - Number(line.debit_amount)
          revenue[account.name] = (revenue[account.name] || 0) + val
        } else if (account.type === 'expense') {
          const val = Number(line.debit_amount) - Number(line.credit_amount)
          expenses[account.name] = (expenses[account.name] || 0) + val
        }
      }
      const totalRevenue = Object.values(revenue).reduce((s, v) => s + v, 0)
      const totalExpenses = Object.values(expenses).reduce((s, v) => s + v, 0)
      setPnl({
        revenue: Object.entries(revenue).map(([name, amount]) => ({ name, amount })),
        expenses: Object.entries(expenses).map(([name, amount]) => ({ name, amount })),
        totalRevenue,
        totalExpenses,
        profit: totalRevenue - totalExpenses,
      })
      setLoading(false)
    })
  }, [user.id, dateFrom, dateTo])

  const loadBalanceSheet = useCallback(() => {
    setLoading(true)
    supabase
      .from('journal_entry_lines')
      .select(`
        debit_amount,
        credit_amount,
        account:chart_of_accounts!inner(name, type),
        entry:journal_entries!inner(user_id, status)
      `)
      .eq('entry.user_id', user.id)
      .eq('entry.status', 'posted')
      .then(({ data }) => {
        const accounts = {}
        for (const line of data || []) {
          const account = line.account
          if (!accounts[account.name]) {
            accounts[account.name] = { name: account.name, type: account.type, balance: 0 }
          }
          accounts[account.name].balance += Number(line.debit_amount) - Number(line.credit_amount)
        }

        const assets = []
        const liabilities = []
        const equity = []
        for (const acc of Object.values(accounts)) {
          if (acc.type === 'asset' && acc.balance !== 0) assets.push(acc)
          else if (acc.type === 'liability' && acc.balance !== 0) liabilities.push(acc)
          else if (acc.type === 'equity' && acc.balance !== 0) equity.push(acc)
        }

        const totalAssets = assets.reduce((s, a) => s + a.balance, 0)
        const totalLiabilities = liabilities.reduce((s, a) => s + Math.abs(a.balance), 0)
        const totalEquity = equity.reduce((s, a) => s + Math.abs(a.balance), 0)

        setBalanceSheet({ assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity })
        setLoading(false)
      })
  }, [user.id])

  useEffect(() => {
    if (tab === 'pnl') loadPnl()
    else loadBalanceSheet()
  }, [tab, loadPnl, loadBalanceSheet])

  const handlePrint = () => window.print()

  return (
    <div>
      <h1 className="section-title">Financial Statements</h1>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div className="tabs" style={{ flex: 1, marginBottom: 0 }}>
          <button className={'tab' + (tab === 'pnl' ? ' active' : '')} onClick={() => setTab('pnl')}>
            Profit & Loss
          </button>
          <button className={'tab' + (tab === 'bs' ? ' active' : '')} onClick={() => setTab('bs')}>
            What I Own & Owe
          </button>
        </div>
        <button className="btn btn-outline no-print" style={{ width: 'auto', padding: '0.5rem 1rem', marginLeft: '0.5rem' }} onClick={handlePrint}>
          Print
        </button>
      </div>

      <div className="card no-print">
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

      {loading ? (
        <div className="empty">Loading...</div>
      ) : tab === 'pnl' ? (
        <PnlStatement pnl={pnl} />
      ) : (
        <BalanceStatement bs={balanceSheet} />
      )}
    </div>
  )
}

function PnlStatement({ pnl }) {
  if (!pnl) return <div className="empty">No data for this period.</div>

  return (
    <div>
      <div className="card">
        <h2 className="section-title">Money In</h2>
        {pnl.revenue.length === 0 ? (
          <div className="empty">No revenue recorded.</div>
        ) : (
          <table className="statement-table">
            <tbody>
              {pnl.revenue.map(r => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td>{formatLe(r.amount)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total Money In</td>
                <td>{formatLe(pnl.totalRevenue)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">Money Out</h2>
        {pnl.expenses.length === 0 ? (
          <div className="empty">No expenses recorded.</div>
        ) : (
          <table className="statement-table">
            <tbody>
              {pnl.expenses.map(e => (
                <tr key={e.name}>
                  <td>{e.name}</td>
                  <td>{formatLe(e.amount)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total Money Out</td>
                <td>{formatLe(pnl.totalExpenses)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <table className="statement-table">
          <tbody>
            <tr className="total">
              <td>
                Profit for the period
              </td>
              <td style={{ color: pnl.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {formatLe(pnl.profit)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BalanceStatement({ bs }) {
  if (!bs) return <div className="empty">No data yet.</div>

  const balanced = Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity)) < 0.01

  return (
    <div>
      <div className="card">
        <h2 className="section-title">What I Own (Assets)</h2>
        {bs.assets.length === 0 ? (
          <div className="empty">No assets recorded.</div>
        ) : (
          <table className="statement-table">
            <tbody>
              {bs.assets.map(a => (
                <tr key={a.name}>
                  <td>{a.name}</td>
                  <td>{formatLe(a.balance)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total Assets</td>
                <td>{formatLe(bs.totalAssets)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">What I Owe (Liabilities)</h2>
        {bs.liabilities.length === 0 ? (
          <div className="empty">No liabilities recorded.</div>
        ) : (
          <table className="statement-table">
            <tbody>
              {bs.liabilities.map(l => (
                <tr key={l.name}>
                  <td>{l.name}</td>
                  <td>{formatLe(Math.abs(l.balance))}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total Liabilities</td>
                <td>{formatLe(bs.totalLiabilities)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">Owner's Equity</h2>
        {bs.equity.length === 0 ? (
          <div className="empty">No equity recorded.</div>
        ) : (
          <table className="statement-table">
            <tbody>
              {bs.equity.map(e => (
                <tr key={e.name}>
                  <td>{e.name}</td>
                  <td>{formatLe(Math.abs(e.balance))}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total Equity</td>
                <td>{formatLe(bs.totalEquity)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <table className="statement-table">
          <tbody>
            <tr>
              <td>Total Liabilities + Equity</td>
              <td>{formatLe(bs.totalLiabilities + bs.totalEquity)}</td>
            </tr>
            <tr className="total">
              <td>
                {balanced ? 'Balanced' : 'Not Balanced'}
              </td>
              <td style={{ color: balanced ? 'var(--green)' : 'var(--red)' }}>
                {balanced ? '✓' : '✗'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
