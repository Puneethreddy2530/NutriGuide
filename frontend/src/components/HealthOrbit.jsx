import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

const DOMAINS = [
  {
    key: "mental",
    label: "Mental",
    color: "#3b5fcf",
    emissive: "#1a2f8a",
    orbitRadius: 8.5,
    orbitSpeed: 0.28,
    size: 0.85,
    route: "/journal",
    description: "Mood / Emotion / Journal",
  },
  {
    key: "physical",
    label: "Physical",
    color: "#1e88e5",
    emissive: "#0d47a1",
    orbitRadius: 12,
    orbitSpeed: 0.2,
    size: 1.1,
    route: "/activity",
    description: "Sleep / Fitness / Recovery",
  },
  {
    key: "medication",
    label: "Meds",
    color: "#cc5a1e",
    emissive: "#7f1d1d",
    orbitRadius: 15.4,
    orbitSpeed: 0.16,
    size: 0.78,
    route: "/meds",
    description: "Adherence / Safety / Schedule",
  },
  {
    key: "social",
    label: "Social",
    color: "#e8a87c",
    emissive: "#8b5a2b",
    orbitRadius: 18.8,
    orbitSpeed: 0.13,
    size: 0.95,
    route: "/circles",
    description: "Community / Streaks / Support",
  },
];

function scoreMult(score) {
  const s = Number.isFinite(score) ? score : 60;
  return 0.65 + (Math.max(0, Math.min(100, s)) / 100) * 0.85;
}

function riskPalette(riskScore) {
  if (riskScore > 65) {
    return { label: "HIGH", color: "#ef4444", glow: "rgba(239,68,68,0.42)" };
  }
  if (riskScore > 40) {
    return { label: "MODERATE", color: "#f59e0b", glow: "rgba(245,158,11,0.42)" };
  }
  return { label: "STABLE", color: "#22c55e", glow: "rgba(34,197,94,0.42)" };
}

