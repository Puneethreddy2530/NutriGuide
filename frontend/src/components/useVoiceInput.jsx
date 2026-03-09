import { useState, useEffect, useRef, useCallback } from "react";

// ── Crisis patterns (checked before ANYTHING hits Ollama) ─────────
const CRISIS_PATTERNS = [
    "want to die", "kill myself", "end my life", "suicide", "suicidal",
    "no reason to live", "hurt myself", "self harm", "cut myself",
    "can't go on", "give up on life", "मरना चाहता", "मरना चाहती",
    "खुद को नुकसान",
];

// ── Mode auto-detection from transcript ──────────────────────────
const MODE_SIGNALS = {
    mental_health: [
        "anxious", "anxiety", "stress", "stressed", "depressed", "depression",
        "sad", "crying", "panic", "angry", "mood", "sleep", "can't sleep",
        "breathe", "overwhelmed", "lonely", "hopeless", "therapy", "mental",
        "चिंता", "उदास", "तनाव", "नींद", "परेशान",
    ],
    medication: [
        "medicine", "medication", "drug", "pill", "tablet", "dose", "dosage",
        "side effect", "interaction", "prescription", "pharmacist", "ibuprofen",
        "paracetamol", "antibiotic", "दवा", "गोली", "साइड इफेक्ट",
    ],
};

function detectMode(text) {
    const lower = text.toLowerCase();
    for (const [mode, signals] of Object.entries(MODE_SIGNALS)) {
        if (signals.some(s => lower.includes(s))) return mode;
    }
    return null;
}

function detectCrisis(text) {
    const lower = text.toLowerCase();
    return CRISIS_PATTERNS.some(p => lower.includes(p));
}

function detectLanguage(text) {
    // Devanagari range
    return /[\u0900-\u097F]/.test(text) ? "hi-IN" : "en-US";
}

// ═══════════════════════════════════════════════════════════════════
// useVoiceInput hook
// ═══════════════════════════════════════════════════════════════════

