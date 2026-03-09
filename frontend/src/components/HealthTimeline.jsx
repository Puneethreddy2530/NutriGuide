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

const API = import.meta?.env?.VITE_API_URL ?? "";

// Color maps
const sentimentColor = (s) => {
  if (s === null || s === undefined) return "rgba(255,255,255,0.07)";
  if (s > 0.4) return "#16a34a";
  if (s > 0.1) return "#4ade80";
  if (s > -0.1) return "#d97706";
  if (s > -0.4) return "#fb923c";
  return "#ef4444";
};

const stressColor = (s) => {
  if (!s) return "#4ade80";
  if (s > 0.65) return "#f87171";
  if (s > 0.35) return "#facc15";
  return "#4ade80";
};

const riskColor = (r) => {
  if (!r) return "rgba(255,255,255,0.15)";
  if (r > 65) return "#ef4444";
  if (r > 40) return "#d97706";
  return "#16a34a";
};

// ── Life Events: narrative milestones anchored to "N days ago" ──────────────────
const LIFE_EVENTS = [
  { daysAgo: 58, icon: "🌑", label: "Rock Bottom", color: "#ef4444",
    story: "Panic attack at work. Couldn't breathe in the meeting room. Left early.",
    sentiment: -0.82, stress: 0.91, emotion: "anxious" },
  { daysAgo: 55, icon: "💊", label: "Started Medication", color: "#a78bfa",
    story: "Dr. Mehra prescribed sertraline 50mg. Scared but hopeful.",
    sentiment: -0.4, stress: 0.7, emotion: "anxious" },
  { daysAgo: 48, icon: "✍️", label: "First Journal Entry", color: "#60a5fa",
    story: "Started writing every morning. Just 5 minutes. Already feels lighter.",
    sentiment: -0.1, stress: 0.6, emotion: "calm" },
  { daysAgo: 42, icon: "🧠", label: "First Therapy Session", color: "#34d399",
    story: "Talked about the panic attacks. Dr. felt they were work-stress related. CBT plan starts.",
    sentiment: 0.15, stress: 0.55, emotion: "focused" },
  { daysAgo: 35, icon: "😤", label: "Bad Week", color: "#fb923c",
    story: "Fight with Rahul. Project deadline looming. Skipped meds for two days. Relapsed into spiraling.",
    sentiment: -0.65, stress: 0.88, emotion: "stressed" },
  { daysAgo: 28, icon: "🔄", label: "Therapy Breakthrough", color: "#34d399",
    story: "Realized the dread is a pattern from my dad's critical voice. Named it. Feels different now.",
    sentiment: 0.42, stress: 0.35, emotion: "calm" },
  { daysAgo: 21, icon: "🏃", label: "First Run in Months", color: "#00f5d4",
    story: "3km. Slow. Lungs burning. But I did it. First workout since August.",
    sentiment: 0.55, stress: 0.3, emotion: "joy" },
  { daysAgo: 14, icon: "✈️", label: "Weekend Trip", color: "#facc15",
    story: "Pondicherry with college friends. No screens for 2 days. Felt human again.",
    sentiment: 0.78, stress: 0.15, emotion: "joy" },
  { daysAgo: 9, icon: "⚖️", label: "Medication Adjusted", color: "#a78bfa",
    story: "Dose increased to 100mg after 6-week review. Some drowsiness but manageable.",
    sentiment: 0.2, stress: 0.42, emotion: "calm" },
  { daysAgo: 4, icon: "🌿", label: "Good Streak", color: "#4ade80",
    story: "4 days of consistent journaling, meds, and runs. This is what stability feels like.",
    sentiment: 0.6, stress: 0.28, emotion: "focused" },
  { daysAgo: 1, icon: "☀️", label: "Yesterday", color: "#60a5fa",
    story: "Productive day. Got through the backlog. Slept before midnight for the first time this month.",
    sentiment: 0.52, stress: 0.3, emotion: "calm" },
  { daysAgo: 0, icon: "📍", label: "Today", color: "#ffffff",
    story: "Opening NeoPulse. Mood feels stable. Let's see what the day brings.",
    sentiment: 0.35, stress: 0.32, emotion: "calm" },
];

