/**
 * PatientSelector — shared patient picker used across all clinical pages.
 *
 * Props:
 *   value: string        — current patient ID ('P001' | 'P002' | 'P003')
 *   onChange: fn         — called with new patient ID
 *   style?: object       — optional container style override
 */

export const PATIENTS = [
  { id: 'P001', name: 'Ravi Kumar',   dx: 'Type 2 Diabetes',       lang: 'Telugu' },
  { id: 'P002', name: 'Meena Iyer',  dx: 'Renal Failure Stage 4', lang: 'Tamil'  },
  { id: 'P003', name: 'Arjun Singh', dx: 'Post-GI Surgery Day 2', lang: 'Hindi'  },
]

export default function PatientSelector({ value, onChange, style = {} }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', ...style }}>
      {PATIENTS.map(p => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          style={{
            padding: '6px 14px', borderRadius: 8, border: '1px solid',
            borderColor: value === p.id ? 'var(--accent)' : 'var(--border2)',
            background: value === p.id ? 'var(--accent-soft)' : 'transparent',
            color: value === p.id ? 'var(--accent)' : 'var(--text2)',
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: value === p.id ? 700 : 400,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <span style={{ fontWeight: 700 }}>{p.id}</span>
          {' · '}{p.name}
          <span style={{ opacity: 0.6, fontSize: 10 }}> ({p.dx})</span>
        </button>
      ))}
    </div>
  )
}
