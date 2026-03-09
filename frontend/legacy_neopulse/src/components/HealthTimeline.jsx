import { useState, useEffect, useRef, useCallback } from "react";

/*
  HealthTimeline.jsx
  ──────────────────
  Horizontal scrollable "Life Tape" — each day = a card with:
    - Mood color strip (from journal sentiment)
    - Stress index bar (from EmotionDetector sessions)
    - Medication adherence dot
    - Journal text snippet
    - MindCast risk score chip

  Pinch/scroll to zoom: day view → week view → month color river
  Powered by DuckDB queries via /dashboard/timeline endpoint.

  Demo-ready: includes mock data generator so it works without backend.
*/

const API = import.meta?.env?.VITE_API_URL || "http://localhost:8000";

// Color maps
const sentimentColor = (s) => {
  if (s === null || s === undefined) return "rgba(255,255,255,0.1)";
  if (s > 0.4)  return "#4ade80";
  if (s > 0.1)  return "#86efac";
  if (s > -0.1) return "#facc15";
  if (s > -0.4) return "#fb923c";
  return "#f87171";
};

const stressColor = (s) => {
  if (!s) return "#4ade80";
  if (s > 0.65) return "#f87171";
  if (s > 0.35) return "#facc15";
  return "#4ade80";
};

const riskColor = (r) => {
  if (!r) return "rgba(255,255,255,0.2)";
  if (r > 65) return "#f87171";
  if (r > 40) return "#facc15";
  return "#4ade80";
};

// ── Mock data generator (works without backend) ────────────────────────────────
function generateMockDays(n = 60) {
  const days = [];
  let sentiment = 0.1;
  let stress    = 0.4;

  for (let i = n - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    sentiment += (Math.random() - 0.5) * 0.3;
    sentiment  = Math.max(-1, Math.min(1, sentiment));
    stress    += (Math.random() - 0.5) * 0.25;
    stress     = Math.max(0, Math.min(1, stress));

    const snippets = [
      "Felt focused today, got a lot done.",
      "A bit tired but pushed through.",
      "Rough morning, better evening.",
      "Great session with journaling.",
      "Stressed about deadlines.",
      "Calm day, took a walk.",
      "Medication taken on time.",
      "Slept well, mood lifted.",
      "Anxious about presentation.",
      "Good progress, feeling stable.",
    ];

    days.push({
      date:        date.toISOString().split("T")[0],
      sentiment:   Math.round(sentiment * 100) / 100,
      stress_score:Math.round(stress * 100) / 100,
      risk_score:  Math.round((stress * 0.5 + (1 + sentiment) * -0.25 + 0.5) * 70 + 15),
      journal_snippet: Math.random() > 0.3 ? snippets[Math.floor(Math.random() * snippets.length)] : null,
      med_adherence:   Math.random() > 0.2 ? 1 : (Math.random() > 0.5 ? 0.5 : 0),
      emotion:     ["calm","focused","stressed","anxious","fatigued","joy"][Math.floor(Math.random() * 6)],
      has_journal: Math.random() > 0.3,
      has_session: Math.random() > 0.4,
    });
  }
  return days;
}

