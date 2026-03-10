import { useState, useRef, useEffect, useCallback, useContext } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Volume2, VolumeX, Pause, Play, Square, Mic, MicOff, Globe, RotateCcw, Loader2, Check, Bot, User } from 'lucide-react'
import PQSignedRAG from '../components/PQSignedRAG.jsx'
import AIThinkingViz from '../components/AIThinkingViz.jsx'
import { LangContext } from '../App.jsx'
import { t } from '../nutriguide_i18n.js'

const SUGGESTED = [
  'Why can renal patients not eat banana?',
  'Safe protein sources for CKD Stage 4?',
  'What substitutes tomato in a low-potassium plan?',
  'How does ragi compare to white rice for diabetics?',
  'Best foods for Day 3 post-GI surgery patient?',
  'Explain phosphorus restriction rationale',
]

const LANGS = [
  { code: 'en', label: 'English',   bcp: 'en-IN' },
  { code: 'hi', label: '\u0939\u093f\u0902\u0926\u0940',     bcp: 'hi-IN' },
  { code: 'mr', label: '\u092e\u0930\u093e\u0920\u0940',   bcp: 'mr-IN' },
  { code: 'te', label: '\u0c24\u0c46\u0c32\u0c41\u0c17\u0c41',   bcp: 'te-IN' },
  { code: 'ta', label: '\u0ba4\u0bae\u0bbf\u0bb4\u0bcd',    bcp: 'ta-IN' },
  { code: 'kn', label: '\u0c95\u0ca8\u0ccd\u0ca8\u0ca1',   bcp: 'kn-IN' },
  { code: 'bn', label: '\u09ac\u09be\u0982\u09b2\u09be',   bcp: 'bn-IN' },
  { code: 'gu', label: '\u0a97\u0ac1\u0a9c\u0ab0\u0abe\u0aa4\u0ac0', bcp: 'gu-IN' },
  { code: 'ml', label: '\u0d2e\u0d32\u0d2f\u0d3e\u0d33\u0d02',  bcp: 'ml-IN' },
]

// Strip markdown for TTS
function stripMarkdown(text) {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function splitChunks(text, maxLen = 220) {
  const chunks = []
  let rem = text
  while (rem.length > maxLen) {
    let cut = Math.max(rem.lastIndexOf('. ', maxLen), rem.lastIndexOf(', ', maxLen))
    if (cut === -1) cut = maxLen
    else cut += 2
    chunks.push(rem.slice(0, cut).trim())
    rem = rem.slice(cut).trim()
  }
  if (rem) chunks.push(rem)
  return chunks
}

// ═══════════════════════════════════════════════════════════════════
// useTTS — native browser utterance + Edge-TTS backend fallback
// ═══════════════════════════════════════════════════════════════════
function useTTS() {
  const [speaking, setSpeaking] = useState(false)
  const [paused,   setPaused]   = useState(false)
  const audioRef = useRef(null)

  async function speakViaBackend(text, langCode) {
    try {
      const res = await fetch('/api/v1/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: stripMarkdown(text), language: langCode }),
      })
      if (!res.ok) return false
      const { audio_base64 } = await res.json()
      if (!audio_base64) return false
      const bytes = Uint8Array.from(atob(audio_base64), c => c.charCodeAt(0))
      const blob  = new Blob([bytes], { type: 'audio/mpeg' })
      const url   = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      setSpeaking(true)
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url) }
      audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url) }
      await audio.play().catch(() => {})
      return true
    } catch { return false }
  }

  function speak(text, bcp, voice) {
    if (!window.speechSynthesis) return
    try {
      window.speechSynthesis.cancel()
      const chunks = splitChunks(stripMarkdown(text))
      if (!chunks.length) return
      setSpeaking(true)
      const speakChunk = (idx) => {
        if (idx >= chunks.length) { setSpeaking(false); setPaused(false); return }
        const utt = new SpeechSynthesisUtterance(chunks[idx])
        utt.lang = bcp || 'en-IN'
        utt.rate = 0.9
        if (voice) utt.voice = voice
        utt.onend   = () => speakChunk(idx + 1)
        utt.onerror = () => { setSpeaking(false); setPaused(false) }
        try { window.speechSynthesis.speak(utt) } catch { setSpeaking(false); setPaused(false) }
      }
      speakChunk(0)
    } catch { setSpeaking(false); setPaused(false) }
  }

  function stop()   { try { window.speechSynthesis?.cancel() } catch {} ; try { audioRef.current?.pause(); audioRef.current = null } catch {} ; setSpeaking(false); setPaused(false) }
  function pause()  { try { window.speechSynthesis?.pause();  audioRef.current?.pause();       setPaused(true)  } catch {} }
  function resume() { try { window.speechSynthesis?.resume(); audioRef.current?.play();         setPaused(false) } catch {} }

  return { speak, speakViaBackend, stop, pause, resume, speaking, paused }
}

