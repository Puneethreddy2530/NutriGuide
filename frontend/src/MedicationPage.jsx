import { useState, useEffect, useCallback } from "react";

/**
 * MedicationPage.jsx â€” NeoPulse Medication Manager
 *
 * Aesthetic: "Clinical Precision"
 *   Stark white-on-midnight with surgical precision.
 *   Every pill card is a capsule shape. Adherence rings are SVG
 *   arcs. Interaction alerts are stark red banners that demand
 *   attention. Feels like a pharmacy dispensing system
 *   crossed with a Braun product.
 *
 * Fonts: Syne (bold geometric display) + DM Mono (data)
 * Palette: Near-black #08090c base, clean white text,
 *          category-coded accent colors per medication
 *
 * Features:
 *   - Today's schedule with one-tap mark taken/missed
 *   - Drug interaction alerts (GNN-backed, rule-based fallback)
 *   - Per-medication adherence rings (SVG arc)
 *   - Add/edit medication modal
 *   - 30-day adherence calendar per medication
 *   - Category filter (antidepressant, anxiolytic, etc.)
 *   - MindGuide integration badge
 */

const API = import.meta?.env?.VITE_API_URL ?? "";   // empty = relative â†’ Vite proxy â†’ :8020

const CATEGORIES = [
  { key: "antidepressant", label: "Antidepressant", color: "#7ecec4" },
  { key: "anxiolytic", label: "Anxiolytic", color: "#a78bfa" },
  { key: "mood_stabilizer", label: "Mood Stabilizer", color: "#f59e6b" },
  { key: "sleep", label: "Sleep", color: "#60a5fa" },
  { key: "pain", label: "Pain Relief", color: "#f87171" },
  { key: "other", label: "Other", color: "#94a3b8" },
];

const FREQUENCIES = [
  { key: "once_daily", label: "Once daily", times: ["08:00"] },
  { key: "twice_daily", label: "Twice daily", times: ["08:00", "20:00"] },
  { key: "three_times", label: "Three times daily", times: ["08:00", "14:00", "20:00"] },
  { key: "as_needed", label: "As needed", times: [] },
  { key: "weekly", label: "Weekly", times: ["08:00"] },
];

// â”€â”€ SVG Adherence Ring â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AdherenceRing({ pct, color, size = 56 }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const cx = size / 2;

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cx} r={r}
        fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} />
      <circle cx={cx} cy={cx} r={r}
        fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
      <text x={cx} y={cx}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={size < 50 ? 9 : 11}
        fill="rgba(255,255,255,0.55)"
        style={{
          transform: "rotate(90deg)", transformOrigin: `${cx}px ${cx}px`,
          fontFamily: "'DM Mono', monospace", fontWeight: 600
        }}>
        {pct}%
      </text>
    </svg>
  );
}

