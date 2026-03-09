import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

// ── Deterministic seeded pseudo-random for stable SSR layouts ──────────────
function seededRand(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

// ── Build node graph ───────────────────────────────────────────────────────
function buildGraph(nodeCount = 18) {
  const rng = seededRand(42)
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: i,
    x: 40 + rng() * 520,
    y: 30 + rng() * 220,
    r: 3 + rng() * 5,
    label: i === 0 ? 'INPUT' : i === nodeCount - 1 ? 'OUTPUT' : null,
    color: i % 3 === 0 ? '#F97316' : i % 3 === 1 ? '#8b5cf6' : '#22d3a5',
  }))
  // Build edges (sparse random connections)
  const edges = []
  nodes.forEach((n, i) => {
    const targets = [i + 1, i + 2, i + 4].filter(t => t < nodeCount && rng() > 0.35)
    targets.forEach(t => edges.push({ from: i, to: t }))
  })
  return { nodes, edges }
}

const GRAPH = buildGraph(18)

// ── Labels that stream as "thinking" ──────────────────────────────────────
const THINK_STEPS = [
  'Analysing patient profile…',
  'Checking drug–nutrient interactions…',
  'Evaluating renal function constraints…',
  'Scoring 1,247 meal combinations…',
  'Applying knapsack optimization…',
  'Running PQC signature verification…',
  'Generating clinical narrative…',
  'Plan ready ✓',
]

