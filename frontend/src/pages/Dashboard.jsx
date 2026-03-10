import { useState, useEffect, useContext, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts'
import { dashboardApi, mealPlanApi, useOnlineStatus, invalidateCache } from '../api/client.js'
import TrayVision from '../components/TrayVision.jsx'
import { LangContext } from '../App.jsx'
import { t } from '../nutriguide_i18n.js'

gsap.registerPlugin(useGSAP)

// --- Constants ----------------------------------------------------------------

const DIAG_COLORS = {
  'Type 2 Diabetes': '#f59e0b',
  'Chronic Renal Failure': '#8b5cf6',
  'Post-GI Surgery': '#22d3a5',
}
const STAGE_COLORS = {
  liquid: { bg: 'rgba(56,189,248,0.1)',   text: '#38bdf8', border: 'rgba(56,189,248,0.25)' },
  soft:   { bg: 'rgba(139,92,246,0.1)',   text: '#8b5cf6', border: 'rgba(139,92,246,0.25)' },
  solid:  { bg: 'rgba(34,211,165,0.1)',  text: '#22d3a5', border: 'rgba(34,211,165,0.25)' },
}

// Enrichment data per patient
const PATIENT_ENRICHMENT = {
  P001: {
    risk_score: 72,
    risk_factors: ['compliance', 'protein deficit', 'drug-food conflict'],
    meal_pattern: 'Skips breakfast 4/7 days. Risk of hypoglycemia detected.',
    drug_warnings: [{ drug: 'Metformin', food: 'Coconut Milk', detail: 'May affect glucose control' }],
    compliance_prediction: 88,
    bed: 'B12', bed_risk: 'MEDIUM',
    weekly_trend: [
      { day: 'Mon', cal: 1800 }, { day: 'Tue', cal: 1600 }, { day: 'Wed', cal: 1900 },
      { day: 'Thu', cal: 1400 }, { day: 'Fri', cal: 1750 }, { day: 'Sat', cal: 1650 }, { day: 'Sun', cal: 1800 }
    ],
    macros: { protein: 62, carbs: 210, fat: 48, sodium: 1850, sugar: 28 },
    timeline: [
      { date: 'Mar 1', event: 'Admitted', type: 'info' },
      { date: 'Mar 2', event: 'Diet started — soft diabetic', type: 'info' },
      { date: 'Mar 5', event: 'Sodium 2200mg — above target', type: 'warn' },
      { date: 'Mar 7', event: 'Compliance dropped to 68%', type: 'warn' },
      { date: 'Mar 9', event: 'Dietitian intervention logged', type: 'success' },
    ],
    ai_suggestion: 'Increase legume portion by 20g at lunch. Replace coconut milk with low-fat yogurt to avoid Metformin interaction.',
  },
  P002: {
    risk_score: 85,
    risk_factors: ['protein deficit', 'calorie deficit', 'malnutrition HIGH'],
    meal_pattern: 'Consistently low dinner intake. Evening nausea pattern suspected.',
    drug_warnings: [{ drug: 'Furosemide', food: 'Banana / Potassium foods', detail: 'Hyperkalemia risk — monitor potassium' }],
    compliance_prediction: 65,
    bed: 'B14', bed_risk: 'HIGH',
    weekly_trend: [
      { day: 'Mon', cal: 1200 }, { day: 'Tue', cal: 1100 }, { day: 'Wed', cal: 1350 },
      { day: 'Thu', cal: 1050 }, { day: 'Fri', cal: 1200 }, { day: 'Sat', cal: 1100 }, { day: 'Sun', cal: 1250 }
    ],
    macros: { protein: 38, carbs: 160, fat: 32, sodium: 2100, sugar: 18 },
    timeline: [
      { date: 'Mar 1', event: 'Admitted — CRF stage 3', type: 'info' },
      { date: 'Mar 3', event: 'Renal diet initiated', type: 'info' },
      { date: 'Mar 4', event: 'Sodium intake exceeded 2000mg', type: 'warn' },
      { date: 'Mar 6', event: 'Compliance drop to 52%', type: 'warn' },
      { date: 'Mar 8', event: 'Drug interaction alert — Furosemide', type: 'danger' },
    ],
    ai_suggestion: 'Reduce evening meal volume — offer 3 smaller portions. Eliminate banana from snack. Switch to renal-safe protein supplement.',
  },
  P003: {
    risk_score: 54,
    risk_factors: ['post-surgery recovery', 'calorie deficit'],
    meal_pattern: 'Gradual improvement. Tolerating soft diet well since day 3.',
    drug_warnings: [],
    compliance_prediction: 42,
    bed: 'B09', bed_risk: 'LOW',
    weekly_trend: [
      { day: 'Mon', cal: 900 }, { day: 'Tue', cal: 1100 }, { day: 'Wed', cal: 1300 },
      { day: 'Thu', cal: 1400 }, { day: 'Fri', cal: 1500 }, { day: 'Sat', cal: 1600 }, { day: 'Sun', cal: 1700 }
    ],
    macros: { protein: 55, carbs: 190, fat: 40, sodium: 1400, sugar: 22 },
    timeline: [
      { date: 'Mar 1', event: 'Post-GI surgery — liquid diet started', type: 'info' },
      { date: 'Mar 3', event: 'Progressed to soft diet', type: 'success' },
      { date: 'Mar 5', event: 'First full meal consumption', type: 'success' },
      { date: 'Mar 7', event: 'Compliance improving — 79%', type: 'success' },
    ],
    ai_suggestion: 'Patient is recovering well. Introduce semi-solid foods. Add protein shake between meals to meet 70g daily protein target.',
  },
}

function getPriority(p) {
  const mal = p.malnutrition_risk?.risk_level === 'HIGH' ? 3 : p.malnutrition_risk?.risk_level === 'MODERATE' ? 1 : 0
  const alert = p.alert ? 2 : 0
  const comp = p.compliance_percent < 60 ? 2 : p.compliance_percent < 75 ? 1 : 0
  const drug = (PATIENT_ENRICHMENT[p.id]?.drug_warnings?.length || 0) > 0 ? 1 : 0
  return mal + alert + comp + drug
}

// --- StatCard -----------------------------------------------------------------

function StatCard({ label, value, sub, accent, onClick }) {
  return (
    <motion.div
      className="card stat-card"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2, boxShadow: `0 12px 32px ${accent}22` }}
      onClick={onClick}
      style={{
        borderLeft: `2px solid ${accent}`, position: 'relative', overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: '0 6px 24px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: 80, height: '100%', background: `linear-gradient(90deg, ${accent}10, transparent)`, pointerEvents: 'none' }} />
      <div style={{ color: '#1C1C1E', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontFamily: 'var(--font-body)' }}>{label}</div>
      <div style={{ fontSize: 34, fontFamily: 'var(--font-head)', fontWeight: 900, color: accent, lineHeight: 1, letterSpacing: '-0.02em', textShadow: `0 0 20px ${accent}40` }}>{value}</div>
      {sub && <div style={{ color: '#1C1C1E', fontSize: 13, marginTop: 8, fontFamily: 'var(--font-body)' }}>{sub}</div>}
    </motion.div>
  )
}

// --- SparkBars ----------------------------------------------------------------

function SparkBars({ data }) {
  const max = Math.max(...data.map(d => d.cal))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 36, marginTop: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ width: 12, borderRadius: 3, height: `${Math.round((d.cal / max) * 30)}px`, background: `rgba(99,179,237,${0.4 + (d.cal / max) * 0.6})` }} />
          <span style={{ fontSize: 12, color: 'var(--text1)', fontFamily: 'var(--font-mono)' }}>{d.day[0]}</span>
        </div>
      ))}
    </div>
  )
}

