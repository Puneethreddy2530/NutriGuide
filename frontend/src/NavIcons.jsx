/**
 * NavIcons.jsx — NeoPulse Nav Icon Set
 * 
 * Pure SVG icons, 20×20 viewBox, no emoji, no icon fonts.
 * Each icon is bespoke-designed to match its page concept.
 * 
 * Usage:
 *   import { OrbitIcon, MindScanIcon, ... } from "./NavIcons";
 *   <OrbitIcon size={20} color="currentColor" />
 * 
 * Drop-in replacement for the NAV array:
 *   { route: "/", icon: <OrbitIcon />, label: "Orbit" },
 */

// ── Shared wrapper ─────────────────────────────────────────────────────
const Icon = ({ size = 20, color = "currentColor", children, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "block", flexShrink: 0 }}
    {...props}
  >
    {children(color)}
  </svg>
);


// ══════════════════════════════════════════════════════════════════════
// 1. HEALTH ORBIT  ( "/" )
// Concept: three concentric elliptical orbits with a center node —
//          like a solar system / atom. Distinct, immediately "orbital".
// ══════════════════════════════════════════════════════════════════════
export const OrbitIcon = ({ size = 20, color = "currentColor" }) => (
  <Icon size={size} color={color}>
    {(c) => (
      <>
        {/* Outer orbit ellipse */}
        <ellipse cx="10" cy="10" rx="8.5" ry="3.5"
          stroke={c} strokeWidth="1.2" fill="none" opacity="0.45"
          transform="rotate(-30 10 10)" />
        {/* Mid orbit ellipse */}
        <ellipse cx="10" cy="10" rx="8.5" ry="3.5"
          stroke={c} strokeWidth="1.2" fill="none" opacity="0.65"
          transform="rotate(30 10 10)" />
        {/* Inner orbit ellipse */}
        <ellipse cx="10" cy="10" rx="5" ry="2"
          stroke={c} strokeWidth="1" fill="none" opacity="0.85"
          transform="rotate(90 10 10)" />
        {/* Center node */}
        <circle cx="10" cy="10" r="1.8" fill={c} />
        {/* Orbit dot 1 */}
        <circle cx="18.5" cy="10" r="1.2" fill={c} opacity="0.8" />
        {/* Orbit dot 2 — rotated */}
        <circle cx="4.8" cy="5.6" r="1" fill={c} opacity="0.6" />
      </>
    )}
  </Icon>
);


// ══════════════════════════════════════════════════════════════════════
// 2. MINDSCAN  ( "/emotion" )
// Concept: a stylised face outline with a neural scan arc above it —
//          half circle with radiating scan lines.
// ══════════════════════════════════════════════════════════════════════
export const MindScanIcon = ({ size = 20, color = "currentColor" }) => (
  <Icon size={size} color={color}>
    {(c) => (
      <>
        {/* Face circle */}
        <circle cx="10" cy="11" r="5.5" stroke={c} strokeWidth="1.3" fill="none" />
        {/* Left eye */}
        <circle cx="8" cy="10.5" r="0.9" fill={c} />
        {/* Right eye */}
        <circle cx="12" cy="10.5" r="0.9" fill={c} />
        {/* Neutral mouth line */}
        <path d="M8 13.2 Q10 14.4 12 13.2" stroke={c} strokeWidth="1.1"
          strokeLinecap="round" fill="none" />
        {/* Scan arc */}
        <path d="M4 7.5 Q10 2 16 7.5" stroke={c} strokeWidth="1.2"
          strokeLinecap="round" fill="none" opacity="0.6" />
        {/* Scan dot */}
        <circle cx="10" cy="4.2" r="1" fill={c} opacity="0.8" />
        {/* Scan lines */}
        <line x1="7" y1="5.5" x2="6.2" y2="3.5" stroke={c} strokeWidth="0.9"
          strokeLinecap="round" opacity="0.5" />
        <line x1="13" y1="5.5" x2="13.8" y2="3.5" stroke={c} strokeWidth="0.9"
          strokeLinecap="round" opacity="0.5" />
      </>
    )}
  </Icon>
);


