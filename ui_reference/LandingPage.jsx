import { useState } from "react";
import LandingNavbar from "../LandingNavbar";
import HeroScene from "./HeroScene";
import LandingFooter from "../LandingFooter";

// Google Fonts injection (same as main app, but light-mode subset)
const FONTS =
  "@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700;0,9..144,800;0,9..144,900;1,9..144,700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');";

export default function LandingPage({ onEnterApp }) {
  const [activeCarouselItem, setActiveCarouselItem] = useState("fitness");

  return (
    <div style={{
      background: "#FAFAF9",
      minHeight: "100vh",
      fontFamily: "'Inter', sans-serif",
      overflowX: "hidden",
    }}>
      <style>{FONTS}</style>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { overflow-x: hidden; }

        /* Scrollbar styling for landing page */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb {
          background: rgba(249,115,22,0.3);
          border-radius: 2px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(249,115,22,0.6);
        }
      `}</style>

      {/* Fixed Navbar */}
      <LandingNavbar
        activeCarouselItem={activeCarouselItem}
        onCarouselSwitch={setActiveCarouselItem}
        onEnterApp={onEnterApp}
      />

      {/* Main GSAP Hero (scroll-driven, 500vh) */}
      <HeroScene
        onEnterApp={onEnterApp}
        activeCarouselItem={activeCarouselItem}
        onCarouselChange={setActiveCarouselItem}
      />

      {/* Feature strip — appears below the scroll area */}
      <FeatureStrip onEnterApp={onEnterApp} />

      {/* Footer */}
      <LandingFooter onEnterApp={onEnterApp} />
    </div>
  );
}

// ── Feature strips ─────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: "◎",
    title: "Real-time Emotion AI",
    desc: "EfficientNet detects 7 emotions from webcam feed. Mood timelines. Stress spikes. Private & on-device.",
    color: "#F97316",
  },
  {
    icon: "⬟",
    title: "Drug Interaction GNN",
    desc: "Graph Neural Network maps polypharmacy risks. Just enter your medications — we flag conflicts instantly.",
    color: "#EA580C",
  },
  {
    icon: "━",
    title: "Predictive Timeline",
    desc: "TFT-powered health forecasting: sleep, recovery, and mood predictions 24 hours ahead.",
    color: "#F97316",
  },
  {
    icon: "◌",
    title: "Guided Breathing",
    desc: "Adaptive breathing patterns that respond to your current stress index. Calm in 60 seconds.",
    color: "#C2410C",
  },
];

function FeatureStrip({ onEnterApp }) {
  return (
    <section style={{
      padding: "100px 80px",
      background: "#fff",
      borderTop: "1px solid rgba(0,0,0,0.05)",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 64 }}>
        <div style={{
          fontSize: 10, letterSpacing: 4, color: "#F97316",
          fontFamily: "'Inter', sans-serif", fontWeight: 700,
          marginBottom: 16,
        }}>
          ◎ PLATFORM CAPABILITIES
        </div>
        <h2 style={{
          fontSize: "clamp(36px, 4vw, 60px)",
          fontFamily: "'Fraunces', Georgia, serif",
          fontWeight: 800, letterSpacing: -1, color: "#0A0A0A",
          marginBottom: 16,
        }}>
          Everything your health needs.
        </h2>
        <p style={{
          fontSize: 14, color: "#828282", maxWidth: 480,
          margin: "0 auto", lineHeight: 1.7,
          fontFamily: "'Inter', sans-serif",
        }}>
          A unified platform built on three specialized AI models,
          designed for privacy-first intelligent healthcare.
        </p>
      </div>

      {/* Cards grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 24,
      }}>
        {FEATURES.map(f => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </div>

      {/* CTA block */}
      <div style={{ textAlign: "center", marginTop: 64 }}>
        <button
          onClick={onEnterApp}
          style={{
            padding: "16px 48px",
            background: "linear-gradient(135deg, #F97316, #EA580C)",
            border: "none", borderRadius: 40, color: "#fff",
            fontFamily: "'Inter', sans-serif",
            fontSize: 14, letterSpacing: 2, fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 8px 36px rgba(249,115,22,0.4)",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
            e.currentTarget.style.boxShadow = "0 12px 48px rgba(249,115,22,0.55)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow = "0 8px 36px rgba(249,115,22,0.4)";
          }}
        >
          START YOUR HEALTH JOURNEY →
        </button>
        <div style={{
          fontSize: 10, color: "#bbb", marginTop: 16, letterSpacing: 1,
          fontFamily: "'Inter', sans-serif",
        }}>
          No credit card required · Fully private · Open source
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ icon, title, desc, color }) {
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "32px 28px",
        background: hov ? "#FFFBF5" : "#FAFAF9",
        border: hov ? `1px solid ${color}44` : "1px solid rgba(0,0,0,0.07)",
        borderRadius: 20,
        transform: hov ? "translateY(-4px)" : "none",
        boxShadow: hov
          ? `0 12px 40px rgba(249,115,22,0.12), 0 2px 8px rgba(0,0,0,0.04)`
          : "0 2px 8px rgba(0,0,0,0.03)",
        transition: "all 0.25s ease",
        cursor: "default",
      }}
    >
      {/* Icon orb */}
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: `linear-gradient(135deg, ${color}22, ${color}11)`,
        border: `1px solid ${color}33`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, color: color, marginBottom: 24,
      }}>
        {icon}
      </div>
      <h3 style={{
        fontSize: 17, fontWeight: 700, color: "#0A0A0A", marginBottom: 10,
        fontFamily: "'Fraunces', Georgia, serif", letterSpacing: 0.3,
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: 12, color: "#777", lineHeight: 1.7,
        fontFamily: "'Inter', sans-serif",
      }}>
        {desc}
      </p>
    </div>
  );
}


