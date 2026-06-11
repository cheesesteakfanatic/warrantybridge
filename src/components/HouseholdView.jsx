import { useEffect, useRef, useState } from 'react'
import { supabase, uploadImage } from '../lib/supabase'
import { CATEGORIES, PRIORITIES, statusMeta, timeAgo, initials, issueMetrics, fmtDuration, avg } from '../lib/helpers'
import { IArrowLeft, IPencil, IPlus, ICamera, IImage, ILink, ICheck, IX, IClock, ITrash } from './Icons'

export default function HouseholdView({ householdId, profile, back, openIssue }) {
  const [household, setHousehold] = useState(null)
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [issues, setIssues] = useState(null)
  const [events, setEvents] = useState([])
  const [msgMeta, setMsgMeta] = useState([])
  const [filter, setFilter] = useState('active')
  const [showNew, setShowNew] = useState(false)
  const [showEditHome, setShowEditHome] = useState(false)
  const [copied, setCopied] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const [{ data: h }, { data: m }, { data: inv }, { data: iss }] = await Promise.all([
      supabase.from('households').select('*').eq('id', householdId).maybeSingle(),
      supabase.from('household_members').select('user_id, member_role, joined_at, profiles(id, full_name, role, company)').eq('household_id', householdId),
      supabase.from('invites').select('*').eq('household_id', householdId).order('created_at'),
      supabase.from('issues').select('*').eq('household_id', householdId).order('created_at', { ascending: false }),
    ])
    setHousehold(h); setMembers(m || []); setIssues(iss || [])
    const mine = (m || []).find(x => x.user_id === profile.id)?.member_role
    if (mine === 'buyer' || mine === 'builder') setInvites(await ensureInvites(inv || []))
    else setInvites(inv || [])
    const ids = (iss || []).map(i => i.id)
    if (ids.length) {
      const [{ data: ev }, { data: mm }] = await Promise.all([
        supabase.from('issue_events').select('issue_id, event_type, new_status, actor_id, created_at').in('issue_id', ids).order('created_at'),
        supabase.from('messages').select('issue_id, sender_id, created_at').in('issue_id', ids).order('created_at'),
      ])
      setEvents(ev || []); setMsgMeta(mm || [])
    } else { setEvents([]); setMsgMeta([]) }
  }

  async function ensureInvites(current) {
    const missing = ['buyer', 'builder', 'viewer'].filter(r => !current.some(i => i.invited_role === r))
    if (missing.length === 0) return current
    await supabase.from('invites').insert(
      missing.map(r => ({ household_id: householdId, invited_role: r, created_by: profile.id })))
    const { data } = await supabase.from('invites').select('*').eq('household_id', householdId).order('created_at')
    return data || []
  }

  useEffect(() => { load() }, [householdId])

  const isManager = household?.created_by === profile.id
  const myRole = members.find(m => m.user_id === profile.id)?.member_role
  const canWrite = myRole === 'buyer' || myRole === 'builder'
  const inviteFor = (role) => invites.find(i => i.invited_role === role)

  function copyLink(inv) {
    navigator.clipboard.writeText(`${window.location.origin}/?join=${inv.code}`)
    setCopied(inv.id)
    setTimeout(() => setCopied(''), 2200)
  }

  async function removeMember(m) {
    if (!window.confirm(`Remove ${m.profiles?.full_name} from this home? They will lose access to its record.`)) return
    const { error } = await supabase.from('household_members').delete()
      .eq('household_id', householdId).eq('user_id', m.user_id)
    if (error) setError(error.message)
    else load()
  }

  async function deleteHome() {
    const typed = window.prompt(
      `This permanently deletes "${household.name}" — every issue, photo, message, and member access — for everyone. This cannot be undone.\n\nType the home name to confirm:`)
    if (typed === null) return
    if (typed.trim() !== household.name) { setError('Name did not match — home was not deleted.'); return }
    const { error } = await supabase.from('households').delete().eq('id', householdId)
    if (error) setError(error.message)
    else back()
  }

  async function leaveHome() {
    if (!window.confirm('Leave this home? You will lose access to its record unless re-invited.')) return
    const { error } = await supabase.from('household_members').delete()
      .eq('household_id', householdId).eq('user_id', profile.id)
    if (error) setError(error.message)
    else back()
  }

  if (!household || issues === null) return <div className="spinner" />

  const metricsById = {}
  issues.forEach(i => { metricsById[i.id] = issueMetrics(i, events, msgMeta) })
  const avgResponse = avg(issues.map(i => metricsById[i.id].response))
  const avgAck = avg(issues.map(i => metricsById[i.id].ack))
  const avgResolve = avg(issues.map(i => metricsById[i.id].resolve))

  const filtered = issues.filter(i =>
    filter === 'all' ? true :
    filter === 'active' ? !['resolved', 'closed'].includes(i.status) :
    ['resolved', 'closed'].includes(i.status))

  const inviteRoleSuggestion = profile.role === 'builder' ? 'buyer' : 'builder'
  const openCount = issues.filter(i => i.status === 'open').length
  const repairCount = issues.filter(i => ['acknowledged', 'scheduled', 'dispatched', 'in_progress'].includes(i.status)).length
  const doneCount = issues.filter(i => ['resolved', 'closed'].includes(i.status)).length

  return (
    <>
      <button className="crumb" onClick={back}><IArrowLeft size={15} /> All homes</button>
      <div className="page-head">
        <div>
          <h2>
            {household.name}
            {isManager && (
              <button className="inline-edit" title="Edit home details" onClick={() => setShowEditHome(true)}><IPencil size={14} /></button>
            )}
          </h2>
          <div className="muted">{household.address}</div>
        </div>
        {canWrite ? (
          <button className="btn btn-accent" onClick={() => setShowNew(true)}>
            <IPlus size={15} /> {profile.role === 'builder' ? 'Log issue' : 'Report issue'}
          </button>
        ) : (
          <span className="badge viewer-badge">View-only access</span>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}

      {issues.length > 0 && (
        <div className="stats-strip">
          <div className="stat amber"><span className="n">{openCount}</span><span className="l">Awaiting review</span></div>
          <div className="stat blue"><span className="n">{repairCount}</span><span className="l">In repair</span></div>
          <div className="stat green"><span className="n">{doneCount}</span><span className="l">Resolved</span></div>
          <div className="stat plain"><span className="n">{fmtDuration(avgResponse) || '—'}</span><span className="l">Avg first response</span></div>
          <div className="stat plain"><span className="n">{fmtDuration(avgAck) || '—'}</span><span className="l">Avg to acknowledge</span></div>
          <div className="stat plain"><span className="n">{fmtDuration(avgResolve) || '—'}</span><span className="l">Avg to resolve</span></div>
        </div>
      )}

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
                <h3>No {filter === 'active' ? 'active' : filter === 'done' ? 'resolved' : ''} issues</h3>
                {filter === 'active' && <p className="muted">Report an issue to start a documented warranty conversation.</p>}
              </div>
            ) : filtered.map(issue => {
              const sm = statusMeta(issue.status)
              const met = metricsById[issue.id]
              const active = !['resolved', 'closed'].includes(issue.status)
              return (
                <div key={issue.id} className="issue-row" onClick={() => openIssue(issue.id)}>
                  <div className="ir-main">
                    <div className="ir-title">
                      {issue.title}
                      {issue.priority === 'urgent' && <span className="prio-urgent">urgent</span>}
                      {issue.priority === 'high' && <span className="prio-high">high</span>}
                    </div>
                    <div className="ir-sub">{issue.category} · updated {timeAgo(issue.updated_at)}</div>
                    <div className="ir-metrics">
                      <IClock size={12} />
                      {met.response != null
                        ? <span>response {fmtDuration(met.response)}</span>
                        : active
                          ? <span className="pending">awaiting response · {timeAgo(issue.created_at).replace(' ago', '')}</span>
                          : <span>no response logged</span>}
                      {met.ack != null && <span>· acknowledged {fmtDuration(met.ack)}</span>}
                      {met.resolve != null && <span>· resolved {fmtDuration(met.resolve)}</span>}
                    </div>
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
                <div className={`avatar ${m.member_role === 'builder' ? 'builder' : ''} ${m.member_role === 'viewer' ? 'viewer' : ''}`}>{initials(m.profiles?.full_name)}</div>
                <div className="mr-info">
                  <div className="mr-name">
                    {m.profiles?.full_name}{m.user_id === profile.id ? ' (you)' : ''}
                    {m.user_id === household.created_by && <span className="mgr-chip">Manager</span>}
                  </div>
                  <div className="mr-sub">{m.member_role === 'viewer' ? 'viewer (read-only)' : m.member_role}{m.profiles?.company ? ` · ${m.profiles.company}` : ''}</div>
                </div>
                {isManager && m.user_id !== profile.id && (
                  <button className="member-remove" title="Remove from home" onClick={() => removeMember(m)}><IX size={14} /></button>
                )}
              </div>
            ))}
            {!isManager && (
              <button className="linklike danger" style={{ marginTop: 8 }} onClick={leaveHome}>Leave this home</button>
            )}
          </div>

          {canWrite && (
            <div className="card side-card">
              <h4>Share this home</h4>
              <p className="muted" style={{ marginTop: 0 }}>
                Send a link to the other party — it opens the app and joins them to this home after they create an account.
              </p>
              <ShareBlock
                primary
                label={profile.role === 'builder' ? 'Homebuyer invite' : 'Builder invite'}
                inv={inviteFor(inviteRoleSuggestion)}
                copied={copied}
                onCopy={copyLink}
              />
              <ShareBlock
                label={profile.role === 'builder' ? 'Another builder' : 'Another buyer'}
                inv={inviteFor(profile.role)}
                copied={copied}
                onCopy={copyLink}
              />
              <ShareBlock
                label="View-only guest"
                hint="For a lawyer, agent, or inspector — they can follow every issue and message but cannot change anything."
                inv={inviteFor('viewer')}
                copied={copied}
                onCopy={copyLink}
              />
            </div>
          )}
        </div>
      </div>

      {isManager && (
        <div className="two-col" style={{ marginTop: 4 }}>
          <div />
          <div className="card side-card danger-card">
            <h4><ITrash size={12} /> Danger zone</h4>
            <p className="muted" style={{ marginTop: 0 }}>
              Permanently delete this home and its entire record for all members.
            </p>
            <button className="btn btn-ghost btn-sm danger-btn" onClick={deleteHome}>Delete this home…</button>
          </div>
        </div>
      )}

      {showNew && (
        <NewIssueModal
          householdId={householdId}
          profile={profile}
          close={() => setShowNew(false)}
          done={(id) => { setShowNew(false); load(); openIssue(id) }}
        />
      )}
      {showEditHome && (
        <EditHomeModal
          household={household}
          close={() => setShowEditHome(false)}
          done={() => { setShowEditHome(false); load() }}
        />
      )}
    </>
  )
}

