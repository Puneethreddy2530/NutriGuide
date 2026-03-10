import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import CarouselOrbit from "./CarouselOrbit";

gsap.registerPlugin(ScrollTrigger);

// ── Section data ───────────────────────────────────────────────────────
const SECTIONS = [
  {
    id: "tray-vision",
    eyebrow: "AI TRAY AUDITING",
    title: "Zero-Click\nMeal\nAuditing.",
    description:
      "EfficientNet + Gemini Vision identifies food on every tray and estimates consumption automatically. No manual logging. No missed meals.",
    ctaLabel: "SEE TRAY VISION",
    color: "#60a5fa",
  },
  {
    id: "drug-food",
    eyebrow: "DRUG-FOOD CONFLICT GNN",
    title: "Silent\nGuardian\nAgainst Conflicts.",
    description:
      "BioBERT-powered Graph Neural Network maps polypharmacy risks against each patient's diet in milliseconds. Every meal, every prescription — protected.",
    ctaLabel: "VIEW INTERACTIONS",
    color: "#a78bfa",
  },
  {
    id: "compliance",
    eyebrow: "COMPLIANCE INTELLIGENCE",
    title: "Predict\nBefore\nIt Drops.",
    description:
      "TFT-powered temporal forecasting alerts your dietitian team 24 hours before a patient's meal adherence deteriorates. Intervene early. Every time.",
    ctaLabel: "OPEN DASHBOARD",
    color: "#4ade80",
  },
  {
    id: "rag-pqc",
    eyebrow: "POST-QUANTUM SIGNED RAG",
    title: "Evidence\nYou Can\nTrust.",
    description:
      "Every clinical AI recommendation is cryptographically signed with FIPS 204 Dilithium3. Fully audit-ready. Quantum-resistant. Always verifiable.",
    ctaLabel: "EXPLORE RAG + PQC",
    color: "#818cf8",
  },
];

