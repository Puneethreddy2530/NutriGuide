import { useState } from 'react'
import { motion } from 'framer-motion'
import TrayVision from '../components/TrayVision.jsx'
import { PATIENTS } from '../components/PatientSelector.jsx'

export default function TrayVisionPage() {
  const [patientId, setPatientId] = useState('P001')
  const patient = PATIENTS.find(p => p.id === patientId) || PATIENTS[0]

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)',
          letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10, opacity: 0.8,
        }}>
          ◎ GKM Hospital · Clinical Intelligence
        </div>
        <h1 style={{
          fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 900,
          letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1, marginBottom: 6,
        }}>
          Tray Vision
        </h1>
        <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          AI-powered plate waste analysis · Gemini Vision + EfficientNet-B4
        </div>
      </div>

      {/* Patient selector — same style as Compliance page */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        {PATIENTS.map(p => (
          <button key={p.id} onClick={() => setPatientId(p.id)} style={{
            flex: 1, padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
            border: `1px solid ${patientId === p.id ? 'var(--teal)' : 'var(--border2)'}`,
            background: patientId === p.id ? 'var(--teal-dim)' : 'var(--bg2)',
            color: patientId === p.id ? 'var(--teal)' : 'var(--text2)',
            transition: 'all 0.15s', textAlign: 'left',
          }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{p.id} · {p.dx}</div>
          </button>
        ))}
      </div>

      <TrayVision patient={patient} />
    </motion.div>
  )
}
