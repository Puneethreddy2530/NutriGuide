import { useState, useEffect, useContext } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import CorrelationInsight from '../components/CorrelationInsight.jsx'
import { nutritionApi, mealPlanApi } from '../api/client.js'
import { LangContext } from '../App.jsx'
import { t } from '../cap3s_i18n.js'

function UpdateModal({ patientId, onClose, onSave }) {
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const { lang } = useContext(LangContext)

  async function applyUpdate() {
    setSaving(true)
    const r = await mealPlanApi.update({
      patient_id: patientId,
      effective_from_day: 4,
      new_diet_stage: 'soft',
      new_calorie_target: 1600,
      new_restrictions: ['soft-foods-only', 'low-fiber'],
      physician_note: 'Patient tolerating liquids well. Progress to soft mechanical diet. Increase calories to support wound healing.'
    }).catch(() => ({ error: 'Network error' }))
    setSaving(false)
    setDone(true)
    setTimeout(() => { onSave(); onClose() }, 1500)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000B', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div className="card" style={{ width: 480, padding: 28 }} onClick={e => e.stopPropagation()}>
        {done ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700, color: 'var(--green)', marginBottom: 8 }}>Diet Order Updated</div>
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>PQC-signed · Kitchen notified · WhatsApp sent</div>
          </div>
        ) : (
          <>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
              Mid-Week Diet Order Update
            </div>
            <div style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 20 }}>
              Dr. Ramesh Gupta — {patientId}
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <div style={{ flex: 1, padding: 14, background: 'var(--bg3)', borderRadius: 10, borderLeft: '3px solid var(--red)' }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>Current Order</div>
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>Liquid Diet</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>1200 kcal/day</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', color: 'var(--teal)', fontSize: 20 }}>→</div>
              <div style={{ flex: 1, padding: 14, background: 'var(--bg3)', borderRadius: 10, borderLeft: '3px solid var(--green)' }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>New Order (Day 4+)</div>
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>Soft Mechanical Diet</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>1600 kcal/day</div>
              </div>
            </div>

            <div style={{ padding: '10px 14px', background: 'var(--bg3)', borderRadius: 8, marginBottom: 20, fontSize: 12, color: 'var(--text2)', borderLeft: '2px solid var(--teal)' }}>
              📋 Patient tolerating liquids well. Progress to soft mechanical diet. Increase calories to support wound healing.
            </div>

            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text3)', marginBottom: 20 }}>
              <span className="badge badge-teal">⬡ PQC-signed</span>
              <span className="badge badge-amber">📱 WhatsApp alert</span>
              <span className="badge badge-green">🍽 Kitchen notified</span>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={applyUpdate} disabled={saving}>
                {saving ? 'Applying…' : '✓ Apply Diet Order'}
              </button>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function Compliance() {
  const [patientId, setPatientId] = useState('P001')
  const [timeline, setTimeline] = useState(null)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [showUpdate, setShowUpdate] = useState(false)
  const { lang } = useContext(LangContext)

  async function load() {
    setLoading(true)
    const [tl, sum] = await Promise.all([
      nutritionApi.getTimeline(patientId).then(r => r.data).catch(() => null),
      nutritionApi.getSummary(patientId).then(r => r.data).catch(() => null)
    ])
    setTimeline(tl); setSummary(sum); setLoading(false)
  }

  useEffect(() => { load() }, [patientId])

  const chartData = timeline?.timeline?.map(t => ({
    day: `D${t.day}`,
    compliance: t.compliance_percent,
    calorie_adherence: t.calorie_adherence_percent,
    calories: t.planned_calories,
    target: timeline?.timeline?.[0]?.calorie_target,
    flag: t.risk_flag
  })) || []

  return (
    <div style={{ animation: 'fadeUp 0.4s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
            {t(lang, 'compliance_title')}
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>{t(lang, 'compliance_sub')}</div>
        </div>
        <button
          className="btn btn-danger"
          onClick={() => patientId === 'P003' && setShowUpdate(true)}
          disabled={patientId !== 'P003'}
          title={patientId !== 'P003' ? 'Mid-week order update is only available for Arjun Singh (P003 Post-GI)' : undefined}
          style={{ opacity: patientId !== 'P003' ? 0.4 : 1, cursor: patientId !== 'P003' ? 'not-allowed' : 'pointer' }}
        >
          {t(lang, 'mid_week_update')} (P003 only)
        </button>
      </div>

      {/* Patient selector */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {[
          { id: 'P001', name: 'Ravi Kumar', dx: 'Diabetes' },
          { id: 'P002', name: 'Meena Iyer', dx: 'Renal' },
          { id: 'P003', name: 'Arjun Singh', dx: 'Post-GI' },
        ].map(({ id, name, dx }) => (
          <button key={id} onClick={() => setPatientId(id)} style={{
            flex: 1, padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
            border: `1px solid ${patientId === id ? 'var(--teal)' : 'var(--border2)'}`,
            background: patientId === id ? 'var(--teal-dim)' : 'var(--bg2)',
            color: patientId === id ? 'var(--teal)' : 'var(--text2)',
            transition: 'all 0.15s', textAlign: 'left'
          }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{name}</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{id} · {dx}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border2)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
        </div>
      ) : (
        <>
          {/* KPI strip */}
          {timeline && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Avg Compliance', val: `${timeline.avg_compliance}%`, color: timeline.avg_compliance >= 80 ? 'var(--green)' : 'var(--amber)' },
                { label: 'Meals Logged', val: timeline.timeline?.reduce((s,t) => s+t.meals_logged,0), color: 'var(--teal)' },
                { label: 'Refusal Flags', val: timeline.timeline?.filter(t => t.risk_flag).length, color: 'var(--red)' },
                { label: 'Days Tracked', val: timeline.period_days, color: 'var(--text2)' },
              ].map(({ label, val, color }) => (
                <div key={label} className="card" style={{ textAlign: 'center', padding: 16 }}>
                  <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-mono)', color }}>{val}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Compliance timeline chart */}
          {chartData.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Daily Compliance — {timeline?.patient_name}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text3)' }}>
                  <span><span style={{ color: 'var(--teal)', marginRight: 4 }}>●</span>Compliance %</span>
                  <span><span style={{ color: '#F43F5E60', marginRight: 4 }}>—</span>Risk flag</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData}>
                  <XAxis dataKey="day" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0,100]} tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
                    formatter={v => [`${v}%`, 'Compliance']}
                  />
                  <ReferenceLine y={80} stroke="#22C55E30" strokeDasharray="4 4" />
                  <ReferenceLine y={60} stroke="#F59E0B30" strokeDasharray="4 4" />
                  <Bar dataKey="compliance" radius={[4,4,0,0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.compliance >= 80 ? '#22C55E' : d.compliance >= 60 ? '#F59E0B' : '#F43F5E'} opacity={d.flag ? 0.6 : 1} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8, fontSize: 11 }}>
                <span style={{ color: '#22C55E' }}>■ ≥80% Good</span>
                <span style={{ color: '#F59E0B' }}>■ 60–79% Monitor</span>
                <span style={{ color: '#F43F5E' }}>■ &lt;60% Alert</span>
              </div>
            </div>
          )}

          {/* Nutrition Recovery Arc — time-series LineChart */}
          {chartData.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Nutrition Recovery Arc — {timeline?.patient_name}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text3)' }}>
                  <span><span style={{ color: '#F43F5E', marginRight: 4 }}>●</span>&lt;50% Critical</span>
                  <span><span style={{ color: '#F59E0B', marginRight: 4 }}>●</span>50–79%</span>
                  <span><span style={{ color: '#22C55E', marginRight: 4 }}>●</span>≥80% Recovery</span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>
                Meal consumption compliance % per day · doctors think in trends, not snapshots
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id="recoveryGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%"   stopColor="#F43F5E" />
                      <stop offset="45%"  stopColor="#F59E0B" />
                      <stop offset="100%" stopColor="#22C55E" />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: 'var(--text3)', fontSize: 10 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={v => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v, name) => [`${v}%`, name === 'compliance' ? 'Meal Compliance' : 'Calorie Adherence']}
                  />
                  <ReferenceLine y={80} stroke="#22C55E25" strokeDasharray="4 4" />
                  <ReferenceLine y={50} stroke="#F59E0B20" strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="compliance"
                    stroke="url(#recoveryGradient)"
                    strokeWidth={3}
                    dot={(props) => {
                      const { cx, cy, value } = props
                      const color = value >= 80 ? '#22C55E' : value >= 50 ? '#F59E0B' : '#F43F5E'
                      return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={5} fill={color} stroke="var(--bg)" strokeWidth={2} />
                    }}
                    activeDot={{ r: 7, stroke: 'var(--bg)', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Day details */}
          {timeline?.timeline && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 20 }}>
              {timeline.timeline.map(t => (
                <div key={t.day} className="card" style={{
                  padding: 12, textAlign: 'center',
                  borderColor: t.risk_flag ? '#F43F5E50' : 'var(--border)',
                  background: t.risk_flag ? '#F43F5E06' : 'var(--bg2)',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>Day {t.day}</div>
                  <div style={{
                    fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)',
                    color: t.compliance_percent >= 80 ? 'var(--green)' : t.compliance_percent >= 60 ? 'var(--amber)' : 'var(--red)'
                  }}>{t.compliance_percent}<span style={{ fontSize: 10, fontWeight: 400 }}>%</span></div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                    {t.meals_logged} logged
                  </div>
                  {t.risk_flag && (
                    <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 4 }}>⚠ flag</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Weekly summary */}
          {summary && (
            <div className="card">
              <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                Weekly Clinical Summary
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  {[
                    ['Total Meals Planned', summary.total_meals_planned],
                    ['Total Meals Logged', summary.total_meals_logged],
                    ['Ate Fully', summary.fully_eaten],
                    ['Partially Eaten', summary.partially_eaten],
                    ['Refused', summary.refused],
                  ].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 13, color: 'var(--text2)' }}>{l}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: l === 'Refused' && v > 2 ? 'var(--red)' : 'var(--text)' }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ padding: 16, background: 'var(--bg3)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Compliance Rate</div>
                  <div style={{ fontSize: 48, fontWeight: 800, fontFamily: 'var(--font-mono)', color: summary.overall_compliance >= 80 ? 'var(--green)' : summary.overall_compliance >= 60 ? 'var(--amber)' : 'var(--red)', lineHeight: 1 }}>
                    {summary.overall_compliance}
                    <span style={{ fontSize: 20, fontWeight: 400 }}>%</span>
                  </div>
                  {summary.pqc_signed && (
                    <div style={{ marginTop: 12, fontSize: 10, color: 'var(--teal)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span>⬡</span> PQC-signed summary
                    </div>
                  )}
                </div>
              </div>
              {summary.clinical_flags?.length > 0 && (
                <div style={{ padding: '12px 16px', background: '#F43F5E08', border: '1px solid #F43F5E30', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Clinical Flags</div>
                  {summary.clinical_flags.map((f, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--red)', marginBottom: 4 }}>• {f}</div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* CorrelationInsight — Pearson r pattern from NeoPulse HealthTimeline */}
          {timeline?.timeline?.length >= 3 && (
            <CorrelationInsight timeline={timeline.timeline} />
          )}
        </>
      )}

      {showUpdate && patientId === 'P003' && <UpdateModal patientId="P003" onClose={() => setShowUpdate(false)} onSave={load} />}
    </div>
  )
}
