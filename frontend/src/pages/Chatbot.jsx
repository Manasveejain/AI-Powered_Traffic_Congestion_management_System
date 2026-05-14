import { useState, useRef, useEffect } from 'react'
import axios from 'axios'

const API = '/api/traffic'

const SUGGESTIONS = [
  { label:'👋 Hello',                   text:'Hello' },
  { label:'🏙️ Delhi traffic',           text:'How is traffic in Delhi right now?' },
  { label:'🏙️ Mumbai traffic',          text:'How is traffic in Mumbai?' },
  { label:'🏙️ Bengaluru traffic',       text:'How is traffic in Bengaluru?' },
  { label:'🛣️ Delhi to Mumbai route',   text:'What is the best route from Delhi to Mumbai?' },
  { label:'🛣️ Delhi to Jaipur',         text:'How to go from Delhi to Jaipur? Best route?' },
  { label:'🌧️ Rain impact',             text:'How does rain affect traffic in India?' },
  { label:'🕐 Best time to travel',     text:'When is the best time to travel to avoid traffic?' },
  { label:'⛽ Fuel cost Delhi-Mumbai',  text:'How much fuel will I need from Delhi to Mumbai?' },
  { label:'⚡ Signal timings',           text:'What are the current signal timings?' },
  { label:'🚨 Emergency routing',       text:'How does emergency vehicle routing work?' },
  { label:'🚌 Metro vs driving',        text:'Should I take the metro or drive in Delhi?' },
  { label:'🛣️ NH-48 status',            text:'Tell me about NH-48 highway' },
  { label:'🏙️ Worst traffic city',      text:'Which city in India has the worst traffic?' },
]

let sessionId = `session-${Date.now()}`