// ═══════════════════════════════════════════════════════════════════
// Markdown renderer — no external deps
// ═══════════════════════════════════════════════════════════════════
function renderInline(text) {
  const parts = []
  const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
  let last = 0, m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[2]) parts.push(<strong key={m.index} style={{ fontStyle: 'italic' }}>{m[2]}</strong>)
    else if (m[3]) parts.push(<strong key={m.index}>{m[3]}</strong>)
    else if (m[4]) parts.push(<em key={m.index}>{m[4]}</em>)
    else if (m[5]) parts.push(
      <code key={m.index} style={{
        background: 'var(--bg3-solid)', padding: '1px 5px', borderRadius: 4,
        fontSize: 11, fontFamily: 'var(--font-mono, monospace)'
      }}>{m[5]}</code>
    )
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 0 ? text : parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
}

function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const out = []
  let listItems = [], listType = null, key = 0

  const flushList = () => {
    if (!listItems.length) return
    const Tag = listType === 'ol' ? 'ol' : 'ul'
    out.push(
      <Tag key={key++} style={{
        margin: '6px 0 6px 18px', padding: 0,
        lineHeight: 1.7,
        listStyleType: listType === 'ol' ? 'decimal' : 'disc',
      }}>
        {listItems.map((item, j) => (
          <li key={j} style={{ marginBottom: 3, paddingLeft: 2 }}>{renderInline(item)}</li>
        ))}
      </Tag>
    )
    listItems = []; listType = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.trim() === '') {
      flushList()
      out.push(<div key={key++} style={{ marginBottom: 6 }} />)
      continue
    }

    const h1 = line.match(/^#\s+(.+)/)
    if (h1) { flushList(); out.push(<div key={key++} style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent)', margin: '10px 0 5px', letterSpacing: '-0.01em' }}>{renderInline(h1[1])}</div>); continue }

    const h2 = line.match(/^##\s+(.+)/)
    if (h2) { flushList(); out.push(<div key={key++} style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)', margin: '8px 0 4px' }}>{renderInline(h2[1])}</div>); continue }

    const h3 = line.match(/^###\s+(.+)/)
    if (h3) { flushList(); out.push(<div key={key++} style={{ fontWeight: 600, fontSize: 12, color: 'var(--text2)', margin: '6px 0 3px' }}>{renderInline(h3[1])}</div>); continue }

    const olMatch = line.match(/^(\d+)\.\s+(.+)/)
    if (olMatch) { if (listType !== 'ol') { flushList(); listType = 'ol' }; listItems.push(olMatch[2]); continue }

    const ulMatch = line.match(/^[-*•]\s+(.+)/)
    if (ulMatch) { if (listType !== 'ul') { flushList(); listType = 'ul' }; listItems.push(ulMatch[1]); continue }

    const hrMatch = line.match(/^[-*_]{3,}$/)
    if (hrMatch) { flushList(); out.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />); continue }

    flushList()
    out.push(<div key={key++} style={{ marginBottom: 2 }}>{renderInline(line)}</div>)
  }

  flushList()
  return out
}

// ═══════════════════════════════════════════════════════════════════
// Canvas waveform (same pattern as AgriSahayak VoiceCommandBar)
// ═══════════════════════════════════════════════════════════════════
function WaveformCanvas({ analyserRef, active }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let rafId
    function draw() {
      rafId = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const analyser = analyserRef.current
      if (!analyser) {
        // idle pulse bars
        const count = 12
        for (let i = 0; i < count; i++) {
          const h = 4 + Math.abs(Math.sin(Date.now() / 300 + i * 0.5)) * 16
          ctx.fillStyle = 'rgba(249,115,22,0.5)'
          ctx.beginPath()
          ctx.roundRect?.(i * 8, (canvas.height - h) / 2, 5, h, 2) ?? ctx.rect(i * 8, (canvas.height - h) / 2, 5, h)
          ctx.fill()
        }
        return
      }
      const bufLen = analyser.frequencyBinCount
      const data = new Uint8Array(bufLen)
      analyser.getByteFrequencyData(data)
      const count = 12
      for (let i = 0; i < count; i++) {
        const val = data[Math.floor((i / count) * bufLen)] / 255
        const h = Math.max(4, val * canvas.height)
        ctx.fillStyle = `rgba(249,115,22,${0.4 + val * 0.6})`
        ctx.beginPath()
        ctx.roundRect?.(i * 8, (canvas.height - h) / 2, 5, h, 2) ?? ctx.rect(i * 8, (canvas.height - h) / 2, 5, h)
        ctx.fill()
      }
    }
    draw()
    return () => cancelAnimationFrame(rafId)
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={canvasRef} width={108} height={28} style={{ display: 'block', borderRadius: 4 }} />
}

// ═══════════════════════════════════════════════════════════════════
// useWhisperVoice — Web Speech API primary, Gemini Whisper fallback
// ═══════════════════════════════════════════════════════════════════
function useWhisperVoice({ onTranscript }) {
  const [voiceState, setVoiceState] = useState('idle') // idle | recording | processing
  const [interim, setInterim] = useState('')
  const srRef       = useRef(null)
  const analyserRef = useRef(null)
  const audioCtxRef = useRef(null)
  const streamRef   = useRef(null)
  const mediaRecRef = useRef(null)
  const chunksRef   = useRef([])

  const teardown = useCallback(() => {
    analyserRef.current = null
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    audioCtxRef.current?.close(); audioCtxRef.current = null
  }, [])

  const stopVoice = useCallback(() => {
    srRef.current?.stop(); srRef.current = null
    mediaRecRef.current?.stop(); mediaRecRef.current = null
    setVoiceState('idle'); setInterim(''); teardown()
  }, [teardown])

  const startVoice = useCallback(async () => {
    if (voiceState !== 'idle') { stopVoice(); return }

    // -- AudioContext waveform setup --
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      audioCtxRef.current = audioCtx
      const analyser = audioCtx.createAnalyser(); analyser.fftSize = 64
      audioCtx.createMediaStreamSource(stream).connect(analyser)
      analyserRef.current = analyser
    } catch { /* allow without mic waveform */ }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition

    if (SR) {
      // Primary: Web Speech API — instant, zero latency
      const sr = new SR()
      srRef.current = sr
      sr.lang = 'en-IN'; sr.interimResults = true; sr.maxAlternatives = 1; sr.continuous = false

      sr.onresult = (e) => {
        let fin = '', int = ''
        for (const r of e.results) { if (r.isFinal) fin += r[0].transcript; else int += r[0].transcript }
        setInterim(int)
        if (fin) { onTranscript(fin.trim()); stopVoice() }
      }
      sr.onerror = () => stopVoice()
      sr.onend   = stopVoice

      sr.start()
      setVoiceState('recording')
    } else if (streamRef.current) {
      // Fallback: MediaRecorder → POST to /api/v1/voice/transcribe (Gemini Whisper)
      chunksRef.current = []
      const rec = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecRef.current = rec
      rec.ondataavailable = e => chunksRef.current.push(e.data)
      rec.onstop = async () => {
        setVoiceState('processing')
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          const fd = new FormData(); fd.append('audio', blob, 'voice.webm')
          const res = await fetch('/api/v1/voice/transcribe', { method: 'POST', body: fd })
          const data = await res.json()
          if (data.text) { onTranscript(data.text.trim()) }
        } catch { /* silently ignore */ }
        stopVoice()
      }
      rec.start()
      setVoiceState('recording')
    }
  }, [voiceState, stopVoice, onTranscript])

  return { voiceState, interim, startVoice, stopVoice, analyserRef }
}