// â”€â”€ Pill Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PillCard({ med, adherence, onMarkTaken, onMarkMissed, onEdit }) {
  const status = med.status || "pending";
  const cat = CATEGORIES.find(c => c.key === med.category) || CATEGORIES[5];
  const adh_pct = adherence?.adherence_pct ?? null;

  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: `1px solid ${status === "taken"
        ? "rgba(34,197,94,0.25)"
        : status === "missed"
          ? "rgba(239,68,68,0.18)"
          : "rgba(255,255,255,0.07)"}`,
      borderLeft: `3px solid ${status === "taken" ? "#22c55e" : status === "missed" ? "#ef4444" : cat.color}`,
      borderRadius: 14,
      padding: "16px 18px",
      display: "flex", flexDirection: "column", gap: 12,
      transition: "all 0.2s",
      animation: "fadeUp 0.3s ease",
      boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start"
      }}>
        <div style={{ flex: 1 }}>
          {/* Pill shape name */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{
              width: 28, height: 14,
              background: `linear-gradient(135deg, ${cat.color}40, ${cat.color}20)`,
              border: `1px solid ${cat.color}50`,
              borderRadius: 7,
            }} />
            <span style={{
              fontSize: 15, color: "rgba(255,255,255,0.88)",
              fontFamily: "'DM Mono', monospace", fontWeight: 600
            }}>
              {med.name}
            </span>
          </div>
          <div style={{
            fontSize: 11, color: "rgba(255,255,255,0.32)",
            fontFamily: "'DM Mono', monospace"
          }}>
            {med.dosage && `${med.dosage} Â· `}
            {FREQUENCIES.find(f => f.key === med.frequency)?.label || med.frequency}
            {med.times?.length > 0 && ` Â· ${med.times.join(", ")}`}
          </div>
        </div>

        {/* Adherence ring */}
        {adh_pct !== null && (
          <AdherenceRing pct={adh_pct} color={cat.color} size={52} />
        )}
      </div>

      {/* Instructions */}
      {med.instructions && (
        <div style={{
          fontSize: 10, color: "rgba(255,255,255,0.28)",
          fontFamily: "'DM Mono', monospace",
          fontStyle: "italic"
        }}>
          â—Ž {med.instructions}
        </div>
      )}

      {/* Status + actions */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {status === "taken" ? (
          <div style={{
            padding: "5px 14px",
            background: "rgba(34,197,94,0.12)",
            border: "1px solid rgba(34,197,94,0.25)",
            borderRadius: 20, fontSize: 10,
            color: "#22c55e", fontFamily: "'DM Mono', monospace",
          }}>
            âœ“ TAKEN {med.taken_at ? new Date(med.taken_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
          </div>
        ) : status === "missed" ? (
          <>
            <div style={{
              padding: "5px 14px",
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.2)",
              borderRadius: 20, fontSize: 10,
              color: "#f87171", fontFamily: "'DM Mono', monospace",
            }}>
              âœ— MISSED
            </div>
            <button onClick={() => onMarkTaken(med.medication_id)} style={{
              padding: "5px 12px",
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.25)",
              borderRadius: 20, cursor: "pointer",
              color: "#22c55e", fontSize: 10,
              fontFamily: "'DM Mono', monospace",
            }}>
              Mark taken late
            </button>
          </>
        ) : (
          <>
            <button onClick={() => onMarkTaken(med.medication_id)} style={{
              flex: 1, padding: "8px 0",
              background: `linear-gradient(135deg, ${cat.color}20, ${cat.color}08)`,
              border: `1px solid ${cat.color}40`,
              borderRadius: 8, cursor: "pointer",
              color: cat.color, fontSize: 10,
              fontFamily: "'DM Mono', monospace",
              letterSpacing: 1, fontWeight: 600,
              transition: "all 0.2s",
            }}>
              âœ“ MARK TAKEN
            </button>
            <button onClick={() => onMarkMissed(med.medication_id)} style={{
              padding: "8px 14px",
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.15)",
              borderRadius: 8, cursor: "pointer",
              color: "rgba(239,68,68,0.6)", fontSize: 10,
              fontFamily: "'DM Mono', monospace",
            }}>
              Skip
            </button>
          </>
        )}
          <button onClick={() => onEdit(med)} style={{
          padding: "8px 10px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 8, cursor: "pointer",
          color: "rgba(255,255,255,0.28)", fontSize: 10,
        }}>
          â‹¯
        </button>
      </div>
    </div>
  );
}

