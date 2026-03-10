import { useState } from "react";
import LandingNavbar from "./LandingNavbar";
import HeroScene from "./HeroScene";
import LandingFooter from "./LandingFooter";

// Google Fonts injection -- NutriGuide theme fonts (Lemon Milk loaded via @font-face in index.css)
const FONTS =
  "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400;500&display=swap');"

export default function LandingPage({ onEnterApp }) {
  const [activeCarouselItem, setActiveCarouselItem] = useState("tray-vision");

  return (
    <div style={{
      background: "var(--bg)",
      minHeight: "100vh",
      fontFamily: "'Inter', sans-serif",
      overflowX: "hidden",
    }}>
      <style>{FONTS}</style>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { overflow-x: hidden; }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb {
          background: rgba(8,145,178,0.25);
          border-radius: 2px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(8,145,178,0.45);
        }
      `}</style>

      <LandingNavbar
        activeCarouselItem={activeCarouselItem}
        onCarouselSwitch={setActiveCarouselItem}
        onEnterApp={onEnterApp}
      />

      <HeroScene
        onEnterApp={onEnterApp}
        activeCarouselItem={activeCarouselItem}
        onCarouselChange={setActiveCarouselItem}
      />

      <FeatureStrip onEnterApp={onEnterApp} />

      <LandingFooter onEnterApp={onEnterApp} />
    </div>
  );
}

// -- Feature strips ---------------------------------------------------------
const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
      </svg>
    ),
    title: "AI Tray Auditing",
    desc: "EfficientNet + Gemini Vision estimates plate waste per patient, per meal -- zero manual entry. Real-time ward-level compliance, fully automated.",
    color: "#60a5fa",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M5 8v2a7 7 0 0 0 7 7"/><path d="M19 8v2a7 7 0 0 1-7 7"/><line x1="12" y1="4" x2="12" y2="16"/>
      </svg>
    ),
    title: "Drug-Food Conflict Graph",
    desc: "BioBERT GNN maps 1,200+ drug-nutrient interactions against each patient's live prescription and meal plan. Conflicts surfaced the instant they arise.",
    color: "#a78bfa",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    title: "Predictive Compliance AI",
    desc: "TFT-powered temporal forecasting alerts your dietitian team 24 hours before meal adherence drops -- stopping clinical deterioration before it starts.",
    color: "#4ade80",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: "PQC-Signed Clinical RAG",
    desc: "Every AI dietary recommendation is cryptographically signed with FIPS 204 Dilithium3 post-quantum signatures. Audit-ready for the next decade.",
    color: "#818cf8",
  },
];

function FeatureStrip({ onEnterApp }) {
  return (
    <section style={{
      padding: "100px 80px",
      background: "var(--bg2)",
      borderTop: "1px solid rgba(0,0,0,0.07)",
    }}>
      <div style={{ textAlign: "center", marginBottom: 64 }}>
        <div style={{
          fontSize: 9, letterSpacing: 4, color: "var(--accent)",
          fontFamily: "var(--font-mono), monospace", fontWeight: 500,
          marginBottom: 16,
        }}>
          PLATFORM CAPABILITIES
        </div>
        <h2 style={{
          fontSize: "clamp(32px, 4vw, 56px)",
          fontFamily: "'LEMONMILK', sans-serif",
          fontWeight: 800, letterSpacing: -1, color: "var(--text)",
          marginBottom: 16,
        }}>
          Everything your hospital needs.
        </h2>
        <p style={{
          fontSize: 12, color: "var(--text2)", maxWidth: 480,
          margin: "0 auto", lineHeight: 1.8,
          fontFamily: "var(--font-mono), monospace",
        }}>
          Four specialized AI models. One unified clinical nutrition platform.
          Built for India's frontline dietitians -- in 9 regional languages.
        </p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 20,
      }}>
        {FEATURES.map(f => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </div>

      <div style={{ textAlign: "center", marginTop: 64 }}>
        <button
          onClick={onEnterApp}
          style={{
            padding: "14px 44px",
            background: "linear-gradient(135deg, rgba(8,145,178,0.12), rgba(124,58,237,0.12))",
            border: "1px solid rgba(8,145,178,0.35)", borderRadius: 8,
            color: "var(--accent)",
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10, letterSpacing: 3, fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "linear-gradient(135deg, rgba(8,145,178,0.2), rgba(124,58,237,0.2))";
            e.currentTarget.style.boxShadow = "0 0 30px rgba(8,145,178,0.2)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "linear-gradient(135deg, rgba(8,145,178,0.12), rgba(124,58,237,0.12))";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          ENTER COMMAND CENTER
        </button>
        <div style={{
          fontSize: 9, color: "var(--text3)", marginTop: 16, letterSpacing: 2,
          fontFamily: "var(--font-mono), monospace",
        }}>
          GKM Hospital - Clinical Dietitian Interface - 9 Indian Languages
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
        background: hov ? `${color}08` : "rgba(0,0,0,0.02)",
        border: hov ? `1px solid ${color}44` : "1px solid rgba(0,0,0,0.07)",
        borderRadius: 16,
        transform: hov ? "translateY(-4px)" : "none",
        boxShadow: hov ? `0 12px 40px ${color}18` : "none",
        transition: "all 0.25s ease",
        cursor: "default",
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: `${color}14`,
        border: `1px solid ${color}28`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: color, marginBottom: 20,
      }}>
        {icon}
      </div>
      <h3 style={{
        fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 10,
        fontFamily: "'LEMONMILK', sans-serif", letterSpacing: 0.2,
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: 11, color: "var(--text2)", lineHeight: 1.8,
        fontFamily: "var(--font-mono), monospace",
      }}>
        {desc}
      </p>
    </div>
  );
}
