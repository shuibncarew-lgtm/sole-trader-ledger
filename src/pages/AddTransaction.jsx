import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatLe } from '../lib/format'

const PAYMENT_METHODS = ['Cash', 'Orange Money', 'Bank']

export default function AddTransaction() {
  const { direction: urlDirection } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [direction, setDirection] = useState(urlDirection || 'money_in')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (urlDirection === 'money_in' || urlDirection === 'money_out') {
      setDirection(urlDirection)
    }
  }, [urlDirection])

  useEffect(() => {
    supabase
      .from('category_account_map')
      .select('category_name, direction')
      .eq('direction', direction)
      .then(({ data }) => {
        setCategories(data || [])
        if (data?.length && !data.find(c => c.category_name === category)) {
          setCategory(data[0].category_name)
        }
      })
  }, [direction])

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage(null)

    const amt = Number(amount)
    if (!amt || amt <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid amount' })
      return
    }
    if (!description.trim()) {
      setMessage({ type: 'error', text: 'Please enter a description' })
      return
    }
    if (!category) {
      setMessage({ type: 'error', text: 'Please select a category' })
      return
    }

    setLoading(true)
    const { error } = await supabase.rpc('create_transaction_with_entry', {
      p_user_id: user.id,
      p_date: date,
      p_amount: amt,
      p_direction: direction,
      p_description: description.trim(),
      p_category: category,
      p_payment_method: paymentMethod,
    })
    setLoading(false)

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({
        type: 'success',
        text: `${direction === 'money_in' ? 'Money in' : 'Money out'} of ${formatLe(amt)} recorded successfully`,
      })
      setAmount('')
      setDescription('')
    }
  }

  return (
    <div>
      <h1 className="section-title">Add Transaction</h1>

      <div className="toggle">
        <button
          type="button"
          className={'toggle-btn' + (direction === 'money_in' ? ' active' : '')}
          onClick={() => setDirection('money_in')}
        >
          Money In
        </button>
        <button
          type="button"
          className={'toggle-btn' + (direction === 'money_out' ? ' active out' : '')}
          onClick={() => setDirection('money_out')}
        >
          Money Out
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label className="label">Amount (Le)</label>
          <input
            className="input"
            type="number"
            min="1"
            step="1"
            placeholder="e.g. 350000"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="label">Date</label>
          <input
            className="input"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="label">Description</label>
          <input
            className="input"
            type="text"
            placeholder={direction === 'money_in' ? 'e.g. Sale — market stall' : 'e.g. Bought stock'}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="label">Category</label>
          <select
            className="select"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            {categories.map(c => (
              <option key={c.category_name} value={c.category_name}>
                {c.category_name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label">Payment Method</label>
          <select
            className="select"
            value={paymentMethod}
            onChange={e => setPaymentMethod(e.target.value)}
          >
            {PAYMENT_METHODS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {message && (
          <p className={message.type === 'error' ? 'error-text' : 'success-text'}>
            {message.text}
          </p>
        )}

        <button
          type="submit"
          className={'btn ' + (direction === 'money_in' ? 'btn-green' : 'btn-red')}
          disabled={loading}
        >
          {loading ? 'Saving...' : `Record ${direction === 'money_in' ? 'Money In' : 'Money Out'}`}
        </button>
      </form>
    </div>
  )
}
