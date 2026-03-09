// WellnessReport.jsx — CAP³S Weekly Nutrition Report (light-theme, no JWT)
// Uses GET /api/v1/reports/weekly/{patient_id} — PDF generated server-side by ReportLab
import { useState } from "react";

const PATIENTS = [
  { id: "P001", name: "Ravi Kumar",   label: "P001 — Ravi Kumar (Diabetes)" },
  { id: "P002", name: "Meena Iyer",   label: "P002 — Meena Iyer (Renal)" },
  { id: "P003", name: "Arjun Singh",  label: "P003 — Arjun Singh (Post-GI)" },
];

function Spinner() {
  return (
    <span style={{
      width: 14, height: 14, borderRadius: "50%",
      border: "2px solid rgba(249,115,22,0.3)",
      borderTopColor: "var(--teal)",
      display: "inline-block", animation: "spin 0.8s linear infinite",
    }} />
  );
}

function StatusBadge({ ok, label }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700,
      color: ok ? "var(--green)" : "var(--red)",
      background: ok ? "var(--green-dim, #22C55E12)" : "var(--red-dim, #F43F5E12)",
      border: `1px solid ${ok ? "#22C55E44" : "#F43F5E44"}`,
      letterSpacing: "0.05em",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: ok ? "var(--green)" : "var(--red)" }} />
      {label}
    </span>
  );
}

async function downloadWeeklyReport(patientId, patientName, setLoading, setDone, setError) {
  setLoading(true); setDone(false); setError(null);
  try {
    const res = await fetch(`/api/v1/reports/weekly/${patientId}`);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Report failed (${res.status})`);
    }
    const ctype = res.headers.get("content-type") || "";
    if (!ctype.includes("application/pdf")) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "Backend returned non-PDF response — check reportlab is installed.");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CAP3S_Nutrition_${patientName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setDone(true);
  } catch (e) {
    setError(e?.message || "Failed to generate report.");
  } finally {
    setLoading(false);
  }
}

export default function WellnessReport() {
  const [patientId, setPatientId] = useState("P001");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const patient = PATIENTS.find((p) => p.id === patientId) || PATIENTS[0];

  return (
    <div style={{ animation: "fadeUp 0.4s ease" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "var(--font-head)", fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>
          AI Wellness Reports
        </div>
        <div style={{ color: "var(--text3)", fontSize: 13 }}>
          PQC-signed PDF · Clinical Nutrition · Reportlab backend generation
        </div>
      </div>

      {/* Patient selector */}
      <div className="card" style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Select Patient
        </label>
        <select
          className="input"
          value={patientId}
          onChange={(e) => { setPatientId(e.target.value); setDone(false); setError(null); }}
          style={{ maxWidth: 320 }}
        >
          {PATIENTS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>

      {/* Status row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <StatusBadge ok={true}  label="Reports API Active" />
        <StatusBadge ok={true}  label="PQC-Signed PDF" />
        <StatusBadge ok={false} label="Doctor Endpoint: N/A" />
      </div>

      {/* Main report card */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 20 }}>
        <div className="card">
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text1)", marginBottom: 4, fontFamily: "var(--font-head)" }}>
            Weekly Nutrition Report
          </div>
          <div style={{ fontSize: 11, color: "var(--teal)", marginBottom: 16, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            GET /api/v1/reports/weekly/{patientId}
          </div>

          <div style={{ marginBottom: 16 }}>
            {[
              "7-day macro + micro breakdown per meal",
              "Restriction compliance summary",
              "Dietitian AI insights (Ollama narrative)",
              "PQC Dilithium3 cryptographic signature",
            ].map((b) => (
              <div key={b} style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6, display: "flex", gap: 8 }}>
                <span style={{ color: "var(--teal)", flexShrink: 0 }}>◆</span>
                {b}
              </div>
            ))}
          </div>

          {error && (
            <div style={{ marginBottom: 12, fontSize: 12, color: "var(--red)", background: "var(--red-dim)", border: "1px solid #F43F5E44", borderRadius: 8, padding: "8px 12px" }}>
              ⚠ {error}
            </div>
          )}
          {done && !error && (
            <div style={{ marginBottom: 12, fontSize: 12, color: "var(--green)", background: "#22C55E12", border: "1px solid #22C55E44", borderRadius: 8, padding: "8px 12px" }}>
              ✓ Report downloaded successfully!
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={() => downloadWeeklyReport(patientId, patient.name, setLoading, setDone, setError)}
            disabled={loading}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {loading ? <><Spinner /> Generating PDF…</> : "⇩ Download Weekly Report"}
          </button>
        </div>

        {/* ReportLab info card */}
        <div className="card" style={{ borderColor: "#00C9B144", background: "#00C9B108" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text1)", marginBottom: 4, fontFamily: "var(--font-head)" }}>
            How Reports Are Generated
          </div>
          <div style={{ fontSize: 11, color: "var(--teal)", marginBottom: 16, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Server-side · ReportLab · Deterministic
          </div>
          <div style={{ marginBottom: 16 }}>
            {[
              "PDF built server-side by ReportLab — no client-side PDF library needed",
              "Macros computed by 0/1 Knapsack algorithm — not hallucinated by LLM",
              "PQC Dilithium3 signature appended as a verifiable footer block",
              "If backend is offline, ensure reportlab is installed in the backend venv",
            ].map((b) => (
              <div key={b} style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6, display: "flex", gap: 8 }}>
                <span style={{ color: "var(--teal)", flexShrink: 0 }}>◆</span>
                {b}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--text3)", background: "var(--bg3)", borderRadius: 8, padding: "8px 12px", fontFamily: "var(--font-mono, monospace)" }}>
            pip install reportlab==4.2.5
          </div>
        </div>
      </div>

      <div className="card" style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.6 }}>
        <strong style={{ color: "var(--text2)" }}>Note:</strong> Full PDF generation requires{" "}
        <code style={{ background: "var(--bg3)", padding: "1px 5px", borderRadius: 4 }}>reportlab</code> to be installed in the backend
        environment. Run <code style={{ background: "var(--bg3)", padding: "1px 5px", borderRadius: 4 }}>pip install reportlab</code>{" "}
        inside the backend venv if you see a 500 error. The doctor/therapist summary endpoint is not available in CAP³S v1.
      </div>
    </div>
  );
}
