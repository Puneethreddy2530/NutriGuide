import { useState, useEffect } from "react";

const CAROUSEL_ITEMS = [
  { id: "fitness",     label: "FITNESS" },
  { id: "medicines",   label: "MEDICINES" },
  { id: "mood",        label: "MOOD" },
  { id: "consistency", label: "CONSISTENCY" },
];

export default function LandingNavbar({ activeCarouselItem, onCarouselSwitch, onEnterApp }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      padding: "0 40px",
      height: 60,
      background: scrolled
        ? "rgba(3,3,8,0.95)"
        : "rgba(3,3,8,0.0)",
      backdropFilter: scrolled ? "blur(20px)" : "none",
      borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      transition: "background 0.35s ease, backdrop-filter 0.35s ease, border 0.35s ease",
      fontFamily: "'DM Mono', monospace",
    }}>
      {/* Logo */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
      }} onClick={() => onCarouselSwitch?.(null)}>
        <div style={{
          width: 30, height: 30, borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(96,165,250,0.3), rgba(167,139,250,0.3))",
          border: "1px solid rgba(96,165,250,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 16px rgba(96,165,250,0.3)",
        }}>
          <span style={{ color: "#60a5fa", fontSize: 13, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>N</span>
        </div>
        <span style={{
          fontSize: 16, fontWeight: 800, letterSpacing: 0.5, color: "rgba(255,255,255,0.9)",
          fontFamily: "'Syne', sans-serif",
        }}>NeoPulse</span>
      </div>

      {/* Image switcher buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {CAROUSEL_ITEMS.map(item => {
          const isActive = activeCarouselItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onCarouselSwitch?.(item.id)}
              style={{
                background: isActive ? "rgba(96,165,250,0.1)" : "none",
                border: "none",
                cursor: "pointer",
                padding: "7px 16px",
                borderRadius: 20,
                fontSize: 9,
                letterSpacing: 3,
                fontWeight: isActive ? 500 : 400,
                fontFamily: "'DM Mono', monospace",
                color: isActive ? "#60a5fa" : "rgba(255,255,255,0.3)",
                transition: "color 0.2s, background 0.2s",
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.color = "rgba(255,255,255,0.6)";
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.color = "rgba(255,255,255,0.3)";
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* CTA */}
      <button
        onClick={onEnterApp}
        style={{
          padding: "9px 24px",
          background: "linear-gradient(135deg, rgba(96,165,250,0.2), rgba(167,139,250,0.2))",
          border: "1px solid rgba(96,165,250,0.35)", borderRadius: 8,
          color: "#60a5fa", fontFamily: "'DM Mono', monospace",
          fontSize: 9, letterSpacing: 3, fontWeight: 500,
          cursor: "pointer",
          transition: "all 0.2s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "linear-gradient(135deg, rgba(96,165,250,0.3), rgba(167,139,250,0.3))";
          e.currentTarget.style.boxShadow = "0 0 20px rgba(96,165,250,0.25)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "linear-gradient(135deg, rgba(96,165,250,0.2), rgba(167,139,250,0.2))";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        ENTER APP →
      </button>
    </nav>
  );
}