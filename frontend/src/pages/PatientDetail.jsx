import { useState, useEffect, useContext } from 'react'
import { useParams } from 'react-router-dom'
import { apiGet } from '../api/client.js'
import { LangContext } from '../App.jsx'
import { t } from '../cap3s_i18n.js'

export default function PatientDetail() {
  const [patients, setPatients] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const { lang } = useContext(LangContext)
  const { id } = useParams()

  useEffect(() => {
    apiGet('/patients')
      .then(res => {
        const d = res?.data || []
        setPatients(d)
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
            onClick={() => setSelected(p)}
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

      {/* Patient detail */}
      {selected && (
        <div style={{ background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text1)', fontFamily: 'var(--font-head)' }}>{selected.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{selected.id} · {selected.ward}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              [t(lang,'age'), selected.age + ' ' + t(lang,'yrs')],
              [t(lang,'gender'), selected.gender],
              [t(lang,'diagnosis'), selected.diagnosis],
              [t(lang,'diet_stage'), selected.diet_stage || '—'],
              [t(lang,'admitted'), selected.admitted_on || '—'],
              [t(lang,'restrictions'), (selected.restrictions || []).join(', ') || '—'],
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
        </div>
      )}
    </div>
  )
}
