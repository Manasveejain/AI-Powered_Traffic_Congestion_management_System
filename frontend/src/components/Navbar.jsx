import { NavLink } from 'react-router-dom'

const links = [
  { to: '/',          label: 'Dashboard', icon: '▦' },
  { to: '/map',       label: 'Heatmap',   icon: '◈' },
  { to: '/routes',    label: 'Routes',    icon: '⇌' },
  { to: '/alerts',    label: 'Alerts',    icon: '◉' },
  { to: '/emergency', label: 'Emergency', icon: '🚨' },
  { to: '/chatbot',   label: 'Assistant', icon: '⬡' },
]

const navStyle = {
  background: 'var(--surface)',
  borderBottom: '1px solid var(--border)',
  padding: '0 1.5rem',
  display: 'flex',
  alignItems: 'center',
  height: 52,
  position: 'sticky',
  top: 0,
  zIndex: 100,
  gap: 0,
}

const logoStyle = {
  fontFamily: 'var(--mono)',
  fontSize: 12,
  color: 'var(--teal)',
  letterSpacing: '0.06em',
  marginRight: '2rem',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const dotStyle = {
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: 'var(--teal)',
  animation: 'navPulse 2s infinite',
}

export default function Navbar() {
  return (
    <>
      <style>{`
        @keyframes navPulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
        .nav-link {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 52px;
          padding: 0 14px;
          font-size: 13px;
          color: var(--text-muted);
          text-decoration: none;
          border-bottom: 2px solid transparent;
          transition: color 0.15s, border-color 0.15s;
          white-space: nowrap;
          letter-spacing: 0.01em;
        }
        .nav-link:hover { color: var(--text); }
        .nav-link.active { color: var(--teal); border-bottom-color: var(--teal); }
        .nav-icon { font-size: 15px; opacity: 0.7; }
      `}</style>

      <nav style={navStyle}>
        <div style={logoStyle}>
          <div style={dotStyle} />
          SMARTTRAFFIC / AI
        </div>
        <div style={{ display: 'flex', gap: 0 }}>
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  )
}