// ══════════════════════════════════════════════════════════════════════
// 3. CIRCLES  ( "/circles" )
// Concept: three overlapping circles forming a community/Venn shape —
//          social, connected, people-centric.
// ══════════════════════════════════════════════════════════════════════
export const CirclesIcon = ({ size = 20, color = "currentColor" }) => (
  <Icon size={size} color={color}>
    {(c) => (
      <>
        {/* Left person */}
        <circle cx="7" cy="7" r="2.2" stroke={c} strokeWidth="1.2" fill="none" />
        <path d="M3.2 15.5 C3.2 12.5 5 11 7 11 C9 11 10.8 12.5 10.8 15.5"
          stroke={c} strokeWidth="1.2" strokeLinecap="round" fill="none" />
        {/* Right person */}
        <circle cx="13" cy="7" r="2.2" stroke={c} strokeWidth="1.2" fill="none" opacity="0.7" />
        <path d="M9.2 15.5 C9.2 12.5 11 11 13 11 C15 11 16.8 12.5 16.8 15.5"
          stroke={c} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.7" />
        {/* Connection arc */}
        <path d="M9 6 Q10 4.5 11 6" stroke={c} strokeWidth="1" fill="none" opacity="0.5" />
      </>
    )}
  </Icon>
);


// ══════════════════════════════════════════════════════════════════════
// 4. BREATHE  ( "/breathing" )
// Concept: a lungs / expand shape — two wing-like curves around a
//          central vertical breath line with a pulse dot.
// ══════════════════════════════════════════════════════════════════════
export const BreatheIcon = ({ size = 20, color = "currentColor" }) => (
  <Icon size={size} color={color}>
    {(c) => (
      <>
        {/* Left lung */}
        <path d="M10 4 C10 4 5 5 4 9 C3.2 12 4.5 15.5 7 16 C8.5 16.3 10 15 10 15"
          stroke={c} strokeWidth="1.3" strokeLinecap="round" fill="none" />
        {/* Right lung */}
        <path d="M10 4 C10 4 15 5 16 9 C16.8 12 15.5 15.5 13 16 C11.5 16.3 10 15 10 15"
          stroke={c} strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.7" />
        {/* Central breath axis */}
        <line x1="10" y1="2" x2="10" y2="18" stroke={c} strokeWidth="1"
          strokeLinecap="round" opacity="0.35" strokeDasharray="1.5 2" />
        {/* Breath node */}
        <circle cx="10" cy="10" r="1.5" fill={c} />
        {/* Top inhale dot */}
        <circle cx="10" cy="2.5" r="0.8" fill={c} opacity="0.6" />
      </>
    )}
  </Icon>
);


// ══════════════════════════════════════════════════════════════════════
// 5. DRUG GNN  ( "/drugs" )
// Concept: graph network nodes connected by edges — molecule/GNN feel.
//          5 nodes with connecting edges, asymmetric layout.
// ══════════════════════════════════════════════════════════════════════
export const DrugGNNIcon = ({ size = 20, color = "currentColor" }) => (
  <Icon size={size} color={color}>
    {(c) => (
      <>
        {/* Edges */}
        <line x1="10" y1="10" x2="4" y2="5" stroke={c} strokeWidth="1" opacity="0.5" />
        <line x1="10" y1="10" x2="16" y2="5" stroke={c} strokeWidth="1" opacity="0.5" />
        <line x1="10" y1="10" x2="4" y2="15.5" stroke={c} strokeWidth="1" opacity="0.5" />
        <line x1="10" y1="10" x2="16" y2="15.5" stroke={c} strokeWidth="1" opacity="0.5" />
        <line x1="10" y1="10" x2="10" y2="3" stroke={c} strokeWidth="1" opacity="0.4" />
        {/* Cross edge */}
        <line x1="4" y1="5" x2="16" y2="5" stroke={c} strokeWidth="0.8" opacity="0.3" />
        <line x1="4" y1="15.5" x2="16" y2="15.5" stroke={c} strokeWidth="0.8" opacity="0.3" />
        {/* Center node */}
        <circle cx="10" cy="10" r="2.2" fill={c} />
        {/* Outer nodes */}
        <circle cx="4" cy="5" r="1.4" stroke={c} strokeWidth="1.1" fill="none" />
        <circle cx="16" cy="5" r="1.4" stroke={c} strokeWidth="1.1" fill="none" />
        <circle cx="4" cy="15.5" r="1.4" stroke={c} strokeWidth="1.1" fill="none" />
        <circle cx="16" cy="15.5" r="1.4" stroke={c} strokeWidth="1.1" fill="none" />
        <circle cx="10" cy="2.8" r="1.1" fill={c} opacity="0.7" />
      </>
    )}
  </Icon>
);


