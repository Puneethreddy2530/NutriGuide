import { useState, useEffect, useRef, useCallback } from "react";
import { useJournalVoice, JournalMic } from "./components/useJournalVoice"; // ◀ VOICE

/**
 * JournalPage.jsx — NeoPulse "Your Thoughts" Journal
 *
 * Aesthetic: "Paper & Light" — warm, intimate, analogue warmth
 *   meets clinical precision. Feels like writing in a leather-bound
 *   notebook but inside a health platform.
 *
 * Fonts: Lora (display, editorial serif) + DM Mono (metadata, clinical)
 * Palette: Deep charcoal base, warm amber ink, soft sage for calm,
 *           dusty rose for stress signals
 *
 * Features:
 *   - Full-page distraction-free writing mode
 *   - Mood picker (7 moods, animated)
 *   - Energy slider (1-5)
 *   - Sleep hours input
 *   - Tag system (auto-suggest from history)
 *   - 52-week sentiment heatmap calendar
 *   - Streak counter with milestone celebrations
 *   - Past entries sidebar with search
 *   - Auto-save (debounced 1.5s)
 *   - Word count + reading time
 *   - Entry detail / edit view
 */

const API = import.meta?.env?.VITE_API_URL ?? "";

const MOODS = [
  { key: "happy", emoji: "✦", label: "Happy", color: "#f59e6b", bg: "rgba(245,158,107,0.15)" },
  { key: "calm", emoji: "◉", label: "Calm", color: "#7ecec4", bg: "rgba(126,206,196,0.15)" },
  { key: "neutral", emoji: "◎", label: "Neutral", color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  { key: "anxious", emoji: "◈", label: "Anxious", color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
  { key: "sad", emoji: "◑", label: "Sad", color: "#60a5fa", bg: "rgba(96,165,250,0.15)" },
  { key: "angry", emoji: "◆", label: "Angry", color: "#f87171", bg: "rgba(248,113,113,0.15)" },
];

const ENERGY_LABELS = ["", "Drained", "Low", "Okay", "Good", "Energised"];

const SUGGESTED_TAGS = [
  "work", "family", "health", "sleep", "exercise",
  "anxiety", "gratitude", "stress", "mood", "goals",
  "relationships", "therapy", "medication", "diet",
];

// ── Utilities ─────────────────────────────────────────────────────
const readingTime = (text) => {
  const wpm = 200;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / wpm));
};

const formatDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric"
  });
};

const sentimentColor = (s) => {
  if (s > 0.3) return "#7ecec4";
  if (s > 0.0) return "#a7f3d0";
  if (s > -0.2) return "#94a3b8";
  if (s > -0.5) return "#a78bfa";
  return "#f87171";
};

// ── Debounce hook ─────────────────────────────────────────────────
function useDebounce(value, delay = 1500) {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Sub-components
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function MoodPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {MOODS.map(m => (
        <button key={m.key} onClick={() => onChange(m.key)} style={{
          padding: "6px 14px",
          background: value === m.key ? m.bg : "rgba(255,255,255,0.04)",
          border: `1.5px solid ${value === m.key ? m.color : "rgba(255,255,255,0.08)"}`,
          borderRadius: 20, cursor: "pointer",
          color: value === m.key ? m.color : "rgba(255,255,255,0.32)",
          fontSize: 12, display: "flex", alignItems: "center", gap: 6,
          transition: "all 0.18s", fontFamily: "'DM Mono', monospace",
        }}>
          <span style={{ fontSize: 14 }}>{m.emoji}</span>
          {m.label}
        </button>
      ))}
    </div>
  );
}

function EnergySlider({ value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{
        fontSize: 10, color: "rgba(255,255,255,0.32)",
        fontFamily: "'DM Mono',monospace", letterSpacing: 1
      }}>
        ENERGY
      </span>
      <div style={{ display: "flex", gap: 4 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => onChange(n)} style={{
            width: 28, height: 28, borderRadius: 4,
            background: n <= value
              ? `linear-gradient(135deg, #F97316, #EA580C)`
              : "rgba(255,255,255,0.04)",
            border: `1px solid ${n <= value ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.08)"}`,
            cursor: "pointer", color: n <= value ? "#fff" : "rgba(255,255,255,0.25)",
            fontSize: 10, fontFamily: "'DM Mono',monospace",
            transition: "all 0.15s",
          }}>
            {n}
          </button>
        ))}
      </div>
      <span style={{
        fontSize: 10, color: "#60a5fa",
        fontFamily: "'DM Mono',monospace"
      }}>
        {ENERGY_LABELS[value]}
      </span>
    </div>
  );
}

