import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import CongestionDial from '../components/CongestionDial'
import { RiskBadge, Card, SectionLabel } from '../components/Ui'

const API = '/api/traffic'

const SCENARIOS = [
  { label: '🌅 Morning Rush', vehicleCount: 95,  avgSpeed: 18, weather: 0 },
  { label: '🎵 Concert Day',  vehicleCount: 110, avgSpeed: 12, weather: 1 },
  { label: '😌 Quiet Sunday', vehicleCount: 30,  avgSpeed: 55, weather: 0 },
]

const TIMES = ['Now', '10m', '20m', '30m', '45m']
const LABEL_TO_RISK = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', SEVERE: 'High' }

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:'var(--radius-md)', padding:'8px 12px', fontSize:'12px', fontFamily:'var(--mono)' }}>
      <p style={{ color:'var(--text-muted)', marginBottom:'2px' }}>{label}</p>
      <p style={{ color:'var(--teal)', fontWeight:700 }}>{payload[0].value}%</p>
    </div>
  )
}

const inputStyle = {
  background:'var(--surface2)', border:'1px solid var(--border2)',
  color:'var(--text)', borderRadius:'var(--radius-md)',
  padding:'8px 12px', fontSize:'13px', fontFamily:'var(--sans)',
  outline:'none', width:'140px',
}

function ControlGroup({ label, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
      <label style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.09em', fontFamily:'var(--mono)' }}>{label}</label>
      {children}
    </div>
  )
}

