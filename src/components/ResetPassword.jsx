import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Logo from './Logo'

export default function ResetPassword({ done }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (password !== confirm) return setError('Passwords do not match.')
    setBusy(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(error.message)
    done()
  }

  return (
    <div className="center-page">
      <div className="card auth-card" style={{ maxWidth: 420 }}>
        <Logo />
        <h2 style={{ margin: '18px 0 4px' }}>Set a new password</h2>
        <p className="muted" style={{ marginTop: 0 }}>You followed a password-reset link. Choose a new password for your account.</p>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>New password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required autoFocus />
          </div>
          <div className="field">
            <label>Confirm new password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} minLength={6} required />
          </div>
          <button className="btn btn-accent" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      </div>
    </div>
  )
}
