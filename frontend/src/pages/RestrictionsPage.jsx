import { useState } from 'react'
import { motion } from 'framer-motion'
import RestrictionConflictGraph from '../components/RestrictionConflictGraph.jsx'
import PatientSelector from '../components/PatientSelector.jsx'

const PATIENTS = [
  { id: 'P001', name: 'Arun Sharma',  restrictions: ['low-sugar', 'diabetic-safe', 'low-fat', 'no-refined-carbs'] },
  { id: 'P002', name: 'Meena Pillai', restrictions: ['low-potassium', 'low-phosphorus', 'low-sodium', 'no-bananas', 'no-tomatoes', 'fluid-restricted'] },
  { id: 'P003', name: 'Ravi Kumar',   restrictions: ['liquid-only', 'low-fiber', 'low-fat'] },
]

export default function RestrictionsPage() {
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
          Dietary Restrictions
        </h1>
        <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          Conflict graph · allergy &amp; restriction cross-check
        </div>
      </div>

      {/* Patient selector */}
      <PatientSelector value={patientId} onChange={setPatientId} style={{ marginBottom: 24 }} />

      <RestrictionConflictGraph
        restrictions={patient.restrictions}
        patientName={patient.name}
        patientId={patient.id}
      />
    </motion.div>
  )
}
