import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Logo from './Logo'
import { ICheck, IHome, IWrench } from './Icons'

export default function Auth({ pendingInvite }) {
  const [mode, setMode] = useState(pendingInvite ? 'signup' : 'signin')
  const [role, setRole] = useState('buyer')
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(''); setNotice('')
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
      } else if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setNotice('Check your inbox — we sent you a link to reset your password.')
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
          <h1 className="display">A clear written record between builder&nbsp;and&nbsp;homebuyer.</h1>
          <p>
            Warranty issues, repair plans, photos, and every conversation — documented
            in one professional place, so nothing gets lost and everyone stays accountable.
          </p>
          <div className="hero-points">
            <div className="hero-point"><span className="tick"><ICheck size={13} /></span>Issues with photos and a permanent written trail</div>
            <div className="hero-point"><span className="tick"><ICheck size={13} /></span>Read receipts — know your message was seen</div>
            <div className="hero-point"><span className="tick"><ICheck size={13} /></span>Live repair status from acknowledged to resolved</div>
            <div className="hero-point"><span className="tick"><ICheck size={13} /></span>Response-time insight across every issue</div>
          </div>
        </div>
        <div className="hero-foot">Built for new-home warranty communication.</div>
      </div>

      <div className="auth-panel">
        <div className="card auth-card">
          {pendingInvite && (
            <div className="invite-banner">
              You've been invited to join a home (code <b>{pendingInvite}</b>).
              Create an account or sign in to accept.
            </div>
          )}
          {mode !== 'forgot' && (
            <div className="auth-tabs">
              <button className={mode === 'signin' ? 'active' : ''} onClick={() => { setMode('signin'); setError(''); setNotice('') }}>Sign in</button>
              <button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(''); setNotice('') }}>Create account</button>
            </div>
          )}
          {mode === 'forgot' && <h3 style={{ marginTop: 0 }}>Reset your password</h3>}

          {error && <div className="error-box">{error}</div>}
          {notice && <div className="ok-box">{notice}</div>}

          <form onSubmit={submit}>
            {mode === 'signup' && (
              <>
                <div className="role-pick">
                  <button type="button" className={role === 'buyer' ? 'active' : ''} onClick={() => setRole('buyer')}>
                    <span className="rp-ic"><IHome size={17} /></span>
                    <span className="rp-title">Homebuyer</span>
                    <span className="rp-sub">I own or am buying the home</span>
                  </button>
                  <button type="button" className={role === 'builder' ? 'active' : ''} onClick={() => setRole('builder')}>
                    <span className="rp-ic"><IWrench size={17} /></span>
                    <span className="rp-title">Builder</span>
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
            {mode !== 'forgot' && (
              <div className="field">
                <label>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" minLength={6} required />
              </div>
            )}
            <button className="btn btn-accent" style={{ width: '100%', marginTop: 6 }} disabled={busy}>
              {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
            </button>
          </form>

          <div className="auth-foot">
            {mode === 'signin' && <button className="linklike" onClick={() => { setMode('forgot'); setError(''); setNotice('') }}>Forgot your password?</button>}
            {mode === 'forgot' && <button className="linklike" onClick={() => { setMode('signin'); setError(''); setNotice('') }}>Back to sign in</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
