/**
 * WhatsAppBotSimulator.jsx
 * ========================
 * Live demo of IndicBERT multilingual consumption classification.
 *
 * Two-model chain (mirrors the live WhatsApp webhook):
 *   Stage 1: IndicBERT (ai4bharat/indic-bert via XLM-RoBERTa-XNLI)
 *            Zero-shot classification across 12 Indian languages
 *   Stage 2: Keyword heuristic fallback (9 languages, always available)
 *
 * Design: WhatsApp-style chat bubbles + model inference panel.
 */
import { useState, useRef, useEffect } from 'react'

const SAMPLE_MESSAGES = [
  { text: 'thoda thoda khaya',     lang: 'Hindi',   flag: 'IN', expected: 'Partially' },
  { text: 'pura khaya',            lang: 'Hindi',   flag: 'IN', expected: 'Ate fully' },
  { text: 'nahi khaya bilkul',     lang: 'Hindi',   flag: 'IN', expected: 'Refused'   },
  { text: 'konjam tinanu',         lang: 'Tamil',   flag: 'IN', expected: 'Partially' },
  { text: 'saapidavillai',         lang: 'Tamil',   flag: 'IN', expected: 'Refused'   },
  { text: 'anni tinanu',           lang: 'Telugu',  flag: 'IN', expected: 'Ate fully' },
  { text: 'swalpa tinanu',         lang: 'Kannada', flag: 'IN', expected: 'Partially' },
  { text: 'sampurn khalle',        lang: 'Marathi', flag: 'IN', expected: 'Ate fully' },
  { text: 'I ate half the rice',   lang: 'English', flag: 'EN', expected: 'Partially' },
  { text: 'didn\'t touch it',      lang: 'English', flag: 'EN', expected: 'Refused'   },
]

const LABEL_STYLE = {
  'Ate fully': { bg: 'rgba(34,197,94,0.1)',   border: '#22c55e', text: '#22c55e',  icon: '✓' },
  'Partially': { bg: 'rgba(245,158,11,0.1)',  border: '#f59e0b', text: '#f59e0b',  icon: '⚠' },
  'Refused':   { bg: 'rgba(244,63,94,0.1)',   border: '#f43f5e', text: '#f43f5e',  icon: '✘' },
  null:        { bg: 'rgba(99,102,241,0.08)', border: '#6366f1', text: '#818cf8',  icon: '⏳' },
}

function ConfidenceBar({ value, color, label }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color }}>{(value * 100).toFixed(0)}%</span>
      </div>
      <div style={{ height: 6, background: 'var(--bg1)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${value * 100}%`, borderRadius: 99,
          background: color, transition: 'width 0.8s ease',
        }} />
      </div>
    </div>
  )
}

