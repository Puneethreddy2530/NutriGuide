/**
 * AIModelsPanel.jsx
 * ==================
 * Showcase panel for all 4 HuggingFace models active in the NutriGuide pipeline.
 * Fetches live status from /api/v1/ai/models.
 * Shows architecture, pipeline role, HF model ID, and live/fallback status.
 */
import { useState, useEffect } from 'react'
import { UtensilsCrossed, Pill, Brain, Smartphone, CircleDot, CircleMinus } from 'lucide-react'

const MODEL_META = {
  food_classifier: {
    Icon:  UtensilsCrossed,
    color: '#6366f1',
    bg:    'rgba(99,102,241,0.07)',
    architecture_badge: 'EfficientNet-B4',
    stat_label: '89 food classes',
    pipeline_badge: 'TrayVision Stage 1',
    pipeline_color: '#818cf8',
  },
  biobert: {
    Icon:  Pill,
    color: '#ef4444',
    bg:    'rgba(239,68,68,0.07)',
    architecture_badge: 'BioBERT / DeBERTa NLI',
    stat_label: '29M PubMed abstracts',
    pipeline_badge: 'Drug-Food Severity',
    pipeline_color: '#f87171',
  },
  flan_t5: {
    Icon:  Brain,
    color: '#10b981',
    bg:    'rgba(16,185,129,0.07)',
    architecture_badge: 'Flan-T5-Base',
    stat_label: 'NRS-2002 ensemble',
    pipeline_badge: 'Malnutrition Risk',
    pipeline_color: '#34d399',
  },
  indic_bert: {
    Icon:  Smartphone,
    color: '#f59e0b',
    bg:    'rgba(245,158,11,0.07)',
    architecture_badge: 'XLM-RoBERTa XNLI',
    stat_label: '12 Indian languages',
    pipeline_badge: 'WhatsApp Bot',
    pipeline_color: '#fbbf24',
  },
}

function ModelCard({ model, meta }) {
  const m = meta || {}
  const isLive = model.status === 'live'
  return (
    <div style={{
      background: m.bg || 'var(--bg3)',
      border: `1px solid ${m.color}30`,
      borderRadius: 10, padding: 14,
      transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>{m.Icon && <m.Icon size={22} color={m.color} />}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 4,
              background: `${m.pipeline_color}20`, color: m.pipeline_color, letterSpacing: '0.05em',
              whiteSpace: 'nowrap',
            }}>{m.pipeline_badge}</span>
            <span style={{
              fontSize: 9, padding: '1px 7px', borderRadius: 4, whiteSpace: 'nowrap',
              background: isLive ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)',
              color: isLive ? '#22c55e' : '#94a3b8',
              border: `1px solid ${isLive ? 'rgba(34,197,94,0.3)' : 'rgba(100,116,139,0.3)'}`,
              fontWeight: 700,
            }}>
              {isLive ? <><CircleDot size={10} color="#22c55e" style={{marginRight:3}} /> LIVE</> : <><CircleMinus size={10} color="#94a3b8" style={{marginRight:3}} /> FALLBACK</>}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
            {model.hf_model_id}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, lineHeight: 1.4 }}>
        {model.pipeline_role}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10, background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 4, padding: '2px 7px', color: 'var(--text3)',
        }}>{m.architecture_badge}</span>
        <span style={{
          fontSize: 10, background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 4, padding: '2px 7px', color: 'var(--text3)',
        }}>{m.stat_label}</span>
      </div>
    </div>
  )
}

export default function AIModelsPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/ai/models')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 12 }}>
      Loading AI model status…
    </div>
  )

  if (!data) return null

  return (
    <div style={{ marginTop: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            AI Model Pipeline — 4 HuggingFace Models
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
            All models have deterministic fallbacks — pipeline never fails
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {data.models?.map(model => (
          <ModelCard key={model.key} model={model} meta={MODEL_META[model.key]} />
        ))}
      </div>


    </div>
  )
}
