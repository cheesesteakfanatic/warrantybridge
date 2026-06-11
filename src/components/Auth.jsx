import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Logo from './Logo'

export default function Auth({ pendingInvite }) {
  const [mode, setMode] = useState(pendingInvite ? 'signup' : 'signin')
  const [role, setRole] = useState('buyer')
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'signup') {
        if (!fullName.trim()) throw new Error('Please enter your full name.')
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName.trim(), role, company: company.trim() || null } },
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <div>
          <Logo onDark />
          <h1>A clear written record between builder and homebuyer.</h1>
          <p>
            WarrantyBridge keeps warranty issues, repair plans, photos, and every
            conversation in one professional, documented place — so nothing gets
            lost and everyone stays accountable.
          </p>
          <div className="hero-points">
            <div className="hero-point"><span className="tick">✓</span>Report issues with photos and a full written trail</div>
            <div className="hero-point"><span className="tick">✓</span>Read receipts — know your message was seen</div>
            <div className="hero-point"><span className="tick">✓</span>Live repair status: acknowledged, scheduled, dispatched, resolved</div>
            <div className="hero-point"><span className="tick">✓</span>Share a home with your builder or buyer in seconds</div>
          </div>
        </div>
        <div className="muted" style={{ color: '#7d9cb1' }}>Built for new-home warranty communication.</div>
      </div>

      <div className="auth-panel">
        <div className="card auth-card">
          {pendingInvite && (
            <div className="invite-banner">
              You've been invited to join a home (code <b>{pendingInvite}</b>).
              Create an account or sign in to accept.
            </div>
          )}
          <div className="auth-tabs">
            <button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Sign in</button>
            <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create account</button>
          </div>

          {error && <div className="error-box">{error}</div>}

          <form onSubmit={submit}>
            {mode === 'signup' && (
              <>
                <div className="role-pick">
                  <button type="button" className={role === 'buyer' ? 'active' : ''} onClick={() => setRole('buyer')}>
                    <span className="rp-title">🏠 Homebuyer</span>
                    <span className="rp-sub">I own or am buying the home</span>
                  </button>
                  <button type="button" className={role === 'builder' ? 'active' : ''} onClick={() => setRole('builder')}>
                    <span className="rp-title">🔨 Builder</span>
                    <span className="rp-sub">I built or service the home</span>
                  </button>
                </div>
                <div className="field">
                  <label>Full name</label>
                  <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" required />
                </div>
                {role === 'builder' && (
                  <div className="field">
                    <label>Company (optional)</label>
                    <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Smith Custom Homes" />
                  </div>
                )}
              </>
            )}
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" minLength={6} required />
            </div>
            <button className="btn btn-teal" style={{ width: '100%', marginTop: 6 }} disabled={busy}>
              {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