export function useVoiceInput({ onTranscript, onInterim, onCrisis, apiBase, token }) {
    const [state, setState] = useState("idle");
    // idle | listening | processing | error

    const [amplitude, setAmplitude] = useState(0);
    const [interimText, setInterimText] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [hasPermission, setHasPermission] = useState(null);

    const recognitionRef = useRef(null);
    const mediaRecRef = useRef(null);
    const audioChunksRef = useRef([]);
    const analyserRef = useRef(null);
    const animFrameRef = useRef(null);
    const streamRef = useRef(null);

    // ── Build Web Speech API instance once ─────────────────────────
    useEffect(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return;

        const rec = new SR();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = "en-US";
        rec.maxAlternatives = 1;

        rec.onresult = (e) => {
            let interim = "", final = "";
            for (const result of e.results) {
                if (result.isFinal) final += result[0].transcript;
                else interim += result[0].transcript;
            }
            const current = final || interim;
            setInterimText(current);
            onInterim?.(current);
        };

        rec.onend = () => {
            stopAmplitude();
            const transcript = interimTextRef.current.trim();
            if (!transcript) {
                setState("idle");
                return;
            }
            setState("processing");
            _handleTranscript(transcript);
        };

        rec.onerror = (e) => {
            stopAmplitude();
            setState("error");
            setErrorMsg(
                e.error === "not-allowed" ? "Microphone access denied" :
                    e.error === "no-speech" ? "No speech detected — try again" :
                        `Voice error: ${e.error}`
            );
            setTimeout(() => setState("idle"), 3000);
        };

        recognitionRef.current = rec;
    }, []);

    // Keep a ref to interimText so the onend closure can read it
    const interimTextRef = useRef("");
    useEffect(() => { interimTextRef.current = interimText; }, [interimText]);

    // ── Amplitude from microphone (CSS animation driver) ───────────
    const startAmplitude = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const ctx = new AudioContext();
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            const tick = () => {
                const buf = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(buf);
                const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
                setAmplitude(Math.min(1, avg / 60));
                animFrameRef.current = requestAnimationFrame(tick);
            };
            tick();
        } catch { }
    }, []);

    const stopAmplitude = useCallback(() => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setAmplitude(0);
    }, []);

    // ── Handle final transcript ────────────────────────────────────
    const _handleTranscript = useCallback((text) => {
        setInterimText("");

        // Crisis intercept — highest priority
        if (detectCrisis(text)) {
            onCrisis?.();
            // Still send to chat so MindGuide can respond supportively
        }

        const detectedMode = detectMode(text);
        onTranscript?.(text, detectedMode);
        setState("idle");
    }, [onTranscript, onCrisis]);

    // ── Start recording ────────────────────────────────────────────
    const startListening = useCallback(async () => {
        if (state !== "idle") return;

        setErrorMsg("");
        setInterimText("");

        // Check mic permission
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true })
                .then(s => { s.getTracks().forEach(t => t.stop()); });
            setHasPermission(true);
        } catch {
            setHasPermission(false);
            setState("error");
            setErrorMsg("Microphone access denied — check browser settings");
            return;
        }

        setState("listening");
        await startAmplitude();

        if (recognitionRef.current) {
            // Web Speech API path
            const lang = "en-US"; // will auto-adjust mid-session via onresult
            recognitionRef.current.lang = lang;
            try {
                recognitionRef.current.start();
            } catch { }
        } else {
            // MediaRecorder → Whisper fallback
            await _startMediaRecorder();
        }
    }, [state, startAmplitude]);

    // ── MediaRecorder path (Whisper fallback) ─────────────────────
    const _startMediaRecorder = useCallback(async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        mediaRecRef.current = recorder;

        recorder.ondataavailable = (e) => { audioChunksRef.current.push(e.data); };
        recorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
            setState("processing");
            await _transcribeWhisper(blob);
        };

        recorder.start();
        // Auto-stop after 15s
        setTimeout(() => {
            if (mediaRecRef.current?.state === "recording") stopListening();
        }, 15000);
    }, []);

    const _transcribeWhisper = useCallback(async (blob) => {
        try {
            const reader = new FileReader();
            const b64 = await new Promise(res => {
                reader.onloadend = () => res(reader.result.split(",")[1]);
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
                    _handleTranscript(text.trim());
                    return;
                }
            }
        } catch { }
        setState("error");
        setErrorMsg("Transcription failed — try typing instead");
        setTimeout(() => setState("idle"), 3000);
    }, [apiBase, token, _handleTranscript]);

    // ── Stop recording ─────────────────────────────────────────────
    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch { }
        }
        if (mediaRecRef.current?.state === "recording") {
            mediaRecRef.current.stop();
        }
        stopAmplitude();
        if (state === "listening") setState("processing");
    }, [state, stopAmplitude]);

    const toggle = useCallback(() => {
        if (state === "listening") stopListening();
        else if (state === "idle" || state === "error") startListening();
    }, [state, startListening, stopListening]);

    return {
        state,         // "idle" | "listening" | "processing" | "error"
        amplitude,     // 0-1 float
        interimText,
        errorMsg,
        hasPermission,
        toggle,
        startListening,
        stopListening,
    };
}

// ═══════════════════════════════════════════════════════════════════
// VoiceMic component
// ═══════════════════════════════════════════════════════════════════

