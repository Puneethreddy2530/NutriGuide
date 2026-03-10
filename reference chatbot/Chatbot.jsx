import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Bot, User, Mic, MicOff, Volume2, VolumeX, Globe, Loader2, RotateCcw, Square, Check, Pause, Play } from 'lucide-react'
import { chatApi } from '../api/client'
import { useApp } from '../contexts/AppContext'

const LANGS = [
  { code: 'en', label: 'English', bcp: 'en-IN', apiName: 'english' },
  { code: 'hi', label: 'हिंदी', bcp: 'hi-IN', apiName: 'hindi' },
  { code: 'mr', label: 'मराठी', bcp: 'mr-IN', apiName: 'marathi' },
  { code: 'te', label: 'తెలుగు', bcp: 'te-IN', apiName: 'telugu' },
  { code: 'ta', label: 'தமிழ்', bcp: 'ta-IN', apiName: 'tamil' },
  { code: 'kn', label: 'ಕನ್ನಡ', bcp: 'kn-IN', apiName: 'kannada' },
  { code: 'bn', label: 'বাংলা', bcp: 'bn-IN', apiName: 'bengali' },
  { code: 'gu', label: 'ગુજરાતી', bcp: 'gu-IN', apiName: 'gujarati' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', bcp: 'pa-IN', apiName: 'punjabi' },
]

const QUICK_Q = [
  'What fertilizer for rice?',
  'Signs of leaf blight?',
  'Best time to sow wheat?',
  'How to manage aphids?',
  'Irrigation tips for summer?',
  'Organic pesticide recipe',
]

// ── Strip markdown for TTS ────────────────────────────
function stripMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')          // **bold**
    .replace(/\*(.+?)\*/g, '$1')              // *italic*
    .replace(/#{1,6}\s+/g, '')               // ## headers
    .replace(/`{1,3}[^`]*`{1,3}/g, '')       // `code`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link](url)
    .replace(/^\s*[-*+]\s/gm, '')            // - bullet
    .replace(/\n{2,}/g, '\n')
    .trim()
}

// ── TTS ──────────────────────────────────────────────
function splitChunks(text, maxLen = 200) {
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

function useTTS() {
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const audioRef = useRef(null)

  // Backend Edge-TTS fallback: called when no native browser voice is installed for the language
  async function speakViaBackend(text, lang) {
    try {
      const res = await fetch('/api/v1/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: stripMarkdown(text), language: lang }),
      })
      if (!res.ok) {
        console.warn(`[AgriBot TTS] Backend returned ${res.status} for language "${lang}"`, await res.text().catch(() => ''))
        return false
      }
      const { audio_base64 } = await res.json()
      if (!audio_base64) { console.warn('[AgriBot TTS] No audio_base64 in response'); return false }
      // Decode base64 → Blob → ObjectURL → play
      const bytes = Uint8Array.from(atob(audio_base64), c => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: 'audio/mpeg' })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      setSpeaking(true)
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url) }
      audio.onerror = (e) => { console.warn('[AgriBot TTS] Audio playback error', e); setSpeaking(false); URL.revokeObjectURL(url) }
      await audio.play().catch(e => console.warn('[AgriBot TTS] play() rejected:', e))
      return true
    } catch (e) {
      console.warn('[AgriBot TTS] speakViaBackend failed:', e)
      return false
    }
  }

  function speak(text, bcp, voice) {
    if (!window.speechSynthesis) return
    try {
      window.speechSynthesis.cancel()
      const chunks = splitChunks(text)
      if (!chunks.length) return
      setSpeaking(true)
      const speakChunk = (idx) => {
        if (idx >= chunks.length) { setSpeaking(false); setPaused(false); return }
        const utt = new SpeechSynthesisUtterance(chunks[idx])
        utt.lang = bcp || 'hi-IN'
        utt.rate = 0.88
        if (voice) utt.voice = voice
        utt.onend = () => speakChunk(idx + 1)
        utt.onerror = () => { setSpeaking(false); setPaused(false) }
        try { window.speechSynthesis.speak(utt) } catch { setSpeaking(false); setPaused(false) }
      }
      speakChunk(0)
    } catch { setSpeaking(false); setPaused(false) }
  }
  function stop() {
    try { window.speechSynthesis?.cancel() } catch {}
    try { audioRef.current?.pause(); audioRef.current = null } catch {}
    setSpeaking(false)
    setPaused(false)
  }
  function pause() { try { window.speechSynthesis?.pause(); audioRef.current?.pause(); setPaused(true) } catch {} }
  function resume() { try { window.speechSynthesis?.resume(); audioRef.current?.play(); setPaused(false) } catch {} }
  return { speak, speakViaBackend, stop, pause, resume, speaking, paused }
}

const SpeechRec = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

function renderMarkdown(text) {
  return text.split('\n').map((line, i) => {
    const parts = []
    const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g
    let last = 0, m
    while ((m = regex.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index))
      if (m[1] !== undefined) parts.push(<strong key={i + '-' + m.index}>{m[1]}</strong>)
      else if (m[2] !== undefined) parts.push(<em key={i + '-' + m.index}>{m[2]}</em>)
      last = m.index + m[0].length
    }
    if (last < line.length) parts.push(line.slice(last))
    return <span key={i}>{parts}{i < text.split('\n').length - 1 && <br />}</span>
  })
}

// ── Animated waveform for voice recording ────────────────────────────────────
const WAVE_HEIGHTS = [
  [4, 18, 10, 24, 8],
  [12, 8, 22, 6, 20],
  [20, 14, 6, 18, 10],
]

function WaveformVisualizer() {
  return (
    <div className="flex items-center gap-1 h-7 px-2">
      {[0, 1, 2, 3, 4].map(i => (
        <motion.span
          key={i}
          className="block w-[3px] rounded-full bg-primary"
          animate={{ height: WAVE_HEIGHTS.map(frame => frame[i]) }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            repeatType: 'mirror',
            ease: 'easeInOut',
            delay: i * 0.08,
          }}
          style={{ height: 8, transformOrigin: 'bottom' }}
        />
      ))}
    </div>
  )
}

// ── Bot avatar speaking wave (3 CSS-keyframe bars) ───────────────────────────
function BotSpeakingWave() {
  return (
    <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex items-end gap-px pointer-events-none">
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          display: 'block', width: 3, height: 9,
          background: '#22c55e', borderRadius: 2,
          transformOrigin: 'bottom',
          animation: `botBarPulse 0.65s ease-in-out infinite`,
          animationDelay: `${i * 0.14}s`,
        }} />
      ))}
    </div>
  )
}

// ── Typing indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex gap-3 items-center">
      <div className="w-7 h-7 rounded-full bg-primary-dim flex items-center justify-center shrink-0">
        <Bot size={14} className="text-primary" />
      </div>
      <div className="bg-surface-2 rounded-2xl rounded-tl-none px-4 py-3 border-l-2 border-primary/30">
        <div className="flex gap-1.5 items-end h-4">
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              className="block w-1.5 h-1.5 bg-primary/60 rounded-full"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Message({ msg, onSpeak }) {
  const isBot = msg.role === 'assistant'
  return (
    <motion.div
      className={`flex gap-3 ${isBot ? '' : 'flex-row-reverse'}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isBot ? 'bg-primary-dim' : 'bg-primary/20'}`}>
        {isBot ? <Bot size={14} className="text-primary" /> : <User size={14} className="text-primary" />}
      </div>
      <div className={`relative group max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
        isBot
          ? 'bg-surface-2 text-text-1 rounded-tl-none border-l-2 border-primary/30'
          : 'bg-primary text-black rounded-tr-none font-medium'
      }`}>
        {isBot ? renderMarkdown(msg.content) : msg.content}
        {isBot && (
          <button onClick={() => onSpeak(msg.content)}
            className="absolute -bottom-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 bg-surface-3 rounded-full flex items-center justify-center border border-border"
            aria-label="Read message aloud"
            title="Read aloud">
            <Volume2 size={9} className="text-primary" aria-hidden="true" />
          </button>
        )}
      </div>
    </motion.div>
  )
}

export default function Chatbot() {
  const { state, dispatch } = useApp()
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Namaste! 🌾 I'm AgriBot, your AI farming assistant. Ask me anything about crops, diseases, fertilizers, or farming techniques!` }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [lang, setLang] = useState(state.language || 'hi')
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [listening, setListening] = useState(false)
  const [sent, setSent] = useState(false)
  const [voices, setVoices] = useState([])
  const [selectedVoiceName, setSelectedVoiceName] = useState(
    () => localStorage.getItem('agri_tts_voice') || ''
  )
  const bottomRef = useRef()
  const inputRef = useRef()
  const recRef = useRef(null)
  const { speak, speakViaBackend, stop, pause, resume, speaking, paused } = useTTS()

  // speak helper: tries native browser voice first; falls back to Edge-TTS backend
  function speakAnswer(text) {
    const clean = stripMarkdown(text)
    if (langVoices.length > 0) {
      speak(clean, langObj.bcp, selectedVoice)
    } else {
      speakViaBackend(clean, langObj.code)
    }
  }
  const langObj = LANGS.find(l => l.code === lang) || LANGS[1]
  // Match voices by full BCP-47 tag (e.g. 'hi-IN'), then by language prefix (e.g. 'hi-').
  // No English fallback — if no native voice is installed we still set utt.lang so the
  // browser attempts pronunciation in the correct language.
  const langVoices = voices.filter(
    v => v.lang.toLowerCase() === langObj.bcp.toLowerCase()
      || v.lang.toLowerCase().startsWith(langObj.code + '-')
  )
  const selectedVoice = langVoices.find(v => v.name === selectedVoiceName) || langVoices[0] || null

  function changeLang(code) {
    setLang(code)
    dispatch({ type: 'SET_LANGUAGE', payload: code })
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text) {
    const content = (text || input).trim()
    if (!content || loading) return
    setInput('')
    setSent(true)
    setTimeout(() => setSent(false), 1200)
    setMessages(prev => [...prev, { role: 'user', content }])
    setLoading(true)
    try {
      const res = await chatApi.send(content, langObj.apiName)
      const answer = res.answer || 'Sorry, I did not understand that.'
      setMessages(prev => [...prev, { role: 'assistant', content: answer }])
      if (ttsEnabled) speakAnswer(answer)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ I could not connect to the server. Please check your connection and try again.' }])
    }
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  function toggleListen() {
    if (!SpeechRec) { alert('Voice input is not supported in this browser. Try Chrome.'); return }
    if (listening) { recRef.current?.stop(); setListening(false); return }
    const rec = new SpeechRec()
    recRef.current = rec
    rec.lang = langObj.bcp
    rec.interimResults = false
    rec.onresult = e => {
      const t = e.results[0][0].transcript
      setInput(prev => prev + (prev ? ' ' : '') + t)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.start()
    setListening(true)
  }

  return (
    <div className="page-content flex flex-col" style={{ height: 'calc(100vh - 2rem)' }}>
      <style>{`@keyframes botBarPulse { 0%,100% { transform: scaleY(0.25); } 50% { transform: scaleY(1); } }`}</style>
      {/* Header */}
      <div className="flex items-center justify-between pt-2 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl bg-primary-dim flex items-center justify-center overflow-hidden">
            <Bot size={18} className={`text-primary transition-opacity duration-300 ${speaking ? 'opacity-30' : ''}`} />
            {speaking && <BotSpeakingWave />}
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-text-1">AgriBot</h1>
            <p className="text-text-3 text-xs">
              AI Farm Assistant · {loading ? 'Typing…' : speaking ? '🔊 Speaking…' : listening ? '🎙 Listening…' : 'Online'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-surface-2 px-2 py-1 rounded-lg overflow-x-auto max-w-[55vw] no-scrollbar">
            <Globe size={12} className="text-text-3 shrink-0" />
            {LANGS.map(l => (
              <button key={l.code} onClick={() => changeLang(l.code)}
                className={`shrink-0 text-xs px-2 py-0.5 rounded transition-colors ${lang === l.code ? 'bg-primary text-black font-medium' : 'text-text-3 hover:text-text-2'}`}>
                {l.label}
              </button>
            ))}
          </div>
          {ttsEnabled && (
            langVoices.length > 0
              ? (
                <select
                  className="text-xs bg-surface-2 border border-border rounded-lg px-1.5 py-1 text-text-2 max-w-[8rem] truncate cursor-pointer"
                  title="TTS Voice"
                  aria-label="Select TTS voice"
                  value={selectedVoice?.name || ''}
                  onChange={e => {
                    setSelectedVoiceName(e.target.value)
                    localStorage.setItem('agri_tts_voice', e.target.value)
                  }}
                >
                  {langVoices.map(v => (
                    <option key={v.name} value={v.name}>
                      {v.name.replace(/ \([^)]+\)/g, '').slice(0, 22)}
                    </option>
                  ))}
                </select>
              )
              : (
                <span
                  className="text-xs text-text-3 px-2 py-1 bg-surface-2 rounded-lg border border-border"
                  title={`No ${langObj.label} voice installed — browser will attempt pronunciation in ${langObj.bcp}`}
                >
                  🌐 Browser TTS
                </span>
              )
          )}
          <button className="btn-icon" title={ttsEnabled ? 'Mute voice' : 'Enable voice'}
            aria-label={ttsEnabled ? 'Mute voice output' : 'Enable voice output'}
            aria-pressed={ttsEnabled}
            onClick={() => { setTtsEnabled(t => !t); stop() }}>
            {ttsEnabled ? <Volume2 size={14} className="text-primary" /> : <VolumeX size={14} />}
          </button>
          <button className="btn-icon" aria-label="Reset conversation" onClick={() => { stop(); setMessages([{ role: 'assistant', content: `Namaste! 🌾 Ask me anything about farming!` }]) }}>
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Quick questions */}
      <div className="flex gap-2 py-3 overflow-x-auto no-scrollbar" role="list" aria-label="Quick question shortcuts">
        {QUICK_Q.map(q => (
          <button key={q} onClick={() => send(q)}
            role="listitem"
            aria-label={`Quick question: ${q}`}
            className="shrink-0 text-xs bg-surface-2 hover:bg-surface-3 text-text-2 px-3 py-1.5 rounded-full border border-border transition-colors whitespace-nowrap">
            {q}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto space-y-4 py-2 pr-1"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        aria-relevant="additions"
      >
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <Message key={i} msg={m} onSpeak={t => speakAnswer(t)} />
          ))}
        </AnimatePresence>
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {loading ? 'AgriBot is typing…' : ''}
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-border">
        <div className="flex gap-2 items-center">
          <button type="button" onClick={toggleListen}
            aria-label={listening ? 'Stop voice recording' : 'Start voice input'}
            aria-pressed={listening}
            title={SpeechRec ? (listening ? 'Stop recording' : 'Voice input') : 'Not supported in this browser'}
            className={`btn-icon shrink-0 ${listening ? 'bg-red-500/20 text-red-400 border-red-500/20' : ''} ${!SpeechRec ? 'opacity-40 cursor-not-allowed' : ''}`}>
            {listening ? <MicOff size={15} className="text-red-400" /> : <Mic size={15} />}
          </button>

          {listening ? (
            <div className="flex-1 flex items-center bg-surface-2 border border-primary/40 rounded-lg px-2"
              style={{ boxShadow: '0 0 0 3px rgba(34,197,94,0.15)' }}>
              <WaveformVisualizer />
              <span className="text-xs text-primary ml-1 animate-pulse">Listening…</span>
            </div>
          ) : (
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                id="chatbot-input"
                aria-label="Type your farming question"
                className="input w-full transition-shadow duration-200"
                style={{ outline: 'none' }}
                placeholder={lang === 'hi' ? 'अपना सवाल लिखें…' : lang === 'mr' ? 'तुमचा प्रश्न लिहा…' : 'Ask about farming, crops, diseases…'}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34,197,94,0.20)'}
                onBlur={e => e.currentTarget.style.boxShadow = 'none'}
                disabled={loading}
              />
            </div>
          )}

          {speaking && (
            <>
              <button type="button" className="btn-icon shrink-0 text-primary"
                onClick={paused ? resume : pause}
                aria-label={paused ? 'Resume speaking' : 'Pause speaking'}
                title={paused ? 'Resume speaking' : 'Pause speaking'}>
                {paused ? <Play size={13} /> : <Pause size={13} />}
              </button>
              <button type="button" className="btn-icon shrink-0 text-primary" onClick={stop} aria-label="Stop speaking" title="Stop speaking">
                <Square size={12} className="fill-primary" />
              </button>
            </>
          )}

          <motion.button
            className="btn-primary px-4 shrink-0"
            onClick={() => send()}
            aria-label="Send message"
            disabled={loading || (!input.trim() && !sent)}
            whileTap={{ scale: 0.92 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {loading ? (
                <motion.span key="loader" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}>
                  <Loader2 size={15} className="animate-spin" />
                </motion.span>
              ) : sent ? (
                <motion.span key="check" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}>
                  <Check size={15} />
                </motion.span>
              ) : (
                <motion.span key="send" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}>
                  <Send size={15} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
        <p className="text-text-3 text-xs mt-2 text-center">AgriBot may make mistakes. Verify important advice with experts.</p>
        <p className="text-text-3 mt-1 text-center" style={{ fontSize: 10, opacity: 0.45 }}>Powered by Ollama + Gemini</p>
      </div>
    </div>
  )
}