// ══════════════════════════════════════════════════════════════════════
// 6. TIMELINE  ( "/timeline" )
// Concept: a vertical axis with event nodes at irregular intervals —
//          like a medical history timeline / ECG strip.
// ══════════════════════════════════════════════════════════════════════
export const TimelineIcon = ({ size = 20, color = "currentColor" }) => (
  <Icon size={size} color={color}>
    {(c) => (
      <>
        {/* Vertical spine */}
        <line x1="7" y1="2" x2="7" y2="18" stroke={c} strokeWidth="1.2"
          strokeLinecap="round" opacity="0.4" />
        {/* Event 1 — top */}
        <circle cx="7" cy="4.5" r="1.8" fill={c} />
        <line x1="8.8" y1="4.5" x2="15" y2="4.5" stroke={c} strokeWidth="1"
          strokeLinecap="round" opacity="0.7" />
        {/* Event 2 — mid */}
        <circle cx="7" cy="10" r="1.4" stroke={c} strokeWidth="1.2" fill="none" />
        <line x1="8.8" y1="10" x2="13" y2="10" stroke={c} strokeWidth="1"
          strokeLinecap="round" opacity="0.5" />
        {/* Event 3 — lower */}
        <circle cx="7" cy="15.5" r="1.8" fill={c} opacity="0.7" />
        <line x1="8.8" y1="15.5" x2="16" y2="15.5" stroke={c} strokeWidth="1"
          strokeLinecap="round" opacity="0.6" />
        {/* Date tick marks */}
        <line x1="5.5" y1="4.5" x2="7" y2="4.5" stroke={c} strokeWidth="1.2" opacity="0.3" />
        <line x1="5.5" y1="10" x2="7" y2="10" stroke={c} strokeWidth="1.2" opacity="0.3" />
        <line x1="5.5" y1="15.5" x2="7" y2="15.5" stroke={c} strokeWidth="1.2" opacity="0.3" />
      </>
    )}
  </Icon>
);


// ══════════════════════════════════════════════════════════════════════
// 7. ACTIVITY  ( "/activity" )
// Concept: a pulse / waveform line with a running figure silhouette
//          above it — kinetic, athletic energy.
// ══════════════════════════════════════════════════════════════════════
export const ActivityIcon = ({ size = 20, color = "currentColor" }) => (
  <Icon size={size} color={color}>
    {(c) => (
      <>
        {/* ECG / Activity waveform */}
        <polyline
          points="1.5,13 4.5,13 6,10 7.5,16 9.5,6 11,13 13,13 14.5,10 16,13 18.5,13"
          stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
          fill="none"
        />
        {/* Peak dot */}
        <circle cx="9.5" cy="6" r="1.2" fill={c} />
      </>
    )}
  </Icon>
);


// ══════════════════════════════════════════════════════════════════════
// 8. JOURNAL  ( "/journal" )
// Concept: an open book with a writing nib / quill — personal, literary.
//          Clean angular book pages + diagonal pen stroke.
// ══════════════════════════════════════════════════════════════════════
export const JournalIcon = ({ size = 20, color = "currentColor" }) => (
  <Icon size={size} color={color}>
    {(c) => (
      <>
        {/* Book spine */}
        <line x1="10" y1="3" x2="10" y2="17" stroke={c} strokeWidth="1.1" opacity="0.5" />
        {/* Left page */}
        <path d="M10 3 C8 3 3.5 4 3 5 L3 16 C3.5 15 8 14 10 15 Z"
          stroke={c} strokeWidth="1.2" fill="none" strokeLinejoin="round" />
        {/* Right page */}
        <path d="M10 3 C12 3 16.5 4 17 5 L17 16 C16.5 15 12 14 10 15 Z"
          stroke={c} strokeWidth="1.2" fill="none" strokeLinejoin="round" opacity="0.7" />
        {/* Writing lines on left page */}
        <line x1="5" y1="7.5" x2="9" y2="7" stroke={c} strokeWidth="0.9"
          strokeLinecap="round" opacity="0.5" />
        <line x1="5" y1="10" x2="9" y2="9.5" stroke={c} strokeWidth="0.9"
          strokeLinecap="round" opacity="0.4" />
        <line x1="5" y1="12.5" x2="8.5" y2="12" stroke={c} strokeWidth="0.9"
          strokeLinecap="round" opacity="0.3" />
        {/* Nib / pen hint top right */}
        <path d="M14.5 4 L17.5 2 L16.5 5 Z" fill={c} opacity="0.7" />
      </>
    )}
  </Icon>
);


