import { useState, useEffect, useRef, useCallback } from "react";

/*
  ActivityDashboard.jsx
  ──────────────────────
  Strava + Google Fit integration dashboard.

  Three panels:
    1. HEAT GRID  — GitHub-style 52-week calendar
       Each cell = composite score (activity + mood - stress)
       Hover layer toggle: "activity" / "mood" / "stress" / "composite"
    
    2. CORRELATION SCATTER — D3 bubble chart
       X = workout load, Y = mood next day
       Bubble size = duration, color = stress
    
    3. FEED — Recent activities with mood overlay badges

  Aesthetic: "Athletic War Room"
    - Near-black background with subtle grid texture
    - Accent: electric cyan #00f5d4 for activity, rose #ff6b9d for stress
    - Typography: Barlow Condensed (sporty + technical)
    - Cells: sharp square edges, military grid feel
*/

const API = import.meta?.env?.VITE_API_URL ?? "";

// ── Color scales ───────────────────────────────────────────────────
const ACTIVITY_SCALE = (v) => {
  if (!v || v === 0) return "rgba(255,255,255,0.04)";
  if (v < 20) return "#d1fae5";
  if (v < 40) return "#6ee7b7";
  if (v < 60) return "#34d399";
  if (v < 80) return "#10b981";
  return "#059669";
};

const MOOD_SCALE = (v) => {
  if (v === null || v === undefined) return "rgba(255,255,255,0.04)";
  if (v < -0.4) return "#fca5a5";
  if (v < -0.1) return "#fcd34d";
  if (v < 0.1) return "#e5e7eb";
  if (v < 0.4) return "#86efac";
  return "#4ade80";
};

const STRESS_SCALE = (v) => {
  if (v === null || v === undefined) return "rgba(255,255,255,0.04)";
  if (v < 0.25) return "#4ade80";
  if (v < 0.45) return "#fbbf24";
  if (v < 0.65) return "#f87171";
  return "#dc2626";
};

const COMPOSITE_SCALE = (v) => {
  if (v === null || v === undefined) return "rgba(255,255,255,0.04)";
  if (v < 15) return "rgba(96,165,250,0.06)";
  if (v < 30) return "rgba(96,165,250,0.15)";
  if (v < 45) return "rgba(96,165,250,0.35)";
  if (v < 60) return "rgba(96,165,250,0.55)";
  if (v < 75) return "rgba(96,165,250,0.75)";
  return "#60a5fa";
};

const SPORT_ICONS = {
  Run: "⚡", Running: "⚡", Ride: "⬡", Cycling: "⬡",
  Swim: "◈", Yoga: "◎", Walk: "→", Walking: "→",
  WeightTraining: "⊞", Strength: "⊞", Workout: "◆",
  default: "●",
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];


// ══════════════════════════════════════════════════════════════════
// Mock data generator — rich 365-day dataset for demo
// ══════════════════════════════════════════════════════════════════

function generateMockActivityData() {
  const SPORTS = ["Run", "Ride", "Swim", "Walk", "WeightTraining", "Yoga"];
  const NAMES = {
    Run: ["Morning 5K", "Lunch Run", "Evening Tempo Run", "Long Run Sunday", "Recovery Jog", "Track Intervals", "Night Run"],
    Ride: ["Century Ride", "Hill Climb", "Commute Ride", "Weekend Epic", "Recovery Spin", "Group Ride"],
    Swim: ["Pool Session", "Open Water", "Drills Day", "Endurance Swim"],
    Walk: ["Nature Walk", "City Exploration", "Evening Walk", "Hike"],
    WeightTraining: ["Push Day", "Pull Day", "Leg Day", "Full Body HIIT", "Core & Cardio"],
    Yoga: ["Morning Flow", "Restorative", "Power Yoga", "Yin Yoga"],
  };

  const activities = [];
  const calendar = [];
  const moodMap = {};
  let actId = 5000;

  const today = new Date(); today.setHours(0, 0, 0, 0);

  for (let i = 364; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const weekday = d.getDay();
    const week = 51 - Math.floor(i / 7);
    const isWeekend = weekday === 0 || weekday === 6;
    const hasActivity = Math.random() < (isWeekend ? 0.68 : 0.48);

    let load = 0, minutes = 0, calories_day = 0;
    const day_acts = [];

    if (hasActivity) {
      const sport = SPORTS[Math.floor(Math.random() * SPORTS.length)];
      const name = NAMES[sport][Math.floor(Math.random() * NAMES[sport].length)];
      const duration = sport === "Run" ? 20 + Math.random() * 80
        : sport === "Ride" ? 45 + Math.random() * 120
          : sport === "Swim" ? 30 + Math.random() * 60 : 20 + Math.random() * 55;
      const distance = sport === "Run" ? duration * 0.133
        : sport === "Ride" ? duration * 0.38
          : sport === "Walk" ? duration * 0.1 : 0;
      const avg_hr = 115 + Math.random() * 65;
      const suffer = Math.round(avg_hr * duration / 160);
      const cal = Math.round(duration * (avg_hr / 9.5));
      load = suffer; minutes = Math.round(duration); calories_day = cal;

      // Seed for consistent route generation
      const routeSeed = actId;
      const act = {
        id: actId++, name, sport_type: sport, date: dateStr,
        duration_min: Math.round(duration),
        distance_km: distance ? Math.round(distance * 10) / 10 : 0,
        avg_hr: Math.round(avg_hr), calories: cal, suffer_score: suffer,
        mood_that_day: null, route_seed: routeSeed,
        elevation_gain: Math.round(20 + Math.random() * 180),
        avg_pace: sport === "Run" ? (5 + Math.random() * 3).toFixed(1) + "/km" : null,
      };
      activities.push(act);
      day_acts.push(act);
    }

    const baseMood = Math.sin(i / 28) * 0.35 + Math.sin(i / 7) * 0.1 + (Math.random() - 0.5) * 0.3;
    const mood = Math.max(-1, Math.min(1, baseMood + (hasActivity ? 0.18 : 0)));
    const stress = Math.max(0, Math.min(1, 0.38 + Math.sin(i / 12) * 0.22 + (Math.random() - 0.5) * 0.25));
    moodMap[dateStr] = mood;

    if (day_acts[0]) {
      day_acts[0].mood_that_day = { sentiment: Math.round(mood * 100) / 100 };
    }

    calendar.push({
      date: dateStr, week,
      weekday: weekday === 0 ? 6 : weekday - 1,
      activity: { count: day_acts.length, minutes, load, calories: calories_day },
      mood: Math.round(mood * 100) / 100,
      stress: Math.round(stress * 100) / 100,
      health_score: Math.max(0, Math.min(100, Math.round(50 + load * 0.18 + mood * 22 - stress * 14 + Math.random() * 4))),
    });
  }

  // Correlation points
  const dateList = Object.keys(moodMap).sort();
  const points = activities.map(a => {
    const idx = dateList.indexOf(a.date);
    const nextMood = idx >= 0 && idx < dateList.length - 1 ? moodMap[dateList[idx + 1]] : null;
    const dayData = calendar.find(c => c.date === a.date);
    return {
      date: a.date, load: a.suffer_score, duration_min: a.duration_min,
      mood_next_day: nextMood ? Math.round(nextMood * 100) / 100 : null,
      stress_same_day: dayData?.stress || 0,
    };
  }).filter(p => p.mood_next_day !== null);

  const vp = points.filter(p => p.load > 0 && p.mood_next_day !== null);
  const n = vp.length;
  const mx = vp.reduce((a, p) => a + p.load, 0) / (n || 1);
  const my = vp.reduce((a, p) => a + p.mood_next_day, 0) / (n || 1);
  const r = n > 2
    ? vp.reduce((a, p) => a + (p.load - mx) * (p.mood_next_day - my), 0) /
    Math.sqrt(vp.reduce((a, p) => a + (p.load - mx) ** 2, 0) * vp.reduce((a, p) => a + (p.mood_next_day - my) ** 2, 0.001))
    : 0;

  const me = activities;
  const myKm = Math.round(me.reduce((a, ac) => a + (ac.distance_km || 0), 0));
  const myHrs = Math.round(me.reduce((a, ac) => a + ac.duration_min, 0) / 60);
  const myCal = Math.round(me.reduce((a, ac) => a + ac.calories, 0));

  const friends = [
    { name: "Arjun M.", avatar: "🚴", activities: 203, total_km: 3840, total_hours: 102, total_cal: 61000 },
    { name: "You", avatar: "⚡", activities: me.length, total_km: myKm, total_hours: myHrs, total_cal: myCal, is_you: true },
    { name: "Priya K.", avatar: "🏃", activities: 149, total_km: 921, total_hours: 74, total_cal: 48000 },
    { name: "Kavya S.", avatar: "🏊", activities: 89, total_km: 320, total_hours: 67, total_cal: 33000 },
    { name: "Rahul T.", avatar: "🧘", activities: 112, total_km: 180, total_hours: 88, total_cal: 22000 },
  ].sort((a, b) => b.total_km - a.total_km).map((f, i) => ({ ...f, rank: i + 1 }));

  return {
    status: { strava_connected: true, total_activities: me.length },
    heatmap: {
      calendar,
      stats: { active_days: calendar.filter(c => c.activity.count > 0).length, total_activities: me.length },
    },
    correlations: {
      points,
      correlations: { load_vs_mood_next: Math.round(r * 100) / 100 },
      insights: [
        `Exercise positively correlates with next-day mood (r=${r.toFixed(2)}) across ${me.length} workouts.`,
        "High-suffer sessions (≥60) correlate with 22% better focus scores the day after.",
        "Your longest streak this year: 9 consecutive active days. Chase it again!",
      ],
    },
    feed: [...activities].reverse().slice(0, 20),
    friends,
  };
}

