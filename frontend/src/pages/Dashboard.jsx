import { useState, useEffect, useContext, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { dashboardApi, mealPlanApi, useOnlineStatus, invalidateCache } from '../api/client.js'
import TrayVision from '../components/TrayVision.jsx'
import { LangContext } from '../App.jsx'
import { t } from '../cap3s_i18n.js'

gsap.registerPlugin(useGSAP)

const DIAG_COLORS = {
  'Type 2 Diabetes': '#f59e0b',
  'Chronic Renal Failure': '#8b5cf6',
  'Post-GI Surgery': '#22d3a5',
}
const STAGE_COLORS = {
  liquid: { bg: 'rgba(56,189,248,0.1)',  text: '#38bdf8', border: 'rgba(56,189,248,0.25)' },
  soft:   { bg: 'rgba(139,92,246,0.1)',  text: '#8b5cf6', border: 'rgba(139,92,246,0.25)' },
  solid:  { bg: 'rgba(34,211,165,0.1)', text: '#22d3a5', border: 'rgba(34,211,165,0.25)' },
}

function StatCard({ label, value, sub, accent }) {
  return (
    <motion.div
      className="card stat-card"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22,1,0.36,1] }}
      style={{ borderLeft: `2px solid ${accent}`, position: 'relative', overflow: 'hidden' }}
    >
      {/* Accent glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: 80, height: '100%',
        background: `linear-gradient(90deg, ${accent}10, transparent)`,
        pointerEvents: 'none',
      }}/>
      <div style={{ color: 'var(--text3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>{label}</div>
      <div style={{ fontSize: 34, fontFamily: 'var(--font-head)', fontWeight: 900, color: accent, lineHeight: 1, letterSpacing: '-0.02em',
        textShadow: `0 0 20px ${accent}40` }}>{value}</div>
      {sub && <div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 8, fontFamily: 'var(--font-mono)' }}>{sub}</div>}
    </motion.div>
  )
}

function PatientCard({ p, onLog }) {
  const nav = useNavigate()
  const { lang } = useContext(LangContext)
  const stage = STAGE_COLORS[p.diet_stage] || STAGE_COLORS.solid
  const diagColor = DIAG_COLORS[p.diagnosis] || 'var(--accent)'
  const compColor = p.compliance_percent >= 85 ? 'var(--success)' : p.compliance_percent >= 65 ? 'var(--warning)' : 'var(--danger)'

  return (
    <div className="card" style={{
      borderColor: p.alert ? 'rgba(244,63,94,0.3)' : 'var(--border)',
      background: p.alert ? 'rgba(244,63,94,0.04)' : 'var(--bg-glass2)',
      cursor: 'pointer', transition: 'all 0.2s',
      animation: 'fadeUp 0.4s ease forwards',
    }}
    onClick={() => nav('/patients')}
    onMouseEnter={e => e.currentTarget.style.borderColor = p.alert ? 'var(--danger)' : 'var(--accent)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = p.alert ? 'rgba(244,63,94,0.3)' : 'var(--border)'}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{p.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{p.id} · {p.language}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexDirection: 'column', alignItems: 'flex-end' }}>
          {p.alert && (
            <span className="badge badge-red" style={{ animation: 'pulse-ring 2s infinite' }}>⚠ {t(lang,'alert_badge')}</span>
          )}
          {p.malnutrition_risk?.risk_level === 'HIGH' && (
            <span className="badge badge-red" style={{ animation: 'pulse-ring 2s infinite', fontSize: 9, letterSpacing: '0.06em' }}>⚕ MAL-RISK HIGH</span>
          )}
          {p.malnutrition_risk?.risk_level === 'MODERATE' && !p.alert && (
            <span style={{
              padding: '2px 8px', borderRadius: 99, fontSize: 9, fontWeight: 700,
              background: 'rgba(245,158,11,0.12)', color: '#F59E0B',
              border: '1px solid rgba(245,158,11,0.35)', letterSpacing: '0.06em',
            }}>⚕ MAL-RISK MOD</span>
          )}
          <span style={{
            padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
            background: stage.bg, color: stage.text, border: `1px solid ${stage.border}`,
            textTransform: 'uppercase', letterSpacing: '0.05em'
          }}>{p.diet_stage}</span>
        </div>
      </div>

      {/* Diagnosis */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '7px 12px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: diagColor, flexShrink: 0 }}/>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>{p.diagnosis}</span>
      </div>

      {/* Compliance bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{t(lang, 'meal_compliance')}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: compColor }}>{p.compliance_percent}%</span>
        </div>
        <div style={{ height: 4, background: 'var(--bg3-solid)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${p.compliance_percent}%`, background: compColor, borderRadius: 99, transition: 'width 0.8s ease' }}/>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[
          { label: t(lang,'logged'), val: p.meals_logged },
          { label: t(lang,'refused'), val: p.refusals, color: p.refusals >= 2 ? 'var(--danger)' : 'var(--text)' },
          { label: t(lang,'target'), val: `${p.calorie_target} cal` },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: color || 'var(--text)', fontFamily: 'var(--font-mono)' }}>{val}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Log meal button */}
      <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
        onClick={e => { e.stopPropagation(); onLog(p.id) }}>
        {t(lang, 'log_meal_btn')}
      </button>
    </div>
  )
}