// ══════════════════════════════════════════════════════════════════════
// 9. MEDS  ( "/meds" )
// Concept: a capsule pill (half + half) with a cross mark —
//          clinical, precise, pharmaceutical.
// ══════════════════════════════════════════════════════════════════════
export const MedsIcon = ({ size = 20, color = "currentColor" }) => (
  <Icon size={size} color={color}>
    {(c) => (
      <>
        {/* Capsule body — rotated 45° */}
        <g transform="rotate(45 10 10)">
          {/* Left half */}
          <path d="M5 10 A5 5 0 0 1 10 5 L10 15 A5 5 0 0 1 5 10 Z"
            fill={c} opacity="0.9" />
          {/* Right half */}
          <path d="M15 10 A5 5 0 0 1 10 15 L10 5 A5 5 0 0 1 15 10 Z"
            fill="none" stroke={c} strokeWidth="1.2" />
          {/* Join line */}
          <line x1="10" y1="5" x2="10" y2="15" stroke={c} strokeWidth="0.8"
            opacity="0.4" />
        </g>
        {/* Cross symbol — bottom right */}
        <line x1="14.5" y1="13" x2="14.5" y2="17" stroke={c} strokeWidth="1.3"
          strokeLinecap="round" />
        <line x1="12.5" y1="15" x2="16.5" y2="15" stroke={c} strokeWidth="1.3"
          strokeLinecap="round" />
      </>
    )}
  </Icon>
);


// ══════════════════════════════════════════════════════════════════════
// 10. RAG / HEALTH ADVISOR  ( "/rag" )
// Concept: a brain with a circuit trace inside it — AI knowledge retrieval,
//          neural + technical, very specific to an AI system.
// ══════════════════════════════════════════════════════════════════════
export const RAGIcon = ({ size = 20, color = "currentColor" }) => (
  <Icon size={size} color={color}>
    {(c) => (
      <>
        {/* Brain outline */}
        <path d="M10 16.5 C7 16.5 4 14.5 3.5 11.5 C3 9 4 7 5.5 6
                 C5.5 4 7 2.5 9 2.5 C9.5 2.5 10 2.7 10 2.7
                 C10 2.7 10.5 2.5 11 2.5 C13 2.5 14.5 4 14.5 6
                 C16 7 17 9 16.5 11.5 C16 14.5 13 16.5 10 16.5 Z"
          stroke={c} strokeWidth="1.2" fill="none" strokeLinejoin="round" />
        {/* Brain center crease */}
        <line x1="10" y1="2.7" x2="10" y2="16.5" stroke={c} strokeWidth="0.8"
          opacity="0.3" strokeDasharray="1.5 1.5" />
        {/* Circuit traces inside */}
        <path d="M6.5 8 L8 8 L8 10 L12 10 L12 8 L13.5 8"
          stroke={c} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"
          fill="none" opacity="0.6" />
        {/* Circuit nodes */}
        <circle cx="6.5" cy="8" r="1" fill={c} opacity="0.7" />
        <circle cx="13.5" cy="8" r="1" fill={c} opacity="0.7" />
        <circle cx="10" cy="13" r="1.1" fill={c} opacity="0.5" />
        <line x1="10" y1="10" x2="10" y2="13" stroke={c} strokeWidth="0.9"
          opacity="0.4" strokeLinecap="round" />
      </>
    )}
  </Icon>
);


