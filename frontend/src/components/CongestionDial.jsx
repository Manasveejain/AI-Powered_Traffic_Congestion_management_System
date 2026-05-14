export default function CongestionDial({ value = 0, level = 'Low' }) {
  const R = 54
  const cx = 70, cy = 70
  const startAngle = -210
  const endAngle   = 30
  const totalArc   = endAngle - startAngle

  const color = level === 'High'   ? '#ff4757'
              : level === 'Medium' ? '#ffa502'
              :                      '#2ed573'

  const toRad = d => (d * Math.PI) / 180
  const arcEnd = startAngle + (value / 100) * totalArc

  const arcPath = (a1, a2, r) => {
    const x1 = cx + r * Math.cos(toRad(a1))
    const y1 = cy + r * Math.sin(toRad(a1))
    const x2 = cx + r * Math.cos(toRad(a2))
    const y2 = cy + r * Math.sin(toRad(a2))
    const large = a2 - a1 > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }

  return (
    <svg viewBox="0 0 140 110" width="140" height="110" aria-label={`Congestion: ${value}%`}>
      <path d={arcPath(startAngle, endAngle, R)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" strokeLinecap="round"/>
      {value > 0 && (
        <path d={arcPath(startAngle, arcEnd, R)} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          style={{ transition: 'all 0.6s cubic-bezier(0.34,1.2,0.64,1)' }}/>
      )}
      <text x={cx} y={cy + 6} textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="20" fontWeight="700" fill={color} style={{ transition: 'fill 0.3s' }}>
        {value}%
      </text>
      <text x={cx} y={cy + 22} textAnchor="middle" fontFamily="'DM Sans', sans-serif" fontSize="10" fill="rgba(255,255,255,0.4)">
        {level.toUpperCase()}
      </text>
      <text x="20" y="98" fontFamily="'Space Mono',monospace" fontSize="8" fill="rgba(255,255,255,0.25)">0</text>
      <text x="110" y="98" fontFamily="'Space Mono',monospace" fontSize="8" fill="rgba(255,255,255,0.25)">100</text>
    </svg>
  )
}