// ── Day Card ───────────────────────────────────────────────────────────────────
function DayCard({ day, isToday, isSelected, onClick, zoom }) {
  const sColor = sentimentColor(day.sentiment);
  const stColor = stressColor(day.stress_score);
  const rkColor = riskColor(day.risk_score);

  const dateObj = new Date(day.date + "T00:00:00");
  const dayName = dateObj.toLocaleDateString("en", { weekday: "short" });
  const dayNum  = dateObj.getDate();
  const monthAbbr = dateObj.toLocaleDateString("en", { month: "short" });

  if (zoom === "month") {
    return (
      <div
        onClick={onClick}
        title={`${day.date} · ${day.emotion || "—"}`}
        style={{ width: 12, height: 40, background: sColor, borderRadius: 2, opacity: 0.7, cursor: "pointer", flexShrink: 0, transition: "opacity 0.2s, transform 0.2s" }}
        onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.transform = "scaleY(1.3)"; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = 0.7; e.currentTarget.style.transform = "scaleY(1)"; }}
      />
    );
  }

  return (
    <div onClick={onClick} style={{ width: zoom === "week" ? 80 : 140, flexShrink: 0, background: isSelected ? "rgba(255,255,255,0.07)" : isToday ? "rgba(96,165,250,0.06)" : "rgba(255,255,255,0.025)", border: isSelected ? `1px solid ${sColor}88` : isToday ? "1px solid rgba(96,165,250,0.2)" : "1px solid rgba(255,255,255,0.05)", borderTop: `3px solid ${sColor}`, borderRadius: 10, padding: zoom === "week" ? "8px 8px" : "10px 12px", cursor: "pointer", transition: "background 0.2s, border 0.2s, transform 0.15s", transform: isSelected ? "translateY(-4px)" : "none", fontFamily: "'DM Mono', monospace" }} onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }} onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isToday ? "rgba(96,165,250,0.06)" : "rgba(255,255,255,0.025)"; }}>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)", letterSpacing: 2 }}>{dayName.toUpperCase()} {monthAbbr.toUpperCase()}</div>
        <div style={{ fontSize: zoom === "week" ? 18 : 22, fontWeight: 700, color: isToday ? "#60a5fa" : "#fff", lineHeight: 1 }}>{dayNum}{isToday && <span style={{ fontSize: 7, color: "#60a5fa", marginLeft: 4 }}>TODAY</span>}</div>
      </div>

      {zoom !== "week" && (
        <>
          <div style={{ marginBottom: 5 }}>
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.2)", letterSpacing: 1, marginBottom: 2 }}>MOOD</div>
            <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
              <div style={{ height: "100%", width: `${((day.sentiment + 1) / 2) * 100}%`, background: sColor, borderRadius: 2 }} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: stColor, boxShadow: `0 0 6px ${stColor}` }} />
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.3)" }}>STRESS {Math.round((day.stress_score || 0) * 100)}%</div>
          </div>

          {day.risk_score && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 6px", background: `${rkColor}18`, border: `1px solid ${rkColor}33`, borderRadius: 3, marginBottom: 6 }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: rkColor }} />
              <div style={{ fontSize: 7, color: rkColor, letterSpacing: 1 }}>{day.risk_score}</div>
            </div>
          )}

          {day.journal_snippet && (
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              "{day.journal_snippet}"
            </div>
          )}

          <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
            {day.has_journal  && <div title="Journal entry" style={{ fontSize: 9, opacity: 0.5 }}>✍</div>}
            {day.has_session  && <div title="Emotion session" style={{ fontSize: 9, opacity: 0.5 }}>◎</div>}
            {day.med_adherence === 1 && <div title="Meds taken" style={{ fontSize: 9, opacity: 0.5 }}>●</div>}
            {day.med_adherence === 0 && <div title="Meds missed" style={{ fontSize: 9, color: "#f87171", opacity: 0.7 }}>○</div>}
          </div>
        </>
      )}

      {zoom === "week" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ height: 2, background: sColor, borderRadius: 1 }} />
          <div style={{ fontSize: 7, color: stColor }}>{Math.round((day.stress_score || 0) * 100)}%</div>
        </div>
      )}
    </div>
  );
}

