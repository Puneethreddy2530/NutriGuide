import { useState, useEffect, useContext } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import KitchenBurnRate from '../components/KitchenBurnRate.jsx'
import { reportsApi, dashboardApi, wasteApi } from '../api/client.js'
import { LangContext } from '../App.jsx'
import { t } from '../nutriguide_i18n.js'

function DischargeModal({ patient, onClose }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [phone, setPhone] = useState(patient.phone || '')
  const { lang } = useContext(LangContext)

  async function discharge() {
    setLoading(true)
    const r = await fetch(`/api/v1/discharge/${patient.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_override: phone || undefined }),
    }).then(r => r.json()).catch(() => ({ error: 'Network error' }))
    setResult(r); setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000B', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div className="card" style={{ width: 520, padding: 28, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
          {t(lang, 'discharge_patient')}
        </div>
        <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>
          {patient.name} · {patient.id} · Language: {patient.language}
        </div>

        {!result ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {[
                { icon: '◇', label: 'Generate 30-day home meal guide', sub: `In ${patient.language} using Azure GPT-4o` },
                { icon: '▣', label: 'Send diet plan PDF via WhatsApp', sub: 'NutriGuide 30-day personalised PDF' },
                { icon: '◎', label: 'WhatsApp to caregiver', sub: `${patient.caregiver_phone || 'Caregiver number'}` },
                { icon: '⬡', label: 'PQC-sign discharge summary', sub: 'NIST FIPS 204 Dilithium3' },
              ].map(({ icon, label, sub }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg3)', borderRadius: 10 }}>
                  <span style={{ fontSize: 18 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Phone number input */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                WhatsApp number for diet plan PDF
              </div>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91XXXXXXXXXX"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
                  background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text1)',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={discharge} disabled={loading}>
                {loading
                  ? <><span style={{ width: 14, height: 14, border: '2px solid #00000030', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }}/> Generating…</>
                  : '▷ Discharge & Send PDF'}
              </button>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </>
        ) : (
          <div>
            {result.error ? (
              <div style={{ color: 'var(--red)', fontSize: 13, padding: 16, background: 'var(--red-dim)', borderRadius: 10 }}>⚠ {result.error}</div>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>✓</div>
                  <div style={{ fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>Discharge Complete</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    ['30-day home guide', result.home_guide_generated ? '✓ Generated' : '—'],
                    ['Language', result.language],
                    ['Diet plan PDF', result.diet_plan_pdf_sent ? `✓ Sent to ${result.diet_plan_phone}` : (result.diet_plan_error ? `✗ ${result.diet_plan_error}` : '—')],
                    ['WhatsApp (caregiver)', result.whatsapp_caregiver_sent ? '✓ Sent' : '—'],
                    ['PQC signature', result.pqc_signed ? '✓ Signed' : '—'],
                  ].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <span style={{ color: 'var(--text2)' }}>{l}</span>
                      <span style={{ fontWeight: 600, color: v.startsWith('✓') ? 'var(--green)' : v.startsWith('✗') ? 'var(--red)' : 'var(--text3)' }}>{v}</span>
                    </div>
                  ))}
                </div>
                {result.guide_preview && (
                  <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg3)', borderRadius: 10, fontSize: 12, color: 'var(--text2)', lineHeight: 1.65 }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase' }}>Guide Preview</div>
                    {result.guide_preview.slice(0, 300)}…
                  </div>
                )}
              </>
            )}
            <button className="btn btn-ghost" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  )
}

function WasteAnalytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    wasteApi.getAnalytics()
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="card" style={{ marginBottom: 24, padding: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 20, height: 20, border: '2px solid var(--border2)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }}/>
      <span style={{ color: 'var(--text3)', fontSize: 13 }}>Running DuckDB waste aggregation…</span>
    </div>
  )

  if (!data || !data.by_meal_time?.length) return null

  const { by_meal_time, by_patient, summary } = data
  const savings = summary.annual_savings_inr_est
  const savingsStr = savings >= 100000
    ? `₹${(savings / 100000).toFixed(1)}L`
    : `₹${(savings / 1000).toFixed(0)}K`

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Smart Plate Waste Analytics
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            DuckDB aggregation · meal_logs table · consumption_level → waste rate
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: 'var(--green)', lineHeight: 1 }}>
            {savingsStr}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>est. annual savings · 100-bed</div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'Overall Waste Rate', val: `${summary.overall_waste_pct}%`,
            color: summary.overall_waste_pct > 40 ? 'var(--red)' : summary.overall_waste_pct > 25 ? 'var(--amber)' : 'var(--green)' },
          { label: 'Categories Flagged', val: summary.flagged_categories, color: summary.flagged_categories > 0 ? 'var(--red)' : 'var(--green)' },
          { label: 'Meals Analysed', val: summary.total_meals_analysed, color: 'var(--teal)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ padding: '10px 14px', background: 'var(--bg3)', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, color }}>{val}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Bar chart — waste rate by meal time */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
          <span>Waste rate by meal time (red line = 40% intervention threshold)</span>
          <span style={{ display: 'flex', gap: 12 }}>
            <span><span style={{ color: '#22C55E', marginRight: 4 }}>■</span>≤40% OK</span>
            <span><span style={{ color: '#F43F5E', marginRight: 4 }}>■</span>&gt;40% FLAG</span>
          </span>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={by_meal_time} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <XAxis dataKey="label" tick={{ fill: 'var(--text3)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: 'var(--text3)', fontSize: 10 }}
              axisLine={false} tickLine={false}
              tickFormatter={v => `${v}%`}
            />
            <Tooltip
              contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
              formatter={(v, name) => name === 'waste_pct' ? [`${v}%`, 'Waste Rate'] : [v, name]}
            />
            <ReferenceLine y={40} stroke="#F43F5E" strokeWidth={1.5} strokeDasharray="5 3" />
            <Bar dataKey="waste_pct" radius={[5, 5, 0, 0]}>
              {by_meal_time.map((d, i) => (
                <Cell key={i} fill={d.flag ? '#F43F5E' : '#22C55E'} opacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recommendations */}
      {by_meal_time.filter(m => m.flag).length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            AI Recommendations — Portion Reduction Flags
          </div>
          {by_meal_time.filter(m => m.flag).map(m => (
            <div key={m.meal_time} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              padding: '10px 14px', marginBottom: 8,
              background: '#F43F5E08', border: '1px solid #F43F5E30',
              borderLeft: '3px solid #F43F5E', borderRadius: 8
            }}>
              <div style={{ flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                  color: '#F43F5E', background: '#F43F5E15', padding: '2px 7px', borderRadius: 4 }}>
                  {m.waste_pct}% WASTE
                </span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{m.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{m.recommendation}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  {m.wasted_kcal} kcal wasted per serving avg · reduce by 15% → save ~{Math.round(m.avg_planned_kcal * 0.15)} kcal/plate
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Per-patient waste table */}
      {by_patient.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            Per-Patient Breakdown
          </div>
          {by_patient.map(p => (
            <div key={p.patient_id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: '1px solid var(--border)'
            }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>{p.diagnosis?.split('(')[0].trim()}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{p.total_meals} meals</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                  color: p.flag ? 'var(--red)' : p.waste_pct > 25 ? 'var(--amber)' : 'var(--green)'
                }}>{p.waste_pct}%</span>
                {p.flag && <span style={{ fontSize: 10, color: 'var(--red)', background: '#F43F5E15', padding: '2px 6px', borderRadius: 4 }}>REVIEW</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReportCard({ patient, onDischarge }) {
  const [downloading, setDownloading] = useState(false)
  const { lang } = useContext(LangContext)

  async function download() {
    setDownloading(true)
    try {
      await reportsApi.downloadPDF(patient.id, patient.name.replace(' ', '_'))
    } catch (e) {
      alert('PDF error: ' + e.message + '\n\nMake sure reportlab is installed: pip install reportlab')
    }
    setDownloading(false)
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 700 }}>{patient.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{patient.id} · {patient.diagnosis}</div>
        </div>
        <span className="badge badge-teal">{patient.diet_stage}</span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, padding: '10px 14px', background: 'var(--bg3)', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{t(lang, 'calorie_target')}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--teal)' }}>{patient.calorie_target}</div>
        </div>
        <div style={{ flex: 1, padding: '10px 14px', background: 'var(--bg3)', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{t(lang, 'restrictions')}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--amber)' }}>{patient.restrictions?.length || 0}</div>
        </div>
        <div style={{ flex: 1, padding: '10px 14px', background: 'var(--bg3)', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{t(lang, 'language')}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{patient.language?.slice(0,2).toUpperCase()}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={download} disabled={downloading}>
          {downloading
            ? <><span style={{ width: 13, height: 13, border: '2px solid #00000030', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }}/> {t(lang, 'generating')}…</>
            : t(lang, 'download_pdf')}
        </button>
        <button className="btn btn-ghost" onClick={() => onDischarge(patient)} style={{ padding: '9px 14px' }}>
          {t(lang, 'discharge')}
        </button>
      </div>

      <div style={{ padding: '8px 12px', background: 'var(--teal-dim)', borderRadius: 8, fontSize: 11, color: 'var(--teal)', display: 'flex', gap: 6 }}>
        <span>⬡</span>
        <span>PDF includes NIST FIPS 204 PQC signature footer</span>
      </div>
    </div>
  )
}

export default function Reports() {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [dischargePatient, setDischargePatient] = useState(null)
  const { lang } = useContext(LangContext)

  useEffect(() => {
    dashboardApi.get()
      .then(({ data }) => setPatients(data?.patients ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 36, height: 36, border: '3px solid var(--border2)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
      <div style={{ color: 'var(--text3)', fontSize: 13 }}>{t(lang, 'loading_patient_data')}</div>
    </div>
  )

  return (
    <div style={{ animation: 'fadeUp 0.4s ease' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
          {t(lang, 'reports_title')}
        </div>
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>{t(lang, 'reports_sub')}</div>
      </div>

      {/* Info strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { icon: '▣', label: 'Weekly PDF Report', desc: 'ReportLab-generated clinical summary with macros, compliance chart, PQC signature footer' },
          { icon: '▷', label: '30-Day Discharge Guide', desc: `Gemini generates culturally appropriate home meal guide in patient's vernacular language` },
          { icon: '◎', label: 'WhatsApp Delivery', desc: 'Twilio sends guide to patient + caregiver. Works across all 9 Indian languages' },
        ].map(({ icon, label, desc }) => (
          <div key={label} className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {patients.map(p => (
          <ReportCard key={p.id} patient={p} onDischarge={setDischargePatient} />
        ))}
      </div>

      {/* Smart Plate Waste Analytics */}
      <WasteAnalytics />

      {/* SOTA 3 — Kitchen Burn-Rate (DuckDB OLAP forward projection) */}
      <KitchenBurnRate forecastDays={3} />

      {dischargePatient && (
        <DischargeModal patient={dischargePatient} onClose={() => setDischargePatient(null)} />
      )}
    </div>
  )
}