// ══════════════════════════════════════════════════════════════════════
// 11. LANGUAGE  ( language switcher button )
// Concept: two speech bubbles overlapping with a small wave (sound) —
//          translation / multilingual, not just a globe.
// ══════════════════════════════════════════════════════════════════════
export const LanguageIcon = ({ size = 20, color = "currentColor" }) => (
  <Icon size={size} color={color}>
    {(c) => (
      <>
        {/* Left bubble */}
        <path d="M2 3 Q2 1.5 3.5 1.5 L10 1.5 Q11.5 1.5 11.5 3 L11.5 7.5
                 Q11.5 9 10 9 L5.5 9 L3 11 L3.5 9 Q2 9 2 7.5 Z"
          stroke={c} strokeWidth="1.1" fill="none" strokeLinejoin="round" />
        {/* Right bubble (lower, overlapping) */}
        <path d="M8.5 8.5 Q8.5 7 10 7 L16.5 7 Q18 7 18 8.5 L18 13
                 Q18 14.5 16.5 14.5 L11 14.5 L16.5 17 L12 14.5
                 Q10 14.5 8.5 13 Z"
          stroke={c} strokeWidth="1.1" fill="none" strokeLinejoin="round" opacity="0.7" />
        {/* Text lines inside left bubble */}
        <line x1="4.5" y1="4.5" x2="9.5" y2="4.5" stroke={c} strokeWidth="0.9"
          strokeLinecap="round" opacity="0.5" />
        <line x1="4.5" y1="6.5" x2="8" y2="6.5" stroke={c} strokeWidth="0.9"
          strokeLinecap="round" opacity="0.4" />
        {/* Text lines inside right bubble */}
        <line x1="11" y1="9.5" x2="16" y2="9.5" stroke={c} strokeWidth="0.9"
          strokeLinecap="round" opacity="0.4" />
        <line x1="11" y1="11.5" x2="14.5" y2="11.5" stroke={c} strokeWidth="0.9"
          strokeLinecap="round" opacity="0.35" />
      </>
    )}
  </Icon>
);


// ══════════════════════════════════════════════════════════════════════
// 12. DASHBOARD  ( "/dashboard" )
// Concept: a 2×2 grid of tiles with varying fill levels — classic
//          dashboard/analytics, clean and immediately recognisable.
// ══════════════════════════════════════════════════════════════════════
export const DashboardIcon = ({ size = 20, color = "currentColor" }) => (
  <Icon size={size} color={color}>
    {(c) => (
      <>
        {/* Top-left tile — tall bar chart */}
        <rect x="2" y="2" width="7" height="7" rx="1.5"
          stroke={c} strokeWidth="1.1" fill="none" />
        <rect x="3.5" y="5.5" width="1.5" height="2" rx="0.4" fill={c} opacity="0.8" />
        <rect x="5.5" y="4" width="1.5" height="3.5" rx="0.4" fill={c} opacity="0.6" />
        {/* Top-right tile — donut */}
        <rect x="11" y="2" width="7" height="7" rx="1.5"
          stroke={c} strokeWidth="1.1" fill="none" />
        <circle cx="14.5" cy="5.5" r="2.2" stroke={c} strokeWidth="1.4" fill="none" opacity="0.7" />
        <path d="M14.5 3.3 A2.2 2.2 0 0 1 16.5 5.5"
          stroke={c} strokeWidth="1.4" strokeLinecap="round" fill="none" />
        {/* Bottom-left tile — line graph */}
        <rect x="2" y="11" width="7" height="7" rx="1.5"
          stroke={c} strokeWidth="1.1" fill="none" />
        <polyline points="3.5,16.5 5,14.5 6.5,15.5 7.5,13"
          stroke={c} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"
          fill="none" opacity="0.7" />
        {/* Bottom-right tile — value */}
        <rect x="11" y="11" width="7" height="7" rx="1.5"
          fill={c} opacity="0.15" stroke={c} strokeWidth="1.1" />
        <circle cx="14.5" cy="14.5" r="1.5" fill={c} opacity="0.9" />
      </>
    )}
  </Icon>
);


