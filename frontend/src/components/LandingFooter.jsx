import { useState } from "react";

const LINKS = {
  Platform: ["Features", "Pricing", "Changelog", "Roadmap"],
  Health:   ["AI Models", "Privacy Policy", "Data Security", "HIPAA"],
  Docs:     ["Quick Start", "API Reference", "GitHub", "Community"],
  Company:  ["About", "Careers", "Press", "Contact"],
};

export default function LandingFooter({ onEnterApp }) {
  return (
    <footer style={{
      background: "#030308",
      color: "rgba(255,255,255,0.3)",
      fontFamily: "'DM Mono', monospace",
      padding: "64px 80px 40px",
      borderTop: "1px solid rgba(255,255,255,0.06)",
    }}>
      {/* Top row: logo + tagline + cta */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        marginBottom: 56,
        flexWrap: "wrap", gap: 32,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(96,165,250,0.25), rgba(167,139,250,0.25))",
              border: "1px solid rgba(96,165,250,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 16px rgba(96,165,250,0.25)",
            }}>
              <span style={{ color: "#60a5fa", fontSize: 15, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>N</span>
            </div>
            <span style={{
              fontSize: 20, fontWeight: 800, color: "rgba(255,255,255,0.88)", letterSpacing: -0.5,
              fontFamily: "'Syne', sans-serif",
            }}>NeoPulse</span>
          </div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", maxWidth: 280, lineHeight: 1.8 }}>
            Your intelligent health companion. Private, powerful, and beautifully designed.
          </p>
        </div>
        <button
          onClick={onEnterApp}
          style={{
            padding: "11px 30px",
            background: "linear-gradient(135deg, rgba(96,165,250,0.18), rgba(167,139,250,0.18))",
            border: "1px solid rgba(96,165,250,0.35)", borderRadius: 8,
            color: "#60a5fa",
            fontFamily: "'DM Mono', monospace",
            fontSize: 9, letterSpacing: 3, fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = "0 0 24px rgba(96,165,250,0.3)";
            e.currentTarget.style.background = "linear-gradient(135deg, rgba(96,165,250,0.28), rgba(167,139,250,0.28))";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.background = "linear-gradient(135deg, rgba(96,165,250,0.18), rgba(167,139,250,0.18))";
          }}
        >
          LAUNCH APP →
        </button>
      </div>

      {/* Link columns */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 32,
        marginBottom: 56,
        borderTop: "1px solid rgba(255,255,255,0.06)",
        paddingTop: 40,
      }}>
        {Object.entries(LINKS).map(([heading, links]) => (
          <div key={heading}>
            <div style={{
              fontSize: 8, letterSpacing: 3, color: "#60a5fa",
              fontFamily: "'DM Mono', monospace", fontWeight: 500,
              marginBottom: 18,
            }}>
              {heading.toUpperCase()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {links.map(link => (
                <FooterLink key={link} text={link} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        paddingTop: 24,
        display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 12,
      }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
          © 2025 NeoPulse. Built with ♥ for your wellbeing.
        </span>
        <div style={{ display: "flex", gap: 20 }}>
          {["Privacy", "Terms", "Cookies"].map(item => (
            <FooterLink key={item} text={item} small />
          ))}
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ text, small }) {
  const [hov, setHov] = useState(false);

  return (
    <a
      href="#"
      onClick={e => e.preventDefault()}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        fontSize: small ? 9 : 11, color: hov ? "#60a5fa" : "rgba(255,255,255,0.25)",
        textDecoration: "none", letterSpacing: 0.5,
        transition: "color 0.2s",
        fontFamily: "'DM Mono', monospace",
      }}
    >
      {text}
    </a>
  );
}

