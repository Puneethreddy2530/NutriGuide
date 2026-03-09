import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Lenis from '@studio-freight/lenis'
import './index.css'
import App from './App.jsx'

// ── Lenis smooth scroll — global ─────────────────────────────────────────────
const lenis = new Lenis({ lerp: 0.1, smoothWheel: true })
function raf(time) {
  lenis.raf(time)
  requestAnimationFrame(raf)
}
requestAnimationFrame(raf)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