export default function Chatbot() {
  const [messages,  setMessages]  = useState([{
    role: 'bot',
    text: "👋 Hi! I'm your AI Traffic Assistant powered by Llama 3.\n\nI can answer anything about Indian traffic:\n• Route recommendations (Delhi→Mumbai, Bengaluru→Chennai...)\n• City traffic conditions\n• Highway status & toll costs\n• Weather impact on roads\n• Peak hours & best travel times\n• Fuel cost estimates\n• Emergency routing\n\nJust ask me anything!",
    powered_by: null,
  }])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [aiStatus,  setAiStatus]  = useState(null)  // 'groq' | 'rule-based' | null
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (textArg) => {
    const text = (textArg ?? input).trim()
    if (!text || loading) return
    setInput('')

    const userMsg = { role: 'user', text, time: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await axios.post(`${API}/chatbot`, {
        message:   text,
        sessionId: sessionId,
      })

      const reply      = res.data?.botResponse || '⚠️ Empty response.'
      const powered_by = res.data?.powered_by  || 'Rule-Based'

      setAiStatus(powered_by.includes('Groq') ? 'groq' : 'rule-based')
      setMessages(prev => [...prev, {
        role: 'bot',
        text: reply,
        powered_by,
        time: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }),
      }])
    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, {
        role: 'bot',
        text: '⚠️ Could not reach the AI service. Make sure Flask is running on port 5002.',
        time: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }),
      }])
    }

    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem', flexWrap:'wrap', gap:'8px' }}>
        <div>
          <h1 style={{ fontSize:'1.4rem', fontWeight:700, marginBottom:'4px' }}>AI Traffic Assistant</h1>
          <p style={{ fontSize:'12px', color:'var(--text-muted)' }}>
            Ask anything about traffic in India — routes, cities, highways, weather, fuel costs
          </p>
        </div>
        {/* AI status badge */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {aiStatus === 'groq' ? (
            <span style={{
              background:'rgba(45,212,191,0.12)', border:'1px solid var(--teal-mid)',
              color:'var(--teal)', fontFamily:'var(--mono)', fontSize:'11px',
              fontWeight:700, padding:'4px 12px', borderRadius:'100px',
              display:'flex', alignItems:'center', gap:'5px',
            }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--teal)', display:'inline-block', animation:'pulse 2s infinite' }}/>
              Llama 3 · Groq AI
            </span>
          ) : aiStatus === 'rule-based' ? (
            <span style={{
              background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.3)',
              color:'var(--amber)', fontFamily:'var(--mono)', fontSize:'11px',
              fontWeight:700, padding:'4px 12px', borderRadius:'100px',
            }}>
              ⚠️ Rule-Based Mode
            </span>
          ) : (
            <span style={{
              background:'var(--surface2)', border:'1px solid var(--border2)',
              color:'var(--text-muted)', fontFamily:'var(--mono)', fontSize:'11px',
              padding:'4px 12px', borderRadius:'100px',
            }}>
              ◎ AI Ready
            </span>
          )}
        </div>
      </div>

      {/* Groq key notice if in rule-based mode */}
      {aiStatus === 'rule-based' && (
        <div style={{
          background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.25)',
          borderRadius:'var(--radius-md)', padding:'10px 14px', marginBottom:'12px',
          fontSize:'12px', color:'var(--amber)', lineHeight:1.6,
        }}>
          ⚡ <strong>Unlock full AI power:</strong> Get a free Groq API key at{' '}
          <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ color:'var(--teal)' }}>console.groq.com</a>
          {' '}then run: <code style={{ background:'var(--surface2)', padding:'1px 6px', borderRadius:4, fontFamily:'var(--mono)' }}>export GROQ_API_KEY=your_key</code>
          {' '}and restart Flask.
        </div>
      )}

      {/* Chat window */}
      <div style={{
        background:'var(--surface)', border:'1px solid var(--border)',
        borderRadius:'var(--radius-xl)', display:'flex',
        flexDirection:'column', height:'580px', overflow:'hidden',
      }}>

        {/* Messages */}
        <div style={{ flex:1, overflowY:'auto', padding:'1.25rem', display:'flex', flexDirection:'column', gap:'14px' }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              display:'flex',
              flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
              alignItems:'flex-end', gap:'8px',
            }}>
              {m.role === 'bot' && (
                <div style={{
                  width:32, height:32, borderRadius:'50%',
                  background: aiStatus === 'groq' ? 'var(--teal-dim)' : 'var(--surface2)',
                  border:`1px solid ${aiStatus === 'groq' ? 'var(--teal-mid)' : 'var(--border2)'}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'15px', flexShrink:0,
                }}>◎</div>
              )}
              <div style={{ maxWidth:'74%' }}>
                <div style={{
                  background: m.role === 'user' ? 'var(--teal)' : 'var(--surface2)',
                  color: m.role === 'user' ? '#08090d' : 'var(--text)',
                  borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                  padding:'11px 15px', fontSize:'13px', lineHeight:1.75,
                  whiteSpace:'pre-line', wordBreak:'break-word',
                  boxShadow: m.role === 'bot' ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
                }}>
                  {m.text}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'3px', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  {m.time && <span style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:'var(--mono)' }}>{m.time}</span>}
                  {m.powered_by && (
                    <span style={{ fontSize:'10px', color: m.powered_by.includes('Groq') ? 'var(--teal)' : 'var(--text-muted)', fontFamily:'var(--mono)' }}>
                      · {m.powered_by}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div style={{ display:'flex', alignItems:'flex-end', gap:'8px' }}>
              <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--teal-dim)', border:'1px solid var(--teal-mid)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'15px' }}>◎</div>
              <div style={{ background:'var(--surface2)', borderRadius:'4px 18px 18px 18px', padding:'12px 18px', display:'flex', gap:'5px', alignItems:'center' }}>
                {[0,1,2].map(i => (
                  <span key={i} style={{ width:7, height:7, borderRadius:'50%', background:'var(--teal)', display:'inline-block', animation:`bounce 1.2s ${i*0.2}s infinite ease-in-out` }}/>
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Suggestion chips */}
        <div style={{ borderTop:'1px solid var(--border)', padding:'10px 14px 8px', display:'flex', gap:'6px', flexWrap:'wrap' }}>
          {SUGGESTIONS.map(s => (
            <button key={s.text} onClick={() => send(s.text)} disabled={loading} style={{
              background:'var(--surface2)', border:'1px solid var(--border2)',
              color:'var(--text-muted)', borderRadius:'100px',
              fontSize:'11px', padding:'4px 12px', cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily:'var(--sans)', transition:'all 0.15s', opacity: loading ? 0.5 : 1,
            }}
              onMouseOver={e => { if (!loading) { e.currentTarget.style.color='var(--teal)'; e.currentTarget.style.borderColor='var(--teal-mid)'; e.currentTarget.style.background='var(--teal-dim)' }}}
              onMouseOut={e  => { e.currentTarget.style.color='var(--text-muted)'; e.currentTarget.style.borderColor='var(--border2)'; e.currentTarget.style.background='var(--surface2)' }}
            >{s.label}</button>
          ))}
        </div>

        {/* Input */}
        <div style={{ borderTop:'1px solid var(--border)', padding:'12px 14px', display:'flex', gap:'8px', alignItems:'center' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask anything about traffic in India…"
            disabled={loading}
            autoFocus
            style={{
              flex:1, background:'var(--surface2)', border:'1px solid var(--border2)',
              borderRadius:'var(--radius-md)', color:'var(--text)',
              fontFamily:'var(--sans)', fontSize:'13px', padding:'10px 14px', outline:'none',
            }}
            onFocus={e => e.target.style.borderColor='var(--teal-mid)'}
            onBlur={e  => e.target.style.borderColor='var(--border2)'}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()} style={{
            background: input.trim() && !loading ? 'var(--teal)' : 'var(--surface2)',
            color: input.trim() && !loading ? '#08090d' : 'var(--text-muted)',
            border:'none', borderRadius:'var(--radius-md)', padding:'10px 22px',
            fontFamily:'var(--sans)', fontSize:'13px', fontWeight:700,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            transition:'all 0.15s', whiteSpace:'nowrap',
          }}>{loading ? '…' : 'Send ↑'}</button>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  )
}