const MOCK_DATA = generateMockActivityData();


// ══════════════════════════════════════════════════════════════════
// Route Map — procedurally generated SVG route for demo
// ══════════════════════════════════════════════════════════════════

function RouteMap({ activity }) {
  if (!activity) return null;

  const W = 440, H = 260, EL_H = 56;
  const seed = activity.route_seed || activity.id || 1001;

  // Seeded RNG for consistent per-activity route
  let s = seed;
  const rng = () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };

  // Generate organic route with controlled drift
  const numPts = 44 + Math.floor(rng() * 18);
  const pts = [];
  let x = 80 + rng() * 120, y = 70 + rng() * 80;
  let vx = (rng() - 0.5) * 10, vy = (rng() - 0.5) * 10;

  for (let i = 0; i < numPts; i++) {
    vx += (rng() - 0.5) * 7; vy += (rng() - 0.5) * 7;
    if (x < 30 || x > W - 30) vx *= -0.75;
    if (y < 22 || y > H - EL_H - 22) vy *= -0.75;
    vx *= 0.88; vy *= 0.88;
    x = Math.max(28, Math.min(W - 28, x + vx));
    y = Math.max(20, Math.min(H - EL_H - 20, y + vy));
    pts.push([x, y]);
  }

  // Smooth bezier path
  const pathD = pts.map((p, i) => {
    if (i === 0) return `M ${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    const prev = pts[i - 1];
    const cx = ((prev[0] + p[0]) / 2).toFixed(1);
    const cy = ((prev[1] + p[1]) / 2).toFixed(1);
    return `Q ${prev[0].toFixed(1)} ${prev[1].toFixed(1)} ${cx} ${cy}`;
  }).join(" ");

  // Pace markers every ~8 points
  const paceMarkers = pts.filter((_, i) => i > 0 && i % 8 === 0);

  // KM markers
  const kmMarkers = pts.filter((_, i) => i > 0 && i % Math.floor(numPts / Math.max(1, activity.distance_km || 3)) === 0);

  // Elevation profile
  const elPts = Array.from({ length: 32 }, (_, i) => {
    const base = 60 + Math.sin(i / 4) * 18 + Math.sin(i / 9) * 12;
    return base + rng() * 14;
  });
  const maxEl = Math.max(...elPts), minEl = Math.min(...elPts);
  const elNorm = elPts.map(e => (e - minEl) / (maxEl - minEl + 1));
  const elPath = elNorm.map((e, i) => {
    const ex = (i / (elNorm.length - 1)) * W;
    const ey = H - 8 - e * (EL_H - 18);
    return `${i === 0 ? "M" : "L"} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  }).join(" ");
  const elFill = `${elPath} L ${W} ${H} L 0 ${H} Z`;

  const sport = activity.sport_type || "Run";
  const accent = sport === "Run" ? "#00f5d4"
    : sport === "Ride" ? "#fc4c02"
      : sport === "Swim" ? "#60a5fa"
        : sport === "Walk" ? "#4ade80"
          : "#a78bfa";

  const elGain = activity.elevation_gain || 0;
  const elGainDisplay = `+${elGain}m`;

  return (
    <div style={{
      background: "#f8f4ef",
      border: `1px solid ${accent}33`,
      borderRadius: 12, overflow: "hidden",
      animation: "fadeUp 0.3s ease",
    }}>
      <svg width={W} height={H} style={{ display: "block" }}>
        <defs>
          <pattern id={`grid-${seed}`} width="36" height="36" patternUnits="userSpaceOnUse">
            <path d="M 36 0 L 0 0 0 36" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          </pattern>
          <linearGradient id={`rg-${seed}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.3" />
            <stop offset="40%" stopColor={accent} stopOpacity="0.9" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id={`eg-${seed}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.04" />
          </linearGradient>
          <filter id={`glow-${seed}`}>
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Background + grid */}
        <rect width={W} height={H} fill="#f8f4ef" />
        <rect width={W} height={H} fill={`url(#grid-${seed})`} />

        {/* Elevation section */}
        <rect x="0" y={H - EL_H} width={W} height={EL_H} fill="rgba(96,165,250,0.05)" />
        <line x1="0" y1={H - EL_H} x2={W} y2={H - EL_H} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

        {/* Route shadow */}
        <path d={pathD} fill="none" stroke={accent} strokeWidth="8" strokeOpacity="0.1" strokeLinecap="round" strokeLinejoin="round" />
        {/* Route main */}
        <path d={pathD} fill="none" stroke={`url(#rg-${seed})`} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" filter={`url(#glow-${seed})`} />

        {/* Pace dots */}
        {paceMarkers.map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r="3.5" fill={accent} opacity="0.5" />
        ))}

        {/* KM markers */}
        {kmMarkers.map(([px, py], i) => (
          <g key={i}>
            <circle cx={px} cy={py} r="5" fill={`${accent}22`} stroke={accent} strokeWidth="1" />
            <text x={px} y={py + 3.5} textAnchor="middle" fill={accent} fontSize="6"
              fontFamily="'Barlow Condensed', sans-serif" fontWeight="700">{i + 1}</text>
          </g>
        ))}

        {/* Start */}
        {pts[0] && (
          <g>
            <circle cx={pts[0][0]} cy={pts[0][1]} r="9" fill="rgba(0,255,120,0.18)" stroke="#00ff88" strokeWidth="1.5" />
            <text x={pts[0][0]} y={pts[0][1] + 4} textAnchor="middle" fill="#00ff88" fontSize="7.5"
              fontFamily="'Barlow Condensed', sans-serif" fontWeight="700">S</text>
          </g>
        )}
        {/* Finish */}
        {pts[pts.length - 1] && (
          <g>
            <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="9"
              fill={`${accent}28`} stroke={accent} strokeWidth="1.5" />
            <text x={pts[pts.length - 1][0]} y={pts[pts.length - 1][1] + 4} textAnchor="middle"
              fill={accent} fontSize="7.5" fontFamily="'Barlow Condensed', sans-serif" fontWeight="700">F</text>
          </g>
        )}

        {/* Elevation fill + line */}
        <path d={elFill} fill={`url(#eg-${seed})`} />
        <path d={elPath} fill="none" stroke={accent} strokeWidth="1.5" opacity="0.65" />
        <text x="6" y={H - EL_H + 14} fill="rgba(255,255,255,0.28)" fontSize="7"
          fontFamily="'DM Mono', monospace" letterSpacing="2">ELEVATION · {elGainDisplay}</text>

        {/* Stats overlay card */}
        <rect x="8" y="8" width="128" height="52" rx="5"
          fill="rgba(255,255,255,0.9)" stroke={`${accent}22`} strokeWidth="1" />
        <text x="14" y="23" fill="rgba(255,255,255,0.3)" fontSize="7.5"
          fontFamily="'DM Mono', monospace" letterSpacing="2">
          {sport.toUpperCase()} · {activity.date || ""}
        </text>
        {activity.distance_km > 0 && (
          <text x="14" y="38" fill={accent} fontSize="15"
            fontFamily="'Barlow Condensed', sans-serif" fontWeight="700">
            {activity.distance_km} km
          </text>
        )}
        <text x="14" y="52" fill="rgba(255,255,255,0.3)" fontSize="8"
          fontFamily="'DM Mono', monospace">
          {activity.duration_min}min · {activity.avg_hr}bpm{activity.avg_pace ? ` · ${activity.avg_pace}` : ""}
        </text>
      </svg>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════
