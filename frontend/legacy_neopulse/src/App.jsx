import { useState, useEffect, useCallback } from "react";

// Phase 1 components (you already have these)
// import JournalPage    from "./pages/JournalPage";
// import MedicationPage from "./pages/MedicationPage";

// Phase 2 components
import EmotionDetector     from "./components/EmotionDetector";
import DrugInteractionGraph from "./components/DrugInteractionGraph";

// Phase 3 components
import HealthOrbit     from "./components/HealthOrbit";
import BreathingExercise from "./components/BreathingExercise";
import HealthTimeline  from "./components/HealthTimeline";

// ── Auth ───────────────────────────────────────────────────────────────────────
const API = import.meta?.env?.VITE_API_URL || "http://localhost:8000";

function useAuth() {
  const [token,       setToken]       = useState(localStorage.getItem("token") || null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => { setCurrentUser(u); setLoading(false); })
      .catch(() => { setToken(null); setLoading(false); });
  }, [token]);

  const login = useCallback(async (email, password) => {
    const fd = new FormData();
    fd.append("username", email);
    fd.append("password", password);
    const r = await fetch(`${API}/auth/login`, { method: "POST", body: fd });
    if (!r.ok) throw new Error("Invalid credentials");
    const { access_token } = await r.json();
    localStorage.setItem("token", access_token);
    setToken(access_token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setCurrentUser(null);
  }, []);

  return { token, currentUser, loading, login, logout };
}

// ── Login Screen ───────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);

  const submit = async () => {
    setLoading(true); setError(null);
    try { await onLogin(email, password); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 50% 40%, #080812 0%, #030308 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Mono', monospace",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');`}</style>
      <div style={{
        width: 320,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, padding: 32,
      }}>
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 22, fontWeight: 800,
          marginBottom: 4, color: "#fff",
        }}>
          HealthOS
        </div>
        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", letterSpacing: 3, marginBottom: 28 }}>
          HOLISTIC HEALTH PLATFORM
        </div>

        {[
          { label: "EMAIL",    val: email,    set: setEmail,    type: "email" },
          { label: "PASSWORD", val: password, set: setPassword, type: "password" },
        ].map(({ label, val, set, type }) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", letterSpacing: 3, marginBottom: 5 }}>
              {label}
            </div>
            <input
              type={type} value={val}
              onChange={e => set(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              style={{
                width: "100%", padding: "9px 12px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 7, color: "#fff",
                fontFamily: "'DM Mono', monospace", fontSize: 11,
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
        ))}

        {error && (
          <div style={{ fontSize: 9, color: "#f87171", marginBottom: 12 }}>{error}</div>
        )}

        <button
          onClick={submit} disabled={loading}
          style={{
            width: "100%", padding: "11px 0",
            background: "linear-gradient(135deg, rgba(96,165,250,0.25), rgba(167,139,250,0.25))",
            border: "1px solid rgba(96,165,250,0.3)",
            borderRadius: 8, color: "#fff",
            fontFamily: "'DM Mono', monospace",
            fontSize: 9, letterSpacing: 4,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "SIGNING IN..." : "ENTER ORBIT"}
        </button>
      </div>
    </div>
  );
}

// ── Navigation ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { route: "/",            icon: "⬡", label: "Orbit"    },
  { route: "/journal",     icon: "✍", label: "Journal"  },
  { route: "/emotion",     icon: "◎", label: "MindScan" },
  { route: "/breathing",   icon: "◌", label: "Breathe"  },
  { route: "/medications", icon: "●", label: "Meds"     },
  { route: "/drugs",       icon: "⬟", label: "Drug GNN" },
  { route: "/timeline",    icon: "━", label: "Timeline" },
];

function Nav({ route, onNavigate, onLogout }) {
  return (
    <nav style={{
      position: "fixed", left: 0, top: 0, bottom: 0,
      width: 60, background: "rgba(5,5,15,0.95)",
      borderRight: "1px solid rgba(255,255,255,0.05)",
      display: "flex", flexDirection: "column", alignItems: "center",
      paddingTop: 24, paddingBottom: 16, gap: 4,
      zIndex: 100, backdropFilter: "blur(12px)",
    }}>
      <style>{`
        .nav-item:hover { background: rgba(255,255,255,0.08) !important; }
        .nav-item-active { background: rgba(96,165,250,0.12) !important; }
      `}</style>

      {NAV_ITEMS.map(item => (
        <button
          key={item.route}
          className={`nav-item${route === item.route ? " nav-item-active" : ""}`}
          onClick={() => onNavigate(item.route)}
          title={item.label}
          style={{
            width: 40, height: 40,
            background: route === item.route ? "rgba(96,165,250,0.12)" : "transparent",
            border: "none", borderRadius: 8,
            color: route === item.route ? "#60a5fa" : "rgba(255,255,255,0.3)",
            fontSize: 15, cursor: "pointer",
            transition: "all 0.2s",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          {item.icon}
        </button>
      ))}

      <div style={{ flex: 1 }} />

      <button
        onClick={onLogout}
        title="Logout"
        style={{
          width: 40, height: 40,
          background: "transparent", border: "none",
          color: "rgba(255,255,255,0.2)", fontSize: 12,
          cursor: "pointer", borderRadius: 8,
          fontFamily: "'DM Mono', monospace",
          transition: "all 0.2s",
        }}
      >
        ⏻
      </button>
    </nav>
  );
}

// ── Placeholder for unbuilt pages ──────────────────────────────────────────────
function Placeholder({ title }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", color: "rgba(255,255,255,0.2)",
      fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 4,
    }}>
      {title.toUpperCase()} — COMING SOON
    </div>
  );
}

