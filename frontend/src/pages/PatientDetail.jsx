import { useState, useEffect, useContext } from 'react'
import { useParams } from 'react-router-dom'
import { apiGet, invalidateCache } from '../api/client.js'
import { patientApi } from '../api/client.js'
import { LangContext } from '../App.jsx'
import { t } from '../nutriguide_i18n.js'

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'mr', name: 'Marathi' },
  { code: 'te', name: 'Telugu' },
  { code: 'ta', name: 'Tamil' },
  { code: 'kn', name: 'Kannada' },
  { code: 'bn', name: 'Bengali' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'ml', name: 'Malayalam' },
]

const DIET_STAGES = ['liquid', 'soft', 'semi-solid', 'solid', 'NPO']

const INPUT_STYLE = {
  background: 'var(--bg1)', border: '1px solid var(--teal)', borderRadius: 6,
  color: 'var(--text1)', padding: '6px 10px', fontSize: 13, width: '100%',
  outline: 'none', boxSizing: 'border-box',
}

const SELECT_STYLE = { ...INPUT_STYLE, cursor: 'pointer' }

export default function PatientDetail() {
  const [patients, setPatients]   = useState([])
  const [selected, setSelected]   = useState(null)
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState(false)
  const [form, setForm]           = useState({})
  const [saving, setSaving]       = useState(false)
  const [saveMsg, setSaveMsg]     = useState('')
  const { lang } = useContext(LangContext)
  const { id } = useParams()

  function loadPatients() {
    return apiGet('/patients')
      .then(res => {
        const d = res?.data || res || []
        setPatients(d)
        return d
      })
  }

  useEffect(() => {
    loadPatients()
      .then(d => {
        if (id) {
          const match = d.find(p => p.id === id)
          setSelected(match || (d.length ? d[0] : null))
        } else if (d.length) {
          setSelected(d[0])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  function startEdit() {
    setForm({
      name:                selected.name || '',
      age:                 selected.age ?? '',
      gender:              selected.gender || '',
      diagnosis:           selected.diagnosis || '',
      diet_stage:          selected.diet_stage || '',
      calorie_target:      selected.calorie_target ?? '',
      sodium_limit_mg:     selected.sodium_limit_mg ?? '',
      potassium_limit_mg:  selected.potassium_limit_mg ?? '',
      fluid_limit_ml:      selected.fluid_limit_ml ?? '',
      restrictions:        (selected.restrictions || []).join(', '),
      language:            selected.language || 'en',
      language_name:       selected.language_name || 'English',
      phone:               selected.phone || '',
      caregiver_phone:     selected.caregiver_phone || '',
      ward:                selected.ward || '',
      bed:                 selected.bed || '',
      admitted_on:         selected.admitted_on || '',
      attending_dietitian: selected.attending_dietitian || '',
      allergies:           (selected.allergies || []).join(', '),
      notes:               selected.notes || '',
    })
    setEditing(true)
    setSaveMsg('')
  }

  function handleLangChange(e) {
    const chosen = LANGUAGES.find(l => l.code === e.target.value)
    setForm(f => ({ ...f, language: chosen.code, language_name: chosen.name }))
  }

  async function saveEdit() {
    setSaving(true)
    setSaveMsg('')
    try {
      const payload = {
        name:                form.name || undefined,
        age:                 form.age !== '' ? Number(form.age) : undefined,
        gender:              form.gender || undefined,
        diagnosis:           form.diagnosis || undefined,
        diet_stage:          form.diet_stage || undefined,
        calorie_target:      form.calorie_target !== '' ? Number(form.calorie_target) : undefined,
        sodium_limit_mg:     form.sodium_limit_mg !== '' ? Number(form.sodium_limit_mg) : undefined,
        potassium_limit_mg:  form.potassium_limit_mg !== '' ? Number(form.potassium_limit_mg) : undefined,
        fluid_limit_ml:      form.fluid_limit_ml !== '' ? Number(form.fluid_limit_ml) : undefined,
        restrictions:        form.restrictions ? form.restrictions.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        language:            form.language || undefined,
        language_name:       form.language_name || undefined,
        phone:               form.phone || undefined,
        caregiver_phone:     form.caregiver_phone || undefined,
        ward:                form.ward || undefined,
        bed:                 form.bed || undefined,
        admitted_on:         form.admitted_on || undefined,
        attending_dietitian: form.attending_dietitian || undefined,
        allergies:           form.allergies ? form.allergies.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        notes:               form.notes !== undefined ? form.notes : undefined,
      }
      // Remove undefined keys — server ignores absent fields
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])

      await patientApi.update(selected.id, payload)
      // Refresh patient list + update selected
      invalidateCache('/patients')
      await loadPatients().then(d => {
        const updated = d.find(p => p.id === selected.id)
        if (updated) setSelected(updated)
      })
      setSaveMsg('✓ Saved — reports will reflect new details immediately.')
      setEditing(false)
    } catch (err) {
      setSaveMsg('✘ Save failed: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ color: 'var(--text2)', padding: 32 }}>{t(lang, 'loading_patients')}</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, maxWidth: 1100 }}>
      {/* Patient list */}
      <div style={{ background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13, color: 'var(--text1)' }}>
          {t(lang, 'patients')}
        </div>
        {patients.map(p => (
          <div
            key={p.id}
            onClick={() => { setSelected(p); setEditing(false); setSaveMsg('') }}
            style={{
              padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
              background: selected?.id === p.id ? 'var(--teal-dim)' : 'transparent',
              color: selected?.id === p.id ? 'var(--teal)' : 'var(--text2)',
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 600 }}>{p.name}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{p.id} · {p.diagnosis}</div>
          </div>
        ))}
      </div>

      {/* Patient detail / edit */}
      {selected && (
        <div style={{ background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', padding: 24 }}>
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text1)', fontFamily: 'var(--font-head)' }}>{selected.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{selected.id} · {selected.ward}</div>
            </div>
            {!editing && (
              <button
                onClick={startEdit}
                style={{
                  background: 'var(--teal-dim)', color: 'var(--teal)', border: '1px solid var(--teal)',
                  borderRadius: 8, padding: '7px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                ✏ Edit
              </button>
            )}
          </div>

          {saveMsg && (
            <div style={{
              marginBottom: 14, padding: '8px 14px', borderRadius: 8, fontSize: 13,
              background: saveMsg.startsWith('✓') ? 'rgba(46,204,113,0.12)' : 'rgba(255,76,106,0.12)',
              color: saveMsg.startsWith('✓') ? '#2ECC71' : '#FF4C6A',
              border: `1px solid ${saveMsg.startsWith('✓') ? '#2ECC71' : '#FF4C6A'}`,
            }}>
              {saveMsg}
            </div>
          )}

          {/* ── READ MODE ─────────────────────────────────────────────── */}
          {!editing && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  [t(lang,'age'),          selected.age + ' ' + t(lang,'yrs')],
                  [t(lang,'gender'),       selected.gender],
                  [t(lang,'diagnosis'),    selected.diagnosis],
                  [t(lang,'diet_stage'),   selected.diet_stage || '—'],
                  [t(lang,'admitted'),     selected.admitted_on || '—'],
                  [t(lang,'restrictions'), (selected.restrictions || []).join(', ') || '—'],
                  ['Language',             selected.language_name || selected.language || '—'],
                  ['Phone',                selected.phone || '—'],
                  ['Ward / Bed',           `${selected.ward || '—'} / ${selected.bed || '—'}`],
                  ['Dietitian',            selected.attending_dietitian || '—'],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: 'var(--bg1)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', marginTop: 3 }}>{v}</div>
                  </div>
                ))}
              </div>

              {selected.medications?.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t(lang, 'medications')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selected.medications.map((m, i) => (
                      <div key={i} style={{ background: 'var(--teal-dim)', color: 'var(--teal)', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
                        {m.name} {m.dose}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── EDIT MODE ─────────────────────────────────────────────── */}
          {editing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Name */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Name</span>
                  <input style={INPUT_STYLE} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </label>
                {/* Age */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Age</span>
                  <input style={INPUT_STYLE} type="number" value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} />
                </label>
                {/* Gender */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Gender</span>
                  <select style={SELECT_STYLE} value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                {/* Diet stage */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Diet Stage</span>
                  <select style={SELECT_STYLE} value={form.diet_stage} onChange={e => setForm(f => ({ ...f, diet_stage: e.target.value }))}>
                    {DIET_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                {/* Language */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Language (AI & Reports)</span>
                  <select style={SELECT_STYLE} value={form.language} onChange={handleLangChange}>
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                  </select>
                </label>
                {/* Calorie target */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Calorie Target (kcal/day)</span>
                  <input style={INPUT_STYLE} type="number" value={form.calorie_target} onChange={e => setForm(f => ({ ...f, calorie_target: e.target.value }))} />
                </label>
                {/* Phone */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Phone (WhatsApp)</span>
                  <input style={INPUT_STYLE} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </label>
                {/* Caregiver phone */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Caregiver Phone</span>
                  <input style={INPUT_STYLE} value={form.caregiver_phone} onChange={e => setForm(f => ({ ...f, caregiver_phone: e.target.value }))} />
                </label>
                {/* Ward */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Ward</span>
                  <input style={INPUT_STYLE} value={form.ward} onChange={e => setForm(f => ({ ...f, ward: e.target.value }))} />
                </label>
                {/* Bed */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Bed</span>
                  <input style={INPUT_STYLE} value={form.bed} onChange={e => setForm(f => ({ ...f, bed: e.target.value }))} />
                </label>
                {/* Admitted on */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Admitted On</span>
                  <input style={INPUT_STYLE} type="date" value={form.admitted_on} onChange={e => setForm(f => ({ ...f, admitted_on: e.target.value }))} />
                </label>
                {/* Dietitian */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Attending Dietitian</span>
                  <input style={INPUT_STYLE} value={form.attending_dietitian} onChange={e => setForm(f => ({ ...f, attending_dietitian: e.target.value }))} />
                </label>
              </div>

              {/* Full-width fields */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Diagnosis</span>
                <input style={INPUT_STYLE} value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Restrictions (comma-separated)</span>
                <input style={INPUT_STYLE} value={form.restrictions} onChange={e => setForm(f => ({ ...f, restrictions: e.target.value }))} placeholder="low_gi, no_sugar, low_sodium" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Allergies (comma-separated)</span>
                <input style={INPUT_STYLE} value={form.allergies} onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))} placeholder="peanut, shellfish" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Clinical Notes</span>
                <textarea
                  style={{ ...INPUT_STYLE, minHeight: 72, resize: 'vertical' }}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </label>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  style={{
                    background: 'var(--teal)', color: '#0D1117', border: 'none',
                    borderRadius: 8, padding: '9px 24px', fontSize: 14, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Saving…' : '✓ Save Changes'}
                </button>
                <button
                  onClick={() => { setEditing(false); setSaveMsg('') }}
                  style={{
                    background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '9px 20px', fontSize: 14, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