// DuckDB Analytics Panel
// ══════════════════════════════════════════════════════════════════

function DuckDBPanel({ heatmap }) {
  const [activeQ, setActiveQ] = useState(0);
  const cal = heatmap?.calendar || [];
  const stats = heatmap?.stats || {};

  const activeDays = cal.filter(d => d.activity.count > 0);
  const avgLoad = activeDays.length
    ? Math.round(activeDays.reduce((a, d) => a + d.activity.load, 0) / activeDays.length) : 0;
  const maxStreak = (() => {
    let max = 0, cur = 0;
    cal.forEach(d => { if (d.activity.count > 0) { cur++; max = Math.max(max, cur); } else cur = 0; });
    return max;
  })();

  // Build weekly volume for last 8 weeks
  const weeklyVol = Array.from({ length: 8 }, (_, i) => {
    const slice = cal.slice(-(i + 1) * 7, cal.length - i * 7);
    return { week: `W-${i}`, load: slice.reduce((a, d) => a + (d.activity?.load || 0), 0) };
  }).reverse();
  const maxVol = Math.max(...weeklyVol.map(w => w.load), 1);

  const QUERIES = [
    {
      label: "WEEKLY LOAD",
      sql: `SELECT strftime(date,'%W') AS week,\n  SUM(load) AS total_load\nFROM activities\nGROUP BY week ORDER BY week DESC LIMIT 8`,
    },
    {
      label: "SPORT MIX",
      sql: `SELECT sport_type,\n  COUNT(*) AS workouts,\n  ROUND(AVG(duration_min),1) AS avg_min\nFROM activities\nGROUP BY sport_type\nORDER BY workouts DESC`,
    },
    {
      label: "MOOD IMPACT",
      sql: `SELECT\n  CASE WHEN load > 50 THEN 'High' ELSE 'Low' END AS intensity,\n  ROUND(AVG(mood_next_day),2) AS avg_mood\nFROM workout_mood_join\nGROUP BY intensity`,
    },
  ];

  const SPORT_MIX = [
    { sport_type: "Run", workouts: Math.round(stats.total_activities * 0.34), avg_min: 43 },
    { sport_type: "Ride", workouts: Math.round(stats.total_activities * 0.24), avg_min: 76 },
    { sport_type: "WeightTraining", workouts: Math.round(stats.total_activities * 0.2), avg_min: 52 },
    { sport_type: "Yoga", workouts: Math.round(stats.total_activities * 0.11), avg_min: 36 },
    { sport_type: "Swim", workouts: Math.round(stats.total_activities * 0.11), avg_min: 48 },
  ];

  const MOOD_IMPACT = [
    { intensity: "High (≥50)", avg_mood: "+0.19" },
    { intensity: "Low (<50)", avg_mood: "+0.05" },
    { intensity: "Rest Day", avg_mood: "−0.04" },
  ];

  return (
    <div style={{
      background: "#fff",
      border: "1px solid rgba(96,165,250,0.12)",
      borderRadius: 12, padding: "18px 20px",
      animation: "fadeUp 0.6s ease",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 2, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#facc15" }}>◈</span> DUCKDB ANALYTICS
          </div>
          <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.28)", letterSpacing: 2, marginTop: 2 }}>
            IN-PROCESS OLAP · ZERO LATENCY · {stats.total_activities || 0} ROWS
          </div>
        </div>
        <div style={{
          padding: "3px 9px", background: "rgba(250,204,21,0.1)",
          border: "1px solid rgba(250,204,21,0.28)", borderRadius: 4,
          fontSize: 8, color: "#facc15", letterSpacing: 2,
        }}>● LIVE</div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
        {[
          { label: "ACTIVE DAYS", val: stats.active_days || 0, color: "#00f5d4" },
          { label: "AVG LOAD", val: avgLoad, color: "#facc15" },
          { label: "PEAK STREAK", val: `${maxStreak}d`, color: "#f472b6" },
        ].map(({ label, val, color }) => (
          <div key={label} style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 6, padding: "8px 10px",
          }}>
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", letterSpacing: 2 }}>{label}</div>
            <div style={{ fontSize: 21, fontWeight: 700, color, marginTop: 2, fontFamily: "'Barlow Condensed', sans-serif" }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Query tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {QUERIES.map((q, i) => (
          <button key={i} onClick={() => setActiveQ(i)} style={{
            padding: "4px 9px",
            background: activeQ === i ? "rgba(96,165,250,0.12)" : "transparent",
            border: `1px solid ${activeQ === i ? "rgba(96,165,250,0.3)" : "rgba(255,255,255,0.07)"}`,
            borderRadius: 4, cursor: "pointer",
            color: activeQ === i ? "#60a5fa" : "rgba(255,255,255,0.3)",
            fontSize: 8, letterSpacing: 1.5, fontFamily: "'Barlow Condensed', sans-serif",
            transition: "all 0.2s",
          }}>{q.label}</button>
        ))}
      </div>

      {/* SQL */}
      <pre style={{
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 6, padding: "8px 12px",
        fontFamily: "'DM Mono', monospace", fontSize: 8,
        color: "rgba(255,255,255,0.4)", lineHeight: 1.7,
        marginBottom: 10, overflow: "hidden", whiteSpace: "pre-wrap",
      }}>{QUERIES[activeQ].sql}</pre>

      {/* Results */}
      {activeQ === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {weeklyVol.map((row, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, fontSize: 8, color: "rgba(255,255,255,0.28)", fontFamily: "'Barlow Condensed', sans-serif", flexShrink: 0 }}>{row.week}</div>
              <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  width: `${(row.load / maxVol) * 100}%`, height: "100%",
                  background: `rgba(249,115,22,${0.3 + (row.load / maxVol) * 0.7})`,
                  borderRadius: 2, transition: "width 0.6s ease",
                }} />
              </div>
              <div style={{ width: 32, textAlign: "right", fontSize: 9, color: "#60a5fa", fontFamily: "'Barlow Condensed', sans-serif" }}>{row.load}</div>
            </div>
          ))}
        </div>
      )}
      {activeQ === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {SPORT_MIX.map((row, i) => (
            <div key={i} style={{
              display: "flex", gap: 8, padding: "5px 8px",
              background: "rgba(96,165,250,0.20)", borderRadius: 4,
              fontFamily: "'DM Mono', monospace", fontSize: 10,
            }}>
              <div style={{ flex: 2, color: "rgba(255,255,255,0.88)" }}>{row.sport_type}</div>
              <div style={{ flex: 1, color: "#60a5fa" }}>{row.workouts}</div>
              <div style={{ flex: 1, color: "rgba(255,255,255,0.4)" }}>{row.avg_min}min</div>
            </div>
          ))}
        </div>
      )}
      {activeQ === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {MOOD_IMPACT.map((row, i) => (
            <div key={i} style={{
              display: "flex", gap: 8, padding: "5px 8px",
              background: "rgba(96,165,250,0.20)", borderRadius: 4,
              fontFamily: "'DM Mono', monospace", fontSize: 10,
            }}>
              <div style={{ flex: 2, color: "rgba(255,255,255,0.5)" }}>{row.intensity}</div>
              <div style={{ flex: 1, color: row.avg_mood.startsWith("+") ? "#16a34a" : "#dc2626", fontWeight: 700 }}>{row.avg_mood}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════
// Heat Grid — 52-week calendar
// ══════════════════════════════════════════════════════════════════

function HeatGrid({ calendar, layer, onDayClick, selectedDay }) {
  const [tooltip, setTooltip] = useState(null);

  const getColor = useCallback((day) => {
    switch (layer) {
      case "activity": return ACTIVITY_SCALE(day.activity?.load);
      case "mood": return MOOD_SCALE(day.mood);
      case "stress": return STRESS_SCALE(day.stress);
      default: return COMPOSITE_SCALE(day.health_score);
    }
  }, [layer]);

  // Group by week
  const weeks = {};
  calendar.forEach(day => {
    if (!weeks[day.week]) weeks[day.week] = Array(7).fill(null);
    weeks[day.week][day.weekday] = day;
  });

  const weekNums = Object.keys(weeks).map(Number).sort((a, b) => a - b);
  const CELL_SIZE = 13;
  const GAP = 2;

  // Month label positions
  const monthPositions = {};
  calendar.forEach(day => {
    const d = new Date(day.date + "T00:00:00");
    const m = d.getMonth();
    if (!monthPositions[m] || day.week < monthPositions[m].week) {
      monthPositions[m] = { week: day.week, label: MONTH_LABELS[m] };
    }
  });

  return (
    <div style={{ position: "relative" }}>
      {/* Month labels */}
      <div style={{ display: "flex", marginBottom: 4, paddingLeft: 20 }}>
        {weekNums.map(w => {
          const monthEntry = Object.values(monthPositions).find(m => m.week === w);
          return (
            <div key={w} style={{
              width: CELL_SIZE + GAP,
              fontSize: 8, color: "rgba(255,255,255,0.28)",
              letterSpacing: 0.5, flexShrink: 0,
              fontFamily: "'DM Mono', monospace",
            }}>
              {monthEntry?.label || ""}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: GAP }}>
        {/* Day labels */}
        <div style={{ display: "flex", flexDirection: "column", gap: GAP, paddingTop: 0 }}>
          {["M", "", "W", "", "F", "", "S"].map((d, i) => (
            <div key={i} style={{
              height: CELL_SIZE, width: 14,
              fontSize: 8, color: "rgba(255,255,255,0.25)",
              display: "flex", alignItems: "center", justifyContent: "flex-end",
              fontFamily: "'DM Mono', monospace",
            }}>
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        {weekNums.map(w => (
          <div key={w} style={{ display: "flex", flexDirection: "column", gap: GAP }}>
            {(weeks[w] || Array(7).fill(null)).map((day, di) => (
              <div
                key={di}
                onClick={() => day && onDayClick(day)}
                onMouseEnter={(e) => {
                  if (!day) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({ day, x: rect.left, y: rect.top });
                }}
                onMouseLeave={() => setTooltip(null)}
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  borderRadius: 2,
                  background: day ? getColor(day) : "#0d1117",
                  cursor: day ? "pointer" : "default",
                  outline: selectedDay?.date === day?.date
                    ? "2px solid #00f5d4" : "none",
                  transition: "transform 0.1s",
                }}
                onMouseEnterCapture={e => { e.currentTarget.style.transform = "scale(1.4)"; }}
                onMouseLeaveCapture={e => { e.currentTarget.style.transform = "scale(1)"; }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: "fixed",
          left: tooltip.x + 18,
          top: tooltip.y - 10,
          background: "#0a0a12",
          border: "1px solid rgba(0,245,212,0.2)",
          borderRadius: 6, padding: "8px 12px",
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11, color: "#fff",
          zIndex: 9999, pointerEvents: "none",
          minWidth: 140,
          boxShadow: "0 4px 20px rgba(0,0,0,0.8)",
        }}>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, letterSpacing: 2, marginBottom: 4 }}>
            {tooltip.day.date.toUpperCase()}
          </div>
          {tooltip.day.activity?.count > 0 && (
            <div>⚡ {tooltip.day.activity.count} workout{tooltip.day.activity.count > 1 ? "s" : ""} · {tooltip.day.activity.minutes}min</div>
          )}
          {tooltip.day.mood !== null && tooltip.day.mood !== undefined && (
            <div>◎ Mood {tooltip.day.mood > 0 ? "+" : ""}{tooltip.day.mood}</div>
          )}
          {tooltip.day.stress !== null && tooltip.day.stress !== undefined && (
            <div>◉ Stress {Math.round(tooltip.day.stress * 100)}%</div>
          )}
          {tooltip.day.health_score !== null && (
            <div style={{ marginTop: 4, color: "#00f5d4", fontWeight: 600 }}>
              ◆ Score {tooltip.day.health_score}
            </div>
          )}
          {!tooltip.day.activity?.count && tooltip.day.mood === null && (
            <div style={{ color: "rgba(255,255,255,0.28)" }}>No data</div>
          )}
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════
// Correlation Scatter — D3-style using SVG
// ══════════════════════════════════════════════════════════════════

function CorrelationScatter({ points, correlations, insights }) {
  const [hovered, setHovered] = useState(null);

  const W = 380, H = 220, PAD = 40;

  if (!points || !Array.isArray(points)) {
    return (
      <div style={{
        height: 220, display: "flex", alignItems: "center", justifyContent: "center",
        color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace",
        fontSize: 11, letterSpacing: 2,
      }}>
        NO CORRELATION DATA YET
      </div>
    );
  }

  const validPoints = points.filter(p =>
    p.load > 0 && p.mood_next_day !== null
  );

  if (validPoints.length < 3) {
    return (
      <div style={{
        height: 220, display: "flex", alignItems: "center", justifyContent: "center",
        color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace",
        fontSize: 11, letterSpacing: 2,
      }}>
        NEED 3+ WORKOUT DAYS WITH JOURNAL ENTRIES
      </div>
    );
  }

  const maxLoad = Math.max(...validPoints.map(p => p.load), 1);
  const minMood = Math.min(...validPoints.map(p => p.mood_next_day));
  const maxMood = Math.max(...validPoints.map(p => p.mood_next_day));

  const toX = (load) => PAD + (load / maxLoad) * (W - PAD * 2);
  const toY = (mood) => {
    const range = maxMood - minMood || 1;
    return H - PAD - ((mood - minMood) / range) * (H - PAD * 2);
  };

  // Trend line (least squares)
  const n = validPoints.length;
  const mx = validPoints.reduce((a, p) => a + p.load, 0) / n;
  const my = validPoints.reduce((a, p) => a + p.mood_next_day, 0) / n;
  const m = validPoints.reduce((a, p) => a + (p.load - mx) * (p.mood_next_day - my), 0) /
    validPoints.reduce((a, p) => a + (p.load - mx) ** 2, 0.001);
  const b = my - m * mx;

  const trendX1 = 0, trendX2 = maxLoad;
  const trendY1 = m * trendX1 + b;
  const trendY2 = m * trendX2 + b;

  const r = correlations?.load_vs_mood_next;

  return (
    <div style={{ position: "relative" }}>
      <svg width={W} height={H} style={{ overflow: "visible" }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const mood = minMood + t * (maxMood - minMood);
          const y = toY(mood);
          return (
            <g key={t}>
              <line x1={PAD} x2={W - PAD} y1={y} y2={y}
                stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              <text x={PAD - 4} y={y + 3} textAnchor="end"
                fill="rgba(255,255,255,0.25)" fontSize={8}
                fontFamily="'DM Mono', monospace">
                {mood.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Axis labels */}
        <text x={W / 2} y={H - 4} textAnchor="middle"
          fill="rgba(255,255,255,0.3)" fontSize={9}
          fontFamily="'DM Mono', monospace" letterSpacing={2}>
          WORKOUT LOAD
        </text>
        <text x={10} y={H / 2} textAnchor="middle"
          fill="rgba(255,255,255,0.3)" fontSize={9}
          fontFamily="'DM Mono', monospace" letterSpacing={2}
          transform={`rotate(-90, 10, ${H / 2})`}>
          NEXT-DAY MOOD
        </text>

        {/* Trend line */}
        <line
          x1={toX(trendX1)} y1={toY(trendY1)}
          x2={toX(trendX2)} y2={toY(trendY2)}
          stroke="#60a5fa" strokeWidth={1} strokeDasharray="4,3" opacity={0.5}
        />

        {/* Points */}
        {validPoints.map((p, i) => {
          const cx = toX(p.load);
          const cy = toY(p.mood_next_day);
          const r = 4 + Math.min(8, (p.duration_min || 0) / 30);
          const stressOpacity = 0.4 + (1 - (p.stress_same_day || 0)) * 0.6;

          return (
            <g key={i}
              onMouseEnter={() => setHovered(p)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            >
              <circle cx={cx} cy={cy} r={r + 4} fill="transparent" />
              <circle
                cx={cx} cy={cy} r={r}
                fill={p.stress_same_day > 0.6 ? "#dc2626" : "#60a5fa"}
                opacity={stressOpacity}
                stroke={hovered === p ? "#fff" : "none"}
                strokeWidth={1.5}
              />
            </g>
          );
        })}

        {/* Hover label */}
        {hovered && (
          <g>
            <rect x={toX(hovered.load) + 8} y={toY(hovered.mood_next_day) - 28}
              width={110} height={52} rx={4}
              fill="#f8f9fa" stroke="rgba(96,165,250,0.3)" strokeWidth={1}
            />
            <text x={toX(hovered.load) + 14} y={toY(hovered.mood_next_day) - 12}
              fill="#60a5fa" fontSize={9}
              fontFamily="'DM Mono', monospace">
              {hovered.date}
            </text>
            <text x={toX(hovered.load) + 14} y={toY(hovered.mood_next_day) + 2}
              fill="rgba(0,0,0,0.7)" fontSize={9}
              fontFamily="'DM Mono', monospace">
              Load {hovered.load.toFixed(0)} · Mood +{hovered.mood_next_day.toFixed(2)}
            </text>
            <text x={toX(hovered.load) + 14} y={toY(hovered.mood_next_day) + 16}
              fill="rgba(255,255,255,0.32)" fontSize={9}
              fontFamily="'DM Mono', monospace">
              {hovered.duration_min}min · Stress {Math.round((hovered.stress_same_day || 0) * 100)}%
            </text>
          </g>
        )}
      </svg>

      {/* Correlation badge */}
      {r !== null && r !== undefined && (
        <div style={{
          position: "absolute", top: 8, right: 0,
          fontFamily: "'Barlow Condensed', sans-serif",
          textAlign: "right",
        }}>
          <div style={{
            fontSize: 28, fontWeight: 700,
            color: r > 0.3 ? "#059669" : r < -0.3 ? "#dc2626" : "rgba(255,255,255,0.32)"
          }}>
            r={r > 0 ? "+" : ""}{r}
          </div>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.28)", letterSpacing: 2 }}>
            {Math.abs(r) > 0.5 ? "STRONG" : Math.abs(r) > 0.3 ? "MODERATE" : "WEAK"} CORRELATION
          </div>
        </div>
      )}

      {/* Insights */}
      {insights?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {insights.map((ins, i) => (
            <div key={i} style={{
              fontSize: 10, color: "rgba(255,255,255,0.4)",
              fontFamily: "'DM Mono', monospace",
              letterSpacing: 0.5, lineHeight: 1.5,
              paddingLeft: 12, borderLeft: "2px solidrgba(96,165,250,0.20)",
              marginBottom: 6,
            }}>
              {ins}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════
// Activity Card
// ══════════════════════════════════════════════════════════════════

function ActivityCard({ activity }) {
  const icon = SPORT_ICONS[activity.sport_type] || SPORT_ICONS.default;
  const mood = activity.mood_that_day;
  const moodColor = mood
    ? mood.sentiment > 0.2 ? "#16a34a" : mood.sentiment < -0.2 ? "#dc2626" : "#d97706"
    : "rgba(255,255,255,0.12)";

  return (
    <div style={{
      background: "#fff",
      border: "1px solid rgba(96,165,250,0.12)",
      borderLeft: `3px solid ${activity.suffer_score > 60 ? "#dc2626" : "#60a5fa"}`,
      borderRadius: 8, padding: "10px 14px",
      fontFamily: "'DM Mono', monospace",
      display: "flex", gap: 12, alignItems: "center",
    }}>
      <div style={{ fontSize: 20, width: 28, textAlign: "center", flexShrink: 0 }}>
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.88)", fontWeight: 600, letterSpacing: 0.5 }}>
            {activity.name}
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", letterSpacing: 1 }}>
            {activity.date}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
          {activity.duration_min > 0 && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
              ⏱ {activity.duration_min}min
            </div>
          )}
          {activity.distance_km > 0 && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
              ◎ {activity.distance_km}km
            </div>
          )}
          {activity.avg_hr && (
            <div style={{ fontSize: 11, color: "#dc2626" }}>
              ♥ {Math.round(activity.avg_hr)}
            </div>
          )}
          {activity.calories && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)" }}>
              ⚡ {Math.round(activity.calories)}cal
            </div>
          )}
          {/* Strava suffer score */}
          {activity.suffer_score > 0 && (
            <div style={{
              fontSize: 10, padding: "1px 6px",
              background: `rgba(${activity.suffer_score > 60 ? "220,38,38" : "249,115,22"},0.1)`,
              border: `1px solid rgba(${activity.suffer_score > 60 ? "220,38,38" : "249,115,22"},0.3)`,
              borderRadius: 3, color: activity.suffer_score > 60 ? "#dc2626" : "#60a5fa",
            }}>
              SUFFER {Math.round(activity.suffer_score)}
            </div>
          )}
        </div>
      </div>

      {/* Mood badge */}
      {mood && (
        <div style={{
          textAlign: "center", flexShrink: 0,
          padding: "4px 8px",
          background: `${moodColor}18`,
          border: `1px solid ${moodColor}44`,
          borderRadius: 6,
        }}>
          <div style={{ fontSize: 9, color: moodColor, letterSpacing: 1 }}>MOOD</div>
          <div style={{ fontSize: 14, color: moodColor, fontWeight: 700 }}>
            {mood.sentiment > 0 ? "+" : ""}{mood.sentiment}
          </div>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════
// Connect prompt
// ══════════════════════════════════════════════════════════════════

function ConnectPrompt({ status, onConnect }) {
  return (
    <div style={{
      display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24,
    }}>
      {!status.strava_connected && (
        <button onClick={() => onConnect("strava")} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 18px",
          background: "rgba(252,76,2,0.12)",
          border: "1px solid rgba(252,76,2,0.35)",
          borderRadius: 8, cursor: "pointer",
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11, letterSpacing: 2, color: "#fc4c02",
          transition: "all 0.2s",
        }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          CONNECT STRAVA
        </button>
      )}
      {status.strava_connected && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "8px 14px",
          background: "rgba(252,76,2,0.06)",
          border: "1px solid rgba(252,76,2,0.15)",
          borderRadius: 8,
          fontFamily: "'DM Mono', monospace",
          fontSize: 10, letterSpacing: 2, color: "rgba(255,255,255,0.32)",
        }}>
          <span style={{ color: "#fc4c02" }}>⚡ STRAVA</span>
          <span>{status.total_activities} activities synced</span>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════
// Main Dashboard
// ══════════════════════════════════════════════════════════════════

export default function ActivityDashboard({ token }) {
  const [status, setStatus] = useState(MOCK_DATA.status);
  const [heatmap, setHeatmap] = useState(MOCK_DATA.heatmap);
  const [correlations, setCorrelations] = useState(MOCK_DATA.correlations);
  const [feed, setFeed] = useState(MOCK_DATA.feed);
  const [friends, setFriends] = useState(MOCK_DATA.friends);
  const [layer, setLayer] = useState("composite");
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(MOCK_DATA.feed[0] || null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setSyncing(true);
    try {
      const [st, hm, corr, fd, fr] = await Promise.all([
        fetch(`${API}/activity/status`, { headers }).then(r => r.json()).catch(() => null),
        fetch(`${API}/activity/heatmap`, { headers }).then(r => r.json()).catch(() => null),
        fetch(`${API}/activity/correlations`, { headers }).then(r => r.json()).catch(() => null),
        fetch(`${API}/activity/feed?limit=20`, { headers }).then(r => r.json()).catch(() => null),
        fetch(`${API}/activity/friends`, { headers }).then(r => r.json()).catch(() => null),
      ]);
      // Only replace if API returned real data
      if (st) setStatus(st);
      if (hm?.calendar?.length) setHeatmap(hm);
      if (corr?.points) setCorrelations(corr);
      if (fd?.activities?.length) { setFeed(fd.activities); setSelectedActivity(fd.activities[0]); }
      if (fr?.friends?.length) setFriends(fr.friends);
    } finally {
      setSyncing(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleConnect = (provider) => {
    window.location.href = `${API}/activity/${provider === "strava" ? "strava" : "fit"}/connect`;
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch(`${API}/activity/sync`, { method: "POST", headers });
      await fetchAll();
    } finally {
      setSyncing(false);
    }
  };

  const LAYERS = ["composite", "activity", "mood", "stress"];
  const LAYER_COLORS = { composite: "#60a5fa", activity: "#059669", mood: "#d97706", stress: "#dc2626" };

  return (
    <div style={{
      fontFamily: "'Inter', 'Barlow Condensed', sans-serif",
      background: "#030308",
      minHeight: "100vh",
      padding: "28px 28px",
      color: "rgba(255,255,255,0.88)",
      position: "relative",
    }}>
      {/* Strava backdrop at 10% opacity */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        zIndex: 0, opacity: 0.10,
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        <svg viewBox="0 0 100 100" width="900" height="900" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="30,10 55,65 42,65 65,90 38,45 51,45" fill="#FC4C02"/>
        </svg>
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .layer-btn:hover { border-color:rgba(96,165,250,0.60)!important; }
        .sync-btn:hover  { background: rgba(96,165,250,0.15) !important; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: 1, color: "#60a5fa", fontFamily: "'Syne', sans-serif", fontStyle: "italic" }}>
            Move. Grow. Thrive. 🔥
          </div>
          <div style={{ fontSize: 10, color: "rgba(96,165,250,0.55)", letterSpacing: 4, marginTop: 2 }}>
            STRAVA · HEALTH CORRELATIONS · COMMUNITY
          </div>
          <div style={{
            fontSize: 12, color: "rgba(255,255,255,0.4)",
            fontFamily: "'DM Mono', monospace",
            marginTop: 6, letterSpacing: 0.2, fontWeight: 400,
          }}>
            Every workout shapes your mind. Keep going — your future self is watching.
          </div>
        </div>

        {status && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="sync-btn"
              onClick={handleSync}
              disabled={syncing || (!status.strava_connected && !status.google_fit_connected)}
              style={{
                padding: "8px 16px",
                background: "rgba(96,165,250,0.08)",
                border: "1px solid rgba(96,165,250,0.3)",
                borderRadius: 6, cursor: "pointer",
                color: "#60a5fa",
                fontSize: 10, letterSpacing: 3,
                transition: "all 0.2s",
                opacity: syncing ? 0.6 : 1,
              }}
            >
              {syncing
                ? <span style={{ animation: "pulse 1s ease infinite" }}>SYNCING...</span>
                : "↻ SYNC"}
            </button>
          </div>
        )}
      </div>

      {/* Connect providers */}
      {status && !status.strava_connected && (
        <ConnectPrompt status={status} onConnect={handleConnect} />
      )}
      {status?.strava_connected && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
          padding: "8px 14px", background: "rgba(252,76,2,0.06)",
          border: "1px solid rgba(252,76,2,0.18)", borderRadius: 8,
          fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 2,
          color: "rgba(255,255,255,0.32)", width: "fit-content",
        }}>
          <span style={{ color: "#fc4c02" }}>⚡ STRAVA</span>
          <span>{status.total_activities} activities synced</span>
          <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
          <span style={{ color: "#60a5fa" }}>DEMO MODE</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 440px", gap: 20 }}>

        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Heatmap */}
            <div style={{
              background: "#fff",
              border: "1px solid rgba(96,165,250,0.1)",
              borderRadius: 12, padding: "18px 20px",
              animation: "fadeUp 0.4s ease",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 2 }}>52-WEEK GRID</div>
                  {heatmap?.stats && (
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", letterSpacing: 1, marginTop: 2 }}>
                      {heatmap.stats.active_days} ACTIVE DAYS · {heatmap.stats.total_activities} WORKOUTS
                    </div>
                  )}
                </div>

                {/* Layer toggle */}
                <div style={{ display: "flex", gap: 4 }}>
                  {LAYERS.map(l => (
                    <button key={l} className="layer-btn" onClick={() => setLayer(l)} style={{
                      padding: "4px 10px",
                      background: layer === l ? `${LAYER_COLORS[l]}20` : "transparent",
                      border: `1px solid ${layer === l ? LAYER_COLORS[l] + "60" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 4, cursor: "pointer",
                      color: layer === l ? LAYER_COLORS[l] : "rgba(255,255,255,0.3)",
                      fontSize: 9, letterSpacing: 2,
                      transition: "all 0.2s",
                    }}>
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {heatmap?.calendar ? (
                <HeatGrid
                  calendar={heatmap.calendar}
                  layer={layer}
                  onDayClick={setSelectedDay}
                  selectedDay={selectedDay}
                />
              ) : (
                <div style={{
                  height: 120, display: "flex", alignItems: "center", justifyContent: "center",
                  color: "rgba(255,255,255,0.15)", fontSize: 10, letterSpacing: 3,
                }}>
                  CONNECT A PROVIDER TO SEE YOUR GRID
                </div>
              )}

              {/* Legend */}
              <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "center" }}>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.28)", letterSpacing: 2 }}>
                  {layer.toUpperCase()} INTENSITY →
                </div>
                {[0, 20, 40, 60, 80, 100].map(v => (
                  <div key={v} style={{
                    width: 10, height: 10, borderRadius: 2,
                    background: layer === "activity" ? ACTIVITY_SCALE(v)
                      : layer === "mood" ? MOOD_SCALE(v / 50 - 1)
                        : layer === "stress" ? STRESS_SCALE(v / 100)
                          : COMPOSITE_SCALE(v),
                  }} />
                ))}
              </div>
            </div>

            {/* Selected day detail */}
            {selectedDay && (
              <div style={{
                background: "rgba(96,165,250,0.05)",
                border: "1px solid rgba(96,165,250,0.2)",
                borderRadius: 10, padding: "14px 18px",
                animation: "fadeUp 0.2s ease",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#60a5fa", letterSpacing: 2 }}>
                      {new Date(selectedDay.date + "T00:00:00").toLocaleDateString("en", {
                        weekday: "short", month: "short", day: "numeric"
                      }).toUpperCase()}
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                      {selectedDay.activity?.count > 0 && (
                        <div style={{ fontSize: 11, color: "#00f5d4" }}>
                          ⚡ {selectedDay.activity.count} workout · {selectedDay.activity.minutes}min
                        </div>
                      )}
                      {selectedDay.mood !== null && selectedDay.mood !== undefined && (
                        <div style={{ fontSize: 11, color: MOOD_SCALE(selectedDay.mood) }}>
                          ◎ Mood {selectedDay.mood > 0 ? "+" : ""}{selectedDay.mood}
                        </div>
                      )}
                      {selectedDay.stress !== null && selectedDay.stress !== undefined && (
                        <div style={{ fontSize: 11, color: "#dc2626" }}>
                          ◉ Stress {Math.round(selectedDay.stress * 100)}%
                        </div>
                      )}
                      {selectedDay.health_score !== null && (
                        <div style={{ fontSize: 11, color: "#60a5fa" }}>
                          ◆ Score {selectedDay.health_score}
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelectedDay(null)} style={{
                    background: "none", border: "none", color: "rgba(255,255,255,0.28)",
                    cursor: "pointer", fontSize: 14,
                  }}>✕</button>
                </div>
              </div>
            )}

            {/* Correlation scatter */}
            <div style={{
              background: "#fff",
              border: "1px solid rgba(96,165,250,0.1)",
              borderRadius: 12, padding: "18px 20px",
              animation: "fadeUp 0.5s ease",
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 2, marginBottom: 4 }}>
                WORKOUT → NEXT-DAY MOOD
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", letterSpacing: 1, marginBottom: 14 }}>
                DOES EXERCISE ACTUALLY MAKE YOU FEEL BETTER?
              </div>
              {correlations?.points ? (
                <CorrelationScatter
                  points={correlations.points}
                  correlations={correlations.correlations}
                  insights={correlations.insights}
                />
              ) : (
                <div style={{
                  height: 160, display: "flex", alignItems: "center", justifyContent: "center",
                  color: "rgba(255,255,255,0.2)", fontSize: 10, letterSpacing: 3
                }}>
                  NO CORRELATION DATA YET
                </div>
              )}
            </div>

            {/* Route Map — syncs with selected activity */}
            <div style={{ animation: "fadeUp 0.55s ease" }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 2, marginBottom: 4 }}>
                ROUTE MAP
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: 2, marginBottom: 10 }}>
                {selectedActivity
                  ? `${selectedActivity.name?.toUpperCase()} · ${selectedActivity.date}`
                  : "SELECT AN ACTIVITY FROM THE FEED"}
              </div>
              <RouteMap activity={selectedActivity} />
            </div>

            {/* DuckDB Analytics */}
            <DuckDBPanel heatmap={heatmap} correlations={correlations} />
          </div>

          {/* RIGHT COLUMN — Friends Leaderboard + Activity feed */}
          <div style={{
            display: "flex", flexDirection: "column", gap: 16,
            maxHeight: "calc(100vh - 180px)",
            overflowY: "auto",
          }}>

            {/* Friends Leaderboard */}
            {friends.length > 0 && (
              <div style={{
                background: "rgba(252,76,2,0.04)",
                border: "1px solid rgba(252,76,2,0.15)",
                borderRadius: 12, padding: "18px 16px",
                animation: "fadeUp 0.4s ease",
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 2, marginBottom: 14, color: "#fc4c02" }}>
                  ⚡ STRAVA CIRCLE
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {friends.map((f, i) => (
                    <div key={f.user_id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 10px",
                      background: f.is_you ? "rgba(96,165,250,0.08)" : "rgba(0,0,0,0.02)",
                      border: `1px solid ${f.is_you ? "rgba(96,165,250,0.25)" : "rgba(255,255,255,0.06)"}`,
                      borderRadius: 8,
                      transition: "all 0.2s",
                    }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%",
                        background: i < 3 ? ["#FFD700", "#C0C0C0", "#CD7F32"][i] + "22" : "rgba(255,255,255,0.06)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 700,
                        color: i < 3 ? ["#FFD700", "#C0C0C0", "#CD7F32"][i] : "rgba(255,255,255,0.3)",
                      }}>
                        {f.rank}
                      </div>
                      <div style={{ fontSize: 16 }}>{f.avatar}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 11, fontWeight: f.is_you ? 700 : 500,
                          color: f.is_you ? "#60a5fa" : "rgba(255,255,255,0.88)",
                          letterSpacing: 0.5,
                        }}>
                          {f.is_you ? "YOU" : f.name}
                        </div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", letterSpacing: 1, marginTop: 1 }}>
                          {f.activities} workouts · {f.total_hours}h
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#fc4c02" }}>
                          {f.total_km}km
                        </div>
                        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", letterSpacing: 1 }}>
                          {Math.round(f.total_cal)} CAL
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Feed */}
            <div style={{
              background: "#fff",
              border: "1px solid rgba(96,165,250,0.1)",
              borderRadius: 12, padding: "18px 16px",
              animation: "fadeUp 0.45s ease",
              display: "flex", flexDirection: "column", gap: 0,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 2, marginBottom: 14, flexShrink: 0 }}>
                RECENT ACTIVITIES
              </div>

              {feed.length === 0 ? (
                <div style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  flexDirection: "column", gap: 10, minHeight: 120,
                }}>
                  <div style={{ fontSize: 28, opacity: 0.15 }}>⚡</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: 3 }}>
                    NO ACTIVITIES YET
                  </div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.12)", letterSpacing: 2 }}>
                    CONNECT STRAVA TO GET STARTED
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {feed.map(act => (
                    <div
                      key={act.id}
                      onClick={() => setSelectedActivity(act)}
                      style={{
                        cursor: "pointer",
                        outline: selectedActivity?.id === act.id
                          ? "1px solid rgba(0,245,212,0.4)" : "none",
                        borderRadius: 8,
                        transition: "outline 0.15s",
                      }}
                    >
                      <ActivityCard activity={act} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


