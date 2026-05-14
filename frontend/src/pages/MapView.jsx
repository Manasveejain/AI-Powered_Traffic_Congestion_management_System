import { useEffect, useRef, useState, useCallback } from 'react'
import axios from 'axios'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { PageHeader, Card, SectionLabel } from '../components/Ui'

const API        = '/api/traffic'
const OSRM_BASE  = 'https://router.project-osrm.org/route/v1/driving'
const FREE_FLOW_SPEED_KMH = 50   // assumed free-flow speed for congestion calc

// ── India-wide locations ─────────────────────────────────────────────────────
const LOCATIONS = [
  // North
  { name:'New Delhi — Connaught Place',   lat:28.6315, lng:77.2167 },
  { name:'New Delhi — India Gate',        lat:28.6129, lng:77.2295 },
  { name:'Gurugram — Cyber City',         lat:28.4950, lng:77.0890 },
  { name:'Noida — Sector 18',             lat:28.5700, lng:77.3210 },
  { name:'Agra — Taj Mahal',              lat:27.1751, lng:78.0421 },
  { name:'Jaipur — Hawa Mahal',           lat:26.9239, lng:75.8267 },
  { name:'Chandigarh — Sector 17',        lat:30.7333, lng:76.7794 },
  { name:'Lucknow — Hazratganj',          lat:26.8467, lng:80.9462 },
  { name:'Varanasi — Ghats',              lat:25.3176, lng:82.9739 },
  { name:'Amritsar — Golden Temple',      lat:31.6200, lng:74.8765 },
  // West
  { name:'Mumbai — Bandra',               lat:19.0596, lng:72.8295 },
  { name:'Mumbai — Nariman Point',        lat:18.9256, lng:72.8242 },
  { name:'Pune — Shivajinagar',           lat:18.5314, lng:73.8446 },
  { name:'Ahmedabad — SG Highway',        lat:23.0225, lng:72.5714 },
  { name:'Surat — Ring Road',             lat:21.1702, lng:72.8311 },
  // South
  { name:'Bengaluru — MG Road',           lat:12.9716, lng:77.5946 },
  { name:'Bengaluru — Electronic City',   lat:12.8399, lng:77.6770 },
  { name:'Chennai — Anna Salai',          lat:13.0827, lng:80.2707 },
  { name:'Hyderabad — HITEC City',        lat:17.4435, lng:78.3772 },
  { name:'Kochi — MG Road',              lat:9.9312,  lng:76.2673 },
  { name:'Coimbatore — RS Puram',         lat:11.0168, lng:76.9558 },
  // East
  { name:'Kolkata — Park Street',         lat:22.5726, lng:88.3639 },
  { name:'Bhubaneswar — Rajpath',         lat:20.2961, lng:85.8245 },
  { name:'Patna — Gandhi Maidan',         lat:25.5941, lng:85.1376 },
  { name:'Guwahati — Paltan Bazaar',      lat:26.1445, lng:91.7362 },
  // Central
  { name:'Bhopal — New Market',           lat:23.2599, lng:77.4126 },
  { name:'Nagpur — Sitabuldi',            lat:21.1458, lng:79.0882 },
  { name:'Indore — Vijay Nagar',          lat:22.7196, lng:75.8577 },
  { name:'Raipur — Shankar Nagar',        lat:21.2514, lng:81.6296 },
]

const LEVEL_COLOR = { LOW:'#2ed573', MEDIUM:'#ffa502', HIGH:'#ff4757', SEVERE:'#ff0000' }

// ── Congestion from OSRM duration vs free-flow ───────────────────────────────
function calcCongestion(distanceM, durationSec) {
  const distKm        = distanceM / 1000
  const freeFlowMin   = (distKm / FREE_FLOW_SPEED_KMH) * 60
  const actualMin     = durationSec / 60
  const index         = freeFlowMin > 0 ? actualMin / freeFlowMin : 1
  // OSRM uses historical speeds so index > 1 = congested
  let level, score
  if (index >= 2.0)      { level = 'SEVERE'; score = Math.min(98, Math.round(index * 40)) }
  else if (index >= 1.5) { level = 'HIGH';   score = Math.round(60 + (index - 1.5) * 40) }
  else if (index >= 1.2) { level = 'MEDIUM'; score = Math.round(35 + (index - 1.2) * 83) }
  else                   { level = 'LOW';    score = Math.round(index * 20) }
  return { level, score, index: Math.round(index * 100) / 100, freeFlowMin: Math.round(freeFlowMin), actualMin: Math.round(actualMin) }
}

