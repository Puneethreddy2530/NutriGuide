/**
 * SemanticGraphPage.jsx
 * Dummy demo — Lattice-Augmented Semantic Tree (LATS) + Neo4j Knowledge Graph
 * Shows vector similarity search + graph traversal for clinical nutrition
 * 100% client-side fake data — no backend connection
 */
import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Fake vector embeddings (768-dim truncated to 8 for display) ──────────────
const KNOWLEDGE_NODES = [
  { id: 'n1',  label: 'CKD Stage 3 Diet',         type: 'guideline', embedding: [0.82, 0.14, -0.31, 0.67, 0.05, -0.22, 0.41, 0.58], source: 'NKF KDOQI 2023', chunks: 14 },
  { id: 'n2',  label: 'Potassium Restriction',     type: 'nutrient',  embedding: [0.78, 0.21, -0.28, 0.71, 0.11, -0.18, 0.39, 0.62], source: 'ESPEN 2022',     chunks: 8 },
  { id: 'n3',  label: 'Furosemide Interaction',    type: 'drug',      embedding: [0.44, 0.68, -0.12, 0.33, 0.51, -0.07, 0.29, 0.15], source: 'BNF 84',         chunks: 6 },
  { id: 'n4',  label: 'Diabetic Diet Guidelines',  type: 'guideline', embedding: [0.71, 0.08, -0.45, 0.52, 0.19, -0.33, 0.55, 0.47], source: 'ADA 2024',       chunks: 22 },
  { id: 'n5',  label: 'Malnutrition Screening',    type: 'protocol',  embedding: [0.35, 0.42, -0.19, 0.28, 0.63, -0.41, 0.17, 0.33], source: 'NRS-2002',       chunks: 5 },
  { id: 'n6',  label: 'Renal Protein Intake',      type: 'nutrient',  embedding: [0.79, 0.17, -0.29, 0.69, 0.08, -0.20, 0.43, 0.56], source: 'KDIGO 2023',     chunks: 11 },
  { id: 'n7',  label: 'Post-Surgery Nutrition',    type: 'protocol',  embedding: [0.51, 0.38, -0.22, 0.41, 0.45, -0.15, 0.33, 0.29], source: 'ESPEN 2022',     chunks: 9 },
  { id: 'n8',  label: 'Sodium Restriction',        type: 'nutrient',  embedding: [0.75, 0.19, -0.35, 0.61, 0.13, -0.26, 0.48, 0.51], source: 'AHA 2023',       chunks: 7 },
  { id: 'n9',  label: 'Warfarin-VitK Interaction', type: 'drug',      embedding: [0.41, 0.72, -0.08, 0.29, 0.55, -0.11, 0.25, 0.19], source: 'BNF 84',         chunks: 4 },
  { id: 'n10', label: 'Enteral Feeding Protocol',  type: 'protocol',  embedding: [0.48, 0.35, -0.27, 0.36, 0.50, -0.19, 0.30, 0.25], source: 'ASPEN 2023',     chunks: 12 },
]

const GRAPH_EDGES = [
  { from: 'n1', to: 'n2', rel: 'RESTRICTS',      weight: 0.92 },
  { from: 'n1', to: 'n6', rel: 'MODIFIES',        weight: 0.88 },
  { from: 'n1', to: 'n8', rel: 'RESTRICTS',       weight: 0.85 },
  { from: 'n2', to: 'n3', rel: 'INTERACTS_WITH',  weight: 0.94 },
  { from: 'n3', to: 'n9', rel: 'SIMILAR_CLASS',   weight: 0.71 },
  { from: 'n4', to: 'n8', rel: 'RESTRICTS',       weight: 0.79 },
  { from: 'n4', to: 'n5', rel: 'SCREENS_FOR',     weight: 0.65 },
  { from: 'n5', to: 'n7', rel: 'TRIGGERS',        weight: 0.73 },
  { from: 'n6', to: 'n10', rel: 'FEEDS_INTO',     weight: 0.68 },
  { from: 'n7', to: 'n10', rel: 'REQUIRES',       weight: 0.81 },
  { from: 'n9', to: 'n4', rel: 'CONTRAINDICATES', weight: 0.77 },
]

