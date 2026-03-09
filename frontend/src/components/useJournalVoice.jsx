/**
 * useJournalVoice.jsx
 * ────────────────────
 * Voice input hook + mic component tailored for the journal.
 * No crisis detection, no mode detection — just clean speech-to-text
 * that appends or replaces journal text.
 *
 * Re-uses the same transcription stack as HealthAdvisor:
 *   1. Web Speech API (instant, no backend, works in Chrome/Edge/Safari)
 *   2. MediaRecorder → POST /mindguide/transcribe (Whisper fallback for Firefox)
 *
 * Usage:
 *   const voice = useJournalVoice({ onTranscript, apiBase, token });
 *   <JournalMic voice={voice} mode={insertMode} onModeChange={setInsertMode} />
 */

import { useState, useEffect, useRef, useCallback } from "react";

// ══════════════════════════════════════════════════════════════════
// useJournalVoice hook
// ══════════════════════════════════════════════════════════════════

/**
 * @param {object}   opts
 * @param {function} opts.onTranscript  — called with (text) when final transcript ready
 * @param {function} opts.onInterim     — called with (text) during live recognition (optional)
 * @param {string}   opts.apiBase       — e.g. "" or "http://localhost:8020"
 * @param {string}   opts.token         — JWT bearer token
 */
export function useJournalVoice({ onTranscript, onInterim, apiBase = "", token }) {
  // "idle" | "listening" | "processing" | "error"
  const [state, setState]             = useState("idle");
  const [amplitude, setAmplitude]     = useState(0);
  const [interimText, setInterimText] = useState("");
  const [errorMsg, setErrorMsg]       = useState("");

  const recognitionRef  = useRef(null);
  const mediaRecRef     = useRef(null);
  const audioChunksRef  = useRef([]);
  const analyserRef     = useRef(null);
  const animFrameRef    = useRef(null);
  const streamRef       = useRef(null);
  const interimTextRef  = useRef("");

  // Keep interimTextRef in sync so onend closure reads latest value
  useEffect(() => { interimTextRef.current = interimText; }, [interimText]);

  // ── Build Web Speech API instance once ─────────────────────────
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.continuous      = false;
    rec.interimResults  = true;
    rec.lang            = "en-US";
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let interim = "", final = "";
      for (const result of e.results) {
        if (result.isFinal) final  += result[0].transcript;
        else                interim += result[0].transcript;
      }
      const current = final || interim;
      setInterimText(current);
      onInterim?.(current);
    };

    rec.onend = () => {
      _stopAmplitude();
      const transcript = interimTextRef.current.trim();
      if (!transcript) { setState("idle"); return; }
      setState("processing");
      _finalize(transcript);
    };

    rec.onerror = (e) => {
      _stopAmplitude();
      setState("error");
      setErrorMsg(
        e.error === "not-allowed"  ? "Microphone access denied" :
        e.error === "no-speech"    ? "No speech detected — try again" :
        e.error === "network"      ? "Network error — check connection" :
                                     `Voice error: ${e.error}`
      );
      setTimeout(() => setState("idle"), 3000);
    };

    recognitionRef.current = rec;
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Amplitude visualizer ────────────────────────────────────────
  const _startAmplitude = useCallback(async () => {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx      = new AudioContext();
      const source   = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const tick = () => {
        const buf = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        setAmplitude(Math.min(1, avg / 55));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* amplitude is cosmetic only — silently ignore */ }
  }, []);

  const _stopAmplitude = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setAmplitude(0);
  }, []);

  // ── Final transcript handler ────────────────────────────────────
  const _finalize = useCallback((text) => {
    setInterimText("");
    onTranscript?.(text);
    setState("idle");
  }, [onTranscript]);

  // ── MediaRecorder → Whisper path ───────────────────────────────
  const _startMediaRecorder = useCallback(async () => {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecRef.current    = recorder;

      recorder.ondataavailable = (e) => { audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setState("processing");
        await _transcribeWhisper(blob);
      };

      recorder.start();
      // Auto-stop after 30 s — journals can run longer than chat messages
      setTimeout(() => {
        if (mediaRecRef.current?.state === "recording") stopListening();
      }, 30000);
    } catch {
      setState("error");
      setErrorMsg("Could not access microphone");
      setTimeout(() => setState("idle"), 3000);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const _transcribeWhisper = useCallback(async (blob) => {
    try {
      const reader = new FileReader();
      const b64    = await new Promise((res, rej) => {
        reader.onloadend = () => res(reader.result.split(",")[1]);
        reader.onerror   = rej;
        reader.readAsDataURL(blob);
      });

      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const resp = await fetch(`${apiBase}/mindguide/transcribe`, {
        method: "POST",
        headers,
        body: JSON.stringify({ audio_base64: b64, language: "auto" }),
      });

      if (resp.ok) {
        const { text } = await resp.json();
        if (text?.trim()) {
          _finalize(text.trim());
          return;
        }
      }
    } catch { /* fall through to error */ }

    setState("error");
    setErrorMsg("Transcription failed — try typing instead");
    setTimeout(() => setState("idle"), 3000);
  }, [apiBase, token, _finalize]);

  // ── Public controls ─────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (state !== "idle" && state !== "error") return;
    setErrorMsg("");
    setInterimText("");

    // Permission pre-check
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach(t => t.stop());
    } catch {
      setState("error");
      setErrorMsg("Microphone access denied — check browser settings");
      return;
    }

    setState("listening");
    await _startAmplitude();

    if (recognitionRef.current) {
      try { recognitionRef.current.start(); } catch { }
    } else {
      await _startMediaRecorder();
    }
  }, [state, _startAmplitude, _startMediaRecorder]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { }
    }
    if (mediaRecRef.current?.state === "recording") {
      mediaRecRef.current.stop();
    }
    _stopAmplitude();
    if (state === "listening") setState("processing");
  }, [state, _stopAmplitude]);

  // Cleaner toggle — stop if listening, start if idle/error, ignore while processing
  const smartToggle = useCallback(() => {
    if      (state === "listening")  stopListening();
    else if (state !== "processing") startListening();
  }, [state, startListening, stopListening]);

  return {
    state,        // "idle" | "listening" | "processing" | "error"
    amplitude,    // 0-1
    interimText,
    errorMsg,
    toggle: smartToggle,
    startListening,
    stopListening,
  };
}