// ── Hero intro slide ───────────────────────────────────────────────────
function HeroIntro({ onEnterApp }) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", alignItems: "center",
      padding: "0 8vw",
    }}>
      <div>
        <div style={{
          fontSize: 9, letterSpacing: 4, color: "#60a5fa",
          fontFamily: "'DM Mono', monospace", fontWeight: 500,
          marginBottom: 20,
        }}>
          CLINICAL NUTRITION AI · GKM HOSPITAL
        </div>
        <h1 style={{
          fontSize: "clamp(44px, 6vw, 88px)",
          fontFamily: "'LEMONMILK', sans-serif",
          fontWeight: 700,
          lineHeight: 0.95,
          color: "var(--text)",
          letterSpacing: 1,
          marginBottom: 28,
        }}>
          CLINICAL NUTRITION,<br />
          <span style={{ color: "var(--accent)" }}>REIMAGINED.</span>
        </h1>
        <p style={{
          fontSize: 12, color: "var(--text2)", maxWidth: 440, lineHeight: 1.8,
          fontFamily: "'DM Mono', monospace", marginBottom: 40,
        }}>
          AI tray auditing. Drug-food conflict detection. Predictive compliance.
          PQC-signed clinical guidance. Built for India's frontline dietitians.
        </p>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button
            onClick={onEnterApp}
            style={{
              padding: "13px 34px",
              background: "linear-gradient(135deg, rgba(8,145,178,0.15), rgba(124,58,237,0.15))",
              border: "1px solid rgba(8,145,178,0.4)", borderRadius: 8,
              color: "var(--accent)",
              fontFamily: "'DM Mono', monospace",
              fontSize: 10, letterSpacing: 3, fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: "0 0 20px rgba(8,145,178,0.1)",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "linear-gradient(135deg, rgba(8,145,178,0.25), rgba(124,58,237,0.25))";
              e.currentTarget.style.boxShadow = "0 0 32px rgba(8,145,178,0.25)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "linear-gradient(135deg, rgba(8,145,178,0.15), rgba(124,58,237,0.15))";
              e.currentTarget.style.boxShadow = "0 0 20px rgba(8,145,178,0.1)";
            }}
          >
            ENTER COMMAND CENTER
          </button>
          <span style={{
            fontSize: 10, color: "var(--text3)", letterSpacing: 2,
            fontFamily: "'DM Mono', monospace",
          }}>
            Scroll to explore
          </span>
        </div>
        {/* Stats row */}
        <div style={{ display: "flex", gap: 32, marginTop: 56 }}>
          {[
            { v: "4",        l: "AI MODELS" },
            { v: "9",        l: "LANGUAGES" },
            { v: "FIPS 204", l: "PQC SIGNED" },
          ].map(s => (
            <div key={s.l}>
              <div style={{
                fontSize: s.v.length > 2 ? 18 : 32, fontWeight: 800,
                color: "var(--text)",
                fontFamily: "'JetBrains Mono', monospace", letterSpacing: -1,
              }}>{s.v}</div>
              <div style={{
                fontSize: 8, color: "var(--text3)", letterSpacing: 2, marginTop: 2,
                fontFamily: "'DM Mono', monospace",
              }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main HeroScene ─────────────────────────────────────────────────────
export default function HeroScene({
  onEnterApp,
  onSectionChange,
  activeCarouselItem,
  onCarouselChange,
}) {
  const wrapperRef    = useRef(null);
  const stickyRef     = useRef(null);
  const leftRefs      = useRef([]);
  const rightPanelRef = useRef(null);       // ← for carousel scaling
  const [activeSection, setActiveSection] = useState(-1);
  const [carouselScale, setCarouselScale] = useState(1);

  // Measure right-panel width and compute scale so the 430px orbit always fits
  useEffect(() => {
    const el = rightPanelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      const rawScale = Math.min(1, (w - 24) / 430);
      setCarouselScale(Math.max(0.5, rawScale));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrapperRef.current,
          pin: stickyRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 1.5,
          snap: {
            snapTo: 1 / 4,
            duration: { min: 0.3, max: 0.7 },
            ease: "power2.inOut",
          },
          onUpdate: (self) => {
            const idx = Math.round(self.progress * 4) - 1;
            setActiveSection(idx);
            const sectionId = idx >= 0 ? SECTIONS[idx]?.id : null;
            onSectionChange?.(sectionId);
            if (sectionId) onCarouselChange?.(sectionId);
          },
        },
      });

      SECTIONS.forEach((_, i) => {
        const L = leftRefs.current[i];
        if (!L) return;
        gsap.set(L, { opacity: 0, y: 40 });
        tl.to(L, { opacity: 1, y: 0, duration: 1 }, i);
        if (i < SECTIONS.length - 1) {
          tl.to(L, { opacity: 0, y: -30, duration: 0.6 }, i + 0.7);
        }
      });
    }, wrapperRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={wrapperRef} style={{ height: "500vh", position: "relative" }}>
      {/* Sticky stage */}
      <div ref={stickyRef} style={{
        position: "sticky", top: 0, height: "100vh",
        overflow: "hidden",
        background: "var(--bg)",
      }}>
        {/* Ambient background */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          <div style={{
            position: "absolute", right: -80, top: -80,
            width: 600, height: 600, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(96,165,250,0.07) 0%, transparent 70%)",
          }} />
          <div style={{
            position: "absolute", left: -40, bottom: -40,
            width: 400, height: 400, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(167,139,250,0.05) 0%, transparent 70%)",
          }} />
        </div>

        {/* Split layout */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          height: "100%",
          overflow: "hidden",
        }}>

          {/* ── LEFT PANEL ── */}
          <div style={{ position: "relative", paddingTop: 60 }}>
            {/* Hero intro */}
            <div style={{
              position: "absolute", inset: 0,
              opacity: activeSection === -1 ? 1 : 0,
              transition: "opacity 0.6s ease",
              pointerEvents: activeSection === -1 ? "auto" : "none",
            }}>
              <HeroIntro onEnterApp={onEnterApp} />
            </div>

            {/* Section text panels */}
            {SECTIONS.map((sec, i) => (
              <div
                key={sec.id}
                ref={el => (leftRefs.current[i] = el)}
                style={{
                  position: "absolute", inset: 0,
                  display: "flex", flexDirection: "column",
                  justifyContent: "center",
                  padding: "0 8vw",
                  pointerEvents: activeSection === i ? "auto" : "none",
                }}
              >
                <div style={{
                  fontSize: 9, letterSpacing: 3, color: sec.color,
                  fontFamily: "'DM Mono', monospace", fontWeight: 500,
                  marginBottom: 16,
                }}>
                  ◎ {sec.eyebrow}
                </div>
                <h2 style={{
                  fontSize: "clamp(38px, 5vw, 72px)",
                  fontFamily: "'LEMONMILK', sans-serif",
                  fontWeight: 700, lineHeight: 0.95,
                  color: "var(--text)", letterSpacing: 0.5,
                  marginBottom: 24, whiteSpace: "pre-line",
                }}>
                  {sec.title}
                </h2>
                <p style={{
                  fontSize: 12, color: "var(--text2)", maxWidth: 400, lineHeight: 1.8,
                  fontFamily: "'DM Mono', monospace", marginBottom: 32,
                }}>
                  {sec.description}
                </p>
                <button
                  onClick={onEnterApp}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "11px 26px", width: "fit-content",
                    background: "none", border: `1px solid ${sec.color}60`,
                    borderRadius: 8, color: sec.color,
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 9, letterSpacing: 3, fontWeight: 500,
                    cursor: "pointer", transition: "background 0.2s, box-shadow 0.2s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = `${sec.color}14`;
                    e.currentTarget.style.boxShadow = `0 0 20px ${sec.color}30`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "none";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {sec.ctaLabel} →
                </button>
                {/* Step dots */}
                <div style={{ display: "flex", gap: 8, marginTop: 48, alignItems: "center" }}>
                  {SECTIONS.map((_, j) => (
                    <div key={j} style={{
                      width: j === i ? 24 : 6, height: 4, borderRadius: 2,
                      background: j === i ? sec.color : "rgba(0,0,0,0.12)",
                      transition: "width 0.3s, background 0.3s",
                    }} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ── RIGHT PANEL — Carousel only ── */}
          <div
            ref={rightPanelRef}
            style={{
              position: "relative",
              overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
              paddingTop: 60,
              minWidth: 0,
            }}
          >
            {/* scale-to-fit wrapper — keeps orbit fully visible on all screen sizes */}
            <div style={{
              transformOrigin: "center top",
              transform: `scale(${carouselScale})`,
              flexShrink: 0,
            }}>
              <CarouselOrbit
                activeId={activeCarouselItem}
                onItemClick={onCarouselChange}
                autoRotate={activeSection === -1}
              />
            </div>
          </div>

        </div>

        <ScrollProgressLine />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.12); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Scroll progress bar ────────────────────────────────────────────────
function ScrollProgressLine() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const el = document.documentElement;
      const scrollTop = window.scrollY;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      setProgress(scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0);
    };
    window.addEventListener("scroll", updateProgress, { passive: true });
    return () => window.removeEventListener("scroll", updateProgress);
  }, []);

  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0,
      height: 2, background: "rgba(0,0,0,0.07)",
    }}>
      <div style={{
        height: "100%", width: `${progress}%`,
        background: "linear-gradient(90deg, #60a5fa, #a78bfa)",
        transition: "width 0.05s linear",
        borderRadius: "0 2px 2px 0",
        boxShadow: "0 0 8px rgba(96,165,250,0.5)",
      }} />
    </div>
  );
}
