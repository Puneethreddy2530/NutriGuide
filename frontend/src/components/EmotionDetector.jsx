import { useState, useEffect, useRef, useCallback } from "react";

const EMOTIONS = ["calm", "focused", "stressed", "anxious", "fatigued", "joy", "dissociation"];

const EMOTION_CONFIG = {
  calm: { color: "#4ade80", hover: "#22c55e", glow: "0 0 30px #4ade8055", icon: "◎", label: "Calm" },
  focused: { color: "#60a5fa", hover: "#3b82f6", glow: "0 0 30px #60a5fa55", icon: "◈", label: "Focused" },
  stressed: { color: "#f87171", hover: "#ef4444", glow: "0 0 30px #f8717155", icon: "◉", label: "Stressed" },
  anxious: { color: "#fb923c", hover: "#f97316", glow: "0 0 30px #fb923c55", icon: "◌", label: "Anxious" },
  fatigued: { color: "#a78bfa", hover: "#8b5cf6", glow: "0 0 30px #a78bfa55", icon: "◍", label: "Fatigued" },
  joy: { color: "#facc15", hover: "#eab308", glow: "0 0 30px #facc1555", icon: "●", label: "Joy" },
  dissociation: { color: "#94a3b8", hover: "#64748b", glow: "0 0 30px #94a3b855", icon: "○", label: "Dissociation" },
};

// ── SVG Emotion Streaks Overlay ─────────────────────────────────────────────
function EmotionStreaks({ allEmotions }) {
  if (!allEmotions) return null;
  const cx = 160, cy = 160, r = 160;
  const n = EMOTIONS.length;

  return (
    <svg width="320" height="320" viewBox="0 0 320 320" style={{
      position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 10
    }}>
      <defs>
        {EMOTIONS.map(e => (
          <filter key={`glow-${e}`} id={`glow-${e}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        ))}
      </defs>
      {EMOTIONS.map((e, i) => {
        const val = allEmotions[e] || 0;
        if (val < 0.05) return null; // Only show meaningful streaks

        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        // calculate streak coordinates starting from the circle's edge flowing inwards or outwards
        // We'll draw them from edge outwards
        const length = val * 50; // max length 50px extending inward
        const startR = 158; // just inside border
        const endR = 158 - length;

        const x1 = cx + startR * Math.cos(angle);
        const y1 = cy + startR * Math.sin(angle);
        const x2 = cx + endR * Math.cos(angle);
        const y2 = cy + endR * Math.sin(angle);

        return (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={EMOTION_CONFIG[e].color}
            strokeWidth={4 + val * 6}
            strokeLinecap="round"
            filter={`url(#glow-${e})`}
            style={{
              transition: "all 0.4s cubic-bezier(0.34,1.56,0.64,1)",
              opacity: 0.6 + val * 0.4,
            }}
          />
        );
      })}
    </svg>
  );
}

// ── Circular emotion radar ──────────────────────────────────────────────────
function EmotionRadar({ allEmotions, activeEmotion }) {
  if (!allEmotions) return null;
  const cx = 80, cy = 80, r = 55;
  const n = EMOTIONS.length;

  const points = EMOTIONS.map((e, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    const val = allEmotions[e] || 0;
    return {
      x: cx + r * val * Math.cos(angle),
      y: cy + r * val * Math.sin(angle),
      label: e,
      outer: { x: cx + (r + 14) * Math.cos(angle), y: cy + (r + 14) * Math.sin(angle) },
    };
  });

  const polygon = points.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <svg width="160" height="160" viewBox="0 0 160 160">
      {/* Grid rings */}
      {[0.25, 0.5, 0.75, 1].map(scale => (
        <polygon
          key={scale}
          points={EMOTIONS.map((_, i) => {
            const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
            return `${cx + r * scale * Math.cos(angle)},${cy + r * scale * Math.sin(angle)}`;
          }).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="1"
        />
      ))}
      {/* Spokes */}
      {EMOTIONS.map((_, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={cx + r * Math.cos(angle)}
            y2={cy + r * Math.sin(angle)}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="1"
          />
        );
      })}
      {/* Data polygon */}
      <polygon
        points={polygon}
        fill={`${EMOTION_CONFIG[activeEmotion]?.color || "#60a5fa"}33`}
        stroke={EMOTION_CONFIG[activeEmotion]?.color || "#60a5fa"}
        strokeWidth="1.5"
      />
      {/* Emotion labels */}
      {points.map((p, i) => (
        <text
          key={i}
          x={p.outer.x}
          y={p.outer.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="6"
          fill={EMOTIONS[i] === activeEmotion
            ? EMOTION_CONFIG[EMOTIONS[i]].color
            : "rgba(255,255,255,0.3)"}
          fontWeight={EMOTIONS[i] === activeEmotion ? 700 : 400}
          fontFamily="'DM Mono', monospace"
        >
          {EMOTIONS[i].slice(0, 4).toUpperCase()}
        </text>
      ))}
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={3} fill={EMOTION_CONFIG[activeEmotion]?.color || "#60a5fa"} />
    </svg>
  );
}

// ── Stress timeline bar ─────────────────────────────────────────────────────
function StressTimeline({ timeline }) {
  if (!timeline.length) return (
    <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
        TIMELINE WILL APPEAR HERE
      </span>
    </div>
  );

  const recent = timeline.slice(-80);
  const w = 4, gap = 1;

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: gap, height: 40, overflow: "hidden" }}>
      {recent.map((entry, i) => {
        const h = Math.max(4, entry.stress * 38);
        const cfg = EMOTION_CONFIG[entry.e] || EMOTION_CONFIG.calm;
        return (
          <div
            key={i}
            style={{
              width: w,
              height: h,
              background: cfg.color,
              borderRadius: 1,
              opacity: 0.5 + (i / recent.length) * 0.5,
              flexShrink: 0,
              transition: "height 0.2s ease",
            }}
            title={`${cfg.label} — stress: ${entry.stress.toFixed(2)}`}
          />
        );
      })}
    </div>
  );
}

