import { useState, useEffect, useRef, useCallback } from "react";

const SEVERITY_CONFIG = {
  0: { label: "Safe", color: "#16a34a", glow: "#16a34a33", bg: "rgba(22,163,74,0.07)", badge: "rgba(22,163,74,0.12)", icon: "●" },
  1: { label: "Caution", color: "#d97706", glow: "#d9770633", bg: "rgba(217,119,6,0.07)", badge: "rgba(217,119,6,0.12)", icon: "◉" },
  2: { label: "Dangerous", color: "#dc2626", glow: "#dc262633", bg: "rgba(220,38,38,0.07)", badge: "rgba(220,38,38,0.12)", icon: "⬟" },
};

const API = import.meta?.env?.VITE_API_URL ?? "";

const T = {
  bg: "#030308",
  surface: "#FFFFFF",
  border: "rgba(96,165,250,0.15)",
  borderStrong: "rgba(96,165,250,0.40)",
  accent: "#60a5fa",
  accentDeep: "#3b82f6",
  accentBg: "rgba(96,165,250,0.08)",
  txt: "rgba(255,255,255,0.88)",
  muted: "rgba(255,255,255,0.32)",
  font: "'DM Mono', monospace",
  serif: "'LEMONMILK', sans-serif",
};

// ── Interaction Card (light themed) ───────────────────────────────────────────
function InteractionCard({ ia, index }) {
  const cfg = SEVERITY_CONFIG[ia.severity];
  return (
    <div style={{
      background: cfg.bg,
      border: `1px solid ${cfg.color}30`,
      borderLeft: `3px solid ${cfg.color}`,
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 8,
      animation: `fadeSlide 0.3s ease ${index * 0.05}s both`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.txt, letterSpacing: 0.3 }}>
          {ia.drug_a.charAt(0).toUpperCase() + ia.drug_a.slice(1)} + {ia.drug_b.charAt(0).toUpperCase() + ia.drug_b.slice(1)}
        </div>
        <div style={{
          fontSize: 9, letterSpacing: 1.5, padding: "3px 9px",
          background: cfg.badge, color: cfg.color,
          borderRadius: 20, fontWeight: 600,
        }}>
          {cfg.icon} {cfg.label.toUpperCase()}
        </div>
      </div>
      <div style={{ fontSize: 10, color: cfg.color, marginBottom: 4, letterSpacing: 0.5, fontWeight: 600 }}>
        {ia.mechanism}
      </div>
      <div style={{ fontSize: 11, color: "rgba(0,0,0,0.55)", lineHeight: 1.6 }}>
        {ia.effect}
      </div>
      {ia.source === "gnn" && ia.confidence && (
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 5, letterSpacing: 0.5 }}>
          ◈ GNN Prediction · {(ia.confidence * 100).toFixed(0)}% confidence
        </div>
      )}
      {ia.source === "bert" && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 7 }}>
          <svg width="10" height="10" viewBox="0 0 100 100" fill="none">
            <path d="M50 5 L95 27.5 L95 72.5 L50 95 L5 72.5 L5 27.5 Z" fill="#FFD039" opacity="0.85"/>
          </svg>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 0.5, fontFamily: T.font }}>
            BioClinicalBERT DDI {ia.confidence ? `· ${(ia.confidence * 100).toFixed(0)}% conf` : ""} · HuggingFace
          </span>
        </div>
      )}
    </div>
  );
}

// ── Pill-shaped Drug Badge ─────────────────────────────────────────────────────
function DrugPill({ med, severity = 0, onRemove, selected, onClick }) {
  const cfg = SEVERITY_CONFIG[severity];
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "10px 20px",
        background: selected
          ? `linear-gradient(135deg, ${T.accent}, ${T.accentDeep})`
          : hov ? T.accentBg : T.surface,
        border: `1px solid ${selected ? "transparent" : hov ? T.accent : T.borderStrong}`,
        borderRadius: 50,
        fontSize: 13, fontWeight: 600,
        color: selected ? "#fff" : T.txt,
        cursor: "pointer",
        transition: "all 0.18s ease",
        boxShadow: selected ? "0 4px 16px rgba(96,165,250,0.20)" : hov ? "0 2px 12px rgba(96,165,250,0.20)" : "0 1px 4px rgba(0,0,0,0.06)",
        userSelect: "none",
        letterSpacing: 0.2,
      }}
    >
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: selected ? "rgba(255,255,255,0.7)" : cfg.color,
        flexShrink: 0,
      }} />
      {med.charAt(0).toUpperCase() + med.slice(1)}
      {onRemove && (
        <span
          onClick={e => { e.stopPropagation(); onRemove(med); }}
          style={{
            marginLeft: 2, fontSize: 11, opacity: 0.55,
            lineHeight: 1, cursor: "pointer",
            color: selected ? "#fff" : T.muted,
          }}
        >✕</span>
      )}
    </div>
  );
}

