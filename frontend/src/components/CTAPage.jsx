import { useState, useEffect } from "react";

const FONTS = "@import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap');";

const FEATURES = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
      </svg>
    ),
    title: "Real-time Emotion AI",
    desc: "EfficientNet reads 7 emotions from your webcam. Stress detected. Help dispatched instantly.",
    color: "#60a5fa",
    stat: "94%", statLabel: "accuracy",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
      </svg>
    ),
    title: "Predictive Health Timeline",
    desc: "TFT model forecasts your sleep, recovery and mood up to 24 hours ahead.",
    color: "#3b82f6",
    stat: "24h", statLabel: "ahead",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    title: "Drug Interaction GNN",
    desc: "GraphSAGE neural network flags dangerous polypharmacy combinations in real time.",
    color: "#C2410C",
    stat: "0.86", statLabel: "AUC score",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: "Post-Quantum Encryption",
    desc: "CRYSTALS-Kyber / Dilithium shields your most private health data from quantum attacks.",
    color: "#7C3AED",
    stat: "PQC", statLabel: "level 3",
  },
];

const STEPS = [
  { num: "01", title: "Create your account", desc: "Register in under 30 seconds. No credit card, no data harvesting." },
  { num: "02", title: "Set up your profile", desc: "Add medications, health goals and preferred language. Takes 2 minutes." },
  { num: "03", title: "Start with MindScan", desc: "Open your camera. Get your first emotion + stress reading instantly." },
  { num: "04", title: "Build your health story", desc: "Journal, log meds, track workouts. The timeline fills itself." },
];

