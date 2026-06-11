import { useEffect, useState, useCallback } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import Households from './components/Households'
import HouseholdView from './components/HouseholdView'
import IssueDetail from './components/IssueDetail'
import Settings from './components/Settings'
import ResetPassword from './components/ResetPassword'
import NotificationsBell from './components/NotificationsBell'
import Logo from './components/Logo'
import { initials } from './lib/helpers'

function getInviteFromUrl() {
  const p = new URLSearchParams(window.location.search)
  return p.get('join') || ''
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [profile, setProfile] = useState(null)
  const [view, setView] = useState({ name: 'households' })
  const [pendingInvite, setPendingInvite] = useState(getInviteFromUrl())
  const [inviteMsg, setInviteMsg] = useState('')
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setView({ name: 'households' })
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadProfile = useCallback(async (uid) => {
    for (let i = 0; i < 6; i++) {
      const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
      if (data) { setProfile(data); return }
      await new Promise(r => setTimeout(r, 700))
    }
  }, [])

  useEffect(() => {
    if (session?.user) loadProfile(session.user.id)
    else setProfile(null)
  }, [session, loadProfile])

  useEffect(() => {
    if (!session?.user || !pendingInvite) return
    const code = pendingInvite
    setPendingInvite('')
    window.history.replaceState({}, '', window.location.pathname)
    supabase.rpc('claim_invite', { p_code: code }).then(({ data, error }) => {
      if (error) setInviteMsg(error.message.replace('claim_invite: ', ''))
      else {
        setInviteMsg('')
        setView({ name: 'household', id: data })
      }
    })
  }, [session, pendingInvite])

  if (session === undefined) return <div className="spinner" />
  if (!session) return <Auth pendingInvite={pendingInvite} />
  if (recovery) return <ResetPassword done={() => setRecovery(false)} />

  return (
    <div className="shell">
      <header className="topbar">
        <button className="brand-btn" onClick={() => setView({ name: 'households' })}>
          <Logo onDark />
        </button>
        <div className="topbar-right">
          <NotificationsBell
            profile={profile}
            openIssue={(issueId, householdId) => setView({ name: 'issue', id: issueId, householdId })}
          />
          <button className="who-btn" onClick={() => setView({ name: 'settings' })} title="Your settings">
            <span className="who">
              <span className="nm">{profile?.full_name || session.user.email}</span>
              <span className="rl">{profile?.role}{profile?.company ? ` · ${profile.company}` : ''}</span>
            </span>
            <span className={`avatar ${profile?.role === 'builder' ? 'builder' : ''}`}>{initials(profile?.full_name || session.user.email)}</span>
          </button>
        </div>
      </header>

      <main className="main">
        {inviteMsg && <div className="error-box">{inviteMsg} <button className="btn btn-sm btn-ghost" style={{ marginLeft: 8 }} onClick={() => setInviteMsg('')}>Dismiss</button></div>}
        {!profile && <div className="spinner" />}
        {profile && view.name === 'households' && (
          <Households profile={profile} openHousehold={(id) => setView({ name: 'household', id })} />
        )}
        {profile && view.name === 'household' && (
          <HouseholdView
            householdId={view.id}
            profile={profile}
            back={() => setView({ name: 'households' })}
            openIssue={(issueId) => setView({ name: 'issue', id: issueId, householdId: view.id })}
          />
        )}
        {profile && view.name === 'issue' && (
          <IssueDetail
            issueId={view.id}
            profile={profile}
            back={() => setView({ name: 'household', id: view.householdId })}
          />
        )}
        {profile && view.name === 'settings' && (
          <Settings
            profile={profile}
            email={session.user.email}
            back={() => setView({ name: 'households' })}
            refresh={() => loadProfile(profile.id)}
          />
        )}
      </main>
    </div>
  )
}
