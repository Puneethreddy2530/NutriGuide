import { useEffect, useRef, useState, useCallback } from "react";

const PHASES = [
  { name: "INHALE",  duration: 4000, target: 1.0,  color: 0x60a5fa, instruction: "Breathe in slowly..." },
  { name: "HOLD",    duration: 4000, target: 1.0,  color: 0xa78bfa, instruction: "Hold..." },
  { name: "EXHALE",  duration: 4000, target: 0.35, color: 0x4ade80, instruction: "Release slowly..." },
  { name: "HOLD",    duration: 4000, target: 0.35, color: 0x94a3b8, instruction: "Rest..." },
];

const EMOTION_COLORS = {
  calm:         [0x4ade80, 0x059669],
  focused:      [0x60a5fa, 0x2563eb],
  stressed:     [0xf87171, 0xdc2626],
  anxious:      [0xfb923c, 0xea580c],
  fatigued:     [0xa78bfa, 0x7c3aed],
  joy:          [0xfacc15, 0xd97706],
  dissociation: [0x94a3b8, 0x475569],
};

const N_PARTICLES = 2400;

function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

export default function BreathingExercise({ emotion = "calm", stressScore = 0.3, onComplete }) {
  const mountRef    = useRef(null);
  const frameRef    = useRef(null);
  const stateRef    = useRef({ phaseIndex: 0, phaseStart: Date.now(), breathScale: 0.35, targetScale: 1.0, cycleCount: 0 });

  const [phase,       setPhase]       = useState(PHASES[0]);
  const [progress,    setProgress]    = useState(0);
  const [cycleCount,  setCycleCount]  = useState(0);
  const [active,      setActive]      = useState(false);
  const [countdown,   setCountdown]   = useState(null);

  const emotionColors = EMOTION_COLORS[emotion] || EMOTION_COLORS.calm;

  useEffect(() => {
    if (!active || !window.THREE) return;
    const THREE = window.THREE;
    const W = mountRef.current.clientWidth;
    const H = mountRef.current.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
    camera.position.z = 300;

    const positions  = new Float32Array(N_PARTICLES * 3);
    const origPos    = new Float32Array(N_PARTICLES * 3);
    const colors     = new Float32Array(N_PARTICLES * 3);
    const sizes      = new Float32Array(N_PARTICLES);
    const velocities = new Float32Array(N_PARTICLES * 3);
    const phases_p   = new Float32Array(N_PARTICLES);

    const phi = Math.PI * (3 - Math.sqrt(5));
    const baseRadius = 80;
    for (let i = 0; i < N_PARTICLES; i++) {
      const y = 1 - (i / (N_PARTICLES - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = phi * i;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      origPos[i*3]   = x * baseRadius;
      origPos[i*3+1] = y * baseRadius;
      origPos[i*3+2] = z * baseRadius;
      positions[i*3]   = origPos[i*3]; positions[i*3+1] = origPos[i*3+1]; positions[i*3+2] = origPos[i*3+2];
      velocities[i*3]   = (Math.random() - 0.5) * 0.8; velocities[i*3+1] = (Math.random() - 0.5) * 0.8; velocities[i*3+2] = (Math.random() - 0.5) * 0.8;
      phases_p[i] = Math.random() * Math.PI * 2; sizes[i] = 1.5 + Math.random() * 2;
      const c = new THREE.Color(emotionColors[0]); colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color",    new THREE.BufferAttribute(colors,    3));
    geo.setAttribute("size",     new THREE.BufferAttribute(sizes,     1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, pointScale: { value: renderer.getPixelRatio() * 80 } },
      vertexShader: `attribute float size; attribute vec3 color; varying vec3 vColor; uniform float time; void main() { vColor = color; vec4 mvPos = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * (200.0 / -mvPos.z); gl_Position = projectionMatrix * mvPos; }`,
      fragmentShader: `varying vec3 vColor; void main() { vec2 uv = gl_PointCoord - 0.5; float d = length(uv); if (d > 0.5) discard; float alpha = smoothstep(0.5, 0.1, d); gl_FragColor = vec4(vColor, alpha); }`,
      transparent: true, depthWrite: false, vertexColors: true,
    });

    const particles = new THREE.Points(geo, mat);
    scene.add(particles);

    const wireColor = new THREE.Color(emotionColors[0]);
    const wireMat   = new THREE.MeshBasicMaterial({ color: wireColor, wireframe: true, transparent: true, opacity: 0.04 });
    const wireSphere = new THREE.Mesh(new THREE.SphereGeometry(baseRadius, 16, 16), wireMat);
    scene.add(wireSphere);

    let t = 0;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      t += 0.016; mat.uniforms.time.value = t;
      const state = stateRef.current; const now = Date.now(); const phase = PHASES[state.phaseIndex]; const elapsed = now - state.phaseStart; const phaseProgress = Math.min(elapsed / phase.duration, 1);
      if (phaseProgress >= 1) {
        const nextIdx = (state.phaseIndex + 1) % PHASES.length; state.phaseIndex = nextIdx; state.phaseStart = now; state.targetScale = PHASES[nextIdx].target; if (nextIdx === 0) { state.cycleCount++; setCycleCount(state.cycleCount); } setPhase(PHASES[nextIdx]);
      }
      setProgress(phaseProgress);
      state.breathScale += (state.targetScale - state.breathScale) * 0.025;
      const bScale  = state.breathScale; const calmness = Math.max(0, 1 - stressScore);
      const posArr = geo.attributes.position.array; const colArr = geo.attributes.color.array;
      const colorA = new THREE.Color(emotionColors[0]); const colorB = new THREE.Color(EMOTION_COLORS.calm[0]); const blended = colorA.clone().lerp(colorB, calmness * phaseProgress * 0.3);
      for (let i = 0; i < N_PARTICLES; i++) {
        const ox = origPos[i*3]; const oy = origPos[i*3+1]; const oz = origPos[i*3+2]; const tx = ox * bScale; const ty = oy * bScale; const tz = oz * bScale; const chaos = stressScore * 12; const pOffset = phases_p[i]; const nx = Math.sin(t * 0.8 + pOffset) * chaos; const ny = Math.cos(t * 0.7 + pOffset * 1.3) * chaos; const nz = Math.sin(t * 0.6 + pOffset * 0.7) * chaos; posArr[i*3] = tx + nx; posArr[i*3+1] = ty + ny; posArr[i*3+2] = tz + nz; const colorT = easeInOut(Math.min(1, calmness + phaseProgress * 0.2)); colArr[i*3] = colorA.r + (blended.r - colorA.r) * colorT; colArr[i*3+1] = colorA.g + (blended.g - colorA.g) * colorT; colArr[i*3+2] = colorA.b + (blended.b - colorA.b) * colorT;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; wireSphere.scale.set(bScale, bScale, bScale); particles.rotation.y += 0.001; particles.rotation.x += 0.0003; wireSphere.rotation.y -= 0.0005; camera.position.x = Math.sin(t * 0.05) * 20; camera.position.y = Math.cos(t * 0.04) * 15; camera.lookAt(0, 0, 0); renderer.render(scene, camera);
    };

    animate(); stateRef.current.phaseStart = Date.now();
    const onResize = () => { const w = mountRef.current?.clientWidth  || W; const h = mountRef.current?.clientHeight || H; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(frameRef.current); window.removeEventListener("resize", onResize); renderer.dispose(); if (mountRef.current?.contains(renderer.domElement)) { mountRef.current.removeChild(renderer.domElement); } };
  }, [active, emotion, stressScore]);

  const startSession = useCallback(() => { let c = 3; setCountdown(c); const iv = setInterval(() => { c--; if (c <= 0) { clearInterval(iv); setCountdown(null); setActive(true); stateRef.current = { phaseIndex: 0, phaseStart: Date.now(), breathScale: 0.35, targetScale: 1.0, cycleCount: 0 }; setPhase(PHASES[0]); } else { setCountdown(c); } }, 1000); }, []);

  const stopSession = useCallback(() => { setActive(false); setCycleCount(0); onComplete?.({ cycles: stateRef.current.cycleCount }); }, [onComplete]);

  const phaseColorHex = `#${PHASES[active ? stateRef.current?.phaseIndex ?? 0 : 0]?.color?.toString(16).padStart(6,"0") || "60a5fa"}`;
  const stressLabel   = stressScore > 0.65 ? "HIGH" : stressScore > 0.35 ? "MODERATE" : "LOW";
  const stressColor   = stressScore > 0.65 ? "#f87171" : stressScore > 0.35 ? "#facc15" : "#4ade80";

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", background: "radial-gradient(ellipse at 50% 60%, #06060f 0%, #020208 100%)", overflow: "hidden", fontFamily: "'DM Mono', monospace", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Playfair+Display:ital,wght@0,400;1,400&display=swap'); .start-btn:hover { transform: scale(1.04) !important; }`}</style>
      <div ref={mountRef} style={{ position: "absolute", inset: 0, opacity: active ? 1 : 0, transition: "opacity 1s ease" }} />
      <div style={{ position: "absolute", top: 28, left: 0, right: 0, textAlign: "center", zIndex: 2, pointerEvents: "none" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 26, color: "rgba(255,255,255,0.7)", letterSpacing: 2 }}>Box Breathing</div>
        <div style={{ fontSize: 8, letterSpacing: 4, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>4 · 4 · 4 · 4 TECHNIQUE</div>
      </div>

      {!active && countdown === null && (
        <div style={{ zIndex: 3, textAlign: "center", animation: "fadeIn 0.6s ease" }}>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", marginBottom: 8 }}>Start breathing session</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button className="start-btn" onClick={startSession} style={{ padding: "10px 18px", borderRadius: 8, background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.2)", color: "#60a5fa", cursor: "pointer" }}>Start</button>
          </div>
        </div>
      )}

      {countdown !== null && (
        <div style={{ zIndex: 4, fontSize: 64, color: "#fff", animation: "countdown 1s ease both" }}>{countdown}</div>
      )}

      {active && (
        <div style={{ position: "absolute", bottom: 28, left: 28, zIndex: 4, display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={stopSession} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", color: "#fff" }}>Stop</button>
          <div style={{ fontSize: 12, color: stressColor }}>Stress: {stressLabel}</div>
        </div>
      )}
    </div>
  );
}