const TYPE_COLORS = {
  guideline: { fill: '#0891b2', ring: 'rgba(8,145,178,0.25)',  bg: 'rgba(8,145,178,0.08)' },
  nutrient:  { fill: '#22c55e', ring: 'rgba(34,197,94,0.25)',  bg: 'rgba(34,197,94,0.08)' },
  drug:      { fill: '#f43f5e', ring: 'rgba(244,63,94,0.25)',  bg: 'rgba(244,63,94,0.08)' },
  protocol:  { fill: '#8b5cf6', ring: 'rgba(139,92,246,0.25)', bg: 'rgba(139,92,246,0.08)' },
}

// ── Cosine similarity ────────────────────────────────────────────────────────
function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

// ── Fake query embeddings ────────────────────────────────────────────────────
const SAMPLE_QUERIES = [
  { text: 'What diet for CKD stage 3 patient?',           embedding: [0.80, 0.16, -0.30, 0.65, 0.07, -0.21, 0.40, 0.57] },
  { text: 'Furosemide food interactions potassium',        embedding: [0.55, 0.60, -0.18, 0.45, 0.42, -0.10, 0.32, 0.30] },
  { text: 'Post-operative nutrition enteral feeding',      embedding: [0.50, 0.36, -0.25, 0.39, 0.48, -0.17, 0.31, 0.27] },
  { text: 'Malnutrition screening protocol NRS',           embedding: [0.37, 0.40, -0.20, 0.30, 0.61, -0.39, 0.19, 0.31] },
  { text: 'Diabetic patient sodium and sugar restriction',  embedding: [0.73, 0.12, -0.41, 0.55, 0.17, -0.30, 0.52, 0.48] },
]

// ── Neo4j-style graph canvas ─────────────────────────────────────────────────
function GraphCanvas({ nodes, edges, highlighted, onNodeClick, selectedNode }) {
  const canvasRef = useRef(null)
  const [positions, setPositions] = useState({})

  useEffect(() => {
    const cx = 300, cy = 220
    const pos = {}
    nodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2
      const rx = 200 + (i % 2) * 40
      const ry = 150 + (i % 2) * 30
      pos[n.id] = { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) }
    })
    setPositions(pos)
  }, [nodes])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !Object.keys(positions).length) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    canvas.width = 600 * dpr
    canvas.height = 440 * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, 600, 440)

    // Draw edges
    edges.forEach(e => {
      const from = positions[e.from]
      const to = positions[e.to]
      if (!from || !to) return
      const isHighlighted = highlighted.has(e.from) && highlighted.has(e.to)
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.strokeStyle = isHighlighted ? 'rgba(139,92,246,0.7)' : 'rgba(120,120,140,0.15)'
      ctx.lineWidth = isHighlighted ? 2.5 : 1
      ctx.stroke()

      // Edge label
      if (isHighlighted) {
        const mx = (from.x + to.x) / 2
        const my = (from.y + to.y) / 2
        ctx.save()
        ctx.font = '9px monospace'
        ctx.fillStyle = '#8b5cf6'
        ctx.textAlign = 'center'
        ctx.fillText(e.rel, mx, my - 6)
        ctx.restore()
      }
    })

    // Draw nodes
    nodes.forEach(n => {
      const p = positions[n.id]
      if (!p) return
      const tc = TYPE_COLORS[n.type]
      const isHit = highlighted.has(n.id)
      const isSel = selectedNode === n.id

      // Glow
      if (isHit) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 24, 0, 2 * Math.PI)
        ctx.fillStyle = tc.ring
        ctx.fill()
      }

      // Circle
      ctx.beginPath()
      ctx.arc(p.x, p.y, isSel ? 16 : isHit ? 14 : 10, 0, 2 * Math.PI)
      ctx.fillStyle = isHit ? tc.fill : 'rgba(120,120,140,0.25)'
      ctx.fill()
      if (isSel) {
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Label
      ctx.save()
      ctx.font = isHit ? 'bold 10px sans-serif' : '9px sans-serif'
      ctx.fillStyle = isHit ? tc.fill : 'rgba(120,120,140,0.5)'
      ctx.textAlign = 'center'
      ctx.fillText(n.label, p.x, p.y + (isSel ? 28 : isHit ? 26 : 22))
      ctx.restore()
    })
  }, [positions, edges, highlighted, selectedNode, nodes])

  function handleClick(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    for (const n of nodes) {
      const p = positions[n.id]
      if (p && Math.hypot(x - p.x, y - p.y) < 18) {
        onNodeClick(n.id)
        return
      }
    }
    onNodeClick(null)
  }

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={440}
      onClick={handleClick}
      style={{ width: '100%', height: 440, borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', cursor: 'crosshair' }}
    />
  )
}

