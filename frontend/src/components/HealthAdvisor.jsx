// HealthAdvisor.jsx — NutriGuide Dietitian AI Advisor
// Calls POST /api/v1/ask_dietitian_ai — no JWT, no undefined endpoints
import { useState, useRef, useEffect } from 'react'
import { VoiceMic, useVoiceInput } from './useVoiceInput'

const PATIENTS = [
  { id: 'P001', label: 'P001 — Ravi Kumar (Diabetes)' },
  { id: 'P002', label: 'P002 — Meena Iyer (Renal)' },
  { id: 'P003', label: 'P003 — Arjun Singh (Post-GI)' },
]

const SUGGESTIONS = [
  'What foods should be avoided for a diabetic patient?',
  'Explain low-potassium diet guidelines for renal failure.',
  'What are safe high-protein options for post-surgery recovery?',
  'List permitted snacks for fluid-restricted patients.',
  'How often should meal plans be reviewed for ICU patients?',
]

function Bubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 14,
      gap: 10,
      alignItems: 'flex-start',
    }}>
      {!isUser && (
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: 'var(--teal-dim)', border: '1px solid var(--teal-glow)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, color: 'var(--teal)', marginTop: 2,
        }}>◐</div>
      )}
      <div style={{ maxWidth: '78%' }}>
        <div style={{
          padding: '10px 14px',
          borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
          background: isUser ? 'var(--teal)' : 'var(--bg3)',
          color: isUser ? '#fff' : 'var(--text)',
          border: isUser ? 'none' : '1px solid var(--border2)',
          fontSize: 13, lineHeight: 1.65,
        }}>
          {msg.content}
        </div>
        {msg.source && (
          <div style={{
            fontSize: 10, color: 'var(--text3)', marginTop: 4,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{
              padding: '1px 6px', borderRadius: 99,
              background: msg.source.includes('gemini') ? '#7C3AED20' : 'var(--teal-dim)',
              color: msg.source.includes('gemini') ? '#7C3AED' : 'var(--teal)',
              border: `1px solid ${msg.source.includes('gemini') ? '#7C3AED40' : 'var(--teal-glow)'}`,
              fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {msg.source.includes('gemini') ? '✦ Gemini' : '◐ Ollama'}
            </span>
            <span>AI response · NutriGuide clinical context</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function HealthAdvisor({ patientId: externalPatientId }) {
  const [patientId, setPatientId] = useState(externalPatientId || 'P001')
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m the NutriGuide Health Advisor, powered by local Ollama with Gemini fallback. Ask me clinical nutrition questions about any patient.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef()

  // sync if external patientId changes
  useEffect(() => { if (externalPatientId) setPatientId(externalPatientId) }, [externalPatientId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const voice = useVoiceInput({
    onTranscript: t => setInput(p => (p + ' ' + t).trim()),
  })

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages(m => [...m, { role: 'user', content: text }])
    setLoading(true)

    const r = await fetch('/api/v1/ask_dietitian_ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId, question: text }),
    })
      .then(res => res.json())
      .catch(() => ({ response: '⚠ Could not reach the dietitian AI. Is the backend running on port 8179?' }))

    setMessages(m => [...m, {
      role: 'assistant',
      content: r.response || r.answer || r.error || 'No response received.',
      source: r.source,
    }])
    setLoading(false)
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 520, padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--green)', animation: 'pulse-ring 2s infinite',
          }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)' }}>Health Advisor</span>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Ollama · Clinical Nutrition AI</span>
        </div>
        <select
          className="input"
          value={patientId}
          onChange={e => setPatientId(e.target.value)}
          style={{ fontSize: 11, padding: '4px 8px', maxWidth: 220 }}
        >
          {PATIENTS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 8px' }}>
        {messages.map((m, i) => <Bubble key={i} msg={m} />)}
        {loading && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--teal-dim)', border: '1px solid var(--teal-glow)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--teal)',
            }}>◐</div>
            <div style={{
              padding: '11px 16px', background: 'var(--bg3)',
              borderRadius: '4px 12px 12px 12px', border: '1px solid var(--border2)',
            }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--teal)', animation: `pulse-ring 1.2s ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      <div style={{
        padding: '8px 18px', borderTop: '1px solid var(--border)',
        display: 'flex', gap: 6, overflowX: 'auto',
      }}>
        {SUGGESTIONS.slice(0, 4).map(s => (
          <button key={s} onClick={() => setInput(s)} style={{
            padding: '4px 12px', borderRadius: 99, flexShrink: 0, fontSize: 11,
            border: '1px solid var(--border2)', background: 'var(--bg3)',
            color: 'var(--text3)', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            {s.slice(0, 30)}…
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 18px', borderTop: '1px solid var(--border)',
        display: 'flex', gap: 8,
      }}>
        <input
          className="input"
          placeholder="Ask a clinical nutrition question…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          style={{ flex: 1 }}
        />
        <VoiceMic voice={voice} accentColor="var(--teal)" compact />
        <button
          className="btn btn-primary"
          onClick={send}
          disabled={loading || !input.trim()}
          style={{ padding: '8px 16px', fontSize: 12 }}
        >
          {loading ? '…' : '→'}
        </button>
      </div>
    </div>
  )
}