// ═══════════════════════════════════════════════════════════════════
// Bot speaking animation (3 animated bars on avatar)
// ═══════════════════════════════════════════════════════════════════
function BotSpeakingWave() {
  return (
    <div style={{ position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'flex-end', gap: 1, pointerEvents: 'none' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          display: 'block', width: 3, height: 9,
          background: 'var(--accent)', borderRadius: 2,
          transformOrigin: 'bottom',
          animation: `botBarPulse 0.65s ease-in-out infinite`,
          animationDelay: `${i * 0.14}s`,
        }} />
      ))}
    </div>
  )
}

// Typing indicator (3 bouncing dots)
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>◐</div>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: '4px 12px 12px 12px', padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 14 }}>
          {[0, 1, 2].map(i => (
            <motion.span key={i} style={{ display: 'block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', opacity: 0.6 }}
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Message bubble
// ═══════════════════════════════════════════════════════════════════
function Message({ msg, onSpeak }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div
      style={{ display: 'flex', gap: 12, justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 16 }}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
    >
      {!isUser && (
        <div style={{
          width: 30, height: 30, borderRadius: '50%', background: 'var(--accent-soft)',
          border: '1px solid var(--accent-glow)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 14, flexShrink: 0, position: 'relative'
        }}>◐</div>
      )}
      <div className="group" style={{ position: 'relative', maxWidth: '76%' }}>
        <div style={{
          padding: '11px 16px', borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
          background: isUser ? 'var(--accent)' : 'var(--bg2)',
          color: isUser ? '#fff' : 'var(--text)',
          border: isUser ? 'none' : '1px solid var(--border2)',
          fontSize: 13, lineHeight: 1.7,
        }}>
          {isUser ? msg.content : renderMarkdown(msg.content)}
          {msg.sources?.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sources</div>
              {msg.sources.map((s, i) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 2 }}>[{i+1}] {s.title}</div>
              ))}
            </div>
          )}
        </div>
        {!isUser && onSpeak && (
          <button onClick={() => onSpeak(msg.content)}
            title="Read aloud"
            style={{
              position: 'absolute', bottom: -8, right: -8,
              width: 20, height: 20, borderRadius: '50%',
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s',
            }}
            className="group-hover-speak"
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0'}
          >
            <Volume2 size={9} color="var(--accent)" />
          </button>
        )}
      </div>
    </motion.div>
  )
}