function CorrelationInsight({ days }) {
  if (days.length < 7) return null;
  const pearson = (xs, ys) => {
    const n  = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    const num = xs.reduce((acc, x, i) => acc + (x - mx) * (ys[i] - my), 0);
    const den = Math.sqrt(xs.reduce((a, x) => a + (x - mx) ** 2, 0) * ys.reduce((a, y) => a + (y - my) ** 2, 0));
    return den === 0 ? 0 : num / den;
  };
  const sentiments  = days.map(d => d.sentiment || 0);
  const stresses    = days.map(d => d.stress_score || 0);
  const adherence   = days.map(d => d.med_adherence || 0);
  const stressMoodCorr = pearson(stresses, sentiments);
  const medMoodCorr    = pearson(adherence, sentiments);
  const insights = [];
  if (Math.abs(stressMoodCorr) > 0.4) {
    insights.push({ icon: "◉", color: "#fb923c", text: `Stress and mood are ${stressMoodCorr < 0 ? "negatively" : "positively"} correlated (${Math.abs(stressMoodCorr * 100).toFixed(0)}%). ${stressMoodCorr < -0.5 ? "High stress is dragging your mood." : ""}` });
  }
  if (Math.abs(medMoodCorr) > 0.3) {
    insights.push({ icon: "●", color: "#4ade80", text: `Medication adherence has a ${medMoodCorr > 0 ? "positive" : "negative"} correlation with mood (${Math.abs(medMoodCorr * 100).toFixed(0)}%).` });
  }
  if (insights.length === 0) {
    insights.push({ icon: "◎", color: "rgba(255,255,255,0.3)", text: "No strong correlations yet — keep logging for at least 2 weeks." });
  }
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {insights.map((ins, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "8px 12px", flex: "1 1 200px" }}>
          <span style={{ color: ins.color, fontSize: 10 }}>{ins.icon}</span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{ins.text}</span>
        </div>
      ))}
    </div>
  );
}

