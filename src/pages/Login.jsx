import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (isSignUp) {
      if (!businessName.trim()) {
        setError('Please enter your business name')
        setLoading(false)
        return
      }
      const { error } = await signUp(email, password, businessName.trim())
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      navigate('/')
    } else {
      const { error } = await signIn(email, password)
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      navigate('/')
    }
  }

  return (
    <div className="page" style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div className="card">
        <h1 className="section-title" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          Sole Trader Ledger
        </h1>

        <div className="tabs" style={{ marginBottom: '1.5rem' }}>
          <button
            className={'tab' + (!isSignUp ? ' active' : '')}
            onClick={() => setIsSignUp(false)}
            type="button"
          >
            Log In
          </button>
          <button
            className={'tab' + (isSignUp ? ' active' : '')}
            onClick={() => setIsSignUp(true)}
            type="button"
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {isSignUp && (
            <div className="field">
              <label className="label">Business Name</label>
              <input
                className="input"
                type="text"
                placeholder="e.g. Amina's Market Stall"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
              />
            </div>
          )}

          <div className="field">
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn btn-green" disabled={loading}>
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  )
}
