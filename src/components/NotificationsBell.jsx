import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/helpers'
import { IBell } from './Icons'

export default function NotificationsBell({ profile, openIssue }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const load = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase.from('notifications')
      .select('*').eq('user_id', profile.id)
      .order('created_at', { ascending: false }).limit(20)
    setItems(data || [])
  }, [profile?.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!profile) return
    const ch = supabase.channel('notif-' + profile.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, load)
      .subscribe()
    const t = setInterval(load, 30000)
    return () => { supabase.removeChannel(ch); clearInterval(t) }
  }, [profile?.id, load])

  useEffect(() => {
    function onDoc(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const unread = items.filter(n => !n.read_at).length

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() })
        .eq('user_id', profile.id).is('read_at', null)
      setTimeout(load, 400)
    }
  }

  return (
    <div className="bell-wrap" ref={wrapRef}>
      <button className="bell-btn" onClick={toggle} title="Notifications">
        <IBell size={19} />
        {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-panel card">
          <div className="bell-head">Notifications</div>
          {items.length === 0 && <div className="muted" style={{ padding: '18px 16px' }}>Nothing yet. Activity on your homes will show up here.</div>}
          {items.map(n => (
            <button key={n.id} className={`bell-item ${n.read_at ? '' : 'unread'}`}
              onClick={() => { setOpen(false); if (n.issue_id) openIssue(n.issue_id, n.household_id) }}>
              <span className="bi-title">{n.title}</span>
              <span className="bi-body">{n.body}</span>
              <span className="bi-when">{timeAgo(n.created_at)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
