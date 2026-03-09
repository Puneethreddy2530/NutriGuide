import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import CarouselOrbit from "./CarouselOrbit";

gsap.registerPlugin(ScrollTrigger);

// ── Section data ───────────────────────────────────────────────────────
const SECTIONS = [
  {
    id: "fitness",
    eyebrow: "REAL-TIME BIOMETRICS",
    title: "Your Body,\nAlways\nListening.",
    description:
      "Track heart rate, HRV, and stress in real-time. Our AI models flag anomalies before they become problems.",
    ctaLabel: "EXPLORE FITNESS",
    color: "#60a5fa",
  },
  {
    id: "medicines",
    eyebrow: "DRUG INTERACTION GNN",
    title: "Smart\nMedication\nSafety.",
    description:
      "Graph Neural Networks map potential drug conflicts in milliseconds. A silent guardian for every prescription.",
    ctaLabel: "CHECK INTERACTIONS",
    color: "#a78bfa",
  },
  {
    id: "mood",
    eyebrow: "EMOTION INTELLIGENCE",
    title: "See What\nYou\nFeel.",
    description:
      "EfficientNet-powered facial emotion detection builds a real-time stress and mood heatmap over your day.",
    ctaLabel: "SCAN MY MOOD",
    color: "#4ade80",
  },
  {
    id: "consistency",
    eyebrow: "AI HEALTH JOURNAL",
    title: "Write Once.\nLearn\nForever.",
    description:
      "Your journal entries train a personal model that forecasts mood, suggests habits, and keeps your story private.",
    ctaLabel: "START WRITING",
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
          ◎ INTELLIGENT HEALTH PLATFORM
        </div>
        <h1 style={{
          fontSize: "clamp(44px, 6vw, 88px)",
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800,
          lineHeight: 0.95,
          color: "rgba(255,255,255,0.92)",
          letterSpacing: -2,
          marginBottom: 28,
        }}>
          YOUR HEALTH,<br />
          <span style={{ color: "#60a5fa" }}>REIMAGINED.</span>
        </h1>
        <p style={{
          fontSize: 12, color: "rgba(255,255,255,0.35)", maxWidth: 440, lineHeight: 1.8,
          fontFamily: "'DM Mono', monospace", marginBottom: 40,
        }}>
          Three AI models. Real-time emotion. Drug safety. Predictive health journaling.
          All in one beautifully private platform.
        </p>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button
            onClick={onEnterApp}
            style={{
              padding: "13px 34px",
              background: "linear-gradient(135deg, rgba(96,165,250,0.25), rgba(167,139,250,0.25))",
              border: "1px solid rgba(96,165,250,0.4)", borderRadius: 8,
              color: "#60a5fa",
              fontFamily: "'DM Mono', monospace",
              fontSize: 10, letterSpacing: 3, fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: "0 0 20px rgba(96,165,250,0.15)",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "linear-gradient(135deg, rgba(96,165,250,0.35), rgba(167,139,250,0.35))";
              e.currentTarget.style.boxShadow = "0 0 32px rgba(96,165,250,0.35)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "linear-gradient(135deg, rgba(96,165,250,0.25), rgba(167,139,250,0.25))";
              e.currentTarget.style.boxShadow = "0 0 20px rgba(96,165,250,0.15)";
            }}
          >
            GET STARTED →
          </button>
          <span style={{
            fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: 2,
            fontFamily: "'DM Mono', monospace",
          }}>
            Scroll to explore ↓
          </span>
        </div>
        {/* Stats row */}
        <div style={{ display: "flex", gap: 32, marginTop: 56 }}>
          {[
            { v: "3", l: "AI MODELS" },
            { v: "100%", l: "PRIVATE" },
            { v: "∞", l: "INSIGHTS" },
          ].map(s => (
            <div key={s.l}>
              <div style={{
                fontSize: 28, fontWeight: 800, color: "rgba(255,255,255,0.9)",
                fontFamily: "'Syne', sans-serif", letterSpacing: -1,
              }}>{s.v}</div>
              <div style={{
                fontSize: 8, color: "rgba(255,255,255,0.25)", letterSpacing: 3, marginTop: 4,
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
        background: "radial-gradient(ellipse at 30% 50%, #0d0a2e 0%, #030308 65%)",
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
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: 800, lineHeight: 0.95,
                  color: "rgba(255,255,255,0.92)", letterSpacing: -1.5,
                  marginBottom: 24, whiteSpace: "pre-line",
                }}>
                  {sec.title}
                </h2>
                <p style={{
                  fontSize: 12, color: "rgba(255,255,255,0.35)", maxWidth: 400, lineHeight: 1.8,
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
                      background: j === i ? sec.color : "rgba(255,255,255,0.1)",
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
      height: 2, background: "rgba(255,255,255,0.05)",
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
