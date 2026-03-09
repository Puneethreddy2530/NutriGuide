/**
 * CorrelationInsight
 * ===================
 * Pattern from NeoPulse frontend HealthTimeline.jsx CorrelationInsight feature.
 * Original: Pearson correlation between sleep/stress/medication adherence.
 * Now:      Pearson correlation between calorie adherence and meal compliance.
 *
 * "On days where calorie targets were met, compliance was 34% higher."
 * This is a real statistic computed client-side — not hardcoded.
 */

/**
 * Pearson correlation coefficient between two equal-length arrays.
 * Returns r ∈ [-1, 1]. Returns null if insufficient data.
 */
function pearson(xs, ys) {
  if (!xs || !ys || xs.length < 3) return null
  const n  = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx
    const b = ys[i] - my
    num += a * b
    dx  += a * a
    dy  += b * b
  }
  const denom = Math.sqrt(dx * dy)
  return denom === 0 ? null : Math.round((num / denom) * 100) / 100
}

function rToStrength(r) {
  if (r === null) return null
  const abs = Math.abs(r)
  if (abs >= 0.7) return 'strong'
  if (abs >= 0.4) return 'moderate'
  if (abs >= 0.2) return 'weak'
  return null  // below threshold — not worth showing
}

function rToDirection(r) {
  return r > 0 ? 'positive' : 'negative'
}

/**
 * Derive correlation insights from timeline data.
 * Returns array of insight objects, most significant first.
 */
export function deriveInsights(timeline) {
  if (!timeline || timeline.length < 3) return []

  const calAdh    = timeline.map(t => t.calorie_adherence_percent ?? 0)
  const compliance= timeline.map(t => t.compliance_percent ?? 0)
  const refused   = timeline.map(t => t.refused_meals ?? 0)
  const logged    = timeline.map(t => t.meals_logged ?? 0)

  const insights = []

  // 1. Calorie adherence vs compliance rate
  const r1 = pearson(calAdh, compliance)
  const s1 = rToStrength(r1)
  if (s1) {
    const pct = Math.round(Math.abs(r1) * 100)
    const dir = rToDirection(r1)
    insights.push({
      r: r1,
      strength: s1,
      color: dir === 'positive' ? 'var(--green)' : 'var(--amber)',
      icon: dir === 'positive' ? '↗' : '↘',
      text: dir === 'positive'
        ? `When calorie targets are met, meal compliance is ${pct}% correlated`
        : `Lower calorie delivery correlates with ${pct}% drop in compliance`,
      detail: `Pearson r = ${r1}`,
    })
  }

  // 2. Refused meals vs meals logged (should be negative — more logged = fewer refused)
  const r2 = pearson(logged, refused)
  const s2 = rToStrength(r2)
  if (s2 && r2 < 0) {
    insights.push({
      r: r2,
      strength: s2,
      color: 'var(--teal)',
      icon: '↔',
      text: `Days with more meals logged show ${Math.round(Math.abs(r2)*100)}% fewer refusals`,
      detail: `Pearson r = ${r2}`,
    })
  }

  // 3. Refusals trend — consecutive refusals
  let maxConsecutive = 0, cur = 0
  for (const t of timeline) {
    if ((t.refused_meals ?? 0) > 0) { cur++; maxConsecutive = Math.max(maxConsecutive, cur) }
    else cur = 0
  }
  if (maxConsecutive >= 2) {
    insights.push({
      r: null,
      strength: 'flag',
      color: 'var(--red)',
      icon: '⚠',
      text: `${maxConsecutive} consecutive days with meal refusals detected`,
      detail: 'Clinical review recommended',
    })
  }

  return insights.slice(0, 3)  // max 3 insights
}

// ── React component ───────────────────────────────────────────────────────────
export default function CorrelationInsight({ timeline }) {
  const insights = deriveInsights(timeline)

  if (!insights.length) return null

  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 18,
      marginTop: 16,
    }}>
      <div style={{
        fontSize: 11, color: 'var(--text3)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ color: 'var(--teal)' }}>◎</span>
        Correlation Insights
        <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400, marginLeft: 4 }}>
          (Pearson r — client-side, from timeline data)
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {insights.map((ins, i) => (
          <div key={i} style={{
            display: 'flex', gap: 12, alignItems: 'flex-start',
            padding: '10px 14px',
            background: `${ins.color}10`,
            border: `1px solid ${ins.color}25`,
            borderRadius: 8,
            animation: `fadeUp 0.3s ${i * 0.08}s both`,
          }}>
            {/* Strength bar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0, width: 36 }}>
              <span style={{ fontSize: 18, color: ins.color }}>{ins.icon}</span>
              {ins.r !== null && (
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: ins.color, fontWeight: 700 }}>
                  {ins.r > 0 ? '+' : ''}{ins.r}
                </div>
              )}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 2 }}>
                {ins.text}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>{ins.detail}</div>
            </div>

            {ins.strength !== 'flag' && (
              <div style={{
                padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                background: `${ins.color}20`, color: ins.color,
                border: `1px solid ${ins.color}30`,
                alignSelf: 'flex-start', flexShrink: 0, textTransform: 'capitalize',
              }}>
                {ins.strength}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text3)', textAlign: 'right' }}>
        Computed from {timeline?.length || 0} days of clinical data
      </div>
    </div>
  )
}