// ═══════════════════════════════════════════════════════════════════════════
// AIThinkingViz  — cinematic node-graph reasoning animation
// Props:
//   active   boolean  — show the animation
//   onDone   fn       — called when last step completes
// ═══════════════════════════════════════════════════════════════════════════
export default function AIThinkingViz({ active = true, onDone }) {
  const svgRef    = useRef(null)
  const labelRef  = useRef(null)
  const glowRef   = useRef(null)
  const tlRef     = useRef(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [done, setDone]       = useState(false)

  // Animate node graph
  useEffect(() => {
    if (!active || !svgRef.current) return
    const svg = svgRef.current
    const nodes = svg.querySelectorAll('.ai-node')
    const edges = svg.querySelectorAll('.ai-edge')
    const pulses = svg.querySelectorAll('.ai-pulse')

    // Kill previous
    if (tlRef.current) tlRef.current.kill()

    const tl = gsap.timeline()
    tlRef.current = tl

    // Edges fade in phase
    tl.fromTo(edges,
      { opacity: 0, strokeDashoffset: 120 },
      { opacity: 0.25, strokeDashoffset: 0, stagger: 0.04, duration: 1.2, ease: 'power2.out' },
      0
    )
    // Nodes pop in
    tl.fromTo(nodes,
      { scale: 0, opacity: 0, transformOrigin: 'center' },
      { scale: 1, opacity: 1, stagger: 0.06, duration: 0.5, ease: 'back.out(2)' },
      0.1
    )

    // Pulse wave forward through nodes
    GRAPH.nodes.forEach((n, i) => {
      tl.to(`#ai-node-${i}`, {
        attr: { r: n.r + 4 }, opacity: 1,
        duration: 0.25, ease: 'power2.in',
        yoyo: true, repeat: 1,
      }, 1.2 + i * 0.12)
    })

    // Traveling pulses along edges
    pulses.forEach((pulse, i) => {
      tl.fromTo(pulse,
        { opacity: 0, strokeDashoffset: 80 },
        { opacity: 0.9, strokeDashoffset: 0, duration: 0.6, ease: 'none', repeat: 2, repeatDelay: 0.8 },
        1.5 + i * 0.22
      )
    })

    return () => tl.kill()
  }, [active])

  // Step through thinking labels
  useEffect(() => {
    if (!active) { setStepIdx(0); setDone(false); return }
    setDone(false)
    setStepIdx(0)
    const interval = setInterval(() => {
      setStepIdx(prev => {
        if (prev >= THINK_STEPS.length - 1) {
          clearInterval(interval)
          setDone(true)
          onDone?.()
          return prev
        }
        return prev + 1
      })
    }, 900)
    return () => clearInterval(interval)
  }, [active, onDone])

  // Label fade
  useEffect(() => {
    if (labelRef.current) {
      gsap.fromTo(labelRef.current, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3 })
    }
  }, [stepIdx])

  if (!active) return null

  const { nodes, edges } = GRAPH

  return (
    <div style={{
      position: 'relative',
      background: 'rgba(8,8,15,0.8)',
      border: '1px solid rgba(249,115,22,0.15)',
      borderRadius: 16,
      overflow: 'hidden',
      backdropFilter: 'blur(20px)',
    }}>
      {/* Ambient glow */}
      <div ref={glowRef} style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(139,92,246,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Node graph SVG */}
      <svg
        ref={svgRef}
        viewBox="0 0 600 280"
        style={{ width: '100%', height: 'auto', display: 'block' }}
        aria-hidden="true"
      >
        <defs>
          <filter id="ai-blur">
            <feGaussianBlur stdDeviation="2" result="blur" />
          </filter>
          {/* Glow filters per color */}
          {['#F97316','#8b5cf6','#22d3a5'].map((c, i) => (
            <filter key={i} id={`glow-${i}`}>
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          ))}
          <radialGradient id="node-grad-0" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F97316" stopOpacity="1" />
            <stop offset="100%" stopColor="#F97316" stopOpacity="0.4" />
          </radialGradient>
          <radialGradient id="node-grad-1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="1" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.4" />
          </radialGradient>
          <radialGradient id="node-grad-2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22d3a5" stopOpacity="1" />
            <stop offset="100%" stopColor="#22d3a5" stopOpacity="0.4" />
          </radialGradient>
        </defs>

        {/* Grid */}
        <pattern id="ai-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
        </pattern>
        <rect width="600" height="280" fill="url(#ai-grid)" />

        {/* Edges */}
        {edges.map((e, i) => {
          const from = nodes[e.from], to = nodes[e.to]
          const len = Math.hypot(to.x - from.x, to.y - from.y)
          return (
            <line
              key={i}
              className="ai-edge"
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
              strokeDasharray={`${len} ${len}`}
              strokeDashoffset={len}
            />
          )
        })}

        {/* Traveling pulses */}
        {edges.slice(0, 8).map((e, i) => {
          const from = nodes[e.from], to = nodes[e.to]
          const len = Math.hypot(to.x - from.x, to.y - from.y)
          const colors = ['#F97316','#8b5cf6','#22d3a5']
          return (
            <line
              key={i}
              className="ai-pulse"
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={colors[i % 3]}
              strokeWidth="2"
              strokeDasharray="12 999"
              strokeLinecap="round"
              opacity="0"
            />
          )
        })}

        {/* Nodes */}
        {nodes.map((n, i) => (
          <g key={i}>
            {/* Glow halo */}
            <circle
              cx={n.x} cy={n.y} r={n.r + 6}
              fill={n.color}
              opacity="0.08"
              filter={`url(#glow-${i % 3})`}
            />
            {/* Core node */}
            <circle
              id={`ai-node-${i}`}
              className="ai-node"
              cx={n.x} cy={n.y} r={n.r}
              fill={`url(#node-grad-${i % 3})`}
              stroke={n.color}
              strokeWidth="0.5"
              opacity="0"
            />
            {/* Label for first/last */}
            {n.label && (
              <text
                x={n.x} y={n.y - n.r - 6}
                textAnchor="middle"
                fontSize="8"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="700"
                fill={n.color}
                letterSpacing="1"
              >{n.label}</text>
            )}
          </g>
        ))}
      </svg>

      {/* Thinking label */}
      <div style={{
        padding: '12px 20px 16px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {/* Spinner / done icon */}
        <div style={{
          width: 18, height: 18, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {done ? (
            <span style={{ color: '#22d3a5', fontSize: 14, filter: 'drop-shadow(0 0 6px rgba(34,211,165,0.6))' }}>✓</span>
          ) : (
            <svg viewBox="0 0 18 18" width="18" height="18" style={{ animation: 'spin 0.9s linear infinite' }}>
              <circle cx="9" cy="9" r="7" fill="none" stroke="rgba(249,115,22,0.2)" strokeWidth="2" />
              <path d="M 9 2 A 7 7 0 0 1 16 9" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </div>

        <span
          ref={labelRef}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11.5,
            color: done ? '#22d3a5' : 'rgba(255,255,255,0.55)',
            letterSpacing: '0.02em',
          }}
        >
          {THINK_STEPS[stepIdx]}
        </span>

        {/* Step counter */}
        <span style={{
          marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'rgba(255,255,255,0.2)',
        }}>
          {stepIdx + 1}/{THINK_STEPS.length}
        </span>
      </div>
    </div>
  )
}
