import { useState } from 'react'
import { motion } from 'framer-motion'
import FoodDrugGraph from '../components/FoodDrugGraph.jsx'
import PatientSelector from '../components/PatientSelector.jsx'

export default function FoodDrugPage() {
  const [patientId, setPatientId] = useState('P001')

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
          Food-Drug Interactions
        </h1>
        <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          Knowledge graph · BioBERT NLI drug-nutrient conflict detection
        </div>
      </div>

      {/* Patient selector */}
      <PatientSelector value={patientId} onChange={setPatientId} style={{ marginBottom: 24 }} />

      <FoodDrugGraph patientId={patientId} />
    </motion.div>
  )
}
