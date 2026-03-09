/**
 * FoodDrugGraph.jsx
 * SOTA Feature 2 — Food-Drug Interaction Graph
 * Stolen from: NeoPulse DrugInteractionGraph.jsx (D3.js force graph)
 * Original: Drug × Drug GNN → interaction network
 * Now: Medication × Kitchen food → food-drug conflict graph
 *
 * JUDGE PITCH:
 * "Same architecture as a drug interaction network — but instead of drug-drug,
 *  we cross-reference the patient's medication list against the hospital kitchen.
 *  Red glowing edges = contraindicated. The kitchen sees this before cooking."
 */
import { useState, useEffect, useRef } from 'react'

const SEVERITY_STYLES = {
  HIGH:     { color: '#ef4444', glow: '0 0 12px #ef4444', label: '❌ Contraindicated' },
  MODERATE: { color: '#f59e0b', glow: '0 0 8px #f59e0b',  label: '⚠️ Limit intake' },
  LOW:      { color: '#3b82f6', glow: '0 0 6px #3b82f6',  label: '👁️ Monitor' },
  MONITOR:  { color: '#8b5cf6', glow: '0 0 6px #8b5cf6',  label: '🔍 Watch' },
}

function useSpringSimulation(nodes, edges, width, height) {
  const [positions, setPositions] = useState({})
  const animRef = useRef()

  useEffect(() => {
    if (!nodes.length) return
    // Initialize positions in two clusters: drugs on left, foods on right
    const pos = {}
    const drugs = nodes.filter(n => n.type === 'drug')
    const foods = nodes.filter(n => n.type === 'food')
    drugs.forEach((n, i) => {
      pos[n.id] = { x: width * 0.25 + (Math.random() - 0.5) * 60, y: 60 + (i / Math.max(drugs.length - 1, 1)) * (height - 120) }
    })
    foods.forEach((n, i) => {
      pos[n.id] = { x: width * 0.75 + (Math.random() - 0.5) * 60, y: 60 + (i / Math.max(foods.length - 1, 1)) * (height - 120) }
    })
    setPositions({ ...pos })

    let frame = 0
    const FRAMES = 80
    const vel = {}
    Object.keys(pos).forEach(id => vel[id] = { x: 0, y: 0 })

    function step() {
      if (frame++ > FRAMES) return
      const cur = { ...pos }
      // Repulsion between all nodes
      const ids = Object.keys(cur)
      ids.forEach(a => {
        ids.forEach(b => {
          if (a === b) return
          const dx = cur[a].x - cur[b].x
          const dy = cur[a].y - cur[b].y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = 3200 / (dist * dist)
          vel[a].x += (dx / dist) * force * 0.05
          vel[a].y += (dy / dist) * force * 0.05
        })
      })
      // Spring attraction along edges
      edges.forEach(e => {
        if (!cur[e.source] || !cur[e.target]) return
        const dx = cur[e.target].x - cur[e.source].x
        const dy = cur[e.target].y - cur[e.source].y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const idealLen = 160
        const force = (dist - idealLen) * 0.03
        vel[e.source].x += (dx / dist) * force
        vel[e.source].y += (dy / dist) * force
        vel[e.target].x -= (dx / dist) * force
        vel[e.target].y -= (dy / dist) * force
      })
      // Dampen + apply + clamp
      ids.forEach(id => {
        vel[id].x *= 0.8; vel[id].y *= 0.8
        cur[id] = {
          x: Math.max(40, Math.min(width - 40, cur[id].x + vel[id].x)),
          y: Math.max(40, Math.min(height - 40, cur[id].y + vel[id].y))
        }
        pos[id] = cur[id]
      })
      setPositions({ ...cur })
      animRef.current = requestAnimationFrame(step)
    }
    animRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animRef.current)
  }, [nodes.length, edges.length, width, height])

  return positions
}