export default function Dashboard() {
  const [data,         setData]         = useState(null)
  const [zones,        setZones]        = useState([])
  const [signals,      setSignals]      = useState([])
  const [stats,        setStats]        = useState(null)
  const [vehicleCount, setVehicleCount] = useState(60)
  const [avgSpeed,     setAvgSpeed]     = useState(35)
  const [weather,      setWeather]      = useState(0)
  const [activeScen,   setActiveScen]   = useState(null)
  const [loading,      setLoading]      = useState(false)

  // Refs always hold the latest values — no stale closure possible
  const vcRef  = useRef(60)
  const spdRef = useRef(35)
  const wthRef = useRef(0)

  // Keep refs in sync with state on every render
  vcRef.current  = vehicleCount
  spdRef.current = avgSpeed
  wthRef.current = weather

  // ── Core prediction function — reads from refs, never stale ───────────────
  const runPrediction = async (vc, spd, wth) => {
    setLoading(true)
    try {
      const res = await axios.post(`${API}/predict`, {
        vehicleCount: Number(vc),
        avgSpeed:     Number(spd),
        weather:      Number(wth),
        location:     'Delhi NCR',
        timestamp:    new Date().toISOString(),
      })
      setData(res.data)
    } catch (err) {
      console.warn('Prediction API unavailable, using fallback', err)
      const score = Math.min(100, (Number(vc) / 2) + Math.max(0, (80 - Number(spd)) / 80 * 30) + Number(wth) * 2)
      const label = score > 75 ? 'SEVERE' : score > 50 ? 'HIGH' : score > 25 ? 'MEDIUM' : 'LOW'
      setData({
        traffic:           label,
        congestionScore:   Math.round(score),
        etaDelayMinutes:   { LOW:0, MEDIUM:5, HIGH:15, SEVERE:30 }[label],
        weatherCondition:  ['Clear','Cloudy','Rain','Fog'][Number(wth)] || 'Clear',
        preventiveActions: ['Monitor continuously'],
        modelUsed:         'Local Fallback',
      })
    }
    setLoading(false)
  }

  // ── Button click — reads from refs so always gets current values ──────────
  const handleRunClick = () => {
    runPrediction(vcRef.current, spdRef.current, wthRef.current)
  }

  // ── Fetch heatmap zones ────────────────────────────────────────────────────
  const fetchZones = async () => {
    try {
      const res = await axios.post(`${API}/heatmap`, {
        city: 'Delhi NCR', gridSize: 5, baseLat: 28.6139, baseLng: 77.2090,
      })
      const top5 = (res.data.zones || [])
        .sort((a, b) => b.congestionScore - a.congestionScore)
        .slice(0, 5)
        .map(z => ({ name: z.zoneId, risk: LABEL_TO_RISK[z.congestionLevel] || 'Low' }))
      setZones(top5)
    } catch {
      setZones([
        { name:'MG Road',         risk:'High'   },
        { name:'Ring Road',       risk:'High'   },
        { name:'NH-48 Stretch',   risk:'Medium' },
        { name:'Sector 17',       risk:'Medium' },
        { name:'Outer Ring Road', risk:'Low'    },
      ])
    }
  }

  // ── Fetch signal timing ────────────────────────────────────────────────────
  const fetchSignals = async () => {
    const intersections = [
      { id:'MG Road / Main',  vehicleCount:90, avgSpeed:20, weather:0 },
      { id:'Ring Road North', vehicleCount:75, avgSpeed:25, weather:0 },
      { id:'Sector 17',       vehicleCount:55, avgSpeed:35, weather:0 },
      { id:'NH-48 Entry',     vehicleCount:40, avgSpeed:45, weather:0 },
    ]
    try {
      const results = await Promise.all(
        intersections.map(i =>
          axios.post(`${API}/signal-timing`, {
            intersectionId: i.id,
            vehicleCount:   i.vehicleCount,
            avgSpeed:       i.avgSpeed,
            weather:        i.weather,
          }).then(r => ({
            junction: i.id,
            green:    r.data?.signalTiming?.greenSeconds ?? 60,
            red:      r.data?.signalTiming?.redSeconds   ?? 30,
          }))
        )
      )
      setSignals(results)
    } catch {
      setSignals([
        { junction:'MG Road / Main',  green:90, red:30 },
        { junction:'Ring Road North', green:75, red:45 },
        { junction:'Sector 17',       green:60, red:60 },
        { junction:'NH-48 Entry',     green:45, red:75 },
      ])
    }
  }

  // ── Fetch stats ────────────────────────────────────────────────────────────
  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/stats`)
      setStats(res.data)
    } catch { /* optional */ }
  }

  // Initial load
  useEffect(() => {
    runPrediction(60, 35, 0)
    fetchZones()
    fetchSignals()
    fetchStats()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply scenario — passes values directly
  const applyScenario = (s, idx) => {
    setVehicleCount(s.vehicleCount)
    setAvgSpeed(s.avgSpeed)
    setWeather(s.weather)
    setActiveScen(idx)
    runPrediction(s.vehicleCount, s.avgSpeed, s.weather)
  }

  // ── Derived display values ─────────────────────────────────────────────────
  const trafficLabel = data?.traffic ?? 'LOW'
  const pct          = data?.congestionScore ?? 0
  const level        = LABEL_TO_RISK[trafficLabel] ?? 'Low'
  const riskColor    = level === 'High' ? 'var(--red)' : level === 'Medium' ? 'var(--amber)' : 'var(--green)'
  const etaDelay     = data?.etaDelayMinutes ?? 0
  const modelUsed    = data?.modelUsed ?? '—'

  const forecastData = TIMES.map((t, i) => ({
    t, v: Math.max(5, Math.min(98, pct + [0, 4, -3, -9, -16][i]))
  }))

  return (
    <div>
      {/* Stats bar */}
      {stats && (
        <div style={{ display:'flex', gap:'8px', marginBottom:'1rem', flexWrap:'wrap' }}>
          {[
            ['🚗 Vehicles',          stats.totalVehiclesMonitored?.toLocaleString()],
            ['⚡ Signals Optimised', stats.signalsOptimized],
            ['🌿 CO₂ Saved',         `${stats.co2ReductionPercent}%`],
            ['📍 High Risk Zones',   stats.highRiskZones],
            ['🤖 Model',             stats.modelStatus],
          ].map(([k, v]) => (
            <div key={k} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'6px 14px', fontSize:'12px' }}>
              <span style={{ color:'var(--text-muted)' }}>{k}: </span>
              <span style={{ color:'var(--teal)', fontFamily:'var(--mono)', fontWeight:600 }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Scenario buttons */}
      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'1.25rem', flexWrap:'wrap' }}>
        <span style={{ fontSize:'11px', color:'var(--text-muted)', fontFamily:'var(--mono)', letterSpacing:'0.08em' }}>DEMO →</span>
        {SCENARIOS.map((s, i) => (
          <button key={s.label} onClick={() => applyScenario(s, i)} style={{
            padding:'5px 14px', borderRadius:'100px',
            border:      activeScen === i ? '1px solid var(--teal)' : '1px solid var(--border2)',
            background:  activeScen === i ? 'var(--teal-dim)' : 'transparent',
            color:       activeScen === i ? 'var(--teal)' : 'var(--text-muted)',
            fontSize:'12px', fontFamily:'var(--sans)', cursor:'pointer', transition:'all 0.15s',
          }}>{s.label}</button>
        ))}
      </div>

      {/* Input controls */}
      <Card style={{ marginBottom:'1.25rem' }}>
        <div style={{ display:'flex', gap:'1.5rem', alignItems:'flex-end', flexWrap:'wrap' }}>
          <ControlGroup label="Vehicle Count">
            <input
              type="number" min="0" max="200"
              value={vehicleCount}
              onChange={e => { setVehicleCount(Number(e.target.value)); setActiveScen(null) }}
              style={inputStyle}
            />
          </ControlGroup>
          <ControlGroup label="Avg Speed (km/h)">
            <input
              type="number" min="0" max="120"
              value={avgSpeed}
              onChange={e => { setAvgSpeed(Number(e.target.value)); setActiveScen(null) }}
              style={inputStyle}
            />
          </ControlGroup>
          <ControlGroup label="Weather">
            <select
              value={weather}
              onChange={e => { setWeather(Number(e.target.value)); setActiveScen(null) }}
              style={inputStyle}
            >
              <option value={0}>☀️ Clear</option>
              <option value={1}>☁️ Cloudy</option>
              <option value={2}>🌧️ Rain</option>
              <option value={3}>🌫️ Fog</option>
            </select>
          </ControlGroup>
          <button
            onClick={handleRunClick}
            disabled={loading}
            style={{
              background:'var(--teal)', color:'#08090d', border:'none',
              borderRadius:'var(--radius-md)', padding:'9px 22px',
              fontSize:'13px', fontWeight:600, fontFamily:'var(--sans)',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1, transition:'opacity 0.15s',
            }}
          >
            {loading ? 'Running…' : 'Run Prediction →'}
          </button>
        </div>

        {/* Live preview of what will be sent */}
        <p style={{ marginTop:'10px', fontSize:'11px', color:'var(--text-muted)', fontFamily:'var(--mono)' }}>
          Will send → vehicleCount: <span style={{ color:'var(--teal)' }}>{vehicleCount}</span>
          &nbsp;| avgSpeed: <span style={{ color:'var(--teal)' }}>{avgSpeed}</span>
          &nbsp;| weather: <span style={{ color:'var(--teal)' }}>{['Clear','Cloudy','Rain','Fog'][weather]}</span>
        </p>
      </Card>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'auto 1fr 1fr', gap:'1rem', marginBottom:'1.25rem' }}>
        <Card style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
          <CongestionDial value={pct} level={level} />
        </Card>
        <Card>
          <SectionLabel>Risk Level</SectionLabel>
          <p style={{ fontFamily:'var(--mono)', fontSize:'2.2rem', fontWeight:700, color:riskColor, lineHeight:1, transition:'color 0.3s' }}>
            {trafficLabel}
          </p>
          <p style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'6px' }}>
            Congestion score: <strong style={{ color:riskColor }}>{pct}</strong>/100
          </p>
          <p style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'4px' }}>
            ETA delay: <strong style={{ color:'var(--amber)' }}>{etaDelay} min</strong>
          </p>
          <p style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px', fontFamily:'var(--mono)' }}>
            {modelUsed}
          </p>
        </Card>
        <Card>
          <SectionLabel>Preventive Actions</SectionLabel>
          {(data?.preventiveActions ?? ['Monitor continuously']).slice(0, 3).map((a, i) => (
            <p key={i} style={{ fontSize:'12px', color:'var(--text-dim)', lineHeight:1.6, marginBottom:'4px' }}>• {a}</p>
          ))}
          <div style={{ marginTop:'8px' }}>
            <RiskBadge level={level} />
          </div>
        </Card>
      </div>

      {/* Forecast chart */}
      <Card style={{ marginBottom:'1.25rem' }}>
        <SectionLabel>45-min Congestion Forecast — current score: {pct}</SectionLabel>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={forecastData} barCategoryGap="28%">
            <XAxis dataKey="t" stroke="rgba(255,255,255,0.1)" tick={{ fill:'#64748b', fontSize:11, fontFamily:'var(--mono)' }} axisLine={false} tickLine={false}/>
            <YAxis domain={[0,100]} stroke="rgba(255,255,255,0.1)" tick={{ fill:'#64748b', fontSize:10, fontFamily:'var(--mono)' }} axisLine={false} tickLine={false} width={28}/>
            <Tooltip content={<CustomTooltip />} cursor={{ fill:'rgba(255,255,255,0.03)' }}/>
            <Bar dataKey="v" radius={[5,5,0,0]} isAnimationActive={true}>
              {forecastData.map((e, i) => (
                <Cell key={`cell-${i}`} fill={e.v > 65 ? 'var(--red)' : e.v > 40 ? 'var(--amber)' : 'var(--teal)'}/>
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Bottom grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
        <Card>
          <SectionLabel>High Risk Zones</SectionLabel>
          {zones.map((z, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom: i < zones.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize:'13px' }}>{z.name}</span>
              <RiskBadge level={z.risk} />
            </div>
          ))}
        </Card>
        <Card>
          <SectionLabel>⚡ Smart Signal Timing</SectionLabel>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 44px 44px', gap:'4px 8px', marginBottom:'8px' }}>
            {['Junction','Green','Red'].map(h => (
              <span key={h} style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:'var(--mono)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</span>
            ))}
          </div>
          {signals.map((s, i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 44px 44px', alignItems:'center', padding:'8px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize:'12px' }}>{s.junction}</span>
              <span style={{ fontFamily:'var(--mono)', fontSize:'12px', color:'var(--green)', textAlign:'right' }}>{s.green}s</span>
              <span style={{ fontFamily:'var(--mono)', fontSize:'12px', color:'var(--red)',   textAlign:'right' }}>{s.red}s</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
