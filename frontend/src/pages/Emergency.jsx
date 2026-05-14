import { useState, useEffect } from 'react'
import axios from 'axios'
import { PageHeader, Card, SectionLabel } from '../components/Ui'

const API = '/api/traffic'

const VEHICLE_TYPES = [
  { value:'AMBULANCE',  label:'🚑 Ambulance',  priority:'CRITICAL' },
  { value:'FIRE_TRUCK', label:'🚒 Fire Truck',  priority:'CRITICAL' },
  { value:'POLICE',     label:'🚔 Police',      priority:'HIGH'     },
  { value:'RESCUE',     label:'🚁 Rescue',      priority:'HIGH'     },
]

const PRIORITY_COLOR = { CRITICAL:'var(--red)', HIGH:'var(--amber)' }

// Map a DB history record → display shape (same as API response)
function mapHistoryRecord(r) {
  return {
    vehicleType:      r.vehicleType,
    priority:         r.priority,
    origin:           r.origin,
    destination:      r.destination,
    estimatedMinutes: r.estimatedMinutes,
    corridorActive:   r.corridorActive,
    broadcastMessage: r.broadcastMessage,
    clearedSignals:   [],   // not stored in DB, show empty
    route:            { name:'Emergency Priority Corridor', distanceKm:'—', via:[] },
    savedAt:          r.createdAt,
  }
}