export function VoiceMic({ voice, accentColor = "#7ecec4", compact = false }) {
    const { state, amplitude, interimText, errorMsg, toggle } = voice;

    const size = compact ? 32 : 44;
    const isLive = state === "listening";
    const isBusy = state === "processing";
    const isError = state === "error";

    // Ring scale driven by amplitude
    const ring1Scale = 1 + amplitude * 0.6;
    const ring2Scale = 1 + amplitude * 1.1;
    const ring3Scale = 1 + amplitude * 1.7;

    const btnColor = isError ? "#ef4444"
        : isBusy ? "rgba(0,0,0,0.3)"
            : isLive ? accentColor
                : "rgba(0,0,0,0.35)";

    return (
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
            {/* Interim transcript preview */}
            {interimText && (
                <div style={{
                    position: "absolute", bottom: compact ? 38 : 52, right: 0,
                    background: "rgba(10,18,30,0.95)",
                    border: `1px solid ${accentColor}30`,
                    borderRadius: 10, padding: "6px 12px",
                    fontSize: 12, color: "rgba(255,255,255,0.7)",
                    maxWidth: 260, whiteSpace: "pre-wrap",
                    fontFamily: "'DM Sans', sans-serif",
                    fontStyle: "italic",
                    boxShadow: `0 0 20px ${accentColor}15`,
                    animation: "fadeUp 0.15s ease",
                    zIndex: 100,
                }}>
                    {interimText}
                    <span style={{
                        display: "inline-block", width: 1.5, height: 11,
                        background: accentColor, marginLeft: 2,
                        animation: "blink 0.7s step-end infinite",
                        verticalAlign: "middle",
                    }} />
                </div>
            )}

            {/* Error message */}
            {isError && errorMsg && (
                <div style={{
                    position: "absolute", bottom: compact ? 38 : 52, right: 0,
                    background: "rgba(30,10,10,0.95)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 8, padding: "5px 10px",
                    fontSize: 10, color: "#f87171",
                    whiteSpace: "nowrap",
                    fontFamily: "'IBM Plex Mono', monospace",
                    zIndex: 100,
                }}>
                    {errorMsg}
                </div>
            )}

            {/* Amplitude rings — only during live listening */}
            {isLive && (
                <div style={{
                    position: "absolute",
                    width: size, height: size,
                    borderRadius: "50%",
                    pointerEvents: "none",
                    zIndex: 0,
                }}>
                    {/* Ring 3 — outermost */}
                    <div style={{
                        position: "absolute", inset: 0,
                        borderRadius: "50%",
                        border: `1px solid ${accentColor}`,
                        transform: `scale(${ring3Scale})`,
                        opacity: Math.max(0, 0.15 + amplitude * 0.2),
                        transition: "transform 0.05s, opacity 0.05s",
                    }} />
                    {/* Ring 2 */}
                    <div style={{
                        position: "absolute", inset: 0,
                        borderRadius: "50%",
                        border: `1px solid ${accentColor}`,
                        transform: `scale(${ring2Scale})`,
                        opacity: Math.max(0, 0.25 + amplitude * 0.3),
                        transition: "transform 0.05s, opacity 0.05s",
                    }} />
                    {/* Ring 1 — innermost */}
                    <div style={{
                        position: "absolute", inset: 0,
                        borderRadius: "50%",
                        border: `1.5px solid ${accentColor}`,
                        transform: `scale(${ring1Scale})`,
                        opacity: Math.max(0, 0.4 + amplitude * 0.4),
                        transition: "transform 0.05s, opacity 0.05s",
                    }} />
                </div>
            )}

            {/* Main button */}
            <button
                onClick={toggle}
                title={
                    isLive ? "Tap to stop recording" :
                        isBusy ? "Processing..." :
                            isError ? errorMsg :
                                "Hold to speak"
                }
                style={{
                    position: "relative", zIndex: 1,
                    width: size, height: size,
                    borderRadius: "50%",
                    background: isLive
                        ? `radial-gradient(circle, ${accentColor}25, ${accentColor}08)`
                        : "rgba(0,0,0,0.04)",
                    border: `1.5px solid ${btnColor}`,
                    cursor: isBusy ? "wait" : "pointer",
                    color: btnColor,
                    fontSize: compact ? 13 : 16,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s",
                    flexShrink: 0,
                    outline: "none",
                    // Soft glow when live
                    boxShadow: isLive
                        ? `0 0 16px ${accentColor}30, 0 0 32px ${accentColor}10`
                        : "none",
                }}
            >
                {isBusy ? (
                    // Spinner
                    <div style={{
                        width: compact ? 10 : 14, height: compact ? 10 : 14,
                        border: `2px solid rgba(255,255,255,0.15)`,
                        borderTop: `2px solid rgba(255,255,255,0.5)`,
                        borderRadius: "50%",
                        animation: "spin 0.7s linear infinite",
                    }} />
                ) : isLive ? (
                    // Stop square
                    <div style={{
                        width: compact ? 8 : 10, height: compact ? 8 : 10,
                        background: accentColor,
                        borderRadius: 2,
                    }} />
                ) : (
                    // Mic icon (SVG, no external dep)
                    <svg width={compact ? 13 : 16} height={compact ? 13 : 16} viewBox="0 0 24 24" fill="none">
                        <rect x="9" y="2" width="6" height="11" rx="3"
                            stroke="currentColor" strokeWidth="1.8" />
                        <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="1.8"
                            strokeLinecap="round" />
                        <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor"
                            strokeWidth="1.8" strokeLinecap="round" />
                        <line x1="9" y1="22" x2="15" y2="22" stroke="currentColor"
                            strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                )}
            </button>

            {/* "Listening" label under button when live */}
            {isLive && !compact && (
                <div style={{
                    position: "absolute", top: size + 6, right: 0,
                    fontSize: 8, color: accentColor,
                    fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 2,
                    whiteSpace: "nowrap",
                    animation: "pulse 1.2s ease infinite",
                }}>
                    LISTENING
                </div>
            )}
        </div>
    );
}
