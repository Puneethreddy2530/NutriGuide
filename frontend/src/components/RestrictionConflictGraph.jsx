/**
 * RestrictionConflictGraph
 * =========================
 * Pattern: NeoPulse DrugInteractionGraph.jsx (D3 force-directed network)
 * Original: medication nodes + dangerous-interaction edges glowing red
 * Now:      restriction nodes + shared-forbidden-ingredient edges
 *
 * Shows a patient's active restrictions as nodes.
 * Edges = two restrictions that share a forbidden ingredient (conflict zone).
 * Dangerous overlaps (e.g. low-sugar + low-carb both ban high-glycemic items)
 * glow amber; renal-specific forbidden items glow red (FORBIDDEN_renal).
 */

import { useState, useEffect, useRef } from 'react'
import { ollamaApi } from '../api/client.js'

// ── Hardcoded restriction knowledge (from restrictions_map.json) ─────────────
const RESTRICTION_META = {
  'low-sugar':        { color: '#f59e0b', forbidden: ['banana','white rice','refined flour'], tags: ['high-sugar','high-glycemic'] },
  'low-carb':         { color: '#f59e0b', forbidden: [], tags: ['high-glycemic'] },
  'no-refined-carbs': { color: '#f59e0b', forbidden: ['white rice','maida','refined flour'], tags: [] },
  'low-potassium':    { color: '#ef4444', forbidden: ['banana','tomato','potato'], tags: ['high-potassium','FORBIDDEN_renal'] },
  'low-phosphorus':   { color: '#ef4444', forbidden: ['whole grains','nuts','seeds'], tags: ['high-phosphorus'] },
  'low-sodium':       { color: '#ef4444', forbidden: [], tags: ['high-sodium'] },
  'no-bananas':       { color: '#ef4444', forbidden: ['banana'], tags: [] },
  'no-tomatoes':      { color: '#ef4444', forbidden: ['tomato'], tags: ['FORBIDDEN_renal'] },
  'fluid-restricted': { color: '#8b5cf6', forbidden: [], tags: [] },
  'liquid-only':      { color: '#06b6d4', forbidden: ['solid foods','vegetables'], tags: ['solid'] },
  'soft-foods-only':  { color: '#06b6d4', forbidden: ['raw vegetables','nuts'], tags: ['high-fiber','raw'] },
  'low-fiber':        { color: '#06b6d4', forbidden: ['whole grains','raw vegetables'], tags: ['high-fiber'] },
  'diabetic-safe':    { color: '#10b981', forbidden: ['sugar','honey','jaggery'], tags: ['high-sugar','high-glycemic'] },
  'low-fat':          { color: '#10b981', forbidden: [], tags: ['high-fat'] },
}

function buildGraphData(activeRestrictions) {
  const nodes = activeRestrictions.map(r => ({
    id: r,
    label: r.replace(/-/g, ' '),
    color: RESTRICTION_META[r]?.color ?? '#6b7280',
    isRenal: ['low-potassium','low-phosphorus','no-bananas','no-tomatoes'].includes(r),
  }))

  const edges = []
  for (let i = 0; i < activeRestrictions.length; i++) {
    for (let j = i + 1; j < activeRestrictions.length; j++) {
      const a = RESTRICTION_META[activeRestrictions[i]]
      const b = RESTRICTION_META[activeRestrictions[j]]
      if (!a || !b) continue

      const sharedForbidden = a.forbidden.filter(f => b.forbidden.includes(f))
      const sharedTags = a.tags.filter(t => b.tags.includes(t))
      const shared = [...new Set([...sharedForbidden, ...sharedTags])]

      if (shared.length > 0) {
        const renalConflict = shared.some(s => s.includes('FORBIDDEN_renal') || ['banana','tomato'].includes(s))
        edges.push({
          source: activeRestrictions[i],
          target: activeRestrictions[j],
          shared,
          danger: renalConflict ? 'critical' : 'warn',
          label: shared[0],
        })
      }
    }
  }
  return { nodes, edges }
}

