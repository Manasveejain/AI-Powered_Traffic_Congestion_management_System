import { RiskBadge } from './Ui'

const typeConfig = {
  fast:  { icon: '⚡', accentColor: '#3b82f6' },
  cheap: { icon: '💰', accentColor: '#2ed573' },
  ai:    { icon: '◎',  accentColor: '#8b5cf6' },
}

export default function RouteCard({ route }) {
  const cfg = typeConfig[route.type] || typeConfig.fast
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderLeft: `3px solid ${cfg.accentColor}`, borderRadius: 'var(--radius-lg)',
      padding: '1.25rem 1.5rem', position: 'relative',
    }}>
      {route.type === 'ai' && (
        <span style={{
          position: 'absolute', top: '14px', right: '14px',
          background: 'rgba(139,92,246,0.15)', color: '#a78bfa',
          fontFamily: 'var(--mono)', fontSize: '10px', fontWeight: 700,
          padding: '3px 9px', borderRadius: '100px', letterSpacing: '0.06em',
        }}>AI PICK</span>
      )}
      <p style={{ fontWeight: 600, fontSize: '15px', marginBottom: '14px' }}>
        {cfg.icon} {route.label || (route.type === 'fast' ? 'Fastest Route' : route.type === 'cheap' ? 'Toll-Free Route' : 'AI Recommended')}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
        <div>
          <p style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px', fontFamily:'var(--mono)' }}>ETA</p>
          <p style={{ fontFamily:'var(--mono)', fontSize:'1.4rem', fontWeight:700 }}>{route.time}<span style={{ fontSize:'12px', color:'var(--text-muted)', fontWeight:400, marginLeft:'3px' }}>min</span></p>
        </div>
        <div>
          <p style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px', fontFamily:'var(--mono)' }}>Toll</p>
          <p style={{ fontFamily:'var(--mono)', fontSize:'1.4rem', fontWeight:700, color: route.toll === 0 ? 'var(--green)' : cfg.accentColor }}>
            {route.toll === 0 ? 'FREE' : `₹${route.toll}`}
          </p>
        </div>
        <div>
          <p style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px', fontFamily:'var(--mono)' }}>Traffic</p>
          <RiskBadge level={route.traffic} />
        </div>
      </div>
    </div>
  )
}