// ── Richer mock data generator with embedded life narrative ──────────────────
function generateMockDays(n = 60) {
  const days = [];
  let sentiment = -0.6;
  let stress = 0.85;

  // Seed the story snippets per phase
  const SNIPPETS_BY_PHASE = {
    dark: [
      "Can't concentrate at work. Everything feels heavy.",
      "Woke up dreading the day. Stayed in bed too long.",
      "Had to excuse myself from a call — couldn't hold it together.",
      "Barely functional. Just going through motions.",
      "Texted nobody back today.",
    ],
    turning: [
      "It's not better, but I wrote about it. That helped a little.",
      "Went outside for 10 minutes. First time in days.",
      "Therapy today. Cried a lot but felt heard.",
      "Meds starting maybe? Or placebo? Either way, less sharp edges.",
      "Journaling every day even if it's just 3 sentences.",
    ],
    recovering: [
      "Actually laughed today. Forgot what that felt like.",
      "Workout done. Dinner cooked. Day felt normal.",
      "Good session with Dr. Mehra. Progress is real.",
      "Less noise in my head. More space to think clearly.",
      "Slept 7 hours straight. Record for this month.",
    ],
    good: [
      "Felt focused today, got a lot done.",
      "Great session with journaling. Mind feels clear.",
      "Calm day, took a walk, felt present.",
      "Medication taken. Mood lifted by afternoon.",
      "Good progress, feeling stable and grateful.",
    ],
  };

  // Build event lookup by daysAgo
  const eventByDaysAgo = {};
  LIFE_EVENTS.forEach(ev => { eventByDaysAgo[ev.daysAgo] = ev; });

  for (let i = n - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const daysAgo = i;

    // Check if this day has a life event
    const lifeEvent = eventByDaysAgo[daysAgo];

    if (lifeEvent) {
      // Anchor mood/stress to event values
      sentiment = lifeEvent.sentiment;
      stress = lifeEvent.stress;
    } else {
      // Drift toward recovery arc
      const targetSentiment = daysAgo > 50 ? -0.6
        : daysAgo > 37 ? -0.3
          : daysAgo > 25 ? 0.1
            : daysAgo > 10 ? 0.45
              : 0.4;
      const targetStress = daysAgo > 50 ? 0.85
        : daysAgo > 37 ? 0.7
          : daysAgo > 25 ? 0.4
            : 0.3;
      sentiment += (targetSentiment - sentiment) * 0.15 + (Math.random() - 0.5) * 0.2;
      stress += (targetStress - stress) * 0.15 + (Math.random() - 0.5) * 0.18;
    }

    sentiment = Math.max(-1, Math.min(1, sentiment));
    stress = Math.max(0, Math.min(1, stress));

    const phase = sentiment < -0.3 ? "dark" : sentiment < 0.1 ? "turning" : sentiment < 0.4 ? "recovering" : "good";
    const snippets = SNIPPETS_BY_PHASE[phase];

    const emotions = {
      dark: ["anxious", "fatigued", "stressed"],
      turning: ["anxious", "calm", "fatigued"],
      recovering: ["calm", "focused", "calm"],
      good: ["focused", "joy", "calm"],
    }[phase];

    days.push({
      date: date.toISOString().split("T")[0],
      sentiment: Math.round(sentiment * 100) / 100,
      stress_score: Math.round(stress * 100) / 100,
      risk_score: Math.round((stress * 0.5 + (1 - (sentiment + 1) / 2) * 0.4 + 0.1) * 80 + 10),
      journal_snippet: lifeEvent
        ? lifeEvent.story
        : Math.random() > 0.35 ? snippets[Math.floor(Math.random() * snippets.length)] : null,
      med_adherence: daysAgo > 55 ? 0
        : daysAgo > 50 ? (Math.random() > 0.3 ? 1 : 0)
          : daysAgo === 35 || daysAgo === 36 ? 0
            : Math.random() > 0.15 ? 1 : 0.5,
      emotion: lifeEvent
        ? lifeEvent.emotion
        : emotions[Math.floor(Math.random() * emotions.length)],
      has_journal: lifeEvent ? true : Math.random() > (phase === "dark" ? 0.7 : 0.35),
      has_session: Math.random() > (phase === "dark" ? 0.8 : 0.5),
      life_event: lifeEvent || null,
    });
  }
  return days;
}

