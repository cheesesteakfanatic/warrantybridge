import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase, uploadImage, publicUrl } from '../lib/supabase'
import { STATUSES, statusMeta, fmtDateTime, initials } from '../lib/helpers'

export default function IssueDetail({ issueId, profile, back }) {
  const [issue, setIssue] = useState(null)
  const [photos, setPhotos] = useState([])
  const [events, setEvents] = useState([])
  const [messages, setMessages] = useState([])
  const [reads, setReads] = useState([])
  const [profiles, setProfiles] = useState({})
  const [text, setText] = useState('')
  const [attach, setAttach] = useState(null)
  const [attachPreview, setAttachPreview] = useState('')
  const [sending, setSending] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [statusNote, setStatusNote] = useState('')
  const [error, setError] = useState('')
  const threadRef = useRef(null)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    const [{ data: iss }, { data: ph }, { data: ev }, { data: msgs }] = await Promise.all([
      supabase.from('issues').select('*').eq('id', issueId).maybeSingle(),
      supabase.from('issue_photos').select('*').eq('issue_id', issueId).order('created_at'),
      supabase.from('issue_events').select('*').eq('issue_id', issueId).order('created_at'),
      supabase.from('messages').select('*').eq('issue_id', issueId).order('created_at'),
    ])
    setIssue(iss); setPhotos(ph || []); setEvents(ev || []); setMessages(msgs || [])

    const ids = (msgs || []).map(m => m.id)
    if (ids.length) {
      const { data: rd } = await supabase.from('message_reads').select('*').in('message_id', ids)
      setReads(rd || [])
    } else setReads([])

    // load profiles for everyone referenced
    const uids = new Set()
    ;(msgs || []).forEach(m => uids.add(m.sender_id))
    ;(ev || []).forEach(e => e.actor_id && uids.add(e.actor_id))
    if (iss) uids.add(iss.created_by)
    if (uids.size) {
      const { data: profs } = await supabase.from('profiles').select('*').in('id', [...uids])
      const map = {}
      ;(profs || []).forEach(p => { map[p.id] = p })
      setProfiles(map)
    }

    // mark unread messages from others as read
    const unread = (msgs || []).filter(m =>
      m.sender_id !== profile.id &&
      !(reads || []).some(r => r.message_id === m.id && r.user_id === profile.id))
    if (unread.length) {
      await supabase.from('message_reads').upsert(
        unread.map(m => ({ message_id: m.id, user_id: profile.id })),
        { ignoreDuplicates: true })
      const { data: rd2 } = await supabase.from('message_reads').select('*').in('message_id', ids)
      setReads(rd2 || [])
    }
  }, [issueId, profile.id]) // eslint-disable-line

  useEffect(() => { load() }, [issueId])

  // realtime + polling fallback
  useEffect(() => {
    const ch = supabase.channel(`issue-${issueId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `issue_id=eq.${issueId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reads' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues', filter: `id=eq.${issueId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issue_events', filter: `issue_id=eq.${issueId}` }, load)
      .subscribe()
    const t = setInterval(load, 10000)
    return () => { supabase.removeChannel(ch); clearInterval(t) }
  }, [issueId, load])

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight })
  }, [messages.length])

  function pickAttach(e) {
    const f = e.target.files?.[0]
    if (f) { setAttach(f); setAttachPreview(URL.createObjectURL(f)) }
  }

  async function send(e) {
    e?.preventDefault()
    if (!text.trim() && !attach) return
    setSending(true); setError('')
    try {
      let imagePath = null
      if (attach) imagePath = await uploadImage(attach)
      const { error: e1 } = await supabase.from('messages').insert({
        issue_id: issueId,
        household_id: issue.household_id,
        sender_id: profile.id,
        body: text.trim(),
        image_path: imagePath,
      })
      if (e1) throw e1
      setText(''); setAttach(null); setAttachPreview('')
      if (fileRef.current) fileRef.current.value = ''
      await load()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setSending(false)
    }
  }

  async function changeStatus(newStatus) {
    if (!newStatus || newStatus === issue.status) return
    setStatusBusy(true); setError('')
    const { error: e1 } = await supabase.from('issues').update({ status: newStatus }).eq('id', issue.id)
    if (e1) setError(e1.message)
    else if (statusNote.trim()) {
      await supabase.from('issue_events').insert({
        issue_id: issue.id, actor_id: profile.id, event_type: 'note', note: statusNote.trim(),
      })
      setStatusNote('')
    }
    await load()
    setStatusBusy(false)
  }

  if (!issue) return <div className="spinner" />
  const sm = statusMeta(issue.status)
  const reporter = profiles[issue.created_by]

  function readBy(msg) {
    return reads.filter(r => r.message_id === msg.id && r.user_id !== msg.sender_id)
  }

  return (
    <>
      <button className="crumb" onClick={back}>← Back to home</button>

      <div className="card detail-head">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <h2>{issue.title}</h2>
          <span className="badge" style={{ color: sm.color, background: sm.bg, fontSize: 13, padding: '6px 14px' }}>
            <span className="dot" />{sm.label}
          </span>
        </div>
        <div className="detail-meta">
          <span>Reported by <b>{reporter?.full_name || '—'}</b></span>
          <span>·</span>
          <span>{fmtDateTime(issue.created_at)}</span>
          <span>·</span>
          <span style={{ textTransform: 'capitalize' }}>{issue.category}</span>
          <span>·</span>
          <span style={{ textTransform: 'capitalize' }}>Priority: {issue.priority}</span>
        </div>
        {issue.description && <div className="detail-desc">{issue.description}</div>}
        {photos.length > 0 && (
          <div className="photo-thumbs" style={{ marginTop: 14 }}>
            {photos.map(p => (
              <a key={p.id} href={publicUrl(p.path)} target="_blank" rel="noreferrer">
                <img src={publicUrl(p.path)} alt="issue photo" />
              </a>
            ))}
          </div>
        )}
        <div className="status-select-row">
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-600)' }}>Update status:</label>
          <select value={issue.status} onChange={e => changeStatus(e.target.value)} disabled={statusBusy}>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input
            style={{ flex: 1, minWidth: 180, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}
            placeholder="Optional note with your next status change…"
            value={statusNote}
            onChange={e => setStatusNote(e.target.value)}
          />
        </div>
        <div className="muted" style={{ marginTop: 8 }}>{sm.desc}.</div>
      </div>

      {error && <div className="error-box" style={{ marginTop: 14 }}>{error}</div>}

      <div className="section-title">Activity & repair timeline</div>
      <div className="card" style={{ padding: '14px 22px' }}>
        <div className="timeline">
          {events.length === 0 && <div className="muted">No activity yet.</div>}
          {events.map((ev, i) => {
            const actor = profiles[ev.actor_id]
            const meta = ev.new_status ? statusMeta(ev.new_status) : null
            return (
              <div key={ev.id} className="tl-item">
                <div className="tl-rail">
                  <div className="tl-dot" style={{ background: meta ? meta.color : 'var(--teal-600)' }} />
                  {i < events.length - 1 && <div className="tl-line" />}
                </div>
                <div className="tl-body">
                  {ev.event_type === 'status_change' ? (
                    <><b>{actor?.full_name || 'System'}</b> changed status from <b>{statusMeta(ev.old_status).label}</b> to <b style={{ color: meta.color }}>{meta.label}</b></>
                  ) : ev.event_type === 'created' ? (
                    <><b>{actor?.full_name}</b> reported this issue</>
                  ) : (
                    <><b>{actor?.full_name}</b>: {ev.note}</>
                  )}
                  {ev.event_type !== 'note' && ev.note && ev.event_type !== 'created' && <> — “{ev.note}”</>}
                  <div className="tl-when">{fmtDateTime(ev.created_at)}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="section-title">Messages</div>
      <div className="card">
        <div className="thread" ref={threadRef}>
          {messages.length === 0 && (
            <div className="muted" style={{ textAlign: 'center', padding: 20 }}>
              No messages yet. Everything you write here is part of the permanent warranty record.
            </div>
          )}
          {messages.map(m => {
            const mine = m.sender_id === profile.id
            const sender = profiles[m.sender_id]
            const rb = readBy(m)
            return (
              <div key={m.id} className={`msg ${mine ? 'mine' : ''}`}>
                <div className={`avatar ${sender?.role === 'builder' ? '' : 'teal'}`} title={sender?.full_name}>
                  {initials(sender?.full_name)}
                </div>
                <div>
                  <div className="msg-bubble">
                    {m.body}
                    {m.image_path && (
                      <a href={publicUrl(m.image_path)} target="_blank" rel="noreferrer">
                        <img src={publicUrl(m.image_path)} alt="attachment" />
                      </a>
                    )}
                  </div>
                  <div className="msg-meta">
                    <span>{sender?.full_name?.split(' ')[0]}</span>
                    <span>·</span>
                    <span>{fmtDateTime(m.created_at)}</span>
                    {mine && (
                      rb.length > 0
                        ? <span className="read-check" title={`Read ${fmtDateTime(rb[0].read_at)}`}>✓✓ Read</span>
                        : <span title="Delivered">✓ Sent</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {attachPreview && (
          <div className="attach-preview">
            <img src={attachPreview} alt="" />
            <span>{attach?.name}</span>
            <button onClick={() => { setAttach(null); setAttachPreview(''); if (fileRef.current) fileRef.current.value = '' }}>Remove</button>
          </div>
        )}
        <form className="composer" onSubmit={send}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickAttach} />
          <button type="button" className="icon-btn" title="Attach photo" onClick={() => fileRef.current?.click()}>📷</button>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Write a message… (Enter to send, Shift+Enter for newline)"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          />
          <button className="btn btn-teal" disabled={sending || (!text.trim() && !attach)}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      </div>
    </>
  )
}