// ── Decode OSRM polyline (encoded) ───────────────────────────────────────────
function decodePolyline(encoded) {
  const coords = []
  let index = 0, lat = 0, lng = 0
  while (index < encoded.length) {
    let b, shift = 0, result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += (result & 1) ? ~(result >> 1) : result >> 1
    shift = 0; result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += (result & 1) ? ~(result >> 1) : result >> 1
    coords.push([lat / 1e5, lng / 1e5])
  }
  return coords
}

export default function MapView() {
  const mapRef     = useRef(null)
  const mapInst    = useRef(null)
  const layersRef  = useRef([])   // track all added layers for cleanup

  const [zones,       setZones]       = useState([])
  const [routes,      setRoutes]      = useState([])   // OSRM route results
  const [origin,      setOrigin]      = useState(0)    // index into LOCATIONS
  const [destination, setDestination] = useState(2)
  const [routeLoading, setRouteLoading] = useState(false)
  const [heatLoading,  setHeatLoading]  = useState(true)
  const [lastFetch,    setLastFetch]    = useState(null)
  const [activeRoute,  setActiveRoute]  = useState(null)
  const [routeError,   setRouteError]   = useState(null)

  // ── Init map once ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapInst.current || !mapRef.current) return
    const map = L.map(mapRef.current, { zoomControl: false }).setView([22.5, 80.0], 5)
    mapInst.current = map
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map)
    return () => { map.remove(); mapInst.current = null }
  }, [])

  // ── Clear all dynamic layers ───────────────────────────────────────────────
  const clearLayers = () => {
    layersRef.current.forEach(l => { try { mapInst.current?.removeLayer(l) } catch {} })
    layersRef.current = []
  }

  // ── Fetch AI heatmap zones ─────────────────────────────────────────────────
  const fetchHeatmap = useCallback(async () => {
    setHeatLoading(true)
    try {
      const res = await axios.post(`${API}/heatmap`, {
        city: 'India', gridSize: 6, baseLat: 22.5, baseLng: 80.0,
      })
      setZones(res.data.zones || [])
      setLastFetch(new Date())
    } catch {
      setZones([
        { lat:28.6350, lng:77.2250, congestionLevel:'HIGH',   congestionScore:78, zoneId:'MG Road',        vehicleCount:95,  avgSpeed:18 },
        { lat:28.6300, lng:77.2100, congestionLevel:'HIGH',   congestionScore:72, zoneId:'Ring Road',       vehicleCount:88,  avgSpeed:22 },
        { lat:28.6280, lng:77.2180, congestionLevel:'MEDIUM', congestionScore:55, zoneId:'Central Ave',     vehicleCount:60,  avgSpeed:35 },
        { lat:28.6400, lng:77.2300, congestionLevel:'MEDIUM', congestionScore:48, zoneId:'NH-48 Entry',     vehicleCount:55,  avgSpeed:38 },
        { lat:28.6200, lng:77.2050, congestionLevel:'LOW',    congestionScore:22, zoneId:'Sector 17',       vehicleCount:30,  avgSpeed:55 },
        { lat:28.6450, lng:77.2150, congestionLevel:'LOW',    congestionScore:18, zoneId:'Outer Ring Road', vehicleCount:25,  avgSpeed:60 },
      ])
      setLastFetch(new Date())
    }
    setHeatLoading(false)
  }, [])

  useEffect(() => {
    fetchHeatmap()
    const id = setInterval(fetchHeatmap, 60_000)
    return () => clearInterval(id)
  }, [fetchHeatmap])

  // ── Draw heatmap zones on map ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapInst.current || zones.length === 0) return
    clearLayers()

    // Heatmap overlay
    const addHeat = () => {
      if (window.L?.heatLayer) {
        const hl = window.L.heatLayer(
          zones.map(z => [z.lat, z.lng, z.congestionScore / 100]),
          { radius:45, blur:30, maxZoom:17, gradient:{ 0.3:'#3b82f6', 0.6:'#ffa502', 1.0:'#ff4757' } }
        ).addTo(mapInst.current)
        layersRef.current.push(hl)
      }
    }

    // No circle markers — heatmap gradient only

    if (window.L?.heatLayer) { addHeat() }
    else {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/leaflet.heat@0.2.0/dist/leaflet-heat.js'
      s.onload = addHeat
      document.head.appendChild(s)
    }
  }, [zones])

  // ── Fetch OSRM route + draw on map ────────────────────────────────────────
  const fetchRoute = async () => {
    if (origin === destination) { setRouteError('Origin and destination must be different.'); return }
    setRouteLoading(true)
    setRouteError(null)
    setRoutes([])
    setActiveRoute(null)

    const from = LOCATIONS[origin]
    const to   = LOCATIONS[destination]

    // ── Via-waypoint cities spread across India for route diversity ──────────
    const VIA_POINTS = [
      { name:'Bhopal',     lat:23.2599, lng:77.4126 },
      { name:'Nagpur',     lat:21.1458, lng:79.0882 },
      { name:'Hyderabad',  lat:17.3850, lng:78.4867 },
      { name:'Pune',       lat:18.5204, lng:73.8567 },
      { name:'Ahmedabad',  lat:23.0225, lng:72.5714 },
      { name:'Jaipur',     lat:26.9124, lng:75.7873 },
      { name:'Lucknow',    lat:26.8467, lng:80.9462 },
      { name:'Kolkata',    lat:22.5726, lng:88.3639 },
      { name:'Surat',      lat:21.1702, lng:72.8311 },
      { name:'Indore',     lat:22.7196, lng:75.8577 },
    ]

    // Pick 4 via-points that are geographically between origin and destination
    // (filter to those roughly between the two lat/lng bounds)
    const minLat = Math.min(from.lat, to.lat) - 2
    const maxLat = Math.max(from.lat, to.lat) + 2
    const minLng = Math.min(from.lng, to.lng) - 2
    const maxLng = Math.max(from.lng, to.lng) + 2

    const candidates = VIA_POINTS.filter(v =>
      v.lat >= minLat && v.lat <= maxLat &&
      v.lng >= minLng && v.lng <= maxLng &&
      !(Math.abs(v.lat - from.lat) < 0.5 && Math.abs(v.lng - from.lng) < 0.5) &&
      !(Math.abs(v.lat - to.lat)   < 0.5 && Math.abs(v.lng - to.lng)   < 0.5)
    ).slice(0, 4)

    // Build route requests:
    // 1. Direct (no via)
    // 2. OSRM alternatives of direct
    // 3-5. Via each candidate waypoint
    const directUrl = `${OSRM_BASE}/${from.lng},${from.lat};${to.lng},${to.lat}?alternatives=2&overview=full&geometries=polyline`

    const viaUrls = candidates.map(v =>
      `${OSRM_BASE}/${from.lng},${from.lat};${v.lng},${v.lat};${to.lng},${to.lat}?overview=full&geometries=polyline`
    )

    try {
      // Fetch direct + via routes in parallel
      const [directRes, ...viaResults] = await Promise.allSettled([
        fetch(directUrl).then(r => r.json()),
        ...viaUrls.map(u => fetch(u).then(r => r.json())),
      ])

      const allRouteData = []

      // Direct routes (up to 3 from OSRM alternatives)
      if (directRes.status === 'fulfilled' && directRes.value.code === 'Ok') {
        directRes.value.routes.forEach((r, i) => {
          allRouteData.push({ r, viaName: i === 0 ? 'Direct' : `Direct Alt ${i}` })
        })
      }

      // Via-waypoint routes
      viaResults.forEach((res, i) => {
        if (res.status === 'fulfilled' && res.value.code === 'Ok' && res.value.routes?.[0]) {
          allRouteData.push({ r: res.value.routes[0], viaName: `Via ${candidates[i].name}` })
        }
      })

      if (allRouteData.length === 0) {
        setRouteError('No routes found. Try different locations.')
        setRouteLoading(false)
        return
      }

      // Remove old route layers
      layersRef.current
        .filter(l => l._isRoute)
        .forEach(l => { try { mapInst.current.removeLayer(l) } catch {} })
      layersRef.current = layersRef.current.filter(l => !l._isRoute)

      // Compute congestion for all, sort least → most congested, take top 5
      const scored = allRouteData.map(({ r, viaName }) => ({
        viaName,
        distanceKm:  Math.round(r.distance / 100) / 10,
        durationMin: Math.round(r.duration / 60),
        coords:      decodePolyline(r.geometry),
        ...calcCongestion(r.distance, r.duration),
      }))
      .sort((a, b) => a.index - b.index)
      .slice(0, 5)

      // Deduplicate by distance (remove near-identical routes within 5km)
      const deduped = scored.filter((r, i, arr) =>
        i === 0 || Math.abs(r.distanceKm - arr[i-1].distanceKm) > 5
      )

      const RANK_STYLE = [
        { weight:7, opacity:0.95, dash:null,    emoji:'🥇' },
        { weight:5, opacity:0.80, dash:null,    emoji:'🥈' },
        { weight:4, opacity:0.65, dash:'10,6',  emoji:'🥉' },
        { weight:3, opacity:0.50, dash:'8,8',   emoji:'4️⃣' },
        { weight:3, opacity:0.40, dash:'4,8',   emoji:'5️⃣' },
      ]

      const finalRoutes = deduped.map((item, rank) => {
        const style = RANK_STYLE[rank] || RANK_STYLE[4]
        const color = LEVEL_COLOR[item.level]

        const poly = L.polyline(item.coords, {
          color, weight: style.weight, opacity: style.opacity, dashArray: style.dash,
        }).addTo(mapInst.current)
        poly._isRoute = true
        layersRef.current.push(poly)

        // Midpoint badge
        const mid = item.coords[Math.floor(item.coords.length / 2)]
        const badge = L.marker(mid, {
          icon: L.divIcon({
            className: '',
            html: `<div style="background:${color};color:#000;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap;font-family:monospace;box-shadow:0 2px 6px rgba(0,0,0,0.5)">${style.emoji} ${item.durationMin}min · ${item.index}×</div>`,
            iconAnchor: [35, 10],
          })
        }).addTo(mapInst.current)
        badge._isRoute = true
        layersRef.current.push(badge)

        // Origin / destination pins on rank 0
        if (rank === 0) {
          const startM = L.circleMarker([from.lat, from.lng], {
            color:'#2dd4bf', fillColor:'#2dd4bf', fillOpacity:1, radius:10, weight:2,
          }).addTo(mapInst.current).bindPopup(`<b>🟢 ${from.name}</b>`)
          const endM = L.circleMarker([to.lat, to.lng], {
            color:'#f87171', fillColor:'#f87171', fillOpacity:1, radius:10, weight:2,
          }).addTo(mapInst.current).bindPopup(`<b>🔴 ${to.name}</b>`)
          startM._isRoute = true; endM._isRoute = true
          layersRef.current.push(startM, endM)
          mapInst.current.fitBounds(poly.getBounds(), { padding:[50, 50] })
        }

        return { rank, ...item, color, emoji: style.emoji }
      })

      setRoutes(finalRoutes)
      setActiveRoute(finalRoutes[0])
    } catch (err) {
      setRouteError('Could not reach OSRM. Check your internet connection.')
      console.error(err)
    }
    setRouteLoading(false)
  }

  const highCount = zones.filter(z => ['HIGH','SEVERE'].includes(z.congestionLevel)).length
  const medCount  = zones.filter(z => z.congestionLevel === 'MEDIUM').length
  const lowCount  = zones.filter(z => z.congestionLevel === 'LOW').length

  const selectStyle = {
    background:'var(--surface2)', border:'1px solid var(--border2)',
    color:'var(--text)', borderRadius:'var(--radius-md)',
    padding:'8px 12px', fontSize:'13px', fontFamily:'var(--sans)',
    outline:'none', flex:1, cursor:'pointer',
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'12px', marginBottom:'1rem' }}>
        <PageHeader
          title="Live Traffic Map"
          sub="Real road routing via OpenStreetMap + OSRM · AI congestion overlay · Delhi NCR"
        />
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <button onClick={fetchHeatmap} disabled={heatLoading} style={{
            background:'var(--surface2)', border:'1px solid var(--border2)',
            color: heatLoading ? 'var(--teal)' : 'var(--text-muted)',
            borderRadius:'var(--radius-sm)', padding:'5px 12px',
            fontSize:'12px', fontFamily:'var(--sans)', cursor:'pointer',
          }}>{heatLoading ? '↻ Loading…' : '↻ Refresh Zones'}</button>
          {lastFetch && <span style={{ fontSize:'11px', color:'var(--text-muted)', fontFamily:'var(--mono)' }}>{lastFetch.toLocaleTimeString()}</span>}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:'16px', marginBottom:'12px', flexWrap:'wrap', alignItems:'center' }}>
        {[['#ff4757','High/Severe',highCount],['#ffa502','Medium',medCount],['#2ed573','Low',lowCount]].map(([c,l,n]) => (
          <div key={l} style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'var(--text-muted)' }}>
            <span style={{ width:10, height:10, borderRadius:'50%', background:c, display:'inline-block' }}/>
            {l} <span style={{ color:c, fontFamily:'var(--mono)', fontWeight:700 }}>({n})</span>
          </div>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', color:'var(--text-muted)' }}>
          <span style={{ width:24, height:3, background:'#2dd4bf', display:'inline-block', borderRadius:2 }}/>Main route
          <span style={{ width:24, height:3, background:'#64748b', display:'inline-block', borderRadius:2, marginLeft:8, borderTop:'2px dashed #64748b' }}/>Alternate
        </div>
      </div>

      {/* Map */}
      <div ref={mapRef} style={{ height:'460px', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', overflow:'hidden', marginBottom:'1rem' }}/>

      {/* Route planner panel */}
      <Card>
        <SectionLabel>🗺️ Route Planner — OpenStreetMap + OSRM + AI Congestion</SectionLabel>
        <div style={{ display:'flex', gap:'10px', alignItems:'flex-end', flexWrap:'wrap', marginBottom:'12px' }}>
          <div style={{ flex:1, minWidth:'160px' }}>
            <label style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:'var(--mono)', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'5px' }}>Origin</label>
            <select value={origin} onChange={e => setOrigin(Number(e.target.value))} style={selectStyle}>
              {LOCATIONS.map((l, i) => <option key={i} value={i}>{l.name}</option>)}
            </select>
          </div>
          <span style={{ color:'var(--text-muted)', fontSize:'20px', paddingBottom:'6px' }}>→</span>
          <div style={{ flex:1, minWidth:'160px' }}>
            <label style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:'var(--mono)', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'5px' }}>Destination</label>
            <select value={destination} onChange={e => setDestination(Number(e.target.value))} style={selectStyle}>
              {LOCATIONS.map((l, i) => <option key={i} value={i}>{l.name}</option>)}
            </select>
          </div>
          <button onClick={fetchRoute} disabled={routeLoading} style={{
            background:'var(--teal)', color:'#08090d', border:'none',
            borderRadius:'var(--radius-md)', padding:'9px 22px',
            fontSize:'13px', fontWeight:600, fontFamily:'var(--sans)',
            cursor: routeLoading ? 'not-allowed' : 'pointer',
            opacity: routeLoading ? 0.6 : 1, whiteSpace:'nowrap',
          }}>{routeLoading ? '⏳ Routing…' : '🔍 Get Route'}</button>
        </div>

        {routeError && (
          <p style={{ fontSize:'12px', color:'var(--amber)', marginBottom:'10px' }}>⚠️ {routeError}</p>
        )}

        {/* Route results */}
        {routes.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            <p style={{ fontSize:'11px', color:'var(--text-muted)', fontFamily:'var(--mono)', marginBottom:'4px' }}>
              {LOCATIONS[origin].name} → {LOCATIONS[destination].name} · {routes.length} route{routes.length > 1 ? 's' : ''} found via OSRM
            </p>
            {routes.map((r, i) => (
              <div key={i} style={{
                background:'var(--surface2)',
                border:`1px solid ${activeRoute?.rank === r.rank ? r.color : 'var(--border)'}`,
                borderLeft:`3px solid ${r.color}`,
                borderRadius:'var(--radius-md)', padding:'12px 16px',
                cursor:'pointer', transition:'border-color 0.15s',
              }} onClick={() => setActiveRoute(r)}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                  <span style={{ fontSize:'13px', fontWeight:600 }}>{r.emoji} {r.viaName}</span>
                  <span style={{
                    fontFamily:'var(--mono)', fontSize:'10px', fontWeight:700,
                    padding:'2px 9px', borderRadius:100,
                    background: r.level === 'HIGH' || r.level === 'SEVERE' ? 'var(--red-dim)' : r.level === 'MEDIUM' ? 'var(--amber-dim)' : 'var(--green-dim)',
                    color: r.color,
                  }}>{r.level}</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
                  {[
                    ['Distance',   `${r.distanceKm} km`],
                    ['OSRM Time',  `${r.durationMin} min`],
                    ['Free-flow',  `${r.freeFlowMin} min`],
                    ['Congestion', `${r.index}×`],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:'var(--mono)', textTransform:'uppercase', marginBottom:'3px' }}>{k}</p>
                      <p style={{ fontFamily:'var(--mono)', fontSize:'13px', fontWeight:700, color: k === 'Congestion' ? r.color : 'var(--text)' }}>{v}</p>
                    </div>
                  ))}
                </div>
                {activeRoute?.rank === r.rank && (
                  <p style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'8px', fontFamily:'var(--mono)' }}>
                    🚦 Congestion index {r.index}× means travel takes {r.index}× longer than free-flow speed of {FREE_FLOW_SPEED_KMH} km/h
                  </p>
                )}
              </div>
            ))}
            <p style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' }}>
              Route geometry from <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer" style={{ color:'var(--teal)' }}>OpenStreetMap</a> via <a href="http://project-osrm.org" target="_blank" rel="noreferrer" style={{ color:'var(--teal)' }}>OSRM</a>. Congestion simulated using free-flow speed model.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}