// ── Embedding visualizer bar ─────────────────────────────────────────────────
function EmbeddingBar({ embedding, label, color, compact }) {
  return (
    <div style={{ marginBottom: compact ? 4 : 8 }}>
      {label && <div style={{ fontSize: 10, color: 'var(--text2)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>{label}</div>}
      <div style={{ display: 'flex', gap: 2, height: compact ? 16 : 22 }}>
        {embedding.map((v, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              background: v >= 0
                ? `rgba(${color || '8,145,178'},${Math.abs(v) * 0.8})`
                : `rgba(244,63,94,${Math.abs(v) * 0.8})`,
              borderRadius: 2,
              position: 'relative',
            }}
            title={`dim[${i}] = ${v.toFixed(3)}`}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function SemanticGraphPage() {
  const [query, setQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState(null)
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedNode, setSelectedNode] = useState(null)
  const [graphTraversal, setGraphTraversal] = useState([])

  const highlighted = useMemo(() => {
    const set = new Set()
    results.forEach(r => set.add(r.id))
    graphTraversal.forEach(id => set.add(id))
    return set
  }, [results, graphTraversal])

  function runSearch(q) {
    const queryObj = SAMPLE_QUERIES.find(s => s.text === q) || SAMPLE_QUERIES[0]
    setActiveQuery(queryObj)
    setSearching(true)
    setResults([])
    setGraphTraversal([])
    setSelectedNode(null)

    // Simulate async vector search
    setTimeout(() => {
      const scored = KNOWLEDGE_NODES.map(n => ({
        ...n,
        similarity: cosineSim(queryObj.embedding, n.embedding),
      })).sort((a, b) => b.similarity - a.similarity)

      const topK = scored.slice(0, 5)
      setResults(topK)

      // Graph traversal: find connected nodes from top results
      const topIds = new Set(topK.map(r => r.id))
      const traversed = new Set()
      GRAPH_EDGES.forEach(e => {
        if (topIds.has(e.from)) traversed.add(e.to)
        if (topIds.has(e.to)) traversed.add(e.from)
      })
      topIds.forEach(id => traversed.add(id))
      setGraphTraversal([...traversed])
      setSearching(false)
    }, 800)
  }

  function handleSampleClick(q) {
    setQuery(q)
    runSearch(q)
  }

  function handleSubmit() {
    if (!query.trim()) return
    // Map to closest sample or use first
    const closest = SAMPLE_QUERIES.reduce((best, sq) => {
      const overlap = sq.text.toLowerCase().split(' ').filter(w => query.toLowerCase().includes(w)).length
      return overlap > best.score ? { ...sq, score: overlap } : best
    }, { ...SAMPLE_QUERIES[0], score: 0 })
    setActiveQuery(closest)
    runSearch(closest.text)
  }

  const selectedInfo = selectedNode ? KNOWLEDGE_NODES.find(n => n.id === selectedNode) : null
  const connectedEdges = selectedNode
    ? GRAPH_EDGES.filter(e => e.from === selectedNode || e.to === selectedNode)
    : []

  const s = {
    page: { maxWidth: 1200 },
    header: { marginBottom: 24 },
    title: { fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-head)', color: 'var(--text)', letterSpacing: '-0.02em' },
    subtitle: { fontSize: 13, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 },
    badge: { display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', marginLeft: 10 },
    grid: { display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' },
    card: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 },
    mono: { fontFamily: 'var(--font-mono)', fontSize: 11 },
    searchBox: { display: 'flex', gap: 8, marginBottom: 16 },
    input: { flex: 1, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 14px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' },
    btn: { background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '10px 20px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
    sectionLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text2)', fontFamily: 'var(--font-mono)', marginBottom: 10 },
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <img src="/Final.jpg" alt="NutriGuide" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 14px rgba(8,145,178,0.3)', border: '1px solid rgba(8,145,178,0.3)' }} />
          <span style={s.title}>Semantic Knowledge Graph</span>
          <span style={{ ...s.badge, background: 'rgba(8,145,178,0.1)', color: '#0891b2', border: '1px solid rgba(8,145,178,0.25)' }}>LATS</span>
          <span style={{ ...s.badge, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>Neo4j</span>
          <span style={{ ...s.badge, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.25)' }}>VectorDB</span>
        </div>
        <div style={s.subtitle}>
          Lattice-Augmented Semantic Tree with Neo4j graph traversal and cosine-similarity vector search across 10 clinical nutrition knowledge bases
        </div>
      </div>

      {/* Search */}
      <div style={s.searchBox}>
        <input
          style={s.input}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Semantic search across clinical knowledge graph..."
        />
        <button style={s.btn} onClick={handleSubmit} disabled={searching}>
          {searching ? '...' : 'Search'}
        </button>
      </div>

      {/* Sample queries */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {SAMPLE_QUERIES.map(sq => (
          <button
            key={sq.text}
            onClick={() => handleSampleClick(sq.text)}
            style={{
              background: activeQuery?.text === sq.text ? 'rgba(8,145,178,0.12)' : 'var(--bg3)',
              border: `1px solid ${activeQuery?.text === sq.text ? 'rgba(8,145,178,0.3)' : 'var(--border)'}`,
              borderRadius: 99, padding: '5px 12px', fontSize: 11, color: 'var(--text1)',
              cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s',
            }}
          >
            {sq.text}
          </button>
        ))}
      </div>

      {/* Main grid */}
      <div style={s.grid}>
        {/* Left — Graph */}
        <div>
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={s.sectionLabel}>Neo4j Knowledge Graph</div>
              <div style={{ display: 'flex', gap: 12 }}>
                {Object.entries(TYPE_COLORS).map(([type, c]) => (
                  <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.fill }} />
                    <span style={{ fontSize: 10, color: 'var(--text2)', textTransform: 'capitalize' }}>{type}</span>
                  </div>
                ))}
              </div>
            </div>
            <GraphCanvas
              nodes={KNOWLEDGE_NODES}
              edges={GRAPH_EDGES}
              highlighted={highlighted}
              onNodeClick={setSelectedNode}
              selectedNode={selectedNode}
            />
            <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text2)', fontFamily: 'var(--font-mono)', display: 'flex', gap: 16 }}>
              <span>{KNOWLEDGE_NODES.length} nodes</span>
              <span>{GRAPH_EDGES.length} edges</span>
              <span>{highlighted.size} active</span>
              <span>Cypher: MATCH (n)-[r]-&gt;(m) WHERE n.embedding ~ query RETURN n,r,m LIMIT 5</span>
            </div>
          </div>

          {/* Selected node detail */}
          <AnimatePresence>
            {selectedInfo && (
              <motion.div
                key={selectedInfo.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                style={{ ...s.card, marginTop: 12, borderColor: TYPE_COLORS[selectedInfo.type].fill + '33' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: TYPE_COLORS[selectedInfo.type].fill }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{selectedInfo.label}</span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: TYPE_COLORS[selectedInfo.type].bg, color: TYPE_COLORS[selectedInfo.type].fill, fontWeight: 600, textTransform: 'uppercase' }}>{selectedInfo.type}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: 'var(--text1)', marginBottom: 10 }}>
                  <div><span style={{ color: 'var(--text2)' }}>Source:</span> {selectedInfo.source}</div>
                  <div><span style={{ color: 'var(--text2)' }}>Chunks:</span> {selectedInfo.chunks}</div>
                  <div><span style={{ color: 'var(--text2)' }}>Node ID:</span> <span style={s.mono}>{selectedInfo.id}</span></div>
                  <div><span style={{ color: 'var(--text2)' }}>Edges:</span> {connectedEdges.length}</div>
                </div>
                <EmbeddingBar embedding={selectedInfo.embedding} label={`Embedding vector (768-dim, showing 8)`} />
                {connectedEdges.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--text2)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>Graph Relationships</div>
                    {connectedEdges.map((e, i) => {
                      const other = e.from === selectedInfo.id ? e.to : e.from
                      const otherNode = KNOWLEDGE_NODES.find(n => n.id === other)
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 11 }}>
                          <span style={{ color: TYPE_COLORS[selectedInfo.type].fill, fontFamily: 'var(--font-mono)' }}>{selectedInfo.label}</span>
                          <span style={{ color: '#8b5cf6', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 10 }}> --[{e.rel}]-&gt; </span>
                          <span style={{ color: otherNode ? TYPE_COLORS[otherNode.type].fill : 'var(--text1)', fontFamily: 'var(--font-mono)' }}>{otherNode?.label}</span>
                          <span style={{ color: 'var(--text2)', fontSize: 10, marginLeft: 'auto' }}>w={e.weight.toFixed(2)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right — Vector search results */}
        <div>
          {/* Query embedding */}
          {activeQuery && (
            <div style={{ ...s.card, marginBottom: 12, borderColor: 'rgba(8,145,178,0.2)' }}>
              <div style={s.sectionLabel}>Query Embedding</div>
              <div style={{ fontSize: 12, color: 'var(--text1)', marginBottom: 8, lineHeight: 1.4 }}>"{activeQuery.text}"</div>
              <EmbeddingBar embedding={activeQuery.embedding} label="q = encode(query) -> R^768" color="8,145,178" />
              <div style={{ fontSize: 10, color: 'var(--text2)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                Model: all-MiniLM-L6-v2 (384-dim) + LATS projection (768-dim)
              </div>
            </div>
          )}

          {/* Search results */}
          <div style={{ ...s.card, borderColor: results.length ? 'rgba(139,92,246,0.2)' : 'var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={s.sectionLabel}>Vector Search Results (Top-K=5)</div>
              {results.length > 0 && <span style={{ ...s.mono, color: '#22c55e' }}>HNSW index hit</span>}
            </div>

            {!results.length && !searching && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text2)', fontSize: 12 }}>
                Run a query to see cosine similarity ranked results
              </div>
            )}

            {searching && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--accent)', fontSize: 12 }}>
                Searching HNSW index + graph traversal...
              </div>
            )}

            <AnimatePresence>
              {results.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  style={{
                    padding: '10px 12px', marginBottom: 8, borderRadius: 10,
                    background: TYPE_COLORS[r.type].bg,
                    border: `1px solid ${TYPE_COLORS[r.type].fill}22`,
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedNode(r.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>#{i + 1}</span>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLORS[r.type].fill }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{r.label}</span>
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)',
                      color: r.similarity > 0.95 ? '#22c55e' : r.similarity > 0.85 ? '#0891b2' : '#f59e0b',
                    }}>
                      {(r.similarity * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                    <span>{r.source} · {r.chunks} chunks</span>
                    <span>cos(q, d) = {r.similarity.toFixed(4)}</span>
                  </div>
                  <EmbeddingBar embedding={r.embedding} compact />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Architecture info */}
          <div style={{ ...s.card, marginTop: 12 }}>
            <div style={s.sectionLabel}>Pipeline Architecture</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { step: '1', label: 'Encode', detail: 'Query -> all-MiniLM-L6-v2 -> 384-dim', color: '#0891b2' },
                { step: '2', label: 'Project', detail: 'LATS lattice projection -> 768-dim', color: '#8b5cf6' },
                { step: '3', label: 'Search', detail: 'HNSW ANN index (ef=200, M=48)', color: '#22c55e' },
                { step: '4', label: 'Traverse', detail: 'Neo4j Cypher 2-hop expansion', color: '#f59e0b' },
                { step: '5', label: 'Re-rank', detail: 'Cross-encoder + graph centrality', color: '#f43f5e' },
                { step: '6', label: 'Sign', detail: 'Dilithium3 PQ signature per chunk', color: '#7c3aed' },
              ].map(p => (
                <div key={p.step} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'var(--bg3)', borderRadius: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: p.color + '18', color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-mono)', flexShrink: 0, border: `1px solid ${p.color}33` }}>{p.step}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: p.color }}>{p.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>{p.detail}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(139,92,246,0.06)', borderRadius: 8, border: '1px solid rgba(139,92,246,0.15)' }}>
              <div style={{ fontSize: 10, color: '#8b5cf6', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
                Storage: Neo4j Aura (graph) + FAISS IVF_HNSW (vectors)<br />
                Embedding dim: 768 · Distance: cosine · Index size: 10 docs / 96 chunks<br />
                Latency: p50=42ms · p99=89ms · QPS capacity: ~200
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
