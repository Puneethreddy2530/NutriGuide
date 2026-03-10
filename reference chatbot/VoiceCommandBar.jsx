import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, X, History } from 'lucide-react'
import { useApp } from '../contexts/AppContext'

// ── Language code map: AppContext short code → BCP-47 ────────────────────
const LANG_MAP = {
  en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN',
  kn: 'kn-IN', ml: 'ml-IN', mr: 'mr-IN', gu: 'gu-IN',
  pa: 'pa-IN', bn: 'bn-IN', or: 'or-IN', ur: 'ur-IN',
}

// ── Route → spoken confirmation (per language) ────────────────────────
const ROUTE_SPEECH = {
  '/weather':       { en: 'Opening weather', hi: 'मौसम खुल रहा है', mr: 'हवामान उघडत आहे' },
  '/disease':       { en: 'Opening disease detection', hi: 'रोग पहचान खुल रही है' },
  '/market':        { en: 'Opening market prices', hi: 'बाज़ार भाव खुल रहा है' },
  '/chatbot':       { en: 'Sending to chatbot', hi: 'चैटबॉट पर भेज रहे हैं' },
  '/crop':          { en: 'Opening crop advisor', hi: 'फसल सलाहकार खुल रहा है' },
  '/fertilizer':    { en: 'Opening fertilizer guide', hi: 'उर्वरक मार्गदर्शक खुल रहा है' },
  '/schemes':       { en: 'Opening government schemes', hi: 'सरकारी योजनाएं खुल रही हैं' },
  '/pest':          { en: 'Opening pest detection', hi: 'कीट पहचान खुल रही है' },
  '/analytics':     { en: 'Opening analytics', hi: 'विश्लेषण खुल रहा है' },
  '/expense':       { en: 'Opening expense tracker', hi: 'खर्च ट्रैकर खुल रहा है' },
  '/soil-passport': { en: 'Opening soil passport', hi: 'मिट्टी पासपोर्ट खुल रहा है' },
}

// ── Keyword → route map ─────────────────────────────────────────────────────
const CMD_RULES = [
  { keywords: ['weather', 'mausam', 'मौसम', 'baarish', 'rain', 'temperature', 'open weather'], route: '/weather' },
  { keywords: ['market', 'price', 'mandi', 'bhav', 'rate', 'sell', 'बाजार', 'मंडी', 'market prices'], route: '/market' },
  { keywords: ['disease', 'scan', 'rog', 'bimari', 'detect', 'बीमारी', 'रोग', 'detect disease'], route: '/disease' },
  { keywords: ['pest', 'keeda', 'insect', 'keet', 'कीट'], route: '/pest' },
  { keywords: ['chat', 'help', 'sahayak', 'advice', 'salah', 'bot'], route: '/chatbot' },
  { keywords: ['crop', 'fasal', 'kisan', 'advisor', 'फसल'], route: '/crop' },
  { keywords: ['fertilizer', 'khad', 'urvarak', 'खाद', 'उर्वरक'], route: '/fertilizer' },
  { keywords: ['soil', 'passport', 'mitti', 'मिट्टी'], route: '/soil-passport' },
  { keywords: ['expense', 'kharcha', 'cost', 'खर्च'], route: '/expense' },
  { keywords: ['scheme', 'yojana', 'government', 'sarkar', 'योजना'], route: '/schemes' },
  { keywords: ['analytics', 'analysis', 'report', 'data', 'विश्लेषण'], route: '/analytics' },
]

function matchCommand(text) {
  const lower = text.toLowerCase()
  for (const rule of CMD_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw.toLowerCase()))) return rule.route
  }
  return null
}

// ── Speak helper ─────────────────────────────────────────────────────────────────
function speak(text, lang) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = lang
  utt.rate = 1.1
  window.speechSynthesis.speak(utt)
}

function getSpeakText(route, langCode) {
  const msgs = ROUTE_SPEECH[route]
  if (!msgs) return null
  return msgs[langCode] || msgs.en
}

// ── Canvas waveform (live from AudioContext analyser) ───────────────────────────
function CanvasWaveform({ analyserRef }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let rafId
    function draw() {
      rafId = requestAnimationFrame(draw)
      const analyser = analyserRef.current
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (!analyser) return
      const bufLen = analyser.frequencyBinCount
      const data = new Uint8Array(bufLen)
      analyser.getByteFrequencyData(data)
      const count = 16
      const bw = Math.floor((canvas.width - (count - 1) * 2) / count)
      for (let i = 0; i < count; i++) {
        const val = data[Math.floor((i / count) * bufLen)] / 255
        const h = Math.max(3, val * canvas.height)
        const x = i * (bw + 2)
        const y = (canvas.height - h) / 2
        ctx.fillStyle = `rgba(255,255,255,${0.35 + val * 0.65})`
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(x, y, bw, h, 2)
        else ctx.rect(x, y, bw, h)
        ctx.fill()
      }
    }
    draw()
    return () => cancelAnimationFrame(rafId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <canvas ref={canvasRef} width={112} height={28} style={{ display: 'block' }} />
}

// ── CSS fallback waveform ─────────────────────────────────────────────────────────
function CSSWaveform() {
  return (
    <div className="flex items-center gap-0.5 h-7">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <motion.span
          key={i}
          className="w-1 rounded-full bg-white"
          animate={{ height: ['4px', '18px', '4px'] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.09, ease: 'easeInOut' }}
          style={{ display: 'block' }}
        />
      ))}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────────────────────
