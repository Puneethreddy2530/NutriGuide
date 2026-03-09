/**
 * TrayVision.jsx
 * SOTA Feature 1 — Zero-Click Tray Auditing
 * Stolen from: NeoPulse EmotionDetector.jsx (multimodal image pipeline)
 * Original: webcam frame → 7-emotion classification
 * Now: nurse food tray photo → % consumed + auto-logged to EHR
 */
import { useState, useRef } from 'react'

const SEVERITY_COLORS = {
  'Ate fully': { bg: 'rgba(22,163,74,0.07)',  border: '#16a34a', text: '#15803d', icon: '✅' },
  'Partially': { bg: 'rgba(234,88,12,0.07)',  border: '#ea580c', text: '#c2410c', icon: '⚠️' },
  'Refused':   { bg: 'rgba(220,38,38,0.07)',  border: '#dc2626', text: '#b91c1c', icon: '❌' },
}

export default function TrayVision({ patient, mealTime = 'lunch', onLogged }) {
  const [mode, setMode] = useState('idle') // idle | camera | analyzing | result | demo
  const [result, setResult] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef()

  const today = new Date().toISOString().split('T')[0]

  async function runDemo() {
    setMode('analyzing')
    setError(null)
    try {
      const r = await fetch(`/api/v1/tray/demo?patient_id=${patient.id}&meal_time=${mealTime}`)
      const data = await r.json()
      setResult(data)
      setMode('result')
      onLogged && onLogged(data.vision_analysis.consumption_level)
    } catch (e) {
      setError('Backend not running — ' + e.message)
      setMode('idle')
    }
  }

  async function analyzeImage(file) {
    setMode('analyzing')
    setError(null)
    try {
      // Convert to base64
      const b64 = await new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result.split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(file)
      })

      setPreview(URL.createObjectURL(file))

      const r = await fetch('/api/v1/tray/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patient.id,
          meal_time: mealTime,
          log_date: today,
          image_base64: b64,
          // Demo baseline: static 500 kcal. In production, patient_id links to
          // the DuckDB meal_plans table to pull the exact gram weights generated
          // by the Knapsack algorithm for that specific meal.
          original_calories: 500
        })
      })
      const data = await r.json()
      setResult(data)
      setMode('result')
      onLogged && onLogged(data.vision_analysis.consumption_level)
    } catch (e) {
      setError(e.message)
      setMode('idle')
    }
  }

  const s = {
    card: {
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 20, marginTop: 16
    },
    header: {
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
      fontFamily: 'var(--font-head)', fontSize: 15, fontWeight: 700, color: 'var(--teal)'
    },
    badge: {
      background: 'var(--bg3)', borderRadius: 6, padding: '2px 10px',
      fontSize: 11, color: 'var(--text2)', fontWeight: 600
    },
    btn: (color) => ({
      background: color, border: 'none', borderRadius: 8, padding: '9px 18px',
      color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginRight: 8
    }),
    analyzing: {
      textAlign: 'center', padding: '32px 0', color: 'var(--teal)'
    },
    bar: { background: 'var(--bg3)', borderRadius: 8, height: 8, marginTop: 4 },
    fill: (pct, color) => ({
      background: color, borderRadius: 8, height: 8, width: `${pct}%`,
      transition: 'width 0.6s ease'
    }),
  }

  return (
    <div style={s.card}>
      <div style={s.header}>
        <span>📸</span>
        <span>Tray Vision</span>
        <span style={s.badge}>GEMINI MULTIMODAL</span>
        <span style={{ ...s.badge, background: 'rgba(74,222,128,0.1)', color: '#15803d' }}>STOLEN: NeoPulse</span>
      </div>

      {mode === 'idle' && (
        <div>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 14 }}>
            Nurse takes a photo of the returned food tray → AI calculates % consumed → auto-logged to EHR.
            Zero manual data entry.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={s.btn('#2563eb')} onClick={() => fileRef.current?.click()}>
              📷 Upload Tray Photo
            </button>
            <button style={s.btn('#7c3aed')} onClick={runDemo}>
              ⚡ Run Demo Analysis
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => e.target.files[0] && analyzeImage(e.target.files[0])} />
          {error && <p style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{error}</p>}
        </div>
      )}

      {mode === 'analyzing' && (
        <div style={s.analyzing}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔬</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Gemini Vision Analyzing Tray...</div>
          <div style={{ color: '#475569', fontSize: 13 }}>
            Estimating per-item consumption · Checking for clinical flags · Auto-logging to DuckDB
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 4, justifyContent: 'center' }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: '50%', background: 'var(--teal)',
                animation: `pulse 1s ${i*0.3}s infinite`
              }} />
            ))}
          </div>
        </div>
      )}

      {mode === 'result' && result && (() => {
        const va = result.vision_analysis
        const colors = SEVERITY_COLORS[va.consumption_level] || SEVERITY_COLORS['Partially']
        return (
          <div>
            {/* Main result */}
            <div style={{
              background: colors.bg, border: `1px solid ${colors.border}`,
              borderRadius: 10, padding: '14px 18px', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 16
            }}>
              <div style={{ fontSize: 32 }}>{colors.icon}</div>
              <div>
                <div style={{ color: colors.text, fontWeight: 800, fontSize: 18 }}>
                  {va.consumption_level}
                </div>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>
                  {va.percent_consumed}% of meal consumed · {va.confidence === 'demo_simulation' ? 'Demo Mode' : 'Gemini Vision'}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ color: '#64748b', fontSize: 11 }}>EST. CALORIES</div>
                <div style={{ color: '#e2e8f0', fontWeight: 700 }}>
                  ~{Math.round(va.calories_consumed_estimate || 0)} kcal
                </div>
              </div>
            </div>

            {/* Per-item breakdown */}
            {va.items_analysis && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 8, fontWeight: 600 }}>
                  PER-ITEM BREAKDOWN
                </div>
                {va.items_analysis.map((item, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#cbd5e1', marginBottom: 4 }}>
                      <span>{item.item}</span>
                      <span style={{ fontWeight: 700 }}>{item.estimated_consumed_pct}%</span>
                    </div>
                    <div style={s.bar}>
                      <div style={s.fill(item.estimated_consumed_pct,
                        item.estimated_consumed_pct > 70 ? '#16a34a' :
                        item.estimated_consumed_pct > 30 ? '#d97706' : '#dc2626'
                      )} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Clinical notes */}
            {va.clinical_notes && (
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ color: 'var(--text3)', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>CLINICAL OBSERVATION</div>
                <div style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.5 }}>{va.clinical_notes}</div>
              </div>
            )}

            {/* Flags */}
            {va.flags && va.flags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {va.flags.map(f => (
                  <span key={f} style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: '#dc2626' }}>
                    ⚠ {f.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}

            {/* Alerts */}
            {result.dietitian_alert && (
              <div style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ color: '#dc2626', fontWeight: 700, fontSize: 13 }}>🚨 {result.alert_message}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 600 }}>
                {result.auto_logged ? '✓ Auto-logged to DuckDB EHR' : '○ Demo mode — not logged'}
              </span>
              <button style={{ ...s.btn('#374151'), marginLeft: 'auto', padding: '6px 14px', fontSize: 12 }}
                onClick={() => { setMode('idle'); setResult(null); setPreview(null) }}>
                Analyze Another
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