// ── Emotion state passthrough (stress → breathing trigger) ─────────────────────
// When EmotionDetector reports stress > 0.7, we can auto-suggest breathing

// ── App ────────────────────────────────────────────────────────────────────────
export default function App() {
  const { token, currentUser, loading, login, logout } = useAuth();
  const [route,         setRoute]         = useState("/");
  const [emotionState,  setEmotionState]  = useState({ emotion: "calm", stressScore: 0.3 });
  const [showBreathPrompt, setShowBreathPrompt] = useState(false);

  // Scores for HealthOrbit (pull from /dashboard in production)
  const [healthScores] = useState({ mental: 68, physical: 72, medication: 85, social: 55 });
  const [riskScore]    = useState(38);

  // Auto-suggest breathing when stress spikes
  const handleEmotionUpdate = useCallback((data) => {
    setEmotionState({ emotion: data.emotion, stressScore: data.stress_score });
    if (data.stress_score > 0.75 && !showBreathPrompt) {
      setShowBreathPrompt(true);
    }
  }, [showBreathPrompt]);

  if (loading) return (
    <div style={{
      minHeight: "100vh", background: "#030308",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "rgba(255,255,255,0.2)", fontFamily: "'DM Mono', monospace",
      fontSize: 9, letterSpacing: 4,
    }}>
      LOADING...
    </div>
  );

  if (!token) return <LoginScreen onLogin={login} />;

  const renderPage = () => {
    switch (route) {
      case "/":
        return (
          <HealthOrbit
            scores={healthScores}
            riskScore={riskScore}
            onNavigate={setRoute}
          />
        );
      case "/emotion":
        return (
          <EmotionDetector
            token={token}
            userId={currentUser?.id}
            onEmotionUpdate={handleEmotionUpdate}
          />
        );
      case "/breathing":
        return (
          <BreathingExercise
            emotion={emotionState.emotion}
            stressScore={emotionState.stressScore}
            onComplete={(data) => {
              console.log("Breathing session complete:", data);
              setShowBreathPrompt(false);
              setRoute("/");
            }}
          />
        );
      case "/drugs":
        return <DrugInteractionGraph token={token} />;
      case "/timeline":
        return <HealthTimeline token={token} />;
      case "/journal":
        return <Placeholder title="Journal" />;
      case "/medications":
        return <Placeholder title="Medications" />;
      default:
        return <Placeholder title="Page not found" />;
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#030308" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; }
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&family=Bebas+Neue&family=Playfair+Display:ital,wght@1,400&display=swap');
      `}</style>

      <Nav route={route} onNavigate={setRoute} onLogout={logout} />

      <main style={{
        flex: 1, marginLeft: 60,
        height: "100vh", overflow: "auto",
      }}>
        {renderPage()}
      </main>

      {/* Breathing suggestion banner */}
      {showBreathPrompt && route !== "/breathing" && (
        <div style={{
          position: "fixed", bottom: 24, right: 24,
          background: "rgba(248,113,113,0.1)",
          border: "1px solid rgba(248,113,113,0.3)",
          borderRadius: 12, padding: "12px 16px",
          fontFamily: "'DM Mono', monospace",
          zIndex: 200, maxWidth: 240,
          animation: "fadeUp 0.4s ease",
        }}>
          <div style={{ fontSize: 9, color: "#f87171", letterSpacing: 2, marginBottom: 6 }}>
            ● HIGH STRESS DETECTED
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>
            Your stress index is elevated. Try a breathing session?
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setRoute("/breathing"); setShowBreathPrompt(false); }} style={{
              flex: 1, padding: "6px 0",
              background: "rgba(248,113,113,0.15)",
              border: "1px solid rgba(248,113,113,0.3)",
              borderRadius: 6, color: "#f87171",
              fontFamily: "'DM Mono', monospace",
              fontSize: 8, letterSpacing: 2, cursor: "pointer",
            }}>
              BREATHE NOW
            </button>
            <button onClick={() => setShowBreathPrompt(false)} style={{
              padding: "6px 10px",
              background: "none",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6, color: "rgba(255,255,255,0.3)",
              fontFamily: "'DM Mono', monospace",
              fontSize: 8, cursor: "pointer",
            }}>
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