export default function HealthTimeline({ token }) {
  const scrollRef   = useRef(null);
  const [days,      setDays]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState(null);
  const [zoom,      setZoom]      = useState("day");
  const [range,     setRange]     = useState(30);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/dashboard/timeline?days=${range}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setDays(d.days || []); setLoading(false); })
      .catch(() => { setDays(generateMockDays(range)); setLoading(false); });
  }, [token, range]);

  useEffect(() => { if (days.length && scrollRef.current) { setTimeout(() => { const todayEl = scrollRef.current.querySelector("[data-today='true']"); todayEl?.scrollIntoView({ behavior: "smooth", inline: "center" }); }, 300); } }, [days]);

  const selectedDay = days.find(d => d.date === selected);
  const avgSentiment = days.length ? (days.reduce((a, d) => a + (d.sentiment || 0), 0) / days.length).toFixed(2) : "—";
  const avgStress = days.length ? Math.round(days.reduce((a, d) => a + (d.stress_score || 0), 0) / days.length * 100) : "—";
  const journalDays = days.filter(d => d.has_journal).length;

  return (
    <div style={{ fontFamily: "'DM Mono', monospace", background: "linear-gradient(180deg, #060612 0%, #09091a 100%)", minHeight: "100vh", padding: "28px 24px", color: "#fff" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap'); @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} } .tl-scroll::-webkit-scrollbar { height: 3px; } .tl-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); } .tl-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; } .zoom-btn:hover { background: rgba(255,255,255,0.1) !important; } .range-btn:hover { opacity: 1 !important; }`}</style>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: "#fff" }}>Life Tape</div>
        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", letterSpacing: 4, marginTop: 2 }}>YOUR HEALTH STORY · DAY BY DAY</div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[ { label: "AVG MOOD",    val: avgSentiment, color: sentimentColor(parseFloat(avgSentiment)) }, { label: "AVG STRESS",  val: `${avgStress}%`, color: stressColor(avgStress / 100) }, { label: "JOURNAL DAYS",val: journalDays,  color: "#60a5fa" }, { label: "DAYS TRACKED",val: days.length,  color: "rgba(255,255,255,0.4)" }, ].map(({ label, val, color }) => (
          <div key={label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 16px" }}>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", letterSpacing: 2, marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 4 }}>
          { ["day", "week", "month"].map(z => (<button key={z} className="zoom-btn" onClick={() => setZoom(z)} style={{ padding: "5px 12px", background: zoom === z ? "rgba(255,255,255,0.1)" : "transparent", border: `1px solid ${zoom === z ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}`, borderRadius: 5, color: zoom === z ? "#fff" : "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: 2, cursor: "pointer", transition: "all 0.2s", textTransform: "uppercase" }}>{z}</button>)) }
        </div>

        <div style={{ display: "flex", gap: 6 }}>{ [14, 30, 60, 90].map(r => (<button key={r} className="range-btn" onClick={() => setRange(r)} style={{ fontSize: 8, letterSpacing: 1, background: "none", border: "none", color: range === r ? "#60a5fa" : "rgba(255,255,255,0.25)", cursor: "pointer", opacity: range === r ? 1 : 0.6, transition: "opacity 0.2s", fontFamily: "'DM Mono', monospace" }}>{r}D</button>)) }</div>
      </div>

      <div ref={scrollRef} className="tl-scroll" style={{ display: "flex", gap: zoom === "month" ? 2 : 8, overflowX: "auto", paddingBottom: 12, paddingTop: 4, alignItems: zoom === "month" ? "flex-end" : "flex-start", minHeight: zoom === "month" ? 60 : zoom === "week" ? 110 : 240, animation: "fadeUp 0.4s ease" }}>
        {loading ? (<div style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, letterSpacing: 3, alignSelf: "center" }}>LOADING TIMELINE...</div>) : days.map(day => (
          <div key={day.date} data-today={day.date === today ? "true" : undefined}><DayCard day={day} isToday={day.date === today} isSelected={selected === day.date} onClick={() => setSelected(selected === day.date ? null : day.date)} zoom={zoom} /></div>
        ))}
      </div>

      {zoom === "month" && days.length > 0 && (<div style={{ marginTop: 8, display: "flex", gap: 0, height: 4, borderRadius: 2, overflow: "hidden" }}>{days.map(day => (<div key={day.date} style={{ flex: 1, background: sentimentColor(day.sentiment), opacity: 0.6 }} />))}</div>)}

      {selectedDay && (
        <div style={{ marginTop: 20, background: "rgba(255,255,255,0.03)", border: `1px solid ${sentimentColor(selectedDay.sentiment)}33`, borderRadius: 12, padding: "16px 20px", animation: "fadeUp 0.25s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700 }}>{new Date(selectedDay.date + "T00:00:00").toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginTop: 2 }}>{selectedDay.emotion?.toUpperCase() || "—"} · RISK {selectedDay.risk_score || "—"}</div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[ { label: "Mood Score",       val: selectedDay.sentiment?.toFixed(2), color: sentimentColor(selectedDay.sentiment) }, { label: "Stress Index",     val: `${Math.round((selectedDay.stress_score||0)*100)}%`, color: stressColor(selectedDay.stress_score) }, { label: "Risk Score",       val: selectedDay.risk_score || "—", color: riskColor(selectedDay.risk_score) }, { label: "Med Adherence",    val: selectedDay.med_adherence === 1 ? "✓ Taken" : selectedDay.med_adherence === 0 ? "✗ Missed" : "Partial", color: selectedDay.med_adherence === 1 ? "#4ade80" : "#f87171" }, { label: "Journal",          val: selectedDay.has_journal ? "✓ Written" : "○ None", color: selectedDay.has_journal ? "#60a5fa" : "rgba(255,255,255,0.3)" }, { label: "Emotion Session",  val: selectedDay.has_session ? "✓ Active" : "○ None", color: selectedDay.has_session ? "#a78bfa" : "rgba(255,255,255,0.3)" }, ].map(({ label, val, color }) => (
              <div key={label}><div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)", letterSpacing: 2, marginBottom: 2 }}>{label.toUpperCase()}</div><div style={{ fontSize: 13, color }}>{val}</div></div>
            ))}
          </div>

          {selectedDay.journal_snippet && (<div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 8, borderLeft: "2px solid rgba(255,255,255,0.1)", fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, fontStyle: "italic" }}>"{selectedDay.journal_snippet}"</div>)}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", letterSpacing: 3, marginBottom: 10 }}>PATTERN INSIGHTS</div>
        <CorrelationInsight days={days} />
      </div>
    </div>
  );
}
