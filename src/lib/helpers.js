export const STATUSES = [
  { value: 'open',         label: 'Open',                  color: '#b45309', bg: '#fef3c7', desc: 'Reported by the homeowner, awaiting builder review' },
  { value: 'acknowledged', label: 'Acknowledged',          color: '#1d4ed8', bg: '#dbeafe', desc: 'Builder has seen the issue and accepted it for review' },
  { value: 'scheduled',    label: 'Repair scheduled',      color: '#6d28d9', bg: '#ede9fe', desc: 'A repair visit has been scheduled' },
  { value: 'dispatched',   label: 'Service dispatched',    color: '#0e7490', bg: '#cffafe', desc: 'Repair crew or trade partner has been dispatched' },
  { value: 'in_progress',  label: 'Work in progress',      color: '#a16207', bg: '#fef9c3', desc: 'Repair work is underway' },
  { value: 'resolved',     label: 'Resolved',              color: '#15803d', bg: '#dcfce7', desc: 'Work completed — awaiting homeowner confirmation' },
  { value: 'closed',       label: 'Closed',                color: '#475569', bg: '#e2e8f0', desc: 'Confirmed complete and closed' },
]

export const CATEGORIES = [
  'plumbing', 'electrical', 'HVAC', 'drywall & paint', 'flooring', 'roofing',
  'windows & doors', 'appliances', 'foundation & structure', 'exterior & siding', 'landscaping', 'other',
]

export const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export function statusMeta(value) {
  return STATUSES.find(s => s.value === value) || STATUSES[0]
}

export function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return fmtDate(iso)
}

export function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}