export default function VoiceCommandBar() {
  const { state } = useApp()
  const navigate     = useNavigate()
  const srRef        = useRef(null)
  const analyserRef  = useRef(null)
  const audioCtxRef  = useRef(null)
  const streamRef    = useRef(null)

  const [listening, setListening]     = useState(false)
  const [interim, setInterim]         = useState('')
  const [toast, setToast]             = useState(null)
  const [supported, setSupported]     = useState(true)
  const [history, setHistory]         = useState([])         // last 5 commands
  const [showHistory, setShowHistory] = useState(false)
  const [hasAudioCtx, setHasAudioCtx] = useState(false)

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) setSupported(false)
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  const showToast = useCallback((text, type = 'info', autoDismiss = 5000) => {
    setToast({ text, type })
    if (autoDismiss) setTimeout(() => setToast(null), autoDismiss)
  }, [])

  const teardownAudio = useCallback(() => {
    analyserRef.current = null
    setHasAudioCtx(false)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    audioCtxRef.current?.close()
    audioCtxRef.current = null
  }, [])

  const stopListening = useCallback(() => {
    srRef.current?.stop()
    srRef.current = null
    setListening(false)
    setInterim('')
    teardownAudio()
  }, [teardownAudio])

  const startListening = useCallback(async () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      showToast('Voice recognition is not supported in this browser.', 'error')
      return
    }

    // Set up AudioContext for canvas waveform
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      audioCtxRef.current = audioCtx
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      audioCtx.createMediaStreamSource(stream).connect(analyser)
      analyserRef.current = analyser
      setHasAudioCtx(true)
    } catch {
      // getUserMedia denied — fall back to CSS animation; still allow speech
      setHasAudioCtx(false)
    }

    const sr = new SR()
    srRef.current = sr
    const bcp47 = LANG_MAP[state.language] || 'en-IN'
    sr.lang = bcp47
    sr.interimResults = true
    sr.maxAlternatives = 1
    sr.continuous = false

    sr.onstart = () => setListening(true)
    sr.onend   = () => {
      setListening(false)
      setInterim('')
      teardownAudio()
    }

    sr.onerror = (e) => {
      setListening(false)
      setInterim('')
      if (e.error !== 'aborted' && e.error !== 'no-speech') {
        showToast(`Mic error: ${e.error}`, 'error')
      }
    }

    sr.onresult = (e) => {
      let interimText = ''
      let finalText   = ''
      for (const result of e.results) {
        if (result.isFinal) finalText   += result[0].transcript
        else                interimText += result[0].transcript
      }
      if (interimText) setInterim(interimText)
      if (!finalText) return
      setInterim(finalText)

      const langCode = state.language || 'en'
      const bcp47cur = LANG_MAP[langCode] || 'en-IN'
      const lower    = finalText.toLowerCase().trim()

      // "ask [query]" — navigate to chatbot with query state
      if (lower.startsWith('ask ')) {
        const query = finalText.slice(4).trim()
        const msg   = getSpeakText('/chatbot', langCode) || 'Sending to chatbot'
        showToast(`Chatbot: "${query}"`, 'route', 2500)
        speak(msg, bcp47cur)
        setHistory(h => [{ text: finalText, time: new Date(), route: '/chatbot' }, ...h].slice(0, 5))
        setTimeout(() => navigate('/chatbot', { state: { query } }), 400)
        return
      }

      const route = matchCommand(finalText)
      if (route) {
        const msg = getSpeakText(route, langCode) || `Going to ${route.replace('/', '') || 'home'}`
        showToast(msg, 'route', 2000)
        speak(msg, bcp47cur)
        setHistory(h => [{ text: finalText, time: new Date(), route }, ...h].slice(0, 5))
        setTimeout(() => navigate(route), 400)
      } else {
        // Default: pass as chatbot query
        const msg = getSpeakText('/chatbot', langCode) || 'Sending to chatbot'
        showToast(`"${finalText}"`, 'info', 3000)
        speak(msg, bcp47cur)
        setHistory(h => [{ text: finalText, time: new Date(), route: '/chatbot' }, ...h].slice(0, 5))
        setTimeout(() => navigate('/chatbot', { state: { query: finalText } }), 400)
      }
    }

    try {
      sr.start()
    } catch {
      showToast('Could not start microphone.', 'error')
    }
  }, [state.language, navigate, showToast, teardownAudio])

  const handleClick = useCallback(() => {
    if (listening) stopListening()
    else           startListening()
  }, [listening, startListening, stopListening])

  // Cleanup on unmount
  useEffect(() => () => {
    srRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
  }, [])

  // Toast colour
  const toastStyle =
    toast?.type === 'error' ? 'bg-red-600/90 text-white'
    : toast?.type === 'route' ? 'bg-primary/90 text-white'
    : 'bg-surface-1/95 border border-border text-text-1'

  // Not supported — show disabled mic with tooltip instead of nothing
  if (!supported) {
    return (
      <div
        className="fixed bottom-6 right-6 z-50"
        title="Voice commands not supported in this browser"
      >
        <button
          disabled
          aria-label="Voice commands not supported in this browser"
          className="w-14 h-14 rounded-full flex items-center justify-center opacity-40 cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg,#22c55e 0%,#16a34a 100%)' }}
        >
          <Mic size={22} className="text-white" />
        </button>
      </div>
    )
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2"
      style={{ pointerEvents: 'none' }}
    >
      {/* Toast / response */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`max-w-xs rounded-xl px-4 py-2.5 text-sm shadow-lg backdrop-blur-md ${toastStyle}`}
            style={{ pointerEvents: 'auto' }}
          >
            <div className="flex items-start gap-2">
              <p className="flex-1 leading-snug">{toast.text}</p>
              <button
                onClick={dismissToast}
                className="shrink-0 opacity-60 hover:opacity-100 mt-0.5"
                aria-label="Dismiss"
              >
                <X size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Command history slide-up panel */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            key="history-panel"
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ duration: 0.22 }}
            className="rounded-xl shadow-xl backdrop-blur-md overflow-hidden"
            style={{
              pointerEvents: 'auto',
              width: 240,
              background: 'rgba(15,23,42,0.94)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
              <span className="text-white/80 text-xs font-medium">Recent Commands</span>
              <button onClick={() => setShowHistory(false)} className="text-white/50 hover:text-white/90" aria-label="Close command history">
                <X size={13} aria-hidden="true" />
              </button>
            </div>
            {history.length === 0 ? (
              <p className="text-white/40 text-xs text-center py-5 px-3">No commands yet</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {history.map((cmd, i) => (
                  <li
                    key={i}
                    role="button"
                    tabIndex={0}
                    className="px-3 py-2.5 flex items-start gap-2 cursor-pointer hover:bg-white/5"
                    onClick={() => { setShowHistory(false); navigate(cmd.route) }}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowHistory(false); navigate(cmd.route) } }}
                  >
                    <span className="text-primary text-xs mt-0.5 shrink-0">⌘</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/90 text-xs truncate">{cmd.text}</p>
                      <p className="text-white/40 text-[10px]">
                        {cmd.time.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                        {cmd.route !== '/chatbot' ? ` → ${cmd.route}` : ' → chatbot'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interim transcript */}
      <AnimatePresence>
        {listening && interim && (
          <motion.div
            key="interim"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl bg-surface-1/95 border border-border px-3 py-1.5 text-text-2 text-xs shadow backdrop-blur-md max-w-[220px] truncate"
            style={{ pointerEvents: 'none' }}
          >
            {interim}
          </motion.div>
        )}
      </AnimatePresence>

      {/* "Listening…" animated label (when no interim text yet) */}
      <AnimatePresence>
        {listening && !interim && (
          <motion.div
            key="listening-label"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl bg-primary/20 border border-primary/30 px-3 py-1.5 text-primary text-xs shadow backdrop-blur-md flex items-center gap-1.5"
            style={{ pointerEvents: 'none' }}
          >
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-primary inline-block"
              animate={{ opacity: [1, 0.25, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            Listening…
          </motion.div>
        )}
      </AnimatePresence>

      {/* Button row: history + mic */}
      <div className="flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
        {/* History icon button */}
        <motion.button
          onClick={() => setShowHistory(v => !v)}
          aria-label="Command history"
          whileTap={{ scale: 0.9 }}
          className="relative w-9 h-9 rounded-full flex items-center justify-center shadow-md backdrop-blur-md"
          style={{
            background: 'rgba(15,23,42,0.75)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <History size={15} className="text-white/70" />
          {history.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] flex items-center justify-center font-bold leading-none">
              {history.length}
            </span>
          )}
        </motion.button>

        {/* Mic button */}
        <motion.button
          onClick={handleClick}
          aria-label={listening ? 'Stop listening' : 'Start voice command'}
          animate={listening ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={listening ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : {}}
          className="relative w-14 h-14 rounded-full shadow-xl flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary overflow-hidden"
          style={{
            background: listening
              ? 'linear-gradient(135deg,#16a34a 0%,#15803d 100%)'
              : 'linear-gradient(135deg,#22c55e 0%,#16a34a 100%)',
            boxShadow: listening
              ? '0 0 0 6px rgba(34,197,94,0.25),0 4px 20px rgba(0,0,0,0.4)'
              : '0 4px 20px rgba(0,0,0,0.35)',
          }}
        >
          {/* Pulse ring while listening */}
          {listening && (
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-primary"
              animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
          {listening
            ? (hasAudioCtx ? <CanvasWaveform analyserRef={analyserRef} /> : <CSSWaveform />)
            : <Mic size={22} className="text-white" />
          }
        </motion.button>
      </div>
    </div>
  )
}
