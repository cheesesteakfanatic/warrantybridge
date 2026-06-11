import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { IArrowLeft, IUser, IKey, IMail } from './Icons'

export default function Settings({ profile, email, back, refresh }) {
  const [fullName, setFullName] = useState(profile.full_name)
  const [company, setCompany] = useState(profile.company || '')
  const [emailNotif, setEmailNotif] = useState(profile.email_notifications !== false)
  const [newPass, setNewPass] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function saveProfile(e) {
    e.preventDefault(); setBusy(true); setError(''); setMsg('')
    const { error } = await supabase.from('profiles').update({
      full_name: fullName.trim(),
      company: company.trim() || null,
      email_notifications: emailNotif,
    }).eq('id', profile.id)
    setBusy(false)
    if (error) return setError(error.message)
    setMsg('Profile saved.')
    refresh()
  }

  async function changePassword(e) {
    e.preventDefault(); setBusy(true); setError(''); setMsg('')
    const { error } = await supabase.auth.updateUser({ password: newPass })
    setBusy(false)
    if (error) return setError(error.message)
    setNewPass('')
    setMsg('Password updated.')
  }

  return (
    <>
      <button className="crumb" onClick={back}><IArrowLeft size={15} /> Back</button>
      <div className="page-head">
        <div>
          <h2>Your settings</h2>
          <div className="muted">Account, notifications, and security.</div>
        </div>
      </div>

      <div className="settings-grid">
        <div className="card side-card">
          <h4><IUser size={14} /> Profile</h4>
          {error && <div className="error-box">{error}</div>}
          {msg && <div className="ok-box">{msg}</div>}
          <form onSubmit={saveProfile}>
            <div className="field">
              <label>Full name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Company</label>
              <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Optional" />
            </div>
            <div className="field">
              <label>Role</label>
              <input value={profile.role === 'builder' ? 'Builder' : 'Homebuyer'} disabled />
            </div>
            <label className="toggle-row">
              <input type="checkbox" checked={emailNotif} onChange={e => setEmailNotif(e.target.checked)} />
              <span>Email me when issues are created, updated, or get new messages</span>
            </label>
            <button className="btn btn-accent" disabled={busy} style={{ marginTop: 14 }}>
              {busy ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        </div>

        <div>
          <div className="card side-card">
            <h4><IMail size={14} /> Account</h4>
            <div className="field">
              <label>Email (sign-in)</label>
              <input value={email} disabled />
            </div>
            <p className="muted" style={{ margin: 0 }}>Notifications are delivered to this address.</p>
          </div>

          <div className="card side-card">
            <h4><IKey size={14} /> Change password</h4>
            <form onSubmit={changePassword}>
              <div className="field">
                <label>New password</label>
                <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} minLength={6} required placeholder="At least 6 characters" />
              </div>
              <button className="btn btn-ghost" disabled={busy || newPass.length < 6}>Update password</button>
            </form>
          </div>

          <div className="card side-card">
            <h4>Session</h4>
            <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
        </div>
      </div>
    </>
  )
}