// ── Force-directed layout (vanilla JS, no D3) ────────────────────────────────
function computeForceLayout(nodes, edges, width, height, iterations = 200) {
  const pos = {}
  const n = nodes.length
  if (n === 0) return pos

  // Initial positions — spread on a circle with comfortable radius
  const r0 = Math.min(width, height) * 0.36
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2
    pos[node.id] = {
      x: width / 2 + r0 * Math.cos(angle),
      y: height / 2 + r0 * Math.sin(angle),
    }
  })

  const k = Math.sqrt((width * height) / Math.max(n, 1)) * 1.4
  const PAD = 80  // keep nodes 80px from each edge

  for (let iter = 0; iter < iterations; iter++) {
    const disp = {}
    nodes.forEach(v => { disp[v.id] = { x: 0, y: 0 } })

    // Repulsion between all pairs
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const vi = nodes[i].id, vj = nodes[j].id
        const dx = pos[vi].x - pos[vj].x
        const dy = pos[vi].y - pos[vj].y
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.1)
        const force = (k * k) / dist
        const fx = (dx / dist) * force, fy = (dy / dist) * force
        disp[vi].x += fx;  disp[vi].y += fy
        disp[vj].x -= fx;  disp[vj].y -= fy
      }
    }

    // Attraction along edges
    edges.forEach(e => {
      const s = pos[e.source], t = pos[e.target]
      if (!s || !t) return
      const dx = s.x - t.x, dy = s.y - t.y
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.1)
      const ideal = k * 0.8
      const force = (dist - ideal) * 0.4
      const fx = (dx / dist) * force, fy = (dy / dist) * force
      disp[e.source].x -= fx;  disp[e.source].y -= fy
      disp[e.target].x += fx;  disp[e.target].y += fy
    })

    // Center gravity so graph stays centred
    nodes.forEach(v => {
      disp[v.id].x += (width / 2 - pos[v.id].x) * 0.01
      disp[v.id].y += (height / 2 - pos[v.id].y) * 0.01
    })

    const temp = 40 * (1 - iter / iterations)
    nodes.forEach(v => {
      const d = disp[v.id]
      const mag = Math.sqrt(d.x * d.x + d.y * d.y)
      if (mag > 0) {
        pos[v.id].x += (d.x / mag) * Math.min(mag, temp)
        pos[v.id].y += (d.y / mag) * Math.min(mag, temp)
        pos[v.id].x = Math.max(PAD, Math.min(width - PAD, pos[v.id].x))
        pos[v.id].y = Math.max(PAD, Math.min(height - PAD, pos[v.id].y))
      }
    })
  }
  return pos
}

