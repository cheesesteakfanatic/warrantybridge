import { useEffect, useState } from 'react'
import { supabase, uploadImage } from '../lib/supabase'
import { STATUSES, CATEGORIES, PRIORITIES, statusMeta, timeAgo, initials } from '../lib/helpers'

export default function HouseholdView({ householdId, profile, back, openIssue }) {
  const [household, setHousehold] = useState(null)
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [issues, setIssues] = useState(null)
  const [filter, setFilter] = useState('active')
  const [showNew, setShowNew] = useState(false)
  const [copied, setCopied] = useState('')

  async function load() {
    const [{ data: h }, { data: m }, { data: inv }, { data: iss }] = await Promise.all([
      supabase.from('households').select('*').eq('id', householdId).maybeSingle(),
      supabase.from('household_members').select('user_id, member_role, joined_at, profiles(id, full_name, role, company)').eq('household_id', householdId),
      supabase.from('invites').select('*').eq('household_id', householdId).is('claimed_by', null),
      supabase.from('issues').select('*').eq('household_id', householdId).order('created_at', { ascending: false }),
    ])
    setHousehold(h); setMembers(m || []); setInvites(inv || []); setIssues(iss || [])
  }

  useEffect(() => { load() }, [householdId])

  async function createInvite(role) {
    const { error } = await supabase.from('invites').insert({
      household_id: householdId, invited_role: role, created_by: profile.id,
    })
    if (!error) load()
  }

  function copyInvite(inv) {
    const link = `${window.location.origin}/?join=${inv.code}`
    navigator.clipboard.writeText(`You're invited to "${household.name}" on WarrantyBridge.\nJoin here: ${link}\nOr enter code: ${inv.code}`)
    setCopied(inv.id)
    setTimeout(() => setCopied(''), 2000)
  }

  if (!household || issues === null) return <div className="spinner" />

  const filtered = issues.filter(i =>
    filter === 'all' ? true :
    filter === 'active' ? !['resolved', 'closed'].includes(i.status) :
    ['resolved', 'closed'].includes(i.status))

  const inviteRoleSuggestion = profile.role === 'builder' ? 'buyer' : 'builder'

  return (
    <>
      <button className="crumb" onClick={back}>← All homes</button>
      <div className="page-head">
        <div>
          <h2>{household.name}</h2>
          <div className="muted">{household.address}</div>
        </div>
        <button className="btn btn-teal" onClick={() => setShowNew(true)}>+ Report issue</button>
      </div>

      <div className="two-col">
        <div>
          <div className="filters">
            {[['active', 'Active'], ['done', 'Resolved & closed'], ['all', 'All']].map(([v, l]) => (
              <button key={v} className={`chip ${filter === v ? 'active' : ''}`} onClick={() => setFilter(v)}>{l}</button>
            ))}
          </div>
          <div className="card">
            {filtered.length === 0 ? (
              <div className="empty">
                <div className="big">📋</div>
                No {filter === 'active' ? 'active' : filter === 'done' ? 'resolved' : ''} issues.
                {filter === 'active' && <p className="muted">Report an issue to start a documented warranty conversation.</p>}
              </div>
            ) : filtered.map(issue => {
              const sm = statusMeta(issue.status)
              return (
                <div key={issue.id} className="issue-row" onClick={() => openIssue(issue.id)}>
                  <div className="ir-main">
                    <div className="ir-title">
                      {issue.title}
                      {issue.priority === 'urgent' && <span className="prio-urgent">urgent</span>}
                      {issue.priority === 'high' && <span className="prio-high">high</span>}
                    </div>
                    <div className="ir-sub">{issue.category} · updated {timeAgo(issue.updated_at)}</div>
                  </div>
                  <span className="badge" style={{ color: sm.color, background: sm.bg }}>
                    <span className="dot" />{sm.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <div className="card side-card">
            <h4>Members</h4>
            {members.map(m => (
              <div key={m.user_id} className="member-row">
                <div className={`avatar ${m.member_role === 'builder' ? '' : 'teal'}`}>{initials(m.profiles?.full_name)}</div>
                <div>
                  <div className="mr-name">{m.profiles?.full_name}{m.user_id === profile.id ? ' (you)' : ''}</div>
                  <div className="mr-sub">{m.member_role}{m.profiles?.company ? ` · ${m.profiles.company}` : ''}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card side-card">
            <h4>Invite someone</h4>
            <p className="muted" style={{ marginTop: 0 }}>
              Share this home with the other party. They'll create an account and see the full record.
            </p>
            {invites.map(inv => (
              <div key={inv.id}>
                <div className="muted" style={{ marginTop: 10 }}>Invite for a <b>{inv.invited_role}</b>:</div>
                <div className="code-pill">
                  <span>{inv.code}</span>
                  <button className="btn btn-sm btn-ghost" onClick={() => copyInvite(inv)}>
                    {copied === inv.id ? 'Copied!' : 'Copy link'}
                  </button>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-sm btn-primary" onClick={() => createInvite(inviteRoleSuggestion)}>
                + Invite a {inviteRoleSuggestion}
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => createInvite(profile.role)}>
                + Invite another {profile.role}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showNew && (
        <NewIssueModal
          householdId={householdId}
          profile={profile}
          close={() => setShowNew(false)}
          done={(id) => { setShowNew(false); load(); openIssue(id) }}
        />
      )}
    </>
  )
}

function NewIssueModal({ householdId, profile, close, done }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('other')
  const [priority, setPriority] = useState('normal')
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function pickFiles(e) {
    const list = Array.from(e.target.files || []).slice(0, 6)
    setFiles(list)
    setPreviews(list.map(f => URL.createObjectURL(f)))
  }

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const { data: issue, error: e1 } = await supabase.from('issues').insert({
        household_id: householdId,
        title: title.trim(),
        description: description.trim(),
        category, priority,
        created_by: profile.id,
      }).select().single()
      if (e1) throw e1
      for (const f of files) {
        const path = await uploadImage(f)
        const { error: e2 } = await supabase.from('issue_photos').insert({
          issue_id: issue.id, path, uploaded_by: profile.id,
        })
        if (e2) throw e2
      }
      await supabase.from('issue_events').insert({
        issue_id: issue.id, actor_id: profile.id, event_type: 'created',
        note: 'Issue reported',
      })
      done(issue.id)
    } catch (err) {
      setError(err.message || String(err))
      setBusy(false)
    }
  }

  return (
    <div className="modal-back" onClick={close}>
      <div className="card modal" onClick={e => e.stopPropagation()}>
        <h3>Report a warranty issue</h3>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Master bath faucet leaking at base" required />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the issue, where it is, and when you noticed it…" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Photos (optional, up to 6)</label>
            <input type="file" accept="image/*" multiple onChange={pickFiles} />
            {previews.length > 0 && (
              <div className="photo-thumbs">
                {previews.map((src, i) => <img key={i} src={src} alt="" />)}
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={close}>Cancel</button>
            <button className="btn btn-teal" disabled={busy}>{busy ? 'Submitting…' : 'Submit issue'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
