import { ILogoMark } from './Icons'

export default function Logo({ onDark = false }) {
  return (
    <div className={`logo-row ${onDark ? 'on-dark' : ''}`}>
      <span className="logo-mark"><ILogoMark size={20} /></span>
      <span className="logo-word">Warranty<em>Bridge</em></span>
    </div>
  )
}