export default function RestrictionConflictGraph({ restrictions = [], patientName = '', patientId = '' }) {
  const canvasRef = useRef(null)
  const [aiSummary, setAiSummary] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiMeta, setAiMeta] = useState(null)

  async function handleAiSummarize() {
    setAiLoading(true); setAiSummary(null); setAiMeta(null)
    try {
      const { edges } = buildGraphData(restrictions)
      const conflicts = edges.map(e => ({
        source: e.source, target: e.target,
        shared: e.shared?.[0] || '', danger: e.danger,
      }))
      const result = await ollamaApi.summarize({
        context_type: 'restrictions',
        patient_id: patientId || patientName || 'unknown',
        data: { restrictions, conflicts },
      })
      setAiSummary(result.summary)
      setAiMeta({ model: result.model_used, gpu: result.gpu_used, ms: result.time_ms, source: result.source })
    } catch {
      setAiSummary('Could not generate summary — ensure Ollama or Azure is configured.')
    } finally {
      setAiLoading(false)
    }
  }

  // Responsive dimensions -- recompute on every render based on parent width
  const W = 640, H = 420

  useEffect(() => {
    if (!canvasRef.current || restrictions.length === 0) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const { nodes, edges } = buildGraphData(restrictions)
    const pos = computeForceLayout(nodes, edges, W, H)

    // Resolve CSS custom properties (canvas API doesn't support var())
    const cs = getComputedStyle(canvas)
    const bgColor = cs.getPropertyValue('--bg2').trim() || '#F8F4F0'
    const surfaceColor = cs.getPropertyValue('--bg3-solid').trim() || '#EDE8E3'

    let frame = 0
    let animId

    function draw() {
      ctx.clearRect(0, 0, W, H)

      // Background
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, W, H)

      // Subtle grid dots
      ctx.fillStyle = 'rgba(0,0,0,0.06)'
      for (let x = 28; x < W; x += 32) {
        for (let y = 28; y < H; y += 32) {
          ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill()
        }
      }

      // Draw edges first (behind nodes)
      edges.forEach(e => {
        const s = pos[e.source], t = pos[e.target]
        if (!s || !t) return
        const pulse = 0.45 + 0.3 * Math.sin(frame * 0.035)
        const isCritical = e.danger === 'critical'
        const edgeColor = isCritical
          ? `rgba(239,68,68,${pulse})`
          : `rgba(245,158,11,${pulse * 0.75})`

        // Glow pass for critical edges
        if (isCritical) {
          ctx.save()
          ctx.shadowColor = '#ef4444'
          ctx.shadowBlur = 8
          ctx.beginPath()
          ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y)
          ctx.strokeStyle = `rgba(239,68,68,${pulse * 0.4})`
          ctx.lineWidth = 5
          ctx.stroke()
          ctx.restore()
        }

        ctx.beginPath()
        ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y)
        ctx.strokeStyle = edgeColor
        ctx.lineWidth = isCritical ? 2.2 : 1.6
        ctx.setLineDash(isCritical ? [] : [6, 5])
        ctx.stroke()
        ctx.setLineDash([])

        // Edge label — mid-point, offset perpendicular slightly
        const mx = (s.x + t.x) / 2
        const my = (s.y + t.y) / 2
        const dx = t.x - s.x, dy = t.y - s.y
        const len = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
        const ox = -dy / len * 14, oy = dx / len * 14  // perpendicular offset

        ctx.fillStyle = bgColor
        const labelW = Math.min(e.label.length * 6, 100)
        ctx.fillRect(mx + ox - labelW / 2 - 3, my + oy - 10, labelW + 6, 14)

        ctx.font = '10px "DM Mono", "JetBrains Mono", monospace'
        ctx.textAlign = 'center'
        ctx.fillStyle = isCritical ? '#dc2626' : '#b45309'
        ctx.fillText(e.label.slice(0, 16), mx + ox, my + oy)
      })

      // Draw nodes
      const NODE_R = 26
      nodes.forEach(node => {
        const p = pos[node.id]
        if (!p) return
        const breathe = 0.9 + 0.1 * Math.sin(frame * 0.04 + node.id.length)

        // Glow halo
        const grd = ctx.createRadialGradient(p.x, p.y, NODE_R * 0.3, p.x, p.y, NODE_R * 2.5 * breathe)
        grd.addColorStop(0, node.color + '45')
        grd.addColorStop(1, 'transparent')
        ctx.fillStyle = grd
        ctx.beginPath(); ctx.arc(p.x, p.y, NODE_R * 2.5 * breathe, 0, Math.PI * 2); ctx.fill()

        // Node circle
        ctx.beginPath(); ctx.arc(p.x, p.y, NODE_R, 0, Math.PI * 2)
        ctx.fillStyle = surfaceColor
        ctx.fill()
        ctx.strokeStyle = node.color
        ctx.lineWidth = node.isRenal ? 2.8 : 1.8
        ctx.stroke()

        // Label — word-wrap by splitting on space
        ctx.textAlign = 'center'
        const words = node.label.split(' ')
        const lineH = 11
        const yStart = p.y - ((words.length - 1) * lineH) / 2
        words.forEach((w, i) => {
          ctx.font = `${node.isRenal ? '700' : '500'} 9.5px "DM Mono", monospace`
          ctx.fillStyle = node.color
          ctx.fillText(w, p.x, yStart + i * lineH)
        })
      })

      frame++
      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animId)
  }, [restrictions])

  if (restrictions.length === 0) return null

  const { edges } = buildGraphData(restrictions)
  const criticalCount = edges.filter(e => e.danger === 'critical').length

  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 18, marginTop: 16,
    }}>
      <div style={{
        fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
      }}>
        <span>
          <span style={{ color: 'var(--teal)' }}>⬡ </span>
          Restriction Conflict Graph
          <span style={{ fontWeight: 400, marginLeft: 8, fontSize: 10 }}>
            — pattern: NeoPulse DrugInteractionGraph
          </span>
        </span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>{restrictions.length} restrictions</span>
          {criticalCount > 0 && (
            <span style={{
              background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440',
              borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '2px 10px',
            }}>
              {criticalCount} critical overlap{criticalCount > 1 ? 's' : ''}
            </span>
          )}
        </span>
      </div>

      <canvas
        ref={canvasRef} width={W} height={H}
        style={{ width: '100%', height: 'auto', borderRadius: 8, display: 'block' }}
      />

      <div style={{ display: 'flex', gap: 20, marginTop: 10, fontSize: 10, color: 'var(--text3)', flexWrap: 'wrap' }}>
        <span><span style={{ color: '#ef4444' }}>──── </span>Critical (renal conflict)</span>
        <span><span style={{ color: '#f59e0b' }}>- - - </span>Shared forbidden ingredient</span>
        <span style={{ marginLeft: 'auto', color: 'var(--text3)' }}>Hover edge labels for shared items</span>
      </div>

      {/* ── AI Plain-Language Summary Panel ── */}
      <div style={{
        marginTop: 20,
        background: 'linear-gradient(135deg, #1e3a5f18, #1e3a5f08)',
        border: '1px solid #60a5fa30',
        borderRadius: 10,
        padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', fontFamily: 'var(--font-head)' }}>
            \u25ce Plain Language Summary
          </span>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
            background: '#60a5fa22', border: '1px solid #60a5fa44',
            color: '#60a5fa', borderRadius: 99, padding: '2px 8px',
          }}>OLLAMA GPU</span>
        </div>

        <button
          onClick={handleAiSummarize}
          disabled={aiLoading || restrictions.length === 0}
          style={{
            background: aiLoading ? '#60a5fa22' : 'linear-gradient(90deg, #2563eb, #1d4ed8)',
            color: '#fff', border: 'none', borderRadius: 7,
            padding: '7px 18px', fontSize: 12, fontWeight: 600,
            cursor: aiLoading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: restrictions.length === 0 ? 0.5 : 1,
          }}
        >
          {aiLoading
            ? <><span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #ffffff88', borderTopColor: '#fff', borderRadius: '50%', animation: 'rcg-spin 0.7s linear infinite' }} /> Analyzing…</>
            : <>{aiSummary ? '⚡ Re-explain' : '⚡ Explain in plain language'}</>}
        </button>

        {aiSummary && (
          <div style={{ marginTop: 12 }}>
            <div style={{
              fontSize: 13, lineHeight: 1.65, color: 'var(--text)',
              background: 'var(--bg2)', borderLeft: '3px solid #60a5fa',
              borderRadius: '0 6px 6px 0', padding: '10px 14px',
            }}>
              {aiSummary}
            </div>
            {aiMeta && (
              <div style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 10, color: 'var(--text3)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>{aiMeta.model}</span>
                {aiMeta.gpu && (
                  <span style={{ background: '#4ade8022', border: '1px solid #4ade8044', color: '#4ade80', borderRadius: 99, padding: '1px 8px', fontSize: 9, fontWeight: 700 }}>▲ GPU Accelerated</span>
                )}
                {aiMeta.source === 'azure_fallback' && (
                  <span style={{ background: '#f59e0b22', border: '1px solid #f59e0b44', color: '#f59e0b', borderRadius: 99, padding: '1px 8px', fontSize: 9, fontWeight: 700 }}>☁ Azure Fallback</span>
                )}
                {aiMeta.ms && <span>{(aiMeta.ms / 1000).toFixed(1)}s</span>}
              </div>
            )}
          </div>
        )}

        {!aiSummary && !aiLoading && (
          <p style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>
            Click above to get a plain-language explanation of this patient's restriction conflicts.
          </p>
        )}
      </div>
    </div>
  )
}

<style>{`@keyframes rcg-spin { to { transform: rotate(360deg); } }`}</style>