export default function Emergency() {
  const [vehicleType,  setVehicleType]  = useState('AMBULANCE')
  const [origin,       setOrigin]       = useState('City Hospital')
  const [destination,  setDestination]  = useState('Accident Site, NH-48')
  const [result,       setResult]       = useState(null)
  const [history,      setHistory]      = useState([])
  const [loading,      setLoading]      = useState(false)
  const [histLoading,  setHistLoading]  = useState(true)

  // ── Load history from DB on mount ─────────────────────────────────────────
  useEffect(() => {
    const loadHistory = async () => {
      setHistLoading(true)
      try {
        const res = await axios.get(`${API}/history/emergency`)
        const records = res.data || []
        setHistory(records)
        // Pre-populate the result panel with the most recent activation
        if (records.length > 0) {
          setResult(mapHistoryRecord(records[0]))
        }
      } catch {
        // DB unavailable — start empty
      }
      setHistLoading(false)
    }
    loadHistory()
  }, [])

  // ── Activate new emergency corridor ───────────────────────────────────────
  const activate = async () => {
    setLoading(true)
    try {
      const res = await axios.post(`${API}/emergency-route`, {
        vehicleType,
        origin,
        destination,
      })
      const newResult = res.data
      setResult(newResult)
      // Refresh history list
      const hist = await axios.get(`${API}/history/emergency`)
      setHistory(hist.data || [])
    } catch {
      // Fallback demo data (API down)
      const fallback = {
        vehicleType,
        priority:         VEHICLE_TYPES.find(v => v.value === vehicleType)?.priority || 'HIGH',
        origin,
        destination,
        estimatedMinutes: 7,
        corridorActive:   true,
        clearedSignals:   ['Signal-1','Signal-2','Signal-3','Signal-4','Signal-5'],
        route:            { name:'Emergency Priority Corridor', distanceKm: 4.2, via:['Emergency Lane 1','Priority Junction','Fast Track Road'] },
        broadcastMessage: `${vehicleType} en route — please clear the road`,
      }
      setResult(fallback)
    }
    setLoading(false)
  }

  const inputStyle = {
    background:'var(--surface2)', border:'1px solid var(--border2)',
    color:'var(--text)', borderRadius:'var(--radius-md)',
    padding:'8px 12px', fontSize:'13px', fontFamily:'var(--sans)',
    outline:'none', width:'100%',
  }

  const priority = VEHICLE_TYPES.find(v => v.value === vehicleType)?.priority || 'HIGH'
  const pColor   = PRIORITY_COLOR[priority] || 'var(--amber)'

  return (
    <div>
      <PageHeader
        title="Emergency Vehicle Priority"
        sub="Activate green-wave corridor for emergency vehicles — clears signals along the route"
      />

      {/* Activation form */}
      <Card style={{ marginBottom:'1.25rem' }}>
        <SectionLabel>Activate Emergency Corridor</SectionLabel>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:'12px', alignItems:'flex-end' }}>
          <div>
            <label style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:'var(--mono)', display:'block', marginBottom:'6px' }}>Vehicle Type</label>
            <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} style={inputStyle}>
              {VEHICLE_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:'var(--mono)', display:'block', marginBottom:'6px' }}>Origin</label>
            <input value={origin} onChange={e => setOrigin(e.target.value)} style={inputStyle} placeholder="e.g. City Hospital"/>
          </div>
          <div>
            <label style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:'var(--mono)', display:'block', marginBottom:'6px' }}>Destination</label>
            <input value={destination} onChange={e => setDestination(e.target.value)} style={inputStyle} placeholder="e.g. Accident Site"/>
          </div>
          <button onClick={activate} disabled={loading} style={{
            background:'var(--red)', color:'#fff', border:'none',
            borderRadius:'var(--radius-md)', padding:'9px 22px',
            fontSize:'13px', fontWeight:600, fontFamily:'var(--sans)',
            cursor:'pointer', opacity: loading ? 0.6 : 1, whiteSpace:'nowrap',
          }}>{loading ? 'Activating…' : '🚨 Activate'}</button>
        </div>
        <div style={{ marginTop:'10px', display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>Priority level:</span>
          <span style={{ fontFamily:'var(--mono)', fontSize:'11px', fontWeight:700, color:pColor }}>{priority}</span>
        </div>
      </Card>

      {/* Active corridor result */}
      {result && (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
            <SectionLabel>
              {result.savedAt
                ? `Last Activation — ${new Date(result.savedAt).toLocaleString()}`
                : 'Active Corridor'}
            </SectionLabel>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.5rem' }}>
            <Card style={{ borderLeft:`3px solid ${PRIORITY_COLOR[result.priority] || 'var(--amber)'}` }}>
              <SectionLabel>Corridor Status</SectionLabel>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
                <span style={{
                  fontFamily:'var(--mono)', fontSize:'12px', fontWeight:700,
                  padding:'4px 12px', borderRadius:100,
                  background: result.corridorActive ? 'var(--green-dim)' : 'var(--red-dim)',
                  color: result.corridorActive ? 'var(--green)' : 'var(--red)',
                }}>{result.corridorActive ? '● ACTIVE' : '○ INACTIVE'}</span>
                <span style={{ fontFamily:'var(--mono)', fontSize:'12px', color:'var(--text-muted)' }}>
                  Priority: <span style={{ color: PRIORITY_COLOR[result.priority] || 'var(--amber)', fontWeight:700 }}>{result.priority}</span>
                </span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                <div>
                  <p style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:'var(--mono)', textTransform:'uppercase', marginBottom:'4px' }}>ETA</p>
                  <p style={{ fontFamily:'var(--mono)', fontSize:'1.6rem', fontWeight:700, color:'var(--teal)' }}>
                    {result.estimatedMinutes}<span style={{ fontSize:'12px', color:'var(--text-muted)', marginLeft:'3px' }}>min</span>
                  </p>
                </div>
                <div>
                  <p style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:'var(--mono)', textTransform:'uppercase', marginBottom:'4px' }}>Distance</p>
                  <p style={{ fontFamily:'var(--mono)', fontSize:'1.6rem', fontWeight:700 }}>
                    {result.route?.distanceKm}<span style={{ fontSize:'12px', color:'var(--text-muted)', marginLeft:'3px' }}>km</span>
                  </p>
                </div>
              </div>
              <p style={{ fontSize:'12px', color:'var(--text-dim)', marginBottom:'6px' }}><strong>Vehicle:</strong> {result.vehicleType}</p>
              <p style={{ fontSize:'12px', color:'var(--text-dim)', marginBottom:'6px' }}><strong>From:</strong> {result.origin}</p>
              <p style={{ fontSize:'12px', color:'var(--text-dim)', marginBottom:'6px' }}><strong>To:</strong> {result.destination}</p>
              {result.route?.via?.length > 0 && (
                <p style={{ fontSize:'12px', color:'var(--text-dim)' }}><strong>Via:</strong> {result.route.via.join(' → ')}</p>
              )}
            </Card>

            <Card>
              <SectionLabel>Cleared Signals ({result.clearedSignals?.length || 0})</SectionLabel>
              {result.clearedSignals?.length > 0 ? (
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'16px' }}>
                  {result.clearedSignals.map((s, i) => (
                    <span key={i} style={{
                      fontFamily:'var(--mono)', fontSize:'11px', fontWeight:600,
                      padding:'3px 10px', borderRadius:100,
                      background:'var(--green-dim)', color:'var(--green)',
                    }}>✓ {s}</span>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'16px' }}>Signal data not stored in DB — available on live activation.</p>
              )}
              <SectionLabel>Broadcast Message</SectionLabel>
              <div style={{
                background:'var(--red-dim)', border:'1px solid var(--red)',
                borderRadius:'var(--radius-md)', padding:'10px 14px',
              }}>
                <p style={{ fontSize:'13px', color:'var(--red)', fontWeight:500 }}>
                  🚨 {result.broadcastMessage}
                </p>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* History table */}
      <Card>
        <SectionLabel>Activation History ({history.length} records)</SectionLabel>
        {histLoading ? (
          <p style={{ fontSize:'13px', color:'var(--text-muted)' }}>Loading history…</p>
        ) : history.length === 0 ? (
          <p style={{ fontSize:'13px', color:'var(--text-muted)' }}>No activations yet. Press Activate to create the first one.</p>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
              <thead>
                <tr>
                  {['Time','Vehicle','Priority','Origin','Destination','ETA','Status'].map(h => (
                    <th key={h} style={{
                      textAlign:'left', padding:'6px 10px',
                      fontSize:'10px', color:'var(--text-muted)',
                      fontFamily:'var(--mono)', textTransform:'uppercase',
                      letterSpacing:'0.06em', borderBottom:'1px solid var(--border)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((r, i) => (
                  <tr key={r.id || i} style={{ borderBottom:'1px solid var(--border)' }}
                    onMouseOver={e => e.currentTarget.style.background='var(--surface2)'}
                    onMouseOut={e  => e.currentTarget.style.background='transparent'}
                  >
                    <td style={{ padding:'8px 10px', color:'var(--text-muted)', fontFamily:'var(--mono)', whiteSpace:'nowrap' }}>
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding:'8px 10px', fontWeight:500 }}>{r.vehicleType}</td>
                    <td style={{ padding:'8px 10px' }}>
                      <span style={{
                        fontFamily:'var(--mono)', fontSize:'10px', fontWeight:700,
                        padding:'2px 8px', borderRadius:100,
                        background: r.priority === 'CRITICAL' ? 'var(--red-dim)' : 'var(--amber-dim)',
                        color: r.priority === 'CRITICAL' ? 'var(--red)' : 'var(--amber)',
                      }}>{r.priority}</span>
                    </td>
                    <td style={{ padding:'8px 10px', color:'var(--text-dim)' }}>{r.origin}</td>
                    <td style={{ padding:'8px 10px', color:'var(--text-dim)' }}>{r.destination}</td>
                    <td style={{ padding:'8px 10px', fontFamily:'var(--mono)', color:'var(--teal)' }}>{r.estimatedMinutes} min</td>
                    <td style={{ padding:'8px 10px' }}>
                      <span style={{
                        fontFamily:'var(--mono)', fontSize:'10px', fontWeight:700,
                        padding:'2px 8px', borderRadius:100,
                        background: r.corridorActive ? 'var(--green-dim)' : 'var(--red-dim)',
                        color: r.corridorActive ? 'var(--green)' : 'var(--red)',
                      }}>{r.corridorActive ? 'ACTIVE' : 'INACTIVE'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