// --- AnimNum ------------------------------------------------------------------

function AnimNum({ value, suffix = '' }) {
  const [displayed, setDisplayed] = useState(value)
  useEffect(() => {
    const diff = value - displayed
    if (diff === 0) return
    const step = diff > 0 ? 1 : -1
    let cur = displayed
    const id = setInterval(() => {
      cur += step
      setDisplayed(cur)
      if (cur === value) clearInterval(id)
    }, 30)
    return () => clearInterval(id)
  }, [value])
  return <>{displayed}{suffix}</>
}

// --- NutritionRiskScore -------------------------------------------------------

function RiskScore({ score, factors }) {
  const color = score >= 75 ? '#f43f5e' : score >= 50 ? '#f59e0b' : '#22c55e'
  return (
    <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 10, border: `1px solid ${color}30` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text1)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Nutrition Risk Score</span>
        <span style={{ fontSize: 13, fontWeight: 800, color, fontFamily: 'var(--font-mono)' }}>{score} / 100</span>
      </div>
      <div style={{ height: 6, background: 'var(--bg3-solid)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{ height: '100%', background: `linear-gradient(90deg, ${color}80, ${color})`, borderRadius: 99 }}
        />
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {factors.map(f => (
          <span key={f} style={{ fontSize: 11, padding: '2px 6px', borderRadius: 99, background: `${color}15`, color, border: `1px solid ${color}30`, fontFamily: 'var(--font-mono)' }}>{f}</span>
        ))}
      </div>
    </div>
  )
}

// --- DrugWarnings -------------------------------------------------------------

function DrugWarnings({ warnings }) {
  if (!warnings?.length) return null
  return (
    <div style={{ marginTop: 10 }}>
      {warnings.map((w, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: 'rgba(244,63,94,0.06)', borderRadius: 8, border: '1px solid rgba(244,63,94,0.2)', marginBottom: 6 }}>
          <span style={{ fontSize: 13, lineHeight: 1 }}>⚠</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f43f5e' }}>{w.drug} + {w.food}</div>
            <div style={{ fontSize: 12, color: 'var(--text1)', marginTop: 2 }}>{w.detail}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// --- ClinicalTimeline ---------------------------------------------------------

function ClinicalTimeline({ events }) {
  const typeStyle = {
    info:    { color: 'var(--accent)', dot: 'var(--accent)' },
    warn:    { color: '#f59e0b',       dot: '#f59e0b' },
    danger:  { color: '#f43f5e',       dot: '#f43f5e' },
    success: { color: '#22c55e',       dot: '#22c55e' },
  }
  return (
    <div style={{ marginTop: 10, paddingLeft: 4 }}>
      {events.map((ev, i) => {
        const s = typeStyle[ev.type] || typeStyle.info
        return (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8, position: 'relative', paddingLeft: 16 }}>
            {i < events.length - 1 && (
              <div style={{ position: 'absolute', left: 5, top: 10, bottom: -8, width: 1, background: 'var(--border2)' }} />
            )}
            <div style={{ position: 'absolute', left: 0, top: 6, width: 10, height: 10, borderRadius: '50%', background: s.dot, boxShadow: `0 0 6px ${s.dot}80`, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text1)' }}>{ev.date}</div>
              <div style={{ fontSize: 12, color: s.color, marginTop: 1 }}>{ev.event}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// --- MacroBar -----------------------------------------------------------------

function MacroBar({ label, value, max, color }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: 'var(--text1)', fontFamily: 'var(--font-mono)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}g</span>
      </div>
      <div style={{ height: 4, background: 'var(--bg3-solid)', borderRadius: 99, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, (value / max) * 100)}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          style={{ height: '100%', background: color, borderRadius: 99 }}
        />
      </div>
    </div>
  )
}

// --- PatientCard --------------------------------------------------------------

function PatientCard({ p, onLog, onAction }) {
  const [expanded, setExpanded] = useState(false)
  const [hovered, setHovered] = useState(false)
  const { lang } = useContext(LangContext)
  const stage = STAGE_COLORS[p.diet_stage] || STAGE_COLORS.solid
  const diagColor = DIAG_COLORS[p.diagnosis] || 'var(--accent)'
  const compColor = p.compliance_percent >= 85 ? 'var(--success)' : p.compliance_percent >= 65 ? 'var(--warning)' : 'var(--danger)'
  const enrich = PATIENT_ENRICHMENT[p.id] || {}
  const priority = getPriority(p)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setExpanded(v => !v)}
      style={{
        borderColor: p.alert ? 'rgba(244,63,94,0.3)' : hovered ? 'var(--accent)' : 'var(--border)',
        background: p.alert ? 'rgba(244,63,94,0.04)' : 'var(--bg-glass2)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? '0 12px 32px rgba(0,0,0,0.12)' : '0 6px 24px rgba(0,0,0,0.06)',
        cursor: 'pointer',
        transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            {p.name}
            {priority >= 4 && <span style={{ marginLeft: 8, fontSize: 11, background: 'rgba(244,63,94,0.15)', color: '#f43f5e', padding: '2px 6px', borderRadius: 99, border: '1px solid rgba(244,63,94,0.3)', fontFamily: 'var(--font-mono)' }}>PRIORITY</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text1)', marginTop: 2 }}>
            {p.id} · {p.language} · Bed{' '}
            <span style={{ color: enrich.bed_risk === 'HIGH' ? '#f43f5e' : enrich.bed_risk === 'MEDIUM' ? '#f59e0b' : '#22c55e' }}>{enrich.bed || '—'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexDirection: 'column', alignItems: 'flex-end' }}>
          {p.alert && <span className="badge badge-red" style={{ animation: 'pulse-ring 2s infinite' }}>{t(lang, 'alert_badge')}</span>}
          {p.malnutrition_risk?.risk_level === 'HIGH' && <span className="badge badge-red" style={{ animation: 'pulse-ring 2s infinite', fontSize: 11 }}>MAL-RISK HIGH</span>}
          {p.malnutrition_risk?.risk_level === 'MODERATE' && !p.alert && (
            <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.35)' }}>MAL-RISK MOD</span>
          )}
          <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: stage.bg, color: stage.text, border: `1px solid ${stage.border}`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.diet_stage}</span>
        </div>
      </div>

      {/* Diagnosis */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '7px 12px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: diagColor, flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: 'var(--text1)' }}>{p.diagnosis}</span>
      </div>

      {/* Compliance bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: 'var(--text1)' }}>{t(lang, 'meal_compliance')}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: compColor, fontFamily: 'var(--font-mono)' }}>
            <AnimNum value={p.compliance_percent} suffix="%" />
          </span>
        </div>
        <div style={{ height: 5, background: 'var(--bg3-solid)', borderRadius: 99, overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${p.compliance_percent}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            style={{ height: '100%', background: compColor, borderRadius: 99 }}
          />
        </div>
      </div>

      {/* Hover spark bars */}
      {hovered && !expanded && enrich.weekly_trend && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text1)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>WEEKLY CALORIES</div>
          <SparkBars data={enrich.weekly_trend} />
        </motion.div>
      )}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14, marginTop: hovered && !expanded ? 12 : 0 }}>
        {[
          { label: t(lang, 'logged'), val: p.meals_logged },
          { label: t(lang, 'refused'), val: p.refusals, color: p.refusals >= 2 ? 'var(--danger)' : 'var(--text)' },
          { label: t(lang, 'target'), val: `${p.calorie_target} cal` },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: color || 'var(--text)', fontFamily: 'var(--font-mono)' }}>{val}</div>
            <div style={{ fontSize: 12, color: 'var(--text1)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Drug warning preview */}
      {enrich.drug_warnings?.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'rgba(244,63,94,0.06)', borderRadius: 8, border: '1px solid rgba(244,63,94,0.2)', marginBottom: 12, fontSize: 11, color: '#f43f5e' }}>
          {enrich.drug_warnings[0].drug} + {enrich.drug_warnings[0].food} conflict
        </div>
      )}

      {/* AI Insight meal pattern */}
      {enrich.meal_pattern && (
        <div style={{ padding: '8px 12px', background: 'rgba(99,102,241,0.06)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.18)', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>AI Insight</div>
          <div style={{ fontSize: 11, color: 'var(--text1)', lineHeight: 1.5 }}>{enrich.meal_pattern}</div>
        </div>
      )}

      {/* -- Expanded section -- */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>

              {/* Nutrition Risk Score */}
              {enrich.risk_score !== undefined && <RiskScore score={enrich.risk_score} factors={enrich.risk_factors || []} />}

              {/* Weekly trend */}
              {enrich.weekly_trend && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--text1)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>Weekly Calorie Intake</div>
                  <ResponsiveContainer width="100%" height={80}>
                    <AreaChart data={enrich.weekly_trend} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                      <defs>
                        <linearGradient id={`grad-${p.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" tick={{ fill: 'var(--text1)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Area type="monotone" dataKey="cal" stroke="var(--accent)" strokeWidth={2} fill={`url(#grad-${p.id})`} dot={false} />
                      <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 11 }} formatter={v => [`${v} kcal`, '']} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Macros */}
              {enrich.macros && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--text1)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>Macro Breakdown</div>
                  <MacroBar label="Protein" value={enrich.macros.protein} max={80} color="#22c55e" />
                  <MacroBar label="Carbs" value={enrich.macros.carbs} max={300} color="#3b82f6" />
                  <MacroBar label="Fat" value={enrich.macros.fat} max={80} color="#f59e0b" />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    {enrich.macros.sodium > 1800 && (
                      <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 99, background: 'rgba(244,63,94,0.1)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.25)' }}>Sodium {enrich.macros.sodium}mg</span>
                    )}
                    {enrich.macros.sugar > 25 && (
                      <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 99, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>Sugar {enrich.macros.sugar}g</span>
                    )}
                  </div>
                </div>
              )}

              {/* Drug conflicts */}
              {enrich.drug_warnings && <DrugWarnings warnings={enrich.drug_warnings} />}

              {/* Timeline */}
              {enrich.timeline && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--text1)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>Patient Timeline</div>
                  <ClinicalTimeline events={enrich.timeline} />
                </div>
              )}

              {/* AI suggestion */}
              {enrich.ai_suggestion && (
                <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(99,102,241,0.08)', borderRadius: 10, border: '1px solid rgba(99,102,241,0.22)' }}>
                  <div style={{ fontSize: 12, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>Dietitian AI</div>
                  <div style={{ fontSize: 12, color: 'var(--text1)', lineHeight: 1.6 }}>{enrich.ai_suggestion}</div>
                  <button className="btn btn-ghost" style={{ marginTop: 10, fontSize: 11, padding: '6px 14px' }} onClick={e => { e.stopPropagation(); onAction(p.id, 'apply_ai') }}>Apply suggestion</button>
                </div>
              )}

              {/* Compliance prediction */}
              {enrich.compliance_prediction !== undefined && (
                <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text1)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tomorrow Compliance Pred.</div>
                    <div style={{ fontSize: 12, color: 'var(--text1)', marginTop: 2 }}>AI forecast</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--font-mono)', color: enrich.compliance_prediction >= 80 ? 'var(--success)' : enrich.compliance_prediction >= 60 ? 'var(--warning)' : 'var(--danger)' }}>
                    {enrich.compliance_prediction}%
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom actions row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 }}>
        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
          <button className="btn btn-ghost" title="Approve plan" style={{ fontSize: 11, padding: '6px 10px' }} onClick={() => onAction(p.id, 'approve')}>OK</button>
          <button className="btn btn-ghost" title="Modify diet" style={{ fontSize: 11, padding: '6px 10px' }} onClick={() => onAction(p.id, 'modify')}>Edit</button>
          <button className="btn btn-ghost" title="Flag patient" style={{ fontSize: 11, padding: '6px 10px', color: 'var(--danger)' }} onClick={() => onAction(p.id, 'flag')}>Flag</button>
          <button className="btn btn-ghost" title="Send message" style={{ fontSize: 11, padding: '6px 10px' }} onClick={() => onAction(p.id, 'message')}>Msg</button>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '6px 10px' }} onClick={() => onLog(p.id)}>+ Log</button>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text1)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
          {expanded ? 'collapse' : 'expand'}
        </span>
      </div>
    </motion.div>
  )
}

