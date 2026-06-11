import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { IArrowLeft, IUser, IKey, IMail, IBell, ITrash } from './Icons'

export default function Settings({ profile, email, back, refresh }) {
  const [fullName, setFullName] = useState(profile.full_name)
  const [company, setCompany] = useState(profile.company || '')
  const [emailNotif, setEmailNotif] = useState(profile.email_notifications !== false)
  const [notifIssue, setNotifIssue] = useState(profile.notify_issue !== false)
  const [notifStatus, setNotifStatus] = useState(profile.notify_status !== false)
  const [notifMessage, setNotifMessage] = useState(profile.notify_message !== false)
  const [newPass, setNewPass] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  async function saveProfile(e) {
    e.preventDefault(); setBusy(true); setError(''); setMsg('')
    const { error } = await supabase.from('profiles').update({
      full_name: fullName.trim(),
      company: company.trim() || null,
    }).eq('id', profile.id)
    setBusy(false)
    if (error) return setError(error.message)
    setMsg('Profile saved.')
    refresh()
  }

  async function saveNotifs(next) {
    setError(''); setMsg('')
    const { error } = await supabase.from('profiles').update(next).eq('id', profile.id)
    if (error) setError(error.message)
    else { setMsg('Notification preferences saved.'); refresh() }
  }

  async function changePassword(e) {
    e.preventDefault(); setBusy(true); setError(''); setMsg('')
    const { error } = await supabase.auth.updateUser({ password: newPass })
    setBusy(false)
    if (error) return setError(error.message)
    setNewPass('')
    setMsg('Password updated.')
  }

  async function sendResetEmail() {
    setBusy(true); setError(''); setMsg('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    setBusy(false)
    if (error) return setError(error.message)
    setMsg(`Password reset link sent to ${email}. Check your inbox.`)
  }

  async function deleteAccount() {
    setBusy(true); setError('')
    const { error } = await supabase.rpc('delete_account')
    if (error) { setBusy(false); return setError(error.message) }
    await supabase.auth.signOut()
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

      {error && <div className="error-box">{error}</div>}
      {msg && <div className="ok-box">{msg}</div>}

      <div className="settings-grid">
        <div>
          <div className="card side-card">
            <h4><IUser size={14} /> Profile</h4>
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
              <div className="field">
                <label>Email (sign-in & notifications)</label>
                <input value={email} disabled />
              </div>
              <button className="btn btn-accent" disabled={busy}>
                {busy ? 'Saving…' : 'Save profile'}
              </button>
            </form>
          </div>

          <div className="card side-card">
            <h4><IBell size={14} /> Email notifications</h4>
            <label className="toggle-row">
              <input type="checkbox" checked={emailNotif}
                onChange={e => { setEmailNotif(e.target.checked); saveNotifs({ email_notifications: e.target.checked }) }} />
              <span><b>All email updates</b> — master switch for everything below</span>
            </label>
            <div style={{ opacity: emailNotif ? 1 : .45, pointerEvents: emailNotif ? 'auto' : 'none' }}>
              <label className="toggle-row">
                <input type="checkbox" checked={notifIssue}
                  onChange={e => { setNotifIssue(e.target.checked); saveNotifs({ notify_issue: e.target.checked }) }} />
                <span>New issues reported or issue details edited</span>
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={notifStatus}
                  onChange={e => { setNotifStatus(e.target.checked); saveNotifs({ notify_status: e.target.checked }) }} />
                <span>Repair status changes (acknowledged, dispatched, resolved…)</span>
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={notifMessage}
                  onChange={e => { setNotifMessage(e.target.checked); saveNotifs({ notify_message: e.target.checked }) }} />
                <span>New messages on issues</span>
              </label>
            </div>
            <p className="muted" style={{ marginBottom: 0 }}>In-app notifications (the bell) always stay on.</p>
          </div>
        </div>

        <div>
          <div className="card side-card">
            <h4><IKey size={14} /> Password</h4>
            <form onSubmit={changePassword}>
              <div className="field">
                <label>New password</label>
                <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} minLength={6} placeholder="At least 6 characters" />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-ghost btn-sm" disabled={busy || newPass.length < 6}>Update password</button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={sendResetEmail}>
                  <IMail size={13} /> Email me a reset link
                </button>
              </div>
            </form>
          </div>

          <div className="card side-card">
            <h4>Session</h4>
            <button className="btn btn-ghost btn-sm" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>

          <div className="card side-card danger-card">
            <h4><ITrash size={13} /> Danger zone</h4>
            <p className="muted" style={{ marginTop: 0 }}>
              Deleting your account removes your profile, memberships, messages, and notifications permanently. Homes you manage remain for other members.
            </p>
            {!showDelete ? (
              <button className="btn btn-ghost btn-sm danger-btn" onClick={() => setShowDelete(true)}>Delete account…</button>
            ) : (
              <>
                <div className="field">
                  <label>Type DELETE to confirm</label>
                  <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setShowDelete(false); setDeleteConfirm('') }}>Cancel</button>
                  <button className="btn btn-sm danger-solid" disabled={deleteConfirm !== 'DELETE' || busy} onClick={deleteAccount}>
                    {busy ? 'Deleting…' : 'Permanently delete my account'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