// â”€â”€ Interaction Alert â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function InteractionAlert({ alert }) {
  const [expanded, setExpanded] = useState(false);
  const severityColor = alert.severity === 3 ? "#ef4444"
    : alert.severity === 2 ? "#f59e6b"
      : "#fbbf24";
  const severityBg = alert.severity === 3 ? "rgba(239,68,68,0.08)"
    : alert.severity === 2 ? "rgba(245,158,107,0.08)"
      : "rgba(251,191,36,0.08)";

  return (
    <div onClick={() => setExpanded(e => !e)} style={{
      padding: "10px 14px",
      background: severityBg,
      border: `1px solid ${severityColor}30`,
      borderRadius: 10, cursor: "pointer",
      animation: "fadeUp 0.2s ease",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: severityColor, fontSize: 14 }}>
            {alert.severity === 3 ? "âš " : "â–³"}
          </span>
          <span style={{
            fontSize: 12, color: severityColor, fontWeight: 600,
            fontFamily: "'DM Mono', monospace"
          }}>
            {alert.drug_a} + {alert.drug_b}
          </span>
        </div>
        <span style={{
          fontSize: 9, color: severityColor,
          fontFamily: "'DM Mono', monospace",
          letterSpacing: 1, padding: "2px 8px",
          background: `${severityColor}20`,
          borderRadius: 10
        }}>
          {alert.severity_label.toUpperCase()}
        </span>
      </div>
      {expanded && (
        <div style={{
          marginTop: 8, fontSize: 11,
          color: "rgba(255,255,255,0.55)",
          fontFamily: "'DM Mono', monospace",
          lineHeight: 1.6
        }}>
          {alert.description}
          {alert.severity >= 2 && (
            <div style={{ marginTop: 6, color: severityColor, fontSize: 10 }}>
              â†’ Consult your prescriber or pharmacist before continuing.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// â”€â”€ Add Medication Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AddMedModal({ onSave, onClose, editing }) {
  const [form, setForm] = useState(editing || {
    name: "", generic_name: "", dosage: "",
    frequency: "once_daily", times: ["08:00"],
    category: "other", prescribed_by: "",
    start_date: new Date().toISOString().split("T")[0],
    instructions: "",
  });

  const f = (key) => (val) => setForm(prev => ({ ...prev, [key]: val }));

  const freqDef = FREQUENCIES.find(x => x.key === form.frequency);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: "100%", maxWidth: 520,
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, padding: "28px 28px",
        animation: "fadeUp 0.2s ease",
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }}>
        <div style={{
          fontSize: 18, color: "rgba(255,255,255,0.88)",
          fontFamily: "'Syne', sans-serif", fontWeight: 800,
          marginBottom: 20
        }}>
          {editing ? "Edit Medication" : "Add Medication"}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            ["Medication Name *", "name", "e.g. Sertraline"],
            ["Generic Name", "generic_name", "e.g. sertraline HCl"],
            ["Dosage", "dosage", "e.g. 50mg"],
            ["Prescribed By", "prescribed_by", "Doctor's name"],
            ["Instructions", "instructions", "e.g. take with food"],
          ].map(([label, key, ph]) => (
            <div key={key}>
              <div style={{
              fontSize: 9, color: "rgba(255,255,255,0.3)",
              letterSpacing: 2, marginBottom: 5,
              fontFamily: "'DM Mono', monospace"
            }}>
              {label.toUpperCase().replace(" *", "")}
              {label.includes("*") && <span style={{ color: "#f87171" }}> *</span>}
            </div>
            <input value={form[key] || ""} onChange={e => f(key)(e.target.value)}
              placeholder={ph} style={{
                width: "100%", padding: "9px 12px",
                background: "radial-gradient(ellipse at 50% -10%, #0d0a2e 0%, #030308 60%)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, outline: "none",
                color: "rgba(255,255,255,0.88)", fontSize: 12,
                fontFamily: "'DM Mono', monospace",
                caretColor: "#60a5fa",
                }} />
            </div>
          ))}

          {/* Category */}
          <div>
            <div style={{
              fontSize: 9, color: "rgba(255,255,255,0.3)",
              letterSpacing: 2, marginBottom: 5,
              fontFamily: "'DM Mono', monospace"
            }}>
              CATEGORY
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {CATEGORIES.map(c => (
                <button key={c.key} onClick={() => f("category")(c.key)} style={{
                  padding: "5px 12px",
                  background: form.category === c.key ? `${c.color}20` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${form.category === c.key ? `${c.color}50` : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 20, cursor: "pointer",
                  color: form.category === c.key ? c.color : "rgba(255,255,255,0.32)",
                  fontSize: 10, fontFamily: "'DM Mono', monospace",
                }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <div style={{
              fontSize: 9, color: "rgba(255,255,255,0.3)",
              letterSpacing: 2, marginBottom: 5,
              fontFamily: "'DM Mono', monospace"
            }}>
              FREQUENCY
            </div>
            <select value={form.frequency}
              onChange={e => {
                const def = FREQUENCIES.find(x => x.key === e.target.value);
                f("frequency")(e.target.value);
                if (def) f("times")(def.times);
              }}
              style={{
                width: "100%", padding: "9px 12px",
                background: "radial-gradient(ellipse at 50% -10%, #0d0a2e 0%, #030308 60%)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, outline: "none",
                color: "rgba(255,255,255,0.88)", fontSize: 12,
                fontFamily: "'DM Mono', monospace",
                cursor: "pointer",
              }}>
              {FREQUENCIES.map(f => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Start date */}
          <div>
            <div style={{
              fontSize: 9, color: "rgba(255,255,255,0.3)",
              letterSpacing: 2, marginBottom: 5,
              fontFamily: "'DM Mono', monospace"
            }}>
              START DATE
            </div>
            <input type="date" value={form.start_date || ""}
              onChange={e => f("start_date")(e.target.value)}
              style={{
                padding: "9px 12px",
                background: "radial-gradient(ellipse at 50% -10%, #0d0a2e 0%, #030308 60%)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, outline: "none",
                color: "rgba(255,255,255,0.88)", fontSize: 12,
                fontFamily: "'DM Mono', monospace",
                colorScheme: "light",
              }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button
            onClick={() => { if (form.name.trim()) onSave(form); }}
            disabled={!form.name.trim()}
            style={{
              flex: 1, padding: "11px 0",
              background: form.name.trim()
                ? "linear-gradient(135deg, #F97316, #EA580C)"
                : "rgba(255,255,255,0.06)",
              border: "none",
              borderRadius: 8, cursor: form.name.trim() ? "pointer" : "default",
              color: form.name.trim() ? "#60a5fa" : "rgba(255,255,255,0.2)",
              fontSize: 11, letterSpacing: 1,
              fontFamily: "'DM Mono', monospace", fontWeight: 600,
              boxShadow: form.name.trim() ? "0 4px 16px rgba(96,165,250,0.3)" : "none",
            }}>
            {editing ? "SAVE CHANGES" : "ADD MEDICATION"}
          </button>
          <button onClick={onClose} style={{
            padding: "11px 20px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, cursor: "pointer",
            color: "rgba(255,255,255,0.4)", fontSize: 11,
            fontFamily: "'DM Mono', monospace",
          }}>
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Main Component
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export default function MedicationPage({ token }) {
  const [schedule, setSchedule] = useState([]);
  const [adherence, setAdherence] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState("today");   // today | all | adherence
  const [showModal, setShowModal] = useState(false);
  const [editingMed, setEditingMed] = useState(null);
  const [catFilter, setCatFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadToday(), loadAdherence(), loadInteractions(), loadStats()]);
    setLoading(false);
  };

  const loadToday = async () => {
    try {
      const r = await fetch(`${API}/medication/today`, { headers });
      const d = await r.json();
      setSchedule(d.schedule || []);
    } catch { }
  };

  const loadAdherence = async () => {
    try {
      const r = await fetch(`${API}/medication/adherence?days=30`, { headers });
      const d = await r.json();
      setAdherence(d.adherence || []);
    } catch { }
  };

  const loadInteractions = async () => {
    try {
      const r = await fetch(`${API}/medication/interactions`, { headers });
      const d = await r.json();
      setInteractions(d.interactions || []);
    } catch { }
  };

  const loadStats = async () => {
    try {
      const r = await fetch(`${API}/medication/stats`, { headers });
      const d = await r.json();
      setStats(d);
    } catch { }
  };

  const markDose = async (medication_id, taken) => {
    await fetch(`${API}/medication/log`, {
      method: "POST", headers,
      body: JSON.stringify({ medication_id, taken }),
    });
    loadToday();
    loadAdherence();
    loadStats();
  };

  const saveMedication = async (form) => {
    const url = editingMed
      ? `${API}/medication/medications/${editingMed.medication_id}`
      : `${API}/medication/medications`;
    const method = editingMed ? "PUT" : "POST";
    await fetch(url, { method, headers, body: JSON.stringify(form) });
    setShowModal(false);
    setEditingMed(null);
    loadAll();
  };

  const openEdit = (med) => {
    setEditingMed(med);
    setShowModal(true);
  };

  // Stats
  const taken = schedule.filter(s => s.status === "taken").length;
  const total = schedule.length;
  const adhPct = total > 0 ? Math.round(taken / total * 100) : 0;
  const hasMajorInteraction = interactions.some(i => i.severity === 3);

  const filteredSchedule = catFilter === "all"
    ? schedule
    : schedule.filter(s => s.category === catFilter);

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 50% -10%, #0d0a2e 0%, #030308 60%)",
      display: "flex", flexDirection: "column",
      fontFamily: "'DM Mono', monospace",
      color: "rgba(255,255,255,0.88)",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes pulse  { 0%,100%{opacity:0.5} 50%{opacity:1} }
        * { box-sizing: border-box; }
        select option { background: #0d0a2e; color: rgba(255,255,255,0.88); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(96,165,250,0.25); border-radius: 2px; }
      `}</style>

      {showModal && (
        <AddMedModal
          editing={editingMed}
          onSave={saveMedication}
          onClose={() => { setShowModal(false); setEditingMed(null); }}
        />
      )}

      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div style={{
        padding: "16px 28px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "rgba(3,3,8,0.95)", backdropFilter: "blur(12px)",
        flexShrink: 0, position: "sticky", top: 0, zIndex: 10,
      }}>
        <div>
          <div style={{
            fontSize: 22, color: "rgba(255,255,255,0.88)",
            fontFamily: "'Syne', sans-serif", fontWeight: 800,
            letterSpacing: "-0.5px"
          }}>
            Medications
          </div>
          <div style={{
            fontSize: 9, color: "rgba(255,255,255,0.3)",
            letterSpacing: 3, marginTop: 2, fontFamily: "'DM Mono', monospace"
          }}>
            {stats?.total_active || 0} ACTIVE Â· {stats?.adherence_7d ?? "â€”"}% ADHERENCE 7D
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Major interaction warning */}
          {hasMajorInteraction && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px",
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 20, animation: "pulse 2s infinite",
            }}>
              <span style={{ color: "#ef4444", fontSize: 12 }}>âš </span>
              <span style={{ fontSize: 9, color: "#ef4444", letterSpacing: 1 }}>
                INTERACTION ALERT
              </span>
            </div>
          )}

          {/* Tabs */}
          <div style={{
            display: "flex", gap: 2,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 10, padding: 3
          }}>
            {[["today", "Today"], ["adherence", "Adherence"], ["all", "All Meds"]].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} style={{
                padding: "5px 14px", borderRadius: 7,
                background: tab === key ? "#60a5fa" : "transparent",
                border: "none",
                cursor: "pointer",
                color: tab === key ? "#60a5fa" : "rgba(255,255,255,0.32)",
                fontSize: 11, letterSpacing: 0.5,
                fontFamily: "'DM Mono', monospace", fontWeight: tab === key ? 600 : 400,
                transition: "all 0.15s",
              }}>
                {label}
              </button>
            ))}
          </div>

          <button onClick={() => { setEditingMed(null); setShowModal(true); }} style={{
            padding: "8px 20px",
            background: "rgba(96,165,250,0.18)", border: "1px solid rgba(96,165,250,0.35)", borderRadius: 8, cursor: "pointer", color: "#60a5fa", fontSize: 11, letterSpacing: 1, fontFamily: "'DM Mono', monospace", fontWeight: 500,
          }}>
            + ADD MED
          </button>
        </div>
      </div>

      {/* â”€â”€ Body â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* â•â• TODAY TAB â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {tab === "today" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
            <div style={{ maxWidth: 800 }}>

              {/* Today's progress bar */}
              {total > 0 && (
                <div style={{
                  marginBottom: 24, padding: "16px 20px",
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12,
                  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", marginBottom: 10
                  }}>
                    <span style={{
                      fontSize: 11, color: "rgba(255,255,255,0.32)",
                      letterSpacing: 1.5, fontFamily: "'DM Mono', monospace"
                    }}>
                      TODAY'S PROGRESS
                    </span>
                    <span style={{
                      fontSize: 14, color: adhPct >= 80 ? "#22c55e" : "#f59e6b",
                      fontFamily: "'Syne', sans-serif", fontWeight: 700
                    }}>
                      {taken}/{total} taken
                    </span>
                  </div>
                  <div style={{
                    height: 6, background: "rgba(255,255,255,0.06)",
                    borderRadius: 3
                  }}>
                    <div style={{
                      width: `${adhPct}%`, height: "100%",
                      background: adhPct >= 80 ? "#22c55e"
                        : adhPct >= 50 ? "#f59e6b" : "#f87171",
                      borderRadius: 3, transition: "width 0.6s ease",
                    }} />
                  </div>
                </div>
              )}

              {/* Interaction alerts â€” always show if present */}
              {interactions.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: 9, color: "rgba(255,255,255,0.3)",
                    letterSpacing: 2, marginBottom: 8, fontFamily: "'DM Mono', monospace"
                  }}>
                    DRUG INTERACTION ALERTS
                  </div>
                  {interactions.map((alert, i) => (
                    <div key={i} style={{ marginBottom: 6 }}>
                      <InteractionAlert alert={alert} />
                    </div>
                  ))}
                </div>
              )}

              {/* Category filter */}
              {schedule.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                  <button onClick={() => setCatFilter("all")} style={{
                    padding: "4px 12px", borderRadius: 20, fontSize: 9, letterSpacing: 1,
                    background: catFilter === "all" ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${catFilter === "all" ? "rgba(96,165,250,0.3)" : "rgba(255,255,255,0.07)"}`,
                    cursor: "pointer", color: catFilter === "all" ? "#60a5fa" : "rgba(255,255,255,0.32)",
                    fontFamily: "'DM Mono', monospace",
                  }}>ALL</button>
                  {CATEGORIES.filter(c =>
                    schedule.some(s => s.category === c.key)
                  ).map(c => (
                    <button key={c.key} onClick={() => setCatFilter(c.key)} style={{
                      padding: "4px 12px", borderRadius: 20, fontSize: 9, letterSpacing: 1,
                      background: catFilter === c.key ? `${c.color}20` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${catFilter === c.key ? `${c.color}40` : "rgba(255,255,255,0.07)"}`,
                      cursor: "pointer",
                      color: catFilter === c.key ? c.color : "rgba(255,255,255,0.32)",
                      fontFamily: "'DM Mono', monospace",
                    }}>{c.label.toUpperCase()}</button>
                  ))}
                </div>
              )}

              {/* Pill cards */}
              {loading ? (
                <div style={{
                  fontSize: 11, color: "rgba(255,255,255,0.2)",
                  textAlign: "center", padding: "60px 0",
                  animation: "pulse 1.2s infinite"
                }}>
                  Loading medicationsâ€¦
                </div>
              ) : filteredSchedule.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0" }}>
                  <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>â¬¡</div>
                  <div style={{
                    fontSize: 13, color: "rgba(255,255,255,0.2)",
                    fontFamily: "'Syne',sans-serif"
                  }}>
                    No medications scheduled
                  </div>
                  <div style={{
                    fontSize: 10, color: "rgba(255,255,255,0.15)",
                    marginTop: 6
                  }}>
                    Click + ADD MED to get started
                  </div>
                </div>
              ) : (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                  gap: 12
                }}>
                  {filteredSchedule.map(med => (
                    <PillCard
                      key={med.medication_id}
                      med={med}
                      adherence={adherence.find(a => a.medication_id === med.medication_id)}
                      onMarkTaken={(id) => markDose(id, true)}
                      onMarkMissed={(id) => markDose(id, false)}
                      onEdit={openEdit}
                    />
                  ))}
                </div>
              )}

              {/* MindGuide note */}
              {stats?.total_active > 0 && (
                <div style={{
                  marginTop: 24, padding: "12px 16px",
                  background: "rgba(96,165,250,0.05)",
                  border: "1px solid rgba(96,165,250,0.15)",
                  borderRadius: 10, fontSize: 10,
                  color: "rgba(255,255,255,0.4)", lineHeight: 1.6,
                  fontStyle: "italic", fontFamily: "'DM Mono', monospace"
                }}>
                  â—Ž Medication adherence ({stats.adherence_7d ?? "â€”"}% this week) is shared with
                  MindGuide for personalised health support. Ask MindGuide about your medications
                  for evidence-based guidance.
                </div>
              )}
            </div>
          </div>
        )}

        {/* â•â• ADHERENCE TAB â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {tab === "adherence" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
            <div style={{ maxWidth: 700 }}>
              <div style={{
                fontSize: 9, color: "rgba(255,255,255,0.3)",
                letterSpacing: 2, marginBottom: 20, fontFamily: "'DM Mono', monospace"
              }}>
                30-DAY ADHERENCE OVERVIEW
              </div>

              {adherence.length === 0 ? (
                <div style={{
                  fontSize: 12, color: "rgba(255,255,255,0.28)",
                  textAlign: "center", padding: "60px 0", fontFamily: "'DM Mono', monospace"
                }}>
                  No adherence data yet â€” start logging doses
                </div>
              ) : adherence.map(med => {
                const cat = CATEGORIES.find(c => c.key === med.category) || CATEGORIES[5];
                return (
                  <div key={med.medication_id} style={{
                    display: "flex", alignItems: "center", gap: 20,
                    padding: "16px 20px", marginBottom: 10,
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderLeft: `3px solid ${cat.color}`,
                    borderRadius: 12, animation: "fadeUp 0.2s ease",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}>
                    <AdherenceRing pct={med.adherence_pct} color={cat.color} size={64} />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 14, color: "rgba(255,255,255,0.88)",
                        fontFamily: "'Syne', sans-serif", fontWeight: 700,
                        marginBottom: 4
                      }}>
                        {med.name}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>
                        {med.taken} of {med.total_logs} doses logged Â· last 30 days
                      </div>
                      {/* Mini bar */}
                      <div style={{
                        marginTop: 8, height: 4,
                        background: "rgba(255,255,255,0.07)",
                        borderRadius: 2, width: "100%"
                      }}>
                        <div style={{
                          width: `${med.adherence_pct}%`, height: "100%",
                          background: cat.color, borderRadius: 2,
                          transition: "width 0.6s ease",
                        }} />
                      </div>
                    </div>
                    <div style={{
                      padding: "4px 12px",
                      background: med.adherence_pct >= 80
                        ? "rgba(34,197,94,0.1)" : "rgba(245,158,107,0.1)",
                      border: `1px solid ${med.adherence_pct >= 80
                        ? "rgba(34,197,94,0.2)" : "rgba(245,158,107,0.2)"}`,
                      borderRadius: 20, fontSize: 9,
                      color: med.adherence_pct >= 80 ? "#22c55e" : "#f59e6b",
                    }}>
                      {med.adherence_pct >= 80 ? "GOOD" : med.adherence_pct >= 50 ? "FAIR" : "LOW"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* â•â• ALL MEDS TAB â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {tab === "all" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
            <div style={{ maxWidth: 700 }}>
              <div style={{
                fontSize: 9, color: "rgba(255,255,255,0.3)",
                letterSpacing: 2, marginBottom: 20, fontFamily: "'DM Mono', monospace"
              }}>
                ALL ACTIVE MEDICATIONS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {adherence.map(med => {
                  const cat = CATEGORIES.find(c => c.key === med.category) || CATEGORIES[5];
                  return (
                    <div key={med.medication_id} style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center",
                      padding: "14px 18px",
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderLeft: `3px solid ${cat.color}`,
                      borderRadius: 12,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 24, height: 12,
                          background: `${cat.color}30`,
                          border: `1px solid ${cat.color}50`,
                          borderRadius: 6,
                        }} />
                        <div>
                          <div style={{
                            fontSize: 13, color: "rgba(255,255,255,0.88)",
                            fontFamily: "'DM Mono', monospace", fontWeight: 600
                          }}>
                            {med.name}
                          </div>
                          <div style={{ fontSize: 9, color: cat.color, marginTop: 2, fontFamily: "'DM Mono', monospace" }}>
                            {cat.label}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <AdherenceRing pct={med.adherence_pct} color={cat.color} size={40} />
                        <button onClick={() => openEdit({
                          medication_id: med.medication_id,
                          name: med.name, category: med.category
                        })}
                          style={{
                            padding: "6px 14px",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 7, cursor: "pointer",
                            color: "rgba(255,255,255,0.4)", fontSize: 10,
                            fontFamily: "'DM Mono', monospace",
                          }}>
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



