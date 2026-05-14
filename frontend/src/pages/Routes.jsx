import { useState, useRef } from 'react'
import { PageHeader, Card, SectionLabel } from '../components/Ui'

const OSRM = 'https://router.project-osrm.org/route/v1/driving'
const FREE_FLOW_KMH = 50

// ── India-wide city list ──────────────────────────────────────────────────────
const CITIES = [
  { name:'New Delhi — Connaught Place',  lat:28.6315, lng:77.2167 },
  { name:'Gurugram — Cyber City',        lat:28.4950, lng:77.0890 },
  { name:'Noida — Sector 18',            lat:28.5700, lng:77.3210 },
  { name:'Agra — Taj Mahal',             lat:27.1751, lng:78.0421 },
  { name:'Jaipur — Hawa Mahal',          lat:26.9239, lng:75.8267 },
  { name:'Chandigarh — Sector 17',       lat:30.7333, lng:76.7794 },
  { name:'Lucknow — Hazratganj',         lat:26.8467, lng:80.9462 },
  { name:'Varanasi — Ghats',             lat:25.3176, lng:82.9739 },
  { name:'Amritsar — Golden Temple',     lat:31.6200, lng:74.8765 },
  { name:'Mumbai — Bandra',              lat:19.0596, lng:72.8295 },
  { name:'Mumbai — Nariman Point',       lat:18.9256, lng:72.8242 },
  { name:'Pune — Shivajinagar',          lat:18.5314, lng:73.8446 },
  { name:'Ahmedabad — SG Highway',       lat:23.0225, lng:72.5714 },
  { name:'Surat — Ring Road',            lat:21.1702, lng:72.8311 },
  { name:'Bengaluru — MG Road',          lat:12.9716, lng:77.5946 },
  { name:'Bengaluru — Electronic City',  lat:12.8399, lng:77.6770 },
  { name:'Chennai — Anna Salai',         lat:13.0827, lng:80.2707 },
  { name:'Hyderabad — HITEC City',       lat:17.4435, lng:78.3772 },
  { name:'Kochi — MG Road',             lat:9.9312,  lng:76.2673 },
  { name:'Coimbatore — RS Puram',        lat:11.0168, lng:76.9558 },
  { name:'Kolkata — Park Street',        lat:22.5726, lng:88.3639 },
  { name:'Bhubaneswar — Rajpath',        lat:20.2961, lng:85.8245 },
  { name:'Patna — Gandhi Maidan',        lat:25.5941, lng:85.1376 },
  { name:'Guwahati — Paltan Bazaar',     lat:26.1445, lng:91.7362 },
  { name:'Bhopal — New Market',          lat:23.2599, lng:77.4126 },
  { name:'Nagpur — Sitabuldi',           lat:21.1458, lng:79.0882 },
  { name:'Indore — Vijay Nagar',         lat:22.7196, lng:75.8577 },
  { name:'Raipur — Shankar Nagar',       lat:21.2514, lng:81.6296 },
]

// ── Via-waypoints for route diversity ─────────────────────────────────────────
const VIA_POOL = [
  { name:'Bhopal',     lat:23.2599, lng:77.4126 },
  { name:'Nagpur',     lat:21.1458, lng:79.0882 },
  { name:'Indore',     lat:22.7196, lng:75.8577 },
  { name:'Ahmedabad',  lat:23.0225, lng:72.5714 },
  { name:'Surat',      lat:21.1702, lng:72.8311 },
  { name:'Pune',       lat:18.5204, lng:73.8567 },
  { name:'Hyderabad',  lat:17.3850, lng:78.4867 },
  { name:'Jaipur',     lat:26.9124, lng:75.7873 },
  { name:'Lucknow',    lat:26.8467, lng:80.9462 },
  { name:'Agra',       lat:27.1751, lng:78.0421 },
  { name:'Raipur',     lat:21.2514, lng:81.6296 },
  { name:'Patna',      lat:25.5941, lng:85.1376 },
]

