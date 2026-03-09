import React, { useState, useEffect, useRef, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  LayoutDashboard, Users, Utensils, CheckCircle2, Bot,
  FileBarChart2, ShieldCheck, Menu, ChevronLeft, ChevronDown,
} from 'lucide-react'
import Dashboard from './pages/Dashboard.jsx'
import PatientDetail from './pages/PatientDetail.jsx'
import MealPlan from './pages/MealPlan.jsx'
import Compliance from './pages/Compliance.jsx'
import DietitianAI from './pages/DietitianAI.jsx'
import Reports from './pages/Reports.jsx'
import AuditTrail from './pages/PQCStatus.jsx'
import NurseView from './pages/NurseView.jsx'

gsap.registerPlugin(useGSAP)

// ── Language Context ──────────────────────────────────────────────────────────
export const LangContext = createContext({ lang: 'english', setLang: () => {} })

const LANGS = [
  { key: 'english',  label: 'EN', name: 'English'   },
  { key: 'hindi',    label: 'HI', name: 'à¤¹à¤¿à¤¨à¥à¤¦à¥€'     },
  { key: 'marathi',  label: 'MR', name: 'मराठी'     },
  { key: 'telugu',   label: 'TE', name: 'à°¤à±†à°²à±à°—à±'    },
  { key: 'tamil',    label: 'TA', name: 'à®¤à®®à®¿à®´à¯'     },
  { key: 'kannada',  label: 'KN', name: 'à²•à²¨à³à²¨à²¡'     },
  { key: 'bengali',  label: 'BN', name: 'বাংলা'     },
  { key: 'gujarati', label: 'GU', name: 'àª—à«àªœàª°àª¾àª¤à«€'   },
  { key: 'punjabi',  label: 'PA', name: 'ਪੰਜਾਬੀ'    },
]