function OrbitRings() {
  return (
    <group>
      {DOMAINS.map((d) => (
        <mesh key={d.key} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[d.orbitRadius - 0.03, d.orbitRadius + 0.03, 200]} />
          <meshBasicMaterial color={d.color} transparent opacity={0.22} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function CentralCore({ riskScore }) {
  const coreRef = useRef();
  const auraRef = useRef();
  const { color } = riskPalette(riskScore);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (coreRef.current) {
      coreRef.current.rotation.y += 0.002;
      coreRef.current.material.emissiveIntensity = 1.0 + Math.sin(t * 2.8) * 0.22;
    }
    if (auraRef.current) {
      auraRef.current.scale.setScalar(1.45 + Math.sin(t * 2.1) * 0.08);
      auraRef.current.material.opacity = 0.22 + Math.sin(t * 2.5) * 0.05;
    }
  });

  return (
    <group>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[2.3, 2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} roughness={0.22} metalness={0.4} />
      </mesh>
      <mesh ref={auraRef}>
        <sphereGeometry args={[3.3, 48, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} side={THREE.BackSide} />
      </mesh>
      <pointLight color={color} intensity={6} distance={100} decay={2.2} />
    </group>
  );
}

function HealthPlanet({ domain, score, hoveredKey, setHoveredKey, onNavigate }) {
  const meshRef = useRef();
  const ringRef = useRef();
  const angleRef = useRef(Math.random() * Math.PI * 2);
  const mult = scoreMult(score);
  const isHovered = hoveredKey === domain.key;

  useFrame((state, delta) => {
    angleRef.current += domain.orbitSpeed * delta;
    const a = angleRef.current;
    const yWave = Math.sin(state.clock.elapsedTime * 1.7 + domain.orbitRadius) * 0.55;
    const x = Math.cos(a) * domain.orbitRadius;
    const z = Math.sin(a) * domain.orbitRadius;

    if (meshRef.current) {
      meshRef.current.position.set(x, yWave, z);
      meshRef.current.rotation.y += 0.01;
      meshRef.current.rotation.x += 0.004;
      meshRef.current.material.emissiveIntensity = isHovered ? 0.95 : 0.56;
    }

    if (ringRef.current) {
      ringRef.current.position.set(x, yWave, z);
      ringRef.current.rotation.x = Math.PI / 2;
      ringRef.current.rotation.z += 0.007;
      ringRef.current.material.opacity = isHovered ? 0.8 : 0.35;
    }
  });

  return (
    <group>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredKey(domain.key);
        }}
        onPointerOut={() => setHoveredKey(null)}
        onClick={(e) => {
          e.stopPropagation();
          onNavigate?.(domain.route);
        }}
      >
        <sphereGeometry args={[domain.size * mult, 30, 30]} />
        <meshStandardMaterial color={domain.color} emissive={domain.emissive} emissiveIntensity={0.56} roughness={0.48} metalness={0.3} />
      </mesh>
      <mesh ref={ringRef}>
        <torusGeometry args={[domain.size * mult + 0.4, 0.05, 16, 80]} />
        <meshBasicMaterial color={domain.color} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

function CameraRig() {
  const { camera, pointer } = useThree();

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const baseX = Math.sin(t * 0.17) * 3;
    const baseZ = 26 + Math.cos(t * 0.14) * 2;
    const targetX = baseX + pointer.x * 2.4;
    const targetY = 7.8 + pointer.y * 1.5;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 2.4, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 2.4, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, baseZ, 2.4, delta);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function SceneRoot({ scores, riskScore, hoveredKey, setHoveredKey, onNavigate }) {
  return (
    <>
      <ambientLight intensity={1.35} />
      <directionalLight intensity={1.2} position={[12, 14, 10]} />
      <directionalLight intensity={0.5} position={[-12, 8, -6]} color="#dbeafe" />

      <Stars radius={110} depth={45} count={3600} factor={4} saturation={0} fade speed={1.2} />
      <OrbitRings />
      <CentralCore riskScore={riskScore} />

      {DOMAINS.map((domain) => (
        <HealthPlanet
          key={domain.key}
          domain={domain}
          score={scores[domain.key]}
          hoveredKey={hoveredKey}
          setHoveredKey={setHoveredKey}
          onNavigate={onNavigate}
        />
      ))}

      <CameraRig />
    </>
  );
}

function SceneHUD({ hoveredKey, scores, riskScore, onNavigate }) {
  const active = DOMAINS.find((d) => d.key === hoveredKey) || DOMAINS[0];
  const risk = riskPalette(riskScore);

  return (
    <>
      <div style={{ position: "absolute", top: 20, left: 20, right: 20, pointerEvents: "none" }}>
        <div style={{
          width: "fit-content",
          padding: "10px 14px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(10,12,20,0.46)",
          color: "#e5e7eb",
          backdropFilter: "blur(8px)",
        }}>
          <div style={{ fontFamily: "'LEMONMILK', sans-serif", fontSize: 28, lineHeight: 1.1 }}>Health Orbit 3D</div>
          <div style={{ fontSize: 11, letterSpacing: 1.2, opacity: 0.85 }}>ALWAYS-ON INTERACTIVE SCENE</div>
        </div>
      </div>

      <div style={{ position: "absolute", top: 24, right: 24, pointerEvents: "none" }}>
        <div style={{
          padding: "10px 12px",
          borderRadius: 12,
          border: `1px solid ${risk.glow}`,
          background: "rgba(10,12,20,0.55)",
          color: "#f9fafb",
          minWidth: 130,
          backdropFilter: "blur(8px)",
        }}>
          <div style={{ fontSize: 10, letterSpacing: 1.3, opacity: 0.75 }}>RISK INDEX</div>
          <div style={{ fontSize: 20, color: risk.color, fontWeight: 700 }}>{Math.round(riskScore)}%</div>
          <div style={{ fontSize: 11 }}>{risk.label}</div>
        </div>
      </div>

      <div style={{ position: "absolute", left: 20, right: 20, bottom: 22, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
        {DOMAINS.map((d) => {
          const activeCard = hoveredKey === d.key;
          const value = Math.round(scores[d.key] ?? 50);
          return (
            <button
              key={d.key}
              onClick={() => onNavigate?.(d.route)}
              style={{
                textAlign: "left",
                borderRadius: 12,
                border: `1px solid ${activeCard ? `${d.color}99` : "rgba(255,255,255,0.16)"}`,
                background: activeCard ? "rgba(255,255,255,0.16)" : "rgba(10,12,20,0.52)",
                color: "#f8fafc",
                padding: "10px 12px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                backdropFilter: "blur(8px)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{d.label}</span>
                <span style={{ fontSize: 15, color: d.color }}>{value}</span>
              </div>
              <div style={{ fontSize: 10, opacity: 0.82 }}>{d.description}</div>
            </button>
          );
        })}
      </div>

      <div style={{
        position: "absolute",
        top: "50%",
        left: 20,
        transform: "translateY(-50%)",
        width: 220,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(10,12,20,0.5)",
        color: "#e5e7eb",
        padding: "12px 14px",
        backdropFilter: "blur(8px)",
        pointerEvents: "none",
      }}>
        <div style={{ fontSize: 10, letterSpacing: 1.2, opacity: 0.75, marginBottom: 6 }}>FOCUS DOMAIN</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{active.label}</div>
        <div style={{ fontSize: 11, lineHeight: 1.55, opacity: 0.9 }}>{active.description}</div>
      </div>
    </>
  );
}

export default function HealthOrbit({ scores = {}, riskScore = 30, onNavigate }) {
  const [hoveredKey, setHoveredKey] = useState(null);

  return (
    <div style={{
      position: "relative",
      width: "100%",
      height: "100vh",
      overflow: "hidden",
      background: "radial-gradient(circle at 50% 20%, #1a2032 0%, #070a14 55%, #03050b 100%)",
      fontFamily: "'DM Mono', monospace",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap');`}</style>
      <Canvas dpr={[1, 2]} camera={{ fov: 52, position: [0, 8, 26] }}>
        <Suspense fallback={null}>
          <SceneRoot
            scores={scores}
            riskScore={riskScore}
            hoveredKey={hoveredKey}
            setHoveredKey={setHoveredKey}
            onNavigate={onNavigate}
          />
        </Suspense>
      </Canvas>
      <SceneHUD hoveredKey={hoveredKey} scores={scores} riskScore={riskScore} onNavigate={onNavigate} />
    </div>
  );
}

