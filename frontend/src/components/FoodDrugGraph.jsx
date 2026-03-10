/**
 * FoodDrugGraph.jsx
 * SOTA Feature 2 — Food-Drug Interaction Graph
 * Stolen from: NeoPulse DrugInteractionGraph.jsx (D3.js force graph)
 * Original: Drug × Drug GNN → interaction network
 * Now: Medication × Kitchen food → food-drug conflict graph
 */
import { useState, useEffect, useRef } from 'react'
import { foodDrugApi, ollamaApi } from '../api/client.js'

const SEVERITY_STYLES = {
  HIGH:     { color: '#ef4444', glow: '0 0 12px #ef4444', label: '✘ Contraindicated' },
  MODERATE: { color: '#f59e0b', glow: '0 0 8px #f59e0b',  label: '⚠ Limit intake' },
  LOW:      { color: '#3b82f6', glow: '0 0 6px #3b82f6',  label: '○ Monitor' },
  MONITOR:  { color: '#8b5cf6', glow: '0 0 6px #8b5cf6',  label: '◎ Watch' },
}

function useSpringSimulation(nodes, edges, width, height) {
  const [positions, setPositions] = useState({})
  const animRef = useRef()

  useEffect(() => {
    if (!nodes.length || !width || !height) return

    const pos = {}
    const vel = {}
    const drugs = nodes.filter(n => n.type === 'drug')
    const foods = nodes.filter(n => n.type === 'food')
    const PAD = 64

    // Spread nodes evenly across full column height to use all vertical space
    drugs.forEach((n, i) => {
      const y = drugs.length === 1
        ? height / 2
        : PAD + (i / (drugs.length - 1)) * (height - PAD * 2)
      pos[n.id] = { x: PAD + 8, y }
      vel[n.id]  = { x: 0, y: 0 }
    })
    foods.forEach((n, i) => {
      const y = foods.length === 1
        ? height / 2
        : PAD + (i / (foods.length - 1)) * (height - PAD * 2)
      pos[n.id] = { x: width - PAD - 8, y }
      vel[n.id]  = { x: 0, y: 0 }
    })
    setPositions({ ...pos })

    let frame = 0
    const FRAMES = 380
    // Spring rest length ~35% of width for good cross-column spread
    const IDEAL_LEN = Math.max(130, Math.min(width * 0.36, 290))
    // Column anchor positions
    const COL_DRUG = width * 0.2
    const COL_FOOD = width * 0.8
    // Cap repulsion so wide canvases don't explode
    const K_REP = Math.min(width * height * 0.35, 100000)
    const NODE_R = 30

    function tick() {
      if (frame++ >= FRAMES) { setPositions({ ...pos }); return }
      // Cooling schedule: simulation converges as alpha → 0
      const alpha = 1 - frame / FRAMES
      const ids = Object.keys(pos)

      // Repulsion between every pair of nodes
      for (let ai = 0; ai < ids.length; ai++) {
        for (let bi = ai + 1; bi < ids.length; bi++) {
          const a = ids[ai], b = ids[bi]
          let dx = pos[a].x - pos[b].x
          let dy = pos[a].y - pos[b].y
          let dist = Math.sqrt(dx * dx + dy * dy) || 0.1
          // Hard separation push when circles physically overlap
          if (dist < NODE_R * 2 + 8) {
            const overlap = (NODE_R * 2 + 8 - dist) * 0.5
            const nx = dx / dist, ny = dy / dist
            vel[a].x += nx * overlap * 0.5
            vel[a].y += ny * overlap * 0.5
            vel[b].x -= nx * overlap * 0.5
            vel[b].y -= ny * overlap * 0.5
            dist = NODE_R * 2 + 8
          }
          const force = K_REP / (dist * dist) * alpha
          const nx = dx / dist, ny = dy / dist
          vel[a].x += nx * force * 0.045
          vel[a].y += ny * force * 0.045
          vel[b].x -= nx * force * 0.045
          vel[b].y -= ny * force * 0.045
        }
      }

      // Spring attraction along each edge
      edges.forEach(e => {
        const src = pos[e.source], tgt = pos[e.target]
        if (!src || !tgt) return
        const dx = tgt.x - src.x
        const dy = tgt.y - src.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const spring = (dist - IDEAL_LEN) * 0.032 * alpha
        const nx = dx / dist, ny = dy / dist
        vel[e.source].x += nx * spring
        vel[e.source].y += ny * spring
        vel[e.target].x -= nx * spring
        vel[e.target].y -= ny * spring
      })

      // Column gravity: keep drugs left, foods right — strong enough to hold bipartite layout
      ids.forEach(id => {
        const node = nodes.find(n => n.id === id)
        if (!node) return
        const tx = node.type === 'drug' ? COL_DRUG : COL_FOOD
        vel[id].x += (tx - pos[id].x) * 0.014 * alpha
        // Very gentle vertical centering to prevent drift off canvas
        vel[id].y += (height * 0.5 - pos[id].y) * 0.001 * alpha
      })

      // Dampen + apply + hard boundary clamp
      ids.forEach(id => {
        vel[id].x *= 0.74
        vel[id].y *= 0.74
        pos[id] = {
          x: Math.max(PAD, Math.min(width - PAD, pos[id].x + vel[id].x)),
          y: Math.max(PAD, Math.min(height - PAD, pos[id].y + vel[id].y)),
        }
      })
      setPositions({ ...pos })
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [nodes.length, edges.length, width, height])

  return positions
}

export default function FoodDrugGraph({ patientId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [selectedDrug, setSelectedDrug] = useState(null)
  const [expandedPositions, setExpandedPositions] = useState({})
  const [activeFilter, setActiveFilter] = useState('ALL')
  const [aiSummary, setAiSummary] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiMeta, setAiMeta] = useState(null)
  // Responsive canvas: measure actual container width, derive height from it
  const containerRef = useRef(null)
  const [containerW, setContainerW] = useState(800)
  useEffect(() => {
    if (!containerRef.current) return
    const update = () => {
      const w = containerRef.current?.getBoundingClientRect().width
      if (w > 0) setContainerW(Math.floor(w))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])
  const W = containerW
  const H = Math.max(500, Math.round(W * 0.68))

  useEffect(() => {
    if (!patientId) return
    setLoading(true)
    setData(null)
    setAiSummary(null)
    setAiMeta(null)
    foodDrugApi.getPatient(patientId)
      .then(res => { setData(res?.data ?? res); setLoading(false) })
      .catch(() => setLoading(false))
  }, [patientId])

  async function handleAiSummarize() {
    if (!data) return
    setAiLoading(true)
    setAiSummary(null)
    setAiMeta(null)
    try {
      const graphEdges = data?.graph?.edges || []
      const interactions = (data?.interactions || []).length > 0
        ? data.interactions
        : graphEdges.map(e => ({
            drug:      e.source?.replace('drug_', '') || '',
            food:      e.target?.replace('food_', '') || '',
            severity:  e.severity,
            mechanism: e.mechanism || '',
            effect:    e.effect || e.action || '',
          }))
      const result = await ollamaApi.summarize({
        context_type: 'food_drug',
        patient_id:   patientId,
        data:         { interactions, edges: graphEdges },
      })
      setAiSummary(result.summary)
      setAiMeta({ model: result.model_used, gpu: result.gpu_used, ms: result.time_ms, source: result.source })
    } catch (err) {
      setAiSummary('Could not generate summary — ensure Ollama is running (ollama serve) or Azure OpenAI is configured.')
    } finally {
      setAiLoading(false)
    }
  }

  const nodes = data?.graph?.nodes || []
  const edges = data?.graph?.edges || []
  const positions = useSpringSimulation(nodes, edges, W, H)
  const connectedEdges = selected?.type
    ? edges.filter(e => e.source === selected.id || e.target === selected.id)
    : []

  const effectivePositions = selectedDrug
    ? { ...positions, ...expandedPositions }
    : positions

  const drugFocusFoodIds = selectedDrug
    ? new Set(
        edges
          .filter(e => e.source === selectedDrug || e.target === selectedDrug)
          .map(e => e.source === selectedDrug ? e.target : e.source)
      )
    : null

  const s = {
    card: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginTop: 16 },
    header: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, fontFamily: 'var(--font-head)', fontSize: 15, fontWeight: 700, color: 'var(--amber)' },
    badge: (bg, fg) => ({ background: 'var(--bg3)', borderRadius: 6, padding: '2px 10px', fontSize: 11, color: 'var(--text2)', fontWeight: 600 }),
    svg: { width: '100%', display: 'block', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)' },
    node: (type, severity) => {
      if (type === 'drug') return { fill: '#dbeafe', stroke: '#3b82f6', strokeWidth: 2 }
      const sev = SEVERITY_STYLES[severity] || SEVERITY_STYLES.LOW
      return { fill: '#fff7f7', stroke: sev.color, strokeWidth: 2 }
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
      <div style={{ ...s.header }}><span>◈</span> Food-Drug Interaction Graph <span style={s.badge('#1a2e1a','#4ade80')}>GNN PATTERN</span></div>
      <div style={{ textAlign: 'center', color: '#475569', padding: 32, fontSize: 13 }}>Mapping drug × food interaction network...</div>
    </div>
  )

  if (!data || !nodes.length) return (
    <div style={s.card}>
      <div style={s.header}><span>◈</span> Food-Drug Interaction Graph</div>
      <div style={{ color: '#475569', fontSize: 13 }}>No medication data available.</div>
    </div>
  )

  const summary = data.summary

  return (
    <div style={s.card}>
      <div style={s.header}>
        <span>◈</span>
        <span>Food-Drug Interaction Graph</span>
        <span style={s.badge('#1a1030','#a78bfa')}>GNN KNOWLEDGE GRAPH</span>
        <span style={s.badge('#0c1a12','#34d399')}>BioBERT FALLBACK</span>
        {summary.critical_alert && (
          <span style={{ ...s.badge('#450a0a','#f87171'), animation: 'pulse 1.5s infinite' }}>
            ● {summary.high_severity} CRITICAL
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

      {/* Compact stats bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
          color: '#ef4444', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700,
        }}>
          {edges.filter(e => e.severity === 'HIGH').length} CRITICAL
        </span>
        <span style={{
          background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)',
          color: '#f59e0b', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700,
        }}>
          {edges.filter(e => e.severity === 'MODERATE').length} MODERATE
        </span>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)',
          color: '#34d399', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block', boxShadow: '0 0 4px #34d399' }} />
          BioBERT fallback active
        </span>
      </div>

      {/* Severity filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {['ALL', 'HIGH', 'MODERATE', 'LOW'].map(f => {
          const isActive = activeFilter === f
          const color = f === 'ALL' ? null : SEVERITY_STYLES[f]?.color
          return (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              style={{
                padding: '3px 12px', borderRadius: 20, border: 'none',
                cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: isActive ? (color || '#64748b') : 'var(--bg3)',
                color: isActive ? '#fff' : 'var(--text2)',
                transition: 'background 0.2s ease, color 0.2s ease',
                outline: 'none',
              }}
            >
              {f}
            </button>
          )
        })}
      </div>

      {/* Force graph */}
      <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
      <div ref={containerRef} style={{ flex: 1, minWidth: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={s.svg}>
        <defs>
          <style>{`
            @keyframes edgePulse {
              from { stroke-dashoffset: 0; }
              to   { stroke-dashoffset: 20; }
            }
            @keyframes nodeGlow {
              0%, 100% { stroke-opacity: 0.4; }
              50%       { stroke-opacity: 1.0; }
            }
          `}</style>
          {Object.entries(SEVERITY_STYLES).map(([sev, st]) => (
            <filter key={sev} id={`glow-${sev}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          ))}
        </defs>

        {/* Column header labels */}
        <text x={W * 0.18} y={28} textAnchor="middle" fontSize="11" fill="#3b82f6" fontWeight="600" opacity="0.7">MEDICATIONS</text>
        <text x={W * 0.82} y={28} textAnchor="middle" fontSize="11" fill="#ef4444" fontWeight="600" opacity="0.7">KITCHEN FOODS</text>

        {/* Edges */}
        {edges.map((e, i) => {
          const s1 = effectivePositions[e.source], s2 = effectivePositions[e.target]
          if (!s1 || !s2) return null
          const style = s.edgePath(e.severity)
          const filterMatch = activeFilter === 'ALL' || e.severity === activeFilter
          const edgeFocused = filterMatch && (!selectedDrug || e.source === selectedDrug || e.target === selectedDrug)
          return (
            <g key={i} style={{ cursor: 'pointer', opacity: edgeFocused ? 1 : 0.08, transition: 'opacity 0.4s ease' }} onClick={() => setSelected(selected?.source === e.source && selected?.target === e.target ? null : e)}>
              <title>{`${e.source.replace('drug_', '')} × ${e.target.replace('food_', '')}: ${e.effect || e.action || e.severity}`}</title>
              {/* Wide invisible hit target */}
              <line x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y} stroke="transparent" strokeWidth={12} />
              <line x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y}
                stroke={style.stroke} strokeWidth={style.strokeWidth}
                strokeDasharray={e.severity === 'HIGH' ? '8 4' : style.strokeDasharray}
                opacity={style.opacity}
                filter={e.severity === 'HIGH' ? `url(#glow-HIGH)` : undefined}
                style={e.severity === 'HIGH' ? {
                  animation: 'edgePulse 1.2s linear infinite',
                } : undefined}
              />
            </g>
          )
        })}

        {/* Nodes */}
        {nodes.map(n => {
          const pos = effectivePositions[n.id]
          if (!pos) return null
          const isDrug = n.type === 'drug'
          const connectedEdge = edges.find(e => e.source === n.id || e.target === n.id)
          const severity = isDrug ? null : (connectedEdge?.severity || 'LOW')
          const nodeStyle = s.node(n.type, severity)
          const glowColor = isDrug ? '#3b82f6' : (SEVERITY_STYLES[severity]?.color || '#3b82f6')
          const filterDimmed = activeFilter !== 'ALL' && !isDrug && (() => {
            const nodeEdges = edges.filter(e => e.source === n.id || e.target === n.id)
            return !nodeEdges.some(e => e.severity === activeFilter)
          })()
          const isDimmed = !!(filterDimmed || (selectedDrug && !isDrug && drugFocusFoodIds && !drugFocusFoodIds.has(n.id)))
          const isExpanded = isDrug && selectedDrug === n.id

          return (
            <g
              key={n.id}
              style={{ cursor: 'pointer', opacity: isDimmed ? 0.15 : 1, transition: 'opacity 0.4s ease' }}
              onClick={() => {

                if (isDrug) {
                  if (selectedDrug === n.id) {
                    setSelectedDrug(null)
                    setExpandedPositions({})
                    setSelected(null)
                  } else {
                    const drugEdges = edges.filter(e => e.source === n.id || e.target === n.id)
                    const foodIds = drugEdges.map(e => e.source === n.id ? e.target : e.source)
                    const total = foodIds.length
                    const newPos = { [n.id]: { x: W * 0.5, y: H * 0.5 } }
                    const radius = Math.min(W * 0.32, 220)
                    foodIds.forEach((fid, idx) => {
                      const angle = -Math.PI / 2 + (idx / Math.max(total - 1, 1)) * Math.PI * 1.5
                      newPos[fid] = {
                        x: W * 0.5 + Math.cos(angle) * radius,
                        y: H * 0.5 + Math.sin(angle) * radius,
                      }
                    })
                    setExpandedPositions(newPos)
                    setSelectedDrug(n.id)
                    setSelected(n)
                  }
                } else {
                  setSelected(selected?.id === n.id ? null : n)
                }
              }}
            >
              <title>{n.label}</title>
              <circle cx={pos.x} cy={pos.y} r={isExpanded ? 30 : (isDrug ? 26 : 22)}
                fill={nodeStyle.fill} stroke={nodeStyle.stroke}
                strokeWidth={isExpanded ? 3 : nodeStyle.strokeWidth}
                filter={severity === 'HIGH' || isDrug ? `url(#glow-${severity || 'LOW'})` : undefined}
                style={!isDrug && severity === 'HIGH' ? {
                  animation: 'nodeGlow 1.4s ease-in-out infinite',
                } : undefined}
              />
              {(() => {
                const labelText = n.label.length > 11 ? n.label.slice(0, 10) + '\u2026' : n.label
                const charW = isDrug ? 5.4 : 4.8
                const bgW = Math.max(labelText.length * charW + 4, 20)
                return (
                  <>
                    <rect x={pos.x - bgW / 2} y={pos.y - 11} width={bgW} height={13}
                      rx="2" fill="rgba(10,15,30,0.72)" />
                    <text x={pos.x} y={pos.y - 3} textAnchor="middle" dominantBaseline="middle"
                      fontSize={isDrug ? "9" : "8"} fill={isDrug ? '#bfdbfe' : glowColor} fontWeight="700">
                      {labelText}
                    </text>
                  </>
                )
              })()}
              <text x={pos.x} y={pos.y + 11} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.5)">
                {isDrug ? 'Rx' : '○'}
              </text>
            </g>
          )
        })}
      </svg>
      </div>

      {/* Slide-in detail panel beside SVG */}
      <div style={{
        width: selected ? 220 : 0,
        minWidth: selected ? 220 : 0,
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'width 0.3s ease, min-width 0.3s ease',
        background: 'var(--bg2)',
        borderLeft: selected ? '1px solid var(--border)' : 'none',
        borderRadius: '0 8px 8px 0',
        boxSizing: 'border-box',
        position: 'relative',
      }}>
      <div style={{
        width: 220,
        padding: '14px 12px',
        boxSizing: 'border-box',
        overflowY: 'auto',
        height: '100%',
      }}>
        {selected && (
          <>
            <button
              onClick={() => setSelected(null)}
              style={{
                position: 'absolute', top: 8, right: 8,
                background: 'none', border: 'none', color: 'var(--text2)',
                fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: 2,
              }}
            >×</button>

            {selected.type === 'drug' && (
              <>
                <div style={{ fontSize: 10, color: '#3b82f6', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>Rx MEDICATION</div>
                <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 13, marginBottom: 10, lineHeight: 1.3, paddingRight: 16 }}>{selected.label}</div>
                {selected.drug_class && (
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text3)' }}>Class:</span> {selected.drug_class}
                  </div>
                )}
                {selected.dose && (
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10 }}>
                    <span style={{ color: 'var(--text3)' }}>Dose:</span> {selected.dose}
                  </div>
                )}
              </>
            )}

            {selected.type === 'food' && (
              <>
                <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>○ INGREDIENT</div>
                <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 13, marginBottom: 10, lineHeight: 1.3, paddingRight: 16 }}>{selected.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10 }}>
                  <span style={{ color: 'var(--text3)' }}>Interactions:</span>{' '}
                  <span style={{ color: connectedEdges.length > 0 ? '#f59e0b' : '#64748b', fontWeight: 700 }}>{connectedEdges.length}</span>
                </div>
              </>
            )}

            {!selected.type && selected.mechanism && (
              <>
                <div style={{ fontSize: 10, color: SEVERITY_STYLES[selected.severity]?.color || '#3b82f6', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>⚡ INTERACTION</div>
                <div style={{ color: SEVERITY_STYLES[selected.severity]?.color || 'var(--text)', fontWeight: 700, fontSize: 12, marginBottom: 8, lineHeight: 1.4 }}>
                  {selected.source?.replace('drug_', '')} × {selected.target?.replace('food_', '')}
                </div>
                <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, marginBottom: 2 }}>{selected.severity}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}><b>Effect:</b> {selected.effect}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}><b>Mechanism:</b> {selected.mechanism}</div>
              </>
            )}

            {selected.type && connectedEdges.length > 0 && (
              <>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: 1, marginBottom: 6, marginTop: 4 }}>INTERACTIONS</div>
                {connectedEdges.map((e, i) => {
                  const sev = SEVERITY_STYLES[e.severity] || SEVERITY_STYLES.LOW
                  const otherName = selected.type === 'drug'
                    ? e.target.replace('food_', '').replace(/_/g, ' ')
                    : e.source.replace('drug_', '')
                  return (
                    <div
                      key={i}
                      style={{
                        background: `${sev.color}18`,
                        border: `1px solid ${sev.color}50`,
                        borderRadius: 5, padding: '5px 8px', marginBottom: 5, cursor: 'pointer',
                      }}
                      onClick={() => setSelected(e)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600 }}>{otherName}</span>
                        <span style={{
                          fontSize: 9, color: sev.color, fontWeight: 700,
                          background: `${sev.color}25`, borderRadius: 3, padding: '1px 4px',
                        }}>{e.severity}</span>
                      </div>
                      {e.effect && (
                        <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.3 }}>
                          {e.effect.length > 55 ? e.effect.slice(0, 55) + '…' : e.effect}
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </>
        )}
      </div>
      </div>
      </div>

      {/* ── Ollama AI Plain-Language Summary ─────────────────────────── */}
      <div style={{
        marginTop: 18,
        background: 'linear-gradient(135deg, rgba(96,165,250,0.06) 0%, rgba(167,139,250,0.06) 100%)',
        border: '1px solid rgba(96,165,250,0.2)',
        borderRadius: 12,
        padding: '14px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: aiSummary ? 12 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>◎</span>
            <span style={{ fontFamily: 'var(--font-head)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              Plain Language Summary
            </span>
            <span style={{
              fontSize: 9, letterSpacing: 1, padding: '2px 7px',
              background: 'rgba(96,165,250,0.12)', color: '#60a5fa',
              borderRadius: 10, fontWeight: 600,
            }}>
              OLLAMA GPU
            </span>
          </div>
          <button
            onClick={handleAiSummarize}
            disabled={aiLoading || !data}
            style={{
              background: aiLoading ? 'rgba(96,165,250,0.08)' : 'rgba(96,165,250,0.15)',
              border: '1px solid rgba(96,165,250,0.35)',
              borderRadius: 8, padding: '5px 14px', cursor: aiLoading ? 'default' : 'pointer',
              fontSize: 11, fontWeight: 700, color: '#60a5fa',
              transition: 'background 0.2s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {aiLoading ? (
              <>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  border: '2px solid #60a5fa', borderTopColor: 'transparent',
                  display: 'inline-block',
                  animation: 'spin 0.8s linear infinite',
                }} />
                Summarizing...
              </>
            ) : (
              <>⚡ {aiSummary ? 'Re-explain' : 'Explain in plain language'}</>
            )}
          </button>
        </div>

        {aiSummary && (
          <div>
            <p style={{
              fontSize: 13, lineHeight: 1.7, color: 'var(--text)',
              margin: 0, padding: '10px 14px',
              background: 'rgba(0,0,0,0.2)', borderRadius: 8,
              borderLeft: '3px solid #60a5fa',
            }}>
              {aiSummary}
            </p>
            {aiMeta && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                  Model: {aiMeta.model}
                </span>
                {aiMeta.gpu && (
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 8,
                    background: 'rgba(74,222,128,0.1)', color: '#4ade80', fontWeight: 600,
                  }}>
                    ▲ GPU Accelerated
                  </span>
                )}
                {aiMeta.source === 'azure_fallback' && (
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 8,
                    background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 600,
                  }}>
                    ☁ Azure Fallback
                  </span>
                )}
                {aiMeta.ms > 0 && (
                  <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                    {aiMeta.ms}ms
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {!aiSummary && !aiLoading && (
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>
            Click "Explain in plain language" — Ollama will summarize this patient's drug-food conflicts in simple terms for nurses.
          </p>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