function TagInput({ tags, onChange }) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filtered = SUGGESTED_TAGS.filter(t =>
    t.includes(input.toLowerCase()) && !tags.includes(t)
  ).slice(0, 5);

  const add = (tag) => {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 8) {
      onChange([...tags, t]);
    }
    setInput("");
    setShowSuggestions(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        {tags.map(t => (
          <span key={t} style={{
            padding: "3px 10px",
            background: "rgba(249,115,22,0.07)",
            border: "1px solid rgba(96,165,250,0.2)",
            borderRadius: 12, fontSize: 10,
            color: "#3b82f6", display: "flex", alignItems: "center", gap: 4,
            fontFamily: "'DM Mono',monospace",
          }}>
            #{t}
            <button onClick={() => onChange(tags.filter(x => x !== t))} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(234,88,12,0.5)", fontSize: 10, padding: 0,
            }}>✕</button>
          </span>
        ))}
        <input
          value={input}
          onChange={e => { setInput(e.target.value); setShowSuggestions(true); }}
          onKeyDown={e => { if (e.key === "Enter" && input) { e.preventDefault(); add(input); } }}
          placeholder={tags.length < 8 ? "add tag…" : ""}
          style={{
            background: "none", border: "none", outline: "none",
            color: "rgba(255,255,255,0.35)", fontSize: 11,
            fontFamily: "'DM Mono',monospace", width: 80,
          }}
        />
      </div>
      {showSuggestions && filtered.length > 0 && input && (
        <div style={{
          position: "absolute", top: "100%", left: 0, zIndex: 50,
          background: "rgba(3,3,8,0.95)", border: "1px solid rgba(96,165,250,0.2)",
          borderRadius: 8, overflow: "hidden", minWidth: 140,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        }}>
          {filtered.map(t => (
            <button key={t} onClick={() => add(t)} style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "7px 12px", background: "none", border: "none",
              cursor: "pointer", color: "rgba(255,255,255,0.6)",
              fontSize: 11, fontFamily: "'DM Mono',monospace",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(96,165,250,0.06)"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}>
              #{t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StreakBadge({ streak }) {
  if (!streak || streak < 2) return null;
  const milestone = streak >= 30 ? "ðŸ†" : streak >= 14 ? "ðŸ”¥" : streak >= 7 ? "â˜…" : "âœ¦";
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 12px",
      background: "rgba(245,158,107,0.12)",
      border: "1px solid rgba(245,158,107,0.25)",
      borderRadius: 20,
      animation: "fadeUp 0.4s ease",
    }}>
      <span style={{ fontSize: 14 }}>{milestone}</span>
      <span style={{
        fontSize: 11, color: "#f59e6b",
        fontFamily: "'DM Mono',monospace"
      }}>
        {streak} day streak
      </span>
    </div>
  );
}

function HeatmapCalendar({ data }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div style={{
        fontSize: 11, color: "rgba(255,255,255,0.25)",
        fontFamily: "'DM Mono',monospace", textAlign: "center",
        padding: "20px 0"
      }}>
        Start journalling to see your heatmap
      </div>
    );
  }

  // Build 52-week grid
  const today = new Date();
  const cells = [];
  for (let w = 51; w >= 0; w--) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(today);
      dt.setDate(today.getDate() - (w * 7 + (6 - d)));
      const key = dt.toISOString().split("T")[0];
      week.push({ date: key, entry: data[key] || null });
    }
    cells.push(week);
  }

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div>
      <div style={{ display: "flex", gap: 3, overflowX: "auto" }}>
        {cells.map((week, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {week.map(({ date, entry }) => {
              const s = entry?.sentiment ?? null;
              const bg = entry
                ? s !== null ? sentimentColor(s) + "60" : "rgba(126,206,196,0.2)"
                : "rgba(255,255,255,0.04)";
              const border = entry ? sentimentColor(s ?? 0) + "50" : "rgba(255,255,255,0.07)";
              return (
                <div key={date} title={
                  entry
                    ? `${date}\n${entry.mood} · sentiment ${entry.sentiment?.toFixed(2)} · ${entry.word_count} words`
                    : date
                } style={{
                  width: 11, height: 11, borderRadius: 2,
                  background: bg,
                  border: `1px solid ${border}`,
                  cursor: entry ? "pointer" : "default",
                  transition: "transform 0.1s",
                }}
                  onMouseEnter={e => { if (entry) e.currentTarget.style.transform = "scale(1.4)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between",
        marginTop: 6, fontSize: 9, color: "rgba(255,255,255,0.27)",
        fontFamily: "'DM Mono',monospace"
      }}>
        <span>52 weeks ago</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function EntryCard({ entry, onSelect, selected }) {
  const mood = MOODS.find(m => m.key === entry.mood) || MOODS[2];
  return (
    <div onClick={() => onSelect(entry)} style={{
      padding: "12px 14px",
      background: selected
        ? "rgba(245,158,107,0.08)"
        : "rgba(249,115,22,0.04)",
      border: `1px solid ${selected ? "rgba(249,115,22,0.25)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 10, cursor: "pointer",
      transition: "all 0.15s",
      animation: "fadeUp 0.2s ease",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 5
      }}>
        <span style={{
          fontSize: 10, color: "rgba(255,255,255,0.28)",
          fontFamily: "'DM Mono',monospace"
        }}>
          {formatDate(entry.date)}
        </span>
        <span style={{ fontSize: 12, color: mood.color }}>{mood.emoji}</span>
      </div>
      <div style={{
        fontSize: 12, color: "rgba(255,255,255,0.85)",
        lineHeight: 1.5, overflow: "hidden",
        display: "-webkit-box", WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        fontFamily: "'LEMONMILK', sans-serif"
      }}>
        {entry.content}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        {(entry.tags || []).slice(0, 3).map(t => (
          <span key={t} style={{
            fontSize: 9, color: "#7ecec460",
            fontFamily: "'DM Mono',monospace"
          }}>
            #{t}
          </span>
        ))}
        <span style={{
          fontSize: 9, color: "rgba(255,255,255,0.25)",
          marginLeft: "auto", fontFamily: "'DM Mono',monospace"
        }}>
          {entry.word_count}w
        </span>
      </div>
    </div>
  );
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Main component
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export default function JournalPage({ token }) {
  // ── Editor state ───────────────────────────────────────────────
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("neutral");
  const [energy, setEnergy] = useState(3);
  const [sleep, setSleep] = useState("");
  const [tags, setTags] = useState([]);
  const [focused, setFocused] = useState(false);   // distraction-free

  // ── Data state ─────────────────────────────────────────────────
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [heatmap, setHeatmap] = useState({});
  const [selected, setSelected] = useState(null);   // viewing past entry

  // ── UI state ───────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [streak, setStreak] = useState(0);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("write"); // write | history | insights
  const [voiceMode, setVoiceMode] = useState("append"); // ◀ VOICE: "append" | "replace"
  const [emotionDetail, setEmotionDetail] = useState(null); // DistilRoBERTa emotion breakdown from last save

  const textareaRef = useRef(null);
  const debouncedContent = useDebounce(content, 1500);

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // ── Load data ──────────────────────────────────────────────────
  useEffect(() => {
    loadEntries();
    loadStats();
    loadHeatmap();
  }, []);

  // ── Auto-save ──────────────────────────────────────────────────
  useEffect(() => {
    if (debouncedContent.trim().length > 10) {
      saveEntry(false);
    }
  }, [debouncedContent, mood, energy]);

  const loadEntries = async () => {
    try {
      const r = await fetch(`${API}/journal/entries?limit=50`, { headers });
      const d = await r.json();
      setEntries(d.entries || []);
    } catch { }
  };

  const loadStats = async () => {
    try {
      const r = await fetch(`${API}/journal/stats`, { headers });
      const d = await r.json();
      setStats(d);
      setStreak(d.current_streak || 0);
    } catch { }
  };

  const loadHeatmap = async () => {
    try {
      const r = await fetch(`${API}/journal/heatmap`, { headers });
      const d = await r.json();
      setHeatmap(d.data || {});
    } catch { }
  };

  const saveEntry = useCallback(async (showFeedback = true) => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/journal/entries`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          content,
          mood,
          energy,
          sleep_hours: sleep ? parseFloat(sleep) : null,
          tags,
        }),
      });
      if (r.ok) {
        const d = await r.json();
        setStreak(d.streak_day || streak);
        if (d.emotion_detail) setEmotionDetail(d.emotion_detail);
        if (showFeedback) {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }
        loadEntries();
        loadStats();
        loadHeatmap();
      } else {
        console.error("Journal save failed:", r.status, await r.text().catch(() => ""));
      }
    } catch (e) {
      console.error("Journal save error:", e);
    }
    setSaving(false);
  }, [content, mood, energy, sleep, tags, token, streak]);

  const clearEditor = () => {
    setContent(""); setMood("neutral"); setEnergy(3);
    setSleep(""); setTags([]); setSelected(null);
    textareaRef.current?.focus();
  };

  // ◀ VOICE — transcript lands in editor: append with smart spacing, or replace
  const handleVoiceTranscript = useCallback((text) => {
    setContent(prev => {
      if (voiceMode === "replace") return text;
      if (!prev.trim()) return text;
      const endsWithSpace = /\s$/.test(prev);
      return endsWithSpace ? prev + text : prev + " " + text;
    });
    // Refocus textarea so user can keep typing immediately
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [voiceMode]);

  // ◀ VOICE — hook instantiation
  const voice = useJournalVoice({
    onTranscript: handleVoiceTranscript,
    apiBase: API,
    token,
  });

  const filteredEntries = entries.filter(e =>
    !search || e.content.toLowerCase().includes(search.toLowerCase()) ||
    (e.tags || []).some(t => t.includes(search.toLowerCase()))
  );

  const currentMood = MOODS.find(m => m.key === mood) || MOODS[2];
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 50% -10%, #0d0a2e 0%, #030308 60%)",
      display: "flex", flexDirection: "column",
      fontFamily: "'DM Mono', monospace",
      color: "rgba(255,255,255,0.85)",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        @keyframes fadeUp    { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes pulse     { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes saved     { 0%{opacity:0;transform:scale(0.9)} 50%{opacity:1;transform:scale(1.05)} 100%{opacity:0} }
        @keyframes spin      { to{transform:rotate(360deg)} }
        @keyframes blink     { 0%,100%{opacity:1} 50%{opacity:0} }
        * { box-sizing: border-box; }
        textarea { font-family: 'LEMONMILK', sans-serif !important; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(96,165,250,0.25); border-radius: 2px; }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{
        padding: "16px 28px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "rgba(3,3,8,0.95)", backdropFilter: "blur(12px)",
        flexShrink: 0,
      }}>
        <div>
          <div style={{
            fontSize: 20, color: "#60a5fa",
            fontFamily: "'LEMONMILK', sans-serif",
            fontStyle: "italic", letterSpacing: "-0.3px"
          }}>
            Your Thoughts
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 3 }}>
            <div style={{
              fontSize: 9, color: "rgba(255,255,255,0.27)",
              letterSpacing: 3,
            }}>
              PRIVATE · ENCRYPTED · YOURS
            </div>
            {/* Custom sentiment model badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 8px",
              background: "rgba(255,208,57,0.06)",
              border: "1px solid rgba(255,208,57,0.15)",
              borderRadius: 10,
            }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#FFD039" strokeWidth="2" strokeLinecap="round" opacity="0.65">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12"/>
              </svg>
              <span style={{ fontSize: 8, fontFamily: "'DM Mono',monospace",
                letterSpacing: 1, color: "#FFD03965" }}>
                Custom NLP · PyTorch CUDA
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <StreakBadge streak={streak} />

          {/* Tabs */}
          <div style={{
            display: "flex", gap: 2,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 10, padding: 3
          }}>
            {[["write", "✦ Write"], ["history", "◎ History"], ["insights", "◈ Insights"]].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} style={{
                padding: "5px 12px", borderRadius: 7,
                background: tab === key ? "rgba(96,165,250,0.1)" : "none",
                border: `1px solid ${tab === key ? "rgba(96,165,250,0.3)" : "transparent"}`,
                cursor: "pointer",
                color: tab === key ? "#60a5fa" : "rgba(255,255,255,0.28)",
                fontSize: 10, letterSpacing: 0.5,
                transition: "all 0.15s",
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* â•â• WRITE TAB â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {tab === "write" && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

            {/* Editor column */}
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              padding: "28px 36px",
              maxWidth: 760,
            }}>
              {/* Date + mood */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 20
              }}>
                <div style={{
                  fontSize: 13, color: "#60a5fa",
                  fontFamily: "'DM Mono', monospace", fontStyle: "italic"
                }}>
                  {new Date().toLocaleDateString("en-IN", {
                    weekday: "long", day: "numeric", month: "long"
                  })}
                </div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  fontSize: 9, color: "rgba(255,255,255,0.27)",
                  letterSpacing: 2
                }}>
                  {saving && <span style={{ animation: "pulse 1s infinite" }}>SAVING…</span>}
                  {saved && <span style={{ color: "#16a34a", animation: "saved 2s ease" }}>SAVED ✓</span>}
                  {wordCount > 0 && (
                    <span>{wordCount}w · {readingTime(content)}min read</span>
                  )}
                </div>
              </div>

              {/* ◀ VOICE — interim transcript preview (inline, above textarea) */}
              {voice.interimText && (
                <div style={{
                  marginBottom: 8,
                  padding: "6px 14px",
                  background: "rgba(96,165,250,0.05)",
                  border: "1px solid rgba(96,165,250,0.18)",
                  borderRadius: 8,
                  fontSize: 13, color: "rgba(255,255,255,0.32)",
                  fontFamily: "'DM Mono', monospace", fontStyle: "italic",
                  lineHeight: 1.5, animation: "fadeUp 0.15s ease",
                }}>
                  {voice.interimText}
                  <span style={{
                    display: "inline-block", width: 1.5, height: 12,
                    background: "#f59e6b", marginLeft: 3, verticalAlign: "middle",
                    animation: "blink 0.65s step-end infinite",
                  }} />
                </div>
              )}

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => setContent(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="What's on your mind today?

Write freely. This is your private space — no one else sees this unless you choose to share it with MindGuide for personalised support.

Try: how you're feeling, what happened today, what you're grateful for, what's worrying you…"
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  resize: "none", width: "100%",
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 16, lineHeight: 1.9,
                  fontFamily: "'LEMONMILK', sans-serif",
                  caretColor: "#60a5fa",
                  minHeight: 300,
                }}
              />

              {/* Metadata bar */}
              <div style={{
                marginTop: 20, paddingTop: 20,
                borderTop: "1px solid rgba(96,165,250,0.12)",
                display: "flex", flexDirection: "column", gap: 14,
              }}>
                <MoodPicker value={mood} onChange={setMood} />

                {/* DistilRoBERTa emotion breakdown (shown after save) */}
                {emotionDetail && emotionDetail.scores && (
                  <div style={{
                    background: "rgba(96,165,250,0.03)",
                    border: "1px solid rgba(96,165,250,0.1)",
                    borderRadius: 10, padding: "12px 14px",
                    animation: "fadeUp 0.3s ease",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 8, letterSpacing: 2, color: "rgba(255,255,255,0.3)" }}>
                        EMOTION ANALYSIS
                      </span>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "2px 8px",
                        background: "rgba(255,208,57,0.07)",
                        border: "1px solid rgba(255,208,57,0.2)",
                        borderRadius: 12,
                      }}>
                        <svg width="8" height="8" viewBox="0 0 100 100" fill="none">
                          <path d="M50 5 L95 27.5 L95 72.5 L50 95 L5 72.5 L5 27.5 Z" fill="#FFD039" opacity="0.9"/>
                        </svg>
                        <span style={{ fontSize: 8, color: "#FFD03970", fontFamily: "'DM Mono', monospace", letterSpacing: 1 }}>
                          DistilRoBERTa
                        </span>
                      </div>
                    </div>
                    {emotionDetail.dominant_emotion && (
                      <div style={{ marginBottom: 8, fontSize: 11 }}>
                        <span style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono',monospace", fontSize: 9 }}>dominant → </span>
                        <span style={{ color: "#60a5fa", fontFamily: "'DM Mono',monospace", letterSpacing: 1 }}>
                          {emotionDetail.dominant_emotion.toUpperCase()}
                        </span>
                      </div>
                    )}
                    {Object.entries(emotionDetail.scores)
                      .sort((a, b) => b[1] - a[1])
                      .map(([label, score]) => {
                        const pct = Math.round(score * 100);
                        const isTop = label === emotionDetail.dominant_emotion;
                        const colors = {
                          joy: "#facc15", surprise: "#60a5fa", neutral: "#94a3b8",
                          disgust: "#a78bfa", fear: "#fb923c", sadness: "#818cf8", anger: "#f87171"
                        };
                        const c = colors[label] || "#94a3b8";
                        return (
                          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{
                              width: 60, fontSize: 9, fontFamily: "'DM Mono',monospace",
                              color: isTop ? c : "rgba(255,255,255,0.25)",
                              letterSpacing: 0.5, textTransform: "uppercase",
                              transition: "color 0.3s",
                            }}>{label}</span>
                            <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                              <div style={{
                                height: "100%", width: `${pct}%`,
                                background: c, borderRadius: 2,
                                boxShadow: isTop ? `0 0 6px ${c}` : "none",
                                transition: "width 0.5s cubic-bezier(0.34,1.56,0.64,1)",
                              }} />
                            </div>
                            <span style={{ width: 28, fontSize: 9, color: "rgba(255,255,255,0.27)",
                              fontFamily: "'DM Mono',monospace", textAlign: "right" }}>
                              {pct}%
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}

                <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
                  <EnergySlider value={energy} onChange={setEnergy} />

                  {/* Sleep */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 10, color: "rgba(255,255,255,0.3)",
                      letterSpacing: 1
                    }}>
                      SLEEP
                    </span>
                    <input
                      type="number" min="0" max="14" step="0.5"
                      value={sleep}
                      onChange={e => setSleep(e.target.value)}
                      placeholder="hrs"
                      style={{
                        width: 56, background: "rgba(96,165,250,0.05)",
                        border: "1px solid rgba(96,165,250,0.2)",
                        borderRadius: 6, padding: "4px 8px",
                        color: "rgba(255,255,255,0.88)", fontSize: 11,
                        fontFamily: "'DM Mono',monospace", outline: "none",
                      }}
                    />
                  </div>
                </div>

                <TagInput tags={tags} onChange={setTags} />

                {/* ◀ VOICE — action bar: SAVE | NEW | [mic + mode toggle] */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
                  <button onClick={() => saveEntry(true)} style={{
                    padding: "9px 24px",
                    background: "linear-gradient(135deg, #F97316, #EA580C)",
                    border: "none",
                    borderRadius: 8, cursor: "pointer",
                    color: "#60a5fa", fontSize: 11, letterSpacing: 1, border: "1px solid rgba(96,165,250,0.35)",
                    transition: "all 0.2s",
                  }}>
                    SAVE ENTRY
                  </button>
                  <button onClick={clearEditor} style={{
                    padding: "9px 18px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8, cursor: "pointer",
                    color: "rgba(255,255,255,0.3)", fontSize: 11,
                    transition: "all 0.2s",
                  }}>
                    NEW
                  </button>
                  {/* ◀ VOICE — mic floated right */}
                  <div style={{ marginLeft: "auto" }}>
                    <JournalMic
                      voice={voice}
                      mode={voiceMode}
                      onModeChange={setVoiceMode}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right sidebar: heatmap + quick stats */}
            <div style={{
              width: 280, borderLeft: "1px solid rgba(96,165,250,0.12)",
              padding: "28px 20px", overflowY: "auto",
              display: "flex", flexDirection: "column", gap: 24,
            }}>

              {/* Stats row */}
              {stats && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{
                    fontSize: 8, color: "rgba(255,255,255,0.27)",
                    letterSpacing: 2
                  }}>
                    YOUR STATS
                  </div>
                  {[
                    ["ENTRIES", stats.total_entries || 0],
                    ["WORDS", (stats.total_words || 0).toLocaleString()],
                    ["STREAK", `${stats.current_streak || 0} days`],
                    ["AVG SLEEP", stats.avg_sleep_hours ? `${stats.avg_sleep_hours}h` : "—"],
                  ].map(([label, val]) => (
                    <div key={label} style={{
                      display: "flex", justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "rgba(96,165,250,0.05)",
                      border: "1px solid rgba(96,165,250,0.1)",
                      borderRadius: 8,
                    }}>
                      <span style={{
                        fontSize: 9, color: "rgba(255,255,255,0.3)",
                        letterSpacing: 1
                      }}>{label}</span>
                      <span style={{ fontSize: 12, color: "#60a5fa" }}>{val}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Mood distribution */}
              {stats?.mood_distribution && Object.keys(stats.mood_distribution).length > 0 && (
                <div>
                  <div style={{
                    fontSize: 8, color: "rgba(255,255,255,0.27)",
                    letterSpacing: 2, marginBottom: 10
                  }}>
                    MOOD HISTORY
                  </div>
                  {Object.entries(stats.mood_distribution).map(([m, count]) => {
                    const mood_def = MOODS.find(x => x.key === m) || MOODS[2];
                    const total = Object.values(stats.mood_distribution).reduce((a, b) => a + b, 0);
                    const pct = Math.round(count / total * 100);
                    return (
                      <div key={m} style={{ marginBottom: 6 }}>
                        <div style={{
                          display: "flex", justifyContent: "space-between",
                          marginBottom: 3, fontSize: 9,
                          color: "rgba(255,255,255,0.32)"
                        }}>
                          <span>{mood_def.emoji} {mood_def.label}</span>
                          <span>{pct}%</span>
                        </div>
                        <div style={{
                          height: 3, background: "rgba(255,255,255,0.06)",
                          borderRadius: 2
                        }}>
                          <div style={{
                            width: `${pct}%`, height: "100%",
                            background: mood_def.color, borderRadius: 2,
                            transition: "width 0.5s ease",
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Heatmap */}
              <div>
                <div style={{
                  fontSize: 8, color: "rgba(255,255,255,0.27)",
                  letterSpacing: 2, marginBottom: 10
                }}>
                  SENTIMENT HEATMAP
                </div>
                <HeatmapCalendar data={heatmap} />
                <div style={{
                  display: "flex", gap: 6, marginTop: 10,
                  alignItems: "center", fontSize: 8,
                  color: "rgba(255,255,255,0.27)"
                }}>
                  <span>sad</span>
                  {["#f8717140", "#a78bfa50", "#94a3b840", "#a7f3d060", "#7ecec460"].map((c, i) => (
                    <div key={i} style={{
                      width: 10, height: 10, borderRadius: 2, background: c,
                    }} />
                  ))}
                  <span>happy</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* â•â• HISTORY TAB â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {tab === "history" && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

            {/* Entry list */}
            <div style={{
              width: 320, borderRight: "1px solid rgba(96,165,250,0.1)",
              padding: "20px 16px", overflowY: "auto",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search entries…"
                style={{
                  padding: "8px 14px",
                  background: "rgba(96,165,250,0.05)",
                  border: "1px solid rgba(96,165,250,0.15)",
                  borderRadius: 8, outline: "none",
                  color: "rgba(255,255,255,0.85)", fontSize: 12,
                  fontFamily: "'DM Mono',monospace", marginBottom: 8,
                  caretColor: "#60a5fa",
                }}
              />
              {filteredEntries.length === 0 && (
                <div style={{
                  fontSize: 11, color: "rgba(255,255,255,0.27)",
                  textAlign: "center", padding: "40px 0",
                  fontFamily: "'DM Mono', monospace", fontStyle: "italic"
                }}>
                  No entries yet.<br />Start writing today.
                </div>
              )}
              {filteredEntries.map(e => (
                <EntryCard key={e.id} entry={e}
                  onSelect={setSelected}
                  selected={selected?.id === e.id} />
              ))}
            </div>

            {/* Entry detail */}
            <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto" }}>
              {selected ? (
                <div style={{ animation: "fadeUp 0.25s ease" }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "flex-start", marginBottom: 24
                  }}>
                    <div>
                      <div style={{
                        fontSize: 16, color: "#60a5fa",
                        fontFamily: "'DM Mono', monospace", fontStyle: "italic",
                        marginBottom: 6
                      }}>
                        {formatDate(selected.date)}
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {(() => {
                          const m = MOODS.find(x => x.key === selected.mood) || MOODS[2];
                          return (
                            <span style={{
                              fontSize: 11, color: m.color,
                              fontFamily: "'DM Mono',monospace"
                            }}>
                              {m.emoji} {m.label}
                            </span>
                          );
                        })()}
                        {selected.sleep_hours && (
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                            ◑ {selected.sleep_hours}h sleep
                          </span>
                        )}
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                          {selected.word_count} words
                        </span>
                        <span style={{ fontSize: 10, color: sentimentColor(selected.sentiment) }}>
                          sentiment {selected.sentiment > 0 ? "+" : ""}{selected.sentiment?.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => {
                      setContent(selected.content);
                      setMood(selected.mood);
                      setEnergy(selected.energy || 3);
                      setSleep(selected.sleep_hours ? String(selected.sleep_hours) : "");
                      setTags(selected.tags || []);
                      setTab("write");
                    }} style={{
                      padding: "7px 16px",
                      background: "rgba(96,165,250,0.08)",
                      border: "1px solid rgba(96,165,250,0.2)",
                      borderRadius: 8, cursor: "pointer",
                      color: "#60a5fa", fontSize: 10, letterSpacing: 1,
                    }}>
                      EDIT
                    </button>
                  </div>

                  <div style={{
                    fontSize: 15, lineHeight: 2.0,
                    color: "rgba(255,255,255,0.85)",
                    fontFamily: "'LEMONMILK', sans-serif",
                    whiteSpace: "pre-wrap"
                  }}>
                    {selected.content}
                  </div>

                  {(selected.tags || []).length > 0 && (
                    <div style={{
                      display: "flex", gap: 6, marginTop: 24,
                      flexWrap: "wrap"
                    }}>
                      {selected.tags.map(t => (
                        <span key={t} style={{
                          padding: "3px 10px", fontSize: 9,
                          background: "rgba(126,206,196,0.08)",
                          border: "1px solid rgba(126,206,196,0.15)",
                          borderRadius: 12, color: "#7ecec450",
                        }}>#{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "center", height: "100%",
                  fontSize: 13, color: "rgba(255,255,255,0.2)",
                  fontFamily: "'DM Mono', monospace", fontStyle: "italic"
                }}>
                  Select an entry to read
                </div>
              )}
            </div>
          </div>
        )}

        {/* â•â• INSIGHTS TAB â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {tab === "insights" && (
          <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto" }}>
            <div style={{ maxWidth: 680 }}>
              <div style={{
                fontSize: 18, color: "#60a5fa",
                fontFamily: "'DM Mono', monospace", fontStyle: "italic",
                marginBottom: 6
              }}>
                Patterns & Insights
              </div>
              <div style={{
                fontSize: 11, color: "rgba(255,255,255,0.3)",
                marginBottom: 28
              }}>
                Derived from your journal entries · used by MindGuide for personalised support
              </div>

              {/* Full heatmap */}
              <div style={{ marginBottom: 32 }}>
                <div style={{
                  fontSize: 9, color: "rgba(255,255,255,0.27)",
                  letterSpacing: 2, marginBottom: 12
                }}>
                  52-WEEK SENTIMENT CALENDAR
                </div>
                <HeatmapCalendar data={heatmap} />
              </div>

              {/* Stats grid */}
              {stats && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 12, marginBottom: 32
                }}>
                  {[
                    ["Total Entries", stats.total_entries || 0, "#f59e6b"],
                    ["Words Written", (stats.total_words || 0).toLocaleString(), "#7ecec4"],
                    ["Longest Streak", `${stats.max_streak || 0} days`, "#a78bfa"],
                    ["Avg Sentiment", stats.avg_sentiment > 0
                      ? `+${stats.avg_sentiment}` : String(stats.avg_sentiment), sentimentColor(stats.avg_sentiment)],
                    ["Avg Sleep", stats.avg_sleep_hours ? `${stats.avg_sleep_hours}h` : "—", "#60a5fa"],
                    ["Avg Energy", stats.avg_energy ? `${stats.avg_energy}/5` : "—", "#f59e6b"],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{
                      padding: "16px 18px",
                      background: "rgba(249,115,22,0.04)",
                      border: "1px solid rgba(96,165,250,0.12)",
                      borderRadius: 12,
                    }}>
                      <div style={{
                        fontSize: 9, color: "rgba(255,255,255,0.28)",
                        letterSpacing: 1, marginBottom: 8
                      }}>
                        {label.toUpperCase()}
                      </div>
                      <div style={{
                        fontSize: 22, color,
                        fontFamily: "'DM Mono', monospace"
                      }}>
                        {val}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* MindGuide context note */}
              <div style={{
                padding: "16px 20px",
                background: "rgba(96,165,250,0.06)",
                border: "1px solid rgba(96,165,250,0.15)",
                borderRadius: 12, fontSize: 12,
                color: "rgba(255,255,255,0.4)",
                lineHeight: 1.7, fontStyle: "italic",
                fontFamily: "'DM Mono', monospace",
              }}>
                ◎ Your journal insights are privately shared with MindGuide to personalise its responses.
                When you ask for mental health support, MindGuide will know your recent mood trends,
                sleep patterns, and emotional context — without you having to explain every time.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



