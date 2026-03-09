import { useState, useEffect, useContext } from 'react'
import RestrictionConflictGraph from '../components/RestrictionConflictGraph.jsx'
import FoodDrugGraph from '../components/FoodDrugGraph.jsx'
import { patientApi } from '../api/client.js'
import { LangContext } from '../App.jsx'
import { t } from '../cap3s_i18n.js'

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack']
const MEAL_ICONS = { breakfast: '☀', lunch: '◑', dinner: '☾', snack: '◇' }

// Fallback restrictions used only when the API call fails
const PATIENT_RESTRICTIONS_FALLBACK = {
  'P001': ['low-sugar', 'diabetic-safe', 'low-fat', 'no-refined-carbs'],
  'P002': ['low-potassium', 'low-phosphorus', 'low-sodium', 'no-bananas', 'no-tomatoes', 'fluid-restricted'],
  'P003': ['liquid-only', 'low-fiber', 'low-fat'],
}

function MacroBadge({ labelKey, val, unit, color }) {
  const { lang } = useContext(LangContext)
  return (
    <div style={{ textAlign: 'center', padding: '6px 10px', background: 'var(--bg)', borderRadius: 8, minWidth: 64 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{val}<span style={{ fontSize: 10, fontWeight: 400 }}>{unit}</span></div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{t(lang, labelKey)}</div>
    </div>
  )
}

function MealCard({ meal, violation }) {
  return (
    <div style={{
      background: violation ? '#F43F5E06' : 'var(--bg3)',
      border: `1px solid ${violation ? '#F43F5E40' : 'var(--border)'}`,
      borderRadius: 10, padding: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 16 }}>{MEAL_ICONS[meal.meal_time]}</span>
            <span style={{ fontWeight: 700, fontSize: 14, textTransform: 'capitalize' }}>{meal.meal_time}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 3, fontStyle: 'italic' }}>{meal.dish_name}</div>
        </div>
        {violation
          ? <span className="badge badge-red">⚠ {meal.violation}</span>
          : meal.compliance_status === 'compliant'
          ? <span className="badge badge-green">✓ Safe</span>
          : <span className="badge badge-amber">~ Pending</span>
        }
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
        {meal.ingredients?.slice(0,4).join(', ')}{meal.ingredients?.length > 4 ? ` +${meal.ingredients.length - 4} more` : ''}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <MacroBadge labelKey="cal" val={Math.round(meal.calories || 0)} unit="" color="var(--teal)" />
        <MacroBadge labelKey="protein" val={`${meal.protein_g || 0}`} unit="g" color="var(--amber)" />
        <MacroBadge labelKey="carbs" val={`${meal.carb_g || 0}`} unit="g" color="#818CF8" />
        <MacroBadge labelKey="sodium" val={Math.round(meal.sodium_mg || 0)} unit="mg" color="var(--text2)" />
      </div>
      {meal.prep_notes && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)', padding: '6px 10px', background: 'var(--bg)', borderRadius: 6, borderLeft: '2px solid var(--border2)' }}>
          📋 {meal.prep_notes}
        </div>
      )}
    </div>
  )
}