// ── Congestion calculation ────────────────────────────────────────────────────
function calcCongestion(distM, durSec) {
  const km  = distM / 1000
  const ff  = (km / FREE_FLOW_KMH) * 60   // free-flow minutes
  const act = durSec / 60                  // actual minutes
  const idx = ff > 0 ? act / ff : 1
  let level, color, bg
  if      (idx >= 2.0) { level='SEVERE'; color='#ff4757'; bg='rgba(248,71,87,0.12)' }
  else if (idx >= 1.5) { level='HIGH';   color='#ff6b35'; bg='rgba(255,107,53,0.12)' }
  else if (idx >= 1.2) { level='MEDIUM'; color='#ffa502'; bg='rgba(255,165,2,0.12)'  }
  else                 { level='LOW';    color='#2ed573'; bg='rgba(46,213,115,0.12)' }
  return { level, color, bg, idx: Math.round(idx * 100) / 100, ffMin: Math.round(ff), actMin: Math.round(act) }
}

// ── Toll estimate (₹ per km, rough NHAI rates) ────────────────────────────────
function estimateToll(distKm, viaName) {
  if (viaName?.includes('Bypass') || viaName?.includes('State')) return 0
  const rate = 2.5  // ₹2.5/km average NHAI toll
  return Math.round(distKm * rate / 10) * 10  // round to nearest ₹10
}

// ── Rank badge config ─────────────────────────────────────────────────────────
const RANK = [
  { emoji:'🥇', tag:'BEST ROUTE',    tagColor:'#2ed573', tagBg:'rgba(46,213,115,0.12)',  border:'#2ed573' },
  { emoji:'🥈', tag:'2ND BEST',      tagColor:'#2dd4bf', tagBg:'rgba(45,212,191,0.12)',  border:'#2dd4bf' },
  { emoji:'🥉', tag:'3RD OPTION',    tagColor:'#60a5fa', tagBg:'rgba(96,165,250,0.12)',  border:'#60a5fa' },
  { emoji:'4️⃣', tag:'4TH OPTION',   tagColor:'#fbbf24', tagBg:'rgba(251,191,36,0.12)',  border:'#fbbf24' },
  { emoji:'5️⃣', tag:'5TH OPTION',   tagColor:'#a78bfa', tagBg:'rgba(167,139,250,0.12)', border:'#a78bfa' },
]