// --- AlertPanel ---------------------------------------------------------------

function AlertPanel({ patients, onPatientClick }) {
  const allAlerts = useMemo(() => {
    const list = []
    patients?.forEach(p => {
      const enrich = PATIENT_ENRICHMENT[p.id] || {}
      if (p.alert) list.push({ pid: p.id, name: p.name, msg: 'Meal compliance dropped below 50%', sev: 'high' })
      if (p.malnutrition_risk?.risk_level === 'HIGH') list.push({ pid: p.id, name: p.name, msg: 'Malnutrition HIGH risk — NRS-2002', sev: 'high' })
      enrich.drug_warnings?.forEach(w => list.push({ pid: p.id, name: p.name, msg: `Drug interaction risk — ${w.drug} + ${w.food}`, sev: 'medium' }))
      if (enrich.macros?.sodium > 1800) list.push({ pid: p.id, name: p.name, msg: `Sodium intake exceeded target (${enrich.macros.sodium}mg)`, sev: 'low' })
    })
    return list
  }, [patients])

  const sevStyle = {
    high:   { dot: '#f43f5e', bg: 'rgba(244,63,94,0.05)',   border: 'rgba(244,63,94,0.2)' },
    medium: { dot: '#f59e0b', bg: 'rgba(245,158,11,0.05)',  border: 'rgba(245,158,11,0.2)' },
    low:    { dot: '#3b82f6', bg: 'rgba(59,130,246,0.05)',  border: 'rgba(59,130,246,0.2)' },
  }

  return (
    <div className="card" style={{ borderColor: allAlerts.length ? 'rgba(244,63,94,0.2)' : 'var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: allAlerts.length ? '#f43f5e' : 'var(--text1)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>Alerts</div>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#f43f5e', fontWeight: 700 }}>{allAlerts.length || 0}</span>
      </div>
      {allAlerts.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text1)', textAlign: 'center', padding: '12px 0' }}>No active alerts</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allAlerts.map((a, i) => {
            const s = sevStyle[a.sev]
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onPatientClick(a.pid)}
                whileHover={{ opacity: 0.85 }}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: s.bg, borderRadius: 8, border: `1px solid ${s.border}`, cursor: 'pointer' }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flexShrink: 0, marginTop: 3, animation: a.sev === 'high' ? 'pulse-ring 2s infinite' : 'none' }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text1)', marginTop: 1, lineHeight: 1.4 }}>{a.msg}</div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- CompliancePrediction -----------------------------------------------------