function LogModal({ patientId, onClose, onSave }) {
  const [form, setForm] = useState({ meal_time: 'lunch', consumption_level: 'Ate fully', notes: '' })
  const [saving, setSaving] = useState(false)
  const mockPatient = { id: patientId }
  const { lang } = useContext(LangContext)

  async function save() {
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    await mealPlanApi.logConsumption({ patient_id: patientId, log_date: today, ...form })
    setSaving(false)
    onSave()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,28,30,0.45)', backdropFilter: 'blur(8px)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div className="card" style={{ width: 420, padding: 28 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 700, marginBottom: 20 }}>
          {t(lang, 'log_meal_btn').replace('+ ', '')} — {patientId}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t(lang, 'meal_time')}</label>
            <select className="input" value={form.meal_time} onChange={e => setForm(f => ({ ...f, meal_time: e.target.value }))}>
              {['breakfast','lunch','dinner','snack'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t(lang, 'consumption_level')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Ate fully','Partially','Refused'].map(lvl => (
                <button key={lvl} onClick={() => setForm(f => ({ ...f, consumption_level: lvl }))}
                  style={{
                    flex: 1, padding: '9px 4px', borderRadius: 8, border: `1px solid ${form.consumption_level === lvl ? 'var(--accent)' : 'var(--border2)'}`,
                    background: form.consumption_level === lvl ? 'var(--accent-soft)' : 'var(--bg3)',
                    color: form.consumption_level === lvl ? 'var(--accent)' : 'var(--text2)',
                    cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s'
                  }}>
                  {lvl === 'Ate fully' ? t(lang, 'ate_fully') : lvl === 'Partially' ? t(lang, 'partially') : t(lang, 'refused_btn')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t(lang, 'notes_optional')}</label>
            <input className="input" placeholder="e.g. Patient complained of nausea..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        {/* SOTA 1 — Tray Vision: nurse uploads photo → auto-fills consumption level */}
        <TrayVision
          patient={mockPatient}
          mealTime={form.meal_time}
          onLogged={level => setForm(f => ({ ...f, consumption_level: level }))}
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={save} disabled={saving}>
            {saving ? t(lang, 'saving') : t(lang, 'save_log')}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>{t(lang, 'cancel')}</button>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [logPatient, setLogPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [liveStatus, setLiveStatus] = useState('connecting') // 'connecting' | 'live' | 'polling'
  const { lang } = useContext(LangContext)
  const pageRef = useRef(null)
  const sseRef = useRef(null)

  useGSAP(() => {
    if (!pageRef.current) return
    gsap.from(pageRef.current.querySelectorAll('.card'), {
      opacity: 0, y: 28, stagger: 0.07,
      duration: 0.55, ease: 'power3.out', delay: 0.05,
    })
  }, { scope: pageRef, dependencies: [loading] })

  async function load() {
    const { data: r } = await dashboardApi.get().catch(() => ({ data: null }))
    setData(r)
    setLoading(false)
  }

  async function loadFresh() {
    invalidateCache('/dashboard')
    const { data: r } = await dashboardApi.get().catch(() => ({ data: null }))
    setData(r)
    setLoading(false)
  }

  useEffect(() => {
    load()

    // ── SSE: instant push when a doctor runs update_meal_plan (Tool 5) ────────
    const connectSSE = () => {
      const es = new EventSource('/api/v1/events/stream')
      sseRef.current = es
      es.onopen = () => setLiveStatus('live')
      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data)
          if (event.type === 'diet_update') loadFresh()
        } catch {}
      }
      es.onerror = () => {
        setLiveStatus('polling')
        es.close()
      }
    }
    connectSSE()

    // ── 5s polling fallback: guarantees < 10s propagation even if SSE drops ──
    // "Kitchen display polls every 5 seconds — under 10-second propagation
    //  for any EHR update." (CAP³S demo talking point)
    const pollId = setInterval(loadFresh, 5000)

    return () => {
      clearInterval(pollId)
      sseRef.current?.close()
    }
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 36, height: 36, border: '3px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
      <div style={{ color: 'var(--text3)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>{t(lang, 'loading')}</div>
    </div>
  )

  if (!data) return (
    <div className="card" style={{ textAlign: 'center', padding: 48 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
      <div style={{ color: 'var(--text2)', marginBottom: 8 }}>{t(lang, 'backend_error')}</div>
      <div style={{ color: 'var(--text3)', fontSize: 12 }}>{t(lang, 'backend_start')} <span className="mono">uvicorn main:app --reload</span></div>
    </div>
  )

  const compData = data.patients?.map(p => ({
    name: p.name.split(' ')[0],
    compliance: p.compliance_percent,
    target: 100
  })) || []

  return (
    <div ref={pageRef}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.15em',
          textTransform: 'uppercase', marginBottom: 10, opacity: 0.8 }}>
          ◎ GKM Hospital · Clinical Intelligence
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em',
            color: 'var(--text)', lineHeight: 1 }}>
            Command Center
          </h1>
          {data.alerts_active > 0 && (
            <span className="badge badge-red" style={{ animation: 'pulse-ring 2s infinite' }}>
              {data.alerts_active} Alert{data.alerts_active > 1 ? 's' : ''}
            </span>
          )}
          {data.pqc_active && (
            <span className="badge badge-violet" style={{ fontSize: 9 }}>⬡ PQC Active</span>
          )}
          {/* Live update indicator */}
          <span style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 10, fontFamily: 'var(--font-mono)', color: liveStatus === 'live' ? 'var(--success)' : 'var(--warning)',
            background: liveStatus === 'live' ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
            border: `1px solid ${liveStatus === 'live' ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
            borderRadius: 99, padding: '3px 10px',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: liveStatus === 'live' ? 'var(--success)' : 'var(--warning)',
              animation: 'pulse-ring 2s infinite',
            }}/>
            {liveStatus === 'live' ? 'LIVE · SSE' : 'LIVE · 5s poll'}
          </span>
        </div>
        <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <StatCard label={t(lang,'total_patients')} value={data.total_patients} sub={t(lang,'currently_admitted')} accent="var(--accent)" />
        <StatCard label={t(lang,'active_alerts')} value={data.alerts_active} sub={t(lang,'requires_review')} accent={data.alerts_active > 0 ? 'var(--danger)' : 'var(--success)'} />
        <StatCard label={t(lang,'avg_compliance')} value={`${Math.round(data.patients?.reduce((a,p) => a + (p.compliance_percent || 0), 0) / (data.patients?.length || 1))}%`} sub={t(lang,'meal_adherence')} accent="var(--warning)" />
        <StatCard
          label="MAL-RISK HIGH"
          value={data.high_malnutrition ?? data.patients?.filter(p => p.malnutrition_risk?.risk_level === 'HIGH').length ?? 0}
          sub="NRS-2002 screening"
          accent={data.high_malnutrition > 0 ? 'var(--danger)' : 'var(--success)'}
        />
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Patient cards */}
        <div>
          <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, fontFamily: 'var(--font-mono)' }}>
            {t(lang, 'patient_cards')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {data.patients?.map((p, i) => (
              <div key={p.id} style={{ animationDelay: `${i * 0.08}s` }}>
                <PatientCard p={p} onLog={id => setLogPatient(id)} />
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Compliance chart */}
          <div className="card">
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, fontFamily: 'var(--font-mono)' }}>
              {t(lang, 'compliance_chart')}
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={compData} barSize={28}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0,100]} tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, fontSize: 12,
                    backdropFilter: 'blur(16px)', boxShadow: 'var(--shadow-card-hover)' }}
                  labelStyle={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: 11 }}
                  itemStyle={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}
                  formatter={v => [`${v}%`, 'Compliance']}
                />
                <Bar dataKey="compliance" radius={[4,4,0,0]}>
                  {compData.map((d, i) => (
                    <Cell key={i} fill={d.compliance >= 85 ? '#22C55E' : d.compliance >= 65 ? '#F59E0B' : '#F43F5E'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Diet stages */}
          <div className="card">
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14, fontFamily: 'var(--font-mono)' }}>
              Diet Stages
            </div>
            {data.patients?.map(p => {
              const stage = STAGE_COLORS[p.diet_stage] || STAGE_COLORS.solid
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name.split(' ')[0]}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.calorie_target} kcal target</div>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: stage.bg, color: stage.text, border: `1px solid ${stage.border}` }}>
                    {p.diet_stage}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Quick actions */}
          <div className="card">
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14, fontFamily: 'var(--font-mono)' }}>
              Quick Actions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: '⬇ Generate All Meal Plans', path: '/meal-plan' },
                { label: '◐ Ask Dietitian AI', path: '/ai' },
                { label: '▣ Download PDF Report', path: '/reports' },
                { label: '⬡ View PQC Benchmark', path: '/pqc' },
              ].map(({ label, path }) => (
                <a key={path} href={path} style={{ textDecoration: 'none' }}>
                  <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', fontSize: 12 }}>
                    {label}
                  </button>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {logPatient && (
        <LogModal patientId={logPatient} onClose={() => setLogPatient(null)} onSave={() => { setLogPatient(null); load() }} />
      )}
    </div>
  )
}