export default function RoutesPage() {
  const [originIdx,  setOriginIdx]  = useState(0)
  const [destIdx,    setDestIdx]    = useState(9)   // Mumbai default
  const [routes,     setRoutes]     = useState([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [searched,   setSearched]   = useState(false)
  const originRef = useRef(0)
  const destRef   = useRef(9)
  originRef.current = originIdx
  destRef.current   = destIdx

  const findRoutes = async () => {
    const oIdx = originRef.current
    const dIdx = destRef.current
    if (oIdx === dIdx) { setError('Origin and destination must be different.'); return }

    setLoading(true)
    setError(null)
    setRoutes([])
    setSearched(true)

    const from = CITIES[oIdx]
    const to   = CITIES[dIdx]

    // Pick via-points geographically between origin and destination
    const minLat = Math.min(from.lat, to.lat) - 3
    const maxLat = Math.max(from.lat, to.lat) + 3
    const minLng = Math.min(from.lng, to.lng) - 3
    const maxLng = Math.max(from.lng, to.lng) + 3

    const vias = VIA_POOL.filter(v =>
      v.lat >= minLat && v.lat <= maxLat &&
      v.lng >= minLng && v.lng <= maxLng &&
      !(Math.abs(v.lat - from.lat) < 0.8 && Math.abs(v.lng - from.lng) < 0.8) &&
      !(Math.abs(v.lat - to.lat)   < 0.8 && Math.abs(v.lng - to.lng)   < 0.8)
    ).slice(0, 5)

    // Build all fetch requests
    const requests = [
      // Direct — ask OSRM for 3 alternatives
      { label:'Direct',     url:`${OSRM}/` + `${from.lng},${from.lat};${to.lng},${to.lat}?alternatives=3&overview=false` },
      // Via each waypoint
      ...vias.map(v => ({
        label: `Via ${v.name}`,
        url:   `${OSRM}/${from.lng},${from.lat};${v.lng},${v.lat};${to.lng},${to.lat}?overview=false`,
      })),
    ]

    const allRoutes = []

    await Promise.allSettled(
      requests.map(async ({ label, url }) => {
        try {
          const res  = await fetch(url, { signal: AbortSignal.timeout(8000) })
          const data = await res.json()
          if (data.code !== 'Ok') return
          data.routes.forEach((r, i) => {
            const distKm = Math.round(r.distance / 100) / 10
            const cong   = calcCongestion(r.distance, r.duration)
            allRoutes.push({
              viaName:    i === 0 ? label : `${label} Alt`,
              distKm,
              durationMin: cong.actMin,
              ffMin:       cong.ffMin,
              toll:        estimateToll(distKm, label),
              ...cong,
            })
          })
        } catch { /* skip failed requests */ }
      })
    )

    if (allRoutes.length === 0) {
      setError('No routes found. Try different cities.')
      setLoading(false)
      return
    }

    // Sort by composite score: 60% congestion index + 40% normalised distance
    const maxDist = Math.max(...allRoutes.map(r => r.distKm))
    const scored  = allRoutes
      .map(r => ({ ...r, score: 0.6 * r.idx + 0.4 * (r.distKm / maxDist) }))
      .sort((a, b) => a.score - b.score)

    // Deduplicate — remove routes within 3% distance of a better one
    const deduped = []
    for (const r of scored) {
      const tooClose = deduped.some(d => Math.abs(d.distKm - r.distKm) / r.distKm < 0.03)
      if (!tooClose) deduped.push(r)
      if (deduped.length === 5) break
    }

    setRoutes(deduped)
    setLoading(false)
  }

  const selectStyle = {
    background:'var(--surface2)', border:'1px solid var(--border2)',
    color:'var(--text)', borderRadius:'var(--radius-md)',
    padding:'9px 12px', fontSize:'13px', fontFamily:'var(--sans)',
    outline:'none', flex:1, cursor:'pointer',
  }

  const bestRoute  = routes[0]
  const tollSaving = routes.length > 1
    ? Math.max(...routes.map(r => r.toll)) - Math.min(...routes.map(r => r.toll))
    : 0
  const timeSaving = routes.length > 1
    ? Math.max(...routes.map(r => r.durationMin)) - routes[0].durationMin
    : 0

  return (
    <div>
      <PageHeader
        title="Smart Route Planner"
        sub="Real road distances via OSRM · Ranked by congestion + distance · All India"
      />

      {/* Search bar */}
      <Card style={{ marginBottom:'1.25rem' }}>
        <div style={{ display:'flex', gap:'10px', alignItems:'flex-end', flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:'180px' }}>
            <label style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:'var(--mono)', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'5px' }}>Origin</label>
            <select value={originIdx} onChange={e => setOriginIdx(Number(e.target.value))} style={selectStyle}>
              {CITIES.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
            </select>
          </div>
          <span style={{ color:'var(--text-muted)', fontSize:'22px', paddingBottom:'4px' }}>→</span>
          <div style={{ flex:1, minWidth:'180px' }}>
            <label style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:'var(--mono)', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'5px' }}>Destination</label>
            <select value={destIdx} onChange={e => setDestIdx(Number(e.target.value))} style={selectStyle}>
              {CITIES.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
            </select>
          </div>
          <button
            onClick={findRoutes}
            disabled={loading}
            style={{
              background:'var(--teal)', color:'#08090d', border:'none',
              borderRadius:'var(--radius-md)', padding:'10px 24px',
              fontSize:'13px', fontWeight:700, fontFamily:'var(--sans)',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1, whiteSpace:'nowrap',
            }}
          >
            {loading ? '⏳ Finding routes…' : '🔍 Find Best Routes'}
          </button>
        </div>
        {error && <p style={{ fontSize:'12px', color:'var(--amber)', marginTop:'10px' }}>⚠️ {error}</p>}
      </Card>

      {/* Summary chips — shown after search */}
      {routes.length > 0 && (
        <div style={{ display:'flex', gap:'8px', marginBottom:'1.25rem', flexWrap:'wrap' }}>
          {[
            [`🏆 Best: ${bestRoute.viaName}`,                    'var(--teal)'  ],
            [`📏 Shortest: ${bestRoute.distKm} km`,              'var(--green)' ],
            [`⏱ Fastest: ${bestRoute.durationMin} min`,          'var(--blue)'  ],
            tollSaving > 0 ? [`💰 Save ₹${tollSaving} on toll`, 'var(--amber)' ] : null,
            timeSaving > 0 ? [`⚡ Save ${timeSaving} min`,       'var(--purple)'] : null,
          ].filter(Boolean).map(([label, color]) => (
            <span key={label} style={{
              fontSize:'12px', padding:'4px 14px', borderRadius:'100px',
              border:`1px solid ${color}44`, background:`${color}14`,
              color, fontFamily:'var(--mono)', fontWeight:600,
            }}>{label}</span>
          ))}
        </div>
      )}

      {/* Route cards */}
      {loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{
              background:'var(--surface)', border:'1px solid var(--border)',
              borderRadius:'var(--radius-lg)', padding:'1.25rem',
              height:'110px', animation:'pulse 1.5s infinite',
              opacity: 1 - i * 0.12,
            }}/>
          ))}
          <style>{`@keyframes pulse{0%,100%{opacity:0.6}50%{opacity:0.3}}`}</style>
        </div>
      )}

      {!loading && routes.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {routes.map((r, i) => {
            const rank = RANK[i] || RANK[4]
            return (
              <div key={i} style={{
                background:'var(--surface)',
                border:`1px solid var(--border)`,
                borderLeft:`4px solid ${rank.border}`,
                borderRadius:'var(--radius-lg)',
                padding:'1.25rem 1.5rem',
                position:'relative',
                transition:'transform 0.15s',
              }}
                onMouseOver={e => e.currentTarget.style.transform='translateX(3px)'}
                onMouseOut={e  => e.currentTarget.style.transform='translateX(0)'}
              >
                {/* Rank tag */}
                <span style={{
                  position:'absolute', top:'14px', right:'14px',
                  background: rank.tagBg, color: rank.tagColor,
                  fontFamily:'var(--mono)', fontSize:'10px', fontWeight:700,
                  padding:'3px 10px', borderRadius:'100px', letterSpacing:'0.06em',
                }}>{rank.emoji} {rank.tag}</span>

                {/* Route name */}
                <p style={{ fontWeight:700, fontSize:'15px', marginBottom:'14px', paddingRight:'100px' }}>
                  {rank.emoji} {r.viaName}
                </p>

                {/* Stats grid */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'12px', marginBottom:'12px' }}>
                  {[
                    { label:'Distance',    value:`${r.distKm} km`,       color:'var(--text)'    },
                    { label:'Travel Time', value:`${r.durationMin} min`,  color:'var(--text)'    },
                    { label:'Free-flow',   value:`${r.ffMin} min`,        color:'var(--text-muted)' },
                    { label:'Congestion',  value:`${r.idx}×`,             color: r.color         },
                    { label:'Est. Toll',   value: r.toll === 0 ? 'FREE' : `₹${r.toll}`, color: r.toll === 0 ? 'var(--green)' : 'var(--amber)' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <p style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:'var(--mono)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'5px' }}>{label}</p>
                      <p style={{ fontFamily:'var(--mono)', fontSize:'1.1rem', fontWeight:700, color }}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Congestion bar */}
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <span style={{ fontSize:'11px', color:'var(--text-muted)', fontFamily:'var(--mono)', whiteSpace:'nowrap' }}>Traffic load</span>
                  <div style={{ flex:1, height:'5px', background:'var(--surface2)', borderRadius:'3px', overflow:'hidden' }}>
                    <div style={{
                      height:'100%', borderRadius:'3px',
                      width:`${Math.min(100, r.idx * 50)}%`,
                      background: r.color,
                      transition:'width 0.6s ease',
                    }}/>
                  </div>
                  <span style={{
                    fontFamily:'var(--mono)', fontSize:'10px', fontWeight:700,
                    padding:'2px 8px', borderRadius:'100px',
                    background: r.bg, color: r.color,
                  }}>{r.level}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && searched && routes.length === 0 && !error && (
        <Card>
          <p style={{ fontSize:'13px', color:'var(--text-muted)', textAlign:'center', padding:'2rem' }}>
            No routes found between these cities. Try a different pair.
          </p>
        </Card>
      )}

      {!searched && (
        <Card>
          <p style={{ fontSize:'13px', color:'var(--text-muted)', textAlign:'center', padding:'2rem' }}>
            Select origin and destination above, then click <strong style={{ color:'var(--teal)' }}>Find Best Routes</strong> to see up to 5 routes ranked by least congestion and shortest distance.
          </p>
        </Card>
      )}

      <p style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'1.5rem', lineHeight:1.7 }}>
        Road data from <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer" style={{ color:'var(--teal)' }}>OpenStreetMap</a> · Routing by <a href="http://project-osrm.org" target="_blank" rel="noreferrer" style={{ color:'var(--teal)' }}>OSRM</a> · Congestion simulated at {FREE_FLOW_KMH} km/h free-flow · Toll estimates based on NHAI rates
      </p>
    </div>
  )
}
