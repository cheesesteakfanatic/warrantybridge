import { useEffect, useState, useCallback } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import Households from './components/Households'
import HouseholdView from './components/HouseholdView'
import IssueDetail from './components/IssueDetail'
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (_e === 'SIGNED_IN' || _e === 'SIGNED_OUT') setView({ name: 'households' })
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadProfile = useCallback(async (uid) => {
    // the profile row is created by a DB trigger; retry briefly on first signup
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

  // claim invite code after login
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

  return (
    <div className="shell">
      <header className="topbar">
        <div style={{ cursor: 'pointer' }} onClick={() => setView({ name: 'households' })}>
          <Logo onDark />
        </div>
        <div className="topbar-right">
          <div className="who">
            <div className="nm">{profile?.full_name || session.user.email}</div>
            <div className="rl">{profile?.role}{profile?.company ? ` · ${profile.company}` : ''}</div>
          </div>
          <div className="avatar teal">{initials(profile?.full_name || session.user.email)}</div>
          <button className="btn-signout" onClick={() => supabase.auth.signOut()}>Sign out</button>
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
      </main>
    </div>
  )
}
