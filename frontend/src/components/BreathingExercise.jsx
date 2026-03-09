import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

/*
  BreathingExercise.jsx
  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Three.js particle sphere that expands/contracts with guided breathing.
  Particle color = real-time emotion state (from EmotionDetector WebSocket).
  As user calms down, particles transition from chaotic â†’ ordered.
  
  Uses local npm `three` package.
*/

// â”€â”€ Breathing pattern presets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BREATH_PATTERNS = {
  box: {
    id: "box",
    name: "Box Breathing",
    subtitle: "4 Â· 4 Â· 4 Â· 4",
    description: "Balance stress & sharpen focus",
    icon: "â–£",
    cycles: "4 cycles",
    color: "#60a5fa",
    recommendedFor: ["stressed", "anxious", "focused"],
    phases: [
      { name: "INHALE",  duration: 4000, target: 1.0,  color: 0xF97316, instruction: "Breathe in slowly..." },
      { name: "HOLD",    duration: 4000, target: 1.0,  color: 0xF59E0B, instruction: "Hold..." },
      { name: "EXHALE",  duration: 4000, target: 0.35, color: 0x22c55e, instruction: "Release slowly..." },
      { name: "HOLD",    duration: 4000, target: 0.35, color: 0xfb923c, instruction: "Rest..." },
    ],
  },
  "4-7-8": {
    id: "4-7-8",
    name: "4-7-8 Breathing",
    subtitle: "4 Â· 7 Â· 8",
    description: "Deep relaxation & better sleep",
    icon: "â—Ž",
    cycles: "4 cycles",
    color: "#7c3aed",
    recommendedFor: ["anxious", "fatigued", "stressed"],
    phases: [
      { name: "INHALE",  duration: 4000, target: 1.0,  color: 0x60a5fa, instruction: "Breathe in through nose..." },
      { name: "HOLD",    duration: 7000, target: 1.0,  color: 0xa78bfa, instruction: "Hold your breath..." },
      { name: "EXHALE",  duration: 8000, target: 0.35, color: 0x4ade80, instruction: "Exhale completely..." },
    ],
  },
  coherence: {
    id: "coherence",
    name: "Coherence Breathing",
    subtitle: "6 Â· 6",
    description: "Heart rate variability & deep calm",
    icon: "â—‰",
    cycles: "6 cycles",
    color: "#059669",
    recommendedFor: ["calm", "focused", "dissociation"],
    phases: [
      { name: "INHALE",  duration: 6000, target: 1.0,  color: 0x4ade80, instruction: "Breathe in slowly..." },
      { name: "EXHALE",  duration: 6000, target: 0.35, color: 0x60a5fa, instruction: "Release gently..." },
    ],
  },
  quick: {
    id: "quick",
    name: "Quick Calm",
    subtitle: "4 Â· 4",
    description: "Fast reset for acute stress",
    icon: "â—Œ",
    cycles: "8 cycles",
    color: "#dc2626",
    recommendedFor: ["stressed", "anxious", "joy"],
    phases: [
      { name: "INHALE",  duration: 4000, target: 1.0,  color: 0xfacc15, instruction: "Breathe in..." },
      { name: "EXHALE",  duration: 4000, target: 0.35, color: 0xf87171, instruction: "Release fully..." },
    ],
  },
};

