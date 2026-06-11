export default function Logo({ onDark = false, size = 'md' }) {
  return (
    <div className={`logo-row ${onDark ? 'on-dark' : ''}`}>
      <span className="logo-mark">
        <svg width="20" height="20" viewBox="0 0 32 32">
          <path d="M16 5 4 15h4v11h7v-7h2v7h7V15h4L16 5z" fill="#5eead4" />
        </svg>
      </span>
      WarrantyBridge
    </div>
  )
}