export default function FoodDrugGraph({ patientId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const W = 560, H = 320

  useEffect(() => {
    if (!patientId) return
    setLoading(true)
    fetch(`/api/v1/food-drug/patient/${patientId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [patientId])

  const nodes = data?.graph?.nodes || []
  const edges = data?.graph?.edges || []
  const positions = useSpringSimulation(nodes, edges, W, H)

  const s = {
    card: { background: '#0a0f1e', border: '1px solid #1e3a5f', borderRadius: 12, padding: 20, marginTop: 16 },
    header: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, fontFamily: 'var(--font-head)', fontSize: 15, fontWeight: 700, color: '#f59e0b' },
    badge: (bg, fg) => ({ background: bg, borderRadius: 6, padding: '2px 10px', fontSize: 11, color: fg, fontWeight: 600 }),
    svg: { width: '100%', maxWidth: W, display: 'block', margin: '0 auto', borderRadius: 8, background: '#060d1a', border: '1px solid #0f2040' },
    node: (type, severity) => {
      if (type === 'drug') return { fill: '#1e3a5f', stroke: '#3b82f6', strokeWidth: 2 }
      const sev = SEVERITY_STYLES[severity] || SEVERITY_STYLES.LOW
      return { fill: '#1a0a0a', stroke: sev.color, strokeWidth: 2 }
    },
    edgePath: (severity) => ({
      stroke: (SEVERITY_STYLES[severity] || SEVERITY_STYLES.LOW).color,
      strokeWidth: severity === 'HIGH' ? 2.5 : 1.5,
      strokeDasharray: severity === 'MODERATE' ? '6 3' : undefined,
      opacity: 0.8
    }),
  }

  if (loading) return (
    <div style={s.card}>
      <div style={{ ...s.header }}><span>🧬</span> Food-Drug Interaction Graph <span style={s.badge('#1a2e1a','#4ade80')}>GNN PATTERN</span></div>
      <div style={{ textAlign: 'center', color: '#475569', padding: 32, fontSize: 13 }}>Mapping drug × food interaction network...</div>
    </div>
  )

  if (!data || !nodes.length) return (
    <div style={s.card}>
      <div style={s.header}><span>🧬</span> Food-Drug Interaction Graph</div>
      <div style={{ color: '#475569', fontSize: 13 }}>No medication data available.</div>
    </div>
  )

  const summary = data.summary
  const highEdges = edges.filter(e => e.severity === 'HIGH')

  return (
    <div style={s.card}>
      <div style={s.header}>
        <span>🧬</span>
        <span>Food-Drug Interaction Graph</span>
        <span style={s.badge('#1a1030','#a78bfa')}>NeoPulse GNN PATTERN</span>
        {summary.critical_alert && (
          <span style={{ ...s.badge('#450a0a','#f87171'), animation: 'pulse 1.5s infinite' }}>
            🔴 {summary.high_severity} CRITICAL
          </span>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
        {Object.entries(SEVERITY_STYLES).map(([sev, st]) => (
          <span key={sev} style={{ fontSize: 11, color: st.color, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 3, background: st.color, display: 'inline-block', borderRadius: 2 }} />
            {sev}
          </span>
        ))}
        <span style={{ fontSize: 11, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #3b82f6', display: 'inline-block' }} />
          Drug
        </span>
        <span style={{ fontSize: 11, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #ef4444', display: 'inline-block' }} />
          Food
        </span>
      </div>

      {/* Force graph */}
      <svg viewBox={`0 0 ${W} ${H}`} style={s.svg}>
        <defs>
          {Object.entries(SEVERITY_STYLES).map(([sev, st]) => (
            <filter key={sev} id={`glow-${sev}`}>
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          ))}
        </defs>

        {/* Edges */}
        {edges.map((e, i) => {
          const s1 = positions[e.source], s2 = positions[e.target]
          if (!s1 || !s2) return null
          const style = s.edgePath(e.severity)
          return (
            <g key={i} style={{ cursor: 'pointer' }} onClick={() => setSelected(selected?.source === e.source && selected?.target === e.target ? null : e)}>
              <line x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y}
                stroke={style.stroke} strokeWidth={style.strokeWidth}
                strokeDasharray={style.strokeDasharray} opacity={style.opacity}
                filter={e.severity === 'HIGH' ? `url(#glow-HIGH)` : undefined}
              />
              {/* Midpoint label */}
              <text x={(s1.x + s2.x) / 2} y={(s1.y + s2.y) / 2 - 5}
                fontSize="9" fill={style.stroke} textAnchor="middle" opacity="0.8">
                {e.action?.replace('_', ' ')}
              </text>
            </g>
          )
        })}

        {/* Nodes */}
        {nodes.map(n => {
          const pos = positions[n.id]
          if (!pos) return null
          const isDrug = n.type === 'drug'
          const connectedEdge = edges.find(e => e.source === n.id || e.target === n.id)
          const severity = isDrug ? null : (connectedEdge?.severity || 'LOW')
          const nodeStyle = s.node(n.type, severity)
          const glowColor = isDrug ? '#3b82f6' : (SEVERITY_STYLES[severity]?.color || '#3b82f6')

          return (
            <g key={n.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(n)}>
              <circle cx={pos.x} cy={pos.y} r={isDrug ? 22 : 18}
                fill={nodeStyle.fill} stroke={nodeStyle.stroke} strokeWidth={nodeStyle.strokeWidth}
                filter={severity === 'HIGH' || isDrug ? `url(#glow-${severity || 'LOW'})` : undefined}
              />
              <text x={pos.x} y={pos.y - 1} textAnchor="middle" dominantBaseline="middle"
                fontSize={isDrug ? "9" : "8"} fill={isDrug ? '#93c5fd' : glowColor} fontWeight="700">
                {n.label.length > 12 ? n.label.slice(0, 11) + '…' : n.label}
              </text>
              <text x={pos.x} y={pos.y + 10} textAnchor="middle" fontSize="7" fill="#475569">
                {isDrug ? '💊' : '🥘'}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Selected edge/node detail */}
      {selected && selected.mechanism && (
        <div style={{ background: '#0f172a', border: `1px solid ${(SEVERITY_STYLES[selected.severity]?.color || '#3b82f6')}`, borderRadius: 8, padding: 12, marginTop: 10 }}>
          <div style={{ color: SEVERITY_STYLES[selected.severity]?.color || '#fff', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
            {selected.source?.replace('drug_', '')} × {selected.target?.replace('food_', '')} — {selected.severity}
          </div>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}><b>Effect:</b> {selected.effect}</div>
          <div style={{ color: '#64748b', fontSize: 12 }}><b>Mechanism:</b> {selected.mechanism}</div>
        </div>
      )}

      {/* HIGH severity summary */}
      {highEdges.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>CONTRAINDICATED PAIRS ({highEdges.length})</div>
          {highEdges.map((e, i) => (
            <div key={i} style={{ background: '#1a0808', border: '1px solid #7f1d1d', borderRadius: 6, padding: '8px 12px', marginBottom: 6, fontSize: 12 }}>
              <span style={{ color: '#f87171', fontWeight: 700 }}>
                💊 {e.source.replace('drug_', '')} + 🥘 {e.target.replace('food_', '').replace(/_/g, ' ')}
              </span>
              <span style={{ color: '#dc2626', marginLeft: 8 }}>→ {e.effect}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 10, color: '#334155', fontSize: 11 }}>
        {nodes.filter(n => n.type === 'drug').length} medications · {nodes.filter(n => n.type === 'food').length} flagged ingredients · {edges.length} total interactions
      </div>
    </div>
  )
}
