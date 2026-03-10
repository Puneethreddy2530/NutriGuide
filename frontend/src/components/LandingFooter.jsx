import { useState } from "react";

const LINKS = {
  Platform: ["Command Center", "Tray Vision", "Drug-Food Graph", "PQC Security"],
  Clinical: ["Meal Plans", "Compliance AI", "Patient Tracking", "Signed RAG"],
  Ops:      ["Kitchen Analytics", "WhatsApp Bot", "Reports", "AI Models"],
  Hospital: ["GKM Hospital", "Dietitian Login", "Nurse View", "Contact"],
};

export default function LandingFooter({ onEnterApp }) {
  return (
    <footer style={{
      background: "var(--bg3-solid)",
      color: "var(--text2)",
      fontFamily: "'DM Mono', monospace",
      padding: "64px 80px 40px",
      borderTop: "1px solid rgba(0,0,0,0.07)",
    }}>
      {/* Top row: logo + tagline + cta */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        marginBottom: 56,
        flexWrap: "wrap", gap: 32,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <img src="/Final.jpg" alt="NutriGuide" style={{
              width: 36, height: 36, borderRadius: "50%",
              objectFit: "cover",
              boxShadow: "0 0 16px rgba(96,165,250,0.25)",
              border: "1px solid rgba(96,165,250,0.4)",
            }} />
            <span style={{
              fontSize: 20, fontWeight: 800, color: "var(--text)", letterSpacing: -0.5,
              fontFamily: "'LEMONMILK', sans-serif",
            }}>NutriGuide</span>
          </div>
          <p style={{ fontSize: 11, color: "var(--text2)", maxWidth: 280, lineHeight: 1.8 }}>
            Clinical nutrition intelligence for GKM Hospital's frontline dietitian teams.
          </p>
        </div>
        <button
          onClick={onEnterApp}
          style={{
            padding: "11px 30px",
            background: "linear-gradient(135deg, rgba(8,145,178,0.12), rgba(124,58,237,0.12))",
            border: "1px solid rgba(8,145,178,0.35)", borderRadius: 8,
            color: "var(--accent)",
            fontFamily: "'DM Mono', monospace",
            fontSize: 9, letterSpacing: 3, fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = "0 0 24px rgba(8,145,178,0.2)";
            e.currentTarget.style.background = "linear-gradient(135deg, rgba(8,145,178,0.2), rgba(124,58,237,0.2))";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.background = "linear-gradient(135deg, rgba(8,145,178,0.12), rgba(124,58,237,0.12))";
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
        borderTop: "1px solid rgba(0,0,0,0.07)",
        paddingTop: 40,
      }}>
        {Object.entries(LINKS).map(([heading, links]) => (
          <div key={heading}>
            <div style={{
              fontSize: 8, letterSpacing: 3, color: "var(--accent)",
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
        borderTop: "1px solid rgba(0,0,0,0.07)",
        paddingTop: 24,
        display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 12,
      }}>
        <span style={{ fontSize: 10, color: "var(--text3)" }}>
          © 2025 NutriGuide · GKM Hospital. Built for India's frontline dietitians.
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
        fontSize: small ? 9 : 11, color: hov ? "var(--accent)" : "var(--text3)",
        textDecoration: "none", letterSpacing: 0.5,
        transition: "color 0.2s",
        fontFamily: "'DM Mono', monospace",
      }}
    >
      {text}
    </a>
  );
}