// ── Nav items with Lucide icons ─────────────────────────────────────────────
const NAV = [
  { path: '/',           icon: LayoutDashboard, labels: {
    english: 'Command Center', hindi: 'à¤•à¤®à¤¾à¤‚à¤¡ à¤¸à¥‡à¤‚à¤Ÿà¤°', marathi: 'à¤•à¤®à¤¾à¤‚à¤¡ à¤•à¥‡à¤‚à¤¦à¥à¤°',
    telugu: 'à°•à°®à°¾à°‚à°¡à± à°¸à±†à°‚à°Ÿà°°à±', tamil: 'à®•à®Ÿà¯à®Ÿà®³à¯ˆ à®®à¯ˆà®¯à®®à¯', kannada: 'à²•à²®à²¾à²‚à²¡à³ à²¸à³†à²‚à²Ÿà²°à³',
    bengali: 'à¦•à¦®à¦¾à¦¨à§à¦¡ à¦¸à§‡à¦¨à§à¦Ÿà¦¾à¦°', gujarati: 'àª•àª®àª¾àª¨à«àª¡ àª¸à«‡àª¨à«àªŸàª°', punjabi: 'à¨•à¨®à¨¾à¨‚à¨¡ à¨¸à©ˆà¨‚à¨Ÿà¨°' } },
  { path: '/patients',   icon: Users, labels: {
    english: 'Patients', hindi: 'à¤®à¤°à¥€à¤œà¤¼', marathi: 'à¤°à¥à¤—à¥à¤£',
    telugu: 'à°°à±‹à°—à±à°²à±', tamil: 'à®¨à¯‹à®¯à®¾à®³à®¿à®•à®³à¯', kannada: 'à²°à³‹à²—à²¿à²—à²³à³',
    bengali: 'à¦°à§‹à¦—à§€', gujarati: 'àª¦àª°à«àª¦à«€àª“', punjabi: 'à¨®à¨°à©€à¨œà¨¼' } },
  { path: '/meal-plan',  icon: Utensils, labels: {
    english: 'Meal Plans', hindi: 'भोजन योजना', marathi: 'जेवण योजना',
    telugu: 'à°­à±‹à°œà°¨ à°ªà±à°°à°£à°¾à°³à°¿à°•', tamil: 'à®‰à®£à®µà¯ à®¤à®¿à®Ÿà¯à®Ÿà®®à¯', kannada: 'à²Šà²Ÿà²¦ à²¯à³‹à²œà²¨à³†',
    bengali: 'à¦–à¦¾à¦¬à¦¾à¦° à¦ªà¦°à¦¿à¦•à¦²à§à¦ªà¦¨à¦¾', gujarati: 'àª­à«‹àªœàª¨ àª¯à«‹àªœàª¨àª¾', punjabi: 'à¨­à©‹à¨œà¨¨ à¨¯à©‹à¨œà¨¨à¨¾' } },
  { path: '/compliance', icon: CheckCircle2, labels: {
    english: 'Compliance', hindi: 'à¤…à¤¨à¥à¤ªà¤¾à¤²à¤¨', marathi: 'à¤…à¤¨à¥à¤ªà¤¾à¤²à¤¨',
    telugu: 'à°¸à°®à±à°®à°¤à°¿', tamil: 'à®‡à®£à®•à¯à®•à®®à¯', kannada: 'à²…à²¨à³à²¸à²°à²£à³†',
    bengali: 'à¦¸à¦®à§à¦®à¦¤à¦¿', gujarati: 'àª…àª¨à«àªªàª¾àª²à¤¨', punjabi: 'à¨ªà¨¾à¨²à¨£à¨¾' } },
  { path: '/ai',         icon: Bot, labels: {
    english: 'Dietitian AI', hindi: 'आहार AI', marathi: 'आहार AI',
    telugu: 'à°¡à±ˆà°Ÿà°¿à°·à°¿à°¯à°¨à± AI', tamil: 'à®‰à®£à®µà®¿à®¯à®²à¯ AI', kannada: 'à²†à²¹à²¾à²° AI',
    bengali: 'ডায়েটিশিয়ান AI', gujarati: 'ડાઈटिशियन AI', punjabi: 'ਡਾਇਟੀਸ਼ੀਅਨ AI' } },
  { path: '/reports',    icon: FileBarChart2, labels: {
    english: 'Reports', hindi: 'à¤°à¤¿à¤ªà¥‹à¤°à¥à¤Ÿ', marathi: 'à¤…à¤¹à¤µà¤¾à¤²',
    telugu: 'à°¨à°¿à°µà±‡à°¦à°¿à°•à°²à±', tamil: 'à®…à®±à®¿à®•à¯à®•à¯ˆà®•à®³à¯', kannada: 'à²µà²°à²¦à²¿à²—à²³à³',
    bengali: 'à¦ªà§à¦°à¦¤à¦¿à¦¬à§‡à¦¦à¦¨', gujarati: 'àª…à¤¹à¥‡à¤µà¤¾à¤²', punjabi: 'à¨°à¨¿à¨ªà©‹à¨°à¨Ÿà¨¾à¨‚' } },
  { path: '/pqc',        icon: ShieldCheck, labels: {
    english: 'PQC Security', hindi: 'PQC à¤¸à¥à¤°à¤•à¥à¤·à¤¾', marathi: 'PQC à¤¸à¥à¤°à¤•à¥à¤·à¤¾',
    telugu: 'PQC à°­à°¦à±à°°à°¤', tamil: 'PQC à®ªà®¾à®¤à¯à®•à®¾à®ªà¯à®ªà¯', kannada: 'PQC à²­à²¦à³à²°à²¤à³†',
    bengali: 'PQC à¦¨à¦¿à¦°à¦¾à¦ªà¦¤à§à¦¤à¦¾', gujarati: 'PQC àª¸à¥à¤°à¤•à¥à¤·à¤¾', punjabi: 'PQC à¨¸à©à¨°à©±à¨–à¨¿à¨†' } },
]