// ── Emotion bar ─────────────────────────────────────────────────────────────
function EmotionBar({ emotion, value, isActive }) {
  const cfg = EMOTION_CONFIG[emotion];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
      <span style={{
        width: 70, fontSize: 9, color: isActive ? cfg.color : "rgba(255,255,255,0.3)",
        fontWeight: isActive ? 700 : 400,
        fontFamily: "'DM Mono', monospace", letterSpacing: 1,
        textTransform: "uppercase", flexShrink: 0,
        transition: "color 0.3s",
      }}>
        {cfg.label}
      </span>
      <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${(value || 0) * 100}%`,
          background: cfg.color,
          borderRadius: 2,
          transition: "width 0.4s cubic-bezier(0.34,1.56,0.64,1)",
        }} />
      </div>
      <span style={{
        width: 30, fontSize: 9, color: "rgba(255,255,255,0.3)",
        fontFamily: "'DM Mono', monospace", textAlign: "right", flexShrink: 0,
      }}>
        {((value || 0) * 100).toFixed(0)}%
      </span>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function EmotionDetector({ token, userId, onEmotionUpdate }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const frameLoopRef = useRef(null);
  const timelineRef = useRef([]);

  const [status, setStatus] = useState("idle");   // idle | connecting | live | warming | error | no_face
  const [emotion, setEmotion] = useState(null);
  const [allEmotions, setAllEmotions] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [stressScore, setStressScore] = useState(0);
  const [fps, setFps] = useState(0);
  const [timeline, setTimeline] = useState([]);
  const [isMock, setIsMock] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [activeModel, setActiveModel] = useState(null);   // "vit-fer" | "mediapipe-heuristic"
  const [ferScores, setFerScores] = useState(null);       // raw FER2013 scores from ViT
  const [errorReason, setErrorReason] = useState(null);  // human-readable error description
  const [finalResult, setFinalResult] = useState(null);  // captured on STOP — shown as summary

  const WS_URL = import.meta?.env?.VITE_WS_URL || `ws://${window.location.host}`;

  // ── Connect WebSocket ─────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!userId || userId === "undefined" || userId === "null") {
      console.error("EmotionDetector: userId is not available — session may have expired.");
      setErrorReason("Session expired — please log out and log in again.");
      setStatus("error");
      return;
    }

    setErrorReason(null);
    setStatus("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user", frameRate: 30 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      setStatus("error");
      console.error("Camera access denied:", err);
      return;
    }

    try {
      const ws = new WebSocket(`${WS_URL}/emotion/ws/${userId}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("live");
        startFrameLoop();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "keepalive" || data.type === "pong" || data.type === "reset_ok") return;

          setFps(data.fps || 0);

          if (!data.face_detected) {
            setFaceDetected(false);
            setStatus("no_face");
            setEmotion(null);
            setAllEmotions(null);
            return;
          }

          setFaceDetected(true);

          if (data.warming_up) {
            setStatus("warming");
            return;
          }

          setStatus("live");

          if (data.emotion) {
            setEmotion(data.emotion);
            setAllEmotions(data.all_emotions || {});
            setConfidence(data.confidence || 0);
            setStressScore(data.stress_score || 0);
            setIsMock(data.mock || false);
            setActiveModel(data.model || null);
            setFerScores(data.fer_scores || null);

            const entry = { t: data.timestamp, e: data.emotion, stress: data.stress_score || 0 };
            timelineRef.current = [...timelineRef.current.slice(-299), entry];
            setTimeline([...timelineRef.current]);

            onEmotionUpdate?.(data);
          }
        } catch { }
      };

      ws.onerror = () => {
        setErrorReason("WebSocket connection failed — check your internet / backend.");
        setStatus("error");
      };
      ws.onclose = () => {
        setStatus("idle");
        stopFrameLoop();
      };

    } catch (err) {
      setErrorReason("Camera or connection error — check permissions.");
      setStatus("error");
    }
  }, [token, userId]);

  // ── Frame capture loop ────────────────────────────────────────────────────
  const startFrameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");

    const capture = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      canvas.width = 320;   // Downscale for bandwidth
      canvas.height = 240;
      ctx.drawImage(video, 0, 0, 320, 240);

      canvas.toBlob(blob => {
        if (!blob) return;
        const reader = new FileReader();
        reader.onload = () => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const b64 = reader.result.split(",")[1];
            wsRef.current.send(JSON.stringify({ frame: b64 }));
          }
        };
        reader.readAsDataURL(blob);
      }, "image/jpeg", 0.7);

      frameLoopRef.current = requestAnimationFrame(capture);
    };

    frameLoopRef.current = requestAnimationFrame(capture);
  }, []);

  const stopFrameLoop = useCallback(() => {
    if (frameLoopRef.current) cancelAnimationFrame(frameLoopRef.current);
  }, []);

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    stopFrameLoop();
    wsRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    // Capture final result before clearing state
    if (emotion) {
      setFinalResult({
        emotion,
        allEmotions,
        confidence,
        stressScore,
        ferScores,
        activeModel,
        timeline: [...timelineRef.current],
      });
    }
    setStatus("idle");
    setEmotion(null);
    setAllEmotions(null);
  }, [stopFrameLoop, emotion, allEmotions, confidence, stressScore, ferScores, activeModel]);

  useEffect(() => () => disconnect(), []);

  // ── Derived state ─────────────────────────────────────────────────────────
  const cfg = emotion ? EMOTION_CONFIG[emotion] : null;
  const stressPct = Math.round(stressScore * 100);
  const stressLabel = stressPct > 70 ? "HIGH" : stressPct > 40 ? "MODERATE" : "LOW";
  const stressLabelClr = stressPct > 70 ? "#f87171" : stressPct > 40 ? "#fb923c" : "#4ade80";

  return (
    <div style={{
      fontFamily: "'DM Mono', 'Courier New', monospace",
      background: "radial-gradient(ellipse at 50% -10%, #0d0a2e 0%, #030308 60%)",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      color: "rgba(255,255,255,0.88)",
    }}>
      {/* Google font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Syne:wght@400;600;700;800&display=swap');

        .emotion-pulse {
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.8; transform: scale(0.97); }
        }
        .scan-line {
          animation: scan 3s linear infinite;
        }
        @keyframes scan {
          0%   { transform: translateY(-100%); opacity: 0; }
          10%  { opacity: 0.2; }
          90%  { opacity: 0.2; }
          100% { transform: translateY(100%); opacity: 0; }
        }
        .blink { animation: blink 1s step-end infinite; }
        @keyframes blink { 50% { opacity: 0; } }
        .fade-in { animation: fadeIn 0.4s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .stress-bar-fill {
          transition: width 0.6s cubic-bezier(0.34,1.2,0.64,1);
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28, textAlign: "center" }}>
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 9,
          letterSpacing: 6,
          color: "rgba(255,255,255,0.25)",
          textTransform: "uppercase",
          marginBottom: 6,
        }}>
          Neural Emotion Engine
        </div>
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: -0.5,
          color: "#60a5fa",
        }}>
          MindScan
        </div>
        <div style={{
          fontSize: 11, color: "rgba(255,255,255,0.3)",
          fontFamily: "'DM Mono', monospace",
          marginTop: 6, letterSpacing: 0.5,
        }}>
          Detect your emotional state in real-time using AI face analysis
        </div>
        {/* Custom model badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          marginTop: 10, padding: "4px 12px",
          background: activeModel === "vit-fer"
            ? "rgba(96,165,250,0.1)"
            : "rgba(255,255,255,0.04)",
          border: `1px solid ${activeModel === "vit-fer" ? "rgba(96,165,250,0.25)" : "rgba(255,255,255,0.08)"}`,
          borderRadius: 8,
          transition: "all 0.4s",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={activeModel === "vit-fer" ? "#60a5fa" : "rgba(255,255,255,0.2)"} strokeWidth="2" strokeLinecap="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <path d="M8 21h8M12 17v4"/>
          </svg>
          <span style={{
            fontSize: 9, fontFamily: "'DM Mono', monospace",
            letterSpacing: 1.5,
            color: activeModel === "vit-fer" ? "#60a5fa" : "rgba(255,255,255,0.25)",
          }}>
            {activeModel === "vit-fer"
              ? "Custom ViT-FER · CUDA Active"
              : "PyTorch ViT-FER · STANDBY"}
          </span>
        </div>
      </div>

      {/* Main layout */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 280px",
        gap: 24,
        width: "100%",
        maxWidth: 820,
        alignItems: "center",
      }}>

        {/* LEFT — Camera feed (Circular) */}
        <div style={{
          position: "relative",
          width: 320,
          height: 320,
          margin: "0 auto",
        }}>
          {cfg && <EmotionStreaks allEmotions={allEmotions} />}

          <div style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "#0d0d1c",
            borderRadius: "50%",
            overflow: "hidden",
            border: `6px solid ${cfg ? cfg.color : "rgba(255,255,255,0.08)"}`,
            boxShadow: cfg ? `0 0 40px ${cfg.color}44, inset 0 0 20px rgba(0,0,0,0.4)` : "0 8px 32px rgba(0,0,0,0.3)",
            transition: "all 0.5s cubic-bezier(0.34,1.56,0.64,1)",
            zIndex: 20,
          }}>
            {/* Video */}
            <video
              ref={videoRef}
              muted
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: status !== "idle" ? "block" : "none",
                transform: "scaleX(-1)",  // mirror
              }}
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {/* Idle state */}
            {status === "idle" && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 12,
              }}>
                <div style={{ fontSize: 48, opacity: 0.12, color: "#60a5fa" }}>◎</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: 3 }}>
                  CAMERA OFF
                </div>
              </div>
            )}

            {/* Error state */}
            {status === "error" && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 10, padding: 16, textAlign: "center",
              }}>
                <div style={{ fontSize: 28, color: "#ef4444" }}>⚠</div>
                <div style={{ fontSize: 9, color: "#ef4444", letterSpacing: 2 }}>ERROR</div>
                {errorReason && (
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", lineHeight: 1.6, maxWidth: 200 }}>
                    {errorReason}
                  </div>
                )}
              </div>
            )}

            {/* Scan line overlay */}
            {status === "live" && (
              <div className="scan-line" style={{
                position: "absolute", left: 0, right: 0,
                height: "30%",
                background: "linear-gradient(180deg, transparent, rgba(96,165,250,0.12), transparent)",
                pointerEvents: "none",
              }} />
            )}
          </div>

          {/* Status badge floating below circle */}
          <div style={{
            position: "absolute", bottom: -24, left: "50%", transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            fontSize: 9, letterSpacing: 2, padding: "6px 16px",
            borderRadius: 8,
            background: "rgba(3,3,8,0.9)",
            backdropFilter: "blur(8px)",
            border: `1px solid ${status === "live" ? "rgba(74,222,128,0.3)"
              : status === "warming" ? "rgba(251,146,60,0.3)"
                : status === "no_face" ? "rgba(248,113,113,0.3)"
                  : "rgba(255,255,255,0.08)"
              }`,
            color: status === "live" ? "#4ade80"
              : status === "warming" ? "#fb923c"
                : status === "no_face" ? "#f87171"
                  : "rgba(255,255,255,0.3)",
            zIndex: 30,
          }}>
            {status === "idle" && "● STANDBY"}
            {status === "connecting" && "○ INITIALIZING"}
            {status === "warming" && "◎ WARMING UP"}
            {status === "live" && "● TRACKING"}
            {status === "no_face" && "○ NO FACE DETECTED"}
            {status === "error" && "● ERROR"}
          </div>
        </div>

        {/* RIGHT — Analysis panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Current emotion */}
          <div style={{
            background: "rgba(255,255,255,0.025)",
            border: `1px solid ${cfg ? cfg.color + "44" : "rgba(255,255,255,0.07)"}`,
            borderRadius: 12,
            padding: "20px",
            backdropFilter: "blur(8px)",
            transition: "all 0.5s",
          }}>
            <div style={{ fontSize: 8, letterSpacing: 3, color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>
              DETECTED STATE
            </div>

            {cfg ? (
              <div className="fade-in">
                <div className="emotion-pulse" style={{
                  fontSize: 32,
                  marginBottom: 8,
                  color: cfg.color,
                }}>
                  {cfg.icon}
                </div>
                <div style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 22,
                  fontWeight: 800,
                  color: cfg.color,
                  letterSpacing: -0.5,
                }}>
                  {cfg.label}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                  {(confidence * 100).toFixed(0)}% confidence
                  {activeModel === "vit-fer" && (
                    <span style={{ marginLeft: 6, color: "#60a5fa", letterSpacing: 1 }}>· ViT</span>
                  )}
                </div>
                {/* Raw FER scores strip when ViT is active */}
                {ferScores && (
                  <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {Object.entries(ferScores)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 4)
                      .map(([label, score]) => (
                        <span key={label} style={{
                          fontSize: 9, padding: "3px 8px",
                          background: score > 0.3 ? "rgba(96,165,250,0.1)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${score > 0.3 ? "rgba(96,165,250,0.25)" : "transparent"}`,
                          borderRadius: 6,
                          color: score > 0.3 ? "#60a5fa" : "rgba(255,255,255,0.3)",
                          fontFamily: "'DM Mono', monospace",
                          letterSpacing: 0.5,
                        }}>
                          {label} {(score * 100).toFixed(0)}%
                        </span>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, padding: "20px 0" }}>
                {status === "idle" && "—"}
                {status === "no_face" && <span style={{ color: "#f87171" }}>NO FACE</span>}
                {status === "warming" && <span className="blink" style={{ color: "#fb923c" }}>WARMING UP<span>...</span></span>}
                {(status === "live" || status === "connecting") && !emotion && <span className="blink">ANALYZING<span>...</span></span>}
              </div>
            )}
          </div>

          {/* Stress meter */}
          <div style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.07)",
            backdropFilter: "blur(8px)",
            borderRadius: 12,
            padding: "16px 20px",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 12,
            }}>
              <div style={{ fontSize: 8, letterSpacing: 3, color: "rgba(255,255,255,0.25)" }}>
                STRESS INDEX
              </div>
              <div style={{ fontSize: 9, color: stressLabelClr, letterSpacing: 2, fontWeight: 700 }}>
                {stressLabel}
              </div>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
              <div className="stress-bar-fill" style={{
                height: "100%",
                width: `${stressPct}%`,
                background: `linear-gradient(90deg, #4ade80, #fb923c ${stressPct > 60 ? "60%" : "100%"}, #f87171)`,
              }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700, color: stressLabelClr, fontFamily: "'Syne', sans-serif" }}>
              {stressPct}
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginLeft: 2, fontWeight: 400 }}>/100</span>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 24,
        width: "100%",
        maxWidth: 820,
        marginTop: 24,
      }}>

        {/* Emotion breakdown bars */}
        <div style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.07)",
          backdropFilter: "blur(8px)",
          borderRadius: 12,
          padding: "20px",
        }}>
          <div style={{ fontSize: 8, letterSpacing: 3, color: "rgba(255,255,255,0.25)", marginBottom: 16 }}>
            EMOTION BREAKDOWN
          </div>
          {EMOTIONS.map(e => (
            <EmotionBar
              key={e}
              emotion={e}
              value={allEmotions?.[e]}
              isActive={emotion === e}
            />
          ))}
        </div>

        {/* Timeline + controls */}
        <div style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.07)",
          backdropFilter: "blur(8px)",
          borderRadius: 12,
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 8, letterSpacing: 3, color: "rgba(255,255,255,0.25)", marginBottom: 16 }}>
              STRESS TIMELINE
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", padding: 8, borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
              <StressTimeline timeline={timeline} />
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            {(status === "idle" || status === "error") ? (
              <button
                onClick={connect}
                style={{
                  flex: 1, padding: "14px 0",
                  background: status === "error"
                    ? "linear-gradient(135deg, rgba(248,113,113,0.15), rgba(248,113,113,0.08))"
                    : "linear-gradient(135deg, rgba(96,165,250,0.18), rgba(129,140,248,0.18))",
                  border: status === "error" ? "1px solid rgba(248,113,113,0.3)" : "1px solid rgba(96,165,250,0.3)",
                  borderRadius: 8,
                  color: status === "error" ? "#f87171" : "#60a5fa",
                  fontSize: 10, letterSpacing: 3, fontWeight: 500,
                  cursor: "pointer", fontFamily: "'DM Mono', monospace",
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => e.target.style.transform = "translateY(-1px)"}
                onMouseLeave={e => e.target.style.transform = "none"}
              >
                {status === "error" ? "↺ RETRY SCAN" : "▶ START SCAN"}
              </button>
            ) : (
              /* Only STOP during active scan — no RESET until final result */
              <button
                  onClick={disconnect}
                  style={{
                    flex: 1, padding: "13px 0",
                    background: "rgba(248,113,113,0.08)",
                    border: "1px solid rgba(248,113,113,0.2)",
                    borderRadius: 8,
                    color: "#f87171", fontSize: 10, letterSpacing: 3, fontWeight: 500,
                    cursor: "pointer", fontFamily: "'DM Mono', monospace",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={e => e.target.style.background = "rgba(248,113,113,0.14)"}
                  onMouseLeave={e => e.target.style.background = "rgba(248,113,113,0.08)"}}
                >
                  ■ STOP SCAN
                </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Final Result Overlay ── shown after STOP when emotion was detected */}
      {status === "idle" && finalResult && (() => {
        const fr = finalResult;
        const fCfg = EMOTION_CONFIG[fr.emotion] || EMOTION_CONFIG.calm;
        const fStressPct = Math.round((fr.stressScore || 0) * 100);
        const fStressClr = fStressPct > 70 ? "#f87171" : fStressPct > 40 ? "#fb923c" : "#4ade80";
        const topEmotions = fr.allEmotions
          ? Object.entries(fr.allEmotions).sort((a, b) => b[1] - a[1]).slice(0, 4)
          : [];
        return (
          <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(3,3,8,0.97)",
            backdropFilter: "blur(24px)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: 32,
            animation: "fadeIn 0.5s ease",
          }}>
            {/* Result card */}
            <div style={{
              background: "rgba(255,255,255,0.025)",
              border: `2px solid ${fCfg.color}44`,
              borderRadius: 16,
              padding: "40px 48px",
              maxWidth: 520, width: "100%",
              boxShadow: `0 0 60px ${fCfg.color}22`,
              textAlign: "center",
              backdropFilter: "blur(12px)",
              position: "relative",
            }}>
              {/* Badge */}
              <div style={{
                position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
                background: fCfg.color, color: "#030308",
                fontSize: 8, letterSpacing: 4, padding: "5px 16px",
                borderRadius: 6, fontFamily: "'DM Mono', monospace",
              }}>
                SCAN COMPLETE
              </div>

              {/* Emotion icon */}
              <div style={{
                fontSize: 64, marginBottom: 8, marginTop: 8,
                color: fCfg.color,
                filter: `drop-shadow(0 0 20px ${fCfg.color}66)`,
                animation: "pulse 3s ease-in-out infinite",
              }}>
                {fCfg.icon}
              </div>

              {/* Emotion name */}
              <div style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: 36, fontWeight: 800, color: fCfg.color,
                letterSpacing: -1, marginBottom: 4,
              }}>
                {fCfg.label}
              </div>
              <div style={{
                fontSize: 9, color: "rgba(255,255,255,0.3)",
                fontFamily: "'DM Mono', monospace", letterSpacing: 2, marginBottom: 24,
              }}>
                {(fr.confidence * 100).toFixed(0)}% CONFIDENCE
                {fr.activeModel === "vit-fer" && <span style={{ color: "#60a5fa", marginLeft: 8 }}>· VIT-FER</span>}
              </div>

              {/* Stress bar */}
              <div style={{ marginBottom: 24 }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  marginBottom: 8, alignItems: "center",
                }}>
                  <span style={{ fontSize: 9, letterSpacing: 3, color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace" }}>
                    STRESS INDEX
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: fStressClr, fontFamily: "'Syne', sans-serif" }}>
                    {fStressPct}<span style={{ fontSize: 10, opacity: 0.5 }}>/100</span>
                  </span>
                </div>
                <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${fStressPct}%`,
                    background: `linear-gradient(90deg, #4ade80, #fb923c ${fStressPct > 60 ? "60%" : "100%"}, #f87171)`,
                    borderRadius: 4, transition: "width 1s ease",
                  }} />
                </div>
              </div>

              {/* Top emotion breakdown */}
              {topEmotions.length > 0 && (
                <div style={{
                  background: "rgba(255,255,255,0.04)", borderRadius: 10,
                  padding: "14px 16px", marginBottom: 24,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <div style={{ fontSize: 8, letterSpacing: 3, color: "rgba(255,255,255,0.25)", marginBottom: 10, fontFamily: "'DM Mono', monospace" }}>
                    EMOTION BREAKDOWN
                  </div>
                  {topEmotions.map(([emo, val]) => {
                    const ec = EMOTION_CONFIG[emo] || EMOTION_CONFIG.calm;
                    return (
                      <div key={emo} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ width: 72, fontSize: 9, color: emo === fr.emotion ? ec.color : "rgba(255,255,255,0.28)", fontFamily: "'DM Mono', monospace", letterSpacing: 1 }}>
                          {ec.label.toUpperCase()}
                        </span>
                        <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${val * 100}%`, background: ec.color, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace", width: 28, textAlign: "right" }}>
                          {(val * 100).toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => {
                    setFinalResult(null);
                    timelineRef.current = [];
                    setTimeline([]);
                  }}
                  style={{
                    flex: 1, padding: "12px 0",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    color: "rgba(255,255,255,0.45)", fontSize: 9, letterSpacing: 2, fontWeight: 500,
                    cursor: "pointer", fontFamily: "'DM Mono', monospace",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.08)"}
                  onMouseLeave={e => e.target.style.background = "rgba(255,255,255,0.04)"}}
                >
                  ↺ RESET
                </button>
                <button
                  onClick={() => { setFinalResult(null); connect(); }}
                  style={{
                    flex: 2, padding: "12px 0",
                    background: "linear-gradient(135deg, rgba(96,165,250,0.2), rgba(129,140,248,0.2))",
                    border: "1px solid rgba(96,165,250,0.3)",
                    borderRadius: 8,
                    color: "#60a5fa", fontSize: 10, letterSpacing: 3, fontWeight: 500,
                    cursor: "pointer", fontFamily: "'DM Mono', monospace",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => e.target.style.boxShadow = "0 0 20px rgba(96,165,250,0.25)"}
                  onMouseLeave={e => e.target.style.boxShadow = "none"}}
                >
                  ▶ NEW SCAN
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