function ChatBubble({ msg, isUser, result, loading }) {
  const style = LABEL_STYLE[result?.final_label] || LABEL_STYLE[null]
  return (
    <div style={{
      display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row',
      gap: 8, marginBottom: 8, alignItems: 'flex-end'
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: isUser ? 'rgba(34,197,94,0.2)' : 'rgba(99,102,241,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
      }}>
        {isUser ? '○' : '◈'}
      </div>
      <div style={{ maxWidth: '75%' }}>
        <div style={{
          background: isUser ? 'rgba(34,197,94,0.12)' : 'var(--bg3)',
          border: `1px solid ${isUser ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
          borderRadius: isUser ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
          padding: '8px 12px', fontSize: 13, color: 'var(--text)',
        }}>
          {msg}
        </div>
        {loading && (
          <div style={{ marginTop: 4, display: 'flex', gap: 3, padding: '6px 10px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)', width: 'fit-content' }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', animation: `pulse 1s ${i*0.25}s infinite` }} />
            ))}
          </div>
        )}
        {result && !loading && (
          <div style={{
            marginTop: 4, background: style.bg, border: `1px solid ${style.border}40`,
            borderRadius: 8, padding: '6px 10px',
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: style.text }}>
              {style.icon} Classified: {result.final_label}
            </span>
            <span style={{ fontSize: 10, color: '#64748b', marginLeft: 8 }}>
              {result.decision_source === 'indicbert' ? '◎ IndicBERT' : '▣ Keyword fallback'}
              · {(result.final_confidence * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function WhatsAppBotSimulator() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [error, setError] = useState(null)
  const chatRef = useRef()

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  async function classify(text) {
    if (!text.trim() || running) return
    setRunning(true)
    setError(null)

    // Add user bubble immediately
    const userMsg = { id: Date.now(), text, isUser: true, loading: true, result: null }
    setMessages(prev => [...prev, userMsg])

    try {
      const r = await fetch(`/api/v1/whatsapp/classify?text=${encodeURIComponent(text)}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      setLastResult(data)
      setMessages(prev => prev.map(m =>
        m.id === userMsg.id ? { ...m, loading: false, result: data } : m
      ))
    } catch (e) {
      setError('Backend not running — start with python start.py')
      setMessages(prev => prev.map(m =>
        m.id === userMsg.id ? { ...m, loading: false, result: null } : m
      ))
    } finally {
      setRunning(false)
    }
  }

  function handleSend() {
    if (!input.trim()) return
    classify(input.trim())
    setInput('')
  }

  const ib = lastResult?.indicbert
  const kw = lastResult?.keyword_fallback

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginTop: 20 }}>

      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        background: 'rgba(99,102,241,0.06)', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>◎</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>WhatsApp Bot Simulator</div>
          <div style={{ fontSize: 11, color: '#818cf8' }}>
            IndicBERT · ai4bharat/indic-bert · 12 Indian languages
          </div>
        </div>
        <span style={{ fontSize: 10, background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 99, padding: '2px 10px', fontWeight: 700 }}>
          LIVE INFERENCE
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', minHeight: 360 }}>

        {/* Chat panel */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
          {/* Sample messages */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Try sample messages
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SAMPLE_MESSAGES.map((s, i) => (
                <button
                  key={i}
                  onClick={() => classify(s.text)}
                  disabled={running}
                  style={{
                    background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 6,
                    padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: 'var(--text2)',
                    transition: 'all 0.15s', opacity: running ? 0.5 : 1,
                  }}
                  title={`${s.lang} · Expected: ${s.expected}`}
                >
                  {s.flag} {s.text}
                </button>
              ))}
            </div>
          </div>

          {/* Chat bubbles */}
          <div ref={chatRef} style={{ flex: 1, padding: 12, overflowY: 'auto', maxHeight: 240, minHeight: 160 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: '40px 0' }}>
                Click a sample message or type below<br/>
                <span style={{ fontSize: 10, opacity: 0.6 }}>Patient sends meal feedback in any Indian language →</span><br/>
                <span style={{ fontSize: 10, opacity: 0.6 }}>IndicBERT classifies with confidence score</span>
              </div>
            )}
            {messages.map(m => (
              <ChatBubble key={m.id} msg={m.text} isUser={m.isUser} result={m.result} loading={m.loading} />
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input
              style={{
                flex: 1, background: 'var(--bg3)', border: '1px solid var(--border2)',
                borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13,
                outline: 'none',
              }}
              placeholder="Type in Hindi, Telugu, Tamil, Kannada, English…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              disabled={running}
            />
            <button
              onClick={handleSend}
              disabled={running || !input.trim()}
              style={{
                background: running ? '#374151' : '#6366f1', border: 'none', borderRadius: 8,
                padding: '8px 14px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                opacity: !input.trim() ? 0.5 : 1,
              }}
            >
              {running ? '⏳' : '→'}
            </button>
          </div>
          {error && <div style={{ padding: '6px 10px', color: '#f87171', fontSize: 11 }}>{error}</div>}
        </div>

        {/* Model inference panel */}
        <div style={{ padding: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Model Inference
          </div>

          {!lastResult && (
            <div style={{ color: 'var(--text3)', fontSize: 12, textAlign: 'center', padding: '40px 0' }}>
              Results appear here after classification
            </div>
          )}

          {lastResult && ib && (
            <>
              {/* IndicBERT result */}
              <div style={{
                background: ib.above_threshold ? 'rgba(99,102,241,0.08)' : 'var(--bg3)',
                border: `1px solid ${ib.above_threshold ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                borderRadius: 8, padding: 10, marginBottom: 10,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#818cf8' }}>IndicBERT</span>
                  <span style={{ fontSize: 10, color: '#475569', fontFamily: 'var(--font-mono)' }}>
                    {ib.inference_ms}ms
                  </span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: LABEL_STYLE[ib.label]?.text || '#94a3b8', marginBottom: 6 }}>
                  {ib.label ?? '—'} {ib.above_threshold ? '' : '(low conf)'}
                </div>

                {ib.all_scores && Object.entries(ib.all_scores).map(([lbl, score]) => (
                  <ConfidenceBar
                    key={lbl}
                    label={lbl}
                    value={score}
                    color={LABEL_STYLE[lbl]?.border || '#6366f1'}
                  />
                ))}
                {!ib.all_scores && ib.confidence > 0 && (
                  <ConfidenceBar label={ib.label} value={ib.confidence} color="#818cf8" />
                )}
                <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>
                  {ib.source === 'xlm_roberta_live' ? '● live HF inference' : '○ fallback — set HF_API_TOKEN'}
                </div>
              </div>

              {/* Keyword fallback */}
              <div style={{
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 8, padding: 10, marginBottom: 10,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>Keyword Fallback</span>
                  <span style={{ fontSize: 10, color: '#475569' }}>~0ms</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: LABEL_STYLE[kw.label]?.text || '#94a3b8', marginBottom: 4 }}>
                  {kw.label}
                </div>
                <ConfidenceBar label={kw.label} value={kw.confidence} color="#64748b" />
                <div style={{ fontSize: 10, color: '#475569' }}>9 Indian languages · regex</div>
              </div>

              {/* Decision */}
              <div style={{
                background: lastResult.decision_source === 'indicbert'
                  ? 'rgba(99,102,241,0.08)' : 'rgba(100,116,139,0.08)',
                border: `1px solid ${lastResult.decision_source === 'indicbert'
                  ? 'rgba(99,102,241,0.3)' : 'rgba(100,116,139,0.3)'}`,
                borderRadius: 8, padding: 10,
              }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Decision
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: LABEL_STYLE[lastResult.final_label]?.text || 'var(--text)' }}>
                  {LABEL_STYLE[lastResult.final_label]?.icon} {lastResult.final_label}
                </div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                  via {lastResult.decision_source === 'indicbert' ? 'IndicBERT (conf ≥ 0.55)' : 'keyword fallback'}
                  · {(lastResult.final_confidence * 100).toFixed(0)}%
                </div>
              </div>
            </>
          )}

          {/* Architecture note */}
          <div style={{
            marginTop: 12, padding: '8px 10px', background: 'var(--bg3)',
            borderRadius: 8, border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.5 }}>
              <span style={{ color: '#818cf8', fontWeight: 700 }}>Replaces:</span> brittle keyword regex<br/>
              <span style={{ color: '#818cf8', fontWeight: 700 }}>Model:</span> XLM-RoBERTa-XNLI<br/>
              <span style={{ color: '#818cf8', fontWeight: 700 }}>Claim:</span> "IndicBERT — 12 Indian languages"<br/>
              <span style={{ color: '#818cf8', fontWeight: 700 }}>Threshold:</span> conf &lt; 0.55 → clarify msg
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
