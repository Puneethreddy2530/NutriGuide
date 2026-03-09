import { useState, useEffect, useRef, useCallback } from "react";

const EMOTIONS = ["calm", "focused", "stressed", "anxious", "fatigued", "joy", "dissociation"];

const EMOTION_CONFIG = {
  calm:          { color: "#4ade80", glow: "0 0 30px #4ade8066", icon: "◎", label: "Calm" },
  focused:       { color: "#60a5fa", glow: "0 0 30px #60a5fa66", icon: "◈", label: "Focused" },
  stressed:      { color: "#f87171", glow: "0 0 30px #f8717166", icon: "◉", label: "Stressed" },
  anxious:       { color: "#fb923c", glow: "0 0 30px #fb923c66", icon: "◌", label: "Anxious" },
  fatigued:      { color: "#a78bfa", glow: "0 0 30px #a78bfa66", icon: "◍", label: "Fatigued" },
  joy:           { color: "#facc15", glow: "0 0 30px #facc1566", icon: "●", label: "Joy" },
  dissociation:  { color: "#94a3b8", glow: "0 0 30px #94a3b866", icon: "○", label: "Dissociation" },
};

function EmotionRadar({ allEmotions, activeEmotion }) {
  if (!allEmotions) return null;
  const cx = 80, cy = 80, r = 55;
  const n = EMOTIONS.length;
  const points = EMOTIONS.map((e, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    const val = allEmotions[e] || 0;
    return { x: cx + r * val * Math.cos(angle), y: cy + r * val * Math.sin(angle), label: e, outer: { x: cx + (r + 14) * Math.cos(angle), y: cy + (r + 14) * Math.sin(angle) } };
  });
  const polygon = points.map(p => `${p.x},${p.y}`).join(" ");
  return (
    <svg width="160" height="160" viewBox="0 0 160 160">
      {[0.25, 0.5, 0.75, 1].map(scale => (
        <polygon key={scale} points={EMOTIONS.map((_, i) => { const angle = (i / n) * 2 * Math.PI - Math.PI / 2; return `${cx + r * scale * Math.cos(angle)},${cy + r * scale * Math.sin(angle)}`; }).join(" ")} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
      ))}
      {EMOTIONS.map((_, i) => { const angle = (i / n) * 2 * Math.PI - Math.PI / 2; return <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(angle)} y2={cy + r * Math.sin(angle)} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />; })}
      <polygon points={polygon} fill={`${EMOTION_CONFIG[activeEmotion]?.color || "#60a5fa"}22`} stroke={EMOTION_CONFIG[activeEmotion]?.color || "#60a5fa"} strokeWidth="1.5" style={{ filter: `drop-shadow(${EMOTION_CONFIG[activeEmotion]?.glow || ""})` }} />
      {points.map((p, i) => (<text key={i} x={p.outer.x} y={p.outer.y} textAnchor="middle" dominantBaseline="middle" fontSize="6" fill={EMOTIONS[i] === activeEmotion ? EMOTION_CONFIG[EMOTIONS[i]].color : "rgba(255,255,255,0.35)"} fontFamily="'DM Mono', monospace">{EMOTIONS[i].slice(0,4).toUpperCase()}</text>))}
      <circle cx={cx} cy={cy} r={3} fill={EMOTION_CONFIG[activeEmotion]?.color || "#60a5fa"} />
    </svg>
  );
}

function StressTimeline({ timeline }) {
  if (!timeline.length) return (<div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>TIMELINE WILL APPEAR HERE</span></div>);
  const recent = timeline.slice(-80); const w = 4, gap = 1;
  return (<div style={{ display: "flex", alignItems: "flex-end", gap: gap, height: 40, overflow: "hidden" }}>{recent.map((entry, i) => { const h = Math.max(4, entry.stress * 38); const cfg = EMOTION_CONFIG[entry.e] || EMOTION_CONFIG.calm; return (<div key={i} style={{ width: w, height: h, background: cfg.color, borderRadius: 1, opacity: 0.4 + (i / recent.length) * 0.6, flexShrink: 0, transition: "height 0.2s ease" }} title={`${cfg.label} — stress: ${entry.stress.toFixed(2)}`} />); })}</div>);
}

