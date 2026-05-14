import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { PageHeader } from '../components/Ui'

const API = '/api/traffic'

// Flask returns severity as HIGH/MEDIUM/SEVERE — map to UI levels
function mapSeverity(s) {
  if (!s) return 'Low'
  const u = s.toUpperCase()
  if (u === 'SEVERE' || u === 'HIGH')   return 'High'
  if (u === 'MEDIUM')                   return 'Medium'
  return 'Low'
}

// Map Flask alert object → UI alert shape
function mapAlert(a) {
  return {
    level:    mapSeverity(a.severity),
    road:     a.location ? `${a.type} — ${a.location}` : (a.type || 'Unknown'),
    msg:      a.message || '',
    time:     a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : 'Just now',
    alertId:  a.alertId,
    city:     a.city,
  }
}

const MOCK = [
  { level:'High',   road:'ACCIDENT — Zone-4',       msg:'Multi-vehicle accident on Highway 1 near Junction 4. Expect 20-min delay.',    time:'Just now' },
  { level:'High',   road:'WEATHER — Zone-2',         msg:'Heavy rain causing reduced visibility on Expressway. Drive slow.',             time:'3m ago'   },
  { level:'High',   road:'SIGNAL_FAULT — Zone-7',    msg:'Traffic signal malfunction at Junction 7. Manual control in effect.',          time:'7m ago'   },
  { level:'Medium', road:'ROADWORK — Zone-5',        msg:'Road maintenance on Ring Road. Lane 2 closed until 6 PM.',                    time:'11m ago'  },
  { level:'Medium', road:'EVENT — Zone-3',           msg:'Public event at Central Park causing high footfall near Main Street.',         time:'18m ago'  },
]

const icons = { High:'🔴', Medium:'⚠️', Low:'✅' }
const accentColor = l => l === 'High' ? 'var(--red)' : l === 'Medium' ? 'var(--amber)' : 'var(--green)'
const dimColor    = l => l === 'High' ? 'var(--red-dim)' : l === 'Medium' ? 'var(--amber-dim)' : 'var(--green-dim)'

export default function Alerts() {
  const [alerts,      setAlerts]      = useState([])
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [refreshing,  setRefreshing]  = useState(false)

  const fetchAlerts = useCallback(async (spinner = false) => {
    if (spinner) setRefreshing(true)
    try {
      // POST to /api/traffic/alerts — Spring Boot proxies to Flask /alerts
      const res = await axios.post(`${API}/alerts`, { city: 'Delhi NCR' })
      const raw = res.data?.alerts || res.data || []
      setAlerts(Array.isArray(raw) ? raw.map(mapAlert) : MOCK)
    } catch {
      setAlerts(MOCK)
    }
    setLastUpdated(new Date())
    if (spinner) setTimeout(() => setRefreshing(false), 400)
  }, [])

  useEffect(() => {
    fetchAlerts()
    const id = setInterval(() => fetchAlerts(), 30_000)
    return () => clearInterval(id)
  }, [fetchAlerts])

  const highCount = alerts.filter(a => a.level === 'High').length
  const medCount  = alerts.filter(a => a.level === 'Medium').length

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem', flexWrap:'wrap', gap:'12px' }}>
        <PageHeader title="Live Alerts" sub={`${alerts.length} active — ${highCount} critical, ${medCount} moderate`}/>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <button onClick={() => fetchAlerts(true)} style={{
            background:'var(--surface2)', border:'1px solid var(--border2)',
            color: refreshing ? 'var(--teal)' : 'var(--text-muted)',
            borderRadius:'var(--radius-sm)', padding:'5px 12px',
            fontSize:'12px', fontFamily:'var(--sans)', cursor:'pointer',
          }}>{refreshing ? '↻ Refreshing…' : '↻ Refresh'}</button>
          <span style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'12px', color:'var(--text-muted)' }}>
            <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:'var(--green)', display:'inline-block', animation:'livePulse 2s infinite' }}/>
            {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      </div>

      <style>{`@keyframes livePulse{0%,100%{opacity:1}50%{opacity:0.25}}`}</style>

      {/* Summary chips */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'1.25rem', flexWrap:'wrap' }}>
        {[['High',highCount],['Medium',medCount],['Low',alerts.length-highCount-medCount]].map(([l,c]) => (
          <span key={l} style={{ fontSize:'12px', padding:'4px 12px', borderRadius:'100px', background:dimColor(l), color:accentColor(l), fontFamily:'var(--mono)', fontWeight:700 }}>
            {c} {l}
          </span>
        ))}
      </div>

      {/* Alert list */}
      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        {alerts.map((a, i) => (
          <div key={a.alertId || i} style={{
            background:'var(--surface)', border:'1px solid var(--border)',
            borderLeft:`3px solid ${accentColor(a.level)}`, borderRadius:'var(--radius-lg)',
            padding:'1rem 1.25rem', display:'flex', alignItems:'flex-start', gap:'12px',
            backgroundImage:`linear-gradient(90deg, ${dimColor(a.level)} 0%, transparent 60%)`,
          }}>
            <span style={{ fontSize:'18px', marginTop:'2px', flexShrink:0 }}>{icons[a.level]}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                <p style={{ fontWeight:500, fontSize:'14px' }}>{a.road}</p>
                <span style={{
                  fontFamily:'var(--mono)', fontSize:'10px', fontWeight:700, letterSpacing:'0.04em',
                  padding:'3px 9px', borderRadius:100,
                  background: dimColor(a.level), color: accentColor(a.level),
                }}>{a.level.toUpperCase()}</span>
              </div>
              <p style={{ fontSize:'13px', color:'var(--text-dim)', lineHeight:1.5 }}>{a.msg}</p>
            </div>
            <span style={{ fontSize:'11px', fontFamily:'var(--mono)', color:'var(--text-muted)', flexShrink:0 }}>{a.time}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
