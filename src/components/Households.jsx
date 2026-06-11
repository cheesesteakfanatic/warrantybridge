import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Households({ profile, openHousehold }) {
  const [rows, setRows] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data: memberships } = await supabase
      .from('household_members')
      .select('household_id, member_role, households(id, name, address, created_at)')
      .eq('user_id', profile?.id || (await supabase.auth.getUser()).data.user.id)
    const list = (memberships || []).map(m => ({ ...m.households, member_role: m.member_role }))
    // counts
    const withCounts = await Promise.all(list.map(async h => {
      const [{ count: issueCount }, { count: openCount }, { count: memberCount }] = await Promise.all([
        supabase.from('issues').select('id', { count: 'exact', head: true }).eq('household_id', h.id),
        supabase.from('issues').select('id', { count: 'exact', head: true }).eq('household_id', h.id).not('status', 'in', '("resolved","closed")'),
        supabase.from('household_members').select('user_id', { count: 'exact', head: true }).eq('household_id', h.id),
      ])
      return { ...h, issueCount: issueCount || 0, openCount: openCount || 0, memberCount: memberCount || 0 }
    }))
    setRows(withCounts)
  }

  useEffect(() => { if (profile) load() }, [profile])

  async function createHousehold(e) {
    e.preventDefault(); setBusy(true); setError('')
    const { data, error } = await supabase.rpc('create_household', {
      p_name: name.trim(), p_address: address.trim(), p_role: profile.role,
    })
    setBusy(false)
    if (error) return setError(error.message)
    setShowCreate(false); setName(''); setAddress('')
    openHousehold(data)
  }

  async function joinHousehold(e) {
    e.preventDefault(); setBusy(true); setError('')
    const { data, error } = await supabase.rpc('claim_invite', { p_code: code.trim() })
    setBusy(false)
    if (error) return setError(error.message)
    setShowJoin(false); setCode('')
    openHousehold(data)
  }

  if (!profile || rows === null) return <div className="spinner" />

  return (
    <>
      <div className="page-head">
        <div>
          <h2>{profile.role === 'builder' ? 'Homes under warranty' : 'Your homes'}</h2>
          <div className="muted">
            {profile.role === 'builder'
              ? 'Manage warranty requests across the homes you build and service.'
              : 'Track warranty issues and stay in sync with your builder.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => { setShowJoin(true); setError('') }}>Join with code</button>
          <button className="btn btn-accent" onClick={() => { setShowCreate(true); setError('') }}>+ New home</button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card empty">
          <h3>No homes yet</h3>
          <p>Create a home to start a warranty record, or join one with an invite code from your {profile.role === 'builder' ? 'homebuyer' : 'builder'}.</p>
        </div>
      ) : (
        <div className="hh-grid">
          {rows.map(h => (
            <div key={h.id} className="card hh-card" onClick={() => openHousehold(h.id)}>
              <h3>{h.name}</h3>
              <div className="addr">{h.address || 'No address on file'}</div>
              <div className="hh-stats">
                <div className="hh-stat"><div className="n">{h.openCount}</div><div className="l">Open issues</div></div>
                <div className="hh-stat"><div className="n">{h.issueCount}</div><div className="l">Total issues</div></div>
                <div className="hh-stat"><div className="n">{h.memberCount}</div><div className="l">Members</div></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="modal-back" onClick={() => setShowCreate(false)}>
          <div className="card modal" onClick={e => e.stopPropagation()}>
            <h3>New home</h3>
            {error && <div className="error-box">{error}</div>}
            <form onSubmit={createHousehold}>
              <div className="field">
                <label>Home name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 412 Maplewood Lane" required />
              </div>
              <div className="field">
                <label>Address</label>
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Street, city, state" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn btn-accent" disabled={busy}>{busy ? 'Creating…' : 'Create home'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="modal-back" onClick={() => setShowJoin(false)}>
          <div className="card modal" onClick={e => e.stopPropagation()}>
            <h3>Join a home</h3>
            <p className="muted">Enter the invite code shared with you.</p>
            {error && <div className="error-box">{error}</div>}
            <form onSubmit={joinHousehold}>
              <div className="field">
                <label>Invite code</label>
                <input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. 3f9a1c2b4d5e" required />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowJoin(false)}>Cancel</button>
                <button className="btn btn-accent" disabled={busy}>{busy ? 'Joining…' : 'Join home'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