// ── Event Tape — milestone markers above the timeline ────────────────────────
function EventTape({ days, selectedDate, onSelect }) {
  const evDays = days.filter(d => d.life_event);
  if (!evDays.length) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 7, color: "rgba(96,165,250,0.20)", letterSpacing: 3, marginBottom: 8 }}>
        LIFE EVENTS
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {evDays.map(d => {
          const ev = d.life_event;
          const isSelected = selectedDate === d.date;
          return (
            <button
              key={d.date}
              onClick={() => onSelect(d.date)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 10px",
                background: isSelected ? `${ev.color}22` : "rgba(96,165,250,0.20)",
                border: `1px solid ${isSelected ? ev.color + "80" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 20, cursor: "pointer",
                fontFamily: "'DM Mono', monospace",
                fontSize: 8, color: isSelected ? ev.color : "rgba(255,255,255,0.32)",
                letterSpacing: 1,
                transition: "all 0.2s",
              }}
            >
              <span style={{ fontSize: 10 }}>{ev.icon}</span>
              {ev.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Story Reel — what happened each milestone ─────────────────────────────────
function StoryReel({ days }) {
  const evDays = days.filter(d => d.life_event).slice(-6);
  if (!evDays.length) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 8, color: "rgba(96,165,250,0.20)", letterSpacing: 3, marginBottom: 12 }}>
        YOUR STORY SO FAR
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {evDays.map((d, i) => {
          const ev = d.life_event;
          const isLast = i === evDays.length - 1;
          return (
            <div key={d.date} style={{ display: "flex", gap: 14, position: "relative" }}>
              {/* Timeline spine */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28, flexShrink: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: `${ev.color}18`,
                  border: `1.5px solid ${ev.color}60`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, flexShrink: 0, zIndex: 1,
                }}>
                  {ev.icon}
                </div>
                {!isLast && (
                  <div style={{
                    width: 1, flex: 1, minHeight: 20,
                    background: "rgba(96,165,250,0.20)",
                    margin: "3px 0",
                  }} />
                )}
              </div>
              {/* Content */}
              <div style={{ paddingBottom: isLast ? 0 : 16, flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: ev.color, letterSpacing: 0.5 }}>
                    {ev.label}
                  </div>
                  <div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)", letterSpacing: 1, flexShrink: 0 }}>
                    {new Date(d.date + "T00:00:00").toLocaleDateString("en", { month: "short", day: "numeric" })}
                  </div>
                </div>
                <div style={{
                  fontSize: 9, color: "rgba(255,255,255,0.4)",
                  lineHeight: 1.6, fontStyle: "italic",
                }}>
                  "{ev.story}"
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
                  <div style={{ fontSize: 7, color: sentimentColor(d.sentiment), letterSpacing: 1 }}>
                    MOOD {d.sentiment > 0 ? "+" : ""}{d.sentiment}
                  </div>
                  <div style={{ fontSize: 7, color: stressColor(d.stress_score), letterSpacing: 1 }}>
                    STRESS {Math.round(d.stress_score * 100)}%
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Day Card ───────────────────────────────────────────────────────────────────
function DayCard({ day, isToday, isSelected, onClick, zoom }) {
  const sColor = sentimentColor(day.sentiment);
  const stColor = stressColor(day.stress_score);
  const rkColor = riskColor(day.risk_score);
  const evColor = day.life_event?.color;

  const dateObj = new Date(day.date + "T00:00:00");
  const dayName = dateObj.toLocaleDateString("en", { weekday: "short" });
  const dayNum = dateObj.getDate();
  const monthAbbr = dateObj.toLocaleDateString("en", { month: "short" });

  if (zoom === "month") {
    // Compact: just a colored strip
    return (
      <div
        onClick={onClick}
        title={`${day.date} · ${day.emotion || "—"}`}
        style={{
          width: 12,
          height: 40,
          background: sColor,
          borderRadius: 2,
          opacity: 0.7,
          cursor: "pointer",
          flexShrink: 0,
          transition: "opacity 0.2s, transform 0.2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.transform = "scaleY(1.3)"; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = 0.7; e.currentTarget.style.transform = "scaleY(1)"; }}
      />
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        width: zoom === "week" ? 80 : 140,
        flexShrink: 0,
        background: isSelected
          ? `${sColor}12`
          : isToday
            ? "rgba(96,165,250,0.20)"
            : evColor
              ? `${evColor}09`
              : "#fff",
        border: isSelected
          ? `1px solid ${sColor}88`
          : isToday
            ? "1px solidrgba(96,165,250,0.20)"
            : evColor
              ? `1px solid ${evColor}40`
              : "1px solid rgba(255,255,255,0.07)",
        borderTop: `3px solid ${evColor || sColor}`,
        boxShadow: evColor && !isSelected ? `0 0 12px ${evColor}18` : "none",
        borderRadius: 10,
        padding: zoom === "week" ? "8px 8px" : "10px 12px",
        cursor: "pointer",
        transition: "background 0.2s, border 0.2s, transform 0.15s",
        transform: isSelected ? "translateY(-4px)" : "none",
        fontFamily: "'DM Mono', monospace",
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(96,165,250,0.20)"; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isToday ? "rgba(96,165,250,0.20)" : "#fff"; }}
    >
      {/* Date header */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 7, color: "rgba(255,255,255,0.28)", letterSpacing: 2 }}>
          {dayName.toUpperCase()} {monthAbbr.toUpperCase()}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{
            fontSize: zoom === "week" ? 18 : 22,
            fontWeight: 700, color: isToday ? "#60a5fa" : "rgba(255,255,255,0.88)",
            lineHeight: 1,
          }}>
            {dayNum}
            {isToday && <span style={{ fontSize: 7, color: "#60a5fa", marginLeft: 4 }}>TODAY</span>}
          </div>
          {evColor && (
            <div style={{
              fontSize: 10,
              title: day.life_event?.label,
              filter: `drop-shadow(0 0 4px ${evColor})`,
            }}>
              {day.life_event?.icon}
            </div>
          )}
        </div>
      </div>

      {zoom !== "week" && (
        <>
          {/* Sentiment bar */}
          <div style={{ marginBottom: 5 }}>
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)", letterSpacing: 1, marginBottom: 2 }}>
              MOOD
            </div>
            <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
              <div style={{
                height: "100%",
                width: `${((day.sentiment + 1) / 2) * 100}%`,
                background: sColor,
                borderRadius: 2,
              }} />
            </div>
          </div>

          {/* Stress dot */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: stColor,
              boxShadow: `0 0 6px ${stColor}`,
            }} />
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.3)" }}>
              STRESS {Math.round((day.stress_score || 0) * 100)}%
            </div>
          </div>

          {/* Risk chip */}
          {day.risk_score && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 6px",
              background: `${rkColor}18`,
              border: `1px solid ${rkColor}33`,
              borderRadius: 3,
              marginBottom: 6,
            }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: rkColor }} />
              <div style={{ fontSize: 7, color: rkColor, letterSpacing: 1 }}>
                {day.risk_score}
              </div>
            </div>
          )}

          {/* Journal snippet */}
          {day.journal_snippet && (
            <div style={{
              fontSize: 8,
              color: "rgba(255,255,255,0.4)",
              lineHeight: 1.5,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}>
              "{day.journal_snippet}"
            </div>
          )}

          {/* Icons */}
          <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
            {day.has_journal && <div title="Journal entry" style={{ fontSize: 9, opacity: 0.5 }}>✍</div>}
            {day.has_session && <div title="Emotion session" style={{ fontSize: 9, opacity: 0.5 }}>◎</div>}
            {day.med_adherence === 1 && <div title="Meds taken" style={{ fontSize: 9, opacity: 0.5 }}>●</div>}
            {day.med_adherence === 0 && <div title="Meds missed" style={{ fontSize: 9, color: "#f87171", opacity: 0.7 }}>○</div>}
          </div>
        </>
      )}

      {/* Week zoom: condensed */}
      {zoom === "week" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ height: 2, background: sColor, borderRadius: 1 }} />
          <div style={{ fontSize: 7, color: stColor }}>
            {Math.round((day.stress_score || 0) * 100)}%
          </div>
        </div>
      )}
    </div>
  );
}

// ── Correlation insight ────────────────────────────────────────────────────────
function CorrelationInsight({ days }) {
  if (days.length < 7) return null;

  // Simple Pearson correlation
  const pearson = (xs, ys) => {
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    const num = xs.reduce((acc, x, i) => acc + (x - mx) * (ys[i] - my), 0);
    const den = Math.sqrt(
      xs.reduce((a, x) => a + (x - mx) ** 2, 0) *
      ys.reduce((a, y) => a + (y - my) ** 2, 0)
    );
    return den === 0 ? 0 : num / den;
  };

  const sentiments = days.map(d => d.sentiment || 0);
  const stresses = days.map(d => d.stress_score || 0);
  const adherence = days.map(d => d.med_adherence || 0);

  const stressMoodCorr = pearson(stresses, sentiments);
  const medMoodCorr = pearson(adherence, sentiments);

  const insights = [];
  if (Math.abs(stressMoodCorr) > 0.4) {
    insights.push({
      icon: "◉",
      color: "#fb923c",
      text: `Stress and mood are ${stressMoodCorr < 0 ? "negatively" : "positively"} correlated (${Math.abs(stressMoodCorr * 100).toFixed(0)}%). ${stressMoodCorr < -0.5 ? "High stress is dragging your mood." : ""}`,
    });
  }
  if (Math.abs(medMoodCorr) > 0.3) {
    insights.push({
      icon: "●",
      color: "#4ade80",
      text: `Medication adherence has a ${medMoodCorr > 0 ? "positive" : "negative"} correlation with mood (${Math.abs(medMoodCorr * 100).toFixed(0)}%).`,
    });
  }
  if (insights.length === 0) {
    insights.push({
      icon: "◎",
      color: "rgba(255,255,255,0.25)",
      text: "No strong correlations yet — keep logging for at least 2 weeks.",
    });
  }

  return (
    <div style={{
      display: "flex", gap: 10,
      flexWrap: "wrap",
    }}>
      {insights.map((ins, i) => (
        <div key={i} style={{
          display: "flex", gap: 8, alignItems: "flex-start",
          background: "#fff",
          border: "1px solidrgba(96,165,250,0.20)",
          borderRadius: 8, padding: "8px 12px",
          boxShadow: "0 1px 4px rgba(96,165,250,0.20)",
          flex: "1 1 200px",
        }}>
          <span style={{ color: ins.color, fontSize: 10 }}>{ins.icon}</span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
            {ins.text}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function HealthTimeline({ token }) {
  const scrollRef = useRef(null);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [selected, setSelected] = useState(null);
  const [zoom, setZoom] = useState("day");   // "day" | "week" | "month"
  const [range, setRange] = useState(30);

  const today = new Date().toISOString().split("T")[0];

  const loadTimeline = useCallback(async (fallbackToMock = false) => {
    setLoading(true);
    setBackendError(null);
    setUsingFallback(false);
    try {
      const r = await fetch(`${API}/dashboard/timeline?days=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(txt || `Timeline API failed (${r.status})`);
      }
      const d = await r.json();
      setDays(Array.isArray(d.days) ? d.days : []);
    } catch (e) {
      const msg = e?.message || "Timeline backend unavailable.";
      setBackendError(msg);
      if (fallbackToMock) {
        setDays(generateMockDays(range));
        setUsingFallback(true);
      } else {
        setDays([]);
      }
    } finally {
      setLoading(false);
    }
  }, [range, token]);

  // Fetch timeline data
  useEffect(() => {
    loadTimeline(false);
  }, [loadTimeline]);

  // Auto-scroll to today on load
  useEffect(() => {
    if (days.length && scrollRef.current) {
      setTimeout(() => {
        const todayEl = scrollRef.current.querySelector("[data-today='true']");
        todayEl?.scrollIntoView({ behavior: "smooth", inline: "center" });
      }, 300);
    }
  }, [days]);

  const selectedDay = days.find(d => d.date === selected);

  const avgSentiment = days.length
    ? (days.reduce((a, d) => a + (d.sentiment || 0), 0) / days.length).toFixed(2)
    : "—";
  const avgStress = days.length
    ? Math.round(days.reduce((a, d) => a + (d.stress_score || 0), 0) / days.length * 100)
    : "—";
  const journalDays = days.filter(d => d.has_journal).length;

  return (
    <div style={{
      fontFamily: "'DM Mono', monospace",
      background: "radial-gradient(ellipse at 50% -10%, #0d0a2e 0%, #030308 60%)",
      minHeight: "100vh",
      padding: "28px 24px",
      color: "rgba(255,255,255,0.88)",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        .tl-scroll::-webkit-scrollbar { height: 3px; }
        .tl-scroll::-webkit-scrollbar-track { background:rgba(96,165,250,0.20); }
        .tl-scroll::-webkit-scrollbar-thumb { background:rgba(96,165,250,0.20); border-radius: 2px; }
        .zoom-btn:hover { background:rgba(96,165,250,0.20)!important; }
        .range-btn:hover { opacity: 1 !important; }
      `}</style>

      {/* Dashboard Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 28, fontWeight: 800, fontStyle: "italic",
          letterSpacing: -0.5, color: "#60a5fa",
        }}>
          Life Tape 📅
        </div>
        <div style={{ fontSize: 8, color: "rgba(96,165,250,0.20)", letterSpacing: 4, marginTop: 2 }}>
          YOUR HEALTH STORY · DAY BY DAY
        </div>
        <div style={{
          fontSize: 12, color: "rgba(255,255,255,0.32)",
          fontFamily: "'DM Mono', monospace",
          marginTop: 6, letterSpacing: 0.2, fontWeight: 400,
        }}>
          Scroll through your personal health story — mood, stress, and medication day by day
        </div>
      </div>

      {backendError && (
        <div style={{
          marginBottom: 14,
          background: usingFallback ? "rgba(234,179,8,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${usingFallback ? "rgba(234,179,8,0.35)" : "rgba(239,68,68,0.35)"}`,
          borderRadius: 10,
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}>
          <div style={{ fontSize: 10, color: usingFallback ? "#a16207" : "#b91c1c", letterSpacing: 0.4 }}>
            {usingFallback
              ? `Timeline API failed. Showing demo fallback data. ${backendError}`
              : `Timeline API failed. ${backendError}`}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!usingFallback && (
              <button onClick={() => loadTimeline(true)} style={{
                fontSize: 9, letterSpacing: 1.2, padding: "6px 10px", borderRadius: 8,
                border: "1px solid rgba(234,179,8,0.45)", background: "rgba(234,179,8,0.14)", color: "#a16207", cursor: "pointer",
              }}>
                USE DEMO DATA
              </button>
            )}
            <button onClick={() => loadTimeline(usingFallback)} style={{
              fontSize: 9, letterSpacing: 1.2, padding: "6px 10px", borderRadius: 8,
              border: "1px solidrgba(96,165,250,0.20)", background: "rgba(96,165,250,0.20)", color: "#c2410c", cursor: "pointer",
            }}>
              RETRY
            </button>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "AVG MOOD", val: avgSentiment, color: sentimentColor(parseFloat(avgSentiment)) },
          { label: "AVG STRESS", val: `${avgStress}%`, color: stressColor(avgStress / 100) },
          { label: "JOURNAL DAYS", val: journalDays, color: "#2563eb" },
          { label: "DAYS TRACKED", val: days.length, color: "rgba(255,255,255,0.32)" },
        ].map(({ label, val, color }) => (
          <div key={label} style={{
            background: "#fff",
            border: "1px solidrgba(96,165,250,0.20)",
            borderRadius: 10, padding: "10px 16px",
            boxShadow: "0 1px 6px rgba(96,165,250,0.20)",
          }}>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.28)", letterSpacing: 2, marginBottom: 3 }}>
              {label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        {/* Zoom */}
        <div style={{ display: "flex", gap: 4 }}>
          {["day", "week", "month"].map(z => (
            <button key={z} className="zoom-btn" onClick={() => setZoom(z)} style={{
              padding: "5px 12px",
              background: zoom === z ? "rgba(96,165,250,0.20)" : "transparent",
              border: `1px solid ${zoom === z ? "rgba(96,165,250,0.20)" : "rgba(255,255,255,0.07)"}`,
              borderRadius: 5, color: zoom === z ? "#60a5fa" : "rgba(255,255,255,0.3)",
              fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: 2,
              cursor: "pointer", transition: "all 0.2s", textTransform: "uppercase",
            }}>
              {z}
            </button>
          ))}
        </div>

        {/* Range */}
        <div style={{ display: "flex", gap: 6 }}>
          {[14, 30, 60, 90].map(r => (
            <button key={r} className="range-btn" onClick={() => setRange(r)} style={{
              fontSize: 8, letterSpacing: 1,
              background: "none", border: "none",
              color: range === r ? "#60a5fa" : "rgba(255,255,255,0.25)",
              cursor: "pointer", opacity: range === r ? 1 : 0.6,
              transition: "opacity 0.2s",
              fontFamily: "'DM Mono', monospace",
            }}>
              {r}D
            </button>
          ))}
        </div>
      </div>

      {/* Event tape */}
      {!loading && days.length > 0 && (
        <EventTape
          days={days}
          selectedDate={selected}
          onSelect={(date) => {
            setSelected(prev => prev === date ? null : date);
            setTimeout(() => {
              const el = scrollRef.current?.querySelector(`[data-date="${date}"]`);
              el?.scrollIntoView({ behavior: "smooth", inline: "center" });
            }, 100);
          }}
        />
      )}

      {/* Timeline scroll */}
      <div
        ref={scrollRef}
        className="tl-scroll"
        style={{
          display: "flex",
          gap: zoom === "month" ? 2 : 8,
          overflowX: "auto",
          paddingBottom: 12,
          paddingTop: 4,
          alignItems: zoom === "month" ? "flex-end" : "flex-start",
          minHeight: zoom === "month" ? 60 : zoom === "week" ? 110 : 240,
          animation: "fadeUp 0.4s ease",
        }}
      >
        {loading ? (
          <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, letterSpacing: 3, alignSelf: "center" }}>
            LOADING TIMELINE...
          </div>
        ) : days.map(day => (
          <div key={day.date} data-today={day.date === today ? "true" : undefined} data-date={day.date}>
            <DayCard
              day={day}
              isToday={day.date === today}
              isSelected={selected === day.date}
              onClick={() => setSelected(selected === day.date ? null : day.date)}
              zoom={zoom}
            />
          </div>
        ))}
      </div>

      {/* Mood river (month view gradient) */}
      {zoom === "month" && days.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", gap: 0, height: 4, borderRadius: 2, overflow: "hidden" }}>
          {days.map(day => (
            <div key={day.date} style={{
              flex: 1,
              background: sentimentColor(day.sentiment),
              opacity: 0.6,
            }} />
          ))}
        </div>
      )}

      {/* Selected day detail */}
      {selectedDay && (
        <div style={{
          marginTop: 20,
          background: "#fff",
          border: `1px solid ${sentimentColor(selectedDay.sentiment)}44`,
          borderRadius: 12,
          padding: "16px 20px",
          boxShadow: "0 4px 20px rgba(96,165,250,0.20)",
          animation: "fadeUp 0.25s ease",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.88)" }}>
                {new Date(selectedDay.date + "T00:00:00").toLocaleDateString("en", {
                  weekday: "long", month: "long", day: "numeric",
                })}
              </div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.28)", letterSpacing: 2, marginTop: 2 }}>
                {selectedDay.emotion?.toUpperCase() || "—"} · RISK {selectedDay.risk_score || "—"}
              </div>
            </div>
            <button onClick={() => setSelected(null)} style={{
              background: "none", border: "none", color: "rgba(255,255,255,0.25)",
              cursor: "pointer", fontSize: 14,
            }}>✕</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              { label: "Mood Score", val: selectedDay.sentiment?.toFixed(2), color: sentimentColor(selectedDay.sentiment) },
              { label: "Stress Index", val: `${Math.round((selectedDay.stress_score || 0) * 100)}%`, color: stressColor(selectedDay.stress_score) },
              { label: "Risk Score", val: selectedDay.risk_score || "—", color: riskColor(selectedDay.risk_score) },
              { label: "Med Adherence", val: selectedDay.med_adherence === 1 ? "✓ Taken" : selectedDay.med_adherence === 0 ? "✗ Missed" : "Partial", color: selectedDay.med_adherence === 1 ? "#4ade80" : "#f87171" },
              { label: "Journal", val: selectedDay.has_journal ? "✓ Written" : "○ None", color: selectedDay.has_journal ? "#2563eb" : "rgba(255,255,255,0.25)" },
              { label: "Emotion Session", val: selectedDay.has_session ? "✓ Active" : "○ None", color: selectedDay.has_session ? "#7c3aed" : "rgba(255,255,255,0.25)" },
            ].map(({ label, val, color }) => (
              <div key={label}>
                <div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)", letterSpacing: 2, marginBottom: 2 }}>{label.toUpperCase()}</div>
                <div style={{ fontSize: 13, color }}>{val}</div>
              </div>
            ))}
          </div>

          {selectedDay.journal_snippet && (
            <div style={{
              marginTop: 12, padding: "10px 14px",
              background: "rgba(96,165,250,0.20)",
              borderRadius: 8, borderLeft: "2px solidrgba(96,165,250,0.20)",
              fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1.6,
              fontStyle: "italic",
            }}>
              "{selectedDay.journal_snippet}"
            </div>
          )}
        </div>
      )}

      {/* Correlation insights */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 8, color: "rgba(96,165,250,0.20)", letterSpacing: 3, marginBottom: 10 }}>
          PATTERN INSIGHTS
        </div>
        <CorrelationInsight days={days} />
      </div>

      {/* Story reel */}
      {days.length > 0 && <StoryReel days={days} />}
    </div>
  );
}