// ══════════════════════════════════════════════════════════════════════
// 13. LOGOUT  ( logout button )
// Concept: a right-facing arrow exiting a doorframe — clean, universal.
// ══════════════════════════════════════════════════════════════════════
export const LogoutIcon = ({ size = 20, color = "currentColor" }) => (
  <Icon size={size} color={color}>
    {(c) => (
      <>
        {/* Door frame */}
        <path d="M8 3 L3 3 L3 17 L8 17" stroke={c} strokeWidth="1.3"
          strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.6" />
        {/* Arrow */}
        <line x1="7.5" y1="10" x2="17" y2="10" stroke={c} strokeWidth="1.4"
          strokeLinecap="round" />
        <polyline points="13.5,6.5 17,10 13.5,13.5" stroke={c} strokeWidth="1.4"
          strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    )}
  </Icon>
);


// ══════════════════════════════════════════════════════════════════════
// UPDATED NAV ARRAY — drop this into App.jsx
// Replace the existing `const NAV = [...]` with this:
// ══════════════════════════════════════════════════════════════════════
/*
const NAV = [
  { route: "/",          icon: <OrbitIcon />,     label: "Orbit" },
  { route: "/dashboard", icon: <DashboardIcon />, label: "Dashboard" },
  { route: "/emotion",   icon: <MindScanIcon />,  label: "MindScan" },
  { route: "/circles",   icon: <CirclesIcon />,   label: "Circles" },
  { route: "/breathing", icon: <BreatheIcon />,   label: "Breathe" },
  { route: "/drugs",     icon: <DrugGNNIcon />,   label: "Drug GNN" },
  { route: "/timeline",  icon: <TimelineIcon />,  label: "Timeline" },
  { route: "/activity",  icon: <ActivityIcon />,  label: "Activity" },
  { route: "/journal",   icon: <JournalIcon />,   label: "Journal" },
  { route: "/meds",      icon: <MedsIcon />,      label: "Meds" },
  { route: "/rag",       icon: <RAGIcon />,       label: "Advisor" },
];

// In the Sidebar, the language button becomes:
<button onClick={() => setShowLang(!showLang)}>
  <LanguageIcon />
</button>

// Logout button:
<button onClick={onLogout}>
  <LogoutIcon />
</button>
*/

// ══════════════════════════════════════════════════════════════════════
// PREVIEW COMPONENT — open this file in an artifact to see all icons
// ══════════════════════════════════════════════════════════════════════
export function IconPreview() {
  const icons = [
    { Icon: OrbitIcon,    name: "HealthOrbit",    route: "/" },
    { Icon: DashboardIcon,name: "Dashboard",      route: "/dashboard" },
    { Icon: MindScanIcon, name: "MindScan",       route: "/emotion" },
    { Icon: CirclesIcon,  name: "Circles",        route: "/circles" },
    { Icon: BreatheIcon,  name: "Breathe",        route: "/breathing" },
    { Icon: DrugGNNIcon,  name: "Drug GNN",       route: "/drugs" },
    { Icon: TimelineIcon, name: "Timeline",       route: "/timeline" },
    { Icon: ActivityIcon, name: "Activity",       route: "/activity" },
    { Icon: JournalIcon,  name: "Journal",        route: "/journal" },
    { Icon: MedsIcon,     name: "Meds",           route: "/meds" },
    { Icon: RAGIcon,      name: "Health Advisor", route: "/rag" },
    { Icon: LanguageIcon, name: "Language",       route: "—" },
    { Icon: LogoutIcon,   name: "Logout",         route: "—" },
  ];

  return (
    <div style={{
      background: "#070a0f", minHeight: "100vh", padding: 40,
      fontFamily: "'DM Mono', monospace",
      display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 16,
    }}>
      {icons.map(({ Icon, name, route }) => (
        <div key={name} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
          padding: "20px 12px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12,
        }}>
          {/* Active state */}
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: "rgba(99,102,241,0.18)",
            border: "1px solid rgba(99,102,241,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#818cf8",
          }}>
            <Icon size={20} color="currentColor" />
          </div>
          {/* Idle state */}
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: "transparent",
            border: "1px solid transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "rgba(255,255,255,0.3)",
          }}>
            <Icon size={20} color="currentColor" />
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 1, textAlign: "center" }}>
            {name}
          </div>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)" }}>
            {route}
          </div>
        </div>
      ))}
    </div>
  );
}