export default function MealPlan() {
  const { lang } = useContext(LangContext)
  const [patientId, setPatientId] = useState('P001')
  const [restrictions, setRestrictions] = useState(PATIENT_RESTRICTIONS_FALLBACK['P001'])
  const [plan, setPlan] = useState(null)
  const [compliance, setCompliance] = useState(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [activeDay, setActiveDay] = useState(1)
  const [error, setError] = useState(null)

  // Fetch live restrictions when patient changes
  useEffect(() => {
    patientApi.getDietaryOrders(patientId)
      .then(res => {
        const r = res?.data?.restrictions || res?.restrictions
        if (Array.isArray(r) && r.length) setRestrictions(r)
        else setRestrictions(PATIENT_RESTRICTIONS_FALLBACK[patientId] || [])
      })
      .catch(() => setRestrictions(PATIENT_RESTRICTIONS_FALLBACK[patientId] || []))
  }, [patientId])

  async function generate() {
    setLoading(true); setError(null); setPlan(null); setCompliance(null)
    const r = await fetch('/api/v1/generate_meal_plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId })
    }).then(r => r.json()).catch(e => ({ error: e.message }))
    setLoading(false)
    if (r.error) { setError(r.error); return }
    setPlan(r); setActiveDay(1)
  }

  async function checkCompliance() {
    if (!plan) return
    setChecking(true)
    const allItems = (plan.meal_plan || []).flatMap(m => m.ingredients || [])
    const r = await fetch('/api/v1/check_meal_compliance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId, meal_items: allItems, meal_name: 'Full Meal Plan' })
    }).then(r => r.json()).catch(() => null)
    setChecking(false)
    setCompliance(r)
  }

  const dayMeals = plan?.meal_plan?.filter(m => m.day_number === activeDay) || []
  const totalCals = dayMeals.reduce((s, m) => s + (m.calories || 0), 0)

  return (
    <div style={{ animation: 'fadeUp 0.4s ease' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
          {t(lang, 'meal_plan_title')}
        </div>
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>{t(lang, 'meal_plan_sub')}</div>
      </div>

      {/* Controls */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t(lang, 'patient_label')}</label>
            <select className="input" value={patientId} onChange={e => setPatientId(e.target.value)}>
              <option value="P001">P001 — Ravi Kumar (Type 2 Diabetes)</option>
              <option value="P002">P002 — Meena Iyer (Renal Failure Stage 4)</option>
              <option value="P003">P003 — Arjun Singh (Post-GI Surgery)</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={generate} disabled={loading} style={{ padding: '9px 22px' }}>
            {loading
              ? <><span style={{ width: 14, height: 14, border: '2px solid #00000030', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }}/> {t(lang, 'generating')}</>
              : t(lang, 'generate_plan')}
          </button>
          {plan && (
            <button className="btn btn-ghost" onClick={checkCompliance} disabled={checking}>
              {checking ? t(lang, 'checking') : t(lang, 'check_compliance')}
            </button>
          )}
        </div>
      </div>

      {/* Restriction conflict graph */}
      <RestrictionConflictGraph
        restrictions={restrictions}
        patientName={patientId}
      />

      {/* SOTA 2 — Food-Drug Interaction Graph */}
      <FoodDrugGraph patientId={patientId} />

      {error && (
        <div className="card" style={{ borderColor: '#F43F5E50', background: 'var(--red-dim)', color: 'var(--red)', marginBottom: 20 }}>
          ⚠ {error}
        </div>
      )}

      {/* Compliance banner */}
      {compliance && (
        <div className="card" style={{
          marginBottom: 20,
          borderColor: compliance.violations_found > 0 ? '#F43F5E50' : '#22C55E50',
          background: compliance.violations_found > 0 ? '#F43F5E06' : '#22C55E06'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: compliance.violations_found > 0 ? 'var(--red)' : 'var(--green)' }}>
                {compliance.violations_found > 0
                  ? `⚠ ${compliance.violations_found} Violations Detected — Auto-substituted`
                  : '✓ Full Compliance — All meals safe'}
              </div>
              <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 3 }}>
                {compliance.suggested_substitutes?.map(s => `${s.replace} → ${s.with_options?.[0] || '?'}`).join(' · ')}
              </div>
            </div>
            <div style={{ fontSize: 24, fontFamily: 'var(--font-mono)', color: compliance.violations_found > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>
              {compliance.compliance_status === 'COMPLIANT' ? '100' : String(Math.max(0, 100 - (compliance.violations_found || 0) * 10))}%
            </div>
          </div>
        </div>
      )}

      {plan && (
        <>
          {/* Day selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
            {[1,2,3,4,5,6,7].map(d => {
              const dayMealsAll = plan.meal_plan?.filter(m => m.day_number === d) || []
              const hasViolation = dayMealsAll.some(m => m.compliance_status === 'violation')
              return (
                <button key={d} onClick={() => setActiveDay(d)} style={{
                  padding: '8px 18px', borderRadius: 8, flexShrink: 0,
                  border: `1px solid ${activeDay === d ? 'var(--teal)' : hasViolation ? '#F43F5E40' : 'var(--border2)'}`,
                  background: activeDay === d ? 'var(--teal-dim)' : 'var(--bg2)',
                  color: activeDay === d ? 'var(--teal)' : hasViolation ? 'var(--red)' : 'var(--text2)',
                  cursor: 'pointer', fontSize: 13, fontWeight: activeDay === d ? 700 : 400,
                  transition: 'all 0.15s', position: 'relative'
                }}>
              {t(lang, 'day')} {d}
                  {hasViolation && <span style={{ position: 'absolute', top: 3, right: 3, width: 6, height: 6, borderRadius: '50%', background: 'var(--red)' }}/>}
                </button>
              )
            })}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{t(lang, 'day_total')}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--teal)', fontFamily: 'var(--font-mono)' }}>{Math.round(totalCals)} kcal</span>
            </div>
          </div>

          {/* Meals grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {dayMeals.map((meal, i) => (
              <MealCard key={i} meal={meal} violation={compliance?.violations?.find(v => meal.ingredients?.some(i => i.toLowerCase().includes(v.ingredient?.toLowerCase())))?.reason} />
            ))}
          </div>

          {/* Day summary */}
          <div className="card" style={{ marginTop: 16, display: 'flex', gap: 20, justifyContent: 'center' }}>
            {[
              { l: 'Calories', v: Math.round(totalCals), u: 'kcal', c: 'var(--teal)' },
              { l: 'Protein', v: dayMeals.reduce((s,m) => s + (m.protein_g||0), 0).toFixed(1), u: 'g', c: 'var(--amber)' },
              { l: 'Carbs', v: dayMeals.reduce((s,m) => s + (m.carb_g||0), 0).toFixed(1), u: 'g', c: '#818CF8' },
              { l: 'Fat', v: dayMeals.reduce((s,m) => s + (m.fat_g||0), 0).toFixed(1), u: 'g', c: '#34D399' },
              { l: 'Sodium', v: Math.round(dayMeals.reduce((s,m) => s + (m.sodium_mg||0), 0)), u: 'mg', c: 'var(--text2)' },
            ].map(({ l, v, u, c }) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)', color: c }}>{v}<span style={{ fontSize: 12, fontWeight: 400 }}>{u}</span></div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{l}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
