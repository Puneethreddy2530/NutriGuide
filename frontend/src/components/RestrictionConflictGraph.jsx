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
 *
 * Demo line:
 * "Same pattern as a drug interaction graph — except instead of medications,
 *  we're visualising restriction conflicts. Two nodes glowing red means
 *  those two dietary rules eliminate the same ingredient. The kitchen
 *  knows exactly what's left."
 */

import { useEffect, useRef } from 'react'

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

      // Find shared forbidden ingredients
      const sharedForbidden = a.forbidden.filter(f => b.forbidden.includes(f))
      // Find shared forbidden tags
      const sharedTags = a.tags.filter(t => b.tags.includes(t))
      const shared = [...new Set([...sharedForbidden, ...sharedTags])]

      if (shared.length > 0) {
        const renalConflict = shared.some(s => s.includes('FORBIDDEN_renal') || s.includes('potassium') || ['banana','tomato'].includes(s))
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

// ── Simple force-directed layout (no D3 dependency — pure math) ─────────────
// We implement a minimal spring simulation so we don't need to add D3 to package.json.
// The *pattern* is D3 force-directed; the implementation is vanilla canvas.
function useForceLayout(nodes, edges, width, height, iterations = 120) {
  const pos = {}
  const n = nodes.length
  if (n === 0) return pos

  // Initial positions — circle layout
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n
    const r = Math.min(width, height) * 0.32
    pos[node.id] = {
      x: width / 2 + r * Math.cos(angle),
      y: height / 2 + r * Math.sin(angle),
    }
  })

  // Spring simulation
  const k = Math.sqrt((width * height) / Math.max(n, 1))
  for (let iter = 0; iter < iterations; iter++) {
    const disp = {}
    nodes.forEach(v => { disp[v.id] = { x: 0, y: 0 } })

    // Repulsion
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const vi = nodes[i].id, vj = nodes[j].id
        const dx = pos[vi].x - pos[vj].x
        const dy = pos[vi].y - pos[vj].y
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01)
        const force = (k * k) / dist
        disp[vi].x += (dx / dist) * force
        disp[vi].y += (dy / dist) * force
        disp[vj].x -= (dx / dist) * force
        disp[vj].y -= (dy / dist) * force
      }
    }

    // Attraction along edges
    edges.forEach(e => {
      const dx = pos[e.source].x - pos[e.target].x
      const dy = pos[e.source].y - pos[e.target].y
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01)
      const force = (dist * dist) / k
      disp[e.source].x -= (dx / dist) * force * 0.5
      disp[e.source].y -= (dy / dist) * force * 0.5
      disp[e.target].x += (dx / dist) * force * 0.5
      disp[e.target].y += (dy / dist) * force * 0.5
    })

    // Apply displacements with temperature cooling
    const temp = 50 * (1 - iter / iterations)
    nodes.forEach(v => {
      const d = disp[v.id]
      const mag = Math.sqrt(d.x * d.x + d.y * d.y)
      if (mag > 0) {
        pos[v.id].x += (d.x / mag) * Math.min(mag, temp)
        pos[v.id].y += (d.y / mag) * Math.min(mag, temp)
        // Clamp to canvas bounds with padding
        pos[v.id].x = Math.max(60, Math.min(width - 60, pos[v.id].x))
        pos[v.id].y = Math.max(30, Math.min(height - 30, pos[v.id].y))
      }
    })
  }
  return pos
}

export default function RestrictionConflictGraph({ restrictions = [], patientName = '' }) {
  const canvasRef = useRef(null)
  const W = 520, H = 300

  useEffect(() => {
    if (!canvasRef.current || restrictions.length === 0) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const { nodes, edges } = buildGraphData(restrictions)
    const pos = useForceLayout(nodes, edges, W, H)

    let frame = 0
    let animId

    function draw() {
      ctx.clearRect(0, 0, W, H)

      // Background
      ctx.fillStyle = '#FFF3EC'
      ctx.fillRect(0, 0, W, H)

      // Grid dots (NeoPulse aesthetic)
      ctx.fillStyle = 'rgba(0,0,0,0.04)'
      for (let x = 20; x < W; x += 24) {
        for (let y = 20; y < H; y += 24) {
          ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill()
        }
      }

      // Draw edges
      edges.forEach(e => {
        const s = pos[e.source], t = pos[e.target]
        if (!s || !t) return
        const pulse = 0.4 + 0.3 * Math.sin(frame * 0.04)
        const isCritical = e.danger === 'critical'
        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(t.x, t.y)
        ctx.strokeStyle = isCritical
          ? `rgba(239,68,68,${pulse})`
          : `rgba(245,158,11,${pulse * 0.7})`
        ctx.lineWidth = isCritical ? 2 : 1.5
        ctx.setLineDash(isCritical ? [] : [4, 4])
        ctx.stroke()
        ctx.setLineDash([])

        // Edge label — shared ingredient
        const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2
        ctx.fillStyle = isCritical ? '#ef4444aa' : '#f59e0baa'
        ctx.font = '9px DM Mono, monospace'
        ctx.textAlign = 'center'
        ctx.fillText(e.label.slice(0, 14), mx, my - 4)
      })

      // Draw nodes
      nodes.forEach(node => {
        const p = pos[node.id]
        if (!p) return
        const pulse = 0.85 + 0.15 * Math.sin(frame * 0.05 + node.id.length)
        const r = 22

        // Glow
        const grd = ctx.createRadialGradient(p.x, p.y, r * 0.3, p.x, p.y, r * 2)
        grd.addColorStop(0, node.color + '30')
        grd.addColorStop(1, 'transparent')
        ctx.fillStyle = grd
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 2 * pulse, 0, Math.PI * 2); ctx.fill()

        // Node circle
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fillStyle = '#FFFFFF'
        ctx.fill()
        ctx.strokeStyle = node.color
        ctx.lineWidth = node.isRenal ? 2.5 : 1.5
        ctx.stroke()

        // Label
        ctx.fillStyle = 'rgba(0,0,0,0.7)'
        ctx.font = `${node.isRenal ? 'bold' : 'normal'} 9px 'DM Mono', monospace`
        ctx.textAlign = 'center'
        const words = node.label.split(' ')
        words.forEach((w, i) => {
          ctx.fillText(w, p.x, p.y + (i - (words.length - 1) / 2) * 11)
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
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>
          <span style={{ color: 'var(--teal)' }}>⬡ </span>
          Restriction Conflict Graph
          <span style={{ fontWeight: 400, marginLeft: 8, fontSize: 10 }}>
            — pattern: NeoPulse DrugInteractionGraph
          </span>
        </span>
        {criticalCount > 0 && (
          <span style={{
            background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440',
            borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '2px 10px',
          }}>
            {criticalCount} critical overlap{criticalCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <canvas
        ref={canvasRef} width={W} height={H}
        style={{ width: '100%', height: 'auto', borderRadius: 8, display: 'block' }}
      />

      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 10, color: 'var(--text3)' }}>
        <span><span style={{ color: '#ef4444' }}>─── </span>Critical (renal conflict)</span>
        <span><span style={{ color: '#f59e0b' }}>- - </span>Shared forbidden ingredient</span>
        <span><span style={{ color: 'var(--text3)' }}>Node size = restriction severity</span></span>
      </div>
    </div>
  )
}