// ── Error Boundary ─────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(err, info) { console.error('[CAP³S] Page error:', err, info) }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 64, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16, filter: 'drop-shadow(0 0 12px rgba(244,63,94,0.6))' }}>⚠</div>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 20, fontWeight: 800, marginBottom: 10, color: 'var(--text)' }}>
          Page Crash
        </div>
        <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'var(--font-mono)', marginBottom: 24,
          background: 'var(--bg2)', padding: '12px 20px', borderRadius: 'var(--radius)', display: 'inline-block',
          maxWidth: 500, border: '1px solid var(--border2)' }}>
          {this.state.error.message}
        </div>
        <div>
          <button className="btn btn-primary" onClick={() => this.setState({ error: null })}>↺ Try Again</button>
        </div>
      </div>
    )
    return this.props.children
  }
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ alerts, expanded, toggleExpand, lang, setLang }) {
  const loc = useLocation()
  const [showLangMenu, setShowLangMenu] = useState(false)
  const sidebarRef = useRef(null)
  const currentLang = LANGS.find(l => l.key === lang) || LANGS[0]

  // GSAP liquid hover on nav items
  useGSAP(() => {
    const items = sidebarRef.current?.querySelectorAll('.sb-item')
    if (!items) return
    items.forEach(item => {
      item.addEventListener('mouseenter', () => {
        gsap.to(item, { scale: 1.03, x: 2, duration: 0.3, ease: 'power3.out' })
        gsap.to(item.querySelector('.sb-icon'), { color: 'var(--accent)', duration: 0.2 })
      })
      item.addEventListener('mouseleave', () => {
        gsap.to(item, { scale: 1, x: 0, duration: 0.25, ease: 'power3.inOut' })
      })
    })
  }, { scope: sidebarRef, dependencies: [expanded] })

  // GSAP stagger entrance
  useGSAP(() => {
    if (!sidebarRef.current) return
    gsap.from(sidebarRef.current.querySelectorAll('.sb-item'), {
      opacity: 0, x: -16, stagger: 0.05, duration: 0.5,
      ease: 'power3.out', delay: 0.1,
    })
  }, { scope: sidebarRef })

  useEffect(() => {
    if (!showLangMenu) return
    const close = () => setShowLangMenu(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [showLangMenu])

  return (
    <aside ref={sidebarRef} style={{
      width: expanded ? 224 : 64,
      minHeight: '100vh',
      background: 'rgba(255,255,255,0.82)',
      borderRight: '1px solid var(--border)',
      boxShadow: '4px 0 24px rgba(0,0,0,0.06)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      display: 'flex', flexDirection: 'column',
      alignItems: expanded ? 'stretch' : 'center',
      position: 'fixed', left: 0, top: 0, zIndex: 100,
      paddingBottom: 14,
      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden',
    }}>
      <style>{`
        .sb-item { will-change: transform; }
        .sb-item.active-link .sb-icon { color: var(--accent) !important; }
        .lang-opt:hover { background: var(--accent-soft) !important; color: var(--accent) !important; }
        .sb-hamburger:hover { background: rgba(0,0,0,0.04) !important; }
        .sb-logo-pulse { animation: glow-pulse 3s ease-in-out infinite; }
      `}</style>

      {/* Top: hamburger + logo */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: expanded ? '16px 12px 10px' : '16px 0 10px',
        gap: 10, flexShrink: 0,
        justifyContent: expanded ? 'flex-start' : 'center',
        borderBottom: '1px solid var(--border)',
        marginBottom: 8,
      }}>
        <button className="sb-hamburger" onClick={toggleExpand}
          style={{
            width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'transparent', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 16, color: 'var(--text3)',
            transition: 'all 0.2s', flexShrink: 0,
          }}>
          {expanded ? <ChevronLeft size={16} /> : <Menu size={16} />}
        </button>
        {expanded && (
          <div className="sb-logo-pulse" style={{
            fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 900,
            color: 'var(--accent)', letterSpacing: '-0.03em', whiteSpace: 'nowrap',
            textShadow: '0 0 20px rgba(8,145,178,0.35)',
          }}>CAP³S</div>
        )}
      </div>

      {/* Nav items */}
      <nav style={{
        display: 'flex', flexDirection: 'column', gap: 3, flex: 1,
        padding: expanded ? '0 8px' : '0',
        alignItems: expanded ? 'stretch' : 'center',
      }}>
        {NAV.map(({ path, icon: IconComp, labels }) => {
          const active = path === '/' ? loc.pathname === '/' : loc.pathname.startsWith(path)
          const label = labels[lang] || labels.english
          return (
            <NavLink key={path} to={path} style={{ textDecoration: 'none' }}>
              <div className={`sb-item${active ? ' active-link' : ''}`} title={expanded ? undefined : label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: expanded ? '9px 12px' : '9px 0',
                  width: expanded ? '100%' : 42, height: 42,
                  justifyContent: expanded ? 'flex-start' : 'center',
                  background: active
                    ? 'linear-gradient(135deg, var(--accent-soft), rgba(8,145,178,0.03))'
                    : 'transparent',
                  borderRadius: 10,
                  border: active ? '1px solid var(--border-accent)' : '1px solid transparent',
                  boxShadow: active ? 'var(--shadow-glow)' : 'none',
                  cursor: 'pointer', position: 'relative',
                }}>
                <span className="sb-icon" style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: active ? 'var(--accent)' : 'var(--text3)',
                  transition: 'color 0.2s', width: 20,
                }}><IconComp size={17} strokeWidth={1.8} /></span>
                {expanded && (
                  <span style={{
                    fontSize: 12.5, fontWeight: active ? 600 : 400,
                    color: active ? 'var(--text)' : 'var(--text2)',
                    whiteSpace: 'nowrap', overflow: 'hidden',
                    fontFamily: 'var(--font-body)',
                    transition: 'color 0.2s',
                  }}>{label}</span>
                )}
                {path === '/' && alerts > 0 && (
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--danger)',
                    boxShadow: '0 0 8px rgba(244,63,94,0.8)',
                    flexShrink: 0, marginLeft: expanded ? 'auto' : 0,
                    position: expanded ? 'relative' : 'absolute',
                    top: expanded ? 0 : 7, right: expanded ? 0 : 6,
                  }}/>
                )}
              </div>
            </NavLink>
          )
        })}
      </nav>

      {/* Language picker */}
      <div style={{
        padding: expanded ? '8px 8px 4px' : '8px 0 4px',
        borderTop: '1px solid var(--border)',
        position: 'relative',
        display: 'flex', justifyContent: expanded ? 'flex-start' : 'center',
      }} onClick={e => e.stopPropagation()}>
        <button onClick={() => setShowLangMenu(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: expanded ? '7px 12px' : '7px 0',
            width: expanded ? '100%' : 42, height: 34,
            justifyContent: expanded ? 'flex-start' : 'center',
            background: showLangMenu ? 'var(--accent-soft)' : 'transparent',
            border: 'none', borderRadius: 8, cursor: 'pointer',
            transition: 'all 0.15s',
          }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            color: 'var(--accent)', flexShrink: 0, minWidth: 18, textAlign: 'center',
          }}>{currentLang.label}</span>
          {expanded && <>
            <span style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap', fontFamily: 'var(--font-body)' }}>
              {currentLang.name}
            </span>
            <ChevronDown size={12} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
          </>}
        </button>

        {showLangMenu && (
          <div style={{
            position: 'absolute', bottom: '100%',
            left: expanded ? 8 : 56, minWidth: 175,
            background: 'var(--bg1)',
            border: '1px solid var(--border2)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)',
            zIndex: 9999, padding: 6,
            backdropFilter: 'blur(20px)',
          }}>
            {LANGS.map(l => (
              <button key={l.key} className="lang-opt"
                onClick={() => { setLang(l.key); setShowLangMenu(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '7px 10px', borderRadius: 7,
                  border: 'none', cursor: 'pointer', fontSize: 12, textAlign: 'left',
                  background: lang === l.key ? 'var(--accent-soft)' : 'transparent',
                  color: lang === l.key ? 'var(--accent)' : 'var(--text2)',
                  fontWeight: lang === l.key ? 700 : 400, transition: 'all 0.12s',
                  fontFamily: 'var(--font-body)',
                }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 10,
                  color: 'var(--accent)', minWidth: 22 }}>{l.label}</span>
                <span>{l.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* System status dot */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
        padding: expanded ? '6px 20px 0' : '6px 0 0',
        justifyContent: expanded ? 'flex-start' : 'center',
      }}>
        <div className="status-dot-green" title="Backend Online" />
        {expanded && <span style={{
          fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)',
        }}>System Online</span>}
      </div>
    </aside>
  )
}

// ── Animated page wrapper ─────────────────────────────────────────────────────
function PageTransition({ children }) {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        style={{ minHeight: '100%' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

// ── Layout ─────────────────────────────────────────────────────────────────────
function Layout({ children, alerts, expanded, toggleExpand, lang, setLang }) {
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar alerts={alerts} expanded={expanded} toggleExpand={toggleExpand} lang={lang} setLang={setLang} />
      <main style={{
        marginLeft: expanded ? 224 : 64, flex: 1, minHeight: '100vh',
        padding: '32px 36px',
        transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {children}
      </main>
    </div>
  )
}

// ── App root ───────────────────────────────────────────────────────────────────
export default function App() {
  const [alerts, setAlerts]     = useState(0)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [expanded, setExpanded] = useState(false)
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('cap3s_lang') || 'english' } catch { return 'english' }
  })

  useEffect(() => {
    try { localStorage.setItem('cap3s_lang', lang) } catch {}
  }, [lang])

  useEffect(() => {
    const on  = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => {
    const poll = () =>
      fetch('/api/v1/dashboard').then(r => r.json()).then(d => setAlerts(d.alerts_active || 0)).catch(() => {})
    poll()
    const iv = setInterval(poll, 30000)
    return () => clearInterval(iv)
  }, [])

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <BrowserRouter>
        {/* Offline banner */}
        <AnimatePresence>
          {!isOnline && (
            <motion.div
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -40, opacity: 0 }}
              style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
                background: 'rgba(245,158,11,0.15)',
                backdropFilter: 'blur(16px)',
                borderBottom: '1px solid rgba(245,158,11,0.3)',
                color: 'var(--warning)', textAlign: 'center',
                padding: '7px 16px', fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontFamily: 'var(--font-mono)',
              }}>
              ⚠ Network offline — showing cached data. Clinical decisions may be outdated.
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Nurse view — standalone mobile route, no sidebar ── */}
        <Routes>
          <Route path="/nurse/:patient_id" element={<NurseView />} />
          <Route path="*" element={
            <Layout alerts={alerts} expanded={expanded} toggleExpand={() => setExpanded(v => !v)}
              lang={lang} setLang={setLang}>
              <ErrorBoundary>
                <PageTransition>
                  <Routes>
                    <Route path="/"             element={<Dashboard />} />
                    <Route path="/patients"     element={<PatientDetail />} />
                    <Route path="/patients/:id" element={<PatientDetail />} />
                    <Route path="/meal-plan"    element={<MealPlan />} />
                    <Route path="/compliance"   element={<Compliance />} />
                    <Route path="/ai"           element={<DietitianAI />} />
                    <Route path="/reports"      element={<Reports />} />
                    <Route path="/pqc"          element={<AuditTrail />} />
                  </Routes>
                </PageTransition>
              </ErrorBoundary>
            </Layout>
          } />
        </Routes>
      </BrowserRouter>
    </LangContext.Provider>
  )
}


// ── Language Context (consumed by any component that needs localisation) ─────
