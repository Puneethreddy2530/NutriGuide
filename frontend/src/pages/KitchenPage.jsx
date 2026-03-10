import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import KitchenBurnRate from '../components/KitchenBurnRate.jsx'
import { kitchenApi } from '../api/client.js'

function InventoryTable() {
  const [inv, setInv] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    kitchenApi.getInventory()
      .then(res => { setInv(res?.data ?? res); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const s = {
    card: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginTop: 24 },
    header: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontFamily: 'var(--font-head)', fontSize: 15, fontWeight: 700 },
    badge: (low) => ({
      display: 'inline-block', padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700,
      background: low ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
      color: low ? '#ef4444' : '#10b981',
      border: `1px solid ${low ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
    }),
    row: (low) => ({
      display: 'grid', gridTemplateColumns: '1fr 90px 90px 70px', gap: 8, padding: '8px 12px',
      borderRadius: 7, marginBottom: 4,
      background: low ? 'rgba(239,68,68,0.04)' : 'var(--bg3)',
      border: `1px solid ${low ? 'rgba(239,68,68,0.15)' : 'var(--border)'}`,
    }),
    cell: { fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center' },
    label: { fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' },
  }

  if (loading) return (
    <div style={s.card}>
      <div style={{ ...s.header }}>◈ Kitchen Inventory <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>TOOL 2 · EHR</span></div>
      <div style={{ color: 'var(--text3)', fontSize: 12, padding: 20, textAlign: 'center' }}>Loading inventory...</div>
    </div>
  )

  if (error || !inv) return (
    <div style={s.card}>
      <div style={{ ...s.header }}>◈ Kitchen Inventory</div>
      <div style={{ color: 'var(--red)', fontSize: 12 }}>{error || 'No data'}</div>
    </div>
  )

  const ingredients = inv.ingredients || []
  const lowCount = ingredients.filter(i => i.stock_status === 'low').length

  return (
    <div style={s.card}>
      <div style={{ ...s.header }}>
        <span>◈ Kitchen Inventory</span>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>TOOL 2 · {inv.query_date}</span>
        {lowCount > 0 && <span style={{ ...s.badge(true), marginLeft: 6 }}>{lowCount} LOW</span>}
      </div>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 70px', gap: 8, padding: '4px 12px', marginBottom: 6 }}>
        {['Ingredient', 'Available', 'Unit', 'Status'].map(h => (
          <div key={h} style={s.label}>{h}</div>
        ))}
      </div>

      <div style={{ maxHeight: 340, overflowY: 'auto' }}>
        {ingredients.map((item, i) => {
          const isLow = item.stock_status === 'low'
          const qty = item.available_kg ?? item.available_liters ?? item.quantity ?? '—'
          const unit = item.available_kg !== undefined ? 'kg' : item.available_liters !== undefined ? 'L' : item.unit || ''
          return (
            <div key={i} style={s.row(isLow)}>
              <div style={{ ...s.cell, fontWeight: 600, color: 'var(--text)', fontSize: 12 }}>{item.name}</div>
              <div style={s.cell}>{typeof qty === 'number' ? qty.toFixed(1) : qty}</div>
              <div style={{ ...s.cell, color: 'var(--text3)' }}>{unit}</div>
              <div style={s.cell}><span style={s.badge(isLow)}>{isLow ? '⚠ LOW' : '✓ OK'}</span></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function KitchenPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)',
          letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10, opacity: 0.8,
        }}>
          ◎ GKM Hospital · Clinical Intelligence
        </div>
        <h1 style={{
          fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 900,
          letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1, marginBottom: 6,
        }}>
          Kitchen Intelligence
        </h1>
        <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          DuckDB OLAP · burn-rate forecasting · live stock status
        </div>
      </div>

      <KitchenBurnRate />
      <InventoryTable />
    </motion.div>
  )
}
