import { useState } from "react";
import LandingNavbar from "./LandingNavbar";
import HeroScene from "./HeroScene";
import LandingFooter from "./LandingFooter";

// Google Fonts injection — NeoPulse theme fonts
const FONTS =
  "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');"

export default function LandingPage({ onEnterApp }) {
  const [activeCarouselItem, setActiveCarouselItem] = useState("fitness");

  return (
    <div style={{
      background: "#030308",
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
          background: rgba(96,165,250,0.3);
          border-radius: 2px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(96,165,250,0.6);
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
    color: "#60a5fa",
  },
  {
    icon: "⬟",
    title: "Drug Interaction GNN",
    desc: "Graph Neural Network maps polypharmacy risks. Just enter your medications — we flag conflicts instantly.",
    color: "#a78bfa",
  },
  {
    icon: "â”",
    title: "Predictive Timeline",
    desc: "TFT-powered health forecasting: sleep, recovery, and mood predictions 24 hours ahead.",
    color: "#4ade80",
  },
  {
    icon: "◌",
    title: "Guided Breathing",
    desc: "Adaptive breathing patterns that respond to your current stress index. Calm in 60 seconds.",
    color: "#818cf8",
  },
];

function FeatureStrip({ onEnterApp }) {
  return (
    <section style={{
      padding: "100px 80px",
      background: "#030308",
      borderTop: "1px solid rgba(255,255,255,0.05)",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 64 }}>
        <div style={{
          fontSize: 9, letterSpacing: 4, color: "#60a5fa",
          fontFamily: "var(--font-mono), monospace", fontWeight: 500,
          marginBottom: 16,
        }}>
          ◎ PLATFORM CAPABILITIES
        </div>
        <h2 style={{
          fontSize: "clamp(32px, 4vw, 56px)",
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800, letterSpacing: -1, color: "rgba(255,255,255,0.9)",
          marginBottom: 16,
        }}>
          Everything your health needs.
        </h2>
        <p style={{
          fontSize: 12, color: "rgba(255,255,255,0.35)", maxWidth: 480,
          margin: "0 auto", lineHeight: 1.8,
          fontFamily: "var(--font-mono), monospace",
        }}>
          A unified platform built on three specialized AI models,
          designed for privacy-first intelligent healthcare.
        </p>
      </div>

      {/* Cards grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 20,
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
            padding: "14px 44px",
            background: "linear-gradient(135deg, rgba(96,165,250,0.2), rgba(167,139,250,0.2))",
            border: "1px solid rgba(96,165,250,0.35)", borderRadius: 8,
            color: "#60a5fa",
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10, letterSpacing: 3, fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "linear-gradient(135deg, rgba(96,165,250,0.3), rgba(167,139,250,0.3))";
            e.currentTarget.style.boxShadow = "0 0 30px rgba(96,165,250,0.3)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "linear-gradient(135deg, rgba(96,165,250,0.2), rgba(167,139,250,0.2))";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          START YOUR HEALTH JOURNEY →
        </button>
        <div style={{
          fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 16, letterSpacing: 2,
          fontFamily: "var(--font-mono), monospace",
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
        padding: "28px 24px",
        background: hov ? `rgba(${color === "#60a5fa" ? "96,165,250" : color === "#a78bfa" ? "167,139,250" : color === "#4ade80" ? "74,222,128" : "129,140,248"},0.06)` : "rgba(255,255,255,0.025)",
        border: hov ? `1px solid ${color}44` : "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        transform: hov ? "translateY(-4px)" : "none",
        boxShadow: hov ? `0 8px 32px ${color}22` : "none",
        backdropFilter: "blur(8px)",
        transition: "all 0.25s ease",
        cursor: "default",
      }}
    >
      {/* Icon orb */}
      <div style={{
        width: 42, height: 42, borderRadius: 10,
        background: `linear-gradient(135deg, ${color}20, ${color}10)`,
        border: `1px solid ${color}30`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, color: color, marginBottom: 20,
      }}>
        {icon}
      </div>
      <h3 style={{
        fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.88)", marginBottom: 10,
        fontFamily: "'Syne', sans-serif", letterSpacing: 0.2,
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.8,
        fontFamily: "var(--font-mono), monospace",
      }}>
        {desc}
      </p>
    </div>
  );
}