// Default for backward compat â€” superseded by phasesRef at runtime
const PHASES = BREATH_PATTERNS.box.phases;

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

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export default function BreathingExercise({ emotion = "calm", stressScore = 0.3, onComplete }) {
  const mountRef    = useRef(null);
  const frameRef    = useRef(null);
  const countdownRef = useRef(null);
  const emotionRef = useRef(emotion);
  const stressRef = useRef(stressScore);
  const phasesRef   = useRef(BREATH_PATTERNS.box.phases);  // current pattern phases
  const stateRef    = useRef({
    phaseIndex: 0,
    phaseStart: Date.now(),
    breathScale: 0.35,
    targetScale: 1.0,
    cycleCount: 0,
  });

  const [phase,            setPhase]           = useState(PHASES[0]);
  const [progress,         setProgress]        = useState(0);
  const [cycleCount,       setCycleCount]      = useState(0);
  const [active,           setActive]          = useState(false);
  const [countdown,        setCountdown]       = useState(null);
  const [selectedPattern,  setSelectedPattern] = useState("box");

  const emotionColors = EMOTION_COLORS[emotion] || EMOTION_COLORS.calm;

  useEffect(() => {
    emotionRef.current = emotion;
    stressRef.current = stressScore;
  }, [emotion, stressScore]);

  // â”€â”€ Three.js scene â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!active) return;
    if (!mountRef.current) return;

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

    // â”€â”€ Particle sphere â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const positions  = new Float32Array(N_PARTICLES * 3);
    const origPos    = new Float32Array(N_PARTICLES * 3);
    const colors     = new Float32Array(N_PARTICLES * 3);
    const sizes      = new Float32Array(N_PARTICLES);
    const velocities = new Float32Array(N_PARTICLES * 3);
    const phases_p   = new Float32Array(N_PARTICLES);  // per-particle phase offset

    // Fibonacci sphere distribution
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

      positions[i*3]   = origPos[i*3];
      positions[i*3+1] = origPos[i*3+1];
      positions[i*3+2] = origPos[i*3+2];

      // Velocity for chaotic state
      velocities[i*3]   = (Math.random() - 0.5) * 0.8;
      velocities[i*3+1] = (Math.random() - 0.5) * 0.8;
      velocities[i*3+2] = (Math.random() - 0.5) * 0.8;

      phases_p[i] = Math.random() * Math.PI * 2;
      sizes[i]    = 1.5 + Math.random() * 2;

      // Initial color from emotion
      const c = new THREE.Color(emotionColors[0]);
      colors[i*3]   = c.r;
      colors[i*3+1] = c.g;
      colors[i*3+2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color",    new THREE.BufferAttribute(colors,    3));
    geo.setAttribute("size",     new THREE.BufferAttribute(sizes,     1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        time:       { value: 0 },
        pointScale: { value: renderer.getPixelRatio() * 80 },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float time;
        void main() {
          vColor = color;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (200.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.1, d);
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite:  false,
      vertexColors: true,
    });

    const particles = new THREE.Points(geo, mat);
    scene.add(particles);

    // â”€â”€ Wireframe sphere (structural guide) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const wireColor = new THREE.Color(emotionColors[0]);
    const wireMat   = new THREE.MeshBasicMaterial({
      color:       wireColor,
      wireframe:   true,
      transparent: true,
      opacity:     0.04,
    });
    const wireSphere = new THREE.Mesh(
      new THREE.SphereGeometry(baseRadius, 16, 16),
      wireMat
    );
    scene.add(wireSphere);

    // â”€â”€ Animation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let t = 0;

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      t += 0.016;
      mat.uniforms.time.value = t;

      const state = stateRef.current;
      const now   = Date.now();
      const phases = phasesRef.current;
      const phase = phases[state.phaseIndex] || phases[0];
      const elapsed = now - state.phaseStart;
      const phaseProgress = Math.min(elapsed / phase.duration, 1);

      // Advance phase
      if (phaseProgress >= 1) {
        const nextIdx = (state.phaseIndex + 1) % phases.length;
        state.phaseIndex = nextIdx;
        state.phaseStart = now;
        state.targetScale = phases[nextIdx].target;
        if (nextIdx === 0) {
          state.cycleCount++;
          setCycleCount(state.cycleCount);
        }
        setPhase(phases[nextIdx]);
      }

      setProgress(phaseProgress);

      // Smooth breath scale
      state.breathScale += (state.targetScale - state.breathScale) * 0.025;
      const bScale  = state.breathScale;
      const liveStress = Math.max(0, Math.min(1, Number(stressRef.current) || 0));
      const liveEmotionColors = EMOTION_COLORS[emotionRef.current] || EMOTION_COLORS.calm;
      const calmness = Math.max(0, 1 - liveStress);

      // Update particle positions
      const posArr = geo.attributes.position.array;
      const colArr = geo.attributes.color.array;

      // Target colors: blend from stressed-color â†’ calm-color based on calmness
      const colorA = new THREE.Color(liveEmotionColors[0]);   // current emotion
      const colorB = new THREE.Color(EMOTION_COLORS.calm[0]);
      const blended = colorA.clone().lerp(colorB, calmness * phaseProgress * 0.3);

      for (let i = 0; i < N_PARTICLES; i++) {
        const ox = origPos[i*3];
        const oy = origPos[i*3+1];
        const oz = origPos[i*3+2];

        // Target: sphere at breathScale * baseRadius
        const tx = ox * bScale;
        const ty = oy * bScale;
        const tz = oz * bScale;

        // Chaos amount: inversely proportional to calmness
        const chaos = liveStress * 12;
        const pOffset = phases_p[i];

        // Apply chaotic noise
        const nx = Math.sin(t * 0.8 + pOffset)       * chaos;
        const ny = Math.cos(t * 0.7 + pOffset * 1.3) * chaos;
        const nz = Math.sin(t * 0.6 + pOffset * 0.7) * chaos;

        posArr[i*3]   = tx + nx;
        posArr[i*3+1] = ty + ny;
        posArr[i*3+2] = tz + nz;

        // Color: transition toward calm
        const colorT = easeInOut(Math.min(1, calmness + phaseProgress * 0.2));
        colArr[i*3]   = colorA.r + (blended.r - colorA.r) * colorT;
        colArr[i*3+1] = colorA.g + (blended.g - colorA.g) * colorT;
        colArr[i*3+2] = colorA.b + (blended.b - colorA.b) * colorT;
      }

      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate    = true;

      // Sphere scale + rotation
      const sScale = bScale;
      wireSphere.scale.set(sScale, sScale, sScale);
      particles.rotation.y += 0.001;
      particles.rotation.x += 0.0003;
      wireSphere.rotation.y -= 0.0005;

      // Camera gentle drift
      camera.position.x = Math.sin(t * 0.05) * 20;
      camera.position.y = Math.cos(t * 0.04) * 15;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();
    stateRef.current.phaseStart = Date.now();

    const onResize = () => {
      const w = mountRef.current?.clientWidth  || W;
      const h = mountRef.current?.clientHeight || H;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [active]);

  // â”€â”€ Countdown before start â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const startSession = useCallback(() => {
    if (active || countdown !== null) return;
    clearCountdown();

    // Apply selected pattern
    phasesRef.current = BREATH_PATTERNS[selectedPattern]?.phases || BREATH_PATTERNS.box.phases;
    let c = 3;
    setCountdown(c);
    countdownRef.current = setInterval(() => {
      c--;
      if (c <= 0) {
        clearCountdown();
        setCountdown(null);
        setActive(true);
        stateRef.current = {
          phaseIndex: 0,
          phaseStart: Date.now(),
          breathScale: 0.35,
          targetScale: 1.0,
          cycleCount: 0,
        };
        setPhase(phasesRef.current[0]);
      } else {
        setCountdown(c);
      }
    }, 1000);
  }, [active, countdown, selectedPattern, clearCountdown]);

  const stopSession = useCallback(() => {
    clearCountdown();
    setCountdown(null);
    setActive(false);
    setCycleCount(0);
    onComplete?.({ cycles: stateRef.current.cycleCount });
  }, [onComplete, clearCountdown]);

  useEffect(() => () => clearCountdown(), [clearCountdown]);

  const phaseColorHex = `#${(phasesRef.current[active ? stateRef.current?.phaseIndex ?? 0 : 0])?.color?.toString(16).padStart(6,"0") || "60a5fa"}`;
  const stressLabel   = stressScore > 0.65 ? "HIGH" : stressScore > 0.35 ? "MODERATE" : "LOW";
  const stressColor   = stressScore > 0.65 ? "#f87171" : stressScore > 0.35 ? "#facc15" : "#4ade80";
  const activePat     = BREATH_PATTERNS[selectedPattern] || BREATH_PATTERNS.box;

  return (
    <div style={{
      position: "relative",
      width: "100%",
      height: "100vh",
      background: "radial-gradient(ellipse at 50% -10%, #0d0a2e 0%, #030308 60%)",
      overflow: "hidden",
      fontFamily: "'DM Mono', monospace",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        @keyframes fadeIn   { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
        @keyframes pulse    { 0%,100%{opacity:0.5} 50%{opacity:0.15} }
        @keyframes countdown{ 0%{transform:scale(1.3);opacity:0} 30%{opacity:1} 100%{transform:scale(0.8);opacity:0} }
        @keyframes breathRing { 0%,100%{opacity:0.35;transform:scale(1)} 50%{opacity:0.1;transform:scale(1.06)} }
        .start-btn:hover { transform: scale(1.04) !important; box-shadow: 0 8px 32px rgba(249,115,22,0.35) !important; }
      `}</style>

      {/* Globe background at 20% opacity */}
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        pointerEvents: "none", opacity: 0.2, zIndex: 0,
      }}>
        <svg viewBox="0 0 800 800" width="720" height="720" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Globe outline */}
          <circle cx="400" cy="400" r="350" stroke="#60a5fa" strokeWidth="2" fill="none"/>
          {/* Latitude lines */}
          {[-60,-40,-20,0,20,40,60].map(lat => {
            const y = 400 - (lat / 90) * 350;
            const halfW = Math.sqrt(Math.max(0, 350*350 - (y-400)*(y-400)));
            return <ellipse key={lat} cx="400" cy={y} rx={halfW} ry={Math.abs(halfW*0.2)} stroke="#60a5fa" strokeWidth="1" fill="none" opacity="0.6"/>;
          })}
          {/* Longitude lines (meridians as ellipses) */}
          {[-75,-60,-45,-30,-15,0,15,30,45,60,75].map(lng => {
            const rx = Math.abs(Math.cos(lng * Math.PI/180)) * 350;
            return <ellipse key={lng} cx="400" cy="400" rx={rx} ry="350" stroke="#60a5fa" strokeWidth="1" fill="none" opacity="0.5" transform={`rotate(${lng},400,400)`}/>;
          })}
          {/* Stylised continent blobs */}
          <path d="M340 210 Q360 180 390 200 Q430 195 450 220 Q470 240 460 270 Q440 300 420 290 Q390 310 365 290 Q340 270 330 250 Q325 230 340 210Z" fill="#60a5fa" opacity="0.35"/>
          <path d="M360 330 Q375 315 400 320 Q430 318 445 340 Q460 365 445 390 Q425 420 395 415 Q365 420 350 395 Q335 370 345 345 Q350 335 360 330Z" fill="#60a5fa" opacity="0.35"/>
          <path d="M460 250 Q480 235 510 245 Q540 255 545 280 Q550 310 530 320 Q510 330 490 315 Q465 300 460 275 Q458 262 460 250Z" fill="#60a5fa" opacity="0.3"/>
          <path d="M220 290 Q240 270 265 280 Q285 290 288 315 Q290 340 270 350 Q248 358 230 340 Q215 322 218 305 Q218 297 220 290Z" fill="#60a5fa" opacity="0.3"/>
          <path d="M200 380 Q215 360 240 370 Q262 380 265 405 Q267 430 245 440 Q220 448 205 428 Q192 410 196 395 Q197 386 200 380Z" fill="#60a5fa" opacity="0.25"/>
          <path d="M490 340 Q510 325 540 335 Q565 345 568 370 Q570 395 548 405 Q524 413 505 395 Q488 378 488 358 Q488 348 490 340Z" fill="#60a5fa" opacity="0.28"/>
          <path d="M395 450 Q420 440 445 455 Q465 470 462 495 Q458 520 435 525 Q408 528 392 508 Q378 490 382 468 Q386 455 395 450Z" fill="#60a5fa" opacity="0.25"/>
        </svg>
      </div>

      {/* Canvas */}
      <div ref={mountRef} style={{
        position: "absolute", inset: 0,
        opacity: active ? 1 : 0,
        transition: "opacity 1s ease",
      }} />

      {/* Orange glow blob */}
      <div style={{
        position: "absolute", width: 520, height: 520, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(249,115,22,0.10) 0%, transparent 70%)",
        top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 24, left: 0, right: 0,
        textAlign: "center", zIndex: 2, pointerEvents: "none",
      }}>
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontStyle: "italic",
          fontSize: 28, fontWeight: 700,
          color: "rgba(255,255,255,0.88)",
          letterSpacing: -0.5,
        }}>
          {activePat.name}
        </div>
        <div style={{
          fontSize: 11, letterSpacing: 1, color: "rgba(255,255,255,0.3)", marginTop: 5,
          fontFamily: "'DM Mono', monospace", fontWeight: 500,
        }}>
          {activePat.description}
        </div>
        <div style={{
          fontSize: 9, letterSpacing: 3,
          color: `${activePat.color}99`, marginTop: 4,
          fontFamily: "'DM Mono', monospace",
        }}>
          {activePat.subtitle}
        </div>
      </div>

      {/* Emotion + stress context */}
      <div style={{
        position: "absolute", top: 28, right: 28,
        textAlign: "right", zIndex: 2,
        fontSize: 9, letterSpacing: 2,
        background: "rgba(255,255,255,0.8)",
        border: "1px solid rgba(96,165,250,0.15)",
        borderRadius: 10, padding: "10px 14px",
        backdropFilter: "blur(8px)",
      }}>
        <div style={{ color: "rgba(255,255,255,0.28)", marginBottom: 3, fontFamily: "'DM Mono', monospace" }}>
          DETECTED STATE
        </div>
        <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 12, fontWeight: 600, textTransform: "capitalize", fontFamily: "'DM Mono', monospace" }}>
          {emotion}
        </div>
        <div style={{ color: stressColor, marginTop: 2, fontFamily: "'DM Mono', monospace" }}>
          STRESS: {stressLabel}
        </div>
        {stressScore > 0.65 && (
          <div style={{
            fontSize: 8, color: "#ef4444",
            marginTop: 4, animation: "pulse 2s ease infinite",
            fontFamily: "'DM Mono', monospace",
          }}>
            â— AUTO-TRIGGERED
          </div>
        )}
      </div>

      {/* Idle state */}
      {!active && countdown === null && (
        <div style={{
          zIndex: 3, textAlign: "center",
          animation: "fadeIn 0.6s ease",
        }}>
          {/* Pattern selector */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10,
            marginBottom: 28, width: "100%", maxWidth: 520,
          }}>
            {Object.values(BREATH_PATTERNS).map(pat => {
              const isSelected = selectedPattern === pat.id;
              const isRecommended = pat.recommendedFor.includes(emotion);
              return (
                <button
                  key={pat.id}
                  onClick={() => setSelectedPattern(pat.id)}
                  style={{
                    padding: "12px 10px",
                    background: isSelected
                      ? `linear-gradient(135deg, ${pat.color}22, ${pat.color}10)`
                      : "rgba(255,255,255,0.8)",
                    border: isSelected
                      ? `2px solid ${pat.color}66`
                      : "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12,
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 0.2s",
                    position: "relative",
                    transform: isSelected ? "translateY(-2px)" : "none",
                    boxShadow: isSelected ? `0 6px 20px ${pat.color}22` : "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                >
                  {isRecommended && (
                    <div style={{
                      position: "absolute", top: -6, right: 8,
                      background: pat.color, color: "#fff",
                      fontSize: 6, letterSpacing: 1, padding: "2px 6px",
                      borderRadius: 8, fontFamily: "'DM Mono', monospace",
                    }}>
                      FOR YOU
                    </div>
                  )}
                  <div style={{ fontSize: 22, color: isSelected ? pat.color : "rgba(255,255,255,0.25)", marginBottom: 4 }}>
                    {pat.icon}
                  </div>
                  <div style={{
                    fontSize: 9, fontWeight: 700, color: isSelected ? pat.color : "rgba(255,255,255,0.88)",
                    fontFamily: "'DM Mono', monospace", letterSpacing: 0.5, lineHeight: 1.3,
                    marginBottom: 2,
                  }}>
                    {pat.subtitle}
                  </div>
                  <div style={{
                    fontSize: 7.5, color: "rgba(255,255,255,0.3)",
                    fontFamily: "'DM Mono', monospace", lineHeight: 1.4,
                  }}>
                    {pat.name.split(" ")[0]}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{
            width: 128, height: 128,
            borderRadius: "50%",
            border: `2px solid ${activePat.color}33`,
            background: `${activePat.color}08`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px",
            position: "relative",
          }}>
            {/* Breathing rings */}
            {[1, 1.45, 1.9].map((s, i) => (
              <div key={i} style={{
                position: "absolute",
                width: 128 * s, height: 128 * s,
                borderRadius: "50%",
                border: `1px solid ${activePat.color}${Math.round((0.18 - i * 0.04) * 255).toString(16).padStart(2,"0")}`,
                animation: `breathRing ${2.2 + i * 0.6}s ease ${i * 0.35}s infinite`,
              }} />
            ))}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 30, color: `${activePat.color}77` }}>{activePat.icon}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", letterSpacing: 3, marginTop: 4, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                READY
              </div>
            </div>
          </div>

          <div style={{
            fontSize: 10, color: "rgba(255,255,255,0.28)",
            letterSpacing: 0.5, marginBottom: 20, lineHeight: 1.6,
            fontFamily: "'DM Mono', monospace", textAlign: "center",
          }}>
            {activePat.description} Â· Particles respond to your state
          </div>

          <button
            className="start-btn"
            onClick={startSession}
            style={{
              padding: "14px 40px",
              background: `linear-gradient(135deg, ${activePat.color}, ${activePat.color}cc)`,
              border: "none",
              borderRadius: 50,
              color: "#fff",
              fontFamily: "'DM Mono', monospace",
              fontSize: 13, letterSpacing: 2, fontWeight: 600,
              cursor: "pointer",
              transition: "transform 0.2s, box-shadow 0.2s",
              textTransform: "uppercase",
              boxShadow: `0 4px 20px ${activePat.color}44`,
            }}
          >
            Begin Session
          </button>
        </div>
      )}

      {/* Countdown overlay */}
      {countdown !== null && (
        <div style={{
          zIndex: 10, textAlign: "center",
          fontFamily: "'Syne', sans-serif",
          fontSize: 100, fontWeight: 800,
          color: "#60a5fa",
          animation: "countdown 1s ease",
          textShadow: "0 0 40px rgba(96,165,250,0.25)",
        }}>
          {countdown}
        </div>
      )}

      {/* Active breathing UI */}
      {active && (
        <>
          {/* Phase instruction */}
          <div style={{
            zIndex: 3, textAlign: "center",
            pointerEvents: "none",
          }}>
            <div style={{
              fontFamily: "'Syne', sans-serif",
              fontStyle: "italic",
              fontSize: 34, fontWeight: 700,
              color: phaseColorHex,
              textShadow: `0 0 30px ${phaseColorHex}44`,
              marginBottom: 8,
              transition: "color 1s, text-shadow 1s",
            }}>
              {phase.instruction}
            </div>

            {/* Progress arc */}
            <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 16px" }}>
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none"
                  stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                <circle cx="40" cy="40" r="34" fill="none"
                  stroke={phaseColorHex} strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress)}`}
                  transform="rotate(-90 40 40)"
                  style={{ transition: "stroke 1s", filter: `drop-shadow(0 0 6px ${phaseColorHex})` }}
                />
                <text x="40" y="45" textAnchor="middle"
                  fill={phaseColorHex} fontSize="11"
                  fontFamily="'DM Mono', monospace">
                  {phase.name}
                </text>
              </svg>
            </div>

            <div style={{
              fontSize: 10, color: "rgba(255,255,255,0.28)",
              letterSpacing: 3, fontFamily: "'DM Mono', monospace", fontWeight: 600,
            }}>
              CYCLE {cycleCount + 1}
            </div>
          </div>

          {/* Stop button */}
          <button
            onClick={stopSession}
            style={{
              position: "absolute", bottom: 32,
              padding: "10px 28px",
              background: "rgba(96,165,250,0.06)",
              border: "1px solid rgba(96,165,250,0.2)",
              borderRadius: 50,
              color: "rgba(249,115,22,0.7)",
              fontFamily: "'DM Mono', monospace",
              fontSize: 10, letterSpacing: 2, fontWeight: 600,
              cursor: "pointer", zIndex: 3,
              transition: "all 0.2s",
            }}
          >
            â–  End Session
          </button>
        </>
      )}

      {/* Cycle complete message */}
      {active && cycleCount > 0 && cycleCount % 3 === 0 && progress < 0.1 && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 5, textAlign: "center",
          animation: "fadeIn 0.5s ease",
          background: "rgba(3,3,8,0.9)",
          backdropFilter: "blur(12px)",
          padding: "18px 32px", borderRadius: 16,
          border: "1px solid rgba(96,165,250,0.2)",
          boxShadow: "0 8px 32px rgba(96,165,250,0.1)",
          pointerEvents: "none",
        }}>
          <div style={{ color: "#22c55e", fontSize: 18, marginBottom: 5 }}>â—</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.88)", letterSpacing: 1, fontFamily: "'DM Mono', monospace" }}>
            {cycleCount} Cycles Complete
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
            Keep going...
          </div>
        </div>
      )}
    </div>
  );
}