// ── Drug Circle Simulation ─────────────────────────────────────────────────────
function DrugCircleSimulation({ drugA, drugB, severity, loading }) {
  const cfg = severity >= 0 ? SEVERITY_CONFIG[severity] : SEVERITY_CONFIG[0];
  const intersectColor = severity === 2 ? "#dc2626" : severity === 1 ? "#d97706" : "#16a34a";
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 1400);
    return () => clearInterval(id);
  }, []);

  const label = severity === -1 ? "Awaiting Analysis" :
                severity === 0  ? "Safe Combination" :
                severity === 1  ? "Use Caution" : "Dangerous Interaction";

  return (
    <div style={{
      margin: "0 0 20px",
      background: severity >= 0 ? cfg.bg : "rgba(0,0,0,0.02)",
      border: `1px solid ${severity >= 0 ? cfg.color + "30" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 16,
      padding: "24px 20px",
      textAlign: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Title */}
      <div style={{ fontSize: 9, letterSpacing: 2, color: T.muted, fontWeight: 700, marginBottom: 16 }}>
        MOLECULAR INTERACTION SIMULATION
      </div>

      {/* Circle diagram */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", height: 140,
      }}>
        {/* Drug A circle */}
        <div style={{
          width: 110, height: 110, borderRadius: "50%",
          background: `radial-gradient(circle at 38% 38%,rgba(96,165,250,0.20),rgba(96,165,250,0.20))`,
          border: "2px solid rgba(96,165,250,0.20)",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "absolute", left: "50%", transform: "translateX(-90px)",
          boxShadow: `0 0 ${severity === 2 ? 22 : 12}px rgba(249,115,22,0.${pulse ? 25 : 15})`,
          transition: "box-shadow 1.4s ease",
          zIndex: 2,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.accentDeep, maxWidth: 72, textAlign: "center", lineHeight: 1.3, wordBreak: "break-word" }}>
            {drugA?.charAt(0).toUpperCase() + drugA?.slice(1)}
          </span>
        </div>

        {/* Intersection zone */}
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: intersectColor,
          opacity: severity >= 0 ? (pulse ? 0.9 : 0.55) : 0.18,
          position: "absolute", left: "50%", top: "50%",
          transform: "translate(-50%, -50%)",
          transition: "opacity 1.4s ease",
          zIndex: 3,
          boxShadow: severity >= 0 ? `0 0 18px ${intersectColor}88` : "none",
          filter: severity >= 0 ? "blur(1px)" : "none",
        }} />

        {/* Drug B circle */}
        <div style={{
          width: 110, height: 110, borderRadius: "50%",
          background: `radial-gradient(circle at 62% 38%, rgba(234,88,12,0.22), rgba(234,88,12,0.06))`,
          border: "2px solid rgba(234,88,12,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "absolute", left: "50%", transform: "translateX(-22px)",
          boxShadow: `0 0 ${severity === 2 ? 22 : 12}px rgba(234,88,12,0.${pulse ? 25 : 15})`,
          transition: "box-shadow 1.4s ease",
          zIndex: 2,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", maxWidth: 72, textAlign: "center", lineHeight: 1.3, wordBreak: "break-word" }}>
            {drugB?.charAt(0).toUpperCase() + drugB?.slice(1)}
          </span>
        </div>
      </div>

      {/* Status label */}
      <div style={{
        marginTop: 14,
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "6px 16px",
        background: severity >= 0 ? cfg.badge : "rgba(255,255,255,0.04)",
        border: `1px solid ${severity >= 0 ? cfg.color + "40" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 20,
      }}>
        {loading && (
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: T.accent, animation: "pulse 0.8s ease infinite",
          }} />
        )}
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
          color: severity >= 0 ? cfg.color : T.muted,
        }}>
          {loading ? "Analyzing…" : (severity >= 0 ? cfg.icon + " " : "") + label}
        </span>
      </div>

      {/* Legend */}
      {severity >= 0 && (
        <div style={{ marginTop: 10, fontSize: 9, color: T.muted, letterSpacing: 0.5 }}>
          Intersection color indicates interaction severity · run Safety Check for full report
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DrugInteractionGraph({ token }) {
  const [medications, setMedications] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [allDrugs, setAllDrugs] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDrug, setSelectedDrug] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [drugFilter, setDrugFilter] = useState("");
  const inputRef = useRef(null);

  // Load drug list
  useEffect(() => {
    fetch(`${API}/drugs/list`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setAllDrugs(d.drugs || []))
      .catch(() => {});
  }, [token]);

  // Auto-load user's active medications
  useEffect(() => {
    fetch(`${API}/medication/medications`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        const meds = (d.medications || []).map(m => (m.generic_name || m.name).toLowerCase().trim());
        if (meds.length > 0) {
          setMedications(meds);
          if (meds.length >= 2) checkInteractions(meds);
        }
      })
      .catch(() => {});
  }, [token]);

  // Autocomplete
  useEffect(() => {
    if (!inputValue.trim() || inputValue.length < 2) { setSuggestions([]); return; }
    const q = inputValue.toLowerCase();
    setSuggestions(allDrugs.filter(d => d.includes(q)).slice(0, 8));
  }, [inputValue, allDrugs]);

  const addMedication = useCallback((name) => {
    const n = name.trim().toLowerCase();
    if (!n || medications.includes(n) || medications.length >= 10) return;
    const updated = [...medications, n];
    setMedications(updated);
    setInputValue(""); setSuggestions([]); setShowSuggestions(false);
    if (updated.length >= 2) checkInteractions(updated);
  }, [medications]);

  const removeMedication = useCallback((name) => {
    const updated = medications.filter(m => m !== name);
    setMedications(updated);
    if (updated.length >= 2) checkInteractions(updated);
    else setResult(null);
  }, [medications]);

  const checkInteractions = useCallback(async (meds) => {
    if (meds.length < 2) return;
    setLoading(true); setError(null); setAiSummary(null); setSummaryError(null);
    try {
      const res = await fetch(`${API}/drugs/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ medications: meds }),
      });
      if (!res.ok) {
        let errMsg;
        try { const e = await res.json(); errMsg = e.detail || JSON.stringify(e); }
        catch { errMsg = await res.text().catch(() => `HTTP ${res.status}`); }
        throw new Error(errMsg);
      }
      setResult(await res.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  const fetchSummary = useCallback(async () => {
    if (!result) return;
    setSummaryLoading(true); setSummaryError(null); setAiSummary(null);
    try {
      const res = await fetch(`${API}/drugs/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          medications, interactions: result.interactions || [],
          highest_severity: result.highest_severity ?? -1,
          summary: result.summary || {},
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail || "Summary failed");
      }
      setAiSummary(await res.json());
    } catch (e) { setSummaryError(e.message); }
    finally { setSummaryLoading(false); }
  }, [result, medications, token]);

  const highestSeverity = result?.highest_severity ?? -1;
  const highestCfg = highestSeverity >= 0 ? SEVERITY_CONFIG[highestSeverity] : null;
  const filteredDrugs = allDrugs.filter(d =>
    d.includes(drugFilter.toLowerCase()) && !medications.includes(d)
  ).slice(0, 24);

  const getDrugSeverity = (med) =>
    result?.graph_data?.nodes?.find(n => n.id === med)?.severity ?? 0;

  return (
    <div style={{
      fontFamily: T.font,
      background: T.bg,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        @keyframes fadeSlide { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes shimmer { 0%{opacity:0.5} 50%{opacity:1} 100%{opacity:0.5} }
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.9} }
        .drug-sugg:hover { background:rgba(96,165,250,0.20)!important; }
        .drug-lib-item:hover { background:rgba(96,165,250,0.20)!important; border-color:rgba(96,165,250,0.20)!important; }
        .drug-lib-item:hover .drug-lib-plus { opacity: 1 !important; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background:rgba(96,165,250,0.20); border-radius: 4px; }
      `}</style>

      {/* ── TOP HEADER BAR ── */}
      <div style={{
        padding: "18px 28px 14px",
        background: "rgba(3,3,8,0.95)",
        borderBottom: `1px solid ${T.border}`,
        backdropFilter: "blur(16px)",
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: T.serif, fontSize: 22, fontWeight: 800, color: T.txt,
            letterSpacing: -0.5, display: "flex", alignItems: "center", gap: 8,
          }}>
            Drug Interaction Engine <span style={{ color: T.accent }}>⬟</span>
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 3, fontWeight: 400, letterSpacing: 0.2 }}>
            Identify unsafe drug combinations using GraphSAGE GNN and BioClinicalBERT — real-time, private, on-device
          </div>
        </div>

        {/* Sub-nav badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 12px",
            background: "rgba(255,208,57,0.08)",
            border: "1px solid rgba(255,208,57,0.25)",
            borderRadius: 20, fontSize: 9, letterSpacing: 1, color: "#B45309",
          }}>
            <svg width="10" height="10" viewBox="0 0 100 100" fill="none">
              <path d="M50 5 L95 27.5 L95 72.5 L50 95 L5 72.5 L5 27.5 Z" fill="#FFD039" opacity="0.9"/>
            </svg>
            BioClinicalBERT · AUC 0.86
          </div>
          <div style={{
            fontSize: 9, letterSpacing: 1, color: "rgba(255,255,255,0.28)",
            padding: "5px 12px", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 20, background: T.surface,
          }}>
            ◈ GraphSAGE GNN · {allDrugs.length} drugs
          </div>

          {/* CTA */}
          <button
            onClick={() => medications.length >= 2 && checkInteractions(medications)}
            disabled={medications.length < 2 || loading}
            style={{
              padding: "9px 20px",
              background: medications.length >= 2 && !loading
                ? `linear-gradient(135deg, ${T.accent}, ${T.accentDeep})`
                : "rgba(255,255,255,0.04)",
              border: "none", borderRadius: 10,
              color: medications.length >= 2 && !loading ? "#fff" : "rgba(255,255,255,0.2)",
              fontSize: 12, fontWeight: 600, letterSpacing: 0.3,
              cursor: medications.length >= 2 && !loading ? "pointer" : "not-allowed",
              boxShadow: medications.length >= 2 && !loading ? "0 4px 16px rgba(96,165,250,0.20)" : "none",
              transition: "all 0.2s",
            }}
          >
            {loading ? "Analyzing…" : "⬟ Run Safety Check"}
          </button>
        </div>
      </div>

      {/* ── 3-COLUMN BODY ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr 310px",
        flex: 1,
        overflow: "hidden",
        height: "calc(100vh - 71px)",
      }}>

        {/* ═══════════════════════════════ LEFT PANEL ═══════════════════════════ */}
        <div style={{
          borderRight: `1px solid ${T.border}`,
          overflowY: "auto",
          background: T.surface,
          display: "flex", flexDirection: "column",
        }}>
          {/* Panel header */}
          <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: T.muted, marginBottom: 12 }}>
              SELECT MEDICATIONS
            </div>

            {/* Search input */}
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={e => { setInputValue(e.target.value); setShowSuggestions(true); }}
                  onKeyDown={e => { if (e.key === "Enter" && inputValue) addMedication(inputValue); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 160)}
                  placeholder="Search drug name…"
                  style={{
                    flex: 1, background: T.bg,
                    border: `1px solid rgba(96,165,250,0.20)`,
                    borderRadius: 8, padding: "9px 12px",
                    color: T.txt, fontSize: 12,
                    fontFamily: T.font, outline: "none",
                    transition: "border-color 0.2s",
                  }}
                />
                <button
                  onClick={() => inputValue && addMedication(inputValue)}
                  style={{
                    padding: "9px 13px",
                    background: T.accentBg,
                    border: `1px solid rgba(96,165,250,0.20)`,
                    borderRadius: 8, color: T.accent,
                    fontSize: 16, cursor: "pointer",
                    transition: "all 0.2s", fontWeight: 700,
                  }}
                >+</button>
              </div>

              {/* Autocomplete */}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 44,
                  background: T.surface, border: `1px solid ${T.borderStrong}`,
                  borderRadius: "0 0 10px 10px", zIndex: 20, marginTop: 2,
                  boxShadow: "0 8px 24px rgba(96,165,250,0.20)", overflow: "hidden",
                }}>
                  {suggestions.map(s => (
                    <div key={s} className="drug-sugg"
                      onMouseDown={() => addMedication(s)}
                      style={{
                        padding: "9px 13px", fontSize: 12, color: T.txt,
                        cursor: "pointer", transition: "background 0.15s",
                        borderBottom: `1px solid rgba(0,0,0,0.04)`,
                        fontFamily: T.font,
                      }}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Selected medications */}
          {medications.length > 0 && (
            <div style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: T.muted, marginBottom: 8 }}>
                ACTIVE ({medications.length}/10)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {medications.map(med => {
                  const sev = getDrugSeverity(med);
                  const cfg = SEVERITY_CONFIG[sev];
                  return (
                    <div key={med} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 12px", borderRadius: 10,
                      background: cfg.bg, border: `1px solid ${cfg.color}25`,
                    }}>
                      <span style={{ fontSize: 10, color: cfg.color }}>{cfg.icon}</span>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: T.txt }}>
                        {med.charAt(0).toUpperCase() + med.slice(1)}
                      </span>
                      <span
                        onClick={() => removeMedication(med)}
                        style={{ fontSize: 10, color: T.muted, cursor: "pointer", padding: "0 2px" }}
                      >✕</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available drugs browser */}
          <div style={{ flex: 1, padding: "12px 18px", overflowY: "auto" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: T.muted, marginBottom: 10 }}>
              DRUG LIBRARY ({allDrugs.length})
            </div>
            <input
              value={drugFilter}
              onChange={e => setDrugFilter(e.target.value)}
              placeholder="Filter library…"
              style={{
                width: "100%", padding: "7px 10px",
                background: T.bg, border: `1px solid rgba(255,255,255,0.07)`,
                borderRadius: 7, fontSize: 11, color: T.txt,
                fontFamily: T.font, outline: "none", marginBottom: 10,
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {filteredDrugs.map(d => (
                <div key={d} className="drug-lib-item"
                  onClick={() => addMedication(d)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "7px 10px", borderRadius: 8,
                    background: T.bg, border: "1px solid transparent",
                    cursor: "pointer", transition: "all 0.15s",
                    fontSize: 11, color: "rgba(0,0,0,0.65)", fontFamily: T.font,
                  }}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                  <span className="drug-lib-plus" style={{
                    fontSize: 14, color: T.accent, opacity: 0, transition: "opacity 0.15s",
                  }}>+</span>
                </div>
              ))}
              {filteredDrugs.length === 0 && allDrugs.length > 0 && (
                <div style={{ fontSize: 10, color: T.muted, textAlign: "center", padding: "16px 0" }}>
                  No matches
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════ MIDDLE PANEL ═════════════════════════ */}
        <div style={{ overflowY: "auto", padding: "20px 24px" }}>

          {/* Section label */}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: T.muted, marginBottom: 16 }}>
            DRUG COMBINATION OVERVIEW
          </div>

          {/* Pill-shaped drug names */}
          <div style={{ marginBottom: 20 }}>
            {medications.length === 0 ? (
              <div style={{
                border: `2px dashed rgba(96,165,250,0.20)`,
                borderRadius: 16, padding: "24px 20px", textAlign: "center",
              }}>
                <div style={{ fontSize: 28, color: "rgba(96,165,250,0.20)", marginBottom: 8 }}>⬟</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(96,165,250,0.20)", marginBottom: 4 }}>
                  Add medications from the left panel
                </div>
                <div style={{ fontSize: 11, color: T.muted }}>Add 2 or more drugs to check for interactions</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {medications.map(med => (
                  <DrugPill
                    key={med}
                    med={med}
                    severity={getDrugSeverity(med)}
                    onRemove={removeMedication}
                    selected={selectedDrug === med}
                    onClick={() => setSelectedDrug(selectedDrug === med ? null : med)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Drug Circle Simulation ── */}
          {medications.length >= 2 && (
            <DrugCircleSimulation
              drugA={medications[0]}
              drugB={medications[1]}
              severity={highestSeverity}
              loading={loading}
            />
          )}

          {/* Loading state */}
          {loading && (
            <div style={{
              background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 12, padding: "18px 20px",
              display: "flex", alignItems: "center", gap: 12,
              marginBottom: 16, animation: "shimmer 1.2s ease infinite",
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: T.accent, animation: "pulse 1s ease infinite",
              }} />
              <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>
                Analyzing drug interactions…
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)",
              borderRadius: 12, padding: "12px 16px", marginBottom: 16,
              fontSize: 11, color: "#dc2626",
            }}>{error}</div>
          )}

          {/* ── Severity summary strip ── */}
          {result && highestCfg && (
            <div style={{
              background: highestCfg.bg, border: `1px solid ${highestCfg.color}30`,
              borderRadius: 14, padding: "16px 20px", marginBottom: 16,
              display: "flex", alignItems: "center", gap: 18,
              animation: "fadeSlide 0.3s ease",
            }}>
              <div style={{
                fontFamily: T.serif, fontSize: 20, fontWeight: 800,
                color: highestCfg.color, letterSpacing: -0.5,
              }}>
                {highestCfg.icon} {
                  highestSeverity === 0 ? "All Clear" :
                  highestSeverity === 1 ? "Use Caution" : "Dangerous Combo"
                }
              </div>
              <div style={{ display: "flex", gap: 16, marginLeft: "auto" }}>
                {Object.entries(result.summary || {}).map(([label, count]) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{
                      fontSize: 20, fontWeight: 800,
                      color: Object.values(SEVERITY_CONFIG).find(c => c.label.toLowerCase() === label)?.color || T.txt,
                      fontFamily: T.serif,
                    }}>{count}</div>
                    <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1.5 }}>{label.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All clear */}
          {result?.interactions?.length === 0 && medications.length >= 2 && !loading && (
            <div style={{
              background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.18)",
              borderRadius: 14, padding: "20px", textAlign: "center", marginBottom: 16,
            }}>
              <div style={{ fontSize: 22, color: "#16a34a", marginBottom: 6 }}>●</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#16a34a" }}>No Interactions Found</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>These medications appear safe to combine</div>
            </div>
          )}

          {/* ── Interaction cards ── */}
          {result?.interactions?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: T.muted, marginBottom: 12 }}>
                INTERACTIONS FOUND ({result.interactions.length})
              </div>
              {result.interactions
                .filter(ia => !selectedDrug || ia.drug_a === selectedDrug || ia.drug_b === selectedDrug)
                .map((ia, i) => (
                  <InteractionCard key={`${ia.drug_a}-${ia.drug_b}`} ia={ia} index={i} />
                ))}
              {selectedDrug && (
                <div
                  onClick={() => setSelectedDrug(null)}
                  style={{
                    fontSize: 11, color: T.accent, cursor: "pointer", marginTop: 8,
                    textAlign: "center", textDecoration: "underline",
                  }}
                >
                  Show all interactions
                </div>
              )}
            </div>
          )}

          {/* Selected drug detail */}
          {selectedDrug && result && (
            <div style={{
              marginTop: 16,
              background: T.surface, border: `1px solid ${T.borderStrong}`,
              borderRadius: 12, padding: "14px 18px",
              animation: "fadeSlide 0.2s ease",
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: T.muted, marginBottom: 6 }}>SELECTED DRUG</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.txt, marginBottom: 4 }}>
                {selectedDrug.charAt(0).toUpperCase() + selectedDrug.slice(1)}
              </div>
              <div style={{ fontSize: 11, color: T.muted }}>
                Class: {result.graph_data?.nodes?.find(n => n.id === selectedDrug)?.class?.replace("_", " ") || "—"}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════ RIGHT PANEL ══════════════════════════ */}
        <div style={{
          borderLeft: `1px solid ${T.border}`,
          background: T.surface,
          overflowY: "auto",
          display: "flex", flexDirection: "column",
        }}>
          {/* Panel header */}
          <div style={{
            padding: "16px 18px 14px",
            borderBottom: `1px solid ${T.border}`,
            position: "sticky", top: 0,
            background: T.surface, zIndex: 10,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: T.muted, marginBottom: 10 }}>
              AI SAFETY BRIEFING
            </div>
            <button
              onClick={fetchSummary}
              disabled={!result || summaryLoading}
              style={{
                width: "100%", padding: "10px 0",
                background: result && !summaryLoading
                  ? `linear-gradient(135deg, ${T.accent}, ${T.accentDeep})`
                  : "rgba(255,255,255,0.04)",
                border: "none", borderRadius: 10,
                color: result && !summaryLoading ? "#fff" : "rgba(255,255,255,0.2)",
                fontSize: 12, fontWeight: 600, letterSpacing: 0.3,
                cursor: result && !summaryLoading ? "pointer" : "not-allowed",
                boxShadow: result && !summaryLoading ? "0 3px 12px rgba(96,165,250,0.20)" : "none",
                transition: "all 0.2s", fontFamily: T.font,
              }}
            >
              {summaryLoading ? "Thinking…" : aiSummary ? "◈ Refresh Summary" : "◈ Summarize Risks"}
            </button>
          </div>

          {/* Summary content */}
          <div style={{ padding: "16px 18px", flex: 1 }}>
            {!result && !summaryLoading && (
              <div style={{
                textAlign: "center", padding: "32px 12px",
                border: `2px dashed rgba(96,165,250,0.20)`,
                borderRadius: 14,
              }}>
                <div style={{ fontSize: 28, color: "rgba(96,165,250,0.20)", marginBottom: 10 }}>◈</div>
                <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
                  Run a safety check first, then get a plain-English AI briefing on the risks
                </div>
              </div>
            )}

            {result && !aiSummary && !summaryLoading && !summaryError && (
              <div style={{
                textAlign: "center", padding: "24px 12px",
                border: `1px solid ${T.border}`, borderRadius: 14,
              }}>
                <div style={{ fontSize: 22, color: T.accent, marginBottom: 8 }}>◈</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: T.txt, marginBottom: 6 }}>
                  Analysis ready
                </div>
                <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.7 }}>
                  Click "Summarize Risks" above to get a plain-English AI safety briefing for these interactions.
                </div>
              </div>
            )}

            {summaryLoading && (
              <div style={{
                display: "flex", flexDirection: "column", gap: 8, padding: "8px 0",
              }}>
                {[85, 100, 70, 95, 60].map((w, i) => (
                  <div key={i} style={{
                    height: 10, borderRadius: 6,
                    background: `rgba(249,115,22,${0.1 + (i % 2) * 0.05})`,
                    width: `${w}%`,
                    animation: `shimmer ${1 + i * 0.15}s ease infinite`,
                  }} />
                ))}
                <div style={{ fontSize: 10, color: T.muted, marginTop: 4, letterSpacing: 1, animation: "shimmer 1.4s ease infinite" }}>
                  AI analyzing interactions…
                </div>
              </div>
            )}

            {summaryError && (
              <div style={{
                background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)",
                borderRadius: 10, padding: "12px 14px",
                fontSize: 11, color: "#dc2626", lineHeight: 1.5,
              }}>{summaryError}</div>
            )}

            {aiSummary && (
              <div style={{ animation: "fadeSlide 0.3s ease" }}>
                <div style={{
                  fontSize: 12, color: T.txt, lineHeight: 1.85,
                  whiteSpace: "pre-wrap", fontFamily: T.font,
                }}>
                  {aiSummary.summary}
                </div>
                {aiSummary.model && (
                  <div style={{
                    fontSize: 9, color: T.muted, marginTop: 14, letterSpacing: 1,
                    padding: "8px 10px",
                    background: T.bg, borderRadius: 8,
                    border: `1px solid ${T.border}`,
                  }}>
                    ◈ Local AI · {aiSummary.model.toUpperCase()} · Not medical advice
                  </div>
                )}
              </div>
            )}

            {/* Severity legend */}
            <div style={{ marginTop: 20, padding: "14px", background: T.bg, borderRadius: 12, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: T.muted, marginBottom: 10 }}>SEVERITY SCALE</div>
              {Object.entries(SEVERITY_CONFIG).map(([sev, cfg]) => (
                <div key={sev} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: cfg.color }}>
                    {cfg.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</div>
                    <div style={{ fontSize: 9, color: T.muted, lineHeight: 1.4 }}>
                      {sev === "0" ? "No known adverse interaction" :
                       sev === "1" ? "Monitor closely, possible interaction" :
                       "Avoid combination — serious risk"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