export default function CTAPage({ onGetStarted, onBack }) {
  const [hovered, setHovered] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = document.getElementById("cta-scroll-root");
    const onScroll = () => el && setScrolled(el.scrollTop > 40);
    el?.addEventListener("scroll", onScroll, { passive: true });
    return () => el?.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div id="cta-scroll-root" style={{
      minHeight: "100vh",
      background: "var(--bg)",
      overflowY: "auto",
      fontFamily: "'DM Mono', monospace",
    }}>
      <style>{FONTS}</style>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:none; } }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(96,165,250,0.3); border-radius: 2px; }
        .cta-card:hover { transform: translateY(-4px) !important; box-shadow: 0 16px 48px rgba(96,165,250,0.12) !important; }
        .step-card:hover { border-color: rgba(249,115,22,0.4) !important; }
      `}</style>

      {/* ── Sticky mini-header ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        padding: "0 40px", height: 56,
        background: scrolled ? "rgba(250,250,249,0.95)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(0,0,0,0.07)" : "none",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        transition: "all 0.3s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%",
            background: "linear-gradient(135deg, #F97316, #EA580C)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, color: "#fff", fontWeight: 700,
          }}>N</div>
          <span style={{ fontFamily: "'LEMONMILK', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>NeoPulse</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onBack} style={{
            padding: "7px 16px", background: "transparent",
            border: "1px solid rgba(0,0,0,0.1)", borderRadius: 20,
            fontSize: 11, letterSpacing: 1, cursor: "pointer", color: "var(--text2)",
          }}>← BACK</button>
          <button onClick={onGetStarted} style={{
            padding: "7px 18px", background: "linear-gradient(135deg, #F97316, #EA580C)",
            border: "none", borderRadius: 20, color: "#fff",
            fontSize: 11, letterSpacing: 1.5, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 3px 14px rgba(249,115,22,0.35)",
          }}>GET STARTED →</button>
        </div>
      </div>

      {/* ── Hero CTA ── */}
      <section style={{
        padding: "90px 80px 80px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Background glow orbs */}
        <div style={{
          position: "absolute", width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(96,165,250,0.08) 0%, transparent 70%)",
          top: "50%", left: "50%", transform: "translate(-50%,-55%)", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(234,88,12,0.06) 0%, transparent 70%)",
          top: "20%", left: "15%", pointerEvents: "none",
        }} />

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 14px", borderRadius: 20,
          background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)",
          fontSize: 10, letterSpacing: 2.5, color: "#60a5fa", fontWeight: 700,
          marginBottom: 28, animation: "fadeUp 0.5s ease",
        }}>
          ◈ YOUR PERSONAL HEALTH INTELLIGENCE PLATFORM
        </div>

        <h1 style={{
          fontFamily: "'LEMONMILK', sans-serif",
          fontSize: "clamp(44px, 6vw, 74px)",
          fontWeight: 700,
          color: "var(--text)",
          letterSpacing: 1,
          lineHeight: 1.06,
          marginBottom: 22,
          animation: "fadeUp 0.55s ease 0.05s both",
        }}>
          Your health, <br />
          <span style={{ color: "var(--accent)", fontStyle: "italic" }}>understood deeply.</span>
        </h1>

        <p style={{
          fontSize: 18, color: "var(--text2)", lineHeight: 1.7,
          maxWidth: 560, margin: "0 auto 44px",
          animation: "fadeUp 0.55s ease 0.1s both",
        }}>
          AI models trained on real clinical data. Post-quantum encrypted. Entirely private.
          NeoPulse turns your daily data into a living health story — and acts on it.
        </p>

        <div style={{
          display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap",
          animation: "fadeUp 0.55s ease 0.15s both",
        }}>
          <button onClick={onGetStarted} style={{
            padding: "17px 44px",
            background: "linear-gradient(135deg, #F97316, #EA580C)",
            border: "none", borderRadius: 50,
            color: "#fff", fontSize: 15, fontWeight: 700,
            letterSpacing: 1.5, cursor: "pointer",
            boxShadow: "0 8px 36px rgba(249,115,22,0.38)",
            transition: "transform 0.15s, box-shadow 0.15s",
            animation: "float 4s ease infinite",
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 44px rgba(249,115,22,0.5)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 8px 36px rgba(249,115,22,0.38)"; }}
          >
            START YOUR JOURNEY →
          </button>
          <button onClick={onBack} style={{
            padding: "17px 36px", background: "transparent",
            border: "1.5px solid rgba(0,0,0,0.12)", borderRadius: 50,
            color: "rgba(0,0,0,0.55)", fontSize: 14, cursor: "pointer",
            transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.12)"; e.currentTarget.style.color = "rgba(0,0,0,0.55)"; }}
          >
            â† BACK TO HOME
          </button>
        </div>

        {/* Trust bar */}
        <div style={{
          display: "flex", gap: 28, justifyContent: "center", marginTop: 52,
          animation: "fadeUp 0.55s ease 0.2s both",
          flexWrap: "wrap",
        }}>
          {[
            { icon: "◈", text: "Post-Quantum Encrypted" },
            { icon: "◎", text: "3 Clinical AI Models" },
            { icon: "▷", text: "Real-time on device" },
            { icon: "⊕", text: "11 Languages" },
          ].map(t => (
            <div key={t.text} style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 11, color: "var(--text3)", letterSpacing: 0.5,
            }}>
              <span>{t.icon}</span> {t.text}
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section style={{ padding: "40px 80px 80px", background: "#fff", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#60a5fa", fontWeight: 700, marginBottom: 14 }}>
            WHAT'S INSIDE
          </div>
          <h2 style={{
            fontFamily: "'LEMONMILK', sans-serif", fontSize: 38, fontWeight: 800,
            color: "var(--text)", letterSpacing: -1, lineHeight: 1.15,
          }}>
            Engineered for your wellbeing
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
          {FEATURES.map((f, i) => (
            <div key={i} className="cta-card"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: "var(--bg2)",
                border: `1.5px solid ${hovered === i ? f.color + "40" : "rgba(0,0,0,0.07)"}`,
                borderRadius: 18, padding: "26px 24px",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                animation: `fadeUp 0.5s ease ${i * 0.08}s both`,
              }}>
              <div style={{ color: f.color, marginBottom: 16 }}>{f.icon}</div>
              <div style={{
                fontSize: 10, letterSpacing: 2, fontWeight: 700,
                color: f.color, marginBottom: 8,
              }}>
                {f.stat} · {f.statLabel.toUpperCase()}
              </div>
              <h3 style={{
                fontSize: 16, fontWeight: 700, color: "var(--text)",
                marginBottom: 8, letterSpacing: -0.3,
              }}>{f.title}</h3>
              <p style={{ fontSize: 12, color: "rgba(0,0,0,0.48)", lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: "80px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#60a5fa", fontWeight: 700, marginBottom: 14 }}>
            GET STARTED IN MINUTES
          </div>
          <h2 style={{
            fontFamily: "'LEMONMILK', sans-serif", fontSize: 38, fontWeight: 800,
            color: "var(--text)", letterSpacing: -1,
          }}>4 steps to better health</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, maxWidth: 900, margin: "0 auto" }}>
          {STEPS.map((s, i) => (
            <div key={i} className="step-card" style={{
              padding: "24px 20px",
              border: "1.5px solid rgba(0,0,0,0.07)",
              borderRadius: 16, background: "#fff",
              transition: "border-color 0.2s",
              animation: `fadeUp 0.5s ease ${i * 0.1}s both`,
            }}>
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: 32, fontWeight: 700,
                color: "rgba(249,115,22,0.18)", lineHeight: 1, marginBottom: 16,
              }}>{s.num}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 7 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.65 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section style={{
        padding: "80px",
        background: "linear-gradient(135deg, var(--bg2) 0%, var(--bg3-solid) 100%)",
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "'LEMONMILK', sans-serif",
          fontSize: "clamp(32px, 4vw, 52px)",
          fontWeight: 900, color: "var(--text)",
          letterSpacing: -1.5, marginBottom: 20, lineHeight: 1.1,
        }}>
          Ready to understand <br />
          <span style={{ color: "var(--accent)", fontStyle: "italic" }}>your own health?</span>
        </div>
        <p style={{
          fontSize: 15, color: "var(--text2)",
          marginBottom: 38, lineHeight: 1.7,
        }}>
          Join thousands taking control. Private. Powerful. Personal.
        </p>
        <button onClick={onGetStarted} style={{
          padding: "18px 56px",
          background: "linear-gradient(135deg, #F97316, #EA580C)",
          border: "none", borderRadius: 50,
          color: "#fff", fontSize: 15, fontWeight: 700,
          letterSpacing: 2, cursor: "pointer",
          boxShadow: "0 8px 40px rgba(249,115,22,0.45)",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 14px 52px rgba(249,115,22,0.6)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 8px 40px rgba(249,115,22,0.45)"; }}
        >
          CREATE FREE ACCOUNT →
        </button>
      </section>
    </div>
  );
}