function RAGPanel({ patientId }) {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  async function query() {
    if (!question.trim()) return
    setLoading(true); setResult(null)
    const r = await fetch('/api/v1/rag/query', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId, question })
    }).then(r => r.json()).catch(() => null)
    setResult(r); setLoading(false)
  }

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
        Clinical RAG — Cited Sources
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14, lineHeight: 1.5 }}>
        Ask any clinical nutrition question — answers are backed by NKF, ADA, ESPEN guidelines.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input className="input" placeholder="e.g. Why no banana for renal?" value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && query()} />
        <button className="btn btn-primary" onClick={query} disabled={loading} style={{ flexShrink: 0, padding: '9px 14px' }}>
          {loading ? '…' : '→'}
        </button>
      </div>

      {/* Suggested */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {SUGGESTED.slice(0, 3).map(s => (
          <button key={s} onClick={() => { setQuestion(s); }} style={{
            padding: '4px 10px', borderRadius: 99, fontSize: 10, border: '1px solid var(--border2)',
            background: 'var(--bg3)', color: 'var(--text3)', cursor: 'pointer',
            transition: 'all 0.15s'
          }} onMouseEnter={e => e.target.style.color = 'var(--accent)'}
             onMouseLeave={e => e.target.style.color = 'var(--text3)'}>
            {s.slice(0, 28)}…
          </button>
        ))}
      </div>

      {result && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.65, marginBottom: 12, padding: '12px 14px', background: 'var(--bg2)', borderRadius: 8, borderLeft: '2px solid var(--accent)' }}>
            {renderMarkdown(result.answer)}
          </div>
          {result.sources_used?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {result.retrieved_docs_count} clinical sources retrieved
              </div>
              {result.sources_used.map((s, i) => (
                <div key={i} style={{ padding: '7px 12px', background: 'var(--bg2)', borderRadius: 8, marginBottom: 6, borderLeft: '2px solid var(--accent-glow)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 2 }}>[{i+1}] {s.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{s.reference}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DietitianAI() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I\'m the NutriGuide Dietitian AI powered by Ollama + Azure GPT-4o. Ask me clinical nutrition questions — I\'ll give you structured, evidence-based answers.\n\n**Try asking:**\n- Why can renal patients not eat banana?\n- Safe protein sources for CKD Stage 4?\n- Best substitutes for tomato in a low-potassium diet?' }
  ])
  const [input,      setInput]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [patientId,  setPatientId]  = useState('P001')
  const [activeTab,  setActiveTab]  = useState('chat')
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [ttsLang,    setTtsLang]    = useState('en')
  const [voices,     setVoices]     = useState([])
  const [selVoiceName, setSelVoiceName] = useState(() => localStorage.getItem('nutriguide_tts_voice') || '')
  const [sent,       setSent]       = useState(false)
  const bottomRef = useRef()
  const inputRef  = useRef()
  const { lang }  = useContext(LangContext)

  const { speak, speakViaBackend, stop, pause, resume, speaking, paused } = useTTS()

  const langObj    = LANGS.find(l => l.code === ttsLang) || LANGS[0]
  const langVoices = voices.filter(v =>
    v.lang.toLowerCase() === langObj.bcp.toLowerCase() ||
    v.lang.toLowerCase().startsWith(langObj.code + '-')
  )
  const selectedVoice = langVoices.find(v => v.name === selVoiceName) || langVoices[0] || null

  function speakAnswer(text) {
    if (!ttsEnabled) return
    if (langVoices.length > 0) speak(text, langObj.bcp, selectedVoice)
    else speakViaBackend(text, langObj.code)
  }

  useEffect(() => {
    function loadVoices() {
      const v = window.speechSynthesis?.getVoices() || []
      if (v.length) setVoices(v)
    }
    loadVoices()
    window.speechSynthesis?.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices)
  }, [])

  const { voiceState, interim, startVoice, stopVoice, analyserRef } = useWhisperVoice({
    onTranscript: useCallback((text) => {
      setInput(text)
    }, [])
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, interim])

  async function send(textOverride) {
    const text = (textOverride ?? input).trim(); if (!text || loading) return
    setInput('')
    setSent(true); setTimeout(() => setSent(false), 1200)
    setMessages(m => [...m, { role: 'user', content: text }])
    setLoading(true)

    const r = await fetch('/api/v1/ask_dietitian_ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId, question: text, language: ttsLang })
    }).then(r => r.json()).catch(() => ({ response: '\u26a0 Could not reach dietitian AI. Is the backend running?' }))

    const answer = r.response || r.answer || r.error || 'No response'
    setMessages(m => [...m, { role: 'assistant', content: answer, sources: r.sources }])
    setLoading(false)
    if (ttsEnabled) speakAnswer(answer)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  return (
    <div>
      <style>{`@keyframes botBarPulse { 0%,100%{transform:scaleY(0.25)} 50%{transform:scaleY(1)} } @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.15em',
          textTransform: 'uppercase', marginBottom: 8, opacity: 0.8 }}>◐ Clinical AI · Ollama + GPT-4o</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
            {t(lang, 'dietitian_title')}
          </h1>
          {/* TTS controls row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {/* Language switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg3)', borderRadius: 8, padding: '3px 6px', border: '1px solid var(--border2)' }}>
              <Globe size={11} color="var(--text3)" style={{ flexShrink: 0, marginRight: 2 }} />
              {LANGS.map(l => (
                <button key={l.code} onClick={() => setTtsLang(l.code)} style={{
                  flexShrink: 0, fontSize: 11, padding: '2px 7px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: ttsLang === l.code ? 'var(--accent)' : 'transparent',
                  color: ttsLang === l.code ? '#fff' : 'var(--text3)',
                  fontWeight: ttsLang === l.code ? 600 : 400, transition: 'all 0.12s'
                }}>{l.label}</button>
              ))}
            </div>
            {/* Voice selector (if native voices exist for language) */}
            {ttsEnabled && langVoices.length > 0 && (
              <select style={{ fontSize: 11, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 7, padding: '4px 6px', color: 'var(--text2)', maxWidth: 130 }}
                value={selectedVoice?.name || ''}
                onChange={e => { setSelVoiceName(e.target.value); localStorage.setItem('nutriguide_tts_voice', e.target.value) }}>
                {langVoices.map(v => <option key={v.name} value={v.name}>{v.name.replace(/ \([^)]+\)/g,'').slice(0,22)}</option>)}
              </select>
            )}
            {/* Mute button */}
            <button title={ttsEnabled ? 'Mute TTS' : 'Enable TTS'}
              onClick={() => { setTtsEnabled(e => !e); stop() }}
              style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              {ttsEnabled ? <Volume2 size={13} color="var(--accent)" /> : <VolumeX size={13} color="var(--text3)" />}
            </button>
            {/* Reset */}
            <button title="Reset conversation"
              onClick={() => { stop(); setMessages([{ role: 'assistant', content: "Hello! I'm the NutriGuide Dietitian AI. Ask me clinical nutrition questions." }]) }}
              style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <RotateCcw size={13} color="var(--text3)" />
            </button>
          </div>
        </div>
        <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'var(--font-mono)', marginTop: 4 }}>
          {loading ? 'Thinking…' : speaking ? '♫ Speaking…' : voiceState === 'recording' ? '◎ Listening…' : t(lang, 'dietitian_sub')}
        </div>
      </div>

      {/* Patient + tab controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <select className="input" value={patientId} onChange={e => setPatientId(e.target.value)} style={{ maxWidth: 280 }}>
          <option value="P001">P001 — Ravi Kumar (Diabetes)</option>
          <option value="P002">P002 — Meena Iyer (Renal)</option>
          <option value="P003">P003 — Arjun Singh (Post-GI)</option>
        </select>
        <div style={{ display: 'flex', border: '1px solid var(--border2)', borderRadius: 8, overflow: 'hidden' }}>
          {['chat', 'rag', 'pqc'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '8px 18px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: activeTab === tab ? 'var(--accent)' : 'var(--bg3)',
              color: activeTab === tab ? '#fff' : 'var(--text2)',
              transition: 'all 0.15s', textTransform: 'capitalize'
            }}>{tab === 'rag' ? 'RAG · Cited Sources' : tab === 'pqc' ? '⬟ PQ-Signed RAG' : 'AI Chat'}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'pqc' ? '1fr' : activeTab === 'chat' ? '1fr 360px' : '360px 1fr', gap: 20, height: activeTab === 'pqc' ? 'auto' : 'calc(100vh - 260px)' }}>

        {/* Chat panel — hidden when PQC tab is active */}
        <div className="card" style={{ display: activeTab === 'pqc' ? 'none' : 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', animation: 'pulse-ring 2s infinite', boxShadow: '0 0 8px rgba(34,211,165,0.6)' }}/>
            <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>Ollama · qwen2.5 · Context: {patientId}</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 8px' }}>
            <AnimatePresence initial={false}>
              {messages.map((m, i) => <Message key={i} msg={m} onSpeak={speakAnswer} />)}
            </AnimatePresence>
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Suggested chips */}
          <div style={{ padding: '8px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {SUGGESTED.slice(0, 4).map(s => (
              <button key={s} onClick={() => setInput(s)} style={{
                padding: '4px 12px', borderRadius: 99, flexShrink: 0, fontSize: 11,
                border: '1px solid var(--border2)', background: 'var(--bg3)', color: 'var(--text3)',
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s'
              }} onMouseEnter={e => e.target.style.borderColor = 'var(--accent)'}
                 onMouseLeave={e => e.target.style.borderColor = 'var(--border2)'}>
                {s}
              </button>
            ))}
          </div>

          {/* Voice interim preview */}
          {interim && (
            <div style={{
              padding: '6px 18px', background: 'var(--teal-dim)',
              borderTop: '1px solid var(--teal-glow)',
              fontSize: 12, color: 'var(--teal)', fontStyle: 'italic',
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              <span style={{ opacity: 0.7 }}>◎</span> {interim}
            </div>
          )}

          {/* Input bar with Whisper mic */}
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
            {/* Waveform strip (visible while recording) */}
            {voiceState === 'recording' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', marginBottom: 8, borderRadius: 8,
                background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)'
              }}>
                <WaveformCanvas analyserRef={analyserRef} active={true} />
                <span style={{ fontSize: 11, color: 'var(--teal)', flex: 1 }}>Listening… speak now</span>
                <button onClick={stopVoice} style={{
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
                  color: 'var(--red)', padding: '2px 6px', borderRadius: 4
                }}>✕ Stop</button>
              </div>
            )}
            {voiceState === 'processing' && (
              <div style={{ padding: '6px 12px', marginBottom: 8, borderRadius: 8, background: 'var(--bg3)', fontSize: 12, color: 'var(--text3)' }}>
                ◌ Transcribing audio…
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* Mic button */}
              <button onClick={startVoice} title={voiceState === 'recording' ? 'Stop' : 'Voice input'}
                style={{
                  flexShrink: 0, width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border2)', cursor: 'pointer',
                  background: voiceState === 'recording' ? 'rgba(239,68,68,0.15)' : 'var(--bg3)',
                  color: voiceState === 'recording' ? '#ef4444' : 'var(--text3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                }}>
                {voiceState === 'recording' ? <MicOff size={14} /> : <Mic size={14} />}
              </button>

              <input ref={inputRef} className="input" placeholder="Ask a clinical nutrition question…"
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                disabled={loading}
                style={{ flex: 1 }} />

              {/* Pause / Stop while TTS speaking */}
              {speaking && (
                <>
                  <button onClick={paused ? resume : pause} title={paused ? 'Resume' : 'Pause'}
                    style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--bg3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {paused ? <Play size={12} color="var(--accent)" /> : <Pause size={12} color="var(--accent)" />}
                  </button>
                  <button onClick={stop} title="Stop speaking"
                    style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--bg3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Square size={11} color="var(--accent)" style={{ fill: 'var(--accent)' }} />
                  </button>
                </>
              )}

              {/* Animated send button */}
              <motion.button className="btn btn-primary" onClick={() => send()}
                disabled={loading || (!input.trim() && !sent)}
                whileTap={{ scale: 0.92 }}
                style={{ flexShrink: 0, minWidth: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <AnimatePresence mode="wait" initial={false}>
                  {loading ? (
                    <motion.span key="loader" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}>
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    </motion.span>
                  ) : sent ? (
                    <motion.span key="check" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}>
                      <Check size={14} />
                    </motion.span>
                  ) : (
                    <motion.span key="send" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Send</motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
            <div style={{ marginTop: 5, fontSize: 10, color: 'var(--text3)', textAlign: 'right' }}>
              TTS: {langVoices.length > 0 ? 'Browser neural voice' : 'Edge-TTS backend'} · STT: Web Speech API + Whisper
            </div>
          </div>
        </div>

        {/* RAG panel — only visible on chat + rag tabs */}
        {activeTab !== 'pqc' && <RAGPanel patientId={patientId} />}

        {/* SOTA 4 — PQ-Signed RAG tab (full width) */}
        {activeTab === 'pqc' && (
          <div style={{ overflowY: 'auto', minHeight: 0 }}>
            <PQSignedRAG patientId={patientId} />
          </div>
        )}
      </div>
    </div>
  )
}