function EmotionBar({ emotion, value, isActive }) {
  const cfg = EMOTION_CONFIG[emotion];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
      <span style={{ width: 70, fontSize: 9, color: isActive ? cfg.color : "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace", letterSpacing: 1, textTransform: "uppercase", flexShrink: 0, transition: "color 0.3s" }}>{cfg.label}</span>
      <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(value || 0) * 100}%`, background: cfg.color, borderRadius: 2, transition: "width 0.4s cubic-bezier(0.34,1.56,0.64,1)", boxShadow: isActive ? `0 0 8px ${cfg.color}` : "none" }} />
      </div>
      <span style={{ width: 30, fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace", textAlign: "right", flexShrink: 0 }}>{((value || 0) * 100).toFixed(0)}%</span>
    </div>
  );
}

export default function EmotionDetector({ token, userId, onEmotionUpdate }) {
  const videoRef       = useRef(null);
  const canvasRef      = useRef(null);
  const wsRef          = useRef(null);
  const streamRef      = useRef(null);
  const frameLoopRef   = useRef(null);
  const timelineRef    = useRef([]);

  const [status,        setStatus]        = useState("idle");
  const [emotion,       setEmotion]       = useState(null);
  const [allEmotions,   setAllEmotions]   = useState(null);
  const [confidence,    setConfidence]    = useState(0);
  const [stressScore,   setStressScore]   = useState(0);
  const [fps,           setFps]           = useState(0);
  const [timeline,      setTimeline]      = useState([]);
  const [isMock,        setIsMock]        = useState(false);
  const [faceDetected,  setFaceDetected]  = useState(false);

  const WS_URL = import.meta?.env?.VITE_WS_URL || "ws://localhost:8000";

  const connect = useCallback(async () => {
    setStatus("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user", frameRate: 30 }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch (err) { setStatus("error"); console.error("Camera access denied:", err); return; }
    try {
      const ws = new WebSocket(`${WS_URL}/emotion/ws/${userId}?token=${token}`);
      wsRef.current = ws;
      ws.onopen = () => { setStatus("live"); startFrameLoop(); };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "keepalive" || data.type === "pong") return;
          setFps(data.fps || 0);
          if (!data.face_detected) { setFaceDetected(false); setStatus("no_face"); return; }
          setFaceDetected(true); setStatus("live");
          if (data.emotion) {
            setEmotion(data.emotion); setAllEmotions(data.all_emotions); setConfidence(data.confidence || 0); setStressScore(data.stress_score || 0); setIsMock(data.mock || false);
            const entry = { t: data.timestamp, e: data.emotion, stress: data.stress_score || 0 };
            timelineRef.current = [...timelineRef.current.slice(-299), entry]; setTimeline([...timelineRef.current]); onEmotionUpdate?.(data);
          }
        } catch {}
      };
      ws.onerror = () => setStatus("error"); ws.onclose = () => { if (status !== "idle") setStatus("idle"); stopFrameLoop(); };
    } catch (err) { setStatus("error"); }
  }, [token, userId]);

  const startFrameLoop = useCallback(() => {
    const canvas = canvasRef.current; const video  = videoRef.current; if (!canvas || !video) return; const ctx = canvas.getContext("2d");
    const capture = () => { if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return; canvas.width = 320; canvas.height = 240; ctx.drawImage(video, 0, 0, 320, 240); canvas.toBlob(blob => { if (!blob) return; const reader = new FileReader(); reader.onload = () => { if (wsRef.current?.readyState === WebSocket.OPEN) { const b64 = reader.result.split(",")[1]; wsRef.current.send(JSON.stringify({ frame: b64 })); } }; reader.readAsDataURL(blob); }, "image/jpeg", 0.7); frameLoopRef.current = requestAnimationFrame(capture); };
    frameLoopRef.current = requestAnimationFrame(capture);
  }, []);

  const stopFrameLoop = useCallback(() => { if (frameLoopRef.current) cancelAnimationFrame(frameLoopRef.current); }, []);
  const disconnect = useCallback(() => { stopFrameLoop(); wsRef.current?.close(); streamRef.current?.getTracks().forEach(t => t.stop()); if (videoRef.current) videoRef.current.srcObject = null; setStatus("idle"); setEmotion(null); setAllEmotions(null); }, [stopFrameLoop]);
  useEffect(() => () => disconnect(), []);

  const cfg = emotion ? EMOTION_CONFIG[emotion] : null; const stressPct = Math.round(stressScore * 100); const stressLabel = stressPct > 70 ? "HIGH" : stressPct > 40 ? "MODERATE" : "LOW"; const stressLabelClr = stressPct > 70 ? "#f87171" : stressPct > 40 ? "#fb923c" : "#4ade80";

  return (
    <div style={{ fontFamily: "'DM Mono', 'Courier New', monospace", background: "linear-gradient(135deg, #08080f 0%, #0d0d1a 50%, #080810 100%)", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", color: "#fff" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Syne:wght@400;600;700;800&display=swap');`}</style>
      <div style={{ marginBottom: 28, textAlign: "center" }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, letterSpacing: 6, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 6 }}>Neural Emotion Engine</div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: -0.5, background: "linear-gradient(90deg, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>MindScan</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, width: "100%", maxWidth: 820 }}>
        <div style={{ position: "relative", background: "#0a0a14", borderRadius: 16, overflow: "hidden", border: `1px solid ${cfg ? cfg.color + "33" : "rgba(255,255,255,0.06)"}`, boxShadow: cfg ? cfg.glow : "none", transition: "border-color 0.5s, box-shadow 0.5s", aspectRatio: "4/3" }}>
          <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <div style={{ position: "absolute", top: 8, left: 8, fontSize: 9, color: "rgba(255,255,255,0.6)", fontFamily: "'DM Mono', monospace" }}>
            <button onClick={() => { if (status === "live") disconnect(); else connect(); }} style={{ padding: "6px 8px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", color: "#fff" }}>{status === "live" ? "Disconnect" : "Start"}</button>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>SESSION</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 160, height: 160, background: "rgba(255,255,255,0.02)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <EmotionRadar allEmotions={allEmotions} activeEmotion={emotion} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700 }}>{emotion ? emotion.toUpperCase() : "—"}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>Confidence: {(confidence * 100).toFixed(0)}%</div>
              <div style={{ height: 8 }} />
              <EmotionBar emotion={emotion || 'calm'} value={allEmotions?.[emotion] || 0.6} isActive />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>RECENT STRESS</div>
            <StressTimeline timeline={timeline} />
          </div>
        </div>
      </div>
    </div>
  );
}