function ShareBlock({ label, inv, copied, onCopy, primary, hint }) {
  if (!inv) return null
  return (
    <div className={`share-block ${primary ? 'primary' : ''}`}>
      <div className="sb-label">{label}</div>
      {hint && <p className="muted" style={{ margin: '0 0 9px', fontSize: 12 }}>{hint}</p>}
      <button className={`btn btn-sm ${primary ? 'btn-accent' : 'btn-ghost'}`} style={{ width: '100%' }} onClick={() => onCopy(inv)}>
        {copied === inv.id ? <><ICheck size={14} /> Link copied</> : <><ILink size={14} /> Copy invite link</>}
      </button>
      <div className="sb-code">or share code: <b>{inv.code}</b></div>
    </div>
  )
}

function EditHomeModal({ household, close, done }) {
  const [name, setName] = useState(household.name)
  const [address, setAddress] = useState(household.address || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('')
    const { error } = await supabase.from('households').update({
      name: name.trim(), address: address.trim(),
    }).eq('id', household.id)
    setBusy(false)
    if (error) return setError(error.message)
    done()
  }

  return (
    <div className="modal-back" onClick={close}>
      <div className="card modal" onClick={e => e.stopPropagation()}>
        <h3>Edit home</h3>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Home name</label>
            <input value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Address</label>
            <input value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={close}>Cancel</button>
            <button className="btn btn-accent" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </div>
    </div>
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
  const camRef = useRef(null)
  const galRef = useRef(null)

  function addFiles(e) {
    const list = [...files, ...Array.from(e.target.files || [])].slice(0, 6)
    setFiles(list)
    setPreviews(list.map(f => URL.createObjectURL(f)))
    e.target.value = ''
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
            <div className="photo-buttons">
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => camRef.current?.click()}><ICamera size={14} /> Take photo</button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => galRef.current?.click()}><IImage size={14} /> Choose photos</button>
            </div>
            <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={addFiles} />
            <input ref={galRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={addFiles} />
            {previews.length > 0 && (
              <div className="photo-thumbs">
                {previews.map((src, i) => <img key={i} src={src} alt="" />)}
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={close}>Cancel</button>
            <button className="btn btn-accent" disabled={busy}>{busy ? 'Submitting…' : 'Submit issue'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