// ══════════════════════════════════════════════════════════════════
// JournalMic component
//
// Renders:
//  - Mic toggle button with amplitude rings
//  - Append / Replace mode toggle
//  - Interim transcript preview (position:fixed off-screen — preview is
//    handled inline by JournalPage itself so this is a no-op fallback)
//  - Error state inline
//
// Accent: #f59e6b (warm amber, matching the journal palette)
// ══════════════════════════════════════════════════════════════════

/**
 * @param {object}   props
 * @param {object}   props.voice        — return value of useJournalVoice
 * @param {"append"|"replace"} props.mode
 * @param {function} props.onModeChange — called with "append" | "replace"
 */
export function JournalMic({ voice, mode, onModeChange }) {
  const { state, amplitude, interimText, errorMsg, toggle } = voice;

  const isLive  = state === "listening";
  const isBusy  = state === "processing";
  const isError = state === "error";

  const ACCENT     = "#f59e6b";
  const ACCENT_DIM = "rgba(245,158,107,0.35)";

  // Ripple ring scales driven by amplitude
  const r1 = 1 + amplitude * 0.55;
  const r2 = 1 + amplitude * 1.05;
  const r3 = 1 + amplitude * 1.7;

  const btnBorder = isError ? "#ef4444"
                  : isBusy  ? "rgba(255,255,255,0.2)"
                  : isLive  ? ACCENT
                  :            "rgba(255,255,255,0.15)";

  const btnBg = isLive
    ? `radial-gradient(circle, rgba(245,158,107,0.18), rgba(245,158,107,0.04))`
    : "rgba(255,255,255,0.03)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

      {/* ── Mic button ─────────────────────────────────────────── */}
      <div style={{ position: "relative", width: 36, height: 36, flexShrink: 0 }}>

        {/* Amplitude rings */}
        {isLive && (
          <>
            {[r3, r2, r1].map((scale, i) => (
              <div key={i} style={{
                position: "absolute", inset: 0,
                borderRadius: "50%",
                border: `${i === 2 ? "1.5" : "1"}px solid ${ACCENT}`,
                transform: `scale(${scale})`,
                opacity: Math.max(0, [0.12, 0.22, 0.38][i] + amplitude * [0.15, 0.25, 0.35][i]),
                transition: "transform 0.05s, opacity 0.05s",
                pointerEvents: "none",
              }} />
            ))}
          </>
        )}

        <button
          onClick={toggle}
          disabled={isBusy}
          title={
            isLive  ? "Click to stop recording" :
            isBusy  ? "Transcribing…" :
            isError ? errorMsg :
                      "Start voice journaling"
          }
          style={{
            position: "relative", zIndex: 1,
            width: 36, height: 36,
            borderRadius: "50%",
            background: btnBg,
            border: `1.5px solid ${btnBorder}`,
            cursor: isBusy ? "wait" : "pointer",
            color: isError ? "#ef4444" : isLive ? ACCENT : "rgba(255,255,255,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
            outline: "none",
            boxShadow: isLive
              ? `0 0 14px rgba(245,158,107,0.25), 0 0 28px rgba(245,158,107,0.08)`
              : "none",
          }}
        >
          {isBusy ? (
            <div style={{
              width: 12, height: 12,
              border: "2px solid rgba(255,255,255,0.12)",
              borderTop: `2px solid ${ACCENT}`,
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
            }} />
          ) : isLive ? (
            /* Stop square */
            <div style={{ width: 9, height: 9, background: ACCENT, borderRadius: 2 }} />
          ) : (
            /* Mic icon */
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none">
              <rect x="9" y="2" width="6" height="11" rx="3"
                stroke="currentColor" strokeWidth="1.8" />
              <path d="M5 10a7 7 0 0 0 14 0"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="12" y1="19" x2="12" y2="22"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="9" y1="22" x2="15" y2="22"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Append / Replace mode toggle ────────────────────────── */}
      <div style={{
        display: "flex",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 8,
        overflow: "hidden",
        flexShrink: 0,
      }}>
        {["append", "replace"].map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            style={{
              padding: "4px 10px",
              background: mode === m ? "rgba(245,158,107,0.12)" : "transparent",
              border: "none",
              borderRight: m === "append" ? "1px solid rgba(255,255,255,0.07)" : "none",
              cursor: "pointer",
              color: mode === m ? ACCENT : "rgba(255,255,255,0.25)",
              fontSize: 9,
              fontFamily: "'DM Mono', monospace",
              letterSpacing: 1,
              transition: "all 0.15s",
              textTransform: "uppercase",
            }}
          >
            {m === "append" ? "+ Append" : "↺ Replace"}
          </button>
        ))}
      </div>

      {/* ── Status label ─────────────────────────────────────────── */}
      {isLive && (
        <div style={{
          fontSize: 9, color: ACCENT_DIM,
          fontFamily: "'DM Mono', monospace",
          letterSpacing: 2,
          animation: "pulse 1.4s ease infinite",
          flexShrink: 0,
        }}>
          LISTENING
        </div>
      )}
      {isBusy && (
        <div style={{
          fontSize: 9, color: "rgba(255,255,255,0.2)",
          fontFamily: "'DM Mono', monospace",
          letterSpacing: 2, flexShrink: 0,
        }}>
          TRANSCRIBING
        </div>
      )}

      {/* ── Error bubble ─────────────────────────────────────────── */}
      {isError && errorMsg && (
        <div style={{
          fontSize: 10, color: "#f87171",
          fontFamily: "'DM Mono', monospace",
          background: "rgba(30,10,10,0.9)",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 6,
          padding: "4px 10px",
          animation: "fadeUp 0.15s ease",
          flexShrink: 0,
        }}>
          {errorMsg}
        </div>
      )}

      {/*
        NOTE: Interim text is intentionally NOT shown here.
        JournalPage renders it inline above the textarea
        (see voice.interimText block in JournalPage) so it never
        obscures the writing area.  This component is display-only
        for state chrome (button + mode toggle + status label).
      */}
    </div>
  );
}
