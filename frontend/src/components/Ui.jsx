/* ── Shared micro-components used across pages ── */

/** Card wrapper */
export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '1.25rem',
      ...style,
    }}>
      {children}
    </div>
  )
}

/** Section label above content */
export function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: 11,
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: 12,
    }}>
      {children}
    </p>
  )
}

/** Page heading + optional subtitle */
export function PageHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h1>{title}</h1>
      {sub && <p>{sub}</p>}
    </div>
  )
}

/** Risk badge pill */
export function RiskBadge({ level }) {
  const map = {
    High:   { bg: 'var(--red-dim)',    color: 'var(--red)'    },
    Medium: { bg: 'var(--amber-dim)',  color: 'var(--amber)'  },
    Med:    { bg: 'var(--amber-dim)',  color: 'var(--amber)'  },
    Low:    { bg: 'var(--green-dim)',  color: 'var(--green)'  },
  }
  const style = map[level] || map.Low
  return (
    <span style={{
      fontFamily: 'var(--mono)',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.04em',
      padding: '3px 9px',
      borderRadius: 100,
      background: style.bg,
      color: style.color,
    }}>
      {level.toUpperCase()}
    </span>
  )
}

/** Animated pulse dot */
export function PulseDot({ color = 'var(--green)' }) {
  return (
    <>
      <style>{`@keyframes dotPulse{0%,100%{opacity:1}50%{opacity:0.25}}`}</style>
      <span style={{
        display: 'inline-block',
        width: 7, height: 7,
        borderRadius: '50%',
        background: color,
        animation: 'dotPulse 2s infinite',
      }} />
    </>
  )
}