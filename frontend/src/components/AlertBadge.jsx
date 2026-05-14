export default function AlertBadge({ level }) {
  const map = {
    High:   { color: 'var(--red)',   bg: 'var(--red-dim)'   },
    Medium: { color: 'var(--amber)', bg: 'var(--amber-dim)' },
    Low:    { color: 'var(--green)', bg: 'var(--green-dim)' },
  }
  const s = map[level] || map.Low
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: s.bg, color: s.color,
      fontSize: '11px', fontWeight: 700, fontFamily: 'var(--mono)',
      padding: '3px 9px', borderRadius: '100px', letterSpacing: '0.05em',
    }}>
      <span style={{ fontSize: '7px' }}>●</span>
      {level.toUpperCase()}
    </span>
  )
}