function CompliancePrediction({ patients }) {
  const preds = (patients || [])
    .map(p => ({ name: p.name.split(' ')[0], id: p.id, pred: PATIENT_ENRICHMENT[p.id]?.compliance_prediction ?? p.compliance_percent }))
    .sort((a, b) => a.pred - b.pred)

  return (
    <div className="card">
      <div style={{ fontSize: 12, color: 'var(--text1)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14, fontFamily: 'var(--font-mono)' }}>Tomorrow Compliance Prediction</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {preds.map(({ name, id, pred }) => {
          const color = pred >= 80 ? '#22c55e' : pred >= 60 ? '#f59e0b' : '#f43f5e'
          return (
            <div key={id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text1)', fontWeight: 600 }}>{name}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color, fontFamily: 'var(--font-mono)' }}>{pred}%</span>
              </div>
              <div style={{ height: 4, background: 'var(--bg3-solid)', borderRadius: 99, overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${pred}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} style={{ height: '100%', background: color, borderRadius: 99 }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- WardHeatmap -------------------------------------------------------------

function WardHeatmap({ patients }) {
  const beds = (patients || []).map(p => ({ bed: PATIENT_ENRICHMENT[p.id]?.bed || '—', risk: PATIENT_ENRICHMENT[p.id]?.bed_risk || 'LOW', name: p.name.split(' ')[0] }))
  const riskStyle = {
    HIGH:   { bg: 'rgba(244,63,94,0.12)',  text: '#f43f5e', border: 'rgba(244,63,94,0.3)' },
    MEDIUM: { bg: 'rgba(245,158,11,0.10)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
    LOW:    { bg: 'rgba(34,197,94,0.08)',  text: '#22c55e', border: 'rgba(34,197,94,0.25)' },
  }
  return (
    <div className="card">
      <div style={{ fontSize: 12, color: 'var(--text1)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14, fontFamily: 'var(--font-mono)' }}>Ward Risk Heatmap</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {beds.sort((a, b) => ['HIGH','MEDIUM','LOW'].indexOf(a.risk) - ['HIGH','MEDIUM','LOW'].indexOf(b.risk)).map((b, i) => {
          const s = riskStyle[b.risk]
          return (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: s.bg, border: `1px solid ${s.border}` }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.text }}>Bed {b.bed}</span>
                <span style={{ fontSize: 11, color: 'var(--text1)', marginLeft: 8 }}>{b.name}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: s.text, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>{b.risk}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- ClinicalAIPanel ----------------------------------------------------------

function ClinicalAIPanel({ patients, onNavigate }) {
  const suggestions = (patients || []).map(p => {
    const enrich = PATIENT_ENRICHMENT[p.id]
    return enrich ? { name: p.name.split(' ')[0], id: p.id, suggestion: enrich.ai_suggestion } : null
  }).filter(Boolean)

  return (
    <div className="card" style={{ borderColor: 'rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.03)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>Dietitian AI</div>
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => onNavigate('/ai')}>Open full AI</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {suggestions.map(s => (
          <div key={s.id} style={{ padding: '10px 12px', background: 'var(--bg3)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>{s.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text1)', lineHeight: 1.5 }}>{s.suggestion}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- LogModal -----------------------------------------------------------------

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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,28,30,0.45)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div className="card" style={{ width: 420, padding: 28 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 700, marginBottom: 20 }}>
          {t(lang, 'log_meal_btn').replace('+ ', '')} — {patientId}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text1)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t(lang, 'meal_time')}</label>
            <select className="input" value={form.meal_time} onChange={e => setForm(f => ({ ...f, meal_time: e.target.value }))}>
              {['breakfast', 'lunch', 'dinner', 'snack'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text1)', marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t(lang, 'consumption_level')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Ate fully', 'Partially', 'Refused'].map(lvl => (
                <button key={lvl} onClick={() => setForm(f => ({ ...f, consumption_level: lvl }))} style={{ flex: 1, padding: '9px 4px', borderRadius: 8, border: `1px solid ${form.consumption_level === lvl ? 'var(--accent)' : 'var(--border2)'}`, background: form.consumption_level === lvl ? 'var(--accent-soft)' : 'var(--bg3)', color: form.consumption_level === lvl ? 'var(--accent)' : 'var(--text1)', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s' }}>
                  {lvl === 'Ate fully' ? t(lang, 'ate_fully') : lvl === 'Partially' ? t(lang, 'partially') : t(lang, 'refused_btn')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text1)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t(lang, 'notes_optional')}</label>
            <input className="input" placeholder="e.g. Patient complained of nausea..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <TrayVision patient={mockPatient} mealTime={form.meal_time} onLogged={level => setForm(f => ({ ...f, consumption_level: level }))} />
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

// --- ActionToast --------------------------------------------------------------

const ACTION_MESSAGES = {
  approve:   { icon: '✓', msg: 'Diet plan approved',             color: '#22c55e' },
  modify:    { icon: '✎', msg: 'Opening AI diet editor...',       color: '#3b82f6' },
  flag:      { icon: '⚠', msg: 'Patient flagged for review',     color: '#f43f5e' },
  message:   { icon: '◆', msg: 'Message sent via WhatsApp',      color: '#22c55e' },
  apply_ai:  { icon: '◎', msg: 'AI suggestion applied to plan',  color: 'var(--accent)' },
}

function ActionToast({ action, onDone }) {
  const a = ACTION_MESSAGES[action?.type] || {}
  useEffect(() => { const timer = setTimeout(onDone, 2500); return () => clearTimeout(timer) }, [action])
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
      style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 2000, padding: '14px 22px', borderRadius: 12, background: 'var(--bg2)', border: `1px solid ${a.color}40`, boxShadow: `0 8px 32px ${a.color}20`, display: 'flex', alignItems: 'center', gap: 10, backdropFilter: 'blur(20px)' }}
    >
      <span style={{ fontSize: 18 }}>{a.icon}</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: a.color }}>{action?.patient}</div>
        <div style={{ fontSize: 11, color: 'var(--text1)', marginTop: 1 }}>{a.msg}</div>
      </div>
    </motion.div>
  )
}

// --- Dashboard ----------------------------------------------------------------

const SORT_OPTIONS = [
  { key: 'all',          label: 'All' },
  { key: 'high_risk',    label: 'High Risk' },
  { key: 'low_comp',     label: 'Low Compliance' },
  { key: 'drug_alerts',  label: 'Med Conflicts' },
]

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [logPatient, setLogPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [liveStatus, setLiveStatus] = useState('connecting')
  const [sortKey, setSortKey] = useState('all')
  const [toast, setToast] = useState(null)
  const { lang } = useContext(LangContext)
  const nav = useNavigate()
  const pageRef = useRef(null)
  const sseRef = useRef(null)

  useGSAP(() => {
    if (!pageRef.current) return
    gsap.from(pageRef.current.querySelectorAll('.card'), { opacity: 0, y: 28, stagger: 0.07, duration: 0.55, ease: 'power3.out', delay: 0.05 })
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
  }

  useEffect(() => {
    load()
    const connectSSE = () => {
      const es = new EventSource('/api/v1/events/stream')
      sseRef.current = es
      es.onopen = () => setLiveStatus('live')
      es.onmessage = (e) => { try { const ev = JSON.parse(e.data); if (ev.type === 'diet_update') loadFresh() } catch {} }
      es.onerror = () => { setLiveStatus('polling'); es.close() }
    }
    connectSSE()
    const pollId = setInterval(loadFresh, 5000)
    return () => { clearInterval(pollId); sseRef.current?.close() }
  }, [])

  const sortedPatients = useMemo(() => {
    if (!data?.patients) return []
    let list = [...data.patients]
    if (sortKey === 'high_risk') list = list.filter(p => p.malnutrition_risk?.risk_level === 'HIGH' || p.alert || PATIENT_ENRICHMENT[p.id]?.drug_warnings?.length > 0)
    else if (sortKey === 'low_comp') list = list.filter(p => p.compliance_percent < 75)
    else if (sortKey === 'drug_alerts') list = list.filter(p => (PATIENT_ENRICHMENT[p.id]?.drug_warnings?.length || 0) > 0)
    list.sort((a, b) => getPriority(b) - getPriority(a))
    return list
  }, [data, sortKey])

  function handleAction(patientId, type) {
    const p = data?.patients?.find(px => px.id === patientId)
    setToast({ patient: p?.name || patientId, type })
    if (type === 'modify') setTimeout(() => nav('/ai'), 800)
    if (type === 'message') setTimeout(() => nav('/whatsapp'), 800)
    if (type === 'apply_ai') setTimeout(() => nav('/ai'), 800)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 36, height: 36, border: '3px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ color: 'var(--text1)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>{t(lang, 'loading')}</div>
    </div>
  )

  if (!data) return (
    <div className="card" style={{ textAlign: 'center', padding: 48 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
      <div style={{ color: 'var(--text1)', marginBottom: 8 }}>{t(lang, 'backend_error')}</div>
      <div style={{ color: 'var(--text1)', fontSize: 12 }}>{t(lang, 'backend_start')} <span className="mono">uvicorn main:app --reload</span></div>
    </div>
  )

  const compData = (data.patients || []).map(p => ({ name: p.name.split(' ')[0], compliance: p.compliance_percent }))

  return (
    <div ref={pageRef}>
      {/* -- Header -- */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
          GKM Hospital - Clinical Intelligence
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8, flexWrap: 'wrap' }}>
          <img src="/Final.jpg" alt="NutriGuide" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 16px rgba(8,145,178,0.3)', border: '1px solid var(--border-accent)' }} />
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1 }}>Command Center</h1>
          {data.alerts_active > 0 && <span className="badge badge-red" style={{ animation: 'pulse-ring 2s infinite' }}>{data.alerts_active} Alert{data.alerts_active > 1 ? 's' : ''}</span>}
          {data.pqc_active && <span className="badge badge-violet" style={{ fontSize: 11 }}>PQC Active</span>}
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontFamily: 'var(--font-mono)', color: liveStatus === 'live' ? 'var(--success)' : 'var(--warning)', background: liveStatus === 'live' ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${liveStatus === 'live' ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`, borderRadius: 99, padding: '3px 10px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: liveStatus === 'live' ? 'var(--success)' : 'var(--warning)', animation: 'pulse-ring 2s infinite' }} />
            {liveStatus === 'live' ? 'LIVE - SSE' : 'LIVE - 5s poll'}
          </span>
        </div>
        <div style={{ color: 'var(--text1)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* -- KPI row -- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <StatCard label={t(lang, 'total_patients')} value={data.total_patients} sub={t(lang, 'currently_admitted')} accent="var(--accent)" />
        <StatCard label={t(lang, 'active_alerts')} value={data.alerts_active} sub={t(lang, 'requires_review')} accent={data.alerts_active > 0 ? 'var(--danger)' : 'var(--success)'} />
        <StatCard label={t(lang, 'avg_compliance')} value={`${Math.round((data.patients || []).reduce((a, p) => a + (p.compliance_percent || 0), 0) / ((data.patients?.length) || 1))}%`} sub={t(lang, 'meal_adherence')} accent="var(--warning)" />
        <StatCard label="MAL-RISK HIGH" value={data.high_malnutrition ?? (data.patients || []).filter(p => p.malnutrition_risk?.risk_level === 'HIGH').length} sub="NRS-2002 screening" accent={(data.high_malnutrition ?? (data.patients || []).filter(p => p.malnutrition_risk?.risk_level === 'HIGH').length) > 0 ? 'var(--danger)' : 'var(--success)'} />
      </div>

      {/* -- Priority Sort Tabs -- */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {SORT_OPTIONS.map(opt => (
          <button key={opt.key} onClick={() => setSortKey(opt.key)} style={{ padding: '6px 16px', borderRadius: 99, fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 0.15s', background: sortKey === opt.key ? 'var(--accent)' : 'var(--bg3)', color: sortKey === opt.key ? '#fff' : 'var(--text1)', border: `1px solid ${sortKey === opt.key ? 'var(--accent)' : 'var(--border2)'}` }}>
            {opt.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text1)', fontFamily: 'var(--font-mono)' }}>
          {sortedPatients.length} patient{sortedPatients.length !== 1 ? 's' : ''} · sorted by risk
        </span>
      </div>

      {/* -- Main grid -- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Patient cards */}
        <div>
          <div style={{ fontSize: 12, color: 'var(--text1)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, fontFamily: 'var(--font-mono)' }}>
            {t(lang, 'patient_cards')}
          </div>
          <AnimatePresence mode="popLayout">
            {sortedPatients.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text1)', fontSize: 13 }}>
                No patients match this filter.
              </motion.div>
            ) : sortedPatients.map(p => (
              <PatientCard key={p.id} p={p} onLog={id => setLogPatient(id)} onAction={handleAction} />
            ))}
          </AnimatePresence>
        </div>

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <AlertPanel patients={data.patients} onPatientClick={() => setSortKey('high_risk')} />

          <div className="card">
            <div style={{ fontSize: 12, color: 'var(--text1)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, fontFamily: 'var(--font-mono)' }}>{t(lang, 'compliance_chart')}</div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={compData} barSize={28}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text1)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text1)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, fontSize: 12, backdropFilter: 'blur(16px)' }} labelStyle={{ color: 'var(--text1)', fontFamily: 'var(--font-mono)', fontSize: 11 }} formatter={v => [`${v}%`, 'Compliance']} />
                <Bar dataKey="compliance" radius={[4, 4, 0, 0]}>
                  {compData.map((d, i) => <Cell key={i} fill={d.compliance >= 85 ? '#22C55E' : d.compliance >= 65 ? '#F59E0B' : '#F43F5E'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div style={{ fontSize: 12, color: 'var(--text1)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14, fontFamily: 'var(--font-mono)' }}>Diet Stages</div>
            {(data.patients || []).map(p => {
              const stage = STAGE_COLORS[p.diet_stage] || STAGE_COLORS.solid
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name.split(' ')[0]}</div>
                    <div style={{ fontSize: 11, color: 'var(--text1)' }}>{p.calorie_target} kcal target</div>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: stage.bg, color: stage.text, border: `1px solid ${stage.border}` }}>{p.diet_stage}</span>
                </div>
              )
            })}
          </div>

          <CompliancePrediction patients={data.patients} />
          <WardHeatmap patients={data.patients} />
          <ClinicalAIPanel patients={data.patients} onNavigate={nav} />

          <div className="card">
            <div style={{ fontSize: 12, color: 'var(--text1)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14, fontFamily: 'var(--font-mono)' }}>Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Generate All Meal Plans', path: '/meal-plan' },
                { label: 'Ask Dietitian AI', path: '/ai' },
                { label: 'Download PDF Report', path: '/reports' },
                { label: 'View PQC Benchmark', path: '/pqc' },
              ].map(({ label, path }) => (
                <button key={path} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', fontSize: 12 }} onClick={() => nav(path)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* -- Feature Hub -- */}
      <div style={{ marginTop: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text1)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
          Clinical Intelligence Features
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {[
            { path: '/tray',         label: 'Tray Vision',       icon: '◎', desc: 'Gemini Vision · plate waste %',      accent: '#22d3a5' },
            { path: '/food-drug',    label: 'Food-Drug Graph',   icon: '◈',  desc: 'BioBERT · drug-nutrient conflicts',  accent: '#f59e0b' },
            { path: '/restrictions', label: 'Restrictions',      icon: '⚠',  desc: 'Allergy · dietary conflict graph',   accent: '#f43f5e' },
            { path: '/signed-rag',   label: 'Signed RAG',        icon: '⬡', desc: 'Dilithium3 FIPS 204 citations',      accent: '#8b5cf6' },
            { path: '/kitchen',      label: 'Kitchen Analytics', icon: '▣', desc: 'DuckDB OLAP · burn-rate alerts',     accent: '#0891b2' },
            { path: '/whatsapp',     label: 'WhatsApp Bot',      icon: '◆', desc: 'Gupshup · 9 Indian languages',       accent: '#22c55e' },
            { path: '/wellness',     label: 'Wellness Report',   icon: '◎', desc: 'ReportLab PDF · weekly summary',     accent: '#38bdf8' },
          ].map(f => (
            <motion.div
              key={f.path}
              whileHover={{ y: -2 }}
              onClick={() => nav(f.path)}
              style={{ padding: '14px 16px', borderRadius: 12, cursor: 'pointer', border: `1px solid ${f.accent}22`, background: `${f.accent}08`, transition: 'background 0.18s, border-color 0.18s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${f.accent}55`; e.currentTarget.style.background = `${f.accent}12` }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = `${f.accent}22`; e.currentTarget.style.background = `${f.accent}08` }}
            >
              <div style={{ fontSize: 20, marginBottom: 6 }}>{f.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: f.accent, marginBottom: 3, fontFamily: 'var(--font-head)' }}>{f.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text1)', fontFamily: 'var(--font-mono)', lineHeight: 1.4 }}>{f.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {logPatient && (
        <LogModal patientId={logPatient} onClose={() => setLogPatient(null)} onSave={() => { setLogPatient(null); load() }} />
      )}

      <AnimatePresence>
        {toast && <ActionToast key={toast.type + toast.patient} action={toast} onDone={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  )
}
